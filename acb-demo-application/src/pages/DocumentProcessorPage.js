import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const PIPELINE_STAGES = [
  { key: 'converting_pdf', label: 'Converting PDF', description: 'Rendering pages' },
  { key: 'running_ocr', label: 'Extracting Text', description: 'Reading page content' },
  { key: 'reconstructing_pages', label: 'Organizing Layout', description: 'Sorting document elements' },
  { key: 'detecting_subdocuments', label: 'Detecting Documents', description: 'Finding document boundaries' },
  { key: 'extracting_content', label: 'Identifying Names & Dates', description: 'Extracting key information' },
  { key: 'storing_results', label: 'Saving Evidence', description: 'Storing to database' },
  { key: 'generating_embeddings', label: 'Indexing Results', description: 'Making searchable' },
];

const stageStatusColor = {
  pending: { bg: 'var(--surface-2)', text: 'var(--text-3)', border: 'var(--border-2)', dot: '#9AA8BA', icon: '○' },
  active: { bg: 'rgba(29,78,216,0.08)', text: '#1D4ED8', border: 'rgba(29,78,216,0.28)', dot: '#2563EB', icon: '⟳' },
  completed: { bg: 'rgba(22,163,74,0.08)', text: '#166534', border: 'rgba(22,163,74,0.28)', dot: '#22C55E', icon: '✓' },
  failed: { bg: 'rgba(220,38,38,0.08)', text: '#991B1B', border: 'rgba(220,38,38,0.28)', dot: '#EF4444', icon: '⚠' },
};

function normalizeCases(data) {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => {
      const id = item.id || item.case_id || item.caseId;
      if (!id) return null;
      return {
        id,
        label: `${id}${item.title ? ` - ${item.title}` : ''}`,
      };
    })
    .filter(Boolean);
}

const CASE_PHASES = [
  { key: 'full_case', label: 'Full Case Document', description: 'Merged PDF with all documents' },
  { key: 'complaints', label: 'Complaints', description: 'Initial complaint documents' },
  { key: 'verification', label: 'Verification', description: 'Documents related to verification' },
  { key: 'approval', label: 'FIR / Approval', description: 'FIR and approval documents' },
  { key: 'trap', label: 'Trap Operations', description: 'Trap operation related documents' },
  { key: 'remand', label: 'Remand', description: 'Remand hearing documents' },
  { key: 'investigation', label: 'Investigation', description: 'Investigation documents' },
  { key: 'evidence', label: 'Evidence', description: 'Evidence documents' },
  { key: 'court', label: 'Court', description: 'Court related documents' },
  { key: 'prosecution', label: 'Prosecution', description: 'Prosecution documents' },
];

export default function DocumentProcessorPage() {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState('');
  const [caseSearch, setCaseSearch] = useState('');
  const [caseMenuOpen, setCaseMenuOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState('');
  const [phaseMenuOpen, setPhaseMenuOpen] = useState(false);
  const [existingDocs, setExistingDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);

  const [uiStage, setUiStage] = useState('idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [documentId, setDocumentId] = useState(null);
  const [currentStage, setCurrentStage] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [subdocs, setSubdocs] = useState([]);
  const [pagesData, setPagesData] = useState([]);
  const [savingToCase, setSavingToCase] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [logs, setLogs] = useState([]);
  const [stageProgress, setStageProgress] = useState({});
  const [apiMsg, setApiMsg] = useState('');
  const [viewingDocument, setViewingDocument] = useState(null);
  const [viewingDocumentContent, setViewingDocumentContent] = useState(null);
  const [viewingDocLoading, setViewingDocLoading] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState(null);
  const [pdfViewerFileName, setPdfViewerFileName] = useState(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const fileInputRef = useRef(null);
  const xhrRef = useRef(null);
  const pollRef = useRef(null);
  const caseMenuRef = useRef(null);
  const phaseMenuRef = useRef(null);

  const canGenerate = !!selectedCase && !!selectedPhase && !!file && uiStage === 'idle';
  const isBusy = uiStage === 'uploading' || uiStage === 'uploaded' || uiStage === 'processing';
  const selectedCaseDocs = useMemo(() => existingDocs || [], [existingDocs]);
  const selectedCaseItem = useMemo(() => cases.find((item) => item.id === selectedCase) || null, [cases, selectedCase]);
  const filteredCases = useMemo(() => {
    const q = caseSearch.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((item) => item.id.toLowerCase().includes(q) || item.label.toLowerCase().includes(q));
  }, [caseSearch, cases]);

  useEffect(() => {
    let cancelled = false;
    const loadCases = async () => {
      try {
        const primary = await fetch(`${BACKEND_URL}/api/cases`);
        const primaryData = await primary.json();
        const normalizedPrimary = normalizeCases(primaryData);
        if (normalizedPrimary.length && !cancelled) {
          setCases(normalizedPrimary);
          setApiMsg('');
          return;
        }
      } catch (_) {}

      try {
        const fallback = await fetch(`${BACKEND_URL}/api/pdf/cases`);
        const fallbackData = await fallback.json();
        const normalizedFallback = normalizeCases(fallbackData);
        if (!cancelled) {
          setCases(normalizedFallback);
          if (!normalizedFallback.length) setApiMsg(`No cases found from ${BACKEND_URL}.`);
        }
      } catch (_) {
        if (!cancelled) setApiMsg(`Backend not reachable at ${BACKEND_URL}.`);
      }
    };

    loadCases();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchCaseDocs = useCallback(async (caseId) => {
    setDocsLoading(true);
    setExistingDocs([]);
    try {
      const res = await fetch(`${BACKEND_URL}/api/pdf/case/${encodeURIComponent(caseId)}`);
      const data = await res.json();
      setExistingDocs(Array.isArray(data?.documents) ? data.documents : []);
    } catch (_) {
      setExistingDocs([]);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  const viewDocument = useCallback(async (doc) => {
    setViewingDocument(doc);
    setViewingDocLoading(true);
    setViewingDocumentContent(null);

    // Open side panel viewer
    const url = `${BACKEND_URL}/api/pdf/file/${encodeURIComponent(selectedCase)}/${encodeURIComponent(doc.file_name)}`;
    setPdfViewerUrl(url);
    setPdfViewerFileName(doc.original_name || doc.file_name);
    setPdfViewerOpen(true);

    try {
      const docId = doc.id || doc.document_id;
      const fetchUrl = `${BACKEND_URL}/api/pdf/document/${encodeURIComponent(selectedCase)}/${encodeURIComponent(docId)}`;
      console.log('Fetching extracted content:', fetchUrl);
      const res = await fetch(fetchUrl);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = await res.json();
      console.log('Extracted content loaded:', data);
      setViewingDocumentContent(data);
    } catch (err) {
      console.error('Error fetching extracted content:', err);
      setViewingDocumentContent(null);
    } finally {
      setViewingDocLoading(false);
    }
  }, [selectedCase]);

  const getStageStatus = useCallback(
    (stageKey) => {
      if (uiStage === 'done') return 'completed';
      if (uiStage === 'error' && currentStage === stageKey) return 'failed';
      const idx = PIPELINE_STAGES.findIndex((s) => s.key === stageKey);
      const activeIdx = PIPELINE_STAGES.findIndex((s) => s.key === currentStage);
      if (activeIdx === -1) return 'pending';
      if (idx < activeIdx) return 'completed';
      if (idx === activeIdx) return 'active';
      return 'pending';
    },
    [currentStage, uiStage]
  );

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    setIframeLoaded(false);
  }, [pdfViewerUrl]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!caseMenuRef.current?.contains(event.target)) setCaseMenuOpen(false);
      if (!phaseMenuRef.current?.contains(event.target)) setPhaseMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const startPolling = useCallback(
    (docId) => {
      pollRef.current = setInterval(async () => {
        try {
          const [statusRes, logsRes] = await Promise.all([
            fetch(`${BACKEND_URL}/api/pdf/status/${docId}`),
            fetch(`${BACKEND_URL}/api/pdf/logs/${docId}`),
          ]);
          const statusData = await statusRes.json();
          const logsData = await logsRes.json();
          setCurrentStage(statusData.current_stage || null);
          setTotalPages(statusData.total_pages || 0);
          setLogs(Array.isArray(logsData.logs) ? logsData.logs : []);
          if (statusData.stage_progress) setStageProgress(statusData.stage_progress);

          if (statusData.status === 'completed') {
            stopPolling();
            const [sdRes, pRes] = await Promise.all([
              fetch(`${BACKEND_URL}/api/pdf/subdocuments/${docId}`),
              fetch(`${BACKEND_URL}/api/pdf/pages/${docId}`)
            ]);
            const sdData = await sdRes.json();
            const pData = await pRes.json();
            setSubdocs(Array.isArray(sdData.subdocuments) ? sdData.subdocuments : []);
            setPagesData(Array.isArray(pData.pages) ? pData.pages : []);
            setUiStage('done');
            fetchCaseDocs(selectedCase);
          } else if (statusData.status === 'failed') {
            stopPolling();
            setErrorMsg(statusData.error_message || 'Pipeline failed');
            setUiStage('error');
          }
        } catch (_) {}
      }, 2000);
    },
    [fetchCaseDocs, selectedCase, stopPolling]
  );

  const handlePageTextChange = (idx, text) => {
    const updated = [...pagesData];
    updated[idx].page_text = text;
    setPagesData(updated);
  };

  const handleSaveToCase = async () => {
    if (!documentId) return;
    setSavingToCase(true);
    setSaveSuccess('');
    setErrorMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/pdf/save-to-case/${documentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: pagesData })
      });
      if (!res.ok) throw new Error('Failed to save to case');
      setSaveSuccess('Successfully saved to case evidence!');
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setSavingToCase(false);
    }
  };

  const reset = useCallback(() => {
    xhrRef.current?.abort();
    stopPolling();
    setUiStage('idle');
    setUploadPct(0);
    setUploadedFileName('');
    setDocumentId(null);
    setCurrentStage(null);
    setTotalPages(0);
    setSubdocs([]);
    setPagesData([]);
    setSavingToCase(false);
    setSaveSuccess('');
    setErrorMsg('');
    setLogs([]);
    setStageProgress({});
    setFile(null);
    setSelectedPhase('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [stopPolling]);

  const uploadPDF = useCallback(
    (selectedFile) =>
      new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('caseId', selectedCase);
        formData.append('phase', selectedPhase);
        formData.append('file', selectedFile);

        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadPct(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status === 201) {
            const data = JSON.parse(xhr.responseText);
            resolve({ file_name: data.file_name, document_id: data.document_id });
          } else {
            try {
              const parsed = JSON.parse(xhr.responseText);
              reject(new Error(parsed.detail || 'Upload failed'));
            } catch (_) {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));
        xhr.open('POST', `${BACKEND_URL}/api/pdf/upload`);
        xhr.send(formData);
      }),
    [selectedCase, selectedPhase]
  );

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setErrorMsg('');
    setSubdocs([]);
    setUploadPct(0);
    setCurrentStage(null);
    setLogs([]);
    setStageProgress({});
    setUiStage('uploading');
    try {
      const result = await uploadPDF(file);
      setUploadedFileName(result.file_name);
      setDocumentId(result.document_id);
      setUploadPct(100);
      setUiStage('uploaded');
      await new Promise((resolve) => setTimeout(resolve, 900));
      setUiStage('processing');
      startPolling(result.document_id);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Unexpected error');
      setUiStage('error');
    }
  }, [canGenerate, file, startPolling, uploadPDF]);

  const onFileChange = (event) => {
    const nextFile = event.target.files?.[0];
    if (nextFile && nextFile.type === 'application/pdf') setFile(nextFile);
  };
  const onDragOver = (event) => {
    event.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);
  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const nextFile = event.dataTransfer.files?.[0];
    if (nextFile && nextFile.type === 'application/pdf') setFile(nextFile);
  };

  const onSelectCase = (caseId) => {
    setSelectedCase(caseId);
    setSelectedPhase('');
    reset();
    if (caseId) fetchCaseDocs(caseId);
    else setExistingDocs([]);
    setCaseMenuOpen(false);
    setCaseSearch('');
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'grid', gap: '14px' }}>
      <div style={hero}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>📄</span>
          <h2 style={{ margin: 0, fontSize: '16px', color: '#FFFFFF', letterSpacing: '0.2px', fontWeight: 700 }}>AI Document Processor</h2>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#CBD9E8' }}>
          Process merged case PDFs and extract evidence.
        </p>
      </div>

      {apiMsg && (
        <div style={{ ...card, borderColor: '#FCA5A5', background: '#FEF2F2', color: '#991B1B', fontSize: '12px' }}>
          {apiMsg}
        </div>
      )}

      <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'minmax(320px,0.7fr) minmax(420px,1fr)' }}>
        <div style={{ display: 'grid', gap: '14px', alignContent: 'start' }}>
          <div style={card}>
            <h3 style={{ ...h3, marginBottom: '8px' }}>Case Selection</h3>
            <div style={selectField}>
              <div ref={caseMenuRef} style={dropdownWrap}>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => !isBusy && setCaseMenuOpen((prev) => !prev)}
                  style={{ ...dropdownTrigger, opacity: isBusy ? 0.7 : 1 }}
                >
                  <span style={{ ...dropdownValue, color: selectedCaseItem ? 'var(--text)' : 'var(--text-3)' }}>
                    {selectedCaseItem ? selectedCaseItem.label : '— Choose a case —'}
                  </span>
                  <span style={dropdownChevron}>{caseMenuOpen ? '▴' : '▾'}</span>
                </button>

                {caseMenuOpen && !isBusy && (
                  <div style={dropdownPanel}>
                    <input
                      value={caseSearch}
                      onChange={(e) => setCaseSearch(e.target.value)}
                      placeholder="Search case..."
                      style={dropdownSearchInput}
                    />
                    <div style={dropdownList}>
                      <button
                        type="button"
                        onClick={() => onSelectCase('')}
                        style={{ ...dropdownItem, ...(selectedCase === '' ? dropdownItemActive : null) }}
                      >
                        — Choose a case —
                      </button>
                      {filteredCases.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelectCase(item.id)}
                          style={{ ...dropdownItem, ...(selectedCase === item.id ? dropdownItemActive : null) }}
                        >
                          {item.label}
                        </button>
                      ))}
                      {filteredCases.length === 0 && <div style={dropdownNoResult}>No matching cases</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {selectedCase && (
            <div style={card}>
              <h3 style={{ ...h3, marginBottom: '8px' }}>Case Information</h3>
              <div style={{ display: 'grid', gap: '6px', fontSize: '12px' }}>
                <div><span style={{ color: 'var(--text-3)' }}>Case ID</span><br/><strong>{selectedCaseItem?.id || '—'}</strong></div>
              </div>
            </div>
          )}

          {selectedCase && (
            <div style={card}>
              <h3 style={{ ...h3, marginBottom: '8px' }}>Document Stage</h3>
              <div style={selectField}>
                <div ref={phaseMenuRef} style={dropdownWrap}>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => !isBusy && setPhaseMenuOpen((prev) => !prev)}
                    style={{ ...dropdownTrigger, opacity: isBusy ? 0.7 : 1 }}
                  >
                    <span style={{ ...dropdownValue, color: selectedPhase ? 'var(--text)' : 'var(--text-3)' }}>
                      {selectedPhase ? CASE_PHASES.find((p) => p.key === selectedPhase)?.label : '— Choose a phase —'}
                    </span>
                    <span style={dropdownChevron}>{phaseMenuOpen ? '▴' : '▾'}</span>
                  </button>

                  {phaseMenuOpen && !isBusy && (
                    <div style={dropdownPanel}>
                      <div style={dropdownList}>
                        <button
                          type="button"
                          onClick={() => setSelectedPhase('')}
                          style={{ ...dropdownItem, ...(selectedPhase === '' ? dropdownItemActive : null) }}
                        >
                          — Choose a phase —
                        </button>
                        {CASE_PHASES.map((phase) => (
                          <button
                            key={phase.key}
                            type="button"
                            onClick={() => {
                              setSelectedPhase(phase.key);
                              setPhaseMenuOpen(false);
                            }}
                            style={{ ...dropdownItem, ...(selectedPhase === phase.key ? dropdownItemActive : null), flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}
                          >
                            <div style={{ fontSize: '12px', fontWeight: 700 }}>{phase.label}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{phase.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedCase && (
            <div style={card}>
              <h3 style={h3}>Uploaded Documents</h3>
              {docsLoading ? (
                <div style={muted}>Loading…</div>
              ) : selectedCaseDocs.length === 0 ? (
                <div style={muted}>No documents uploaded yet for this case.</div>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {selectedCaseDocs.map((doc) => {
                    const phaseLabel = doc.phase ? CASE_PHASES.find((p) => p.key === doc.phase)?.label || doc.phase : 'No phase';
                    return (
                    <div key={doc.document_id} style={{ ...docRow, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', background: viewingDocument?.document_id === doc.document_id ? 'rgba(37,99,235,0.08)' : 'var(--surface-2)' }} onClick={() => viewDocument(doc)}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {doc.original_name || doc.file_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)', display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                          <span>{doc.status}</span>
                          {doc.total_pages > 0 && <span>{doc.total_pages} pages</span>}
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: 'rgba(37,99,235,0.12)', color: '#1D4ED8' }}>
                            {phaseLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {selectedCase && (
            <div style={{ ...card, borderColor: 'rgba(37,99,235,0.24)', background: 'rgba(37,99,235,0.02)' }}>
              <h3 style={{ ...h3, marginBottom: '10px', color: '#1D4ED8' }}>📁 Upload Document</h3>
              {!file ? (
                <button
                  style={{ ...dropzone, borderColor: dragging ? '#1D4ED8' : 'var(--border)' }}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Drop your PDF here</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>or click to browse</div>
                </button>
              ) : (
                <div style={{ ...docRow, borderColor: 'rgba(37,99,235,0.35)', background: 'rgba(37,99,235,0.06)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E3A8A' }}>{file.name}</div>
                  <div style={{ fontSize: '11px', color: '#1D4ED8' }}>
                    {file.size >= 1048576 ? `${(file.size / 1048576).toFixed(2)} MB` : `${(file.size / 1024).toFixed(1)} KB`} · PDF
                  </div>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={onFileChange} style={{ display: 'none' }} />
            </div>
          )}

          {selectedCase && (
            <button onClick={handleGenerate} disabled={!canGenerate} style={{ ...primaryBtn, opacity: canGenerate ? 1 : 0.5 }}>
              {uiStage === 'uploading' ? `Uploading… ${uploadPct}%` : isBusy ? 'Processing…' : 'Extract Data'}
            </button>
          )}

          {(uiStage === 'done' || uiStage === 'error') && (
            <button onClick={reset} style={secondaryBtn}>
              Start New
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gap: '14px', gridTemplateRows: 'auto auto' }}>
          {uiStage === 'idle' && viewingDocument && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ ...card, height: '350px', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {pdfViewerOpen ? (
                <>
                  {!iframeLoaded && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTop: '3px solid #2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                        <div style={{ fontSize: '12px' }}>Loading PDF...</div>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      </div>
                    </div>
                  )}
                  <iframe
                    src={pdfViewerUrl}
                    style={{
                      flex: 1,
                      border: 'none',
                      opacity: iframeLoaded ? 1 : 0.5,
                    }}
                    title="PDF Viewer"
                    onLoad={() => setIframeLoaded(true)}
                  />
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>📄</div>
                    <div style={{ fontSize: '12px' }}>Click document to view</div>
                  </div>
                </div>
              )}
            </div>

            {/* Extracted Content Section - Orange Box */}
            {(viewingDocLoading || (viewingDocumentContent && !viewingDocLoading)) && (
              <div style={{ ...card, background: 'rgba(255, 140, 0, 0.05)', borderColor: 'rgba(255, 140, 0, 0.3)', maxHeight: '400px', overflow: 'auto' }}>
                {viewingDocLoading && <div style={muted}>Loading extracted content...</div>}

                {viewingDocumentContent && !viewingDocLoading && (
                  <div style={{ display: 'grid', gap: '16px' }}>
                  {viewingDocumentContent.pages && viewingDocumentContent.pages.length > 0 && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>Extracted Content</div>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {viewingDocumentContent.pages.map((page, idx) => (
                          <div key={idx} style={{ ...docRow, padding: '10px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)', marginBottom: '4px' }}>Page {page.page_number}</div>
                            <div style={{ fontSize: '11px', lineHeight: 1.4, color: 'var(--text)' }}>{page.page_text || 'No text'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {viewingDocumentContent.subdocuments && viewingDocumentContent.subdocuments.length > 0 && (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>Detected Documents</div>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {viewingDocumentContent.subdocuments.map((subdoc, idx) => (
                          <div key={idx} style={docRow}>
                            <div style={{ fontSize: '11px', fontWeight: 700 }}>{idx + 1}. {subdoc.title}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }}>
                              {subdoc.document_type} · Pages {subdoc.start_page}-{subdoc.end_page}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                )}
              </div>
            )}
            </div>
          )}

          {uiStage === 'idle' && !viewingDocument && (
            <div style={{ display: 'grid', gap: '10px' }}>
              <h3 style={{ ...h3, marginBottom: 0 }}>Processing Pipeline</h3>
              <div style={muted}>
                {selectedCase ? (
                  <>Upload a PDF to see the processing steps.</>
                ) : (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: '6px' }}>Getting Started</div>
                    <ol style={{ margin: '0', paddingLeft: '18px', lineHeight: 1.6 }}>
                      <li>Select a case</li>
                      <li>Upload merged PDF</li>
                      <li>Start AI Processing</li>
                    </ol>
                  </>
                )}
              </div>
              {selectedCase && (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {PIPELINE_STAGES.map((stage) => (
                    <div key={stage.key} style={stageRow('pending')}>
                      <span style={{ fontSize: '14px', width: '20px', textAlign: 'center' }}>○</span>
                      <div style={{ display: 'grid', gap: '2px', flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700 }}>{stage.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {uiStage === 'uploading' && (
            <div style={{ display: 'grid', gap: '12px' }}>
              <h3 style={h3}>Uploading Document</h3>
              <div style={{ ...docRow, background: 'var(--surface-2)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700 }}>{file?.name}</div>
                <div style={{ fontSize: '11px', color: '#1D4ED8' }}>{uploadPct}%</div>
              </div>
              <div style={{ height: '10px', borderRadius: '999px', background: 'var(--surface-3)', overflow: 'hidden' }}>
                <div style={{ width: `${uploadPct}%`, height: '100%', background: 'linear-gradient(90deg,#1D4ED8,#0E7490)' }} />
              </div>
            </div>
          )}

          {uiStage === 'uploaded' && (
            <div style={{ display: 'grid', gap: '8px', textAlign: 'center' }}>
              <h3 style={h3}>Upload Successful</h3>
              <div style={muted}>{uploadedFileName}</div>
            </div>
          )}

          {uiStage === 'processing' && (
            <div style={{ display: 'grid', gap: '10px' }}>
              <h3 style={h3}>Processing in Progress</h3>
              <div style={muted}>
                {totalPages ? `${totalPages} pages` : 'Processing'}
              </div>

              {/* Overall Progress */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px' }}>
                  {PIPELINE_STAGES.filter((s) => getStageStatus(s.key) === 'completed').length}/{PIPELINE_STAGES.length} Steps
                </div>
                <div style={{ height: '8px', borderRadius: '999px', background: 'var(--surface-3)', overflow: 'hidden' }}>
                  <div style={{ width: `${(PIPELINE_STAGES.filter((s) => getStageStatus(s.key) === 'completed').length / PIPELINE_STAGES.length) * 100}%`, height: '100%', background: 'linear-gradient(90deg,#1D4ED8,#0E7490)', transition: 'width 0.3s ease' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gap: '6px' }}>
                {PIPELINE_STAGES.map((stage) => {
                  const status = getStageStatus(stage.key);
                  const icon = stageStatusColor[status].icon;
                  return (
                    <div key={stage.key} style={stageRow(status)}>
                      <span style={{ fontSize: '14px', width: '20px', textAlign: 'center', fontWeight: 700 }}>{icon}</span>
                      <div style={{ display: 'grid', gap: '2px', flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 700 }}>{stage.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!!logs.length && (
                <pre style={logBox}>
                  {logs.slice(-80).join('\n')}
                </pre>
              )}
            </div>
          )}

          {uiStage === 'error' && (
            <div style={{ display: 'grid', gap: '8px' }}>
              <h3 style={{ ...h3, color: '#B91C1C' }}>Pipeline Failed</h3>
              <div style={{ fontSize: '12px', color: '#991B1B' }}>{errorMsg || 'Pipeline failed'}</div>
              {!!logs.length && <pre style={logBox}>{logs.slice(-80).join('\n')}</pre>}
            </div>
          )}

          {uiStage === 'done' && (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={h3}>✓ Extraction Complete</h3>
                <button
                  onClick={handleSaveToCase}
                  disabled={savingToCase}
                  style={{ ...primaryBtn, padding: '8px 12px', fontSize: '12px' }}
                >
                  {savingToCase ? 'Saving...' : 'Save to Case'}
                </button>
              </div>
              {saveSuccess && <div style={{ color: '#166534', fontSize: '12px', fontWeight: 600 }}>{saveSuccess}</div>}
              <div style={muted}>
                {subdocs.length} documents found · {totalPages} pages processed
              </div>
              
              <div style={{ display: 'grid', gap: '16px', maxHeight: '560px', overflow: 'auto' }}>
                <div style={{ fontWeight: 700, fontSize: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Page-wise Data</div>
                {pagesData.map((p, idx) => (
                  <div key={p.page_number} style={{ display: 'grid', gap: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>Page {p.page_number}</div>
                    <textarea
                      value={p.page_text || ''}
                      onChange={(e) => handlePageTextChange(idx, e.target.value)}
                      style={{ ...input, minHeight: '120px', resize: 'vertical', fontFamily: 'monospace' }}
                    />
                  </div>
                ))}
                
                <div style={{ fontWeight: 700, fontSize: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginTop: '16px' }}>Detected Sub-Documents</div>
                {subdocs.map((item, index) => (
                  <div key={`${item.id}-${index}`} style={docRow}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>
                      {index + 1}. {item.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                      {item.document_type} · Pages {item.start_page}-{item.end_page} · {Math.round((item.confidence_score || 0) * 100)}%
                    </div>
                    {item.content?.summary ? <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '4px' }}>{item.content.summary}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const hero = {
  background: 'linear-gradient(135deg,#0E141F 0%,#162236 100%)',
  border: '1px solid #1C2A40',
  borderRadius: '14px',
  boxShadow: 'var(--shadow)',
  padding: '12px 16px',
};

const card = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  borderRadius: '14px',
  boxShadow: 'var(--shadow)',
  padding: '16px',
};

const h3 = {
  margin: '0 0 10px',
  fontSize: '16px',
  color: 'var(--text)',
  fontWeight: 700,
};

const label = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '12px',
  color: 'var(--text-2)',
  fontWeight: 700,
};

const input = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: '11px',
  padding: '10px 11px',
  fontSize: '12px',
  color: 'var(--text)',
  background: 'var(--surface-2)',
};

const selectField = {
  border: '1px solid var(--border)',
  borderRadius: '12px',
  background: 'var(--surface)',
  padding: '10px',
};

const dropdownWrap = {
  position: 'relative',
};

const dropdownTrigger = {
  ...input,
  borderColor: 'var(--border)',
  background: 'var(--surface-2)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  cursor: 'pointer',
  fontWeight: 600,
  minHeight: '40px',
};

const dropdownValue = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textAlign: 'left',
};

const dropdownChevron = {
  color: 'var(--text-3)',
  fontSize: '12px',
  flexShrink: 0,
};

const dropdownPanel = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  right: 0,
  zIndex: 30,
  border: '1px solid var(--border)',
  borderRadius: '12px',
  background: 'var(--surface)',
  boxShadow: 'var(--shadow)',
  padding: '8px',
};

const dropdownSearchInput = {
  ...input,
  borderColor: 'var(--border-2)',
  background: 'var(--surface-2)',
  marginBottom: '8px',
};

const dropdownList = {
  maxHeight: '210px',
  overflowY: 'auto',
  display: 'grid',
  gap: '4px',
};

const dropdownItem = {
  border: '1px solid transparent',
  background: 'var(--surface)',
  color: 'var(--text-2)',
  borderRadius: '9px',
  padding: '8px 10px',
  fontSize: '12px',
  fontWeight: 600,
  textAlign: 'left',
  cursor: 'pointer',
};

const dropdownItemActive = {
  borderColor: 'rgba(37,99,235,0.24)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
};

const dropdownNoResult = {
  border: '1px dashed var(--border)',
  borderRadius: '9px',
  padding: '10px',
  fontSize: '12px',
  color: 'var(--text-3)',
  textAlign: 'center',
};

const selectHint = {
  marginTop: '6px',
  fontSize: '11px',
  color: 'var(--text-3)',
};

const dropzone = {
  width: '100%',
  borderRadius: '12px',
  border: '2px dashed var(--border)',
  background: 'var(--surface-2)',
  padding: '22px 12px',
  cursor: 'pointer',
  textAlign: 'center',
};

const primaryBtn = {
  border: '1px solid #00A84A',
  background: '#00C853',
  color: '#052E16',
  borderRadius: '11px',
  fontSize: '13px',
  fontWeight: 700,
  padding: '12px 14px',
  boxShadow: '0 6px 14px rgba(0,200,83,0.2)',
  cursor: 'pointer',
};

const secondaryBtn = {
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text-2)',
  borderRadius: '11px',
  fontSize: '13px',
  fontWeight: 700,
  padding: '10px',
  cursor: 'pointer',
};

const muted = {
  fontSize: '12px',
  color: 'var(--text-3)',
};

const docRow = {
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '9px 10px',
  background: 'var(--surface-2)',
};

const viewIconBtn = {
  width: '30px',
  height: '30px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: '#2563EB',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  textDecoration: 'none',
  cursor: 'pointer',
  padding: 0,
  transition: 'all 0.2s',
};

const indexBadge = {
  width: '24px',
  height: '24px',
  borderRadius: '999px',
  background: '#8FA1B6',
  color: '#FFFFFF',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '11px',
  fontWeight: 700,
  flexShrink: 0,
};

const stageRow = (status) => ({
  border: `1px solid ${stageStatusColor[status].border}`,
  background: stageStatusColor[status].bg,
  color: stageStatusColor[status].text,
  borderRadius: '10px',
  padding: '8px 9px',
  display: 'flex',
  gap: '10px',
  alignItems: 'flex-start',
  boxShadow: status === 'active' ? '0 2px 10px rgba(29,78,216,0.08)' : 'none',
});

const progressTag = (status) => ({
  padding: '2px 8px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 700,
  background: status === 'active' ? 'rgba(29,78,216,0.12)' : 'rgba(22,163,74,0.12)',
  color: status === 'active' ? '#1D4ED8' : '#166534',
});

const logBox = {
  margin: 0,
  border: '1px solid #243247',
  background: '#0D1727',
  color: '#B9F3D0',
  borderRadius: '10px',
  padding: '10px',
  fontSize: '11px',
  lineHeight: 1.4,
  maxHeight: '220px',
  overflow: 'auto',
};
