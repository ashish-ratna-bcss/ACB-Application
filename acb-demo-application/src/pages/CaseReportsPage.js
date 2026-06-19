import { useEffect, useMemo, useRef, useState } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const DRAFT_SECTIONS = [
  'Introduction',
  'Service Particulars of Accused Officer',
  'Allegation in Brief',
  'Complaint',
  'Registration of FIR',
  'Pre-Trap Proceedings',
  'Post-Trap Proceedings',
  'Oral Evidence',
  'Documentary Evidence',
  'Analysis of Evidence',
  'Findings of Investigation',
  'Abstract of Findings & Recommendations',
  'Request for Prosecution Sanction',
  'Call Data Records',
  'Legal Precedents',
];

function fmtDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function statusStyle(status) {
  if (status === 'completed') return { label: 'Completed', color: '#166534', bg: 'rgba(34,197,94,0.12)' };
  if (status === 'processing') return { label: 'Processing', color: '#166534', bg: 'rgba(22,163,74,0.12)' };
  if (status === 'failed') return { label: 'Failed', color: '#991B1B', bg: 'rgba(239,68,68,0.12)' };
  return { label: 'Uploaded', color: '#475569', bg: 'rgba(148,163,184,0.16)' };
}

function DraftModal({ draft, onClose }) {
  if (!draft) return null;
  const html = draft.report_html || draft.reportHtml;
  return (
    <div style={modalBackdrop}>
      <div style={modalCard}>
        <div style={modalHead}>
          <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text)' }}>Draft Report</h3>
          <button onClick={onClose} style={secondaryBtn}>Close</button>
        </div>
        <div style={{ maxHeight: '70vh', overflow: 'auto', padding: '14px' }}>
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <pre style={preBox}>{JSON.stringify(draft, null, 2)}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

function SubDocCard({ subdoc, index }) {
  const [open, setOpen] = useState(false);
  const content = subdoc.content || {};
  return (
    <div style={subdocCard}>
      <button onClick={() => setOpen((v) => !v)} style={subdocHeaderBtn}>
        <div style={subdocIndex}>{index + 1}</div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{subdoc.title}</div>
          <div style={{ marginTop: '2px', fontSize: '11px', color: 'var(--text-3)' }}>
            {subdoc.document_type} · Pages {subdoc.start_page}-{subdoc.end_page} · {Math.round((subdoc.confidence_score || 0) * 100)}%
          </div>
        </div>
      </button>
      {content.summary ? <div style={subdocSummary}>{content.summary}</div> : null}
      {open ? (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-2)' }}>
          {content.subject ? <InfoBlock title="Subject" value={content.subject} /> : null}
          {content.purpose ? <InfoBlock title="Purpose" value={content.purpose} /> : null}
          {content.key_findings?.length ? <PillBlock title="Key Findings" items={content.key_findings} /> : null}
          {content.key_actions?.length ? <PillBlock title="Key Actions" items={content.key_actions} /> : null}
          {content.key_persons?.length ? <PillBlock title="People" items={content.key_persons} /> : null}
          {content.organizations?.length ? <PillBlock title="Organizations" items={content.organizations} /> : null}
          {content.key_dates?.length ? <PillBlock title="Dates" items={content.key_dates} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function DocumentCard({ doc }) {
  const [open, setOpen] = useState(true);
  const st = statusStyle(doc.status);
  return (
    <div style={docWrap}>
      <button onClick={() => setOpen((v) => !v)} style={docHeadBtn}>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px', color: '#FFFFFF', fontWeight: 700 }}>{doc.original_name || doc.file_name}</div>
            <span style={{ fontSize: '11px', borderRadius: '999px', padding: '3px 8px', background: st.bg, color: st.color, fontWeight: 700 }}>{st.label}</span>
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px', color: '#A8BED7' }}>
            Doc ID: {doc.document_id} · {doc.total_pages} pages · {doc.subdocument_count} sub-docs · {fmtDate(doc.created_at)}
          </div>
          {doc.current_stage && doc.status === 'processing' ? <div style={{ marginTop: '4px', fontSize: '11px', color: '#86EFAC' }}>{doc.current_stage.replace(/_/g, ' ')}</div> : null}
          {doc.error_message && doc.status === 'failed' ? <div style={{ marginTop: '4px', fontSize: '11px', color: '#FCA5A5' }}>{doc.error_message}</div> : null}
        </div>
      </button>
      {open ? (
        <div style={{ padding: '12px', background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
          {doc.subdocuments?.length ? (
            <div style={{ display: 'grid', gap: '8px' }}>
              {doc.subdocuments.map((sd, idx) => <SubDocCard key={sd.id || `${doc.document_id}-${idx}`} subdoc={sd} index={idx} />)}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
              {doc.status === 'completed' ? 'No sub-documents extracted.' : 'Sub-documents will appear after processing completes.'}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MediaRecordCard({ rec, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={subdocCard}>
      <button onClick={() => setOpen((v) => !v)} style={subdocHeaderBtn}>
        <div style={{ ...subdocIndex, background: 'linear-gradient(135deg,#16A34A,#059669)' }}>{index + 1}</div>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)' }}>{rec.audioDescription || rec.fileName || 'Untitled recording'}</div>
          <div style={{ marginTop: '2px', fontSize: '11px', color: 'var(--text-3)' }}>
            {(rec.task || 'transcribe').toUpperCase()} · {rec.languageName || rec.language || '--'} {rec.targetLanguageName ? `→ ${rec.targetLanguageName}` : ''} · {fmtDate(rec.createdAt)}
          </div>
        </div>
      </button>
      {rec.text ? <div style={subdocSummary}>{rec.text}</div> : null}
      {open && rec.segments?.length ? (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-2)', display: 'grid', gap: '8px', maxHeight: '320px', overflow: 'auto' }}>
          {rec.segments.map((segment, idx) => (
            <div key={`${rec.id}-${idx}`} style={{ border: '1px solid var(--border-2)', borderRadius: '8px', padding: '8px', background: 'var(--surface-2)' }}>
              <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700 }}>{segment.speaker || `Speaker ${idx + 1}`}</div>
              <div style={{ marginTop: '3px', fontSize: '11px', color: 'var(--text-2)' }}>{segment.text}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function InfoBlock({ title, value }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={tinyTitle}>{title}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{value}</div>
    </div>
  );
}

function PillBlock({ title, items }) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={tinyTitle}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {items.map((item) => <span key={item} style={pill}>{item}</span>)}
      </div>
    </div>
  );
}

function DraftProgressPanel({ current, total }) {
  return (
    <div style={draftPanel}>
      <div style={{ fontSize: '12px', color: '#86EFAC', fontWeight: 700, marginBottom: '8px' }}>
        Generating Draft Report · {current}/{total} sections
      </div>
      <div style={{ display: 'grid', gap: '6px' }}>
        {DRAFT_SECTIONS.map((section, idx) => {
          const pos = idx + 1;
          const active = pos === current;
          const done = pos < current;
          return (
            <div key={section} style={{
              border: '1px solid',
              borderColor: active ? 'rgba(22,163,74,0.35)' : done ? 'rgba(16,185,129,0.28)' : 'rgba(255,255,255,0.1)',
              background: active ? 'rgba(22,163,74,0.12)' : done ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.02)',
              color: active ? '#86EFAC' : done ? '#86EFAC' : '#94A3B8',
              borderRadius: '8px',
              padding: '7px 10px',
              fontSize: '12px',
              fontWeight: 600,
            }}>
              {pos}. {section}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CaseReportsPage() {
  const [cases, setCases] = useState([]);
  const [caseMenuOpen, setCaseMenuOpen] = useState(false);
  const [caseSearch, setCaseSearch] = useState('');
  const [caseStats, setCaseStats] = useState({});
  const [selectedCase, setSelectedCase] = useState('');
  const [caseDetail, setCaseDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [casesLoading, setCasesLoading] = useState(true);
  const [error, setError] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [draft, setDraft] = useState(null);
  const [draftProgress, setDraftProgress] = useState(null);
  const [savedDraftExists, setSavedDraftExists] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState('');
  const [mediaRecords, setMediaRecords] = useState([]);
  const [mediaRecordsLoading, setMediaRecordsLoading] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(true);
  const caseMenuRef = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND_URL}/cases`).then((r) => r.json()),
      fetch(`${BACKEND_URL}/pdf/cases`).then((r) => r.json()).catch(() => ({ cases: [] })),
    ])
      .then(([allCases, pdfData]) => {
        setCases(Array.isArray(allCases) ? allCases : []);
        const map = {};
        for (const item of pdfData?.cases || []) map[item.case_id] = item;
        setCaseStats(map);
      })
      .catch(() => setError('Failed to load cases'))
      .finally(() => setCasesLoading(false));
  }, []);

  const selected = useMemo(() => cases.find((item) => item.id === selectedCase), [cases, selectedCase]);
  const selectedLabel = useMemo(() => {
    const found = cases.find((item) => item.id === selectedCase);
    return found ? `${found.id} - ${found.title}` : '— Select a case —';
  }, [cases, selectedCase]);
  const filteredCases = useMemo(() => {
    const q = caseSearch.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((item) => (`${item.id} ${item.title || ''}`).toLowerCase().includes(q));
  }, [cases, caseSearch]);
  const selectedStats = selectedCase ? caseStats[selectedCase] : null;

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!caseMenuRef.current?.contains(event.target)) setCaseMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function refreshMedia() {
    if (!selectedCase) return;
    setMediaRecordsLoading(true);
    fetch(`${BACKEND_URL}/media-records?case_id=${encodeURIComponent(selectedCase)}`)
      .then((r) => r.json())
      .then((d) => setMediaRecords(Array.isArray(d) ? d : []))
      .catch(() => setMediaRecords([]))
      .finally(() => setMediaRecordsLoading(false));
  }

  function selectCase(caseId) {
    setSelectedCase(caseId);
    setCaseDetail(null);
    setError('');
    setSavedDraftExists(false);
    setMediaRecords([]);
    if (!caseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${BACKEND_URL}/pdf/case/${encodeURIComponent(caseId)}`)
      .then((r) => r.json())
      .then((d) => setCaseDetail(d))
      .catch(() => setError('Failed to load case details'))
      .finally(() => setLoading(false));
    fetch(`${BACKEND_URL}/pdf/saved-draft/${encodeURIComponent(caseId)}`)
      .then((r) => {
        if (r.ok) setSavedDraftExists(true);
      })
      .catch(() => {});
    setMediaRecordsLoading(true);
    fetch(`${BACKEND_URL}/media-records?case_id=${encodeURIComponent(caseId)}`)
      .then((r) => r.json())
      .then((d) => setMediaRecords(Array.isArray(d) ? d : []))
      .catch(() => setMediaRecords([]))
      .finally(() => setMediaRecordsLoading(false));
  }

  function refresh() {
    if (selectedCase) selectCase(selectedCase);
  }

  async function reindexCase() {
    if (!selectedCase || reindexing) return;
    setReindexing(true);
    setReindexMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/pdf/reindex/${encodeURIComponent(selectedCase)}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Reindex failed');
      setReindexMsg(`✓ ${data.embeddings_stored} embeddings stored`);
    } catch (err) {
      setReindexMsg(`✗ ${err instanceof Error ? err.message : 'Reindex failed'}`);
    } finally {
      setReindexing(false);
    }
  }

  async function generateDraft() {
    if (!selectedCase || draftLoading) return;
    setDraftLoading(true);
    setDraftProgress(null);
    const timer = setInterval(async () => {
      try {
        const progress = await fetch(`${BACKEND_URL}/pdf/draft-progress/${encodeURIComponent(selectedCase)}`).then((r) => r.json());
        if (progress?.total) setDraftProgress(progress);
      } catch (_) {}
    }, 2000);
    try {
      const res = await fetch(`${BACKEND_URL}/pdf/generate-draft/${encodeURIComponent(selectedCase)}`);
      if (!res.ok) throw new Error('Failed to generate draft');
      const data = await res.json();
      setDraft(data);
    } catch (_) {
      setError('Failed to generate draft report');
    } finally {
      clearInterval(timer);
      setDraftLoading(false);
      setDraftProgress(null);
    }
  }

  async function viewSavedDraft() {
    if (!selectedCase) return;
    try {
      const res = await fetch(`${BACKEND_URL}/pdf/saved-draft/${encodeURIComponent(selectedCase)}`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      setDraft(data);
    } catch (_) {
      setError('Failed to load saved draft');
    }
  }

  function downloadRaw() {
    if (!caseDetail) return;
    const lines = [
      'ACB INVESTIGATION REPORT',
      `Case ID: ${caseDetail.case_id}`,
      `Generated: ${new Date().toLocaleString('en-IN')}`,
      `Documents: ${caseDetail.document_count} | Sub-documents: ${caseDetail.total_subdocuments}`,
      ''.padEnd(70, '='),
    ];
    for (const doc of caseDetail.documents || []) {
      lines.push(`\nDOCUMENT: ${doc.original_name || doc.file_name}`);
      lines.push(`Status: ${doc.status} | Pages: ${doc.total_pages} | Sub-docs: ${doc.subdocument_count}`);
      lines.push(''.padEnd(70, '-'));
      for (const subdoc of doc.subdocuments || []) {
        lines.push(`\n${subdoc.title}`);
        lines.push(`Type: ${subdoc.document_type} | Pages ${subdoc.start_page}-${subdoc.end_page} | Confidence ${Math.round((subdoc.confidence_score || 0) * 100)}%`);
        const c = subdoc.content || {};
        if (c.summary) lines.push(`Summary: ${c.summary}`);
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ACB_Report_${caseDetail.case_id}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ maxWidth: '1480px', margin: '0 auto', display: 'grid', gap: '16px' }}>
      <section style={hero}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
          <div style={folderIcon}>📂</div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF' }}>Select Investigation Case</div>
            <div style={{ fontSize: '12px', color: '#A8BED7' }}>Choose a case to view documents and AI-extracted sub-documents</div>
          </div>
        </div>

        {casesLoading ? (
          <div style={{ fontSize: '13px', color: '#B8C7DA' }}>Loading cases…</div>
        ) : (
          <div ref={caseMenuRef} style={heroDropdownWrap}>
            <button type="button" onClick={() => setCaseMenuOpen((v) => !v)} style={heroDropdownTrigger}>
              <span style={heroDropdownValue}>{selectedLabel}</span>
              <span style={heroDropdownChevron}>{caseMenuOpen ? '▴' : '▾'}</span>
            </button>
            {caseMenuOpen ? (
              <div style={heroDropdownPanel}>
                <input value={caseSearch} onChange={(e) => setCaseSearch(e.target.value)} style={heroDropdownSearch} placeholder="Search case..." />
                <div style={heroDropdownList}>
                  <button
                    type="button"
                    onClick={() => { selectCase(''); setCaseMenuOpen(false); setCaseSearch(''); }}
                    style={{ ...heroDropdownItem, ...(selectedCase === '' ? heroDropdownItemActive : null) }}
                  >
                    — Select a case —
                  </button>
                  {filteredCases.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { selectCase(item.id); setCaseMenuOpen(false); setCaseSearch(''); }}
                      style={{ ...heroDropdownItem, ...(selectedCase === item.id ? heroDropdownItemActive : null) }}
                    >
                      {item.id} - {item.title}
                    </button>
                  ))}
                  {filteredCases.length === 0 ? <div style={heroDropdownEmpty}>No matching cases</div> : null}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {selected ? (
          <div style={statGrid}>
            <StatTile label="Documents" value={selectedStats?.document_count ?? '—'} color="#86EFAC" />
            <StatTile label="Completed" value={selectedStats?.completed_count ?? '—'} color="#86EFAC" />
            <StatTile label="Total Pages" value={selectedStats?.total_pages ?? '—'} color="#86EFAC" />
            <StatTile label="Sub-docs" value={caseDetail?.total_subdocuments ?? '—'} color="#16A34A" />
          </div>
        ) : null}
      </section>

      {loading ? <div style={card}>Loading case data...</div> : null}
      {error && !loading ? <div style={errorBox}>{error}</div> : null}

      {caseDetail && !loading ? (
        <section style={{ display: 'grid', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '15px', color: 'var(--text)', fontWeight: 700 }}>
              {caseDetail.document_count} Document{caseDetail.document_count !== 1 ? 's' : ''} · {caseDetail.total_subdocuments} sub-document{caseDetail.total_subdocuments !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={refresh} style={secondaryBtn}>Refresh</button>
              {caseDetail.total_subdocuments > 0 ? <button onClick={downloadRaw} style={secondaryBtn}>Download Raw</button> : null}
              <button onClick={reindexCase} disabled={reindexing} style={secondaryBtn}>{reindexing ? 'Indexing...' : 'Reindex Embeddings'}</button>
              {savedDraftExists ? <button onClick={viewSavedDraft} style={viewDraftBtn}>View Draft Report</button> : null}
              <button onClick={generateDraft} disabled={draftLoading} style={generateBtn(draftLoading)}>{draftLoading ? 'Generating...' : 'Generate Draft Report'}</button>
            </div>
          </div>

          {reindexMsg ? <div style={{ fontSize: '12px', color: reindexMsg.startsWith('✓') ? '#15803D' : '#B91C1C', fontWeight: 700 }}>{reindexMsg}</div> : null}

          {draftLoading ? (
            <DraftProgressPanel current={draftProgress?.current ?? 0} total={draftProgress?.total ?? DRAFT_SECTIONS.length} />
          ) : null}

          {(caseDetail.documents || []).map((doc) => <DocumentCard key={doc.document_id} doc={doc} />)}

          <div style={docWrap}>
            <button onClick={() => setMediaOpen((v) => !v)} style={mediaHeadBtn}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>Media Records</div>
              <div style={{ fontSize: '11px', color: '#86EFAC' }}>{mediaRecordsLoading ? '...' : mediaRecords.length}</div>
            </button>
            {mediaOpen ? (
              <div style={{ padding: '12px', background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
                <div style={{ marginBottom: '8px' }}>
                  <button onClick={refreshMedia} style={secondaryBtn}>Refresh Media</button>
                </div>
                {mediaRecordsLoading ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Loading media records...</div>
                ) : mediaRecords.length ? (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {mediaRecords.map((rec, idx) => <MediaRecordCard key={rec.id || idx} rec={rec} index={idx} />)}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>No media records saved for this case yet.</div>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {!selectedCase && !casesLoading ? (
        <div style={card}>
          <div style={{ fontSize: '16px', color: 'var(--text-2)', fontWeight: 700 }}>Select a Case</div>
          <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--text-3)' }}>
            Choose a case from the dropdown above to view all uploaded documents and AI-extracted sub-documents.
          </div>
        </div>
      ) : null}

      <DraftModal draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

function StatTile({ label, value, color }) {
  return (
    <div style={statTile}>
      <div style={{ fontSize: '22px', fontWeight: 700, color }}>{value}</div>
      <div style={{ marginTop: '2px', fontSize: '11px', color: '#A8BED7' }}>{label}</div>
    </div>
  );
}

const hero = {
  background: 'linear-gradient(135deg,#0E141F 0%,#162236 100%)',
  border: '1px solid #1C2A40',
  borderRadius: '14px',
  boxShadow: 'var(--shadow)',
  padding: '20px 22px',
};

const folderIcon = {
  width: '42px',
  height: '42px',
  borderRadius: '12px',
  background: 'rgba(22,163,74,0.18)',
  border: '1px solid rgba(22,163,74,0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '20px',
};

const heroSelect = {
  width: '100%',
  border: '1px solid rgba(22,163,74,0.35)',
  borderRadius: '11px',
  background: 'rgba(15,23,42,0.6)',
  color: '#E2E8F0',
  fontSize: '13px',
  padding: '10px 12px',
};

const heroDropdownWrap = {
  position: 'relative',
};

const heroDropdownTrigger = {
  ...heroSelect,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  cursor: 'pointer',
  minHeight: '42px',
};

const heroDropdownValue = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textAlign: 'left',
};

const heroDropdownChevron = {
  color: '#B8C7DA',
  fontSize: '12px',
  flexShrink: 0,
};

const heroDropdownPanel = {
  position: 'absolute',
  top: 'calc(100% + 6px)',
  left: 0,
  right: 0,
  zIndex: 30,
  border: '1px solid rgba(22,163,74,0.3)',
  borderRadius: '12px',
  background: '#0F172A',
  boxShadow: '0 12px 30px rgba(2,6,23,0.4)',
  padding: '8px',
};

const heroDropdownSearch = {
  width: '100%',
  border: '1px solid rgba(148,163,184,0.35)',
  borderRadius: '10px',
  padding: '9px 10px',
  fontSize: '12px',
  color: '#E2E8F0',
  background: 'rgba(30,41,59,0.7)',
  marginBottom: '8px',
};

const heroDropdownList = {
  maxHeight: '210px',
  overflowY: 'auto',
  display: 'grid',
  gap: '4px',
};

const heroDropdownItem = {
  border: '1px solid transparent',
  borderRadius: '9px',
  padding: '8px 10px',
  textAlign: 'left',
  background: 'transparent',
  color: '#CBD5E1',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};

const heroDropdownItemActive = {
  borderColor: 'rgba(22,163,74,0.35)',
  background: 'rgba(22,163,74,0.12)',
  color: '#86EFAC',
};

const heroDropdownEmpty = {
  border: '1px dashed rgba(148,163,184,0.35)',
  borderRadius: '9px',
  padding: '10px',
  textAlign: 'center',
  color: '#94A3B8',
  fontSize: '12px',
};

const statGrid = {
  marginTop: '12px',
  display: 'grid',
  gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
  gap: '8px',
};

const statTile = {
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  background: 'rgba(255,255,255,0.05)',
  padding: '10px',
  textAlign: 'center',
};

const card = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  borderRadius: '14px',
  boxShadow: 'var(--shadow)',
  padding: '16px',
};

const errorBox = {
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: '#991B1B',
  borderRadius: '12px',
  padding: '10px 12px',
  fontSize: '12px',
  fontWeight: 700,
};

const secondaryBtn = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-2)',
  borderRadius: '10px',
  fontSize: '12px',
  fontWeight: 700,
  padding: '8px 11px',
  cursor: 'pointer',
};

const viewDraftBtn = {
  border: '1px solid rgba(16,185,129,0.4)',
  background: 'linear-gradient(135deg,#065F46,#059669)',
  color: '#FFFFFF',
  borderRadius: '10px',
  fontSize: '12px',
  fontWeight: 700,
  padding: '8px 11px',
  cursor: 'pointer',
};

const generateBtn = (disabled) => ({
  border: '1px solid rgba(22,163,74,0.4)',
  background: disabled ? 'linear-gradient(135deg,#64748B,#475569)' : 'linear-gradient(135deg,#16A34A,#059669)',
  color: '#FFFFFF',
  borderRadius: '10px',
  fontSize: '12px',
  fontWeight: 700,
  padding: '8px 11px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.7 : 1,
});

const docWrap = {
  border: '1px solid var(--border)',
  borderRadius: '12px',
  overflow: 'hidden',
  background: 'var(--surface)',
  boxShadow: 'var(--shadow)',
};

const docHeadBtn = {
  width: '100%',
  border: 'none',
  background: 'linear-gradient(135deg,#0F172A,#1E3A5F)',
  padding: '14px',
  cursor: 'pointer',
};

const mediaHeadBtn = {
  width: '100%',
  border: 'none',
  background: 'linear-gradient(135deg,#0F172A,#1E3A5F)',
  padding: '14px',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const subdocCard = {
  border: '1px solid var(--border)',
  borderRadius: '10px',
  overflow: 'hidden',
  background: 'var(--surface)',
};

const subdocHeaderBtn = {
  width: '100%',
  border: 'none',
  background: 'linear-gradient(135deg,var(--surface),var(--surface-2))',
  padding: '10px 12px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  cursor: 'pointer',
};

const subdocIndex = {
  width: '26px',
  height: '26px',
  borderRadius: '8px',
  background: 'linear-gradient(135deg,#16A34A,#059669)',
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '11px',
  fontWeight: 700,
  flexShrink: 0,
};

const subdocSummary = {
  padding: '8px 12px',
  borderTop: '1px solid var(--border-2)',
  background: 'var(--surface-2)',
  fontSize: '11px',
  color: 'var(--text-2)',
};

const tinyTitle = {
  fontSize: '10px',
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  fontWeight: 700,
  marginBottom: '4px',
};

const pill = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#166534',
  background: 'rgba(22,163,74,0.12)',
  borderRadius: '999px',
  padding: '4px 8px',
};

const draftPanel = {
  border: '1px solid rgba(22,163,74,0.2)',
  borderRadius: '12px',
  background: 'linear-gradient(135deg,#0F172A,#1E293B)',
  padding: '12px',
};

const modalBackdrop = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 999,
  padding: '20px',
};

const modalCard = {
  width: 'min(1100px,95vw)',
  border: '1px solid var(--border)',
  borderRadius: '14px',
  background: 'var(--surface)',
  boxShadow: '0 20px 50px rgba(15,23,42,0.25)',
};

const modalHead = {
  padding: '12px 14px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const preBox = {
  margin: 0,
  border: '1px solid var(--border)',
  borderRadius: '10px',
  background: 'var(--surface-2)',
  padding: '12px',
  fontSize: '11px',
  color: 'var(--text-2)',
  overflow: 'auto',
};
