// VoiceCop Theme — matches website design system exactly
// Palette: #F6D8C6 (blush) · #D2DDBF (sage) · #E5E1DA (stone) · #FBF9F7 (ivory)

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class VCColors {
  // Primary palette
  static const blush = Color(0xFFF6D8C6);
  static const blushLight = Color(0xFFFAE9DF);
  static const blushDark = Color(0xFFC89D84);
  static const sage = Color(0xFFD2DDBF);
  static const sageLight = Color(0xFFE7EDDB);
  static const sageDark = Color(0xFFA9B592);
  static const stone = Color(0xFFE5E1DA);
  static const ivory = Color(0xFFFBF9F7);

  // Backgrounds
  static const bgPrimary = Color(0xFFFBF9F7);
  static const bgSecondary = Color(0xFFF3EEE8);

  // Text
  static const textPrimary = Color(0xFF2F2A26);
  static const textSecondary = Color(0xFF5D5650);
  static const textMuted = Color(0xFF8B8279);

  // Accents
  static const accentPrimary = Color(0xFF6D7358); // sage-dark official
  static const accentSecondary = Color(0xFFC39C84); // blush-dark warm
  static const accentRed = Color(0xFFB91C1C);
  static const accentGreen = Color(0xFF73845A);
  static const accentAmber = Color(0xFFB5875C);

  // Borders
  static const border = Color(0x1F5F5750);
  static const borderActive = Color(0x4D6D7358);

  // Glass card
  static Color cardBg = ivory.withValues(alpha: 0.74);
  static Color cardBgHover = ivory.withValues(alpha: 0.88);
  static Color glassBg = ivory.withValues(alpha: 0.68);

  // Gradients
  static const gradientMain = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [accentPrimary, accentSecondary],
  );

  static const gradientRed = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFDC2626), Color(0xFFB91C1C)],
  );
}

class VCTextStyles {
  // Poppins from google_fonts (matches website)
  static TextStyle get displayLarge => GoogleFonts.playfairDisplay(
        fontSize: 32,
        fontWeight: FontWeight.w800,
        color: VCColors.textPrimary,
        letterSpacing: -0.5,
      );

  static TextStyle get headingLg => GoogleFonts.playfairDisplay(
        fontSize: 22,
        fontWeight: FontWeight.w700,
        color: VCColors.textPrimary,
      );

  static TextStyle get headingMd => GoogleFonts.poppins(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: VCColors.textPrimary,
      );

  static TextStyle get bodyLg => GoogleFonts.poppins(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: VCColors.textPrimary,
        height: 1.6,
      );

  static TextStyle get bodyMd => GoogleFonts.poppins(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: VCColors.textSecondary,
        height: 1.5,
      );

  static TextStyle get bodySm => GoogleFonts.poppins(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        color: VCColors.textMuted,
      );

  static TextStyle get button => GoogleFonts.poppins(
        fontSize: 15,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.2,
      );

  static TextStyle get label => GoogleFonts.poppins(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: VCColors.textSecondary,
      );
}

class VCRadius {
  static const sm = BorderRadius.all(Radius.circular(8));
  static const md = BorderRadius.all(Radius.circular(12));
  static const lg = BorderRadius.all(Radius.circular(16));
  static const xl = BorderRadius.all(Radius.circular(24));
}

class VCShadow {
  static const sm = [
    BoxShadow(color: Color(0x10584A43), blurRadius: 14, offset: Offset(0, 4)),
  ];
  static const md = [
    BoxShadow(color: Color(0x14584A43), blurRadius: 42, offset: Offset(0, 18)),
    BoxShadow(color: Color(0x0A584A43), blurRadius: 18, offset: Offset(0, 6)),
  ];
}

ThemeData buildCopWriterTheme() {
  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: VCColors.bgPrimary,
    colorScheme: const ColorScheme.light(
      primary: VCColors.accentPrimary,
      secondary: VCColors.accentSecondary,
      surface: VCColors.ivory,
      error: VCColors.accentRed,
      onPrimary: Colors.white,
      onSecondary: Colors.white,
      onSurface: VCColors.textPrimary,
    ),
    textTheme: GoogleFonts.poppinsTextTheme().apply(
      bodyColor: VCColors.textPrimary,
      displayColor: VCColors.textPrimary,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: VCColors.ivory.withValues(alpha: 0.85),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: VCRadius.md,
        borderSide: const BorderSide(color: VCColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: VCRadius.md,
        borderSide: const BorderSide(color: VCColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: VCRadius.md,
        borderSide: const BorderSide(color: VCColors.accentPrimary, width: 1.5),
      ),
      labelStyle: VCTextStyles.label,
      hintStyle: VCTextStyles.bodyMd.copyWith(color: VCColors.textMuted),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: VCColors.accentPrimary,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: VCRadius.md),
        textStyle: VCTextStyles.button,
      ),
    ),
  );
}
