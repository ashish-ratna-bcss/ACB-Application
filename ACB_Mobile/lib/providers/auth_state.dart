// AuthState — manages JWT token + logged-in user across the app.
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthState extends ChangeNotifier {
  static const _kToken    = 'cw_jwt_token';
  static const _kUsername = 'cw_username';
  static const _kRole     = 'cw_role';

  String? _token;
  String? _username;
  String? _role;
  bool _initialized = false;

  String? get token       => _token;
  String? get username    => _username;
  String? get role        => _role;
  bool   get isLoggedIn   => _token != null && _username != null;
  bool   get isInitialized => _initialized;

  /// Called once during splash — loads persisted token.
  Future<void> tryAutoLogin() async {
    final prefs = await SharedPreferences.getInstance();
    _token    = prefs.getString(_kToken);
    _username = prefs.getString(_kUsername);
    _role     = prefs.getString(_kRole);
    _initialized = true;
    notifyListeners();
  }

  Future<void> login(String token, String username, String role) async {
    _token    = token;
    _username = username;
    _role     = role;
    _initialized = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kToken,    token);
    await prefs.setString(_kUsername, username);
    await prefs.setString(_kRole,     role);
    notifyListeners();
  }

  Future<void> logout() async {
    _token    = null;
    _username = null;
    _role     = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_kToken);
    await prefs.remove(_kUsername);
    await prefs.remove(_kRole);
    notifyListeners();
  }
}
