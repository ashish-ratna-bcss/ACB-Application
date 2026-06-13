// SplashScreen — CopWriter AI intro with neural network, scan line, data streams
import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../theme/app_theme.dart';
import '../providers/auth_state.dart';
import 'home_shell.dart';
import 'login_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  // ── Existing controllers ──────────────────────────────────────
  late AnimationController _bgCtrl;    // slow orb drift (10s)
  late AnimationController _ringCtrl;  // rings + pulse (1.8s)
  late AnimationController _logoCtrl;  // logo bounce (800ms)
  late AnimationController _textCtrl;  // title/subtitle (700ms)

  // ── New AI controllers ─────────────────────────────────────────
  late AnimationController _scanCtrl;     // AI scan sweep (2s loop)
  late AnimationController _aiFadeCtrl;   // fade-in for AI layer (700ms)
  late AnimationController _aiPulseCtrl;  // neural net signal pulse (1.4s loop)

  // ── Animations ────────────────────────────────────────────────
  late Animation<double> _logoScale;
  late Animation<double> _logoOpacity;
  late Animation<double> _glowOpacity;
  late Animation<double> _titleOpacity;
  late Animation<Offset>  _titleSlide;
  late Animation<double> _subtitleOpacity;
  late Animation<Offset>  _subtitleSlide;
  late Animation<double> _lineWidth;
  late Animation<double> _aiFade;

  // ── AI status text ─────────────────────────────────────────────
  int _statusIdx = 0;
  Timer? _statusTimer;
  static const _statusMessages = [
    'Initializing AI Engine…',
    'Loading Voice Models…',
    'Scanning Case Database…',
    'System Ready',
  ];

  @override
  void initState() {
    super.initState();

    _bgCtrl = AnimationController(vsync: this, duration: const Duration(seconds: 10))
      ..repeat();

    _ringCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1800))
      ..repeat();

    _logoCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));

    _textCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));

    _scanCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 2000));

    _aiFadeCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 700));

    _aiPulseCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))
      ..repeat();

    // ── Logo: elastic bounce 0 → 1.12 → 1.0 ─────────────────────
    _logoScale = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween(begin: 0.0, end: 1.12).chain(CurveTween(curve: Curves.easeOut)),
        weight: 65,
      ),
      TweenSequenceItem(
        tween: Tween(begin: 1.12, end: 1.0).chain(CurveTween(curve: Curves.elasticOut)),
        weight: 35,
      ),
    ]).animate(_logoCtrl);

    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _logoCtrl, curve: const Interval(0.0, 0.45, curve: Curves.easeIn)));

    _glowOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _logoCtrl, curve: const Interval(0.25, 0.85, curve: Curves.easeOut)));

    _titleOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0.0, 0.55, curve: Curves.easeOut)));

    _titleSlide = Tween<Offset>(begin: const Offset(0, 0.5), end: Offset.zero).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0.0, 0.65, curve: Curves.easeOutCubic)));

    _lineWidth = Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0.2, 0.75, curve: Curves.easeOut)));

    _subtitleOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0.30, 0.85, curve: Curves.easeOut)));

    _subtitleSlide = Tween<Offset>(begin: const Offset(0, 0.6), end: Offset.zero).animate(
        CurvedAnimation(parent: _textCtrl, curve: const Interval(0.30, 0.90, curve: Curves.easeOutCubic)));

    _aiFade = Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _aiFadeCtrl, curve: Curves.easeOut));

    _runSequence();
  }

  Future<void> _runSequence() async {
    final authState = context.read<AuthState>();
    await authState.tryAutoLogin();

    await Future.delayed(const Duration(milliseconds: 200));
    if (!mounted) return;
    _logoCtrl.forward();

    await Future.delayed(const Duration(milliseconds: 550));
    if (!mounted) return;
    _textCtrl.forward();

    await Future.delayed(const Duration(milliseconds: 300));
    if (!mounted) return;
    _aiFadeCtrl.forward();
    _scanCtrl.repeat();

    // Status messages cycle every 900ms
    _statusTimer = Timer.periodic(const Duration(milliseconds: 900), (t) {
      if (!mounted) { t.cancel(); return; }
      setState(() {
        _statusIdx = (_statusIdx + 1).clamp(0, _statusMessages.length - 1);
      });
      if (_statusIdx >= _statusMessages.length - 1) t.cancel();
    });

    await Future.delayed(const Duration(milliseconds: 3300));
    if (!mounted) return;
    _statusTimer?.cancel();

    final target = authState.isLoggedIn ? const HomeShell() : const LoginScreen();
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => target,
        transitionsBuilder: (_, animation, __, child) =>
            FadeTransition(opacity: animation, child: child),
        transitionDuration: const Duration(milliseconds: 1000),
      ),
    );
  }

  @override
  void dispose() {
    _statusTimer?.cancel();
    _bgCtrl.dispose();
    _ringCtrl.dispose();
    _logoCtrl.dispose();
    _textCtrl.dispose();
    _scanCtrl.dispose();
    _aiFadeCtrl.dispose();
    _aiPulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        body: AnimatedBuilder(
          animation: _bgCtrl,
          builder: (_, child) => Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment(-0.8 + math.sin(_bgCtrl.value * math.pi * 2) * 0.4, -1.0),
                end: Alignment(0.8 - math.sin(_bgCtrl.value * math.pi * 2) * 0.4, 1.0),
                colors: const [
                  Color(0xFF151C11),
                  Color(0xFF1E2A18),
                  Color(0xFF231C12),
                  Color(0xFF0F1409),
                ],
              ),
            ),
            child: child,
          ),
          child: Stack(
            children: [
              // ── Background drifting orbs ──────────────────────────
              AnimatedBuilder(
                animation: _bgCtrl,
                builder: (_, __) => CustomPaint(
                  size: Size.infinite,
                  painter: _SplashOrbPainter(_bgCtrl.value),
                ),
              ),

              // ── AI neural network graph ───────────────────────────
              AnimatedBuilder(
                animation: Listenable.merge([_bgCtrl, _aiFadeCtrl, _aiPulseCtrl]),
                builder: (_, __) => Opacity(
                  opacity: _aiFade.value,
                  child: CustomPaint(
                    size: Size.infinite,
                    painter: _NeuralNetPainter(
                      t: _bgCtrl.value,
                      pulse: _aiPulseCtrl.value,
                    ),
                  ),
                ),
              ),

              // ── Data stream particles on sides ────────────────────
              AnimatedBuilder(
                animation: Listenable.merge([_bgCtrl, _aiFadeCtrl]),
                builder: (_, __) => Opacity(
                  opacity: _aiFade.value,
                  child: CustomPaint(
                    size: Size.infinite,
                    painter: _DataStreamPainter(_bgCtrl.value),
                  ),
                ),
              ),

              // ── AI scan line over the logo ────────────────────────
              AnimatedBuilder(
                animation: Listenable.merge([_scanCtrl, _aiFadeCtrl, _logoCtrl]),
                builder: (_, __) => Opacity(
                  opacity: _aiFade.value * _glowOpacity.value,
                  child: CustomPaint(
                    size: Size.infinite,
                    painter: _ScanLinePainter(_scanCtrl.value),
                  ),
                ),
              ),

              // ── Centre content ────────────────────────────────────
              Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Logo + rings
                    AnimatedBuilder(
                      animation: Listenable.merge([_logoCtrl, _ringCtrl]),
                      builder: (_, __) => SizedBox(
                        width: 220,
                        height: 220,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            // 3 expanding pulse rings
                            ...List.generate(3, (i) {
                              final phase = i / 3;
                              final t = (_ringCtrl.value + phase) % 1.0;
                              return Opacity(
                                opacity: (1 - t) * 0.5 * _glowOpacity.value,
                                child: Transform.scale(
                                  scale: 0.65 + t * 0.70,
                                  child: Container(
                                    width: 180,
                                    height: 180,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                        color: VCColors.accentPrimary,
                                        width: 1.2,
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            }),

                            // Clockwise sweep gradient ring
                            Opacity(
                              opacity: _glowOpacity.value,
                              child: Transform.rotate(
                                angle: _ringCtrl.value * math.pi * 2,
                                child: Container(
                                  width: 162,
                                  height: 162,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    gradient: SweepGradient(
                                      colors: [
                                        VCColors.accentPrimary.withValues(alpha: 0.0),
                                        VCColors.accentPrimary.withValues(alpha: 0.8),
                                        VCColors.accentSecondary.withValues(alpha: 0.5),
                                        VCColors.accentPrimary.withValues(alpha: 0.0),
                                      ],
                                      stops: const [0.0, 0.35, 0.65, 1.0],
                                    ),
                                  ),
                                ),
                              ),
                            ),

                            // Counter-clockwise dashed ring
                            Opacity(
                              opacity: _glowOpacity.value * 0.65,
                              child: Transform.rotate(
                                angle: -_ringCtrl.value * math.pi * 2 * 0.55,
                                child: CustomPaint(
                                  size: const Size(196, 196),
                                  painter: _DashedRingPainter(
                                    color: VCColors.accentSecondary.withValues(alpha: 0.55),
                                    dashCount: 18,
                                  ),
                                ),
                              ),
                            ),

                            // Inner static hexagonal tick marks ring
                            Opacity(
                              opacity: _glowOpacity.value * 0.4,
                              child: Transform.rotate(
                                angle: _ringCtrl.value * math.pi * 2 * 0.25,
                                child: CustomPaint(
                                  size: const Size(142, 142),
                                  painter: _DashedRingPainter(
                                    color: const Color(0xFF86efac).withValues(alpha: 0.45),
                                    dashCount: 8,
                                  ),
                                ),
                              ),
                            ),

                            // Glow blob behind logo
                            Opacity(
                              opacity: _glowOpacity.value * 0.4,
                              child: Container(
                                width: 130,
                                height: 130,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  boxShadow: [
                                    BoxShadow(
                                      color: VCColors.accentPrimary.withValues(alpha: 0.65),
                                      blurRadius: 56,
                                      spreadRadius: 14,
                                    ),
                                  ],
                                ),
                              ),
                            ),

                            // Police logo
                            Transform.scale(
                              scale: _logoScale.value,
                              child: Opacity(
                                opacity: _logoOpacity.value,
                                child: Container(
                                  width: 120,
                                  height: 120,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: Colors.white.withValues(alpha: 0.08),
                                    border: Border.all(
                                      color: Colors.white.withValues(alpha: 0.28),
                                      width: 1.5,
                                    ),
                                  ),
                                  padding: const EdgeInsets.all(16),
                                  child: Image.asset(
                                    'assets/images/police-logo.png',
                                    fit: BoxFit.fill,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 32),

                    // App title
                    AnimatedBuilder(
                      animation: _textCtrl,
                      builder: (_, __) => FadeTransition(
                        opacity: _titleOpacity,
                        child: SlideTransition(
                          position: _titleSlide,
                          child: Text(
                            'ACB',
                            style: VCTextStyles.displayLarge.copyWith(
                              color: Colors.white,
                              letterSpacing: 3,
                              fontSize: 38,
                              shadows: [
                                Shadow(
                                  color: VCColors.accentPrimary.withValues(alpha: 0.9),
                                  blurRadius: 32,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 10),

                    // Expanding separator line
                    AnimatedBuilder(
                      animation: _lineWidth,
                      builder: (_, __) => Opacity(
                        opacity: _lineWidth.value,
                        child: Container(
                          width: 200 * _lineWidth.value,
                          height: 1,
                          decoration: BoxDecoration(
                            gradient: LinearGradient(colors: [
                              Colors.transparent,
                              VCColors.accentSecondary.withValues(alpha: 0.85),
                              Colors.transparent,
                            ]),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 10),

                    // Subtitle
                    AnimatedBuilder(
                      animation: _textCtrl,
                      builder: (_, __) => FadeTransition(
                        opacity: _subtitleOpacity,
                        child: SlideTransition(
                          position: _subtitleSlide,
                          child: Text(
                            'INVESTIGATION PLATFORM',
                            style: VCTextStyles.bodySm.copyWith(
                              color: Colors.white.withValues(alpha: 0.65),
                              letterSpacing: 5,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 28),

                    // AI status message (animated switcher)
                    AnimatedBuilder(
                      animation: _aiFadeCtrl,
                      builder: (_, __) => Opacity(
                        opacity: _aiFade.value,
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 350),
                          transitionBuilder: (child, anim) => FadeTransition(
                            opacity: anim,
                            child: SlideTransition(
                              position: Tween<Offset>(
                                begin: const Offset(0, 0.3),
                                end: Offset.zero,
                              ).animate(anim),
                              child: child,
                            ),
                          ),
                          child: Text(
                            _statusMessages[_statusIdx],
                            key: ValueKey(_statusIdx),
                            style: TextStyle(
                              color: _statusIdx == _statusMessages.length - 1
                                  ? const Color(0xFF86efac)
                                  : VCColors.accentSecondary.withValues(alpha: 0.8),
                              fontSize: 11,
                              letterSpacing: 1.5,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // ── Animated loading dots at bottom ───────────────────
              Positioned(
                bottom: 56,
                left: 0,
                right: 0,
                child: AnimatedBuilder(
                  animation: Listenable.merge([_ringCtrl, _textCtrl]),
                  builder: (_, __) => Opacity(
                    opacity: _subtitleOpacity.value,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (i) {
                        final phase = i / 5;
                        final t = (_ringCtrl.value + phase) % 1.0;
                        final scale = 0.4 + math.sin(t * math.pi).abs() * 0.6;
                        final isActive = scale > 0.75;
                        return Container(
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          width: isActive ? 7 : 5,
                          height: isActive ? 7 : 5,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isActive
                                ? const Color(0xFF86efac).withValues(alpha: 0.9)
                                : VCColors.accentSecondary.withValues(alpha: 0.3 + scale * 0.4),
                            boxShadow: isActive
                                ? [BoxShadow(
                                    color: const Color(0xFF86efac).withValues(alpha: 0.5),
                                    blurRadius: 6,
                                  )]
                                : null,
                          ),
                        );
                      }),
                    ),
                  ),
                ),
              ),

              // ── Version tag bottom-right ───────────────────────────
              Positioned(
                bottom: 24,
                right: 24,
                child: AnimatedBuilder(
                  animation: _aiFadeCtrl,
                  builder: (_, __) => Opacity(
                    opacity: _aiFade.value * 0.45,
                    child: Text(
                      'v1.0  ·  AI Powered',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.5),
                        fontSize: 9,
                        letterSpacing: 1.2,
                        fontWeight: FontWeight.w400,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Neural network background — nodes with animated connections and signal pulses
// ─────────────────────────────────────────────────────────────────────────────
class _NeuralNetPainter extends CustomPainter {
  final double t;
  final double pulse;
  _NeuralNetPainter({required this.t, required this.pulse});

  static const _nodes = [
    Offset(0.12, 0.16), Offset(0.28, 0.07), Offset(0.72, 0.11),
    Offset(0.89, 0.22), Offset(0.93, 0.52), Offset(0.86, 0.76),
    Offset(0.70, 0.91), Offset(0.35, 0.93), Offset(0.09, 0.82),
    Offset(0.05, 0.46), Offset(0.18, 0.63), Offset(0.38, 0.19),
    Offset(0.65, 0.28), Offset(0.81, 0.43), Offset(0.55, 0.76),
    Offset(0.22, 0.36), Offset(0.47, 0.05), Offset(0.60, 0.96),
  ];

  @override
  void paint(Canvas canvas, Size size) {
    final linePaint = Paint()..style = PaintingStyle.stroke..strokeWidth = 0.7;
    final nodePaint = Paint()..style = PaintingStyle.fill;

    // ── Connections between nearby nodes ─────────────────────────
    for (int i = 0; i < _nodes.length; i++) {
      for (int j = i + 1; j < _nodes.length; j++) {
        final a = Offset(_nodes[i].dx * size.width, _nodes[i].dy * size.height);
        final b = Offset(_nodes[j].dx * size.width, _nodes[j].dy * size.height);
        if ((a - b).distance > size.width * 0.38) continue;

        final phase = ((i * 7 + j * 3) * 0.37 + t * 2.0) % 1.0;
        final activity = math.sin(phase * math.pi) * 0.5 + 0.5;
        final alpha = 0.03 + activity * 0.13;

        linePaint.color = const Color(0xFF6a8650).withValues(alpha: alpha);
        canvas.drawLine(a, b, linePaint);

        // Travelling signal dot
        if (activity > 0.62) {
          final sT = (pulse * 1.2 + (i * 0.13 + j * 0.09)) % 1.0;
          final sp = Offset.lerp(a, b, sT)!;
          nodePaint.color = const Color(0xFF86efac).withValues(alpha: activity * 0.6);
          canvas.drawCircle(sp, 2.0, nodePaint);
        }
      }
    }

    // ── Nodes ─────────────────────────────────────────────────────
    for (int i = 0; i < _nodes.length; i++) {
      final pos = Offset(_nodes[i].dx * size.width, _nodes[i].dy * size.height);
      final phase = (i * 0.47 + t * 1.6) % 1.0;
      final glow = math.sin(phase * math.pi) * 0.5 + 0.5;

      // Aura
      nodePaint.color = const Color(0xFF4a6741).withValues(alpha: 0.05 + glow * 0.09);
      canvas.drawCircle(pos, 5.5 + glow * 4.0, nodePaint);

      // Core
      nodePaint.color = const Color(0xFF86efac).withValues(alpha: 0.3 + glow * 0.4);
      canvas.drawCircle(pos, 1.8, nodePaint);
    }
  }

  @override
  bool shouldRepaint(_NeuralNetPainter old) => old.t != t || old.pulse != pulse;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI scan line — sweeps vertically across the logo area
// ─────────────────────────────────────────────────────────────────────────────
class _ScanLinePainter extends CustomPainter {
  final double t;
  _ScanLinePainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    final centerY = size.height * 0.42;
    final scanRange = size.height * 0.22;
    final y = centerY - scanRange / 2 + scanRange * t;
    final cx = size.width / 2;
    final halfW = size.width * 0.23;

    // Main scan line
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.3
      ..shader = LinearGradient(
        colors: [
          Colors.transparent,
          const Color(0xFF86efac).withValues(alpha: 0.85),
          const Color(0xFF86efac).withValues(alpha: 0.85),
          Colors.transparent,
        ],
        stops: const [0.0, 0.25, 0.75, 1.0],
      ).createShader(Rect.fromLTWH(cx - halfW, y - 1, halfW * 2, 2));

    canvas.drawLine(Offset(cx - halfW, y), Offset(cx + halfW, y), paint);

    // Glow trail above the line
    final trailPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 10
      ..shader = LinearGradient(
        colors: [
          Colors.transparent,
          const Color(0xFF86efac).withValues(alpha: 0.07),
          const Color(0xFF86efac).withValues(alpha: 0.07),
          Colors.transparent,
        ],
        stops: const [0.0, 0.25, 0.75, 1.0],
      ).createShader(Rect.fromLTWH(cx - halfW, y - 5, halfW * 2, 10));

    canvas.drawLine(Offset(cx - halfW, y - 4), Offset(cx + halfW, y - 4), trailPaint);

    // Corner brackets at each end of the scan line
    final bracketPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..color = const Color(0xFF86efac).withValues(alpha: 0.6)
      ..strokeCap = StrokeCap.round;

    const bSize = 6.0;
    // Left bracket
    canvas.drawLine(Offset(cx - halfW, y - bSize), Offset(cx - halfW, y), bracketPaint);
    canvas.drawLine(Offset(cx - halfW, y), Offset(cx - halfW + bSize, y), bracketPaint);
    // Right bracket
    canvas.drawLine(Offset(cx + halfW, y - bSize), Offset(cx + halfW, y), bracketPaint);
    canvas.drawLine(Offset(cx + halfW - bSize, y), Offset(cx + halfW, y), bracketPaint);
  }

  @override
  bool shouldRepaint(_ScanLinePainter old) => old.t != t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data stream particles — falling dots on left + right edges
// ─────────────────────────────────────────────────────────────────────────────
class _DataStreamPainter extends CustomPainter {
  final double t;
  _DataStreamPainter(this.t);

  // Fixed particle data — seeded so layout is deterministic
  static final List<_Particle> _particles = _buildParticles();

  static List<_Particle> _buildParticles() {
    final rng = math.Random(42);
    return List.generate(22, (i) => _Particle(
      xFrac: i < 11
          ? 0.02 + rng.nextDouble() * 0.09
          : 0.89 + rng.nextDouble() * 0.09,
      yStart: rng.nextDouble(),
      speed:  0.25 + rng.nextDouble() * 0.55,
      size:   1.0  + rng.nextDouble() * 1.6,
      phase:  rng.nextDouble(),
    ));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..style = PaintingStyle.fill;
    for (final p in _particles) {
      final y = ((p.yStart + t * p.speed + p.phase) % 1.0) * size.height;
      final x = p.xFrac * size.width;
      final brightness = math.sin(((p.yStart + t * p.speed) % 1.0) * math.pi);
      paint.color = const Color(0xFF86efac).withValues(alpha: brightness * 0.3);
      canvas.drawCircle(Offset(x, y), p.size, paint);
    }
  }

  @override
  bool shouldRepaint(_DataStreamPainter old) => old.t != t;
}

class _Particle {
  final double xFrac, yStart, speed, size, phase;
  const _Particle({
    required this.xFrac, required this.yStart,
    required this.speed, required this.size, required this.phase,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashed arc ring — counter-rotating ring around the logo
// ─────────────────────────────────────────────────────────────────────────────
class _DashedRingPainter extends CustomPainter {
  final Color color;
  final int dashCount;
  const _DashedRingPainter({required this.color, required this.dashCount});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2 - 2;
    final dashAngle = math.pi * 2 / (dashCount * 2);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.3
      ..strokeCap = StrokeCap.round;

    for (int i = 0; i < dashCount; i++) {
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        i * dashAngle * 2,
        dashAngle,
        false,
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_DashedRingPainter old) => false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Drifting background orbs (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────
class _SplashOrbPainter extends CustomPainter {
  final double t;
  _SplashOrbPainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    final orbs = [
      _Orb(
        dx: 0.15 + math.sin(t * math.pi * 2 + 0.0) * 0.12,
        dy: 0.20 + math.cos(t * math.pi * 2 + 0.0) * 0.10,
        r: size.width * 0.55,
        color: const Color(0xFF4a6741).withValues(alpha: 0.14),
      ),
      _Orb(
        dx: 0.88 + math.sin(t * math.pi * 2 + 2.0) * 0.10,
        dy: 0.70 + math.cos(t * math.pi * 2 + 2.0) * 0.12,
        r: size.width * 0.60,
        color: const Color(0xFFC39C84).withValues(alpha: 0.14),
      ),
      _Orb(
        dx: 0.50 + math.sin(t * math.pi * 2 + 4.1) * 0.18,
        dy: 0.92 + math.cos(t * math.pi * 2 + 4.1) * 0.06,
        r: size.width * 0.42,
        color: const Color(0xFFC39C84).withValues(alpha: 0.07),
      ),
    ];
    for (final o in orbs) {
      final center = Offset(size.width * o.dx, size.height * o.dy);
      canvas.drawCircle(
        center,
        o.r,
        Paint()
          ..shader = RadialGradient(
            colors: [o.color, o.color.withValues(alpha: 0)],
          ).createShader(Rect.fromCircle(center: center, radius: o.r)),
      );
    }
  }

  @override
  bool shouldRepaint(_SplashOrbPainter old) => old.t != t;
}

class _Orb {
  final double dx, dy, r;
  final Color color;
  const _Orb({required this.dx, required this.dy, required this.r, required this.color});
}
