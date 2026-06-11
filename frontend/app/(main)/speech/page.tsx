'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Languages,
  Loader2,
  Mic,
  Pause,
  Play,
  Radio,
  Square,
  UploadCloud,
  Users,
  Video,
} from 'lucide-react';
import { BACKEND_URL } from '@/lib/config';

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

async function readApiError(response: Response) {
  const data = await response.json().catch(() => null);
  return data?.detail || data?.error || `Request failed with status ${response.status}`;
}

export default function SpeechPage() {
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
  const [liveResult, setLiveResult] = useState<SpeechResult | null>(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [duration, setDuration] = useState(0);

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

  const callSpeechApi = useCallback(
    async (endpoint: 'transcribe' | 'transcribe-live', blob: Blob, filename: string) => {
      const formData = new FormData();
      formData.append('file', new File([blob], filename, { type: blob.type || 'application/octet-stream' }));

      const params = new URLSearchParams({
        language: sourceLanguage,
        task,
        target_language: targetLanguage,
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
    [diarize, sourceLanguage, speakerCount, targetLanguage, task],
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
    let cancelled = false;
    async function checkBackend() {
      try {
        const response = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
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
  }, [stopStream, stopTimers]);

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

  const activeMediaName = selectedFile?.name || (recordedBlob ? 'Recorded audio' : '');
  const statusColor = backendStatus === 'online' ? 'bg-emerald-500' : backendStatus === 'offline' ? 'bg-red-500' : 'bg-amber-400';

  return (
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

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <section className="content-card p-5 space-y-5">
          <div>
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
          </div>

          <div className="border-t border-slate-100 pt-5">
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
          </div>

          <div className="border-t border-slate-100 pt-5 space-y-4">
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
          </div>
        </section>

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

                {Array.isArray(result.segments) && result.segments.length > 0 && result.diarization && !result.diarization_warning && (
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-3">Segments</h3>
                    <div className="space-y-3">
                      {result.segments.map((segment, index) => (
                        <div key={segment.id ?? index} className="rounded-lg border border-slate-200 p-4 bg-white">
                          <div className="flex flex-wrap items-center gap-2 mb-2 text-xs font-semibold text-slate-500">
                            <span>{segment.speaker || 'Segment'}</span>
                            <span>{formatTime(segment.start)} - {formatTime(segment.end)}</span>
                          </div>
                          {segment.original_text && (
                            <p className="text-sm text-slate-500 mb-2 whitespace-pre-wrap">{segment.original_text}</p>
                          )}
                          <p className="text-slate-900 whitespace-pre-wrap">{segment.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
