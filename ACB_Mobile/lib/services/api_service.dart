// API Service — Dio client for the VoiceCop backend.
// Reuses /health, /languages, /transcribe, /transcriptions (same endpoints as the web app).

import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String defaultBaseUrl = 'https://ai-copwriter.in/api';
  static const String _kBaseUrlPref = 'copwriter_api_base';

  static const String _kToken = 'cw_jwt_token';

  static void log(String message) {
    print('🛡️ [CopWriter API] $message');
  }

  /// Returns Dio Options with Authorization header if a token is stored.
  static Future<Options> _authOptions({String? contentType}) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_kToken);
    final headers = <String, dynamic>{};
    if (token != null) headers['Authorization'] = 'Bearer $token';
    return Options(
      headers: headers.isEmpty ? null : headers,
      contentType: contentType,
    );
  }

  // ── Auth ───────────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> login(
      String username, String password) async {
    final base = await getBaseUrl();
    log('Logging in → $username');
    try {
      final res = await _dio.post(
        '$base/auth/login',
        data: 'username=${Uri.encodeComponent(username)}'
            '&password=${Uri.encodeComponent(password)}',
        options: Options(contentType: 'application/x-www-form-urlencoded'),
      );
      log('Login OK → ${res.data['username']} (${res.data['role']})');
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      log('Login Failed → ${e.response?.statusCode}');
      final body = e.response?.data;
      final detail = (body is Map && body['detail'] != null)
          ? body['detail'].toString()
          : 'Login failed (${e.response?.statusCode ?? e.type.name})';
      throw Exception(detail);
    }
  }

  static final Dio _dio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 60),
      receiveTimeout: const Duration(minutes: 5),
      sendTimeout: const Duration(minutes: 5),
      responseType: ResponseType.json,
    ),
  );

  static Future<String> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final url = prefs.getString(_kBaseUrlPref) ?? defaultBaseUrl;

    log('Base URL Loaded → $url');

    return url;
  }

  static Future<void> setBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kBaseUrlPref, url.trim());

    log('Base URL Updated → $url');
  }

  // ─────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> checkHealth() async {
    final base = await getBaseUrl();

    log('Checking Server Health...');

    final res = await _dio.get('$base/health');

    log('Health Response → ${res.statusCode}');

    return Map<String, dynamic>.from(res.data as Map);
  }

  static Future<List<Map<String, dynamic>>> getLanguages() async {
    final base = await getBaseUrl();

    log('Fetching Languages...');

    final res = await _dio.get('$base/languages');

    log('Languages Loaded Successfully');

    final data = Map<String, dynamic>.from(res.data as Map);

    return List<Map<String, dynamic>>.from(data['languages'] as List);
  }

  // ─────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> getTranscriptions(
      {String search = ''}) async {
    final base = await getBaseUrl();

    log('Fetching Transcriptions → search="$search"');

    try {
      final res = await _dio.get(
        '$base/transcriptions',
        queryParameters: search.trim().isNotEmpty ? {'search': search} : null,
        options: await _authOptions(),
      );

      log('Transcriptions Loaded → ${(res.data as Map)['total']} records');

      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      log('Fetch Failed → ${e.response?.statusCode} ${e.message}');

      final body = e.response?.data;
      String detail =
          'Server error: ${e.response?.statusCode ?? e.type.name}';
      if (body is Map && body['detail'] != null) {
        detail = body['detail'].toString();
      }
      throw Exception(detail);
    }
  }

  static Future<Map<String, dynamic>> updateTranscription(
      String id, Map<String, dynamic> fields) async {
    final base = await getBaseUrl();

    log('Updating Transcription → $id');

    try {
      final res = await _dio.patch(
        '$base/transcriptions/$id',
        data: fields,
        options: await _authOptions(contentType: 'application/json'),
      );

      log('Update OK → $id');

      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      log('Update Failed → ${e.response?.statusCode} ${e.message}');

      final body = e.response?.data;
      String detail =
          'Server error: ${e.response?.statusCode ?? e.type.name}';
      if (body is Map && body['detail'] != null) {
        detail = body['detail'].toString();
      }
      throw Exception(detail);
    }
  }

  static Future<String> saveTranscription(Map<String, dynamic> data) async {
    final base = await getBaseUrl();

    log('Saving Transcription to Archive…');

    try {
      final res = await _dio.post(
        '$base/transcriptions',
        data: data,
        options: await _authOptions(contentType: 'application/json'),
      );

      log('Saved to Archive → ${res.data['mongo_id']}');

      return (res.data['mongo_id'] ?? '').toString();
    } on DioException catch (e) {
      log('Save Failed → ${e.response?.statusCode} ${e.message}');

      final body = e.response?.data;
      String detail =
          'Server error: ${e.response?.statusCode ?? e.type.name}';
      if (body is Map && body['detail'] != null) {
        detail = body['detail'].toString();
      }
      throw Exception(detail);
    }
  }

  static Future<void> deleteTranscription(String id) async {
    final base = await getBaseUrl();

    log('Deleting Transcription → $id');

    try {
      await _dio.delete(
        '$base/transcriptions/$id',
        options: await _authOptions(),
      );

      log('Delete OK → $id');
    } on DioException catch (e) {
      log('Delete Failed → ${e.response?.statusCode} ${e.message}');

      final body = e.response?.data;
      String detail =
          'Server error: ${e.response?.statusCode ?? e.type.name}';
      if (body is Map && body['detail'] != null) {
        detail = body['detail'].toString();
      }
      throw Exception(detail);
    }
  }

  // ─────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> transcribeLive({
    required File audioFile,
    String language = 'auto',
  }) async {
    final base = await getBaseUrl();
    log('Live Transcription → ${audioFile.path.split('/').last}');
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        audioFile.path,
        filename: audioFile.path.split('/').last,
      ),
    });
    try {
      final res = await _dio.post(
        '$base/transcribe-live',
        data: form,
        queryParameters: {'language': language},
        options: await _authOptions(contentType: 'multipart/form-data'),
      );
      log('Live Transcription OK');
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      log('Live Transcription Failed → ${e.message}');
      final body = e.response?.data;
      String detail =
          'Server error: ${e.response?.statusCode ?? e.type.name}';
      if (body is Map && body['detail'] != null) {
        detail = body['detail'].toString();
      }
      throw Exception(detail);
    }
  }

  // ─────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> extractFirDetails({
    required String text,
    String language = 'en',
  }) async {
    final base = await getBaseUrl();
    log('Extracting FIR Details → language=$language');
    try {
      final res = await _dio.post(
        '$base/extract-fir-details',
        data: {'text': text, 'language': language},
        options: await _authOptions(contentType: 'application/json'),
      );
      log('Extract OK');
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      log('Extract Failed → ${e.message}');
      final body = e.response?.data;
      String detail = 'Server error: ${e.response?.statusCode ?? e.type.name}';
      if (body is Map && body['detail'] != null) {
        detail = body['detail'].toString();
      }
      throw Exception(detail);
    }
  }

  static Future<Map<String, dynamic>> refineText({
    required String text,
    String language = 'en',
  }) async {
    final base = await getBaseUrl();
    log('Refining Text → language=$language');
    try {
      final res = await _dio.post(
        '$base/refine-text',
        data: {'text': text, 'language': language},
        options: await _authOptions(contentType: 'application/json'),
      );
      log('Refine OK');
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      log('Refine Failed → ${e.message}');
      final body = e.response?.data;
      String detail = 'Server error: ${e.response?.statusCode ?? e.type.name}';
      if (body is Map && body['detail'] != null) {
        detail = body['detail'].toString();
      }
      throw Exception(detail);
    }
  }

  static Future<Map<String, dynamic>> translateText({
    required String text,
    required String sourceLanguage,
    required String targetLanguage,
  }) async {
    final base = await getBaseUrl();
    log('Translating Text → $sourceLanguage → $targetLanguage');
    try {
      final res = await _dio.post(
        '$base/translate-text',
        data: {
          'text': text,
          'source_language': sourceLanguage,
          'target_language': targetLanguage,
        },
        options: await _authOptions(contentType: 'application/json'),
      );
      log('Translation OK');
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      log('Translation Failed → ${e.message}');
      final body = e.response?.data;
      String detail = 'Server error: ${e.response?.statusCode ?? e.type.name}';
      if (body is Map && body['detail'] != null) {
        detail = body['detail'].toString();
      }
      throw Exception(detail);
    }
  }

  // ─────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> ocrDocument({
    required File documentFile,
    String language = 'auto',
  }) async {
    final base = await getBaseUrl();
    log('OCR Document → ${documentFile.path.split('/').last} lang=$language');

    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        documentFile.path,
        filename: documentFile.path.split('/').last,
      ),
    });

    try {
      final res = await _dio.post(
        '$base/ocr-document',
        data: form,
        queryParameters: {'language': language},
        options: await _authOptions(contentType: 'multipart/form-data'),
      );
      log('OCR Complete → ${res.data['detected_language']}');
      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      log('OCR Failed → ${e.response?.statusCode} ${e.message}');
      final body = e.response?.data;
      String detail = 'OCR failed: ${e.response?.statusCode ?? e.type.name}';
      if (body is Map && body['detail'] != null) {
        detail = body['detail'].toString();
      }
      throw Exception(detail);
    }
  }

  static Future<Map<String, dynamic>> transcribeAudio({
    required File audioFile,
    String language = 'auto',
    String task = 'transcribe',
    String targetLanguage = 'en',
    bool diarize = false,
    int numSpeakers = 0,
    Map<String, dynamic> caseDetails = const {},
  }) async {
    final base = await getBaseUrl();

    log('Uploading Audio → ${audioFile.path.split('/').last}');
    log('Language → $language');
    log('Task → $task');

    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        audioFile.path,
        filename: audioFile.path.split('/').last,
      ),
      'case_details': jsonEncode(caseDetails),
    });

    try {
      final res = await _dio.post(
        '$base/transcribe',
        data: form,
        queryParameters: {
          'language': language,
          'task': task,
          'target_language': targetLanguage,
          'diarize': diarize,
          'num_speakers': numSpeakers,
          'save': false, // mobile: user manually saves to Archive
        },
          options: await _authOptions(contentType: 'multipart/form-data'),
      );

      log('Transcription Completed Successfully');

      return Map<String, dynamic>.from(res.data as Map);
    } on DioException catch (e) {
      log('Transcription Failed → ${e.message}');

      String detail = 'Server error: ${e.response?.statusCode ?? e.type.name}';

      final body = e.response?.data;

      if (body is Map && body['detail'] != null) {
        detail = body['detail'].toString();
      } else if (body is String && body.isNotEmpty) {
        detail = body;
      }

      throw Exception(detail);
    }
  }
}
