// Case details model — same structure as website's CaseDetailsForm
import 'package:flutter/foundation.dart';

class CaseDetails extends ChangeNotifier {
  String firNumber;
  String accusedName;
  String complainantName;
  String officerName;
  String badgeNumber;
  String stationName;
  String location;
  String sectionOfLaw;
  String incidentDate;
  String incidentTime;
  String motive;
  String description;

  CaseDetails({
    this.firNumber = '',
    this.accusedName = '',
    this.complainantName = '',
    this.officerName = '',
    this.badgeNumber = '',
    this.stationName = '',
    this.location = '',
    this.sectionOfLaw = '',
    this.incidentDate = '',
    this.incidentTime = '',
    this.motive = '',
    this.description = '',
  });

  void touch() => notifyListeners();

  Map<String, dynamic> toJson() => {
        'firNumber': firNumber,
        'accusedName': accusedName,
        'complainantName': complainantName,
        'officerName': officerName,
        'badgeNumber': badgeNumber,
        'stationName': stationName,
        'location': location,
        'sectionOfLaw': sectionOfLaw,
        'incidentDate': incidentDate,
        'incidentTime': incidentTime,
        'motive': motive,
        'description': description,
      };

  factory CaseDetails.fromJson(Map<String, dynamic> j) => CaseDetails(
        firNumber: j['firNumber'] ?? '',
        accusedName: j['accusedName'] ?? '',
        complainantName: j['complainantName'] ?? '',
        officerName: j['officerName'] ?? '',
        badgeNumber: j['badgeNumber'] ?? '',
        stationName: j['stationName'] ?? '',
        location: j['location'] ?? '',
        sectionOfLaw: j['sectionOfLaw'] ?? '',
        incidentDate: j['incidentDate'] ?? '',
        incidentTime: j['incidentTime'] ?? '',
        motive: j['motive'] ?? '',
        description: j['description'] ?? '',
      );

  bool get hasAny =>
      firNumber.isNotEmpty ||
      accusedName.isNotEmpty ||
      complainantName.isNotEmpty;
}

class TranscriptionResult {
  final String text;
  final String originalText;
  final String language;
  final String languageName;
  final String task;
  final double processingTime;
  final List<dynamic> segments;
  final List<dynamic>? originalSegments;
  final bool diarization;
  final int speakerCount;

  TranscriptionResult({
    required this.text,
    this.originalText = '',
    required this.language,
    required this.languageName,
    required this.task,
    required this.processingTime,
    required this.segments,
    this.originalSegments,
    required this.diarization,
    required this.speakerCount,
  });

  factory TranscriptionResult.fromJson(Map<String, dynamic> j) =>
      TranscriptionResult(
        text: j['text'] ?? '',
        originalText: j['original_text'] ?? '',
        language: j['language'] ?? '',
        languageName: j['language_name'] ?? '',
        task: j['task'] ?? 'transcribe',
        processingTime: (j['processing_time'] ?? 0).toDouble(),
        segments: List<dynamic>.from(j['segments'] ?? []),
        originalSegments: j['original_segments'] != null
            ? List<dynamic>.from(j['original_segments'])
            : null,
        diarization: j['diarization'] == true,
        speakerCount: j['speaker_count'] ?? 0,
      );
}
