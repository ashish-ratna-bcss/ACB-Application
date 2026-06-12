// HomeShell — bottom-nav scaffold (Case · Record · Result · Records)
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:voicecop/screens/currency_note_scanning_screen.dart';


import '../theme/app_theme.dart';
import '../widgets/common_widgets.dart';
import '../providers/app_state.dart';
import '../providers/auth_state.dart';
import 'recorder_screen.dart';
import 'login_screen.dart';
import 'result_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  // All pages kept alive in a Stack — state is preserved when switching tabs.

  
  static const _pages = <Widget>[
    RecorderScreen(),
    ResultScreen(),
    CurrencyNoteScanningScreen(),
  ];

  static const _navItems = [
    _NavItem(Icons.mic_outlined, Icons.mic, 'Record'),
    _NavItem(Icons.article_outlined, Icons.article, 'Result'),
     _NavItem(Icons.currency_rupee, Icons.currency_rupee, 'Scan'),
  ];

  @override
  Widget build(BuildContext context) {
    final index = context.watch<AppState>().tabIndex;
    return AppBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        extendBody: true,
        appBar: _buildAppBar(),
        body: SafeArea(
          child: Stack(
            fit: StackFit.expand,
            children: List.generate(_pages.length, (i) {
              final active = i == index;
              return AnimatedOpacity(
                duration: const Duration(milliseconds: 260),
                curve: Curves.easeInOut,
                opacity: active ? 1.0 : 0.0,
                child: AnimatedSlide(
                  duration: const Duration(milliseconds: 260),
                  curve: Curves.easeOutCubic,
                  offset: active ? Offset.zero : const Offset(0, 0.025),
                  child: IgnorePointer(
                    ignoring: !active,
                    child: _pages[i],
                  ),
                ),
              );
            }),
          ),
        ),
        bottomNavigationBar: _buildBottomBar(index),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    final auth = context.watch<AuthState>();
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      titleSpacing: 18,
      title: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: const BoxDecoration(
              gradient: VCColors.gradientMain,
              borderRadius: VCRadius.md,
              boxShadow: VCShadow.sm,
            ),
            child: const Icon(Icons.shield_outlined,
                color: Colors.white, size: 22),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'ACB',
                  style: VCTextStyles.headingLg,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  'Investigation Platform',
                  style: VCTextStyles.bodySm.copyWith(fontSize: 11),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        if (auth.username != null)
          Container(
            margin: const EdgeInsets.only(right: 4),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: VCColors.accentPrimary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                  color: VCColors.accentPrimary.withValues(alpha: 0.25)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.person_outline,
                    size: 13, color: VCColors.accentPrimary),
                const SizedBox(width: 5),
                Text(
                  auth.username!,
                  style: VCTextStyles.bodySm.copyWith(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: VCColors.accentPrimary,
                  ),
                ),
              ],
            ),
          ),
        IconButton(
          icon: const Icon(Icons.logout, size: 18, color: VCColors.textMuted),
          tooltip: 'Logout',
          onPressed: () async {
            final auth = context.read<AuthState>();
            final nav  = Navigator.of(context);
            await auth.logout();
            nav.pushAndRemoveUntil(
              PageRouteBuilder(
                pageBuilder: (_, __, ___) => const LoginScreen(),
                transitionsBuilder: (_, anim, __, child) =>
                    FadeTransition(opacity: anim, child: child),
                transitionDuration: const Duration(milliseconds: 350),
              ),
              (_) => false,
            );
          },
        ),
        const SizedBox(width: 6),
      ],
    );
  }

  Widget _buildBottomBar(int index) {
    final radius = BorderRadius.circular(28);
    
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 0, 14, 14),
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: VCShadow.md,
      ),
      child: ClipRRect(
        borderRadius: radius,
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 28, sigmaY: 28),
          child: Container(
            decoration: BoxDecoration(
              borderRadius: radius,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Colors.white.withValues(alpha: 0.68),
                  VCColors.ivory.withValues(alpha: 0.48),
                ],
              ),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.58),
                width: 1,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
              child: LayoutBuilder(
                builder: (ctx, constraints) {
                  final itemW = constraints.maxWidth / _navItems.length;
                  return Stack(
                    children: [
                      // ── Sliding selection pill ──────────────────
                      AnimatedPositioned(
                        duration: const Duration(milliseconds: 320),
                        curve: Curves.easeInOutCubic,
                        left: index * itemW + 5,
                        top: 4,
                        bottom: 4,
                        width: itemW - 10,
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                VCColors.accentPrimary,
                                Color(0xFF576048),
                              ],
                            ),
                            borderRadius: BorderRadius.circular(18),
                            boxShadow: [
                              BoxShadow(
                                color: VCColors.accentPrimary
                                    .withValues(alpha: 0.38),
                                blurRadius: 14,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                        ),
                      ),
                      // ── Nav item row ────────────────────────────
                      Row(
                        children: List.generate(_navItems.length, (i) {
                          return _buildNavItem(
                            index: index,
                            idx: i,
                            item: _navItems[i],
                            width: itemW,
                          );
                        }),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required int index,
    required int idx,
    required _NavItem item,
    required double width,
  }) {
    final selected = index == idx;
    return SizedBox(
      width: width,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => context.read<AppState>().setTab(idx),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Icon with scale switch animation
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 220),
                switchInCurve: Curves.easeOutBack,
                switchOutCurve: Curves.easeIn,
                transitionBuilder: (child, anim) => ScaleTransition(
                  scale: anim,
                  child: child,
                ),
                child: Icon(
                  selected ? item.activeIcon : item.icon,
                  key: ValueKey('${idx}_$selected'),
                  color: selected ? Colors.white : VCColors.textMuted,
                  size: selected ? 23 : 21,
                ),
              ),
              const SizedBox(height: 3),
              // Label with animated style
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 220),
                style: VCTextStyles.bodySm.copyWith(
                  fontSize: 10,
                  fontWeight:
                      selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? Colors.white : VCColors.textMuted,
                ),
                child: Text(item.label),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const _NavItem(this.icon, this.activeIcon, this.label);
}
