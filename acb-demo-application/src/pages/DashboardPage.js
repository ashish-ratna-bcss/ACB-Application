import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, BACKEND_URL } from '../utils/api';

function fmtDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

const PHASE_COLORS = {
  complaint: '#64748B', verification: '#2563EB', approval: '#D97706', trap: '#B91C1C',
  remand: '#7C3AED', investigation: '#0EA5A4', evidence: '#16A34A', court: '#1D4ED8', prosecution: '#0F7A3D',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);
  const [pipelineStats, setPipelineStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getDashboardKpis().catch(() => null),
      fetch(`${BACKEND_URL}/pdf/stats`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([dash, pdfStats]) => {
        if (cancelled) return;
        setKpis(dash);
        setPipelineStats(pdfStats);
      })
      .catch(() => { if (!cancelled) setError(`Backend not reachable at ${BACKEND_URL}.`); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const operational = kpis?.operational || {};
  const pipeline = kpis?.pipeline || pipelineStats || {};

  const kpiCards = useMemo(() => [
    { label: 'Active Cases', value: operational.totalCases ?? 0, delta: `${operational.totalComplaints ?? 0} complaints`, deltaColor: '#16A34A', iconBg: 'rgba(0,200,83,0.13)', iconColor: '#0F7A3D', icon: 'M9 11l3 3L22 4' },
    { label: 'Active Traps', value: operational.activeTraps ?? 0, delta: `${operational.pendingApprovals ?? 0} pending HO`, deltaColor: '#B45309', iconBg: 'rgba(217,119,6,0.14)', iconColor: '#B45309', icon: 'M12 2v4M12 18v4M2 12h4M18 12h4' },
    { label: 'Docs Processed', value: pipeline.completedDocuments ?? pipeline.completed_documents ?? 0, delta: `${pipeline.failedDocuments ?? pipeline.failed_documents ?? 0} failed`, deltaColor: '#B91C1C', iconBg: 'rgba(22,163,74,0.13)', iconColor: '#16A34A', icon: 'M9 12l2 2 4-4' },
    { label: 'Pipeline Queue', value: pipeline.processingDocuments ?? pipeline.processing_documents ?? 0, delta: `${pipeline.totalDocuments ?? pipeline.total_documents ?? 0} total`, deltaColor: '#2563EB', iconBg: 'rgba(37,99,235,0.12)', iconColor: '#2563EB', icon: 'M12 8v4l3 2' },
    { label: 'Conviction Rate', value: `${operational.convictionRate ?? 0}%`, delta: `${operational.convictions ?? 0} convicted`, deltaColor: '#16A34A', iconBg: 'rgba(183,155,74,0.18)', iconColor: '#9A7B2E', icon: 'M3 3v18h18M8 17V9M13 17V5M18 17v-6' },
  ], [operational, pipeline]);

  const phaseDist = useMemo(() => {
    const src = kpis?.phaseDistribution || [];
    if (!src.length) {
      return [{ label: 'No cases', count: 0, color: '#64748B' }];
    }
    return src.filter((p) => p.count > 0).map((p) => ({
      label: p.phase.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      count: p.count,
      color: PHASE_COLORS[p.phase] || '#64748B',
    }));
  }, [kpis]);

  const activity = kpis?.recentActivity || [];

  if (loading) {
    return <div style={{ padding: '24px', maxWidth: '1480px', margin: '0 auto', color: 'var(--text-2)' }}>Loading dashboard…</div>;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1480px', margin: '0 auto' }}>
      {error ? <div style={{ marginBottom: '16px', border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', borderRadius: '12px', padding: '10px 12px', fontSize: '12px' }}>{error}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '18px' }}>
        {kpiCards.map((k) => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 17px', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase' }}>{k.label}</span>
              <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: k.iconBg, color: k.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d={k.icon} /></svg>
              </span>
            </div>
            <div style={{ fontSize: '30px', fontWeight: 700, marginTop: '10px' }}>{k.value}</div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: k.deltaColor, marginTop: '8px' }}>{k.delta}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: '16px', marginBottom: '18px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px' }}>Case Phase Distribution</div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '18px' }}>Operational workflow state machine</div>
          {phaseDist.map((p) => {
            const maxc = Math.max(...phaseDist.map((d) => d.count), 1);
            return (
              <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '13px' }}>
                <div style={{ width: '120px', fontSize: '12.5px', textAlign: 'right', color: 'var(--text-2)' }}>{p.label}</div>
                <div style={{ flex: 1, height: '24px', background: 'var(--surface-3)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((p.count / maxc) * 100)}%`, background: p.color, borderRadius: '6px' }} />
                </div>
                <div style={{ width: '30px', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{p.count}</div>
              </div>
            );
          })}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>AI Pipeline Status</div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '16px' }}>Document processing metrics</div>
          {[
            { label: 'Completed', val: pipeline.completedDocuments ?? pipeline.completed_documents ?? 0, color: '#16A34A' },
            { label: 'Processing', val: pipeline.processingDocuments ?? pipeline.processing_documents ?? 0, color: '#D97706' },
            { label: 'Failed', val: pipeline.failedDocuments ?? pipeline.failed_documents ?? 0, color: '#B91C1C' },
          ].map((o) => (
            <div key={o.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-2)' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-2)' }}>{o.label}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: o.color, fontFamily: "'JetBrains Mono',monospace" }}>{o.val}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: '16px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>Recent Case Activity</span>
            <button onClick={() => navigate('/complaints')} style={{ fontSize: '12px', fontWeight: 600, color: '#007A33', background: 'none', border: 'none', cursor: 'pointer' }}>View complaints →</button>
          </div>
          {activity.length ? activity.map((a, i) => (
            <div key={`${a.caseId}-${i}`} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-2)' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 600 }}>{a.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#007A33' }}>{a.caseId}</span> · {fmtDate(a.time)}
              </div>
            </div>
          )) : <div style={{ padding: '16px 20px', color: 'var(--text-3)', fontSize: '12px' }}>No recent activity.</div>}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>Quick Actions</div>
          {[
            { label: 'New Complaint', path: '/complaints' },
            { label: 'Document Processor', path: '/document-processor' },
            { label: 'Speech Intelligence', path: '/speech-intelligence' },
            { label: 'Pending Approvals', path: '/approval' },
          ].map((item) => (
            <button key={item.path} onClick={() => navigate(item.path)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: '8px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface-2)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
