// Reusable widgets — animated glass cards, orb background, waveform, chips
import 'dart:ui' as ui;
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Liquid-glass card with press-to-scale feedback
// ─────────────────────────────────────────────────────────────────────────────
class GlassCard extends StatefulWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final double opacity;
  final double blur;
  final BorderRadiusGeometry? borderRadius;
  final VoidCallback? onTap;

  const GlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.margin = EdgeInsets.zero,
    this.opacity = 0.42,
    this.blur = 22,
    this.borderRadius,
    this.onTap,
  });

  @override
  State<GlassCard> createState() => _GlassCardState();
}

class _GlassCardState extends State<GlassCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _scaleCtrl;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _scaleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 90),
      reverseDuration: const Duration(milliseconds: 220),
    );
    _scale = Tween<double>(begin: 1.0, end: 0.965).animate(
      CurvedAnimation(parent: _scaleCtrl, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _scaleCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final radius = widget.borderRadius ?? VCRadius.lg;
    final inner = Container(
      margin: widget.margin,
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: VCShadow.md,
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(
              sigmaX: widget.blur, sigmaY: widget.blur),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: radius,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Colors.white.withValues(alpha: widget.opacity + 0.20),
                  VCColors.ivory.withValues(alpha: widget.opacity),
                  Colors.white.withValues(alpha: widget.opacity - 0.04),
                ],
                stops: const [0.0, 0.55, 1.0],
              ),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.60),
                width: 1,
              ),
            ),
            child: Stack(
              children: [
                // Inner top-edge glass sheen
                Positioned(
                  top: 0, left: 0, right: 0, height: 32,
                  child: IgnorePointer(
                    child: Container(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.only(
                          topLeft: radius is BorderRadius
                              ? radius.topLeft
                              : Radius.zero,
                          topRight: radius is BorderRadius
                              ? radius.topRight
                              : Radius.zero,
                        ),
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.white.withValues(alpha: 0.60),
                            Colors.white.withValues(alpha: 0.0),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                // Left-edge refraction line
                Positioned(
                  top: 8, left: 0, bottom: 8, width: 1,
                  child: IgnorePointer(
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.white.withValues(alpha: 0.5),
                            Colors.white.withValues(alpha: 0.0),
                            Colors.white.withValues(alpha: 0.2),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Padding(padding: widget.padding, child: widget.child),
              ],
            ),
          ),
        ),
      ),
    );

    if (widget.onTap == null) return inner;

    return AnimatedBuilder(
      animation: _scale,
      builder: (_, child) => Transform.scale(scale: _scale.value, child: child),
      child: GestureDetector(
        onTapDown: (_) => _scaleCtrl.forward(),
        onTapUp: (_) {
          _scaleCtrl.reverse();
          widget.onTap?.call();
        },
        onTapCancel: () => _scaleCtrl.reverse(),
        child: inner,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated background with slow-drifting gradient orbs
// ─────────────────────────────────────────────────────────────────────────────
class AppBackground extends StatefulWidget {
  final Widget child;
  const AppBackground({super.key, required this.child});

  @override
  State<AppBackground> createState() => _AppBackgroundState();
}

class _AppBackgroundState extends State<AppBackground>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 12),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.asset(
          'assets/images/background_template.png',
          fit: BoxFit.cover,
          alignment: Alignment.topCenter,
        ),
        // Slow-drifting orbs for depth
        AnimatedBuilder(
          animation: _ctrl,
          builder: (_, __) => CustomPaint(
            painter: _BgOrbPainter(_ctrl.value),
          ),
        ),
        // Gradient veil
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                VCColors.ivory.withValues(alpha: 0.08),
                VCColors.blushLight.withValues(alpha: 0.14),
                VCColors.ivory.withValues(alpha: 0.28),
              ],
            ),
          ),
        ),
        widget.child,
      ],
    );
  }
}

class _BgOrbPainter extends CustomPainter {
  final double t;
  _BgOrbPainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    final orbs = [
      _Orb(
        dx: 0.18 + math.sin(t * math.pi * 2) * 0.08,
        dy: 0.22 + math.cos(t * math.pi * 2) * 0.07,
        r: size.width * 0.38,
        color: VCColors.sageLight.withValues(alpha: 0.10),
      ),
      _Orb(
        dx: 0.82 + math.sin(t * math.pi * 2 + 2.1) * 0.09,
        dy: 0.60 + math.cos(t * math.pi * 2 + 2.1) * 0.08,
        r: size.width * 0.44,
        color: VCColors.blush.withValues(alpha: 0.09),
      ),
      _Orb(
        dx: 0.50 + math.sin(t * math.pi * 2 + 4.2) * 0.14,
        dy: 0.85 + math.cos(t * math.pi * 2 + 4.2) * 0.06,
        r: size.width * 0.32,
        color: VCColors.stone.withValues(alpha: 0.12),
      ),
    ];
    for (final o in orbs) {
      final center = Offset(size.width * o.dx, size.height * o.dy);
      canvas.drawCircle(
        center,
        o.r,
        Paint()
          ..shader = RadialGradient(colors: [
            o.color,
            o.color.withValues(alpha: 0),
          ]).createShader(Rect.fromCircle(center: center, radius: o.r)),
      );
    }
  }

  @override
  bool shouldRepaint(_BgOrbPainter old) => old.t != t;
}

class _Orb {
  final double dx, dy, r;
  final Color color;
  const _Orb({required this.dx, required this.dy, required this.r, required this.color});
}

// ─────────────────────────────────────────────────────────────────────────────
// FadeInWidget — fade + slide-up entrance for any child
// ─────────────────────────────────────────────────────────────────────────────
class FadeInWidget extends StatefulWidget {
  final Widget child;
  final Duration delay;
  final Duration duration;
  const FadeInWidget({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 420),
  });

  @override
  State<FadeInWidget> createState() => _FadeInWidgetState();
}

class _FadeInWidgetState extends State<FadeInWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _opacity;
  late Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration);
    _opacity = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut)
        .drive(Tween(begin: 0.0, end: 1.0));
    _slide = CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic)
        .drive(Tween(begin: const Offset(0, 0.06), end: Offset.zero));
    if (widget.delay == Duration.zero) {
      _ctrl.forward();
    } else {
      Future.delayed(widget.delay, () {
        if (mounted) _ctrl.forward();
      });
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: SlideTransition(position: _slide, child: widget.child),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated waveform bars — recording visual
// ─────────────────────────────────────────────────────────────────────────────
class WaveformBars extends StatefulWidget {
  final bool active;
  final Color color;
  final int bars;
  const WaveformBars({
    super.key,
    required this.active,
    this.color = VCColors.accentPrimary,
    this.bars = 32,
  });

  @override
  State<WaveformBars> createState() => _WaveformBarsState();
}

class _WaveformBarsState extends State<WaveformBars>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  final _rng = math.Random();

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 550),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 76,
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (_, __) {
          return Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: List.generate(widget.bars, (i) {
              final phase = (i / widget.bars) * math.pi * 2;
              final base = widget.active
                  ? (math.sin(_ctrl.value * math.pi * 2 + phase).abs() * 0.72 +
                      0.12 +
                      _rng.nextDouble() * 0.16)
                  : 0.05;
              final h = (base * 64).clamp(4.0, 64.0);
              final t = i / widget.bars;
              // Gradient color: sage → blush
              final color = Color.lerp(
                VCColors.accentPrimary,
                VCColors.accentSecondary,
                t,
              )!;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 80),
                width: 3.5,
                height: h,
                margin: const EdgeInsets.symmetric(horizontal: 1.8),
                decoration: BoxDecoration(
                  color: color.withValues(
                      alpha: widget.active ? 0.88 : 0.30),
                  borderRadius: BorderRadius.circular(3),
                ),
              );
            }),
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pill-style glass chip — language pickers / tabs
// ─────────────────────────────────────────────────────────────────────────────
class VCChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;

  const VCChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(999);
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: radius,
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 14, sigmaY: 14),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: selected
                    ? [
                        VCColors.accentPrimary,
                        VCColors.accentPrimary.withValues(alpha: 0.85),
                      ]
                    : [
                        Colors.white.withValues(alpha: 0.55),
                        Colors.white.withValues(alpha: 0.30),
                      ],
              ),
              border: Border.all(
                color: selected
                    ? VCColors.accentPrimary
                    : Colors.white.withValues(alpha: 0.6),
              ),
              borderRadius: radius,
              boxShadow: selected ? VCShadow.sm : null,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon,
                      size: 16,
                      color: selected ? Colors.white : VCColors.textSecondary),
                  const SizedBox(width: 6),
                ],
                Text(
                  label,
                  style: VCTextStyles.bodyMd.copyWith(
                    color: selected ? Colors.white : VCColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
