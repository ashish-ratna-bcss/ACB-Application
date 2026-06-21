import React, { useEffect, useState } from 'react';
import { caseRec, phaseDefs, statusMeta, panelData, caseRightRailData, trapSpecificData } from '../data';
import { api } from '../utils/api';
import { phaseDefsFromWorkflow, PHASE_ROUTES } from '../utils/workflow';
import CaseHeaderBand from './CaseHeaderBand';
import PhaseTracker from './PhaseTracker';
import PhasePanel from './PhasePanel';
import RightRail from './RightRail';
import DocumentList from './DocumentList';
import CaseFlowSteps, { ComplaintsList } from './CaseFlowSteps';

export default function CaseDetailsPanel({ caseData, phase: pagePhase, onClose, onWorkflowChange }) {
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState('');

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
      .then(setWorkflow)
      .catch((e) => setActionError(e.message))
      .finally(() => setLoading(false));
  }, [caseKey, pagePhase]);

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
    desig: caseData.designation || caseData.department || c.ao.desig,
    dept: caseData.department || c.ao.dept,
    station: caseData.location || c.ao.station,
  };

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

  const { metadata, evidence, audit } = caseRightRailData;
  const { currencyNotes, mediators, trapSequence } = trapSpecificData;

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
              {workflow?.nextPhase ? (
                <button onClick={handleAdvance} style={{ border: '1px solid #00A84A', background: '#00C853', color: '#052E16', fontSize: '12px', fontWeight: 700, borderRadius: '8px', padding: '7px 12px' }}>
                  Advance to {workflow.nextPhase.replace(/_/g, ' ')}
                </button>
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
                <PhasePanel
                  panel={panel}
                  statusMeta={sm}
                  onCheckpointToggle={workflow ? toggleCheckpoint : undefined}
                />

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
                <DocumentList documents={panel.documents} reportTemplates={workflow?.reportTemplates} />
              </div>

              <RightRail metadata={metadata} evidence={evidence} audit={workflow?.transitions?.map((t) => ({
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
