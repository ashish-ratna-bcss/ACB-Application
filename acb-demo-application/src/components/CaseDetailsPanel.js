import React, { useEffect, useState } from 'react';
import { caseRec, phaseDefs, statusMeta, panelData, caseRightRailData, trapSpecificData } from '../data';
import { api } from '../utils/api';
import { phaseDefsFromWorkflow, PHASE_ROUTES } from '../utils/workflow';
import { useAuth } from '../context/AuthContext';
import CaseHeaderBand from './CaseHeaderBand';
import PhaseTracker from './PhaseTracker';
import PhasePanel from './PhasePanel';
import RightRail from './RightRail';
import CaseFlowSteps, { ComplaintsList } from './CaseFlowSteps';
import ReportDocumentView from './ReportDocumentView';
import DraftingProgress from './DraftingProgress';

const EVIDENCE_THEME = {
  audio: { icon: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', bg: 'rgba(124,58,237,0.13)', color: '#7C3AED' },
  video: { icon: 'M23 7l-7 5 7 5V7zM1 5h15v14H1z', bg: 'rgba(37,99,235,0.12)', color: '#2563EB' },
  document: { icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6', bg: 'rgba(100,116,139,0.13)', color: '#64748B' },
};
const EVIDENCE_STATUS_COLOR = { logged: '#64748B', secured: '#0F7A3D', archived: '#B45309' };

function mapEvidence(ev) {
  const theme = EVIDENCE_THEME[ev.evidenceType] || EVIDENCE_THEME.document;
  return {
    name: ev.title || 'Media evidence',
    id: (ev.id || '').slice(0, 8).toUpperCase() || 'EVID',
    meta: `${ev.evidenceType || 'media'}${ev.createdAt ? ` · ${new Date(ev.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}`,
    status: (ev.status || 'logged').toUpperCase(),
    statusColor: EVIDENCE_STATUS_COLOR[ev.status] || '#64748B',
    ...theme,
  };
}

const ROLE_CAN_ADVANCE_TO = {
  io: new Set(['verification', 'trap', 'remand', 'investigation', 'evidence', 'court', 'prosecution']),
  dsp: new Set(['complaint', 'verification', 'approval', 'remand', 'investigation']),
  ho: new Set(['trap', 'prosecution']),
  admin: new Set(['complaint', 'verification', 'approval', 'trap', 'remand', 'investigation', 'evidence', 'court', 'prosecution']),
};

export default function CaseDetailsPanel({ caseData, phase: pagePhase, onClose, onWorkflowChange }) {
  const { user } = useAuth();
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [expandedPhases, setExpandedPhases] = useState({});
  const [evidenceItems, setEvidenceItems] = useState([]);
  const [hasMediaRecords, setHasMediaRecords] = useState(false);
  const [draftingReport, setDraftingReport] = useState(false);
  const [draftStep, setDraftStep] = useState(null);        // active step id
  const [draftDone, setDraftDone] = useState(new Set());   // completed step ids
  const [draftError, setDraftError] = useState(null);
  const [draftedReports, setDraftedReports] = useState(null);
  const [reportExpanded, setReportExpanded] = useState({});
  const [reportEditMode, setReportEditMode] = useState({});
  const [reportEdits, setReportEdits] = useState({});
  const [reportSaving, setReportSaving] = useState({});
  const [draftingHoMemo, setDraftingHoMemo] = useState(false);
  const [submittingHoDecision, setSubmittingHoDecision] = useState(false);
  const [firNumberInput, setFirNumberInput] = useState('');
  const [dspInstructing, setDspInstructing] = useState(false);
  const [registeringFir, setRegisteringFir] = useState(false);

  const caseKey = caseData?.caseId || caseData?.id;

  useEffect(() => {
    if (!caseKey) {
      setWorkflow(null);
      return;
    }
    setLoading(true);
    setActionError('');
    const viewPhase = pagePhase || undefined;
    api.getCaseWorkflow(caseKey, viewPhase)
      .then((wf) => {
        setWorkflow(wf);
        const stored = wf?.phaseData?.verificationReports;
        setDraftedReports(stored ? Object.values(stored) : null);
      })
      .catch((e) => setActionError(e.message))
      .finally(() => setLoading(false));
  }, [caseKey, pagePhase]);

  useEffect(() => {
    if (!caseKey) { setEvidenceItems([]); return; }
    api.getCaseEvidence(caseKey)
      .then((items) => setEvidenceItems(Array.isArray(items) ? items : []))
      .catch(() => setEvidenceItems([]));
  }, [caseKey]);

  useEffect(() => {
    if (!caseKey) { setHasMediaRecords(false); return; }
    api.checkMediaRecords(caseKey)
      .then((data) => setHasMediaRecords(data.hasMediaRecords || false))
      .catch(() => setHasMediaRecords(false));
  }, [caseKey]);

  if (!caseData) return null;

  const activePhase = pagePhase || workflow?.currentPhase || 'trap';
  const phaseDefsData = workflow?.phases?.length
    ? phaseDefsFromWorkflow(workflow.phases, activePhase)
    : phaseDefs(activePhase);
  const activeDef = phaseDefsData.find((p) => p.id === activePhase) || phaseDefsData[0];

  const c = caseRec();
  c.caseId = caseData.trackingId || caseData.id || c.caseId;
  c.statusLabel = `${activeDef?.label || activePhase} · ${(workflow?.phaseSubstatus || 'active').replace(/_/g, ' ')}`;
  c.ao = {
    name: caseData.accused || c.ao.name,
    desig: caseData.designation || '',
    dept: caseData.department || '',
    station: caseData.location || '',
  };
  c.trapAmount = caseData.amount > 0
    ? `₹${Number(caseData.amount).toLocaleString('en-IN')}`
    : null;

  const dynamicMetadata = [
    { label: 'Case No.', value: c.caseId, font: "'JetBrains Mono',monospace" },
    ...(workflow?.firNumber ? [{ label: 'FIR No.', value: workflow.firNumber, font: "'JetBrains Mono',monospace" }] : []),
    ...(workflow?.registeredDate ? [{ label: 'Registered', value: new Date(workflow.registeredDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }), font: "'JetBrains Mono',monospace" }] : []),
    { label: 'Complainant', value: caseData.complainantName || c.ao.name, font: 'inherit' },
    { label: 'Department', value: caseData.accusedDepartment || c.ao.dept, font: 'inherit' },
    ...(caseData.dspName ? [{ label: 'Assigned DSP', value: caseData.dspName, font: 'inherit' }] : []),
  ];

  const sm = statusMeta(activeDef?.status || 'inprogress');
  const panel = workflow?.phasePanel
    ? {
        title: workflow.phasePanel.title,
        desc: workflow.phasePanel.description || workflow.phasePanel.desc,
        fields: workflow.phasePanel.fields || [],
        documents: workflow.phasePanel.documents || [],
        checkpoints: [],
      }
    : panelData(activePhase);

  if (workflow?.checkpoints?.length) {
    panel.checkpoints = workflow.checkpoints
      .filter((cp) => cp.phase === activePhase)
      .map((cp) => ({ key: cp.key, label: cp.label, done: cp.done ? 1 : 0 }));
  }

  if (workflow?.artifacts?.length && !workflow?.phasePanel) {
    panel.documents = workflow.artifacts
      .filter((a) => a.phase === activePhase)
      .map((a) => ({
        name: a.title,
        meta: `${a.artifactType} · ${a.refId}`,
        status: a.status === 'linked' ? 'Uploaded' : a.status,
        doc: null,
      }));
  }

  const tracker = phaseDefsData.map((p, i) => {
    const m = statusMeta(p.status);
    const done = p.status === 'completed';
    const active = p.id === activePhase;
    const prevDone = i > 0 && phaseDefsData[i - 1].status === 'completed';

    return {
      id: p.id,
      label: p.label,
      num: i + 1,
      done,
      statusLabel: m.label,
      statusColor: m.color,
      circleBg: done ? '#16A34A' : 'var(--surface-3, #fff)',
      circleBorder: done ? '#16A34A' : p.status === 'inprogress' ? '#2563EB' : '#94A3B8',
      circleColor: done ? '#fff' : p.status === 'inprogress' ? '#2563EB' : '#94A3B8',
      ring: active ? '0 0 0 4px rgba(0,200,83,0.22)' : 'none',
      labelWeight: active ? 700 : 600,
      labelColor: active ? '#0F7A3D' : 'var(--text-2)',
      lineColor: prevDone ? '#16A34A' : 'var(--border)',
      lineDisplay: i === 0 ? 'none' : 'block',
      route: PHASE_ROUTES[p.id],
      locked: p.locked,
    };
  });

  const { evidence: staticEvidence, audit } = caseRightRailData;
  const { currencyNotes, trapSequence } = trapSpecificData;

  const evidenceDisplay = evidenceItems.length
    ? evidenceItems.map((ev) => mapEvidence(ev))
    : staticEvidence;

  const advanceBtn = { border: '1px solid #00A84A', background: '#00C853', color: '#052E16', fontSize: '12px', fontWeight: 700, borderRadius: '8px', padding: '7px 12px', cursor: 'pointer' };
  const lockedBtn = { border: '1px solid #D1D5DB', background: '#F3F4F6', color: '#9CA3AF', fontSize: '12px', fontWeight: 700, borderRadius: '8px', padding: '7px 12px', cursor: 'not-allowed' };

  const role = user?.role || 'io';
  const canAdvanceTo = (phase) => (ROLE_CAN_ADVANCE_TO[role] || ROLE_CAN_ADVANCE_TO.io).has(phase);

  const reportsDrafted = !!(
    draftedReports &&
    draftedReports.some((r) => r.id === 'verbatim_report') &&
    draftedReports.some((r) => r.id === 'verification_report')
  );

  const DRAFT_STEPS = [
    { id: 'transcripts', label: 'Reading speech intelligence transcripts', sublabel: 'Extracting segments & speakers from all attached recordings' },
    { id: 'verbatim', label: 'Drafting Verbatim Report', sublabel: 'Per-file sections + consolidated conclusion' },
    { id: 'verification', label: 'Drafting Verification Report', sublabel: 'Using verbatim + complaint details as sources' },
    { id: 'saving', label: 'Saving & ticking checkpoints', sublabel: 'Persisting to case phase data' },
  ];

  async function handleDraftReports() {
    if (!caseKey) return;
    setActionError('');
    setDraftError(null);
    setDraftingReport(true);
    setDraftStep('transcripts');
    setDraftDone(new Set());

    try {
      // Step 1 — Verbatim (backend reads transcripts + calls Ollama per file)
      setDraftStep('verbatim');
      const verbatimData = await api.draftVerbatimReport(caseKey);
      setDraftDone((prev) => new Set([...prev, 'transcripts', 'verbatim']));

      // Step 2 — Verification (reads verbatim from phase_data, drafts)
      setDraftStep('verification');
      const verificationData = await api.draftVerificationReportStep(caseKey);
      setDraftDone((prev) => new Set([...prev, 'verification']));

      // Step 3 — Refresh workflow (checkpoints etc already persisted by backend)
      setDraftStep('saving');
      const wf = await api.getCaseWorkflow(caseKey, pagePhase || undefined);
      setWorkflow(wf);
      setDraftDone((prev) => new Set([...prev, 'saving']));

      // Collect both reports for display
      const reports = [verbatimData.report, verificationData.report].filter(Boolean);
      setDraftedReports(reports.length ? reports : null);
    } catch (e) {
      setDraftError(e.message);
      setActionError(e.message);
    } finally {
      setDraftingReport(false);
      setDraftStep(null);
    }
  }

  function getReportEditText(r) {
    if (r.id === 'verification_report' || r.id === 'ho_decision_memo') {
      return (r.narrativeParagraphs || []).join('\n\n');
    }
    if (r.id === 'verbatim_report') {
      const lines = [];
      (r.recordingSections || []).forEach((sec) => {
        lines.push(`## Recording: ${sec.fileName}`);
        lines.push(sec.contextBlock || '');
      });
      if (r.consolidatedConclusion) {
        lines.push('## Consolidated Conclusion');
        lines.push(r.consolidatedConclusion);
      }
      return lines.join('\n\n');
    }
    return '';
  }

  async function handleSaveReport(r) {
    if (!caseKey) return;
    setReportSaving((prev) => ({ ...prev, [r.id]: true }));
    try {
      const result = await api.saveReport(caseKey, r.id, reportEdits[r.id] || '');
      setDraftedReports((prev) =>
        prev ? prev.map((x) => (x.id === r.id ? result.report : x)) : prev
      );
      setReportEditMode((prev) => ({ ...prev, [r.id]: false }));
    } catch (e) {
      setActionError(e.message);
    } finally {
      setReportSaving((prev) => ({ ...prev, [r.id]: false }));
    }
  }

  function renderReportAccordion(r, readOnly = false) {
    const isExpanded = reportExpanded[r.id];
    const isEditing = !readOnly && reportEditMode[r.id];
    const isSaving = reportSaving[r.id];

    return (
      <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', gap: '10px', background: 'var(--surface-2)', borderBottom: isExpanded ? '1px solid var(--border)' : 'none' }}>
          <button
            onClick={() => setReportExpanded((prev) => ({ ...prev, [r.id]: !isExpanded }))}
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '9px', border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', padding: 0 }}
          >
            <span style={{ fontSize: '12px', color: 'var(--text-3)', width: '12px' }}>{isExpanded ? '▼' : '▶'}</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{r.title || r.id}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '1px' }}>
                {r.id === 'verbatim_report' ? 'Verbatim transcription record' : r.id === 'ho_decision_memo' ? 'Head Office Decision Memorandum' : 'Verification inquiry report'} · {isExpanded ? 'Click to collapse' : 'Click to view'}
              </div>
            </div>
          </button>
          {isExpanded && !readOnly && (
            isEditing ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleSaveReport(r)}
                  disabled={isSaving}
                  style={{ fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '6px', border: '1px solid #16A34A', background: '#D1FAE5', color: '#052E16', cursor: isSaving ? 'wait' : 'pointer' }}
                >
                  {isSaving ? 'Saving…' : '✓ Save'}
                </button>
                <button
                  onClick={() => setReportEditMode((prev) => ({ ...prev, [r.id]: false }))}
                  style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-2)' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setReportEditMode((prev) => ({ ...prev, [r.id]: true }));
                  setReportEdits((prev) => ({ ...prev, [r.id]: getReportEditText(r) }));
                }}
                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-2)' }}
              >
                ✏ Edit
              </button>
            )
          )}
        </div>
        {isExpanded && (
          isEditing ? (
            <div style={{ padding: '16px' }}>
              {r.id === 'verbatim_report' && (
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '8px', fontStyle: 'italic' }}>
                  Editing narrative context per recording and conclusion. Dialogue tables (timestamps / speaker lines) are preserved from the original transcript.
                </div>
              )}
              {r.id === 'ho_decision_memo' && (
                <div style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '8px', fontStyle: 'italic' }}>
                  Editing narrative paragraphs of the Head Office Decision Memo. Make sure the mandatory vocabulary from the Bag of Words remains present.
                </div>
              )}
              <textarea
                value={reportEdits[r.id] || ''}
                onChange={(e) => setReportEdits((prev) => ({ ...prev, [r.id]: e.target.value }))}
                style={{ width: '100%', minHeight: '380px', fontFamily: "'Times New Roman', Georgia, serif", fontSize: '13px', lineHeight: 1.8, padding: '14px', border: '1px solid var(--border)', borderRadius: '8px', resize: 'vertical', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}
              />
            </div>
          ) : (
            <ReportDocumentView report={r} />
          )
        )}
      </div>
    );
  }

  async function handleDraftHoMemo(decision) {
    if (!caseKey) return;
    setActionError('');
    setDraftingHoMemo(true);
    try {
      const role = user?.role || 'ho';
      await api.draftHoDecisionMemo(caseKey, decision, role);
      const wf = await api.getCaseWorkflow(caseKey, pagePhase || undefined);
      setWorkflow(wf);
    } catch (e) {
      setActionError(e.message);
    } finally {
      setDraftingHoMemo(false);
    }
  }

  async function handleSubmitHoDecision(decision) {
    if (!caseKey) return;
    setActionError('');
    setSubmittingHoDecision(true);
    try {
      const role = user?.role || 'ho';
      const wf = await api.submitHoDecision(caseKey, decision, role);
      setWorkflow(wf);
      onWorkflowChange?.();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setSubmittingHoDecision(false);
    }
  }

  async function handleDspInstruct() {
    if (!caseKey) return;
    setActionError('');
    setDspInstructing(true);
    try {
      const role = user?.role || 'dsp';
      const wf = await api.dspInstructInspector(caseKey, role);
      setWorkflow(wf);
      onWorkflowChange?.();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setDspInstructing(false);
    }
  }

  async function handleRegisterFir() {
    if (!caseKey || !firNumberInput.trim()) return;
    setActionError('');
    setRegisteringFir(true);
    try {
      const role = user?.role || 'io';
      const wf = await api.registerFir(caseKey, firNumberInput.trim(), role);
      setWorkflow(wf);
      onWorkflowChange?.();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setRegisteringFir(false);
    }
  }

  async function handleAdvance() {
    if (!caseKey || !workflow?.nextPhase) return;
    setActionError('');
    try {
      await api.transitionCase(caseKey, { toPhase: workflow.nextPhase, action: 'advance_phase' });
      const wf = await api.getCaseWorkflow(caseKey);
      setWorkflow(wf);
      onWorkflowChange?.();
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function toggleCheckpoint(key, done) {
    if (!caseKey) return;
    try {
      const wf = await api.updateCheckpoint(caseKey, { phase: activePhase, key, done });
      setWorkflow(wf);
    } catch (e) {
      setActionError(e.message);
    }
  }

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        onClick={onClose}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: '1280px', height: '94vh',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-2)' }}>
              Case Detailed View {loading ? '· Loading…' : ''}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {activePhase === 'verification' ? (
                <>
                  {!hasMediaRecords ? (
                    <button disabled style={lockedBtn} title="Attach a transcription from Speech Intelligence first">
                      Advance blocked — attach speech transcription
                    </button>
                  ) : !reportsDrafted ? (
                    <>
                      <button onClick={handleDraftReports} disabled={draftingReport} style={{ border: '1px solid #F59E0B', background: '#FCD34D', color: '#92400E', fontSize: '12px', fontWeight: 700, borderRadius: '8px', padding: '7px 12px', cursor: draftingReport ? 'wait' : 'pointer' }}>
                        {draftingReport ? 'Drafting Phase Reports…' : 'Draft Verbatim & Verification Reports'}
                      </button>
                      <button disabled style={lockedBtn} title="Both mandatory reports must be drafted before advancing">
                        Advance blocked — draft both reports
                      </button>
                    </>
                  ) : workflow?.nextPhase ? (
                    <>
                      <button onClick={handleDraftReports} disabled={draftingReport} style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: '12px', fontWeight: 600, borderRadius: '8px', padding: '7px 12px', cursor: draftingReport ? 'wait' : 'pointer' }}>
                        {draftingReport ? 'Re-drafting…' : 'Re-draft Reports'}
                      </button>
                      {canAdvanceTo(workflow.nextPhase) ? (
                        <button onClick={handleAdvance} style={advanceBtn}>
                          Advance to {workflow.nextPhase.replace(/_/g, ' ')}
                        </button>
                      ) : (
                        <button disabled style={lockedBtn} title={`Role '${role}' cannot advance to '${workflow.nextPhase}'`}>
                          Not permitted · {role.toUpperCase()}
                        </button>
                      )}
                    </>
                  ) : null}
                </>
              ) : activePhase === 'approval' ? (
                workflow?.phaseSubstatus === 'fir_registered' ? (
                  canAdvanceTo(workflow.nextPhase) ? (
                    <button onClick={handleAdvance} style={advanceBtn}>
                      Advance to {workflow.nextPhase.replace(/_/g, ' ')}
                    </button>
                  ) : (
                    <button disabled style={lockedBtn} title={`Role '${role}' cannot advance to '${workflow.nextPhase}'`}>
                      Not permitted · {role.toUpperCase()}
                    </button>
                  )
                ) : (
                  <button disabled style={lockedBtn} title="FIR must be registered before executing the trap operation">
                    Advance blocked · Register FIR
                  </button>
                )
              ) : workflow?.nextPhase ? (
                canAdvanceTo(workflow.nextPhase) ? (
                  <button onClick={handleAdvance} style={advanceBtn}>
                    Advance to {workflow.nextPhase.replace(/_/g, ' ')}
                  </button>
                ) : (
                  <button disabled style={lockedBtn} title={`Role '${role}' cannot advance to '${workflow.nextPhase}'`}>
                    Not permitted · {role.toUpperCase()}
                  </button>
                )
              ) : null}
              <button onClick={onClose} style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'transparent', border: 'none', color: '#7F93AE', cursor: 'pointer' }}>✕</button>
            </div>
          </div>

          {actionError ? (
            <div style={{ margin: '0 24px', marginTop: '12px', border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', borderRadius: '8px', padding: '8px 10px', fontSize: '12px' }}>{actionError}</div>
          ) : null}

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <CaseHeaderBand caseData={c} />
            <PhaseTracker trackerItems={tracker} caseId={c.caseId} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px', alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
                {/* Previous Phases */}
                {phaseDefsData.map((p) => {
                  const isPrevious = p.id !== activePhase && p.status === 'completed';
                  if (!isPrevious) return null;
                  const isExpanded = expandedPhases[p.id];
                  const phaseReports = p.id === 'verification' && draftedReports?.length > 0 ? draftedReports : null;
                  return (
                    <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
                      <button onClick={() => setExpandedPhases(prev => ({ ...prev, [p.id]: !isExpanded }))} style={{ width: '100%', border: 'none', background: 'transparent', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                          <span style={{ fontSize: '16px', color: '#16A34A' }}>✓</span>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{p.label}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                              Completed{phaseReports ? ` · ${phaseReports.length} report${phaseReports.length > 1 ? 's' : ''} available` : ''}
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '14px', color: 'var(--text-3)' }}>{isExpanded ? '▼' : '▶'}</span>
                      </button>
                      {isExpanded && (
                        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {phaseReports ? (
                            <>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Phase Reports — {p.label}</div>
                              {['verbatim_report', 'verification_report']
                                .map((id) => phaseReports.find((r) => r.id === id))
                                .filter(Boolean)
                                .map((r) => renderReportAccordion(r, true))}
                            </>
                          ) : (
                            <div style={{ fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic' }}>No report data available for this phase.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                <PhasePanel
                  panel={panel}
                  statusMeta={sm}
                  onCheckpointToggle={workflow ? toggleCheckpoint : undefined}
                />

                {activePhase === 'verification' && (draftingReport || draftError) && (
                  <DraftingProgress
                    steps={DRAFT_STEPS}
                    currentStep={draftStep}
                    completedSteps={draftDone}
                    error={draftError}
                  />
                )}

                {activePhase === 'verification' && draftedReports && draftedReports.length > 0 && (
                  <>
                    <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-3)', textTransform: 'uppercase' }}>
                      Mandatory Phase Reports {reportsDrafted ? '· Complete' : '· Incomplete'}
                    </div>
                    {['verbatim_report', 'verification_report']
                      .map((id) => draftedReports.find((r) => r.id === id))
                      .filter(Boolean)
                      .map((r) => renderReportAccordion(r, false))}
                  </>
                )}

                {activePhase === 'approval' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', boxShadow: 'var(--shadow)' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 10px 0', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⚖️</span> Head Office Decision & Approval Panel
                      </h3>
                      <p style={{ fontSize: '12.5px', color: 'var(--text-3)', margin: '0 0 15px 0', lineHeight: 1.5 }}>
                        This panel manages the decision-making pipeline for trap execution. Only the Head Office (role: ho) can issue the decision memorandum. Once approved, the DSP notifies the team, and the Inspector registers the FIR.
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'var(--surface-2)', border: '1px solid var(--border)', marginBottom: '15px', fontSize: '13px' }}>
                        <strong>Substatus:</strong> 
                        <span style={{ 
                          textTransform: 'uppercase', 
                          fontSize: '11px', 
                          fontWeight: 700, 
                          padding: '3px 8px', 
                          borderRadius: '12px', 
                          background: workflow?.phaseSubstatus === 'approved' ? 'rgba(22,163,74,0.13)' : workflow?.phaseSubstatus === 'fir_registered' ? 'rgba(59,130,246,0.13)' : workflow?.phaseSubstatus === 'rejected' ? 'rgba(239,68,68,0.13)' : 'rgba(245,158,11,0.13)',
                          color: workflow?.phaseSubstatus === 'approved' ? '#16A34A' : workflow?.phaseSubstatus === 'fir_registered' ? '#3B82F6' : workflow?.phaseSubstatus === 'rejected' ? '#EF4444' : '#F59E0B',
                          border: `1px solid ${workflow?.phaseSubstatus === 'approved' ? '#16A34A' : workflow?.phaseSubstatus === 'fir_registered' ? '#3B82F6' : workflow?.phaseSubstatus === 'rejected' ? '#EF4444' : '#F59E0B'}`
                        }}>
                          {workflow?.phaseSubstatus?.replace(/_/g, ' ') || 'pending'}
                        </span>
                      </div>

                      {/* AWAITING HO DECISION */}
                      {(workflow?.phaseSubstatus === 'pending' || workflow?.phaseSubstatus === 'submitted') && (
                        role === 'ho' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button
                                onClick={() => handleDraftHoMemo('approved')}
                                disabled={draftingHoMemo}
                                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #16A34A', background: 'rgba(22,163,74,0.08)', color: '#16A34A', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                              >
                                {draftingHoMemo ? 'Generating Memo...' : '📝 Draft Approval Memo'}
                              </button>
                              <button
                                onClick={() => handleDraftHoMemo('rejected')}
                                disabled={draftingHoMemo}
                                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #EF4444', background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                              >
                                {draftingHoMemo ? 'Generating Memo...' : '📝 Draft Rejection Memo'}
                              </button>
                            </div>

                            {workflow?.phaseData?.hoDecisionMemo && (
                              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase' }}>Drafted Memo Preview (Edit/Save Supported)</div>
                                {renderReportAccordion(workflow.phaseData.hoDecisionMemo, false)}

                                <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                                  <button
                                    onClick={() => handleSubmitHoDecision(workflow.phaseData.hoDecisionMemo.decision)}
                                    disabled={submittingHoDecision}
                                    style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: workflow.phaseData.hoDecisionMemo.decision === 'approved' ? '#16A34A' : '#EF4444', color: '#fff', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                  >
                                    {submittingHoDecision ? 'Submitting Decision...' : workflow.phaseData.hoDecisionMemo.decision === 'approved' ? '✓ Grant Oral Permission & Approve' : '✗ Reject Trap Proposal'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid #F59E0B', color: '#B45309', fontSize: '13.5px', fontWeight: 500 }}>
                            ⏳ Pending decision at Head Office (Jt. Director V.K. Sharma).
                          </div>
                        )
                      )}

                      {/* AWAITING DSP INSTRUCTION */}
                      {workflow?.phaseSubstatus === 'approved' && !workflow?.phaseData?.dsp_instructed_inspector && (
                        role === 'dsp' ? (
                          <div style={{ marginTop: '15px', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '10px' }}>
                              🔔 Oral permission granted by HO. You must now instruct the Inspector to proceed with registering the FIR.
                            </p>
                            <button
                              onClick={handleDspInstruct}
                              disabled={dspInstructing}
                              style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#0F172A', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                            >
                              {dspInstructing ? 'Sending Instruction...' : '📣 Instruct Inspector to Register FIR'}
                            </button>
                          </div>
                        ) : (
                          <div style={{ marginTop: '15px', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                            <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid #F59E0B', color: '#B45309', fontSize: '13.5px', fontWeight: 500 }}>
                              ⏳ Pending instruction at DSP Ramesh Kumar.
                            </div>
                          </div>
                        )
                      )}

                      {/* AWAITING INSPECTOR FIR REGISTRATION */}
                      {workflow?.phaseSubstatus === 'approved' && workflow?.phaseData?.dsp_instructed_inspector && (
                        role === 'io' ? (
                          <div style={{ marginTop: '15px', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <p style={{ fontSize: '13px', color: 'var(--text-2)', margin: 0 }}>
                                ✍️ DSP has issued instructions. Enter the registered FIR Number to advance.
                              </p>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  value={firNumberInput}
                                  onChange={(e) => setFirNumberInput(e.target.value)}
                                  placeholder="e.g. FIR/TS-ACB/2026/042"
                                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', flex: 1 }}
                                />
                                <button
                                  onClick={handleRegisterFir}
                                  disabled={registeringFir || !firNumberInput.trim()}
                                  style={{ padding: '9px 16px', borderRadius: '6px', border: 'none', background: '#16A34A', color: '#fff', fontWeight: 600, fontSize: '13px', cursor: firNumberInput.trim() ? 'pointer' : 'not-allowed' }}
                                >
                                  {registeringFir ? 'Submitting...' : 'Register FIR'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginTop: '15px', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                            <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid #F59E0B', color: '#B45309', fontSize: '13.5px', fontWeight: 500 }}>
                              ⏳ Pending FIR registration at Insp. D. Prakash Reddy.
                            </div>
                          </div>
                        )
                      )}

                      {workflow?.phaseSubstatus === 'fir_registered' && (
                        <div style={{ marginTop: '15px', padding: '12px 14px', borderRadius: '8px', background: 'rgba(22,163,74,0.08)', border: '1px solid #16A34A', color: '#16A34A', fontSize: '13px' }}>
                          ✓ FIR successfully registered: <strong>{c.firNumber || workflow?.firNumber || 'Registered'}</strong>. The case is now ready to advance to Trap Operations.
                        </div>
                      )}

                      {workflow?.phaseSubstatus === 'rejected' && (
                        <div style={{ marginTop: '15px', padding: '12px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid #EF4444', color: '#EF4444', fontSize: '13px' }}>
                          ✗ Trap proposal rejected by Head Office. Case closed and reverted for direct departmental action.
                        </div>
                      )}
                    </div>

                    {workflow?.phaseData?.hoDecisionMemo && workflow?.phaseSubstatus !== 'pending' && workflow?.phaseSubstatus !== 'submitted' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Finalized Memo</div>
                        {renderReportAccordion(workflow.phaseData.hoDecisionMemo, true)}
                      </div>
                    )}
                  </div>
                )}

                {activePhase === 'trap' && (
                  <>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden', padding: '18px 22px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '11px' }}>Currency Note Inventory</div>
                      {currencyNotes.map((n, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 1.3fr 1.3fr 70px', padding: '8px 0', fontSize: '12px', fontFamily: "'JetBrains Mono',monospace" }}>
                          <span>{n.sl}</span><span>{n.denom}</span><span>{n.from}</span><span>{n.to}</span><span>{n.count}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 22px' }}>
                      {trapSequence.map((e, i) => (
                        <div key={i} style={{ fontSize: '12px', marginBottom: '8px' }}><b>{e.time}</b> — {e.text}</div>
                      ))}
                    </div>
                  </>
                )}

                <ComplaintsList complaints={workflow?.complaints} />
                <CaseFlowSteps
                  steps={workflow?.phaseFlowSteps?.length ? workflow.phaseFlowSteps.map((s) => ({
                    ...s,
                    status: workflow.processingFlow?.find((f) => f.step === s.step)?.status || 'pending',
                  })) : []}
                  title={`Processing Steps — ${activeDef?.label || activePhase}`}
                  compact
                />
              </div>

              <RightRail metadata={dynamicMetadata} evidence={evidenceDisplay} audit={workflow?.transitions?.map((t) => ({
                action: t.action,
                user: t.actorName,
                time: t.createdAt ? new Date(t.createdAt).toLocaleString('en-IN') : '—',
              })) || audit} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
