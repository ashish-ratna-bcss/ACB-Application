// CaseDetailsScreen — form fields matching website's CaseDetailsForm
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import '../models/case_details.dart';

class CaseDetailsScreen extends StatefulWidget {
  const CaseDetailsScreen({super.key});

  @override
  State<CaseDetailsScreen> createState() => _CaseDetailsScreenState();
}

class _CaseDetailsScreenState extends State<CaseDetailsScreen> {
  late final Map<String, TextEditingController> _controllers;
  bool _firError = false;

  static const _fields = [
    {
      'key': 'firNumber',
      'label': 'FIR / Case No.',
      'hint': 'e.g. FIR-2026-001',
      'icon': Icons.tag
    },
    {
      'key': 'accusedName',
      'label': 'Accused Name',
      'hint': 'Full name of accused',
      'icon': Icons.person_outline
    },
    {
      'key': 'complainantName',
      'label': 'Complainant Name',
      'hint': 'Full name of complainant',
      'icon': Icons.person_pin
    },
    {
      'key': 'officerName',
      'label': 'Recording Officer',
      'hint': 'Officer full name',
      'icon': Icons.shield_outlined
    },
    {
      'key': 'badgeNumber',
      'label': 'Badge / ID No.',
      'hint': 'Badge number',
      'icon': Icons.badge_outlined
    },
    {
      'key': 'stationName',
      'label': 'Police Station',
      'hint': 'Station name',
      'icon': Icons.location_city
    },
    {
      'key': 'location',
      'label': 'Place of Recording',
      'hint': 'Location / address',
      'icon': Icons.place_outlined
    },
    {
      'key': 'sectionOfLaw',
      'label': 'Section of Law',
      'hint': 'e.g. IPC 302, BNS 103',
      'icon': Icons.gavel
    },
    {
      'key': 'incidentDate',
      'label': 'Date of Incident',
      'hint': 'YYYY-MM-DD',
      'icon': Icons.calendar_today
    },
  ];

  @override
  void initState() {
    super.initState();
    _controllers = {
      for (final f in _fields) f['key'] as String: TextEditingController(),
    };
    _controllers['description'] = TextEditingController();
  }

  bool _initialized = false;
  CaseDetails get _case => context.read<CaseDetails>();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    _initialized = true;
    for (final f in _fields) {
      _controllers[f['key'] as String]!.text = _readField(f['key'] as String);
    }
    _controllers['description']!.text = _case.description;
  }

  String _readField(String k) {
    switch (k) {
      case 'firNumber':
        return _case.firNumber;
      case 'accusedName':
        return _case.accusedName;
      case 'complainantName':
        return _case.complainantName;
      case 'officerName':
        return _case.officerName;
      case 'badgeNumber':
        return _case.badgeNumber;
      case 'stationName':
        return _case.stationName;
      case 'location':
        return _case.location;
      case 'sectionOfLaw':
        return _case.sectionOfLaw;
      case 'incidentDate':
        return _case.incidentDate;
      case 'description':
        return _case.description;
    }
    return '';
  }

  void _writeAll() {
    _case
      ..firNumber = _controllers['firNumber']!.text
      ..accusedName = _controllers['accusedName']!.text
      ..complainantName = _controllers['complainantName']!.text
      ..officerName = _controllers['officerName']!.text
      ..badgeNumber = _controllers['badgeNumber']!.text
      ..stationName = _controllers['stationName']!.text
      ..location = _controllers['location']!.text
      ..sectionOfLaw = _controllers['sectionOfLaw']!.text
      ..incidentDate = _controllers['incidentDate']!.text
      ..description = _controllers['description']!.text
      ..touch();
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 110),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GlassCard(
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: VCColors.sage,
                    borderRadius: VCRadius.md,
                  ),
                  child: const Icon(Icons.description,
                      color: VCColors.accentPrimary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Case Details', style: VCTextStyles.headingMd),
                      Text('Fill once — appears on every export & PDF',
                          style: VCTextStyles.bodySm),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (_firError) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: VCColors.blushLight,
                border: Border.all(color: VCColors.accentRed.withOpacity(0.5), width: 1.5),
                borderRadius: VCRadius.md,
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, color: VCColors.accentRed),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Enter FIR / Case No. to proceed.',
                      style: VCTextStyles.bodyMd.copyWith(color: VCColors.accentRed, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 14),
          GlassCard(
            child: Column(
              children: [
                for (final f in _fields) _field(f),
                const SizedBox(height: 6),
                _textArea(),
              ],
            ),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () {
              _writeAll();
              if (_controllers['firNumber']!.text.trim().isEmpty) {
                setState(() => _firError = true);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Please enter FIR / Case No.'), backgroundColor: VCColors.accentRed),
                );
              } else {
                setState(() => _firError = false);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Case details saved')),
                );
              }
            },
            icon: const Icon(Icons.check),
            label: const Text('Save Case Details'),
          ),
        ],
      ),
    );
  }

  Widget _field(Map<String, dynamic> f) {
    final isFir = f['key'] == 'firNumber';
    final hasError = isFir && _firError;
    
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: _controllers[f['key']],
        onChanged: (val) {
          if (isFir && val.trim().isNotEmpty && _firError) {
             setState(() => _firError = false);
          }
          _writeAll();
        },
        decoration: InputDecoration(
          labelText: f['label'] as String,
          hintText: f['hint'] as String,
          prefixIcon: Icon(f['icon'] as IconData, color: hasError ? VCColors.accentRed : VCColors.textMuted, size: 20),
          enabledBorder: hasError ? OutlineInputBorder(borderSide: const BorderSide(color: VCColors.accentRed, width: 1.5), borderRadius: BorderRadius.circular(8)) : null,
          focusedBorder: hasError ? OutlineInputBorder(borderSide: const BorderSide(color: VCColors.accentRed, width: 2), borderRadius: BorderRadius.circular(8)) : null,
          filled: hasError,
          fillColor: hasError ? VCColors.accentRed.withOpacity(0.05) : null,
        ),
      ),
    );
  }

  Widget _textArea() {
    return TextField(
      controller: _controllers['description'],
      onChanged: (_) => _writeAll(),
      maxLines: 4,
      decoration: const InputDecoration(
        labelText: 'Brief Description',
        hintText: 'Nature of offense / incident summary',
        alignLabelWithHint: true,
      ),
    );
  }
}
