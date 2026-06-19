import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API_BASE = `${BACKEND_URL}/stt`;
const DEFAULT_LANGUAGES = [
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

function fmtTime(value) {
  if (typeof value !== 'number') return '00:00';
  const m = Math.floor(value / 60).toString().padStart(2, '0');
  const s = Math.floor(value % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

async function parseError(response) {
  const data = await response.json().catch(() => null);
  return data?.detail || data?.error || `Request failed (${response.status})`;
}

export default function SpeechIntelligencePage() {
  const [userRole, setUserRole] = useState(null);
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [caseMenuOpen, setCaseMenuOpen] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [audioDescription, setAudioDescription] = useState('');
  const [languages, setLanguages] = useState(DEFAULT_LANGUAGES);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [task, setTask] = useState('transcribe');
  const [diarize, setDiarize] = useState(false);
  const [speakerCount, setSpeakerCount] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [result, setResult] = useState(null);
  const [editedSegments, setEditedSegments] = useState([]);
  const [diaLang, setDiaLang] = useState('raw');
  const [speakerNames, setSpeakerNames] = useState([]);
  const [liveResult, setLiveResult] = useState(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [duration, setDuration] = useState(0);
  const [saveStatus, setSaveStatus] = useState('idle');

  const caseMenuRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const durationTimerRef = useRef(null);
  const liveTimerRef = useRef(null);
  const liveBusyRef = useRef(false);

  const provider = userRole === 'admin' ? 'sarvam' : 'local';
  const activeMediaName = selectedFile?.name || (recordedBlob ? 'Recorded audio' : '');
  const selectedCaseLabel = useMemo(() => {
    const found = cases.find((c) => c.id === selectedCaseId);
    return found ? `${found.id} - ${found.title}` : '— Select case —';
  }, [cases, selectedCaseId]);
  const filteredCases = useMemo(() => {
    const q = caseSearch.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((c) => (`${c.id} ${c.title || ''}`).toLowerCase().includes(q));
  }, [caseSearch, cases]);

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

  const callSpeechApi = useCallback(async (endpoint, blob, filename) => {
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
    const res = await fetch(`${API_BASE}/${endpoint}?${params.toString()}`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error(await parseError(res));
    return res.json();
  }, [diarize, provider, sourceLanguage, speakerCount, targetLanguage, task]);

  const runLivePreview = useCallback(async () => {
    if (!liveEnabled || liveBusyRef.current || chunksRef.current.length === 0) return;
    liveBusyRef.current = true;
    try {
      const blob = new Blob(chunksRef.current, { type: recorderRef.current?.mimeType || 'audio/webm' });
      if (blob.size > 1000) {
        const data = await callSpeechApi('transcribe-live', blob, 'live.webm');
        if (data?.text) setLiveResult(data);
      }
    } catch (_) {
    } finally {
      liveBusyRef.current = false;
    }
  }, [callSpeechApi, liveEnabled]);

  useEffect(() => {
    fetch(`${BACKEND_URL}/me`)
      .then((r) => r.json())
      .then((d) => { if (d?.role) setUserRole(d.role); })
      .catch(() => setUserRole('officer'));
    fetch(`${BACKEND_URL}/cases`)
      .then((r) => r.json())
      .then((d) => setCases(Array.isArray(d) ? d : []))
      .catch(() => setCases([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/health?provider=${provider}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return;
        setBackendStatus(ok ? 'online' : 'offline');
        if (Array.isArray(d?.available_languages)) setLanguages(d.available_languages);
      })
      .catch(() => {
        if (!cancelled) setBackendStatus('offline');
      });
    return () => {
      cancelled = true;
      stopTimers();
      stopStream();
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
  }, [provider, recordingUrl, stopStream, stopTimers]);

  useEffect(() => {
    const onOutside = (event) => {
      if (!caseMenuRef.current?.contains(event.target)) setCaseMenuOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

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

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setRecordedBlob(blob);
        setRecordingUrl(URL.createObjectURL(blob));
        stopStream();
      };

      recorder.start(1000);
      setDuration(0);
      setIsRecording(true);
      durationTimerRef.current = setInterval(() => setDuration((v) => v + 1), 1000);
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
    if (recorderRef.current?.state !== 'inactive') recorderRef.current.stop();
  }

  async function processMedia() {
    const media = selectedFile || recordedBlob;
    if (!selectedCaseId) return setError('Select a case first.');
    if (!media) return setError('Upload an audio/video file or record audio first.');
    setIsProcessing(true);
    setError('');
    setResult(null);
    try {
      const data = await callSpeechApi('transcribe', media, selectedFile?.name || 'recording.webm');
      setResult(data);
      const segs = data.segments ? [...data.segments] : [];
      setEditedSegments(segs);
      const count = data.speaker_count || 0;
      const fromSegs = [...new Set(segs.map((s) => s.speaker).filter(Boolean))];
      const generated = Array.from({ length: count }, (_, i) => `Speaker ${i + 1}`);
      setSpeakerNames([...new Set([...fromSegs, ...generated])]);
      setDiaLang('raw');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speech processing failed.');
    } finally {
      setIsProcessing(false);
    }
  }

  async function saveRecord() {
    if (!result || !selectedCaseId) return;
    setSaveStatus('saving');
    try {
      const payload = {
        caseId: selectedCaseId,
        fileName: selectedFile?.name || (recordedBlob ? 'live-recording.webm' : 'unknown'),
        audioDescription: audioDescription || null,
        language: result.language || null,
        languageName: result.language_name || null,
        targetLanguage: result.target_language || null,
        targetLanguageName: result.target_language_name || null,
        task: result.task || task,
        text: result.text || '',
        originalText: result.original_text || null,
        segments: editedSegments.length ? editedSegments : (result.segments || []),
        originalSegments: result.original_segments || [],
        speakerCount: result.speaker_count || 0,
        diarization: result.diarization || false,
        processingTime: result.processing_time || null,
      };
      const res = await fetch(`${BACKEND_URL}/media-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (_) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }

  function downloadJson() {
    const data = editedSegments.map((s) => ({
      speaker: s.speaker || 'Unknown',
      start: s.start,
      end: s.end,
      text: s.text,
      ...(s.original_text ? { original_text: s.original_text } : {}),
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcript.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  const statusLabel = backendStatus === 'online' ? 'Speech backend online' : backendStatus === 'offline' ? 'Speech backend offline' : 'Speech backend checking';

  return (
    <>
      <div style={{ maxWidth: '1480px', margin: '0 auto', display: 'grid', gap: '16px' }}>
        <section style={hero}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
            <div>
              <div style={heroTag}>Speech Intelligence</div>
              <h1 style={heroTitle}>Transcription, Translation & Diarization</h1>
              <p style={heroDesc}>Upload audio/video or record live audio, then generate transcripts, translations, and speaker-separated segments.</p>
            </div>
            <div style={statusPill(backendStatus)}>
              <span style={statusDot(backendStatus)} />
              {statusLabel}
            </div>
          </div>
        </section>

        <section style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={label}>Case</label>
              <div ref={caseMenuRef} style={dropdownWrap}>
                <button type="button" onClick={() => setCaseMenuOpen((v) => !v)} style={dropdownTrigger}>
                  <span style={dropdownValue}>{selectedCaseLabel}</span>
                  <span style={dropdownChevron}>{caseMenuOpen ? '▴' : '▾'}</span>
                </button>
                {caseMenuOpen ? (
                  <div style={dropdownPanel}>
                    <input value={caseSearch} onChange={(e) => setCaseSearch(e.target.value)} placeholder="Search case..." style={dropdownSearch} />
                    <div style={dropdownList}>
                      <button type="button" onClick={() => { setSelectedCaseId(''); setCaseMenuOpen(false); setCaseSearch(''); }} style={{ ...dropdownItem, ...(selectedCaseId === '' ? dropdownItemActive : null) }}>
                        — Select case —
                      </button>
                      {filteredCases.map((item) => (
                        <button key={item.id} type="button" onClick={() => { setSelectedCaseId(item.id); setCaseMenuOpen(false); setCaseSearch(''); }} style={{ ...dropdownItem, ...(selectedCaseId === item.id ? dropdownItemActive : null) }}>
                          {item.id} - {item.title}
                        </button>
                      ))}
                      {filteredCases.length === 0 ? <div style={dropdownEmpty}>No matching cases</div> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div>
              <label style={label}>Audio Description</label>
              <input value={audioDescription} onChange={(e) => setAudioDescription(e.target.value)} style={input} placeholder="Brief description of the audio content..." />
            </div>
          </div>
        </section>

        {error ? <div style={errorBox}>{error}</div> : null}

        <section style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: '16px' }}>
          <div style={{ display: 'grid', gap: '16px' }}>
            <section style={card}>
              <div style={sectionTitle}>Media Input</div>
              <label style={uploadBox}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Upload audio or video</div>
                <div style={{ marginTop: '3px', fontSize: '11px', color: 'var(--text-3)' }}>MP3, WAV, M4A, MP4, MOV, WebM and similar files</div>
                <input
                  type="file"
                  accept="audio/*,video/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                    setRecordedBlob(null);
                    setResult(null);
                    setLiveResult(null);
                    setError('');
                    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
                    setRecordingUrl('');
                  }}
                />
              </label>
              {activeMediaName ? <div style={chip}>{activeMediaName}</div> : null}
              {recordingUrl ? <audio controls src={recordingUrl} style={{ width: '100%', marginTop: '10px' }} /> : null}
            </section>

            <section style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={sectionTitle}>Live Recording</div>
                <span style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 700 }}>{fmtTime(duration)}</span>
              </div>
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {!isRecording ? (
                  <button onClick={startRecording} disabled={backendStatus === 'offline'} style={primaryBtn}>Record</button>
                ) : (
                  <button onClick={stopRecording} style={dangerBtn}>Stop</button>
                )}
                <label style={secondaryBtn}>
                  <input type="checkbox" checked={liveEnabled} onChange={(e) => setLiveEnabled(e.target.checked)} disabled={isRecording} style={{ marginRight: '6px' }} />
                  Live {task === 'translate' ? 'Translation' : 'Transcription'}
                </label>
              </div>
              {isRecording ? <div style={recordingBanner}>Recording in progress</div> : null}
            </section>

            <section style={card}>
              <div style={sectionTitle}>Processing Options</div>
              <div style={{ marginTop: '10px', display: 'grid', gap: '10px' }}>
                <div>
                  <label style={label}>Source language</label>
                  <select value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)} style={selectInput}>
                    <option value="auto">Auto detect</option>
                    {languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Mode</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button onClick={() => setTask('transcribe')} style={taskBtn(task === 'transcribe')}>Transcribe</button>
                    <button onClick={() => setTask('translate')} style={taskBtn(task === 'translate')}>Translate</button>
                  </div>
                </div>
                {task === 'translate' ? (
                  <div>
                    <label style={label}>Target language</label>
                    <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} style={selectInput}>
                      {languages.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                    </select>
                  </div>
                ) : null}
                <label style={checkboxRow}>
                  <input type="checkbox" checked={diarize} onChange={(e) => setDiarize(e.target.checked)} />
                  <span>
                    <span style={{ display: 'block', fontWeight: 700, color: 'var(--text)' }}>Speaker diarization</span>
                    <span style={{ display: 'block', color: 'var(--text-3)', fontSize: '11px' }}>Separate transcript by speaker turns.</span>
                  </span>
                </label>
                {diarize ? (
                  <div>
                    <label style={label}>Expected speakers</label>
                    <select value={speakerCount} onChange={(e) => setSpeakerCount(Number(e.target.value))} style={selectInput}>
                      <option value={0}>Auto detect</option>
                      {[1, 2, 3, 4, 5, 6].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ) : null}
                <button onClick={processMedia} disabled={isProcessing || isRecording || (!selectedFile && !recordedBlob)} style={{ ...generateBtn, opacity: isProcessing || isRecording || (!selectedFile && !recordedBlob) ? 0.65 : 1 }}>
                  {isProcessing ? 'Processing...' : 'Generate Result'}
                </button>
              </div>
            </section>
          </div>

          <section style={{ ...card, minHeight: '520px' }}>
            {liveEnabled && liveResult?.text ? (
              <div style={liveCard}>
                <div style={liveTitle}>Live {task === 'translate' ? 'Translation' : 'Transcription'}</div>
                <p style={liveText}>{liveResult.text}</p>
              </div>
            ) : null}

            {!result ? (
              <div style={emptyState}>
                <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-2)' }}>No speech result yet</h2>
                <p style={{ margin: '8px 0 0', maxWidth: '560px', fontSize: '13px', color: 'var(--text-3)' }}>
                  Choose an uploaded media file or record audio, configure language and diarization, then generate the transcript or translation.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '22px', color: 'var(--text)' }}>{result.task === 'translate' ? 'Translation Result' : 'Transcription Result'}</h2>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {result.language_name ? <span style={metaChip}>Source: {result.language_name}</span> : null}
                      {result.target_language_name ? <span style={{ ...metaChip, color: '#166534', background: 'rgba(22,163,74,0.12)' }}>Target: {result.target_language_name}</span> : null}
                      {typeof result.processing_time === 'number' ? <span style={metaChip}>{result.processing_time}s</span> : null}
                      {result.diarization ? <span style={{ ...metaChip, color: '#166534', background: 'rgba(22,163,74,0.12)' }}>{result.speaker_count || 0} speakers</span> : null}
                    </div>
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(result.text || '')} style={secondaryBtn}>Copy Text</button>
                </div>

                {result.diarization_warning ? <div style={warnBox}>Diarization warning: {result.diarization_warning}</div> : null}
                {result.original_text && result.task === 'translate' ? (
                  <div style={contentBox}>
                    <div style={contentTitle}>Original Transcript</div>
                    <p style={contentText}>{result.original_text}</p>
                  </div>
                ) : null}
                <div style={contentBox}>
                  <div style={contentTitle}>{result.task === 'translate' ? 'Translated Text' : 'Transcript'}</div>
                  <p style={contentText}>{result.text}</p>
                </div>
                {result.original_text && result.task === 'transcribe' ? (
                  <div style={{ ...contentBox, borderColor: 'rgba(22,163,74,0.24)', background: 'rgba(22,163,74,0.08)' }}>
                    <div style={{ ...contentTitle, color: '#166534' }}>English Translation (auto)</div>
                    <p style={contentText}>{result.original_text}</p>
                  </div>
                ) : null}

                {editedSegments.length && result.diarization && !result.diarization_warning ? (
                  <div>
                    <div style={renameHead}>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 700, letterSpacing: '0.5px' }}>RENAME SPEAKERS</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={downloadJson} style={secondaryBtn}>Download JSON</button>
                        <button onClick={() => navigator.clipboard.writeText(JSON.stringify(editedSegments, null, 2))} style={secondaryBtn}>Copy JSON</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {speakerNames.map((sp) => (
                        <div key={sp} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={speakerBadge}>{sp}</span>
                          <input
                            defaultValue={sp}
                            style={renameInput}
                            onBlur={(e) => {
                              const next = e.target.value.trim();
                              if (next && next !== sp) {
                                setEditedSegments((prev) => prev.map((seg) => seg.speaker === sp ? { ...seg, speaker: next } : seg));
                                setSpeakerNames((prev) => prev.map((s) => s === sp ? next : s));
                              }
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    {provider === 'local' ? (
                      <div style={tabRow}>
                        <button onClick={() => setDiaLang('raw')} style={tabBtn(diaLang === 'raw')}>{result.language_name || 'Original'}</button>
                        <button onClick={() => setDiaLang('english')} style={tabBtn(diaLang === 'english')}>English</button>
                      </div>
                    ) : null}

                    <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
                      {editedSegments.map((segment, index) => (
                        <div key={segment.id || index} style={segmentCard}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                            {speakerNames.map((sp) => (
                              <button
                                key={sp}
                                onClick={() => {
                                  if (sp !== segment.speaker) {
                                    setEditedSegments((prev) => prev.map((seg, i) => i === index ? { ...seg, speaker: sp } : seg));
                                  }
                                }}
                                style={speakerPick(sp === segment.speaker)}
                              >
                                {sp}
                              </button>
                            ))}
                            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{fmtTime(segment.start)} – {fmtTime(segment.end)}</span>
                          </div>
                          {provider === 'local' ? (
                            <p style={segmentText}>
                              {diaLang === 'english' ? (segment.original_text || '— no English for this turn —') : segment.text}
                            </p>
                          ) : (
                            <>
                              {segment.original_text ? <p style={{ ...segmentText, color: 'var(--text-3)' }}>{segment.original_text}</p> : null}
                              <p style={segmentText}>{segment.text}</p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </section>
      </div>

      {result && selectedCaseId ? (
        <button onClick={saveRecord} disabled={saveStatus === 'saving' || saveStatus === 'saved'} style={saveFab(saveStatus)}>
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error — Retry' : 'Save to Case'}
        </button>
      ) : null}
    </>
  );
}

const hero = {
  background: 'linear-gradient(135deg,#0E141F 0%,#162236 100%)',
  border: '1px solid #1C2A40',
  borderRadius: '14px',
  boxShadow: 'var(--shadow)',
  padding: '20px 22px',
};
const heroTag = { fontSize: '11px', color: '#7F93AE', letterSpacing: '0.8px', textTransform: 'uppercase', fontWeight: 600 };
const heroTitle = { margin: '8px 0 0', fontSize: '28px', color: '#F8FAFC' };
const heroDesc = { margin: '8px 0 0', color: '#B8C7DA', fontSize: '14px', maxWidth: '820px' };
const card = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: '14px', boxShadow: 'var(--shadow)', padding: '16px' };
const label = { display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text-2)' };
const input = { width: '100%', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', borderRadius: '11px', padding: '10px 12px', fontSize: '12px' };
const selectInput = { ...input, appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', backgroundImage: 'linear-gradient(45deg, transparent 50%, #64748B 50%), linear-gradient(135deg, #64748B 50%, transparent 50%)', backgroundPosition: 'calc(100% - 16px) calc(50% - 3px), calc(100% - 11px) calc(50% - 3px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat', paddingRight: '28px' };
const sectionTitle = { fontSize: '15px', color: 'var(--text)', fontWeight: 700 };
const uploadBox = { display: 'block', border: '2px dashed var(--border)', background: 'var(--surface-2)', borderRadius: '12px', padding: '18px', textAlign: 'center', cursor: 'pointer' };
const chip = { marginTop: '8px', border: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: '10px', padding: '8px 10px', fontSize: '12px', color: 'var(--text-2)' };
const primaryBtn = { border: '1px solid #00A84A', background: '#00C853', color: '#052E16', borderRadius: '11px', fontSize: '12px', fontWeight: 700, padding: '8px 12px', cursor: 'pointer' };
const secondaryBtn = { border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', borderRadius: '11px', fontSize: '12px', fontWeight: 700, padding: '8px 11px', cursor: 'pointer' };
const dangerBtn = { border: '1px solid #B91C1C', background: '#FEE2E2', color: '#991B1B', borderRadius: '11px', fontSize: '12px', fontWeight: 700, padding: '8px 11px', cursor: 'pointer' };
const recordingBanner = { marginTop: '8px', border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: '10px', padding: '8px 10px', fontSize: '12px', color: '#DC2626', fontWeight: 700 };
const checkboxRow = { display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid var(--border)', borderRadius: '10px', padding: '9px 10px' };
const generateBtn = { border: '1px solid #059669', background: 'linear-gradient(135deg,#16A34A,#059669)', color: '#FFFFFF', borderRadius: '11px', fontSize: '13px', fontWeight: 700, padding: '10px 12px', cursor: 'pointer' };
const liveCard = { border: '1px solid rgba(22,163,74,0.24)', borderRadius: '10px', background: 'rgba(22,163,74,0.08)', padding: '12px', marginBottom: '12px' };
const liveTitle = { fontSize: '13px', fontWeight: 700, color: '#166534', marginBottom: '6px' };
const liveText = { margin: 0, fontSize: '13px', color: 'var(--text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.6 };
const emptyState = { minHeight: '470px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' };
const metaChip = { fontSize: '11px', color: 'var(--text-2)', background: 'var(--surface-2)', borderRadius: '999px', padding: '4px 9px', fontWeight: 700 };
const warnBox = { border: '1px solid #FDE68A', background: '#FFFBEB', borderRadius: '10px', padding: '9px 10px', fontSize: '12px', color: '#B45309' };
const contentBox = { border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface-2)', padding: '12px' };
const contentTitle = { fontSize: '12px', color: 'var(--text-2)', fontWeight: 700, marginBottom: '6px' };
const contentText = { margin: 0, fontSize: '13px', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' };
const renameHead = { border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface-2)', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' };
const speakerBadge = { fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: 'rgba(22,163,74,0.12)', color: '#166534' };
const renameInput = { border: '1px solid var(--border)', borderRadius: '8px', padding: '5px 8px', fontSize: '12px', color: 'var(--text)', background: '#FFFFFF', width: '130px' };
const tabRow = { display: 'flex', gap: '4px', marginTop: '8px', padding: '4px', background: 'var(--surface-2)', borderRadius: '8px', width: 'fit-content' };
const tabBtn = (active) => ({ border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, background: active ? '#FFFFFF' : 'transparent', color: active ? 'var(--text)' : 'var(--text-3)', cursor: 'pointer' });
const segmentCard = { border: '1px solid var(--border)', borderRadius: '10px', background: '#FFFFFF', padding: '10px' };
const segmentText = { margin: 0, fontSize: '13px', color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 };
const speakerPick = (active) => ({ border: '1px solid', borderColor: active ? '#059669' : 'var(--border)', borderRadius: '999px', padding: '3px 8px', fontSize: '11px', fontWeight: 700, background: active ? '#059669' : '#FFFFFF', color: active ? '#FFFFFF' : 'var(--text-3)', cursor: 'pointer' });
const saveFab = (status) => ({ position: 'fixed', right: '24px', bottom: '24px', zIndex: 60, border: 'none', borderRadius: '12px', padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF', background: status === 'saved' ? '#059669' : status === 'error' ? '#DC2626' : '#16A34A', boxShadow: '0 10px 20px rgba(15,23,42,0.22)', cursor: status === 'saved' ? 'default' : 'pointer' });
const statusPill = (status) => ({ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: status === 'online' ? '#86EFAC' : status === 'offline' ? '#FCA5A5' : '#F59E0B', borderRadius: '999px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px' });
const statusDot = (status) => ({ width: '8px', height: '8px', borderRadius: '50%', background: status === 'online' ? '#22C55E' : status === 'offline' ? '#EF4444' : '#F59E0B' });
const errorBox = { border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', borderRadius: '12px', padding: '10px 12px', fontSize: '12px', fontWeight: 600 };
const dropdownWrap = { position: 'relative' };
const dropdownTrigger = { ...input, display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '40px', gap: '8px', fontWeight: 600, cursor: 'pointer' };
const dropdownValue = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' };
const dropdownChevron = { color: 'var(--text-3)', fontSize: '12px' };
const dropdownPanel = { position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 20, border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', boxShadow: '0 10px 24px rgba(15,23,42,0.12)', padding: '8px' };
const dropdownSearch = { ...input, borderColor: 'var(--border-2)', marginBottom: '8px' };
const dropdownList = { maxHeight: '220px', overflowY: 'auto', display: 'grid', gap: '4px' };
const dropdownItem = { border: '1px solid transparent', borderRadius: '9px', background: 'var(--surface)', color: 'var(--text-2)', padding: '8px 10px', textAlign: 'left', fontSize: '12px', fontWeight: 600, cursor: 'pointer' };
const dropdownItemActive = { borderColor: 'rgba(22,163,74,0.3)', background: 'var(--surface-2)', color: 'var(--text)' };
const dropdownEmpty = { border: '1px dashed var(--border)', borderRadius: '9px', padding: '10px', fontSize: '12px', color: 'var(--text-3)', textAlign: 'center' };
const taskBtn = (active) => ({ border: '1px solid', borderColor: active ? '#059669' : 'var(--border)', background: active ? 'linear-gradient(135deg,#16A34A,#059669)' : 'var(--surface-2)', color: active ? '#FFFFFF' : 'var(--text-2)', borderRadius: '10px', fontSize: '12px', fontWeight: 700, padding: '9px 10px', cursor: 'pointer' });
