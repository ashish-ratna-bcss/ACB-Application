// LoginScreen — CopWriter officer login.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/auth_state.dart';
import 'home_shell.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _loading = false;
  bool _showPw = false;
  String? _error;

  @override
  void dispose() {
    _userCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    // Authentication disabled — any details (or none) log straight in.
    final username = _userCtrl.text.trim().isEmpty
        ? 'Officer'
        : _userCtrl.text.trim();

    setState(() {
      _loading = true;
      _error = null;
    });

    // Store a local session (no backend auth call).
    await context.read<AuthState>().login('local-session', username, 'officer');
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => const HomeShell(),
        transitionsBuilder: (_, anim, __, child) =>
            FadeTransition(opacity: anim, child: child),
        transitionDuration: const Duration(milliseconds: 400),
      ),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: VCColors.bgPrimary,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),
              // ── Logo ───────────────────────────────────────────────
              Center(
                child: Column(
                  children: [
                    Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        gradient: VCColors.gradientMain,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color:
                                VCColors.accentPrimary.withValues(alpha: 0.3),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      padding: const EdgeInsets.all(4),
                      child: Image.asset(
                        'assets/images/police-logo.png',
                        fit: BoxFit.contain,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text('ACB', style: VCTextStyles.headingLg),
                    const SizedBox(height: 4),
                    Text(
                      'INVESTIGATION PLATFORM',
                      style: VCTextStyles.bodySm.copyWith(
                        fontSize: 10,
                        letterSpacing: 4,
                        color: VCColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 40),

              // ── Card ──────────────────────────────────────────────
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: VCShadow.md,
                  border: Border.all(color: VCColors.border),
                ),
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('Officer Sign In',
                        style: VCTextStyles.headingMd.copyWith(fontSize: 17)),
                    const SizedBox(height: 4),
                    Text('Sign in with your assigned credentials',
                        style: VCTextStyles.bodySm
                            .copyWith(color: VCColors.textMuted)),
                    const SizedBox(height: 24),

                    // Username
                    _fieldLabel('Username'),
                    const SizedBox(height: 6),
                    _textField(
                      controller: _userCtrl,
                      hint: 'Enter your username',
                      icon: Icons.person_outline,
                      textInputAction: TextInputAction.next,
                    ),
                    const SizedBox(height: 16),

                    // Password
                    _fieldLabel('Password'),
                    const SizedBox(height: 6),
                    _textField(
                      controller: _passCtrl,
                      hint: 'Enter your password',
                      icon: Icons.lock_outline,
                      obscure: !_showPw,
                      textInputAction: TextInputAction.done,
                      onSubmitted: (_) => _submit(),
                      suffix: IconButton(
                        icon: Icon(
                          _showPw
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          size: 18,
                          color: VCColors.textMuted,
                        ),
                        onPressed: () => setState(() => _showPw = !_showPw),
                      ),
                    ),

                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFfef2f2),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFFfecaca)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline,
                                size: 16, color: Color(0xFFb91c1c)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(_error!,
                                  style: VCTextStyles.bodySm.copyWith(
                                    color: const Color(0xFFb91c1c),
                                    fontSize: 12,
                                  )),
                            ),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: 22),

                    // Sign In button
                    SizedBox(
                      height: 50,
                      child: ElevatedButton(
                        onPressed: _loading ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: VCColors.accentPrimary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14)),
                          elevation: 0,
                          disabledBackgroundColor:
                              VCColors.accentPrimary.withValues(alpha: 0.5),
                        ),
                        child: _loading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  color: Colors.white,
                                ),
                              )
                            : Text('Sign In',
                                style: VCTextStyles.bodySm.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                )),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              Text(
                'Contact your administrator if you need access.',
                textAlign: TextAlign.center,
                style: VCTextStyles.bodySm.copyWith(
                  color: VCColors.textMuted,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _fieldLabel(String text) => Text(
        text,
        style: VCTextStyles.bodySm.copyWith(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: VCColors.textSecondary,
          letterSpacing: 0.5,
        ),
      );

  Widget _textField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool obscure = false,
    TextInputAction? textInputAction,
    void Function(String)? onSubmitted,
    Widget? suffix,
  }) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      textInputAction: textInputAction,
      onSubmitted: onSubmitted,
      style: VCTextStyles.bodySm
          .copyWith(color: VCColors.textPrimary, fontSize: 14),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: VCTextStyles.bodySm
            .copyWith(color: VCColors.textMuted, fontSize: 13),
        prefixIcon: Icon(icon, size: 18, color: VCColors.textMuted),
        suffixIcon: suffix,
        filled: true,
        fillColor: VCColors.bgSecondary,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: VCColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: VCColors.border.withValues(alpha: 2)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide:
              const BorderSide(color: VCColors.accentPrimary, width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
    );
  }
}
