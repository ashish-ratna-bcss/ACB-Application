import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API_BASE = `${BACKEND_URL}/speech-intel`;
const POLL_INTERVAL_MS = 4000;
const ACCEPTED_HINT = 'WAV, MP3, M4A, MP4, MOV, WebM, OGG and similar audio/video files';

function fmtTime(value) {
  const v = typeof value === 'string' ? Number(value) : value;
  if (typeof v !== 'number' || Number.isNaN(v)) return '00:00';
  const m = Math.floor(v / 60).toString().padStart(2, '0');
  const s = Math.floor(v % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

async function parseError(response) {
  const data = await response.json().catch(() => null);
  return data?.detail || data?.error || `Request failed (${response.status})`;
}

function Collapsible({ title, count, open, onToggle, scroll, children }) {
  return (
    <div style={collapseCard}>
      <button type="button" onClick={onToggle} style={collapseHead}>
        <span style={collapseTitle}>
          {title}
          {typeof count === 'number' ? <span style={collapseCount}>{count}</span> : null}
        </span>
        <span style={collapseChevron}>{open ? '▴' : '▾'}</span>
      </button>
      {open ? <div style={scroll ? collapseBodyScroll : collapseBody}>{children}</div> : null}
    </div>
  );
}

function deriveTranscript(result) {
  const rows = result?.conversation_table?.rows || [];
  if (rows.length) {
    return rows
      .map((r) => `${r.person || 'Speaker'}: ${r.conversation || ''}`.trim())
      .join('\n');
  }
  const segments = result?.transcript?.segments || [];
  return segments
    .map((s) => (s.text || '').trim())
    .filter(Boolean)
    .join(' ');
}

export default function SpeechIntelligencePage() {
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [caseMenuOpen, setCaseMenuOpen] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [audioDescription, setAudioDescription] = useState('');
  const [serviceStatus, setServiceStatus] = useState('checking');

  const [selectedFile, setSelectedFile] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordingUrl, setRecordingUrl] = useState('');

  const [result, setResult] = useState(null);
  const [intelRef, setIntelRef] = useState(null); // { caseId, fileId, jobId }
  const [progress, setProgress] = useState(null); // { status, stage, progress }
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [certifyStatus, setCertifyStatus] = useState('idle');
  const [open, setOpen] = useState({ transcript: true, table: true, segments: false });
  const toggle = (k) => setOpen((p) => ({ ...p, [k]: !p[k] }));
  const [history, setHistory] = useState([]);
  const [activeRecordId, setActiveRecordId] = useState(null);
  const [viewingHistory, setViewingHistory] = useState(false);

  const caseMenuRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const durationTimerRef = useRef(null);

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

  const recordToResult = (rec) => {
    const recSegs = rec.segments || [];
    const segs = recSegs.map((s, i) => ({
      segment_id: String(i),
      start: s.start,
      end: s.end,
      speaker: s.speaker || 'Speaker',
      text: s.text || '',
    }));
    const spk = [...new Set(segs.map((s) => s.speaker).filter(Boolean))];
    const tableRows = recSegs
      .filter((s) => (s.text || '').trim())
      .map((s, i) => ({ sl: i + 1, time: fmtTime(s.start), person: s.speaker || 'Speaker', conversation: s.text || '' }));
    return {
      status: 'saved',
      transcript: { segments: segs },
      diarization: { speakers: spk },
      conversation_table: { rows: tableRows },
    };
  };

  const segments = result?.transcript?.segments || [];
  const speakers = result?.diarization?.speakers || [];
  const rows = result?.conversation_table?.rows || [];
  const transcriptText = useMemo(() => deriveTranscript(result), [result]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    fetch(`${BACKEND_URL}/cases`)
      .then((r) => r.json())
      .then((d) => setCases(Array.isArray(d) ? d : []))
      .catch(() => setCases([]));
  }, []);

  const loadHistory = useCallback(() => {
    if (!selectedCaseId) { setHistory([]); return; }
    fetch(`${BACKEND_URL}/media-records?case_id=${encodeURIComponent(selectedCaseId)}`)
      .then((r) => r.json())
      .then((d) => setHistory(Array.isArray(d) ? d : []))
      .catch(() => setHistory([]));
  }, [selectedCaseId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    let cancelled = false;
    const checkHealth = async () => {
      try {
        const r = await fetch(`${API_BASE}/health`);
        const d = await r.json();
        if (!cancelled) setServiceStatus(d?.status === 'online' ? 'online' : 'offline');
      } catch (_) {
        if (!cancelled) setServiceStatus('offline');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => () => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    stopStream();
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
  }, [recordingUrl, stopStream]);

  useEffect(() => {
    const onOutside = (event) => {
      if (!caseMenuRef.current?.contains(event.target)) setCaseMenuOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  function resetForNewMedia() {
    setResult(null);
    setIntelRef(null);
    setProgress(null);
    setError('');
    setCertifyStatus('idle');
    setViewingHistory(false);
    setActiveRecordId(null);
  }

  async function startRecording() {
    try {
      setError('');
      resetForNewMedia();
      setRecordedBlob(null);
      setSelectedFile(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access failed.');
      stopStream();
      setIsRecording(false);
    }
  }

  function stopRecording() {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = null;
    setIsRecording(false);
    if (recorderRef.current?.state !== 'inactive') recorderRef.current.stop();
  }

  const pollJob = useCallback(async (jobId) => {
    // Poll until terminal; updates progress state along the way.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await fetch(`${API_BASE}/jobs/${jobId}`);
      if (!res.ok) throw new Error(await parseError(res));
      const data = await res.json();
      setProgress({ status: data.status, stage: data.stage, progress: data.progress });
      if (data.status === 'completed' || data.is_terminal) {
        if (data.status === 'failed') throw new Error(data.error || 'Processing failed.');
        return data;
      }
      if (data.status === 'failed') throw new Error(data.error || 'Processing failed.');
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }, []);

  async function processMedia() {
    const media = selectedFile || recordedBlob;
    if (!media) return setError('Upload an audio/video file or record audio first.');
    setIsProcessing(true);
    resetForNewMedia();
    setProgress({ status: 'creating', stage: 'init', progress: 0 });
    try {
      // 1. Create case on the speech-intelligence service.
      const caseRes = await fetch(`${API_BASE}/cases`, { method: 'POST' });
      if (!caseRes.ok) throw new Error(await parseError(caseRes));
      const { case_id: intelCaseId } = await caseRes.json();

      // 2. Upload the media file.
      setProgress({ status: 'uploading', stage: 'upload', progress: 5 });
      const filename = selectedFile?.name || `recording-${Date.now()}.webm`;
      const formData = new FormData();
      formData.append('audio', new File([media], filename, { type: media.type || 'application/octet-stream' }));
      const upRes = await fetch(`${API_BASE}/cases/${intelCaseId}/files`, { method: 'POST', body: formData });
      if (!upRes.ok) throw new Error(await parseError(upRes));
      const { file_id: fileId, job_id: jobId } = await upRes.json();

      // 3. Poll job status to completion.
      await pollJob(jobId);

      // 4. Fetch the full result.
      const resultRes = await fetch(`${API_BASE}/jobs/${jobId}/result`);
      if (!resultRes.ok) throw new Error(await parseError(resultRes));
      const data = await resultRes.json();
      const ref = { caseId: intelCaseId, fileId, jobId };
      setResult(data);
      setIntelRef(ref);
      setViewingHistory(false);
      setActiveRecordId(null);
      // Auto-save to the selected case (also logs evidence + refreshes history).
      if (selectedCaseId) await persistToCase(data, filename, ref);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speech processing failed.');
      setProgress(null);
    } finally {
      setIsProcessing(false);
    }
  }

  async function rerun() {
    if (!intelRef?.jobId) return;
    setIsProcessing(true);
    setError('');
    setProgress({ status: 'queued', stage: 'rerun', progress: 0 });
    try {
      const res = await fetch(`${API_BASE}/jobs/${intelRef.jobId}/rerun`, { method: 'POST' });
      if (!res.ok) throw new Error(await parseError(res));
      const { job_id: jobId } = await res.json();
      await pollJob(jobId);
      const resultRes = await fetch(`${API_BASE}/jobs/${jobId}/result`);
      if (!resultRes.ok) throw new Error(await parseError(resultRes));
      setResult(await resultRes.json());
      setIntelRef((prev) => ({ ...prev, jobId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-run failed.');
    } finally {
      setIsProcessing(false);
    }
  }

  async function certify() {
    if (!intelRef?.caseId || !intelRef?.fileId) return;
    setCertifyStatus('saving');
    try {
      const res = await fetch(`${API_BASE}/cases/${intelRef.caseId}/files/${intelRef.fileId}/certify`, { method: 'POST' });
      if (!res.ok) throw new Error(await parseError(res));
      setCertifyStatus('done');
      setTimeout(() => setCertifyStatus('idle'), 3000);
    } catch (_) {
      setCertifyStatus('error');
      setTimeout(() => setCertifyStatus('idle'), 3000);
    }
  }

  const persistToCase = useCallback(async (data, fileName, ref) => {
    if (!data || !selectedCaseId) return;
    const segs = data?.transcript?.segments || [];
    const spk = data?.diarization?.speakers || [];
    setSaveStatus('saving');
    try {
      const payload = {
        caseId: selectedCaseId,
        fileName: fileName || 'unknown',
        audioDescription: audioDescription || null,
        language: segs.find((s) => s.language)?.language || null,
        task: 'transcribe',
        text: deriveTranscript(data),
        segments: segs.map((s) => ({
          speaker: s.speaker || 'Unknown',
          start: Number(s.start) || 0,
          end: Number(s.end) || 0,
          text: s.text || '',
        })),
        originalSegments: [],
        speakerCount: spk.length,
        diarization: spk.length > 0,
        externalJobId: ref?.jobId || null,
        externalCaseId: ref?.caseId || null,
        externalFileId: ref?.fileId || null,
      };
      const res = await fetch(`${BACKEND_URL}/media-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('saved');
      loadHistory();
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (_) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, [selectedCaseId, audioDescription, loadHistory]);

  function saveRecord() {
    const fileName = selectedFile?.name || (recordedBlob ? 'live-recording.webm' : (activeRecordId ? 'saved-record' : 'unknown'));
    return persistToCase(result, fileName, intelRef);
  }

  function openRecord(rec) {
    setViewingHistory(true);
    setActiveRecordId(rec.id);
    setIntelRef(null);
    setError('');
    setProgress(null);
    setSelectedFile(null);
    setRecordedBlob(null);
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setRecordingUrl('');
    setAudioDescription(rec.audioDescription || '');
    setResult(recordToResult(rec));
    setOpen({ transcript: true, table: true, segments: false });
  }

  function downloadJson() {
    const data = {
      transcript: transcriptText,
      speakers,
      segments,
      conversation_table: rows,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'speech-intelligence-result.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  const statusLabel = serviceStatus === 'online' ? 'Speech service online' : serviceStatus === 'offline' ? 'Speech service offline' : 'Speech service checking';
  const progressPct = typeof progress?.progress === 'number' ? progress.progress : 0;

  return (
    <>
      <div style={{ maxWidth: '1480px', margin: '0 auto', display: 'grid', gap: '16px' }}>
        <section style={hero}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
            <div>
              <div style={heroTag}>Speech Intelligence</div>
              <h1 style={heroTitle}>Transcription, Diarization & Conversation Analysis</h1>
              <p style={heroDesc}>Upload an audio or video file (or record live), and the speech-intelligence service returns a speaker-separated transcript and conversation table.</p>
            </div>
            <div style={statusPill(serviceStatus)}>
              <span style={statusDot(serviceStatus)} />
              {statusLabel}
            </div>
          </div>
        </section>

        <section style={card}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={label}>Case (for saving to record)</label>
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
                <div style={{ marginTop: '3px', fontSize: '11px', color: 'var(--text-3)' }}>{ACCEPTED_HINT}</div>
                <input
                  type="file"
                  accept="audio/*,video/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setSelectedFile(file);
                    setRecordedBlob(null);
                    resetForNewMedia();
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
                  <button onClick={startRecording} disabled={isProcessing} style={primaryBtn}>Record</button>
                ) : (
                  <button onClick={stopRecording} style={dangerBtn}>Stop</button>
                )}
              </div>
              {isRecording ? <div style={recordingBanner}>Recording in progress — stop, then Generate Result</div> : null}
            </section>

            <section style={card}>
              <div style={sectionTitle}>Generate</div>
              <p style={{ margin: '8px 0 12px', fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.6 }}>
                The service auto-detects language, separates speakers, and builds a conversation table. No extra options required.
              </p>
              <button onClick={processMedia} disabled={isProcessing || isRecording || (!selectedFile && !recordedBlob)} style={{ ...generateBtn, opacity: isProcessing || isRecording || (!selectedFile && !recordedBlob) ? 0.65 : 1 }}>
                {isProcessing ? 'Processing...' : 'Generate Result'}
              </button>
              {progress && isProcessing ? (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-3)', fontWeight: 700, marginBottom: '4px' }}>
                    <span>{progress.status}{progress.stage ? ` · ${progress.stage}` : ''}</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div style={progressTrack}>
                    <div style={{ ...progressFill, width: `${Math.max(progressPct, 4)}%` }} />
                  </div>
                </div>
              ) : null}
            </section>

            {selectedCaseId ? (
              <section style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={sectionTitle}>Case History</div>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 700 }}>{history.length} file{history.length === 1 ? '' : 's'}</span>
                </div>
                <p style={{ margin: '6px 0 10px', fontSize: '11px', color: 'var(--text-3)' }}>Previously uploaded files for this case. Click to view saved output.</p>
                {history.length === 0 ? (
                  <div style={dropdownEmpty}>No files uploaded for this case yet.</div>
                ) : (
                  <div style={{ display: 'grid', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
                    {history.map((rec) => (
                      <button key={rec.id} type="button" onClick={() => openRecord(rec)} style={{ ...historyItem, ...(activeRecordId === rec.id ? historyItemActive : null) }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {rec.audioDescription || rec.fileName || 'Untitled recording'}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-3)', marginTop: '2px' }}>
                          {rec.fileName || '—'} · {rec.speakerCount || 0} spk · {rec.createdAt ? new Date(rec.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ) : null}
          </div>

          <section style={{ ...card, minHeight: '520px' }}>
            {!result ? (
              <div style={emptyState}>
                <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--text-2)' }}>No speech result yet</h2>
                <p style={{ margin: '8px 0 0', maxWidth: '560px', fontSize: '13px', color: 'var(--text-3)' }}>
                  Choose an uploaded media file or record audio, then generate the transcript and conversation table.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '22px', color: 'var(--text)' }}>Transcription Result</h2>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {viewingHistory ? <span style={{ ...metaChip, color: '#1D4ED8', background: 'rgba(37,99,235,0.12)' }}>Saved record</span> : null}
                      <span style={metaChip}>Status: {result.status || 'completed'}</span>
                      <span style={{ ...metaChip, color: '#166534', background: 'rgba(22,163,74,0.12)' }}>{speakers.length} speaker{speakers.length === 1 ? '' : 's'}</span>
                      <span style={metaChip}>{segments.length} segment{segments.length === 1 ? '' : 's'}</span>
                      {result.diarization?.model_version ? <span style={metaChip}>{result.diarization.model_version}</span> : null}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => navigator.clipboard.writeText(transcriptText)} style={secondaryBtn}>Copy Text</button>
                    <button onClick={downloadJson} style={secondaryBtn}>Download JSON</button>
                    {intelRef ? (
                      <>
                        <button onClick={rerun} disabled={isProcessing} style={secondaryBtn}>Re-run</button>
                        <button onClick={certify} disabled={certifyStatus === 'saving' || certifyStatus === 'done'} style={certifyBtn(certifyStatus)}>
                          {certifyStatus === 'saving' ? 'Certifying…' : certifyStatus === 'done' ? 'Certified' : certifyStatus === 'error' ? 'Retry Certify' : 'Certify'}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                {speakers.length ? (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {speakers.map((sp) => <span key={sp} style={speakerBadge}>{sp}</span>)}
                  </div>
                ) : null}

                {!transcriptText && !rows.length ? (
                  <div style={warnBox}>No speech detected in this media — transcript and conversation table are empty.</div>
                ) : null}

                {transcriptText ? (
                  <Collapsible title="Transcript" open={open.transcript} onToggle={() => toggle('transcript')} scroll>
                    <p style={contentText}>{transcriptText}</p>
                  </Collapsible>
                ) : null}

                {rows.length ? (
                  <Collapsible title="Conversation Table" count={rows.length} open={open.table} onToggle={() => toggle('table')} scroll>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={table}>
                        <thead>
                          <tr>
                            <th style={th}>#</th>
                            <th style={th}>Time</th>
                            <th style={th}>Person</th>
                            <th style={th}>Conversation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={i}>
                              <td style={td}>{r.sl ?? i + 1}</td>
                              <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.time || ''}</td>
                              <td style={{ ...td, fontWeight: 700 }}>{r.person || ''}</td>
                              <td style={td}>{r.conversation || ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Collapsible>
                ) : null}

                {segments.length ? (
                  <Collapsible title="Segments" count={segments.length} open={open.segments} onToggle={() => toggle('segments')} scroll>
                    <div style={{ display: 'grid', gap: '8px' }}>
                      {segments.map((segment, index) => (
                        <div key={segment.segment_id || index} style={segmentCard}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                            <span style={speakerBadge}>{segment.speaker || 'Unknown'}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{fmtTime(segment.start)} – {fmtTime(segment.end)}</span>
                            {segment.overlap ? <span style={overlapChip}>overlap</span> : null}
                            {segment.flagged_for_review ? <span style={flagChip}>review · {segment.review_status || 'pending'}</span> : null}
                            {typeof segment.confidence === 'number' ? <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>conf {Math.round(segment.confidence * 100)}%</span> : null}
                          </div>
                          <p style={segmentText}>{segment.text || '— no transcript for this turn —'}</p>
                        </div>
                      ))}
                    </div>
                  </Collapsible>
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
const sectionTitle = { fontSize: '15px', color: 'var(--text)', fontWeight: 700 };
const uploadBox = { display: 'block', border: '2px dashed var(--border)', background: 'var(--surface-2)', borderRadius: '12px', padding: '18px', textAlign: 'center', cursor: 'pointer' };
const chip = { marginTop: '8px', border: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: '10px', padding: '8px 10px', fontSize: '12px', color: 'var(--text-2)' };
const primaryBtn = { border: '1px solid #00A84A', background: '#00C853', color: '#052E16', borderRadius: '11px', fontSize: '12px', fontWeight: 700, padding: '8px 12px', cursor: 'pointer' };
const secondaryBtn = { border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', borderRadius: '11px', fontSize: '12px', fontWeight: 700, padding: '8px 11px', cursor: 'pointer' };
const dangerBtn = { border: '1px solid #B91C1C', background: '#FEE2E2', color: '#991B1B', borderRadius: '11px', fontSize: '12px', fontWeight: 700, padding: '8px 11px', cursor: 'pointer' };
const recordingBanner = { marginTop: '8px', border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: '10px', padding: '8px 10px', fontSize: '12px', color: '#DC2626', fontWeight: 700 };
const generateBtn = { width: '100%', border: '1px solid #059669', background: 'linear-gradient(135deg,#16A34A,#059669)', color: '#FFFFFF', borderRadius: '11px', fontSize: '13px', fontWeight: 700, padding: '10px 12px', cursor: 'pointer' };
const progressTrack = { width: '100%', height: '8px', borderRadius: '999px', background: 'var(--surface-2)', overflow: 'hidden' };
const progressFill = { height: '100%', borderRadius: '999px', background: 'linear-gradient(135deg,#16A34A,#059669)', transition: 'width 0.4s ease' };
const emptyState = { minHeight: '470px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' };
const metaChip = { fontSize: '11px', color: 'var(--text-2)', background: 'var(--surface-2)', borderRadius: '999px', padding: '4px 9px', fontWeight: 700 };
const warnBox = { border: '1px solid #FDE68A', background: '#FFFBEB', borderRadius: '10px', padding: '9px 10px', fontSize: '12px', color: '#B45309' };
const collapseCard = { border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface-2)', overflow: 'hidden' };
const collapseHead = { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', border: 'none', background: 'transparent', padding: '11px 12px', cursor: 'pointer' };
const collapseTitle = { display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-2)', fontWeight: 700, letterSpacing: '0.3px' };
const collapseCount = { fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: 'rgba(22,163,74,0.12)', color: '#166534' };
const collapseChevron = { color: 'var(--text-3)', fontSize: '12px' };
const collapseBody = { padding: '0 12px 12px' };
const collapseBodyScroll = { padding: '0 12px 12px', maxHeight: '460px', overflowY: 'auto' };
const contentText = { margin: 0, fontSize: '13px', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' };
const table = { width: '100%', borderCollapse: 'collapse', fontSize: '12px' };
const th = { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text-3)', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px' };
const td = { padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text)', verticalAlign: 'top' };
const speakerBadge = { fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: 'rgba(22,163,74,0.12)', color: '#166534' };
const overlapChip = { fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: 'rgba(59,130,246,0.12)', color: '#1D4ED8' };
const flagChip = { fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: 'rgba(245,158,11,0.14)', color: '#B45309' };
const segmentCard = { border: '1px solid var(--border)', borderRadius: '10px', background: '#FFFFFF', padding: '10px' };
const segmentText = { margin: 0, fontSize: '13px', color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 };
const certifyBtn = (status) => ({ border: '1px solid', borderColor: status === 'done' ? '#059669' : 'var(--border)', background: status === 'done' ? '#059669' : 'var(--surface-2)', color: status === 'done' ? '#FFFFFF' : 'var(--text-2)', borderRadius: '11px', fontSize: '12px', fontWeight: 700, padding: '8px 11px', cursor: 'pointer' });
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
const historyItem = { border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface-2)', padding: '9px 11px', textAlign: 'left', cursor: 'pointer', width: '100%' };
const historyItemActive = { borderColor: 'rgba(37,99,235,0.4)', background: 'rgba(37,99,235,0.08)' };
