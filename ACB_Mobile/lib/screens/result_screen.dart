// ResultScreen — transcription / translation with diarization + speaker editing.
// Mirrors the web speech page: full text, speaker-separated segments with
// rename + reassign, Translate, and Download (JSON / TXT). No PDF/share/FIR.
import 'dart:io';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import '../models/case_details.dart';
import '../providers/app_state.dart';

// Speaker badge colours — mirrors the web app.
const _speakerColors = [
  Color(0xFF2563EB),
  Color(0xFF9333EA),
  Color(0xFF059669),
  Color(0xFFEA580C),
  Color(0xFF0891B2),
  Color(0xFFBE123C),
];

String _fmtTime(dynamic value) {
  final v = (value is num) ? value.toDouble() : double.tryParse('$value') ?? 0;
  final m = (v ~/ 60).toString().padLeft(2, '0');
  final s = (v % 60).floor().toString().padLeft(2, '0');
  return '$m:$s';
}

class ResultScreen extends StatefulWidget {
  const ResultScreen({super.key});

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen> {
  final _player = AudioPlayer();
  bool _playing = false;
  bool _editMode = false;
  bool _translating = false;
  String _translateTarget = 'en';

  // Editable working copy of the diarized segments, rebuilt whenever a new
  // result arrives. Each segment carries a stable `speakerKey` (the original
  // pyannote label) plus editable `text`. Speaker display names live in
  // `_renameMap` keyed by that stable key, so renaming never disturbs the
  // text fields or chip identities.
  TranscriptionResult? _syncedResult;
  List<Map<String, dynamic>> _workSegments = [];
  List<String> _speakerKeys = [];
  final Map<String, String> _renameMap = {};

  static const _tgtLangs = [
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

  @override
  void initState() {
    super.initState();
    _player.onPlayerStateChanged.listen((s) {
      if (mounted) setState(() => _playing = s == PlayerState.playing);
    });
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  String? get _audioPath => context.read<AppState>().audioPath;

  // ── Derived data ───────────────────────────────────────────────────────────

  String _originalText(TranscriptionResult r) {
    if (r.task != 'translate') return '';
    final segs = r.originalSegments;
    if (segs != null && segs.isNotEmpty) {
      return segs
          .whereType<Map>()
          .map((s) => s['text']?.toString() ?? '')
          .join(' ')
          .trim();
    }
    return r.originalText;
  }

  bool get _hasSpeakers =>
      (_syncedResult?.diarization == true) && _workSegments.isNotEmpty;

  /// Rebuilds the editable segments from the result the first time we see it.
  /// Speakers are re-numbered sequentially by order of first appearance
  /// ("Speaker 1", "Speaker 2", …) so the list is always gap-free.
  void _syncIfNeeded(TranscriptionResult r) {
    if (identical(r, _syncedResult)) return;
    _syncedResult = r;
    _editMode = false;
    final rawToKey = <String, String>{};
    _workSegments = r.segments.whereType<Map>().map((s) {
      final raw = s['speaker']?.toString() ?? '';
      final key =
          rawToKey.putIfAbsent(raw, () => 'Speaker ${rawToKey.length + 1}');
      return <String, dynamic>{
        'speakerKey': key,
        'start': s['start'],
        'end': s['end'],
        'text': s['text']?.toString() ?? '',
        if (s['original_text'] != null)
          'original_text': s['original_text'].toString(),
      };
    }).toList();
    _speakerKeys = rawToKey.values.toList();
    _renameMap
      ..clear()
      ..addEntries(_speakerKeys.map((k) => MapEntry(k, k)));
  }

  /// Current display name for a stable speaker key (rename-aware).
  String _name(String key) {
    final v = _renameMap[key]?.trim();
    return (v == null || v.isEmpty) ? key : v;
  }

  Color _colorForKey(String key) {
    final i = _speakerKeys.indexOf(key);
    return _speakerColors[(i < 0 ? 0 : i) % _speakerColors.length];
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  Future<void> _toggleAudio() async {
    if (_audioPath == null) return;
    if (_playing) {
      await _player.pause();
    } else {
      await _player.play(DeviceFileSource(_audioPath!));
    }
  }

  // Rename a speaker (by stable key). Display names live in _renameMap so the
  // text field's own state is never disturbed; we just refresh the chips/badges.
  void _renameSpeaker(String key, String newName) {
    setState(() => _renameMap[key] = newName);
  }

  void _reassignSegment(int segIndex, String key) {
    if (_workSegments[segIndex]['speakerKey'] == key) return;
    setState(() => _workSegments[segIndex]['speakerKey'] = key);
  }

  void _editSegmentText(int segIndex, String text) {
    _workSegments[segIndex]['text'] = text; // no rebuild needed while typing
  }

  Future<void> _doTranslate() async {
    final appState = context.read<AppState>();
    final r = appState.result;
    if (r == null) return;
    final audio = appState.audioPath;

    // Preferred path — re-process the source audio as Translate so speaker
    // diarization is preserved in the translation (mirrors the web app, where
    // translate + diarize run together). Only possible if the audio is local.
    if (audio != null && File(audio).existsSync()) {
      setState(() => _translating = true);
      final err = await appState.transcribe(
        audioFile: File(audio),
        language: r.language.isEmpty ? 'auto' : r.language,
        task: 'translate',
        targetLanguage: _translateTarget,
        diarize: r.diarization,
        numSpeakers: r.speakerCount,
      );
      if (mounted) {
        setState(() => _translating = false);
        if (err != null) {
          ScaffoldMessenger.of(context)
              .showSnackBar(SnackBar(content: Text('Translation failed: $err')));
        }
      }
      return;
    }

    // Fallback — no audio available (text-only translation, loses diarization).
    if (r.language.isEmpty || r.language == 'auto') {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text(
            'Source language not detected. Re-process audio as Translate from the Record tab.'),
        duration: Duration(seconds: 4),
      ));
      return;
    }
    setState(() => _translating = true);
    final err = await appState.translateText(targetLanguage: _translateTarget);
    if (mounted) {
      setState(() => _translating = false);
      if (err != null) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Translation failed: $err')));
      }
    }
  }

  Future<void> _downloadJson() async {
    final r = _syncedResult;
    if (r == null) return;
    final List<dynamic> data = _hasSpeakers
        ? _workSegments
            .map((s) => {
                  'speaker': _name(s['speakerKey'] as String),
                  'start': s['start'],
                  'end': s['end'],
                  'text': s['text'],
                  if (s['original_text'] != null)
                    'original_text': s['original_text'],
                })
            .toList()
        : [
            {'text': r.text}
          ];
    final jsonStr = const JsonEncoder.withIndent('  ').convert(data);
    await _saveFile(jsonStr, 'transcript', 'json');
  }

  Future<void> _downloadTxt() async {
    final r = _syncedResult;
    if (r == null) return;
    final String txt = _hasSpeakers
        ? _workSegments
            .map((s) => '${_name(s['speakerKey'] as String)}: ${s['text']}')
            .join('\n\n')
        : r.text;
    await _saveFile(txt, 'transcript', 'txt');
  }

  Future<void> _saveFile(String content, String base, String ext) async {
    try {
      final ts = DateTime.now().millisecondsSinceEpoch;
      final fileName = '${base}_$ts.$ext';
      final bytes = utf8.encode(content); // UTF-8 preserves Telugu/Hindi etc.
      late String savedPath;
      if (Platform.isAndroid) {
        await Permission.storage.request();
        final dl = Directory('/storage/emulated/0/Download');
        if (await dl.exists()) {
          await File('${dl.path}/$fileName').writeAsBytes(bytes);
          savedPath = 'Downloads/$fileName';
        } else {
          final dir = await getExternalStorageDirectory() ??
              await getApplicationDocumentsDirectory();
          final file = File('${dir.path}/$fileName');
          await file.writeAsBytes(bytes);
          savedPath = file.path;
        }
      } else {
        final dir = await getApplicationDocumentsDirectory();
        final file = File('${dir.path}/$fileName');
        await file.writeAsBytes(bytes);
        savedPath = file.path;
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Saved: $savedPath'),
          duration: const Duration(seconds: 4),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Save failed: $e')));
      }
    }
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final r = context.watch<AppState>().result;
    if (r == null) return _empty();
    _syncIfNeeded(r);

    final isTranslate = r.task == 'translate';
    final originalText = _originalText(r);

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 8, 14, 96),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ─── Meta strip ────────────────────────────────────────
          GlassCard(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
            child: Row(
              children: [
                Flexible(child: _metaChip(Icons.translate, r.languageName)),
                const SizedBox(width: 8),
                _metaChip(Icons.timer_outlined,
                    '${r.processingTime.toStringAsFixed(1)}s'),
                if (r.diarization) ...[
                  const SizedBox(width: 8),
                  _metaChip(Icons.groups_outlined, '${r.speakerCount} spk'),
                ],
                const Spacer(),
                if (_audioPath != null)
                  IconButton(
                    onPressed: _toggleAudio,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    icon: Icon(_playing ? Icons.pause_circle : Icons.play_circle,
                        size: 30, color: VCColors.accentPrimary),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // ─── Translate row (always available) ──────────────────
          Row(
            children: [
              Expanded(
                flex: 3,
                child: DropdownButtonFormField<String>(
                  value: _translateTarget,
                  isExpanded: true,
                  icon: const Icon(Icons.expand_more,
                      size: 16, color: VCColors.accentPrimary),
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.translate,
                        size: 16, color: VCColors.accentPrimary),
                    contentPadding:
                        EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                  ),
                  items: _tgtLangs
                      .map((l) => DropdownMenuItem<String>(
                            value: l['code'],
                            child: Text(l['name']!,
                                style:
                                    VCTextStyles.bodyLg.copyWith(fontSize: 12)),
                          ))
                      .toList(),
                  onChanged: _translating
                      ? null
                      : (v) => setState(() => _translateTarget = v ?? 'en'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 2,
                child: ElevatedButton.icon(
                  onPressed: _translating ? null : _doTranslate,
                  icon: _translating
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.translate, size: 16),
                  label: Text(_translating ? '…' : 'Translate'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    backgroundColor: VCColors.accentPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // ─── Download + Edit row ───────────────────────────────
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _downloadJson,
                  icon: const Icon(Icons.download_outlined, size: 16),
                  label: const Text('JSON', style: TextStyle(fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: VCColors.accentPrimary,
                    side: const BorderSide(color: VCColors.accentPrimary),
                    padding: const EdgeInsets.symmetric(vertical: 11),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _downloadTxt,
                  icon: const Icon(Icons.description_outlined, size: 16),
                  label: const Text('TXT', style: TextStyle(fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: VCColors.accentPrimary,
                    side: const BorderSide(color: VCColors.accentPrimary),
                    padding: const EdgeInsets.symmetric(vertical: 11),
                  ),
                ),
              ),
              if (_hasSpeakers) ...[
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => setState(() => _editMode = !_editMode),
                    icon: Icon(_editMode ? Icons.check : Icons.edit_outlined,
                        size: 16),
                    label: Text(_editMode ? 'Done' : 'Edit',
                        style: const TextStyle(fontSize: 13)),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 11),
                      backgroundColor:
                          _editMode ? VCColors.sageDark : const Color(0xFF334155),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),

          // ─── Results body (uses all remaining space, no box) ───
          Expanded(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (isTranslate && originalText.isNotEmpty) ...[
                    _textBox('Original Transcript', originalText, muted: true),
                    const SizedBox(height: 12),
                  ],
                  _textBox(
                      isTranslate ? 'Translated Text' : 'Transcript', r.text),
                  if (_hasSpeakers) ...[
                    const SizedBox(height: 16),
                    if (_editMode) _renamePanel(),
                    ..._buildSegments(),
                  ],
                  const SizedBox(height: 8),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Pieces ─────────────────────────────────────────────────────────────────

  Widget _textBox(String title, String text, {bool muted = false}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: muted ? VCColors.sageLight.withValues(alpha: 0.4) : Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: VCColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title.toUpperCase(),
              style: VCTextStyles.bodySm.copyWith(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: VCColors.textSecondary,
                letterSpacing: 0.5,
              )),
          const SizedBox(height: 6),
          SelectableText(
            text.isEmpty ? '—' : text,
            style: VCTextStyles.bodyLg.copyWith(
              fontSize: 15,
              height: 1.5,
              color: muted ? VCColors.textSecondary : VCColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _renamePanel() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: VCColors.sageLight.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: VCColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('RENAME SPEAKERS',
              style: VCTextStyles.bodySm.copyWith(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: VCColors.textSecondary,
                letterSpacing: 0.5,
              )),
          const SizedBox(height: 10),
          ..._speakerKeys.map((key) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: _colorForKey(key),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(key,
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(width: 8),
                  const Icon(Icons.arrow_forward,
                      size: 14, color: VCColors.textMuted),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextFormField(
                      key: ValueKey('rename_$key'),
                      initialValue: _renameMap[key],
                      style: VCTextStyles.bodyLg.copyWith(fontSize: 14),
                      decoration: const InputDecoration(
                        isDense: true,
                        contentPadding:
                            EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        border: OutlineInputBorder(),
                        hintText: 'New name',
                      ),
                      onChanged: (v) => _renameSpeaker(key, v),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  List<Widget> _buildSegments() {
    return List.generate(_workSegments.length, (index) {
      final seg = _workSegments[index];
      final key = seg['speakerKey'] as String;
      final original = seg['original_text']?.toString();
      return Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: VCColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 6,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                // Edit mode: all speakers as tappable chips to reassign.
                // View mode: just the active speaker badge.
                if (_editMode)
                  ..._speakerKeys.map((k) {
                    final active = k == key;
                    return GestureDetector(
                      onTap: () => _reassignSegment(index, k),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: active ? _colorForKey(k) : Colors.white,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(
                            color: active ? _colorForKey(k) : VCColors.border,
                          ),
                        ),
                        child: Text(_name(k),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color:
                                  active ? Colors.white : VCColors.textMuted,
                            )),
                      ),
                    );
                  })
                else
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _colorForKey(key),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(_name(key),
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700)),
                  ),
                Text('${_fmtTime(seg['start'])} – ${_fmtTime(seg['end'])}',
                    style: VCTextStyles.bodySm
                        .copyWith(fontSize: 11, color: VCColors.textMuted)),
              ],
            ),
            const SizedBox(height: 8),
            if (original != null && original.isNotEmpty) ...[
              SelectableText(original,
                  style: VCTextStyles.bodyLg.copyWith(
                      fontSize: 13,
                      color: VCColors.textSecondary,
                      fontStyle: FontStyle.italic)),
              const SizedBox(height: 4),
            ],
            // Edit mode: editable text field. View mode: selectable text.
            if (_editMode)
              TextFormField(
                key: ValueKey('segtext_${_syncedResult.hashCode}_$index'),
                initialValue: seg['text']?.toString() ?? '',
                maxLines: null,
                style: VCTextStyles.bodyLg.copyWith(fontSize: 15, height: 1.45),
                decoration: const InputDecoration(
                  isDense: true,
                  contentPadding: EdgeInsets.all(8),
                  border: OutlineInputBorder(),
                ),
                onChanged: (v) => _editSegmentText(index, v),
              )
            else
              SelectableText(seg['text']?.toString() ?? '',
                  style:
                      VCTextStyles.bodyLg.copyWith(fontSize: 15, height: 1.45)),
          ],
        ),
      );
    });
  }

  Widget _metaChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: VCColors.sageLight,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: VCColors.accentPrimary),
          const SizedBox(width: 4),
          Flexible(
            child: Text(label,
                overflow: TextOverflow.ellipsis,
                style: VCTextStyles.bodySm.copyWith(
                    fontWeight: FontWeight.w600, color: VCColors.textPrimary)),
          ),
        ],
      ),
    );
  }

  Widget _empty() {
    return Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 120,
            height: 120,
            decoration: const BoxDecoration(
              color: VCColors.sageLight,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.article_outlined,
                size: 56, color: VCColors.accentPrimary),
          ),
          const SizedBox(height: 18),
          Text('No transcription yet', style: VCTextStyles.headingMd),
          const SizedBox(height: 6),
          Text(
            'Go to the Record tab, capture your statement, and tap Transcribe.',
            textAlign: TextAlign.center,
            style: VCTextStyles.bodyMd,
          ),
        ],
      ),
    );
  }
}
