// RecordsScreen — browse, view, edit, and delete MongoDB server records.
// Mirrors the web app's "Server Records" tab functionality.
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import '../services/api_service.dart';

// ─── Speaker colours (matches web + ResultScreen) ─────────────────────────────
const _speakerColors = [
  Color(0xFF4a6741),
  Color(0xFF0369a1),
  Color(0xFF9333ea),
  Color(0xFFc2410c),
  Color(0xFF0891b2),
  Color(0xFFbe123c),
];

Color _spkColor(String? spk) {
  if (spk == null) return _speakerColors[0];
  final n = int.tryParse(spk.replaceAll(RegExp(r'\D'), '')) ?? 0;
  return _speakerColors[n % _speakerColors.length];
}

String _formatSpeaker(String? spk) {
  if (spk == null || spk.isEmpty) return 'SPK';
  final n = int.tryParse(spk.replaceAll(RegExp(r'\D'), ''));
  if (n != null) return 'SPK ${n + 1}';
  return spk.length > 6 ? spk.substring(0, 6).toUpperCase() : spk.toUpperCase();
}

// ─── Case-detail field config (mirrors CaseDetailsForm) ───────────────────────
const _caseFields = [
  {'key': 'firNumber', 'label': 'FIR / Case No.', 'icon': Icons.tag},
  {
    'key': 'incidentDate',
    'label': 'Incident Date',
    'icon': Icons.calendar_today,
    'date': true
  },
  {'key': 'accusedName', 'label': 'Accused Name', 'icon': Icons.person_outline},
  {'key': 'complainantName', 'label': 'Complainant', 'icon': Icons.person_pin},
  {
    'key': 'officerName',
    'label': 'Officer Name',
    'icon': Icons.shield_outlined
  },
  {'key': 'badgeNumber', 'label': 'Badge No.', 'icon': Icons.badge_outlined},
  {'key': 'stationName', 'label': 'Station', 'icon': Icons.location_city},
  {'key': 'location', 'label': 'Location', 'icon': Icons.place_outlined},
  {
    'key': 'sectionOfLaw',
    'label': 'Section of Law',
    'icon': Icons.gavel,
    'full': true
  },
  {
    'key': 'description',
    'label': 'Description',
    'icon': Icons.notes,
    'full': true,
    'multiline': true
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Top-level so it is accessible from both _RecordCard and _RecordDetailScreen.
Map<String, dynamic> _parseCd(dynamic cd) {
  if (cd is Map) return Map<String, dynamic>.from(cd);
  if (cd is String && cd.isNotEmpty) {
    try {
      final decoded = json.decode(cd);
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
    } catch (_) {}
  }
  return {};
}

String _fmtDate(dynamic iso) {
  if (iso == null || iso.toString().isEmpty) return '—';
  try {
    final dt = DateTime.parse(iso.toString());
    final months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    final h = dt.toLocal().hour;
    final m = dt.toLocal().minute.toString().padLeft(2, '0');
    final ap = h >= 12 ? 'PM' : 'AM';
    final h12 = (h % 12 == 0 ? 12 : h % 12).toString().padLeft(2, '0');
    return '${dt.day.toString().padLeft(2, '0')} ${months[dt.month - 1]} ${dt.year}, $h12:$m $ap';
  } catch (_) {
    return iso.toString();
  }
}

// ─── RecordsScreen ────────────────────────────────────────────────────────────
class RecordsScreen extends StatefulWidget {
  const RecordsScreen({super.key});

  @override
  State<RecordsScreen> createState() => _RecordsScreenState();
}

class _RecordsScreenState extends State<RecordsScreen> {
  List<Map<String, dynamic>> _records = [];
  int _total = 0;
  bool _loading = true;
  bool _mongoAvailable = true;
  String _error = '';
  final _searchCtl = TextEditingController();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void dispose() {
    _searchCtl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _fetch([String search = '']) async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final data = await ApiService.getTranscriptions(search: search);
      setState(() {
        _records = (data['transcriptions'] as List? ?? [])
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
        _total = (data['total'] as int?) ?? _records.length;
        _mongoAvailable = data['mongodb'] != false;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  void _onSearch(String q) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () => _fetch(q));
  }

  void _onDeleted(String id) {
    setState(() {
      _records.removeWhere((r) => r['_id'] == id);
      _total = (_total - 1).clamp(0, _total);
    });
  }

  void _onUpdated(Map<String, dynamic> updated) {
    final idx = _records.indexWhere((r) => r['_id'] == updated['_id']);
    if (idx >= 0) setState(() => _records[idx] = updated);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // ─── Top bar ──────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Row(
            children: [
              const Icon(Icons.storage_outlined,
                  size: 18, color: VCColors.accentPrimary),
              const SizedBox(width: 8),
              Text('Case Archive',
                  style: VCTextStyles.headingMd.copyWith(fontSize: 16)),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: VCColors.sageLight,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: VCColors.sageDark),
                ),
                child: Text('$_total',
                    style: VCTextStyles.bodySm.copyWith(
                        fontWeight: FontWeight.w700,
                        color: VCColors.accentPrimary)),
              ),
              if (!_mongoAvailable) ...[
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0x14DC2626),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: const Color(0x33DC2626)),
                  ),
                  child: Text('MongoDB offline',
                      style: VCTextStyles.bodySm.copyWith(
                          color: const Color(0xFFDC2626),
                          fontWeight: FontWeight.w600)),
                ),
              ],
              const Spacer(),
              IconButton(
                onPressed: _loading ? null : () => _fetch(_searchCtl.text),
                icon: _loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: VCColors.accentPrimary))
                    : const Icon(Icons.refresh_outlined,
                        color: VCColors.accentPrimary),
                tooltip: 'Refresh',
              ),
            ],
          ),
        ),

        // ─── Search ───────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
          child: TextField(
            controller: _searchCtl,
            onChanged: _onSearch,
            decoration: InputDecoration(
              hintText: 'Search FIR, accused, transcript…',
              prefixIcon:
                  const Icon(Icons.search, size: 20, color: VCColors.textMuted),
              suffixIcon: _searchCtl.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18),
                      color: VCColors.textMuted,
                      onPressed: () {
                        _searchCtl.clear();
                        _fetch();
                      })
                  : null,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            ),
          ),
        ),

        // ─── Body ─────────────────────────────────────────────────
        Expanded(
          child: _buildBody(),
        ),
      ],
    );
  }

  Widget _buildBody() {
    if (_loading && _records.isEmpty) {
      return const Center(
          child: CircularProgressIndicator(color: VCColors.accentPrimary));
    }
    if (_error.isNotEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_outlined,
                  size: 56, color: VCColors.textMuted),
              const SizedBox(height: 12),
              Text(_error,
                  textAlign: TextAlign.center,
                  style:
                      VCTextStyles.bodyMd.copyWith(color: VCColors.accentRed)),
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: () => _fetch(_searchCtl.text),
                icon: const Icon(Icons.refresh, size: 18),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }
    if (_records.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.storage_outlined,
                  size: 56, color: VCColors.textMuted),
              const SizedBox(height: 12),
              Text(
                _searchCtl.text.isNotEmpty
                    ? 'No records match "${_searchCtl.text}"'
                    : 'No records saved yet.\nTranscribe audio to create the first record.',
                textAlign: TextAlign.center,
                style: VCTextStyles.bodyMd,
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      color: VCColors.accentPrimary,
      onRefresh: () => _fetch(_searchCtl.text),
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
        itemCount: _records.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (ctx, i) => _RecordCard(
          record: _records[i],
          onDeleted: _onDeleted,
          onUpdated: _onUpdated,
        ),
      ),
    );
  }
}

// ─── Record Card ──────────────────────────────────────────────────────────────
class _RecordCard extends StatelessWidget {
  final Map<String, dynamic> record;
  final void Function(String id) onDeleted;
  final void Function(Map<String, dynamic> updated) onUpdated;

  const _RecordCard({
    required this.record,
    required this.onDeleted,
    required this.onUpdated,
  });

  Map<String, dynamic> get _cd => _parseCd(record['case_details']);

  @override
  Widget build(BuildContext context) {
    final firNumber = _cd['firNumber']?.toString().trim().isNotEmpty == true
        ? _cd['firNumber'].toString()
        : record['filename']?.toString() ??
            record['_id'].toString().substring(0, 8);
    final isTranslate = record['task'] == 'translate';
    final hasDia = record['diarization'] == true;
    final transcript = record['transcript']?.toString() ?? '';

    return GlassCard(
      padding: EdgeInsets.zero,
      onTap: () => _openDetail(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 10, 8),
            child: Row(
              children: [
                const Icon(Icons.description_outlined,
                    size: 14, color: VCColors.accentSecondary),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(firNumber,
                      style: VCTextStyles.bodySm.copyWith(
                          fontWeight: FontWeight.w700,
                          color: VCColors.accentSecondary,
                          letterSpacing: 0.5),
                      overflow: TextOverflow.ellipsis),
                ),
                const SizedBox(width: 6),
                // Language badge for ALL records
                if ((record['language_name'] ?? record['language'])
                        ?.toString()
                        .isNotEmpty ==
                    true)
                  _badge(
                    isTranslate
                        ? '${record['language_name'] ?? record['language']} → ${record['target_language_name'] ?? 'EN'}'
                        : (record['language_name'] ?? record['language'])
                            .toString(),
                    const Color(0xFF0369a1),
                    const Color(0x1A0369A1),
                  ),
                if (hasDia)
                  Padding(
                    padding: const EdgeInsets.only(left: 4),
                    child: _badge('${record['speaker_count'] ?? '?'} SPK',
                        const Color(0xFF7c3aed), const Color(0x157C3AED)),
                  ),
                if (record['source_type'] == 'document' || record['document_path'] != null)
                  Padding(
                    padding: const EdgeInsets.only(left: 4),
                    child: _badge('DOC', const Color(0xFFb45309), const Color(0x1Ab45309)),
                  ),
                const SizedBox(width: 6),
                // Edit button
                InkWell(
                  borderRadius: BorderRadius.circular(6),
                  onTap: () => _openDetail(context),
                  child: const Padding(
                    padding: EdgeInsets.all(6),
                    child: Icon(Icons.open_in_new_outlined,
                        size: 16, color: VCColors.textMuted),
                  ),
                ),
              ],
            ),
          ),

          // Summary chips
          if (_cd['accusedName']?.toString().isNotEmpty == true ||
              _cd['officerName']?.toString().isNotEmpty == true ||
              _cd['stationName']?.toString().isNotEmpty == true)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
              child: Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  if (_cd['accusedName']?.toString().isNotEmpty == true)
                    _summaryChip('Accused: ${_cd['accusedName']}'),
                  if (_cd['officerName']?.toString().isNotEmpty == true)
                    _summaryChip('Officer: ${_cd['officerName']}'),
                  if (_cd['stationName']?.toString().isNotEmpty == true)
                    _summaryChip(_cd['stationName'].toString()),
                ],
              ),
            ),

          // Transcript preview
          if (transcript.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 8),
              child: Text(
                transcript.length > 120
                    ? '${transcript.substring(0, 120)}…'
                    : transcript,
                style: VCTextStyles.bodySm
                    .copyWith(fontStyle: FontStyle.italic, fontSize: 12),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),

          // Date footer
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
            child: Text(_fmtDate(record['created_at']),
                style: VCTextStyles.bodySm
                    .copyWith(fontSize: 11, color: VCColors.textMuted)),
          ),
        ],
      ),
    );
  }

  Widget _badge(String label, Color fg, Color bg) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: fg.withValues(alpha: 0.3))),
        child: Text(label,
            style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w700,
                color: fg,
                letterSpacing: 0.5)),
      );

  Widget _summaryChip(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(
          color: VCColors.sageLight,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: VCColors.sageDark),
        ),
        child: Text(text,
            style: VCTextStyles.bodySm
                .copyWith(fontSize: 10, color: VCColors.textSecondary)),
      );

  void _openDetail(BuildContext context) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => _RecordDetailScreen(
        record: record,
        onDeleted: onDeleted,
        onUpdated: onUpdated,
      ),
    ));
  }
}

// ─── Record Detail Screen ─────────────────────────────────────────────────────
class _RecordDetailScreen extends StatefulWidget {
  final Map<String, dynamic> record;
  final void Function(String id) onDeleted;
  final void Function(Map<String, dynamic> updated) onUpdated;

  const _RecordDetailScreen({
    required this.record,
    required this.onDeleted,
    required this.onUpdated,
  });

  @override
  State<_RecordDetailScreen> createState() => _RecordDetailScreenState();
}

class _RecordDetailScreenState extends State<_RecordDetailScreen> {
  late Map<String, dynamic> _record;
  bool _editing = false;
  bool _saving = false;
  bool _deleting = false;
  bool _confirmDelete = false;
  bool _pdfGenerating = false;
  String _saveError = '';
  late Map<String, TextEditingController> _ctls;

  @override
  void initState() {
    super.initState();
    _record = Map<String, dynamic>.from(widget.record);
    _initControllers();
  }

  void _initControllers() {
    final cd = _parseCd(_record['case_details']);
    _ctls = {
      for (final f in _caseFields)
        (f['key'] as String):
            TextEditingController(text: cd[f['key']]?.toString() ?? ''),
    };
  }

  @override
  void dispose() {
    for (final c in _ctls.values) {
      c.dispose();
    }
    super.dispose();
  }

  Map<String, dynamic> get _cd => _parseCd(_record['case_details']);

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _saveError = '';
    });
    final updatedCd = {
      for (final f in _caseFields)
        (f['key'] as String): _ctls[f['key']]!.text.trim(),
    };
    try {
      await ApiService.updateTranscription(
          _record['_id'].toString(), {'case_details': updatedCd});
      setState(() {
        _record = {..._record, 'case_details': updatedCd};
        _editing = false;
        _saving = false;
      });
      widget.onUpdated(_record);
    } catch (e) {
      setState(() {
        _saveError = e.toString().replaceFirst('Exception: ', '');
        _saving = false;
      });
    }
  }

  Future<void> _delete() async {
    if (!_confirmDelete) {
      setState(() => _confirmDelete = true);
      Future.delayed(const Duration(seconds: 4), () {
        if (mounted) setState(() => _confirmDelete = false);
      });
      return;
    }
    setState(() => _deleting = true);
    try {
      await ApiService.deleteTranscription(_record['_id'].toString());
      widget.onDeleted(_record['_id'].toString());
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _deleting = false;
        _confirmDelete = false;
      });
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  List<Map<String, dynamic>> get _segments =>
      (_record['segments'] as List? ?? [])
          .whereType<Map>()
          .map((s) => Map<String, dynamic>.from(s))
          .toList();

  bool get _hasDiarization {
    if (_record['diarization'] != true) return false;
    final speakers = _segments
        .map((s) => s['speaker']?.toString())
        .whereType<String>()
        .toSet();
    return speakers.length >= 2;
  }

  @override
  Widget build(BuildContext context) {
    final isTranslate = _record['task'] == 'translate';
    final firNumber = _cd['firNumber']?.toString().trim().isNotEmpty == true
        ? _cd['firNumber'].toString()
        : _record['_id'].toString().substring(0, 8);

    return AppBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          title: Row(
            children: [
              const Icon(Icons.description_outlined,
                  size: 16, color: VCColors.accentSecondary),
              const SizedBox(width: 8),
              Expanded(
                child: Text(firNumber,
                    style: VCTextStyles.bodySm.copyWith(
                        fontWeight: FontWeight.w700,
                        color: VCColors.accentSecondary,
                        letterSpacing: 0.5,
                        fontSize: 14),
                    overflow: TextOverflow.ellipsis),
              ),
            ],
          ),
          actions: [
            if (!_editing)
              TextButton.icon(
                onPressed: () => setState(() {
                  _editing = true;
                  _saveError = '';
                  // Re-init controllers from current record
                  final cd = _parseCd(_record['case_details']);
                  for (final f in _caseFields) {
                    _ctls[f['key'] as String]!.text =
                        cd[f['key']]?.toString() ?? '';
                  }
                }),
                icon: const Icon(Icons.edit_outlined, size: 16),
                label: const Text('Edit'),
                style: TextButton.styleFrom(
                    foregroundColor: VCColors.accentPrimary),
              ),
            // Delete button
            _confirmDelete
                ? TextButton.icon(
                    onPressed: _deleting ? null : _delete,
                    icon: _deleting
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: VCColors.accentRed))
                        : const Icon(Icons.warning_amber, size: 16),
                    label: const Text('Confirm?'),
                    style: TextButton.styleFrom(
                        foregroundColor: VCColors.accentRed),
                  )
                : IconButton(
                    onPressed: _delete,
                    icon: const Icon(Icons.delete_outline,
                        color: VCColors.accentRed),
                    tooltip: 'Delete record',
                  ),
          ],
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ─── Meta chips ──────────────────────────────────────
              GlassCard(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    if ((_record['language_name'] ?? '').toString().isNotEmpty)
                      _infoChip(
                          Icons.language, _record['language_name'].toString()),
                    _infoChip(
                        isTranslate
                            ? Icons.translate
                            : Icons.text_snippet_outlined,
                        isTranslate ? 'Translation' : 'Transcription'),
                    if (_record['processing_time'] != null)
                      _infoChip(Icons.timer_outlined,
                          '${_record['processing_time']}s'),
                    if (_record['diarization'] == true)
                      _infoChip(Icons.groups_outlined,
                          '${_record['speaker_count'] ?? '?'} speakers'),
                    _infoChip(Icons.access_time_outlined,
                        _fmtDate(_record['created_at'])),
                    if (_record['audio_path'] != null && _record['document_path'] == null)
                      _infoChip(Icons.folder_outlined,
                          _record['audio_path'].toString().split('/').last),
                    if (_record['document_path'] != null)
                      _infoChip(Icons.picture_as_pdf_outlined,
                          _record['filename']?.toString().isNotEmpty == true
                              ? _record['filename'].toString()
                              : _record['document_path'].toString().split('/').last),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // ─── Case Details ─────────────────────────────────────
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.description,
                            size: 16, color: VCColors.accentPrimary),
                        const SizedBox(width: 8),
                        Text('Case Details',
                            style: VCTextStyles.label.copyWith(
                                fontWeight: FontWeight.w700,
                                color: VCColors.accentPrimary,
                                letterSpacing: 0.5,
                                fontSize: 12)),
                        const Spacer(),
                        if (_editing) ...[
                          TextButton(
                            onPressed: _saving
                                ? null
                                : () => setState(() {
                                      _editing = false;
                                      _saveError = '';
                                    }),
                            style: TextButton.styleFrom(
                                foregroundColor: VCColors.accentRed,
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 10)),
                            child: const Text('Cancel'),
                          ),
                          const SizedBox(width: 4),
                          ElevatedButton.icon(
                            onPressed: _saving ? null : _save,
                            icon: _saving
                                ? const SizedBox(
                                    width: 14,
                                    height: 14,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2, color: Colors.white))
                                : const Icon(Icons.check, size: 14),
                            label: Text(_saving ? 'Saving…' : 'Save'),
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 8),
                              textStyle: const TextStyle(fontSize: 12),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (_saveError.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Text(_saveError,
                          style: VCTextStyles.bodySm
                              .copyWith(color: VCColors.accentRed)),
                    ],
                    const SizedBox(height: 12),
                    _editing ? _editForm() : _viewDetails(),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // ─── Document viewer (for petition OCR records) ───────
              if (_record['document_path'] != null) ...[
                GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.picture_as_pdf_outlined,
                              size: 16, color: Color(0xFFb45309)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Petition Document',
                              style: VCTextStyles.label.copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFFb45309),
                                  fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      _buildDocumentPreview(_record),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
              ],

              // ─── Transcript ───────────────────────────────────────
              GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.chat_bubble_outline,
                            size: 16, color: VCColors.accentPrimary),
                        const SizedBox(width: 8),
                        Text(
                          isTranslate ? 'Translation' : 'Transcript',
                          style: VCTextStyles.label.copyWith(
                              fontWeight: FontWeight.w700,
                              color: VCColors.accentPrimary,
                              letterSpacing: 0.5,
                              fontSize: 12),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    _hasDiarization
                        ? _speakerSegments(_segments)
                        : SelectableText(
                            _record['transcript']?.toString() ?? '—',
                            style: VCTextStyles.bodyLg.copyWith(fontSize: 14)),
                  ],
                ),
              ),

              // ─── Original transcript (translations) ───────────────
              if (isTranslate &&
                  (_record['original_text']?.toString().isNotEmpty ==
                      true)) ...[
                const SizedBox(height: 14),
                GlassCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.translate,
                              size: 16, color: Color(0xFF0369a1)),
                          const SizedBox(width: 8),
                          Text(
                            'Original — ${_record['language_name'] ?? _record['language'] ?? 'Source'}',
                            style: VCTextStyles.label.copyWith(
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF0369a1),
                                letterSpacing: 0.5,
                                fontSize: 12),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      SelectableText(_record['original_text']?.toString() ?? '',
                          style: VCTextStyles.bodyLg.copyWith(fontSize: 14)),
                    ],
                  ),
                ),
              ],

              // ─── Export actions ───────────────────────────────────
              const SizedBox(height: 14),
              _buildExportActions(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _editForm() {
    final shortFields =
        _caseFields.where((f) => f['full'] != true).toList();
    final fullFields =
        _caseFields.where((f) => f['full'] == true).toList();
    return Column(
      children: [
        // Pairs of short fields side-by-side
        for (int i = 0; i < shortFields.length; i += 2)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _editField(shortFields[i])),
                const SizedBox(width: 10),
                Expanded(
                  child: i + 1 < shortFields.length
                      ? _editField(shortFields[i + 1])
                      : const SizedBox(),
                ),
              ],
            ),
          ),
        // Full-width fields
        for (final f in fullFields)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _editField(f),
          ),
      ],
    );
  }

  Widget _editField(Map<String, dynamic> f) => TextField(
        controller: _ctls[f['key'] as String],
        style: VCTextStyles.bodyMd.copyWith(fontSize: 12),
        maxLines: f['multiline'] == true ? 3 : 1,
        decoration: InputDecoration(
          labelText: f['label'] as String,
          alignLabelWithHint: f['multiline'] == true,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        ),
      );

  Widget _viewDetails() {
    final fields = _caseFields
        .where((f) => _cd[f['key']]?.toString().isNotEmpty == true)
        .toList();
    if (fields.isEmpty) {
      return Text('No case details recorded.',
          style: VCTextStyles.bodySm.copyWith(fontStyle: FontStyle.italic));
    }
    final shortFields = fields.where((f) => f['full'] != true).toList();
    final fullFields = fields.where((f) => f['full'] == true).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (int i = 0; i < shortFields.length; i += 2)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _viewField(shortFields[i])),
                const SizedBox(width: 10),
                Expanded(
                  child: i + 1 < shortFields.length
                      ? _viewField(shortFields[i + 1])
                      : const SizedBox(),
                ),
              ],
            ),
          ),
        for (final f in fullFields)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _viewField(f),
          ),
      ],
    );
  }

  Widget _viewField(Map<String, dynamic> f) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(f['label'] as String,
              style: VCTextStyles.bodySm.copyWith(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  color: VCColors.textMuted,
                  letterSpacing: 0.5)),
          const SizedBox(height: 2),
          Text(
            _cd[f['key']]?.toString() ?? '—',
            style: VCTextStyles.bodySm.copyWith(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: VCColors.textPrimary),
          ),
        ],
      );

  Widget _speakerSegments(List<Map<String, dynamic>> segs) {
    return Column(
      children: segs.map((seg) {
        final speaker = seg['speaker']?.toString();
        final text = seg['text']?.toString() ?? '';
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: _spkColor(speaker),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  _formatSpeaker(speaker),
                  style: VCTextStyles.bodySm.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 10),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SelectableText(text,
                    style: VCTextStyles.bodyLg.copyWith(fontSize: 14)),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  // ─── Export helpers ───────────────────────────────────────────────────────

  String get _transcriptText => _record['transcript']?.toString() ?? '';
  String get _originalText => _record['original_text']?.toString() ?? '';

  void _copyText() {
    final text = _transcriptText;
    if (text.isEmpty) return;
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Copied to clipboard')),
    );
  }

  Future<void> _shareText() async {
    final text = _transcriptText;
    if (text.isEmpty) return;
    await Share.share(text, subject: 'AI-CopWriter Statement');
  }

  Future<(pw.Document, String)> _buildPdf() async {
    final font = await PdfGoogleFonts.notoSansTeluguRegular();
    final pdf = pw.Document();
    final cd = _cd;

    final bodyStyle = pw.TextStyle(font: font, fontSize: 11, lineSpacing: 4);
    final headStyle = pw.TextStyle(font: font, fontSize: 14, lineSpacing: 2);
    final titleStyle = pw.TextStyle(font: font, fontSize: 18, lineSpacing: 2);
    final smallStyle = pw.TextStyle(font: font, fontSize: 9);

    pdf.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(36),
      build: (ctx) => [
        pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text('AI-CopWriter — Police Statement Record', style: titleStyle),
            pw.SizedBox(height: 4),
            pw.Text('Confidential — For Official Use Only', style: smallStyle),
          ],
        ),
        pw.Divider(),
        pw.SizedBox(height: 8),
        if (_hasCdData(cd)) _pdfCaseTable(cd, font),
        pw.SizedBox(height: 14),
        pw.Text('Recorded Statement', style: headStyle),
        pw.SizedBox(height: 6),
        pw.Text(_transcriptText, style: bodyStyle),
        if (_originalText.isNotEmpty) ...[
          pw.SizedBox(height: 14),
          pw.Text('Original Transcription (Source Language)', style: headStyle),
          pw.SizedBox(height: 6),
          pw.Text(_originalText, style: bodyStyle),
        ],
        pw.SizedBox(height: 24),
        pw.Divider(),
        pw.Text(
          'Generated by AI-CopWriter · AI-generated record may contain errors. Please verify all details before official use.',
          style: pw.TextStyle(font: font, fontSize: 9, color: PdfColors.grey),
        ),
      ],
    ));

    final firNum = cd['firNumber']?.toString().trim().isNotEmpty == true
        ? cd['firNumber'].toString().replaceAll(RegExp(r'[^\w]'), '_')
        : DateTime.now().millisecondsSinceEpoch.toString();
    return (pdf, 'AI-CopWriter_$firNum.pdf');
  }

  bool _hasCdData(Map<String, dynamic> cd) => _caseFields
      .any((f) => cd[f['key']]?.toString().trim().isNotEmpty == true);

  pw.Widget _pdfCaseTable(Map<String, dynamic> cd, pw.Font font) {
    final rows = <List<String>>[
      for (final f in _caseFields)
        if (cd[f['key']]?.toString().trim().isNotEmpty == true)
          [f['label'] as String, cd[f['key']].toString()],
    ];
    return pw.TableHelper.fromTextArray(
      headers: ['Field', 'Value'],
      data: rows,
      cellStyle: pw.TextStyle(font: font, fontSize: 10),
      headerStyle: pw.TextStyle(font: font, fontSize: 10),
      headerDecoration: const pw.BoxDecoration(color: PdfColors.grey200),
      cellAlignments: {0: pw.Alignment.centerLeft, 1: pw.Alignment.centerLeft},
    );
  }

  Future<void> _exportPdf() async {
    if (_pdfGenerating) return;
    setState(() => _pdfGenerating = true);
    try {
      final (pdf, fileName) = await _buildPdf();
      final bytes = await pdf.save();

      late String savedPath;
      if (Platform.isAndroid) {
        await Permission.storage.request();
        final dl = Directory('/storage/emulated/0/Download');
        if (await dl.exists()) {
          final file = File('${dl.path}/$fileName');
          await file.writeAsBytes(bytes);
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
        savedPath = dir.path;
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('PDF saved: $savedPath'),
          duration: const Duration(seconds: 4),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('PDF export failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _pdfGenerating = false);
    }
  }

  Future<void> _sharePdf() async {
    if (_pdfGenerating) return;
    setState(() => _pdfGenerating = true);
    try {
      final (pdf, fileName) = await _buildPdf();
      final bytes = await pdf.save();
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/$fileName');
      await file.writeAsBytes(bytes);
      await Share.shareXFiles(
        [XFile(file.path)],
        subject: 'AI-CopWriter Statement',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Share PDF failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _pdfGenerating = false);
    }
  }

  Widget _buildExportActions() => Column(
        children: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: const BorderSide(color: VCColors.border),
                      foregroundColor: VCColors.textPrimary),
                  onPressed: _copyText,
                  icon: const Icon(Icons.copy, size: 16),
                  label: const Text('Copy'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: const BorderSide(color: VCColors.border),
                      foregroundColor: VCColors.textPrimary),
                  onPressed: _shareText,
                  icon: const Icon(Icons.share, size: 16),
                  label: const Text('Share Text'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: const BorderSide(color: VCColors.border),
                      foregroundColor: VCColors.textPrimary),
                  onPressed: _pdfGenerating ? null : _exportPdf,
                  icon: _pdfGenerating
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.download, size: 16),
                  label: Text(_pdfGenerating ? '…' : 'Save PDF'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: const BorderSide(color: VCColors.border),
                      foregroundColor: VCColors.textPrimary),
                  onPressed: _pdfGenerating ? null : _sharePdf,
                  icon: _pdfGenerating
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.share_outlined, size: 16),
                  label: Text(_pdfGenerating ? '…' : 'Share PDF'),
                ),
              ),
            ],
          ),
        ],
      );

  Widget _buildDocumentPreview(Map<String, dynamic> record) {
    final docPath = record['document_path']?.toString() ?? '';
    final filename = record['filename']?.toString().isNotEmpty == true
        ? record['filename'].toString()
        : docPath.split('/').last;
    final ext = filename.toLowerCase().split('.').last;
    final isImage = ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif', 'tif', 'tiff'].contains(ext);

    if (isImage) {
      // Serve from backend /file/ endpoint — no auth required
      return FutureBuilder<String>(
        future: ApiService.getBaseUrl(),
        builder: (ctx, snap) {
          if (!snap.hasData) return const SizedBox(height: 60, child: Center(child: CircularProgressIndicator(strokeWidth: 2)));
          final url = '${snap.data}/file/${Uri.encodeComponent(docPath.split('/').last)}';
          return ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.network(
              url,
              fit: BoxFit.contain,
              loadingBuilder: (_, child, progress) => progress == null
                  ? child
                  : const SizedBox(height: 80, child: Center(child: CircularProgressIndicator(strokeWidth: 2))),
              errorBuilder: (_, __, ___) => _docIconFallback(filename),
            ),
          );
        },
      );
    }

    // PDF or other — show icon + filename
    return _docIconFallback(filename);
  }

  Widget _docIconFallback(String filename) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0x10b45309),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0x33b45309)),
        ),
        child: Row(
          children: [
            const Icon(Icons.picture_as_pdf_outlined, color: Color(0xFFb45309), size: 24),
            const SizedBox(width: 10),
            Expanded(
              child: Text(filename,
                  style: VCTextStyles.bodySm.copyWith(
                      color: const Color(0xFFb45309), fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
      );

  Widget _infoChip(IconData icon, String label) => ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 220),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: VCColors.sageLight,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: VCColors.sageDark),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 12, color: VCColors.accentPrimary),
              const SizedBox(width: 4),
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                  style: VCTextStyles.bodySm.copyWith(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: VCColors.textPrimary),
                ),
              ),
            ],
          ),
        ),
      );
}
