'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Languages,
  Loader2,
  Mic,
  Pause,
  Play,
  Radio,
  Save,
  Square,
  UploadCloud,
  Users,
  Video,
} from 'lucide-react';
import { BACKEND_URL } from '@/lib/config';
import CaseSearchSelect from '@/components/CaseSearchSelect';

type Language = {
  code: string;
  name: string;
};

type Segment = {
  id?: string | number;
  start?: number;
  end?: number;
  text: string;
  speaker?: string;
  original_text?: string;
};

type SpeechResult = {
  success: boolean;
  text: string;
  original_text?: string;
  segments?: Segment[];
  original_segments?: Segment[];
  language?: string;
  language_name?: string;
  target_language?: string;
  target_language_name?: string;
  task?: 'transcribe' | 'translate';
  processing_time?: number;
  diarization?: boolean;
  speaker_count?: number;
  diarization_warning?: string;
};

const DEFAULT_LANGUAGES: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'te', name: 'Telugu' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'bn', name: 'Bengali' },
  { code: 'mr', name: 'Marathi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'kn', name: 'Kannada' },
  { code: 'or', name: 'Odia' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'pa', name: 'Punjabi' },
];

const API_BASE = `${BACKEND_URL}/stt`;

function formatTime(value?: number) {
  if (typeof value !== 'number') return '00:00';
  const minutes = Math.floor(value / 60).toString().padStart(2, '0');
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

// Build a true native .docx using the `docx` library and trigger a download.
// Opens in Word / Google Docs / Pages and is fully editable.
async function downloadWord(segments: Segment[], result: SpeechResult) {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle,
  } = await import('docx');

  // Latin uses Calibri; the `cs` (complex-script) slot routes Indic characters
  // — Telugu, Hindi/Devanagari, Tamil, etc. — to an Indic-capable font so they
  // render correctly instead of as garbage. The renderer picks per character.
  const FONT = { ascii: 'Calibri', hAnsi: 'Calibri', cs: 'Nirmala UI' } as const;
  type RunOpts = { bold?: boolean; italics?: boolean; color?: string; size?: number };
  const run = (text: string, opts: RunOpts = {}) => new TextRun({ text, font: FONT, ...opts });

  const isTranslate = result.task === 'translate';
  const title = isTranslate ? 'Speech Translation' : 'Speech Transcript';

  const meta: string[] = [];
  if (result.language_name) meta.push(`Source language: ${result.language_name}`);
  if (isTranslate && result.target_language_name) meta.push(`Target language: ${result.target_language_name}`);
  if (typeof result.speaker_count === 'number') meta.push(`Speakers: ${result.speaker_count}`);
  meta.push(`Generated: ${new Date().toLocaleString()}`);

  const ACCENT = '2563EB';
  const cellBorders = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  const rows = segments.map(s => new TableRow({
    children: [
      new TableCell({
        width: { size: 28, type: WidthType.PERCENTAGE },
        borders: cellBorders,
        children: [
          new Paragraph({ children: [run(s.speaker || 'Unknown', { bold: true })] }),
          new Paragraph({
            children: [run(`${formatTime(s.start)} – ${formatTime(s.end)}`, { size: 18, color: '888888' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 72, type: WidthType.PERCENTAGE },
        borders: cellBorders,
        children: [
          ...(s.original_text
            ? [new Paragraph({ children: [run(s.original_text, { italics: true, color: '666666' })] })]
            : []),
          new Paragraph({ children: [run(s.text)] }),
        ],
      }),
    ],
  }));

  const heading = (text: string) => new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 360, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 2 } },
    children: [run(text, { color: ACCENT, bold: true })],
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.LEFT,
          children: [run(title, { bold: true })],
        }),
        new Paragraph({
          spacing: { after: 240 },
          children: [run(meta.join('   •   '), { color: '666666', size: 20 })],
        }),
        heading('Speaker-Separated Transcript'),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
        heading('Full Text'),
        ...(result.text || '').split('\n').map(line =>
          new Paragraph({ spacing: { after: 80 }, children: [run(line)] })
        ),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${isTranslate ? 'translation' : 'transcript'}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

async function readApiError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.detail || data?.error || `Request failed with status ${response.status}`;
}

export default function SpeechPage() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [cases, setCases] = useState<{ id: string; caseNumber: string; title: string }[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [audioDescription, setAudioDescription] = useState('');
  const [languages, setLanguages] = useState<Language[]>(DEFAULT_LANGUAGES);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [task, setTask] = useState<'transcribe' | 'translate'>('transcribe');
  const [diarize, setDiarize] = useState(false);
  const [speakerCount, setSpeakerCount] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [result, setResult] = useState<SpeechResult | null>(null);
  const [editedSegments, setEditedSegments] = useState<Segment[]>([]);
  const [diaLang, setDiaLang] = useState<'raw' | 'english'>('raw');
  const [speakerNames, setSpeakerNames] = useState<string[]>([]);
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [liveResult, setLiveResult] = useState<SpeechResult | null>(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [duration, setDuration] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingUrlRef = useRef('');
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveBusyRef = useRef(false);

  const stopTimers = useCallback(() => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (liveTimerRef.current) clearInterval(liveTimerRef.current);
    durationTimerRef.current = null;
    liveTimerRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // officer → local self-hosted model; admin → sarvam cloud API
  const provider = userRole === 'admin' ? 'sarvam' : 'local';

  const callSpeechApi = useCallback(
    async (endpoint: 'transcribe' | 'transcribe-live', blob: Blob, filename: string) => {
      const formData = new FormData();
      formData.append('file', new File([blob], filename, { type: blob.type || 'application/octet-stream' }));

      const params = new URLSearchParams({
        language: sourceLanguage,
        task,
        target_language: targetLanguage,
        provider,
      });

      if (endpoint === 'transcribe') {
        params.set('diarize', diarize ? 'true' : 'false');
        params.set('num_speakers', String(speakerCount));
      }

      const response = await fetch(`${API_BASE}/${endpoint}?${params.toString()}`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(await readApiError(response));
      return response.json() as Promise<SpeechResult>;
    },
    [diarize, provider, sourceLanguage, speakerCount, targetLanguage, task],
  );

  const runLivePreview = useCallback(async () => {
    if (!liveEnabled || liveBusyRef.current || chunksRef.current.length === 0) return;
    liveBusyRef.current = true;
    try {
      const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
      if (blob.size > 1000) {
        const data = await callSpeechApi('transcribe-live', blob, 'live.webm');
        if (data.text) setLiveResult(data);
      }
    } catch {
      // Live preview should stay quiet; the final processing path reports full errors.
    } finally {
      liveBusyRef.current = false;
    }
  }, [callSpeechApi, liveEnabled]);

  useEffect(() => {
    recordingUrlRef.current = recordingUrl;
  }, [recordingUrl]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => { if (data?.role) setUserRole(data.role); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/cases")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setCases(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkBackend() {
      try {
        const response = await fetch(`${API_BASE}/health?provider=${provider}`, { cache: 'no-store' });
        const data = await response.json();
        if (cancelled) return;
        if (response.ok) {
          setBackendStatus('online');
          if (Array.isArray(data.available_languages)) setLanguages(data.available_languages);
        } else {
          setBackendStatus('offline');
          setError(data.detail || 'Speech service is unavailable.');
        }
      } catch {
        if (!cancelled) setBackendStatus('offline');
      }
    }

    checkBackend();
    return () => {
      cancelled = true;
      stopTimers();
      stopStream();
      if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
    };
  }, [provider, stopStream, stopTimers]);

  async function startRecording() {
    try {
      setError('');
      setResult(null);
      setLiveResult(null);
      setRecordedBlob(null);
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      setRecordingUrl('');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setRecordedBlob(blob);
        setRecordingUrl(URL.createObjectURL(blob));
        stopStream();
      };

      recorder.start(1000);
      setDuration(0);
      setIsRecording(true);
      durationTimerRef.current = setInterval(() => setDuration((current) => current + 1), 1000);
      if (liveEnabled) liveTimerRef.current = setInterval(runLivePreview, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access failed.');
      stopTimers();
      stopStream();
      setIsRecording(false);
    }
  }

  function stopRecording() {
    stopTimers();
    setIsRecording(false);
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
  }

  async function processMedia() {
    const media = selectedFile || recordedBlob;
    if (!media) {
      setError('Upload an audio/video file or record audio first.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setResult(null);
    try {
      const filename = selectedFile?.name || 'recording.webm';
      const data = await callSpeechApi('transcribe', media, filename);
      setResult(data);
      const segs = data.segments ? [...data.segments] : [];
      setEditedSegments(segs);
      const count = data.speaker_count || 0;
      const fromSegs = [...new Set(segs.map(s => s.speaker).filter(Boolean))] as string[];
      const generated = Array.from({ length: count }, (_, i) => `Speaker ${i + 1}`);
      setSpeakerNames([...new Set([...fromSegs, ...generated])]);
      setEditingSpeaker(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speech processing failed.');
    } finally {
      setIsProcessing(false);
    }
  }

  function handleFileChange(file: File | null) {
    setSelectedFile(file);
    setRecordedBlob(null);
    setResult(null);
    setLiveResult(null);
    setError('');
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setRecordingUrl('');
  }

  async function handleSave() {
    if (!result || !selectedCaseId) return;
    setSaveStatus('saving');
    try {
      const segments = editedSegments.length > 0 ? editedSegments : (result.segments ?? []);
      const res = await fetch('/api/media-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: selectedCaseId,
          fileName: selectedFile?.name ?? (recordedBlob ? 'live-recording.webm' : 'unknown'),
          audioDescription: audioDescription || null,
          language: result.language ?? null,
          languageName: result.language_name ?? null,
          targetLanguage: result.target_language ?? null,
          targetLanguageName: result.target_language_name ?? null,
          task: result.task ?? 'transcribe',
          text: result.text ?? '',
          originalText: result.original_text ?? null,
          segments,
          originalSegments: result.original_segments ?? [],
          speakerCount: result.speaker_count ?? 0,
          diarization: result.diarization ?? false,
          processingTime: result.processing_time ?? null,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  }

  const activeMediaName = selectedFile?.name || (recordedBlob ? 'Recorded audio' : '');
  const statusColor = backendStatus === 'online' ? 'bg-emerald-500' : backendStatus === 'offline' ? 'bg-red-500' : 'bg-amber-400';

  return (
    <>
    <main className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 text-sm font-semibold text-blue-600 mb-2">
            <Radio size={16} />
            Speech Intelligence
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Transcription, Translation & Diarization</h1>
          <p className="text-slate-500 mt-2">
            Upload audio/video or record live audio, then generate transcripts, translations, and speaker-separated segments.
          </p>
        </div>
        <div className="content-card px-4 py-3 flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
          <span className="text-sm font-semibold text-slate-700">
            Speech backend {backendStatus === 'online' ? 'online' : backendStatus === 'offline' ? 'offline' : 'checking'}
          </span>
        </div>
      </div>

      <div className="content-card p-5 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Case</label>
          <CaseSearchSelect
            cases={cases}
            value={selectedCaseId}
            onChange={setSelectedCaseId}
            placeholder="— Select case —"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">Audio Description</label>
          <input
            type="text"
            value={audioDescription}
            onChange={(e) => setAudioDescription(e.target.value)}
            placeholder="Brief description of the audio content…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <div className="flex flex-col gap-6 relative">
          {!selectedCaseId && (
            <div className="absolute inset-0 z-10 rounded-xl bg-white/70 backdrop-blur-[2px] flex items-center justify-center">
              <p className="text-sm font-semibold text-slate-500">Select a case to continue</p>
            </div>
          )}
          <section className="content-card p-5">
            <h2 className="text-lg font-bold text-slate-900 mb-3">Media Input</h2>
            <label className="block border-2 border-dashed border-slate-200 rounded-lg p-5 text-center hover:border-blue-300 hover:bg-blue-50/40 transition cursor-pointer">
              <UploadCloud className="mx-auto text-blue-500 mb-3" size={30} />
              <div className="text-sm font-semibold text-slate-800">Upload audio or video</div>
              <div className="text-xs text-slate-500 mt-1">MP3, WAV, M4A, MP4, MOV, WebM and similar files</div>
              <input
                type="file"
                accept="audio/*,video/*"
                className="hidden"
                onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
              />
            </label>

            {activeMediaName && (
              <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 flex items-center gap-2 text-sm text-slate-700">
                <Video size={16} className="text-slate-500" />
                <span className="truncate">{activeMediaName}</span>
              </div>
            )}

            {recordingUrl && (
              <audio controls src={recordingUrl} className="w-full mt-3" />
            )}
          </section>

          <section className="content-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-900">Live Recording</h2>
              <span className="text-sm font-semibold text-slate-500">{formatTime(duration)}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {!isRecording ? (
                <button className="btn-primary" onClick={startRecording} disabled={backendStatus === 'offline'}>
                  <Mic size={17} />
                  Record
                </button>
              ) : (
                <button className="btn-secondary text-red-600" onClick={stopRecording}>
                  <Square size={17} />
                  Stop
                </button>
              )}
              <label className="btn-secondary cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={liveEnabled}
                  onChange={(event) => setLiveEnabled(event.target.checked)}
                  disabled={isRecording}
                />
                Live {task === 'translate' ? 'Translation' : 'Transcription'}
              </label>
            </div>
            {isRecording && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm font-semibold text-red-600 flex items-center gap-2">
                <Pause size={15} />
                Recording in progress
              </div>
            )}
          </section>

          <section className="content-card p-5 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Processing Options</h2>
            <div>
              <label className="text-sm font-semibold text-slate-700">Source language</label>
              <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)}>
                <option value="auto">Auto detect</option>
                {languages.map((language) => (
                  <option key={language.code} value={language.code}>{language.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">Mode</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button className={task === 'transcribe' ? 'btn-primary justify-center' : 'btn-secondary justify-center'} onClick={() => setTask('transcribe')}>
                  <Mic size={16} />
                  Transcribe
                </button>
                <button className={task === 'translate' ? 'btn-primary justify-center' : 'btn-secondary justify-center'} onClick={() => setTask('translate')}>
                  <Languages size={16} />
                  Translate
                </button>
              </div>
            </div>

            {task === 'translate' && (
              <div>
                <label className="text-sm font-semibold text-slate-700">Target language</label>
                <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>
                  {languages.map((language) => (
                    <option key={language.code} value={language.code}>{language.name}</option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer">
              <input type="checkbox" className="h-4 w-4" checked={diarize} onChange={(event) => setDiarize(event.target.checked)} />
              <span className="flex-1">
                <span className="block text-sm font-semibold text-slate-800">Speaker diarization</span>
                <span className="block text-xs text-slate-500">Separate transcript by speaker turns.</span>
              </span>
              <Users size={17} className="text-blue-500" />
            </label>

            {diarize && (
              <div>
                <label className="text-sm font-semibold text-slate-700">Expected speakers</label>
                <select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={speakerCount} onChange={(event) => setSpeakerCount(Number(event.target.value))}>
                  <option value={0}>Auto detect</option>
                  {[1, 2, 3, 4, 5, 6].map((count) => (
                    <option key={count} value={count}>{count}</option>
                  ))}
                </select>
              </div>
            )}

            <button className="btn-ai w-full justify-center" onClick={processMedia} disabled={isProcessing || isRecording || (!selectedFile && !recordedBlob)}>
              {isProcessing ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
              {isProcessing ? 'Processing...' : 'Generate Result'}
            </button>
          </section>
        </div>

        <section className="space-y-6">
          {liveEnabled && liveResult?.text && (
            <div className="content-card p-5 border-blue-100">
              <div className="flex items-center gap-2 mb-3 text-blue-600 font-bold">
                <Radio size={17} />
                Live {task === 'translate' ? 'Translation' : 'Transcription'}
              </div>
              <p className="text-slate-800 whitespace-pre-wrap leading-7">{liveResult.text}</p>
            </div>
          )}

          <div className="content-card p-5 min-h-[520px]">
            {!result ? (
              <div className="h-full min-h-[470px] flex flex-col items-center justify-center text-center text-slate-500">
                <Languages size={42} className="text-slate-300 mb-4" />
                <h2 className="text-xl font-bold text-slate-700">No speech result yet</h2>
                <p className="max-w-md mt-2 text-sm">
                  Choose an uploaded media file or record audio, configure language and diarization, then generate the transcript or translation.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {result.task === 'translate' ? 'Translation Result' : 'Transcription Result'}
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs font-semibold text-slate-600">
                      {result.language_name && <span className="rounded-full bg-slate-100 px-2.5 py-1">Source: {result.language_name}</span>}
                      {result.target_language_name && <span className="rounded-full bg-blue-50 text-blue-700 px-2.5 py-1">Target: {result.target_language_name}</span>}
                      {typeof result.processing_time === 'number' && <span className="rounded-full bg-slate-100 px-2.5 py-1">{result.processing_time}s</span>}
                      {result.diarization && <span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1">{result.speaker_count || 0} speakers</span>}
                    </div>
                  </div>
                  <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(result.text)}>
                    Copy Text
                  </button>
                </div>

                {result.diarization_warning && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Diarization warning: {result.diarization_warning}
                  </div>
                )}

                {result.original_text && result.task === 'translate' && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-bold text-slate-700 mb-2">Original Transcript</div>
                    <p className="text-slate-700 whitespace-pre-wrap leading-7">{result.original_text}</p>
                  </div>
                )}

                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="text-sm font-bold text-slate-700 mb-2">
                    {result.task === 'translate' ? 'Translated Text' : 'Transcript'}
                  </div>
                  <p className="text-slate-900 whitespace-pre-wrap leading-7">{result.text}</p>
                </div>

                {result.original_text && result.task === 'transcribe' && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                    <div className="text-sm font-bold text-blue-700 mb-2">English Translation (auto)</div>
                    <p className="text-slate-700 whitespace-pre-wrap leading-7">{result.original_text}</p>
                  </div>
                )}

                {editedSegments.length > 0 && result.diarization && !result.diarization_warning && (() => {
                  const allSpeakers = speakerNames;

                  const SPEAKER_COLORS: Record<string, { chip: string; active: string }> = {};
                  const PALETTE = [
                    { chip: 'bg-blue-50 text-blue-600 border-blue-200', active: 'bg-blue-600 text-white border-blue-600' },
                    { chip: 'bg-purple-50 text-purple-600 border-purple-200', active: 'bg-purple-600 text-white border-purple-600' },
                    { chip: 'bg-emerald-50 text-emerald-600 border-emerald-200', active: 'bg-emerald-600 text-white border-emerald-600' },
                    { chip: 'bg-orange-50 text-orange-600 border-orange-200', active: 'bg-orange-600 text-white border-orange-600' },
                  ];
                  allSpeakers.forEach((sp, i) => { SPEAKER_COLORS[sp] = PALETTE[i % PALETTE.length]; });

                  return (
                    <div>
                      {/* Speaker rename inputs */}
                      <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-bold text-slate-500">RENAME SPEAKERS</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const data = editedSegments.map(s => ({
                                speaker: s.speaker || 'Unknown',
                                start: s.start,
                                end: s.end,
                                text: s.text,
                                ...(s.original_text ? { original_text: s.original_text } : {}),
                              }));
                              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url; a.download = 'transcript.json'; a.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
                          >
                            ↓ Download JSON
                          </button>
                          {/* <button
                            onClick={() => {
                              const data = editedSegments.map(s => ({
                                speaker: s.speaker || 'Unknown',
                                start: s.start,
                                end: s.end,
                                text: s.text,
                                ...(s.original_text ? { original_text: s.original_text } : {}),
                              }));
                              downloadWord(data, result);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                          >
                            ↓ Download Word
                          </button> */}
                          <button
                            onClick={() => {
                              const data = editedSegments.map(s => ({
                                speaker: s.speaker || 'Unknown',
                                start: s.start,
                                end: s.end,
                                text: s.text,
                                ...(s.original_text ? { original_text: s.original_text } : {}),
                              }));
                              navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
                          >
                            Copy JSON
                          </button>
                        </div>
                      </div>
                        <div className="flex flex-wrap gap-3">
                          {allSpeakers.map((sp, i) => (
                            <div key={sp} className="flex items-center gap-2">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${SPEAKER_COLORS[sp]?.active}`}>{sp}</span>
                              <span className="text-xs text-slate-400">→</span>
                              <input
                                key={sp}
                                defaultValue={sp}
                                placeholder={sp}
                                className="border border-slate-200 rounded-lg px-2.5 py-1 text-sm w-32 outline-none focus:border-blue-400"
                                onBlur={e => {
                                  const newName = e.target.value.trim();
                                  if (newName && newName !== sp) {
                                    setEditedSegments(prev => prev.map(seg => seg.speaker === sp ? { ...seg, speaker: newName } : seg));
                                    setSpeakerNames(prev => prev.map(s => s === sp ? newName : s));
                                  }
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Language tabs — investigation officer (local) only: one language at a time */}
                      {provider === 'local' && (
                        <div className="flex gap-1 mb-3 p-1 bg-slate-100 rounded-lg w-fit">
                          {([['raw', result?.language_name || 'Original'], ['english', 'English']] as const).map(([key, label]) => (
                            <button
                              key={key}
                              onClick={() => setDiaLang(key)}
                              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                                diaLang === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="space-y-3">
                        {editedSegments.map((segment, index) => {
                          const colors = SPEAKER_COLORS[segment.speaker || ''] || PALETTE[0];
                          return (
                            <div key={segment.id ?? index} className={`rounded-xl border p-4 bg-white`}>
                              <div className="flex flex-wrap items-center gap-2 mb-2.5">
                                {/* Speaker chips — all speakers shown, active one highlighted */}
                                {allSpeakers.map(sp => (
                                  <button
                                    key={sp}
                                    onClick={() => {
                                      if (sp !== segment.speaker) {
                                        setEditedSegments(prev => prev.map((seg, i) => i === index ? { ...seg, speaker: sp } : seg));
                                      }
                                    }}
                                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border transition-all ${
                                      sp === segment.speaker
                                        ? SPEAKER_COLORS[sp]?.active
                                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400 hover:text-slate-600'
                                    }`}
                                  >
                                    {sp}
                                  </button>
                                ))}
                                <span className="text-xs text-slate-400 ml-1">{formatTime(segment.start)} – {formatTime(segment.end)}</span>
                              </div>
                              {provider === 'local' ? (
                                // One language at a time, chosen by the tab. raw = detected language, english = overlap translation.
                                <p className="text-slate-900 whitespace-pre-wrap leading-relaxed">
                                  {diaLang === 'english'
                                    ? (segment.original_text || '— no English for this turn —')
                                    : segment.text}
                                </p>
                              ) : (
                                <>
                                  {segment.original_text && (
                                    <p className="text-sm text-slate-500 mb-1.5 whitespace-pre-wrap">{segment.original_text}</p>
                                  )}
                                  <p className="text-slate-900 whitespace-pre-wrap leading-relaxed">{segment.text}</p>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>

    {result && selectedCaseId && (
      <button
        onClick={handleSave}
        disabled={saveStatus === 'saving' || saveStatus === 'saved'}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm shadow-lg transition-all ${
          saveStatus === 'saved'
            ? 'bg-emerald-600 text-white cursor-default'
            : saveStatus === 'error'
            ? 'bg-red-600 text-white hover:bg-red-700'
            : saveStatus === 'saving'
            ? 'bg-blue-400 text-white cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
        }`}
      >
        {saveStatus === 'saving' ? (
          <><Loader2 size={16} className="animate-spin" /> Saving…</>
        ) : saveStatus === 'saved' ? (
          <><Check size={16} /> Saved</>
        ) : saveStatus === 'error' ? (
          <><Save size={16} /> Error — Retry</>
        ) : (
          <><Save size={16} /> Save to Case</>
        )}
      </button>
    )}
    </>
  );
}
