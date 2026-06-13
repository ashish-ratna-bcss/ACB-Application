// currency_note_scanning_screen.dart
// Full currency scanner integrated into CopWriter — themed with VCColors/VCTextStyles

import 'dart:io';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:tflite_flutter/tflite_flutter.dart';
import 'package:image/image.dart' as img;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../theme/app_theme.dart';

// ─────────────────────────────────────────────
// DATA MODEL
// ─────────────────────────────────────────────
class NoteRecord {
  final String id;
  final String denomination;
  final String serialNumber;
  final double confidence;
  final String imagePath;
  final DateTime scannedAt;

  NoteRecord({
    required this.id,
    required this.denomination,
    required this.serialNumber,
    required this.confidence,
    required this.imagePath,
    required this.scannedAt,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'denomination': denomination,
        'serialNumber': serialNumber,
        'confidence': confidence,
        'imagePath': imagePath,
        'scannedAt': scannedAt.toIso8601String(),
      };

  factory NoteRecord.fromJson(Map<String, dynamic> j) => NoteRecord(
        id: j['id'],
        denomination: j['denomination'],
        serialNumber: j['serialNumber'],
        confidence: j['confidence'],
        imagePath: j['imagePath'],
        scannedAt: DateTime.parse(j['scannedAt']),
      );
}

// ─────────────────────────────────────────────
// SHARED PREFS HELPER
// ─────────────────────────────────────────────
class NoteStorage {
  static const _key = 'notelens_records';

  static Future<List<NoteRecord>> loadAll() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getStringList(_key) ?? [];
    return raw
        .map((e) => NoteRecord.fromJson(jsonDecode(e)))
        .toList()
      ..sort((a, b) => b.scannedAt.compareTo(a.scannedAt));
  }

  static Future<void> save(NoteRecord record) async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getStringList(_key) ?? [];
    existing.insert(0, jsonEncode(record.toJson()));
    await prefs.setStringList(_key, existing);
  }

  static Future<void> delete(String id) async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getStringList(_key) ?? [];
    existing.removeWhere((e) {
      final decoded = jsonDecode(e);
      return decoded['id'] == id;
    });
    await prefs.setStringList(_key, existing);
  }

  static Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}

// ─────────────────────────────────────────────
// ML ENGINE  (logic unchanged)
// ─────────────────────────────────────────────
class CurrencyMLEngine {
  static const _inputSize = 224;

  static const _labels = [
    '₹10', '₹20', '₹50', '₹100', '₹200', '₹500', '₹2000'
  ];

  static final _serialRegex = RegExp(
    r'\b[1-9][A-Z]{2}\s?\d{6}\b',
    caseSensitive: false,
  );

  Interpreter? _interpreter;
  final _textRecognizer = TextRecognizer(script: TextRecognitionScript.latin);
  bool _isInitialized = false;

  Future<void> initialize() async {
    try {
      _interpreter = await Interpreter.fromAsset(
        'assets/models/currency_model.tflite',
        options: InterpreterOptions()..threads = 4,
      );
      _isInitialized = true;
    } catch (e) {
      debugPrint('TFLite load error: $e');
      _isInitialized = false;
    }
  }

  Future<Map<String, dynamic>> analyze(String imagePath) async {
    final results = <Map<String, dynamic>>[];
    for (int i = 0; i < 3; i++) {
      final r = await _analyzeSingle(imagePath, cropVariant: i);
      results.add(r);
    }

    final denomCounts = <String, int>{};
    for (final r in results) {
      final d = r['denomination'] as String;
      denomCounts[d] = (denomCounts[d] ?? 0) + 1;
    }
    final bestDenom =
        denomCounts.entries.reduce((a, b) => a.value >= b.value ? a : b).key;

    final avgConf = results
            .where((r) => r['denomination'] == bestDenom)
            .map((r) => r['confidence'] as double)
            .reduce((a, b) => a + b) /
        denomCounts[bestDenom]!;

    final bestResult = results.reduce(
        (a, b) => (a['confidence'] as double) >= (b['confidence'] as double)
            ? a
            : b);
    final serial = bestResult['serialNumber'] as String;

    return {
      'denomination': bestDenom,
      'serialNumber': serial,
      'confidence': avgConf,
      'isValid': bestDenom != 'Unknown',
    };
  }

  Future<Map<String, dynamic>> _analyzeSingle(
    String imagePath, {
    int cropVariant = 0,
  }) async {
    final inputImage = InputImage.fromFilePath(imagePath);
    String serialNumber = '';
    try {
      final recognized = await _textRecognizer.processImage(inputImage);
      final allText =
          recognized.blocks.map((b) => b.text).join(' ').toUpperCase();
      final match = _serialRegex.firstMatch(allText);
      if (match != null) {
        serialNumber = match.group(0)!.replaceAll(' ', ' ').trim();
      }
    } catch (e) {
      debugPrint('OCR error: $e');
    }

    String denomination = 'Unknown';
    double confidence = 0.0;

    if (_isInitialized && _interpreter != null) {
      try {
        final imageBytes = await File(imagePath).readAsBytes();
        final decoded = img.decodeImage(imageBytes);
        if (decoded != null) {
          img.Image cropped = decoded;
          if (cropVariant == 1) {
            final padX = (decoded.width * 0.03).toInt();
            final padY = (decoded.height * 0.03).toInt();
            cropped = img.copyCrop(decoded,
                x: padX,
                y: padY,
                width: decoded.width - padX * 2,
                height: decoded.height - padY * 2);
          } else if (cropVariant == 2) {
            cropped =
                img.copyFlip(decoded, direction: img.FlipDirection.horizontal);
          }

          final resized = img.copyResize(cropped,
              width: _inputSize,
              height: _inputSize,
              interpolation: img.Interpolation.cubic);

          final input = List.generate(
            1,
            (_) => List.generate(
              _inputSize,
              (y) => List.generate(_inputSize, (x) {
                final pixel = resized.getPixel(x, y);
                return [
                  (pixel.r / 127.5) - 1.0,
                  (pixel.g / 127.5) - 1.0,
                  (pixel.b / 127.5) - 1.0,
                ];
              }),
            ),
          );

          final output =
              List.generate(1, (_) => List.filled(_labels.length, 0.0));
          _interpreter!.run(input, output);

          final scores = output[0];
          double maxScore = 0;
          int maxIdx = 0;
          for (int i = 0; i < scores.length; i++) {
            if (scores[i] > maxScore) {
              maxScore = scores[i];
              maxIdx = i;
            }
          }
          denomination = _labels[maxIdx];
          confidence = maxScore;
          if (serialNumber.isNotEmpty) {
            confidence = (confidence * 0.7 + 0.3).clamp(0.0, 1.0);
          }
        }
      } catch (e) {
        debugPrint('TFLite error: $e');
      }
    } else {
      try {
        final inputImg = InputImage.fromFilePath(imagePath);
        final recognized = await _textRecognizer.processImage(inputImg);
        final allText = recognized.blocks.map((b) => b.text).join(' ');


        for (final label in _labels.reversed) {
          final num = label.replaceAll('₹', '');
          if (allText.contains(num) || allText.contains('₹$num')) {
            denomination = label;
            confidence = 0.60;
            break;
          }
        }



        
      } catch (_) {}
    }

    return {
      'denomination': denomination,
      'serialNumber': serialNumber,
      'confidence': confidence,
    };
  }

  void dispose() {
    _interpreter?.close();
    _textRecognizer.close();
  }
}

// ─────────────────────────────────────────────
// MAIN SCREEN  — CopWriter themed
// ─────────────────────────────────────────────
class CurrencyNoteScanningScreen extends StatefulWidget {
  const CurrencyNoteScanningScreen({super.key});

  @override
  State<CurrencyNoteScanningScreen> createState() =>
      _CurrencyNoteScanningScreenState();
}

class _CurrencyNoteScanningScreenState
    extends State<CurrencyNoteScanningScreen> with TickerProviderStateMixin {
  // Camera
  CameraController? _cameraController;
  List<CameraDescription> _cameras = [];
  bool _cameraReady = false;
  bool _torchOn = false;

  // ML
  final _mlEngine = CurrencyMLEngine();
  bool _isAnalyzing = false;

  // Results
  Map<String, dynamic>? _lastResult;
  File? _capturedImage;

  // History
  List<NoteRecord> _history = [];

  // Animation
  late AnimationController _scanAnimController;
  late Animation<double> _scanAnim;

  @override
  void initState() {
    super.initState();
    _scanAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _scanAnim = Tween<double>(begin: 0.1, end: 0.9).animate(
      CurvedAnimation(parent: _scanAnimController, curve: Curves.easeInOut),
    );
    _init();
  }

  Future<void> _init() async {
    await _mlEngine.initialize();
    await _loadHistory();
    await _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) return;
      final back = _cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => _cameras.first,
      );
      _cameraController = CameraController(
        back,
        ResolutionPreset.high,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.jpeg,
      );
      await _cameraController!.initialize();
      if (mounted) setState(() => _cameraReady = true);
    } catch (e) {
      debugPrint('Camera init error: $e');
    }
  }

  Future<void> _loadHistory() async {
    final records = await NoteStorage.loadAll();
    if (mounted) setState(() => _history = records);
  }

  Future<void> _capture() async {
    if (!_cameraReady || _isAnalyzing || _cameraController == null) return;
    setState(() {
      _isAnalyzing = true;
      _lastResult = null;
      _capturedImage = null;
    });
    try {
      final xFile = await _cameraController!.takePicture();
      final imageFile = File(xFile.path);
      setState(() => _capturedImage = imageFile);

      final result = await _mlEngine.analyze(xFile.path);
      setState(() => _lastResult = result);

      final dir = await getApplicationDocumentsDirectory();
      final savedPath =
          '${dir.path}/notelens_${DateTime.now().millisecondsSinceEpoch}.jpg';
      await imageFile.copy(savedPath);

      final record = NoteRecord(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        denomination: result['denomination'] ?? 'Unknown',
        serialNumber: result['serialNumber'] ?? '',
        confidence: result['confidence'] ?? 0.0,
        imagePath: savedPath,
        scannedAt: DateTime.now(),
      );

      // ── Duplicate check by serial number ──
final isDuplicate = record.serialNumber.isNotEmpty &&
    _history.any((r) => r.serialNumber == record.serialNumber);

if (isDuplicate) {
  if (mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'This note was already scanned (${record.serialNumber})',
          style: VCTextStyles.bodyMd.copyWith(color: Colors.white),
        ),
        backgroundColor: VCColors.accentAmber,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }
  setState(() => _isAnalyzing = false);
  return;
}

await NoteStorage.save(record);
await _loadHistory();

      if (result['isValid'] == true) {
        _showResultSheet(record);
      } else {
        _showLowConfidenceSheet();
      }
    } catch (e) {
      debugPrint('Capture error: $e');
      _showError('Something went wrong. Try again.');
    } finally {
      if (mounted) setState(() => _isAnalyzing = false);
    }
  }

  void _showResultSheet(NoteRecord record) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _NoteResultSheet(record: record),
    );
  }

  void _showHistorySheet() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => _NoteHistoryScreen(
          history: _history,
          onDelete: (id) async => await _deleteRecord(id),
          onClearAll: () async {
            await NoteStorage.clearAll();
            await _loadHistory();
          },
        ),
      ),
    );
  }

  void _showLowConfidenceSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: VCColors.ivory,
          borderRadius: BorderRadius.circular(24),
          boxShadow: VCShadow.md,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle
            Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: VCColors.stone,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: VCColors.blushLight,
                borderRadius: VCRadius.md,
              ),
              child: const Icon(Icons.warning_amber_rounded,
                  color: VCColors.accentAmber, size: 30),
            ),
            const SizedBox(height: 16),
            Text('Could Not Detect Note',
                style: VCTextStyles.headingMd),
            const SizedBox(height: 8),
            Text(
              'Place the note flat under good light\nand make sure it fills the frame.',
              textAlign: TextAlign.center,
              style: VCTextStyles.bodyMd,
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Try Again'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: VCTextStyles.bodyMd.copyWith(color: Colors.white)),
        backgroundColor: VCColors.accentPrimary,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  Future<void> _toggleTorch() async {
    if (_cameraController == null) return;
    _torchOn = !_torchOn;
    await _cameraController!
        .setFlashMode(_torchOn ? FlashMode.torch : FlashMode.off);
    setState(() {});
  }

  Future<void> _deleteRecord(String id) async {
    await NoteStorage.delete(id);
    await _loadHistory();
  }

  @override
  void dispose() {
    _cameraController?.dispose();
    _mlEngine.dispose();
    _scanAnimController.dispose();
    super.dispose();
  }

  // ─────────────────────────────────────────────
  // BUILD
  // ─────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {


    
    return Scaffold(
      backgroundColor: VCColors.bgPrimary,
      extendBodyBehindAppBar: true,
      body: Stack(



        children: [
          // ── Full screen camera ──
          _buildCamera(),

          // ── Soft top vignette ──
          Positioned(
            top: 0, left: 0, right: 0,
            child: Container(
              height: 160,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withOpacity(0.55),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // ── Top header ──
          Positioned(
            top: 0, left: 0, right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.35),
                        borderRadius: VCRadius.md,
                        border: Border.all(
                            color: Colors.white.withOpacity(0.15), width: 0.5),
                      ),
                      child: const Icon(Icons.currency_rupee,
                          color: Colors.white, size: 20),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text('Currency Scanner',
                            style: VCTextStyles.headingMd
                                .copyWith(color: Colors.white, fontSize: 16)),
                        Text('Indian Rupee Detection',
                            style: VCTextStyles.bodySm
                                .copyWith(color: Colors.white60)),
                      ],
                    ),
                    const Spacer(),
                    // History badge button
                    GestureDetector(
                      onTap: _showHistorySheet,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 7),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.35),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                              color: Colors.white.withOpacity(0.15),
                              width: 0.5),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.receipt_long_outlined,
                                color: Colors.white70, size: 15),
                            const SizedBox(width: 5),
                            Text('${_history.length}',
                                style: VCTextStyles.bodySm
                                    .copyWith(color: Colors.white70)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Scan frame + bottom bar ──
          SafeArea(
            child: _buildScanContent(),
          ),
        ],
      ),
    );
  }

  Widget _buildCamera() {
    if (!_cameraReady || _cameraController == null) {
      return Container(
        color: VCColors.bgSecondary,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(
                  color: VCColors.accentPrimary, strokeWidth: 2),
              const SizedBox(height: 14),
              Text('Starting camera…',
                  style: VCTextStyles.bodyMd),
            ],
          ),
        ),
      );
    }
    return SizedBox.expand(
      child: FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: _cameraController!.value.previewSize!.height,
          height: _cameraController!.value.previewSize!.width,
          child: CameraPreview(_cameraController!),
        ),
      ),
    );
  }

  Widget _buildScanContent() {
    return Stack(
      children: [
        // ── Scan frame corners ──
        Positioned(
          top: 0, left: 0, right: 0, bottom: 172,
          child: CustomPaint(
            painter: _VCScanFramePainter(
              isAnalyzing: _isAnalyzing,
              scanProgress: _isAnalyzing ? _scanAnim.value : null,
              frameColor: VCColors.accentPrimary,
            ),
            child: _isAnalyzing
                ? AnimatedBuilder(
                    animation: _scanAnim,
                    builder: (_, __) => Stack(
                      children: [
                        Positioned(
                          top: (MediaQuery.of(context).size.height - 172) *
                              0.45 *
                              _scanAnim.value,
                          left: 32,
                          right: 32,
                          child: Container(
                            height: 1.5,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Colors.transparent,
                                  VCColors.accentPrimary.withOpacity(0.7),
                                  Colors.transparent,
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  )
                : const SizedBox.shrink(),
          ),
        ),

        // ── Analyzing overlay ──
        if (_isAnalyzing)
          Positioned(
            top: 0, left: 0, right: 0, bottom: 172,
            child: Container(
              color: Colors.black.withOpacity(0.35),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 24, vertical: 18),
                  decoration: BoxDecoration(
                    color: VCColors.ivory.withOpacity(0.92),
                    borderRadius: VCRadius.lg,
                    boxShadow: VCShadow.sm,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const CircularProgressIndicator(
                          color: VCColors.accentPrimary, strokeWidth: 2),
                      const SizedBox(height: 12),
                      Text('Analysing note…',
                          style: VCTextStyles.bodyMd.copyWith(
                              color: VCColors.textPrimary,
                              fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      Text('Running 3-frame analysis',
                          style: VCTextStyles.bodySm),
                    ],
                  ),
                ),
              ),
            ),
          ),

        // ── Bottom control bar ──
        Positioned(
          bottom: 0, left: 0, right: 0,
          child: Container(
            padding: const EdgeInsets.fromLTRB(28, 20, 28, 32),
            decoration: BoxDecoration(
              color: VCColors.ivory.withOpacity(0.94),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(28)),
              border: Border(
                top: BorderSide(
                    color: VCColors.accentPrimary.withOpacity(0.15),
                    width: 1),
              ),
              boxShadow: VCShadow.md,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // drag handle
                Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: VCColors.stone,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Text(
                  _isAnalyzing
                      ? 'Running 3-frame analysis…'
                      : 'Place the note flat inside the frame',
                  style: VCTextStyles.bodyMd.copyWith(
                    color: _isAnalyzing
                        ? VCColors.accentPrimary
                        : VCColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    // ── Torch ──
                    GestureDetector(
                      onTap: _toggleTorch,
                      child: Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: _torchOn
                              ? VCColors.accentPrimary.withOpacity(0.12)
                              : VCColors.sageLight,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: _torchOn
                                ? VCColors.accentPrimary
                                : VCColors.sageDark,
                            width: 1,
                          ),
                        ),
                        child: Icon(
                          _torchOn
                              ? Icons.flashlight_on
                              : Icons.flashlight_off,
                          color: _torchOn
                              ? VCColors.accentPrimary
                              : VCColors.textSecondary,
                          size: 22,
                        ),
                      ),
                    ),

                    // ── Capture ──
                    GestureDetector(
                      onTap: _isAnalyzing ? null : _capture,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        width: 76,
                        height: 76,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: _isAnalyzing
                              ? null
                              : const LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    VCColors.accentPrimary,
                                    Color(0xFF576048),
                                  ],
                                ),
                          color: _isAnalyzing ? VCColors.stone : null,
                          boxShadow: _isAnalyzing
                              ? null
                              : [
                                  BoxShadow(
                                    color: VCColors.accentPrimary
                                        .withOpacity(0.38),
                                    blurRadius: 20,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                        ),
                        child: Icon(
                          Icons.camera_alt_rounded,
                          color: _isAnalyzing
                              ? VCColors.textMuted
                              : Colors.white,
                          size: 32,
                        ),
                      ),
                    ),

                    // ── History ──
                    GestureDetector(
                      onTap: _showHistorySheet,
                      child: Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: VCColors.sageLight,
                          shape: BoxShape.circle,
                          border: Border.all(color: VCColors.sageDark, width: 1),
                        ),
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            Icon(Icons.receipt_long_outlined,
                                color: VCColors.textSecondary, size: 22),
                            if (_history.isNotEmpty)
                              Positioned(
                                right: 8,
                                top: 8,
                                child: Container(
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(
                                    color: VCColors.accentPrimary,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),

        
      ],
    );
  }
}

// ─────────────────────────────────────────────
// RESULT BOTTOM SHEET  — CopWriter themed
// ─────────────────────────────────────────────
class _NoteResultSheet extends StatelessWidget {
  final NoteRecord record;
  const _NoteResultSheet({required this.record});

  @override
  Widget build(BuildContext context) {
    final imageFile = File(record.imagePath);
    final exists = imageFile.existsSync();

    return Container(
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      decoration: BoxDecoration(
        color: VCColors.ivory,
        borderRadius: const BorderRadius.all(Radius.circular(24)),
        boxShadow: VCShadow.md,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            width: 36,
            height: 4,
            margin: const EdgeInsets.only(top: 14),
            decoration: BoxDecoration(
              color: VCColors.stone,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),

          // Note image
          if (exists)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: ClipRRect(
                borderRadius: VCRadius.lg,
                child: AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Image.file(imageFile, fit: BoxFit.cover),
                ),
              ),
            ),

          const SizedBox(height: 20),

          // Denomination big display
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
            margin: const EdgeInsets.symmetric(horizontal: 20),
            decoration: BoxDecoration(
              color: VCColors.sageLight,
              borderRadius: VCRadius.lg,
              border: Border.all(color: VCColors.sageDark, width: 1),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  record.denomination,
                  style: VCTextStyles.displayLarge.copyWith(
                    color: VCColors.accentPrimary,
                    fontSize: 44,
                    letterSpacing: -1,
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Indian Rupee',
                        style: VCTextStyles.bodySm
                            .copyWith(color: VCColors.textSecondary)),



                    // Container(
                    //   padding: const EdgeInsets.symmetric(
                    //       horizontal: 8, vertical: 3),
                    //   decoration: BoxDecoration(
                    //     color: VCColors.accentGreen.withOpacity(0.12),
                    //     borderRadius: BorderRadius.circular(6),
                    //     border: Border.all(
                    //         color: VCColors.accentGreen.withOpacity(0.3)),
                    //   ),
                    //   child: Text(
                    //     '${(record.confidence * 100).toStringAsFixed(0)}% match',
                    //     style: VCTextStyles.bodySm.copyWith(
                    //         color: VCColors.accentGreen,
                    //         fontWeight: FontWeight.w600),
                    //   ),
                    // ),




                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Serial number card
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: VCColors.bgSecondary,
                borderRadius: VCRadius.md,
                border: Border.all(color: VCColors.border),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: VCColors.sage,
                      borderRadius: VCRadius.sm,
                    ),
                    child: const Icon(Icons.tag_rounded,
                        color: VCColors.accentPrimary, size: 18),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Serial Number', style: VCTextStyles.label),
                      const SizedBox(height: 2),
                      Text(
                        record.serialNumber.isNotEmpty
                            ? record.serialNumber
                            : 'Not detected',
                        style: VCTextStyles.bodyLg.copyWith(
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.w600,
                          color: record.serialNumber.isNotEmpty
                              ? VCColors.textPrimary
                              : VCColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 14),

          // Saved badge
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 20),
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: VCColors.accentGreen.withOpacity(0.08),
              borderRadius: VCRadius.md,
              border: Border.all(
                  color: VCColors.accentGreen.withOpacity(0.25), width: 1),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle_outline,
                    color: VCColors.accentGreen, size: 16),
                const SizedBox(width: 6),
                Text('Saved to scan history',
                    style: VCTextStyles.bodySm.copyWith(
                        color: VCColors.accentGreen,
                        fontWeight: FontWeight.w600)),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Done button
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Done'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
// HISTORY SCREEN  — CopWriter themed
// ─────────────────────────────────────────────
class _NoteHistoryScreen extends StatefulWidget {
  final List<NoteRecord> history;
  final Future<void> Function(String id) onDelete;
  final Future<void> Function() onClearAll;

  const _NoteHistoryScreen({
    required this.history,
    required this.onDelete,
    required this.onClearAll,
  });

  @override
  State<_NoteHistoryScreen> createState() => _NoteHistoryScreenState();
}

class _NoteHistoryScreenState extends State<_NoteHistoryScreen> {
  late List<NoteRecord> _history;
  String _filter = 'All';

  static const _filterOptions = [
    'All', '₹10', '₹20', '₹50', '₹100', '₹200', '₹500', '₹2000'
  ];

  List<NoteRecord> get _filtered => _filter == 'All'
      ? _history
      : _history.where((r) => r.denomination == _filter).toList();

  @override
  void initState() {
    super.initState();
    _history = List.from(widget.history);
  }

  Future<void> _delete(String id) async {
    await widget.onDelete(id);
    setState(() => _history.removeWhere((r) => r.id == id));
  }

  int _denomValue(String d) =>
      int.tryParse(d.replaceAll(RegExp(r'[^0-9]'), '')) ?? 0;

  /// Indian-style grouping: 15000 → "15,000", 150000 → "1,50,000".
  String _indianComma(int n) {
    final s = n.toString();
    if (s.length <= 3) return s;
    final last3 = s.substring(s.length - 3);
    final other = s.substring(0, s.length - 3);
    final grouped =
        other.replaceAllMapped(RegExp(r'\B(?=(\d{2})+(?!\d))'), (_) => ',');
    return '$grouped,$last3';
  }

  String _two(int n) => n.toString().padLeft(2, '0');

  String _fmtDateTime(DateTime dt) =>
      '${_two(dt.day)}/${_two(dt.month)}/${dt.year} '
      '${_two(dt.hour)}:${_two(dt.minute)}';

  /// Builds a seizure report PDF for ALL scanned notes (the whole case) and
  /// opens the system save/share/print sheet.
  Future<void> _downloadReport() async {
    final records = List<NoteRecord>.from(_history)
      ..sort((a, b) => a.scannedAt.compareTo(b.scannedAt));
    if (records.isEmpty) return;

    var totalValue = 0;
    for (final r in records) {
      totalValue += _denomValue(r.denomination);
    }
    final now = DateTime.now();

    final pdf = pw.Document();
    pdf.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(32),
      build: (ctx) => [
        pw.Center(
          child: pw.Text('CURRENCY SEIZURE LIST',
              style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
        ),
        pw.SizedBox(height: 2),
        pw.Center(
          child: pw.Text('ACB  ·  Generated: ${_fmtDateTime(now)}',
              style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
        ),
        pw.SizedBox(height: 16),
        pw.TableHelper.fromTextArray(
          headers: ['Sl. No.', 'Currency Number', 'Denomination'],
          data: [
            for (var i = 0; i < records.length; i++)
              [
                '${i + 1}.',
                records[i].serialNumber.isNotEmpty
                    ? records[i].serialNumber
                    : '—',
                '${_denomValue(records[i].denomination)}/-',
              ]
          ],
          border: pw.TableBorder.all(width: 0.8),
          headerStyle:
              pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold),
          headerDecoration: const pw.BoxDecoration(color: PdfColors.grey200),
          headerHeight: 26,
          cellHeight: 24,
          cellStyle: const pw.TextStyle(fontSize: 11),
          cellAlignments: {
            0: pw.Alignment.center,
            1: pw.Alignment.center,
            2: pw.Alignment.center,
          },
          columnWidths: {
            0: const pw.FlexColumnWidth(1),
            1: const pw.FlexColumnWidth(2.2),
            2: const pw.FlexColumnWidth(1.6),
          },
        ),
        pw.SizedBox(height: 16),
        pw.Text(
          'The total amount was Rs.${_indianComma(totalValue)}/- and currency '
          'notes were ${records.length} in Nos.',
          style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold),
        ),
      ],
    ));

    final bytes = await pdf.save();
    await Printing.sharePdf(
      bytes: bytes,
      filename: 'ACB_Seizure_Report_${now.millisecondsSinceEpoch}.pdf',
    );
  }

  Future<void> _clearAll() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: VCColors.ivory,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Clear all scans?', style: VCTextStyles.headingMd),
        content: Text('This cannot be undone.', style: VCTextStyles.bodyMd),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel',
                style: VCTextStyles.button
                    .copyWith(color: VCColors.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Clear',
                style:
                    VCTextStyles.button.copyWith(color: VCColors.accentRed)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      await widget.onClearAll();
      setState(() => _history.clear());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: VCColors.bgPrimary,
      appBar: AppBar(
        backgroundColor: VCColors.ivory,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: VCColors.textPrimary, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Scan History', style: VCTextStyles.headingMd),
            Text('${_history.length} records',
                style: VCTextStyles.bodySm),
          ],
        ),
        actions: [
          if (_history.isNotEmpty)
            IconButton(
              tooltip: 'Download seizure report (PDF)',
              onPressed: _downloadReport,
              icon: const Icon(Icons.download_rounded,
                  color: VCColors.accentPrimary, size: 22),
            ),
          if (_history.isNotEmpty)
            TextButton(
              onPressed: _clearAll,
              child: Text('Clear all',
                  style: VCTextStyles.button
                      .copyWith(color: VCColors.accentRed, fontSize: 13)),
            ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Divider(height: 1, color: VCColors.border),
        ),
      ),
      body: _history.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: VCColors.sageLight,
                      borderRadius: VCRadius.xl,
                    ),
                    child: const Icon(Icons.receipt_long_outlined,
                        color: VCColors.accentPrimary, size: 34),
                  ),
                  const SizedBox(height: 16),
                  Text('No scans yet', style: VCTextStyles.headingMd),
                  const SizedBox(height: 6),
                  Text('Scan a note to see it here',
                      style: VCTextStyles.bodyMd),
                ],
              ),
            )
          : Column(
              children: [
                const SizedBox(height: 14),
                // ── Filter chips ──
                SizedBox(
                  height: 38,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _filterOptions.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, i) {
                      final opt = _filterOptions[i];
                      final sel = _filter == opt;
                      return GestureDetector(
                        onTap: () => setState(() => _filter = opt),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: sel
                                ? VCColors.accentPrimary
                                : VCColors.sageLight,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: sel
                                  ? VCColors.accentPrimary
                                  : VCColors.sageDark,
                              width: 1,
                            ),
                          ),
                          child: Text(
                            opt,
                            style: VCTextStyles.bodySm.copyWith(
                              color: sel ? Colors.white : VCColors.textSecondary,
                              fontWeight: sel
                                  ? FontWeight.w700
                                  : FontWeight.w400,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 10),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 6),
                  child: Row(
                    children: [
                      Text('${_filtered.length} records',
                          style: VCTextStyles.bodySm),
                    ],
                  ),
                ),
                Expanded(
                  child: _filtered.isEmpty
                      ? Center(
                          child: Text('No $_filter notes scanned',
                              style: VCTextStyles.bodyMd),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                          itemCount: _filtered.length,
                          itemBuilder: (_, i) => _buildCard(_filtered[i]),
                        ),
                ),
              ],
            ),
    );
  }

  Widget _buildCard(NoteRecord record) {
    final imageFile = File(record.imagePath);
    final exists = imageFile.existsSync();

    return Dismissible(
      key: Key(record.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        margin: const EdgeInsets.symmetric(vertical: 5),
        decoration: BoxDecoration(
          color: VCColors.accentRed.withOpacity(0.1),
          borderRadius: VCRadius.md,
          border: Border.all(color: VCColors.accentRed.withOpacity(0.2)),
        ),
        child: const Icon(Icons.delete_outline, color: VCColors.accentRed),
      ),
      onDismissed: (_) => _delete(record.id),
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 5),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: VCColors.ivory,
          borderRadius: VCRadius.md,
          border: Border.all(color: VCColors.border, width: 0.5),
          boxShadow: VCShadow.sm,
        ),
        child: Row(
          children: [
            // Thumbnail
            ClipRRect(
              borderRadius: VCRadius.sm,
              child: SizedBox(
                width: 56,
                height: 56,
                child: exists
                    ? Image.file(imageFile, fit: BoxFit.cover)
                    : Container(
                        color: VCColors.sageLight,
                        child: const Icon(Icons.image_not_supported_outlined,
                            color: VCColors.textMuted, size: 22),
                      ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        record.denomination,
                        style: VCTextStyles.headingMd.copyWith(
                          color: VCColors.accentPrimary,
                          fontSize: 18,
                        ),
                      ),
                      const SizedBox(width: 8),


                      // Container(
                      //   padding: const EdgeInsets.symmetric(
                      //       horizontal: 7, vertical: 2),
                      //   decoration: BoxDecoration(
                      //     color: VCColors.accentGreen.withOpacity(0.1),
                      //     borderRadius: BorderRadius.circular(5),
                      //     border: Border.all(
                      //         color: VCColors.accentGreen.withOpacity(0.25)),
                      //   ),
                      //   child: Text(
                      //     '${(record.confidence * 100).toStringAsFixed(0)}%',
                      //     style: VCTextStyles.bodySm.copyWith(
                      //         color: VCColors.accentGreen,
                      //         fontWeight: FontWeight.w600),
                      //   ),
                      // ),



                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    record.serialNumber.isNotEmpty
                        ? record.serialNumber
                        : 'Serial not detected',
                    style: VCTextStyles.bodySm.copyWith(
                      fontFamily: 'monospace',
                      color: record.serialNumber.isNotEmpty
                          ? VCColors.textPrimary
                          : VCColors.textMuted,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(_formatDate(record.scannedAt),
                      style: VCTextStyles.bodySm
                          .copyWith(color: VCColors.textMuted, fontSize: 11)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}

// ─────────────────────────────────────────────
// SCAN FRAME PAINTER  — CopWriter accent color
// ─────────────────────────────────────────────
class _VCScanFramePainter extends CustomPainter {
  final bool isAnalyzing;
  final double? scanProgress;
  final Color frameColor;

  _VCScanFramePainter({
    required this.isAnalyzing,
    this.scanProgress,
    required this.frameColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = frameColor
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    // Dim overlay outside the note area
    final overlayPaint = Paint()
      ..color = Colors.black.withOpacity(0.25)
      ..style = PaintingStyle.fill;

    const cornerLen = 28.0;
    const margin = 32.0;
    final r = Rect.fromLTRB(
        margin, margin, size.width - margin, size.height - margin);

    // Dim overlay path (outside scan rect)
    final overlayPath = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height))
      ..addRRect(
          RRect.fromRectAndRadius(r, const Radius.circular(6)))
      ..fillType = PathFillType.evenOdd;
    canvas.drawPath(overlayPath, overlayPaint);

    // Corner brackets
    // Top-left
    canvas.drawLine(Offset(r.left, r.top + cornerLen), Offset(r.left, r.top), paint);
    canvas.drawLine(Offset(r.left, r.top), Offset(r.left + cornerLen, r.top), paint);
    // Top-right
    canvas.drawLine(Offset(r.right - cornerLen, r.top), Offset(r.right, r.top), paint);
    canvas.drawLine(Offset(r.right, r.top), Offset(r.right, r.top + cornerLen), paint);
    // Bottom-left
    canvas.drawLine(Offset(r.left, r.bottom - cornerLen), Offset(r.left, r.bottom), paint);
    canvas.drawLine(Offset(r.left, r.bottom), Offset(r.left + cornerLen, r.bottom), paint);
    // Bottom-right
    canvas.drawLine(Offset(r.right - cornerLen, r.bottom), Offset(r.right, r.bottom), paint);
    canvas.drawLine(Offset(r.right, r.bottom), Offset(r.right, r.bottom - cornerLen), paint);
  }

  @override
  bool shouldRepaint(_VCScanFramePainter old) =>
      old.scanProgress != scanProgress || old.isAnalyzing != isAnalyzing;
}
