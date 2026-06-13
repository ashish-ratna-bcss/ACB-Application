// CopWriter Mobile — entry point
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'theme/app_theme.dart';
import 'screens/splash_screen.dart';
import 'models/case_details.dart';
import 'providers/app_state.dart';
import 'providers/auth_state.dart';
import 'services/api_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Migrate old wrong base URL to the correct domain
  final prefs = await SharedPreferences.getInstance();
  final saved = prefs.getString('copwriter_api_base');
  if (saved != null && saved.contains('copwriter.in') && !saved.contains('ai-copwriter.in')) {
    await prefs.setString('copwriter_api_base', ApiService.defaultBaseUrl);
  }
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    systemNavigationBarColor: VCColors.ivory,
    systemNavigationBarIconBrightness: Brightness.dark,
  ));
  runApp(const CopWriterApp());
}

class CopWriterApp extends StatelessWidget {
  const CopWriterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthState()),
        ChangeNotifierProvider(create: (_) => CaseDetails()),
        ChangeNotifierProvider(create: (_) => AppState()),
      ],
      child: MaterialApp(
        title: 'ACB',
        debugShowCheckedModeBanner: false,
        theme: buildCopWriterTheme(),
        home: const SplashScreen(),
      ),
    );
  }
}
