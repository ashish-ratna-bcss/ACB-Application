// SettingsScreen — server URL config + health check
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import '../services/api_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _urlCtl = TextEditingController();
  bool _loading = true;
  String _status = '—';
  Color _statusColor = VCColors.textMuted;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final url = await ApiService.getBaseUrl();
    _urlCtl.text = url;
    setState(() => _loading = false);
    _ping();
  }

  Future<void> _save() async {
    await ApiService.setBaseUrl(_urlCtl.text);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Server URL saved')),
    );
    _ping();
  }

  Future<void> _ping() async {
    setState(() {
      _status = 'Checking…';
      _statusColor = VCColors.textMuted;
    });
    try {
      final h = await ApiService.checkHealth();
      setState(() {
        _status =
            'Connected · ${h['service'] ?? 'API'} · ${(h['available_languages'] as List?)?.length ?? 0} languages';
        _statusColor = VCColors.accentGreen;
      });
    } catch (e) {
      setState(() {
        _status = 'Offline · ${e.toString().replaceFirst('Exception: ', '')}';
        _statusColor = VCColors.accentRed;
      });
    }
  }

  @override
  void dispose() {
    _urlCtl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 110),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.dns_outlined,
                        color: VCColors.accentPrimary),
                    const SizedBox(width: 10),
                    Text('Backend Server', style: VCTextStyles.headingMd),
                  ],
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _urlCtl,
                  decoration: const InputDecoration(
                    labelText: 'API Base URL',
                    hintText: 'http://172.16.218.135:8001',
                    prefixIcon: Icon(Icons.link),
                  ),
                  keyboardType: TextInputType.url,
                ),
                const SizedBox(height: 10),
                Text(
                  'Tip: For Android emulator on same machine, use http://10.0.2.2:8001',
                  style: VCTextStyles.bodySm,
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _ping,
                        icon: const Icon(Icons.refresh, size: 18),
                        label: const Text('Test'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _save,
                        icon: const Icon(Icons.check, size: 18),
                        label: const Text('Save'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _statusColor.withOpacity(0.10),
                    borderRadius: VCRadius.md,
                    border: Border.all(color: _statusColor.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.circle, size: 10, color: _statusColor),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(_status,
                            style: VCTextStyles.bodyMd.copyWith(
                                color: _statusColor,
                                fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          GlassCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.info_outline,
                        color: VCColors.accentPrimary),
                    const SizedBox(width: 10),
                    Text('About', style: VCTextStyles.headingMd),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'AI-CopWriter Mobile is the field companion to the AI-CopWriter web app. '
                  'It uses the same FastAPI backend (Sarvam AI for Indian languages, '
                  'Whisper for English, pyannote for speaker diarization).',
                  style: VCTextStyles.bodyMd,
                ),
                const SizedBox(height: 12),
                Text('Version 1.0.0', style: VCTextStyles.bodySm),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
