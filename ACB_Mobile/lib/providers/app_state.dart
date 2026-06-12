// AppState — global provider holding transcription result + audio + processing.
import 'dart:io';
import 'package:flutter/foundation.dart';
import '../models/case_details.dart';
import '../services/api_service.dart';

class AppState extends ChangeNotifier {
  TranscriptionResult? _result;
  Map<String, dynamic>? _rawResult; // full API response for manual save
  String? _audioPath;
  bool _processing = false;
  bool _saving = false;
  String? _savedMongoId; // non-null once manually saved
  int _tabIndex = 0; // default to Record (index 0 after removing Case tab)
  String? _editedText; // non-null when user has edited the transcription text
  String _lastTargetLanguage = 'en';
  bool _refining = false;
  String? _refinedText; // non-null once Ollama has refined the text
  bool _extractingFir = false;

  // ─── Document (OCR) state ──────────────────────────────────────────────────
  bool _isDocumentMode = false;   // true when source is a PDF/image, not audio
  String? _documentPath;          // server-side path returned by /ocr-document
  String? _documentFilename;      // original file name for saving

  TranscriptionResult? get result => _result;
  String? get audioPath => _audioPath;
  bool get processing => _processing;
  bool get saving => _saving;
  bool get savedToArchive => _savedMongoId != null;
  int get tabIndex => _tabIndex;
  String? get editedText => _editedText;
  bool get textEdited => _editedText != null;
  String get lastTargetLanguage => _lastTargetLanguage;
  bool get refining => _refining;
  String? get refinedText => _refinedText;
  bool get extractingFir => _extractingFir;
  bool get isDocumentMode => _isDocumentMode;
  String? get documentPath => _documentPath;
  /// Non-null only when last result was a translation — returns the target language code.
  String? get targetLanguage => _rawResult?['target_language']?.toString();
  /// Original transcript text (before translation), if available.
  String? get originalText => _rawResult?['original_text']?.toString();

  void setTab(int i) {
    if (_tabIndex == i) return;
    _tabIndex = i;
    notifyListeners();
  }

  void setAudioPath(String? path) {
    _audioPath = path;
    notifyListeners();
  }

  void clearResult() {
    _result = null;
    _rawResult = null;
    _savedMongoId = null;
    _editedText = null;
    _refinedText = null;
    _isDocumentMode = false;
    _documentPath = null;
    _documentFilename = null;
    notifyListeners();
  }

  void setEditedText(String text) {
    _editedText = text.trim().isEmpty ? null : text;
    notifyListeners();
  }

  /// Calls backend and stores result; returns null on success or error message.
  Future<String?> transcribe({
    required File audioFile,
    required String language,
    required String task,
    String targetLanguage = 'en',
    bool diarize = false,
    int numSpeakers = 0,
    Map<String, dynamic> caseDetails = const {},
  }) async {
    _processing = true;
    notifyListeners();
    try {
      final json = await ApiService.transcribeAudio(
        audioFile: audioFile,
        language: language,
        task: task,
        targetLanguage: targetLanguage,
        diarize: diarize,
        numSpeakers: numSpeakers,
        caseDetails: caseDetails,
      );
      _savedMongoId = null;
      _editedText = null;
      _lastTargetLanguage = targetLanguage;
      _result = TranscriptionResult.fromJson(json);
      _rawResult = Map<String, dynamic>.from(json);
      _audioPath = audioFile.path;
      _tabIndex = 1; // jump to Result
      return null;
    } catch (e) {
      return e.toString();
    } finally {
      _processing = false;
      notifyListeners();
    }
  }

  /// Fast transcription using /transcribe-live (no diarization, no DB save).
  /// Used when live mode is ON and diarization is OFF — skips the full pipeline.
  Future<String?> transcribeLive({
    required File audioFile,
    required String language,
  }) async {
    _processing = true;
    notifyListeners();
    try {
      final json = await ApiService.transcribeLive(
        audioFile: audioFile,
        language: language,
      );
      _savedMongoId = null;
      _editedText = null;
      final full = <String, dynamic>{
        ...json,
        'task': 'transcribe',
        'segments': [],
        'diarization': false,
        'speaker_count': 0,
      };
      _result = TranscriptionResult.fromJson(full);
      _rawResult = full;
      _audioPath = audioFile.path;
      _tabIndex = 1; // jump to Result
      return null;
    } catch (e) {
      return e.toString();
    } finally {
      _processing = false;
      notifyListeners();
    }
  }

  /// Sends a petition document (PDF/image) to /ocr-document and stores the extracted text.
  /// Same pipeline as audio: result lands in ResultScreen, translation/FIR extraction all work.
  Future<String?> ocrExtract({
    required File documentFile,
    String language = 'auto',
  }) async {
    _processing = true;
    notifyListeners();
    try {
      final json = await ApiService.ocrDocument(
        documentFile: documentFile,
        language: language,
      );
      if (json['success'] != true || (json['text'] ?? '').toString().trim().isEmpty) {
        return 'No text could be extracted. Check image quality.';
      }
      _savedMongoId = null;
      _editedText = null;
      _refinedText = null;
      _isDocumentMode = true;
      _documentPath = json['document_path']?.toString();
      _documentFilename = documentFile.path.split('/').last;

      final detectedLang = (json['detected_language']?.toString() ?? 'auto');
      final ocrRaw = <String, dynamic>{
        'success': true,
        'text': json['text'],
        'original_text': '',
        'task': 'transcribe',
        'language': detectedLang,
        'language_name': 'Document (OCR)',
        'segments': [
          {'id': 0, 'start': 0.0, 'end': 0.0, 'text': json['text']}
        ],
        'diarization': false,
        'speaker_count': 0,
        'processing_time': json['processing_time'] ?? 0,
        'audio_path': null,
        'document_path': _documentPath,
        'source_type': 'document',
      };
      _result = TranscriptionResult.fromJson(ocrRaw);
      _rawResult = ocrRaw;
      _audioPath = null;
      _tabIndex = 1; // jump to Result
      return null;
    } catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    } finally {
      _processing = false;
      notifyListeners();
    }
  }

  /// Translates the current result's text (or user-edited override) without re-processing audio.
  /// If the result is already translated, always falls back to the ORIGINAL transcript so
  /// switching target languages or retrying a failed translation never compounds errors.
  Future<String?> translateText({required String targetLanguage}) async {
    if (_result == null) return 'No result to translate';
    final isAlreadyTranslated = _result!.task == 'translate';
    final sourceText = _editedText ??
        (isAlreadyTranslated
            ? (_rawResult?['original_text']?.toString() ?? _result!.text)
            : _result!.text);
    // Fall back to 'auto' so the backend detects the language from the text itself
    // (e.g. auto-detect transcripts) — we never re-process the audio for translation.
    final sourceLang =
        (_result!.language.isEmpty) ? 'auto' : _result!.language;
    _processing = true;
    notifyListeners();
    try {
      final json = await ApiService.translateText(
        text: sourceText,
        sourceLanguage: sourceLang,
        targetLanguage: targetLanguage,
      );
      if (json['success'] == true) {
        final translatedText = json['translated_text']?.toString() ?? '';
        final processingTime = (json['processing_time'] ?? 0).toDouble();
        _rawResult = {
          ..._rawResult ?? {},
          'task': 'translate',
          'text': translatedText,
          'original_text': sourceText,
          'target_language': targetLanguage,
          'processing_time': processingTime,
          'segments': [
            {'id': 0, 'start': 0.0, 'end': 0.0, 'text': translatedText}
          ],
          'original_segments': null,
        };
        _result = TranscriptionResult.fromJson(_rawResult!);
        _editedText = null;
        _lastTargetLanguage = targetLanguage;
        _savedMongoId = null;
      } else {
        return json['detail']?.toString() ?? 'Translation failed';
      }
      return null;
    } catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    } finally {
      _processing = false;
      notifyListeners();
    }
  }

  /// Auto-extracts 5W-1H FIR fields from a transcript or translation using Ollama.
  /// [textOverride] — pass explicit text (e.g. original transcript or translation).
  /// [langOverride] — pass the language code that matches textOverride.
  /// When omitted, falls back to current displayed text + auto-detected language.
  /// Returns the extracted map on success, or null on error.
  Future<Map<String, String>?> extractFirDetails({
    String? textOverride,
    String? langOverride,
  }) async {
    if (_result == null && textOverride == null) return null;
    final sourceText = textOverride ?? _editedText ?? _result!.text;
    if (sourceText.trim().isEmpty) return null;
    // Choose effective language: override → target lang (if translated) → source lang
    final effectiveLang = langOverride ??
        ((_result?.task == 'translate')
            ? (_rawResult?['target_language']?.toString() ?? 'en')
            : (_result?.language ?? 'en'));
    _extractingFir = true;
    notifyListeners();
    try {
      final json = await ApiService.extractFirDetails(
        text: sourceText,
        language: effectiveLang,
      );
      if (json['success'] == true && json['extracted'] is Map) {
        final ex = Map<String, dynamic>.from(json['extracted'] as Map);
        return ex.map((k, v) => MapEntry(k, (v ?? '').toString()));
      }
      return null;
    } catch (_) {
      return null;
    } finally {
      _extractingFir = false;
      notifyListeners();
    }
  }

  void dismissRefinedText() {
    _refinedText = null;
    notifyListeners();
  }

  /// Sends current text to Ollama for grammar/phrasing improvement only.
  /// Original transcript is preserved; refined version is shown separately.
  Future<String?> refineText() async {
    if (_result == null) return 'No result to refine';
    final sourceText = _editedText ?? _result!.text;
    // For translated results, refine in the target language, not the source
    final effectiveLang = (_result!.task == 'translate')
        ? (_rawResult?['target_language']?.toString() ?? 'en')
        : _result!.language;
    _refining = true;
    notifyListeners();
    try {
      final json = await ApiService.refineText(
        text: sourceText,
        language: effectiveLang,
      );
      if (json['success'] == true) {
        _refinedText = json['refined_text']?.toString() ?? '';
      } else {
        return json['detail']?.toString() ?? 'Refine failed';
      }
      return null;
    } catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    } finally {
      _refining = false;
      notifyListeners();
    }
  }

  /// Manually saves the current result to the server Archive.
  /// Returns null on success or an error message.
  Future<String?> saveToArchive(Map<String, dynamic> caseDetails) async {
    if (_result == null || _rawResult == null) return 'No result to save';
    _saving = true;
    notifyListeners();
    try {
      final payload = {
        ..._rawResult!,
        'case_details': caseDetails,
        'filename': _isDocumentMode
            ? (_documentFilename ?? '')
            : (_audioPath?.split('/').last ?? ''),
        'audio_path': _isDocumentMode ? null : _rawResult!['audio_path'],
        'document_path': _isDocumentMode ? _documentPath : null,
        'source_type': _isDocumentMode ? 'document' : 'audio',
      };
      // Remove success/mongo_id from API response before re-saving
      payload.remove('success');
      payload.remove('mongo_id');
      _savedMongoId = await ApiService.saveTranscription(payload);
      return null;
    } catch (e) {
      return e.toString().replaceFirst('Exception: ', '');
    } finally {
      _saving = false;
      notifyListeners();
    }
  }
}
