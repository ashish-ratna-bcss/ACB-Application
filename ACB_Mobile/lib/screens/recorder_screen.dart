// RecorderScreen — record OR upload, then transcribe
import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:file_picker/file_picker.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import '../models/case_details.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';

class RecorderScreen extends StatefulWidget {
  const RecorderScreen({super.key});

  @override
  State<RecorderScreen> createState() => _RecorderScreenState();
}

class _RecorderScreenState extends State<RecorderScreen> {
  final _recorder = AudioRecorder();
  bool _recording = false;
  bool _paused = false;
  bool _processing = false;
  String? _audioPath;
  String _audioSource = ''; // 'recording' | 'upload' | 'document'
  bool _isDocumentFile = false; // true when uploaded file is PDF/image
  Duration _duration = Duration.zero;
  Timer? _timer;

  // ─── Input mode: 'record' | 'upload' ─────────────────────────────────────
  String _inputMode = 'record';

  String _language = 'auto';

  String _task = 'transcribe';
  String _targetLanguage = 'en';
  bool _diarize = false;
  int _numSpeakers = 0;

  final TextEditingController _firController = TextEditingController();
  bool _firFieldError = false;

  // ─── Live transcription state ────────────────────────────────
  bool _liveMode = false;
  String _liveText = '';
  String _liveStatus = 'idle'; // 'idle' | 'fetching'
  Timer? _liveTimer;

  static const _languages = [
    {'code': 'auto', 'name': 'Auto-detect'},
    {'code': 'en', 'name': 'English'},
    {'code': 'hi', 'name': 'Hindi'},
    {'code': 'te', 'name': 'Telugu'},
    {'code': 'ta', 'name': 'Tamil'},
    {'code': 'bn', 'name': 'Bengali'},
    {'code': 'mr', 'name': 'Marathi'},
    {'code': 'gu', 'name': 'Gujarati'},
    {'code': 'kn', 'name': 'Kannada'},
    {'code': 'ml', 'name': 'Malayalam'},
    {'code': 'pa', 'name': 'Punjabi'},
    {'code': 'or', 'name': 'Odia'},
  ];

  // Target languages (no Urdu/Arabic per web app)
  static const _targetLanguages = [
    {'code': 'en', 'name': 'English'},
    {'code': 'hi', 'name': 'Hindi'},
    {'code': 'te', 'name': 'Telugu'},
    {'code': 'ta', 'name': 'Tamil'},
    {'code': 'bn', 'name': 'Bengali'},
    {'code': 'mr', 'name': 'Marathi'},
    {'code': 'gu', 'name': 'Gujarati'},
    {'code': 'kn', 'name': 'Kannada'},
    {'code': 'ml', 'name': 'Malayalam'},
    {'code': 'pa', 'name': 'Punjabi'},
    {'code': 'or', 'name': 'Odia'},
  ];

  CaseDetails? _caseRef;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final cd = context.read<CaseDetails>();
    if (!identical(_caseRef, cd)) {
      _caseRef?.removeListener(_onCaseChanged);
      cd.addListener(_onCaseChanged);
      _caseRef = cd;
      _firController.text = cd.firNumber;
    }
  }

  void _onCaseChanged() {
    if (!mounted) return;
    final firVal = _caseRef?.firNumber ?? '';
    if (_firController.text != firVal) _firController.text = firVal;
    setState(() {});
  }

  @override
  void dispose() {
    _caseRef?.removeListener(_onCaseChanged);
    _firController.dispose();
    _timer?.cancel();
    _liveTimer?.cancel();
    _recorder.dispose();
    super.dispose();
  }

  // FIR / Petition No. is now optional — recording, upload and OCR no longer
  // require it. The field stays visible so FIR extraction can still use it.
  bool get _firFilled => true;

  Future<void> _startRecording() async {
    if (!_firFilled) {
      setState(() => _firFieldError = true);
      _snack('Enter FIR / Petition No. above before recording');
      return;
    }
    final mic = await Permission.microphone.request();
    if (!mic.isGranted) {
      _snack('Microphone permission denied');
      return;
    }
    if (!await _recorder.hasPermission()) {
      _snack('Cannot access microphone');
      return;
    }
    final dir = await getTemporaryDirectory();
    final path =
        '${dir.path}/copwriter_${DateTime.now().millisecondsSinceEpoch}.m4a';
    await _recorder.start(
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        sampleRate: 16000,
        numChannels: 1,
        bitRate: 128000,
      ),
      path: path,
    );
    _duration = Duration.zero;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _duration += const Duration(seconds: 1));
    });
    setState(() {
      _recording = true;
      _paused = false;
      _audioPath = path;
      _audioSource = 'recording';
    });
    if (_liveMode) _startLiveTimer();
  }

  void _startLiveTimer() {
    _liveTimer?.cancel();
    _liveTimer = Timer.periodic(const Duration(seconds: 5), (_) => _runLive());
  }

  Future<void> _runLive() async {
    if (_audioPath == null || !_recording || _paused) return;
    setState(() => _liveStatus = 'fetching');
    try {
      final tempDir = await getTemporaryDirectory();
      final snapPath =
          '${tempDir.path}/live_snap_${DateTime.now().millisecondsSinceEpoch}.m4a';
      await File(_audioPath!).copy(snapPath);
      final snapFile = File(snapPath);
      if (await snapFile.length() < 1000) {
        await snapFile.delete();
        return;
      }
      final res = await ApiService.transcribeLive(
          audioFile: snapFile, language: _language);
      if (mounted && (res['text']?.toString().isNotEmpty ?? false)) {
        setState(() => _liveText = res['text'].toString());
      }
      await snapFile.delete();
    } catch (_) {
      // Best-effort — silent fail for live previews
    } finally {
      if (mounted) setState(() => _liveStatus = 'idle');
    }
  }

  Future<void> _pauseResume() async {
    if (_paused) {
      await _recorder.resume();
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => _duration += const Duration(seconds: 1));
      });
      if (_liveMode) _startLiveTimer();
    } else {
      await _recorder.pause();
      _timer?.cancel();
      _liveTimer?.cancel();
    }
    setState(() => _paused = !_paused);
  }

  Future<void> _stopRecording() async {
    _liveTimer?.cancel();
    _liveTimer = null;
    final path = await _recorder.stop();
    _timer?.cancel();
    setState(() {
      _recording = false;
      _paused = false;
      _audioPath = path;
      _liveStatus = 'idle';
    });
  }

  Future<void> _pickFile() async {
    if (!_firFilled) {
      setState(() => _firFieldError = true);
      _snack('Enter FIR / Petition No. above before uploading');
      return;
    }
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: [
          // audio
          'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'wma', 'opus',
          // video
          'mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v', '3gp',
        ],
        allowMultiple: false,
      );
      if (result == null || result.files.isEmpty) return;
      final path = result.files.single.path;
      if (path == null) return;

      setState(() {
        _audioPath = path;
        _audioSource = 'upload';
        _isDocumentFile = false;
        _duration = Duration.zero;
      });
      _snack('Selected: ${result.files.single.name}');
    } catch (e) {
      _snack('Could not pick file: $e');
    }
  }

  Future<void> _transcribe() async {
    if (!_firFilled) {
      setState(() => _firFieldError = true);
      _snack('Enter FIR / Petition No. above first');
      return;
    }
    if (_audioPath == null) {
      _snack('Record or upload audio first');
      return;
    }
    setState(() => _processing = true);

    final appState = context.read<AppState>();
    String? err;

    // Fast path: live mode + no diarization + transcribe-only → skip full pipeline
    if (_liveMode && !_diarize && _task == 'transcribe') {
      err = await appState.transcribeLive(
        audioFile: File(_audioPath!),
        language: _language,
      );
    } else {
      err = await appState.transcribe(
        audioFile: File(_audioPath!),
        language: _language,
        task: _task,
        targetLanguage: _targetLanguage,
        diarize: _diarize,
        numSpeakers: _numSpeakers,
        caseDetails: context.read<CaseDetails>().toJson(),
      );
    }

    if (!mounted) return;
    setState(() => _processing = false);
    if (err != null) {
      if (err.contains('SocketException') ||
          err.contains('Failed host lookup') ||
          err.contains('Connection refused')) {
        _snack(
            'Cannot reach backend. Tap the server icon (top-right) to set the URL.');
      } else {
        _snack('Transcription failed: $err');
      }
      return;
    }

    // ── Auto-extract 5W-1H FIR fields from the transcript ───────────────────
    _snack('Extracting FIR details from transcript…');
    final extracted = await appState.extractFirDetails();
    if (!mounted) return;
    if (extracted == null) {
      _snack('AI extraction unavailable — please review fields manually');
      return;
    }
    final cd = context.read<CaseDetails>();
    int filledCount = 0;
    if ((extracted['sectionOfLaw'] ?? '').isNotEmpty) {
      cd.sectionOfLaw = extracted['sectionOfLaw']!;
      filledCount++;
    }
    if ((extracted['accusedName'] ?? '').isNotEmpty) {
      cd.accusedName = extracted['accusedName']!;
      filledCount++;
    }
    if ((extracted['complainantName'] ?? '').isNotEmpty) {
      cd.complainantName = extracted['complainantName']!;
      filledCount++;
    }
    if ((extracted['incidentDate'] ?? '').isNotEmpty) {
      cd.incidentDate = extracted['incidentDate']!;
      filledCount++;
    }
    if ((extracted['location'] ?? '').isNotEmpty) {
      cd.location = extracted['location']!;
      filledCount++;
    }
    if ((extracted['description'] ?? '').isNotEmpty) {
      cd.description = extracted['description']!;
      filledCount++;
    }
    cd.touch();
    _snack(filledCount > 0
        ? 'AI auto-filled $filledCount FIR field(s) — please review'
        : 'AI could not extract FIR details — please fill manually');
  }

  void _snack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  String _fmtDuration(Duration d) {
    final m = d.inMinutes.toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final hasAudio = _audioPath != null && !_recording;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 110),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ─── Case Number ──────────────────────────────
          GlassCard(
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
            child: TextField(
              controller: _firController,
              onChanged: (val) {
                _caseRef?.firNumber = val;
                _caseRef?.touch();
                if (_firFieldError) {
                  setState(() => _firFieldError = val.trim().isEmpty);
                }
              },
              decoration: InputDecoration(
                labelText: 'Case Number',
                hintText: 'e.g. ACB-2026-001',
                prefixIcon: Icon(
                  Icons.tag,
                  color: _firFieldError ? VCColors.accentRed : VCColors.accentPrimary,
                  size: 20,
                ),
                errorText: _firFieldError ? 'Required before recording' : null,
                enabledBorder: _firFieldError
                    ? OutlineInputBorder(
                        borderSide: const BorderSide(color: VCColors.accentRed, width: 1.5),
                        borderRadius: BorderRadius.circular(8))
                    : null,
                focusedBorder: _firFieldError
                    ? OutlineInputBorder(
                        borderSide: const BorderSide(color: VCColors.accentRed, width: 2),
                        borderRadius: BorderRadius.circular(8))
                    : null,
                filled: _firFieldError,
                fillColor: _firFieldError ? VCColors.accentRed.withValues(alpha: 0.05) : null,
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ─── Recorder card ──────────────────────────────────────
          GlassCard(
            padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 18),
            child: Column(
              children: [
                // ── Mode selector: Record Audio | Upload File ──────
                Container(
                  decoration: BoxDecoration(
                    color: VCColors.sageLight.withValues(alpha: 0.5),
                    borderRadius: VCRadius.md,
                    border: Border.all(color: VCColors.sageDark),
                  ),
                  padding: const EdgeInsets.all(3),
                  child: Row(
                    children: [
                      _modeTab(
                        icon: Icons.mic,
                        label: 'Record Audio',
                        selected: _inputMode == 'record',
                        enabled: !_recording && !_paused,
                        onTap: () => setState(() {
                          _inputMode = 'record';
                          if (_isDocumentFile) {
                            _audioPath = null;
                            _audioSource = '';
                            _isDocumentFile = false;
                          }
                        }),
                      ),
                      _modeTab(
                        icon: Icons.upload_file,
                        label: 'Upload File',
                        selected: _inputMode == 'upload',
                        enabled: !_recording && !_paused,
                        onTap: () => setState(() => _inputMode = 'upload'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // ── Record mode content ────────────────────────────
                if (_inputMode == 'record') ...[
                  Text(
                    _recording
                        ? (_paused ? 'Recording Paused' : 'Recording…')
                        : (hasAudio && _audioSource == 'recording'
                            ? 'Recorded'
                            : 'Ready to Record'),
                    style: VCTextStyles.headingMd.copyWith(
                      color: _recording ? VCColors.accentRed : VCColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      _fmtDuration(_duration),
                      style: VCTextStyles.displayLarge.copyWith(
                        fontWeight: FontWeight.w700,
                        color: VCColors.accentPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  WaveformBars(
                    active: _recording && !_paused,
                    color: _recording ? VCColors.accentRed : VCColors.accentPrimary,
                  ),
                  const SizedBox(height: 18),
                  _recordControls(),
                  if (hasAudio && _audioSource == 'recording') ...[
                    const SizedBox(height: 12),
                    _audioMeta(),
                    const SizedBox(height: 14),
                    _transcribeButton(true),
                  ],
                ],

                // ── Upload mode content ────────────────────────────
                if (_inputMode == 'upload') ...[
                  if (!hasAudio) ...[
                    // Drop zone
                    GestureDetector(
                      onTap: _firFilled ? _pickFile : null,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: VCColors.accentPrimary.withValues(alpha: 0.35),
                            width: 1.5,
                            style: BorderStyle.solid,
                          ),
                          borderRadius: VCRadius.md,
                          color: VCColors.sageLight.withValues(alpha: 0.3),
                        ),
                        child: Column(
                          children: [
                            Icon(Icons.upload_file,
                                size: 42,
                                color: _firFilled
                                    ? VCColors.accentPrimary
                                    : VCColors.textMuted),
                            const SizedBox(height: 10),
                            Text(
                              _firFilled ? 'Tap to upload' : 'Enter Case Number first',
                              style: VCTextStyles.bodyMd.copyWith(
                                fontWeight: FontWeight.w600,
                                color: _firFilled
                                    ? VCColors.textPrimary
                                    : VCColors.textMuted,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Audio: MP3, WAV, M4A\nVideo: MP4, MOV, WebM',
                              style: VCTextStyles.bodySm,
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ] else ...[
                    // File selected
                    _audioMeta(),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _pickFile,
                        icon: const Icon(Icons.upload_file, size: 18),
                        label: const Text('Upload Different File'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: VCColors.accentPrimary,
                          side: BorderSide(
                              color: VCColors.accentPrimary.withValues(alpha: 0.5)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: const RoundedRectangleBorder(
                              borderRadius: VCRadius.md),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    _transcribeButton(true),
                  ],
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),

          // ─── Task ───────────────────────────────────────────────
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Task', style: VCTextStyles.label),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: VCChip(
                        label: 'Transcribe',
                        icon: Icons.text_snippet_outlined,
                        selected: _task == 'transcribe',
                        onTap: () => setState(() => _task = 'transcribe'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: VCChip(
                        label: 'Translate',
                        icon: Icons.translate,
                        selected: _task == 'translate',
                        onTap: () => setState(() => _task = 'translate'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // ─── Source Language ────────────────────────────────────
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Source Language', style: VCTextStyles.label),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: _language,
                  isExpanded: true,
                  icon: const Icon(Icons.expand_more,
                      color: VCColors.accentPrimary),
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.language,
                        color: VCColors.accentPrimary),
                  ),
                  items: _languages
                      .map((l) => DropdownMenuItem<String>(
                            value: l['code'],
                            child: Text(l['name']!,
                                style: VCTextStyles.bodyLg
                                    .copyWith(fontSize: 14)),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => _language = v ?? 'auto'),
                ),

                // Target language — shown only when Translate is selected
                if (_task == 'translate') ...[
                  const SizedBox(height: 14),
                  Text('Translate To', style: VCTextStyles.label),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: _targetLanguage,
                    isExpanded: true,
                    icon: const Icon(Icons.expand_more,
                        color: VCColors.accentPrimary),
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.translate,
                          color: VCColors.accentPrimary),
                    ),
                    items: _targetLanguages
                        .map((l) => DropdownMenuItem<String>(
                              value: l['code'],
                              child: Text(l['name']!,
                                  style: VCTextStyles.bodyLg
                                      .copyWith(fontSize: 14)),
                            ))
                        .toList(),
                    onChanged: (v) =>
                        setState(() => _targetLanguage = v ?? 'en'),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 14),

          // ─── Speaker Diarization (audio only — hidden for documents) ──
          if (!_isDocumentFile) GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _diarize,
                  activeColor: VCColors.accentPrimary,
                  onChanged: (v) => setState(() => _diarize = v),
                  title: Text('Identify Each Speaker',
                      style: VCTextStyles.bodyLg.copyWith(
                          fontWeight: FontWeight.w600, fontSize: 15)),
                  subtitle: Text(
                      'Shows who said what — turn on when multiple people are speaking',
                      style: VCTextStyles.bodySm),
                ),
                if (_diarize) ...[
                  const SizedBox(height: 6),
                  Text('How many people are speaking?',
                      style: VCTextStyles.label),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [0, 2, 3, 4, 5, 6]
                        .map((n) => VCChip(
                              label: n == 0 ? 'Auto' : '$n',
                              selected: _numSpeakers == n,
                              onTap: () =>
                                  setState(() => _numSpeakers = n),
                            ))
                        .toList(),
                  ),
                ],
                const SizedBox(height: 10),
                const Divider(height: 1),
                const SizedBox(height: 10),
                // ─── Live Transcription toggle ──────────────────────
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _liveMode,
                  activeColor: const Color(0xFFef4444),
                  onChanged: (v) => setState(() {
                    _liveMode = v;
                    if (!v) {
                      _liveText = '';
                      _liveStatus = 'idle';
                    }
                  }),
                  title: Row(
                    children: [
                      Text('Live Transcription',
                          style: VCTextStyles.bodyLg.copyWith(
                              fontWeight: FontWeight.w600,
                              fontSize: 15,
                              color: _liveMode
                                  ? const Color(0xFFef4444)
                                  : VCColors.textPrimary)),
                      if (_liveMode && _recording && !_paused) ...[
                        const SizedBox(width: 8),
                        _liveDot(),
                      ],
                    ],
                  ),
                  subtitle: Text(
                    _liveMode && !_diarize && _task == 'transcribe'
                        ? 'Fast mode active — skips re-processing after stop'
                        : 'See text appear as you speak — updates every 5 seconds',
                    style: VCTextStyles.bodySm,
                  ),
                ),
              ],
            ),
          ),  // end diarization GlassCard

          // ─── Live transcript preview (audio only) ─────────────────
          if (!_isDocumentFile && _liveMode && (_recording || _paused)) ...[
            const SizedBox(height: 10),
            Container(
              decoration: BoxDecoration(
                color: const Color(0x0Def4444),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0x33ef4444)),
              ),
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      _liveDot(size: 8),
                      const SizedBox(width: 8),
                      Text(
                        _paused ? 'PAUSED' : 'LIVE',
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFFef4444),
                          letterSpacing: 0.1,
                        ),
                      ),
                      if (_liveStatus == 'fetching') ...[
                        const SizedBox(width: 8),
                        const SizedBox(
                          width: 10,
                          height: 10,
                          child: CircularProgressIndicator(
                              strokeWidth: 1.5,
                              color: Color(0xFFef4444)),
                        ),
                      ],
                      if (_liveText.isNotEmpty) ...[
                        const Spacer(),
                        Text('Updates every 5s',
                            style: VCTextStyles.bodySm
                                .copyWith(fontSize: 10)),
                      ],
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _liveText.isNotEmpty
                        ? _liveText
                        : 'Listening… speak clearly into the microphone',
                    style: VCTextStyles.bodyLg.copyWith(
                      fontSize: 14,
                      color: _liveText.isNotEmpty
                          ? VCColors.textPrimary
                          : VCColors.textMuted,
                      fontStyle: _liveText.isNotEmpty
                          ? FontStyle.normal
                          : FontStyle.italic,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 18),
        ],
      ),
    );
  }

  Widget _modeTab({
    required IconData icon,
    required String label,
    required bool selected,
    required bool enabled,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: selected ? VCColors.ivory : Colors.transparent,
            borderRadius: VCRadius.sm,
            boxShadow: selected
                ? [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 6, offset: const Offset(0, 2))]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon,
                  size: 15,
                  color: selected ? VCColors.accentPrimary : VCColors.textMuted),
              const SizedBox(width: 5),
              Text(label,
                  style: VCTextStyles.bodySm.copyWith(
                    fontWeight: FontWeight.w700,
                    color: selected ? VCColors.accentPrimary : VCColors.textMuted,
                    fontSize: 12,
                  )),
            ],
          ),
        ),
      ),
    );
  }

  Widget _audioMeta() {
    final name = _audioPath?.split('/').last ?? '';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: VCColors.sageLight,
        borderRadius: VCRadius.md,
        border: Border.all(color: VCColors.sageDark),
      ),
      child: Row(
        children: [
          Icon(
            _audioSource == 'upload' ? Icons.audio_file : Icons.graphic_eq,
            color: VCColors.accentPrimary,
            size: 18,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              name,
              style: VCTextStyles.bodySm
                  .copyWith(color: VCColors.textPrimary, fontSize: 12),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, size: 18),
            color: VCColors.textMuted,
            onPressed: () => setState(() {
              _audioPath = null;
              _audioSource = '';
              _duration = Duration.zero;
            }),
          ),
        ],
      ),
    );
  }

  Widget _transcribeButton(bool hasAudio) {
    final enabled = hasAudio && !_processing && _firFilled;
    final r = context.watch<AppState>().result;
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: enabled ? _transcribe : null,
        icon: _processing
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white),
              )
            : const Icon(Icons.bolt, size: 22),
        label: Text(
          _processing
              ? 'Processing…'
              : (r != null
                  ? (_task == 'translate'
                      ? 'Re-translate Statement'
                      : 'Re-transcribe Statement')
                  : (_task == 'translate'
                      ? 'Transcribe & Translate'
                      : 'Transcribe Statement')),
          style: const TextStyle(fontSize: 16),
        ),
        style: ElevatedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 18),
          backgroundColor:
              enabled ? VCColors.accentPrimary : VCColors.textMuted,
          shape:
              const RoundedRectangleBorder(borderRadius: VCRadius.lg),
        ),
      ),
    );
  }

  Widget _recordControls() {
    if (!_recording) {
      return GestureDetector(
        onTap: _firFilled ? _startRecording : null,
        child: Opacity(
          opacity: _firFilled ? 1.0 : 0.45,
          child: Container(
            width: 86,
            height: 86,
            decoration: const BoxDecoration(
              gradient: VCColors.gradientRed,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                    color: Color(0x40DC2626),
                    blurRadius: 24,
                    offset: Offset(0, 8))
              ],
            ),
            child: const Icon(Icons.mic, color: Colors.white, size: 38),
          ),
        ),
      );
    }
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _circleBtn(
          icon: _paused ? Icons.play_arrow : Icons.pause,
          color: VCColors.accentAmber,
          onTap: _pauseResume,
        ),
        const SizedBox(width: 18),
        _circleBtn(
          icon: Icons.stop,
          color: VCColors.accentRed,
          big: true,
          onTap: _stopRecording,
        ),
      ],
    );
  }

  Widget _liveDot({double size = 7}) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: _recording && !_paused
              ? const Color(0xFFef4444)
              : const Color(0xFFfca5a5),
          shape: BoxShape.circle,
          boxShadow: _recording && !_paused
              ? [
                  const BoxShadow(
                      color: Color(0x50ef4444), blurRadius: 6, spreadRadius: 1)
                ]
              : null,
        ),
      );

  Widget _circleBtn({
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
    bool big = false,
  }) {
    final size = big ? 76.0 : 58.0;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: color,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
                color: color.withValues(alpha: 0.4),
                blurRadius: 16,
                offset: const Offset(0, 6))
          ],
        ),
        child: Icon(icon, color: Colors.white, size: big ? 34 : 26),
      ),
    );
  }
}
