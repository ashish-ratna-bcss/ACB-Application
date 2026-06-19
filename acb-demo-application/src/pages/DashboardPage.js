import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const DOC_STATUS_COLORS = ['#16A34A', '#D97706', '#B91C1C', '#64748B', '#0EA5A4'];

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

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`${BACKEND_URL}/pdf/stats`).then((r) => r.ok ? r.json() : Promise.reject(new Error('Failed to load stats'))),
      fetch(`${BACKEND_URL}/pdf/cases`).then((r) => r.ok ? r.json() : Promise.reject(new Error('Failed to load cases'))),
    ])
      .then(([statsRes, casesRes]) => {
        if (cancelled) return;
        setStats(statsRes || null);
        setCases(Array.isArray(casesRes?.cases) ? casesRes.cases : []);
      })
      .catch(() => {
        if (!cancelled) setError(`Backend not reachable at ${BACKEND_URL}.`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const kpis = useMemo(() => {
    const totalCases = stats?.total_cases ?? cases.length;
    const totalDocs = stats?.total_documents ?? 0;
    const processing = stats?.processing_documents ?? 0;
    const failed = stats?.failed_documents ?? 0;
    const completed = stats?.completed_documents ?? 0;
    const confidence = typeof stats?.avg_confidence === 'number' ? `${Math.round(stats.avg_confidence)}%` : '0%';

    return [
      { label: 'Active Cases', value: `${totalCases}`, icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11', iconBg: 'rgba(0,200,83,0.13)', iconColor: '#0F7A3D', delta: `${totalDocs}`, deltaColor: '#16A34A', deltaLabel: 'documents' },
      { label: 'Processing Docs', value: `${processing}`, icon: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', iconBg: 'rgba(217,119,6,0.14)', iconColor: '#B45309', delta: `${Math.max(totalDocs - completed, 0)}`, deltaColor: '#B45309', deltaLabel: 'remaining' },
      { label: 'Completed Docs', value: `${completed}`, icon: 'M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', iconBg: 'rgba(22,163,74,0.13)', iconColor: '#16A34A', delta: totalDocs ? `${Math.round((completed / totalDocs) * 100)}%` : '0%', deltaColor: '#16A34A', deltaLabel: 'success rate' },
      { label: 'Failed Docs', value: `${failed}`, icon: 'M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', iconBg: 'rgba(239,68,68,0.13)', iconColor: '#B91C1C', delta: `${processing}`, deltaColor: '#B45309', deltaLabel: 'in queue' },
      { label: 'AI Confidence', value: confidence, icon: 'M3 3v18h18M8 17V9M13 17V5M18 17v-6', iconBg: 'rgba(183,155,74,0.18)', iconColor: '#9A7B2E', delta: `${stats?.total_subdocuments ?? 0}`, deltaColor: '#16A34A', deltaLabel: 'sub-documents' },
    ];
  }, [stats, cases.length]);

  const phaseDist = useMemo(() => {
    const source = Array.isArray(stats?.doc_status) ? stats.doc_status : [];
    if (!source.length) {
      return [
        { label: 'Completed', count: stats?.completed_documents ?? 0, color: '#16A34A' },
        { label: 'Processing', count: stats?.processing_documents ?? 0, color: '#D97706' },
        { label: 'Failed', count: stats?.failed_documents ?? 0, color: '#B91C1C' },
      ];
    }
    return source.map((item, idx) => ({
      label: item.name || `Stage ${idx + 1}`,
      count: Number(item.value || 0),
      color: DOC_STATUS_COLORS[idx % DOC_STATUS_COLORS.length],
    }));
  }, [stats]);

  const outcomes = useMemo(() => {
    const totalDocs = Math.max(stats?.total_documents ?? 0, 1);
    const completed = stats?.completed_documents ?? 0;
    const processing = stats?.processing_documents ?? 0;
    const failed = stats?.failed_documents ?? 0;
    return [
      { value: `${Math.round((completed / totalDocs) * 100)}%`, label: 'Completed', color: '#16A34A' },
      { value: `${Math.round((processing / totalDocs) * 100)}%`, label: 'Processing', color: '#D97706' },
      { value: `${Math.round((failed / totalDocs) * 100)}%`, label: 'Failed', color: '#CBD5E1' },
    ];
  }, [stats]);

  const attRows = useMemo(() => {
    const base = cases
      .map((c) => {
        const hasFailed = c.failed_count > 0;
        const isProcessing = c.processing_count > 0;
        let status = 'notstarted';
        if (hasFailed) status = 'pending';
        else if (isProcessing) status = 'inprogress';

        return {
          caseNo: c.case_id,
          docs: c.document_count,
          pages: c.total_pages,
          phase: isProcessing ? 'Processing' : hasFailed ? 'Attention' : 'Completed',
          status,
          amount: `${c.completed_count}/${c.document_count}`,
          flag: hasFailed ? `${c.failed_count} failed` : isProcessing ? `${c.processing_count} running` : 'Healthy',
          flagColor: hasFailed ? '#B91C1C' : isProcessing ? '#B45309' : '#16A34A',
        };
      })
      .sort((a, b) => (b.flag.includes('failed') ? 1 : 0) - (a.flag.includes('failed') ? 1 : 0));

    return base.slice(0, 5);
  }, [cases]);

  const activity = useMemo(() => {
    return cases
      .slice()
      .sort((a, b) => new Date(b.last_uploaded || 0) - new Date(a.last_uploaded || 0))
      .slice(0, 5)
      .map((c, idx) => ({
        title: `Documents updated for ${c.case_id}`,
        case: c.case_id,
        time: fmtDate(c.last_uploaded),
        icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
        bg: idx % 2 ? 'rgba(217,119,6,0.14)' : 'rgba(22,163,74,0.13)',
        color: idx % 2 ? '#B45309' : '#16A34A',
        line: idx < 4 ? 1 : 0,
      }));
  }, [cases]);

  if (loading) {
    return (
      <div style={{ padding: '24px', maxWidth: '1480px', margin: '0 auto' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px', color: 'var(--text-2)' }}>
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1480px', margin: '0 auto' }}>
      {error ? (
        <div style={{ marginBottom: '16px', border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', borderRadius: '12px', padding: '10px 12px', fontSize: '12px', fontWeight: 700 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '18px' }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 17px', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, letterSpacing: '0.3px', color: 'var(--text-3)', textTransform: 'uppercase' }}>{k.label}</span>
              <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: k.iconBg, color: k.iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={k.icon} /></svg>
              </span>
            </div>
            <div style={{ fontSize: '30px', fontWeight: 700, color: 'var(--text)', marginTop: '10px', lineHeight: 1, letterSpacing: '-0.5px' }}>{k.value}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '8px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: k.deltaColor }}>{k.delta}</span>
              <span style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>{k.deltaLabel}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: '16px', marginBottom: '18px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Document Status Distribution</div>
              <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>{stats?.total_documents ?? 0} total documents</div>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', fontFamily: "'JetBrains Mono',monospace" }}>Live API</span>
          </div>
          {phaseDist.map((p, i) => {
            const maxc = Math.max(...phaseDist.map((d) => d.count), 1);
            const pct = `${Math.round((p.count / maxc) * 100)}%`;
            return (
              <div key={`${p.label}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '13px' }}>
                <div style={{ width: '104px', flexShrink: 0, fontSize: '12.5px', fontWeight: 500, color: 'var(--text-2)', textAlign: 'right' }}>{p.label}</div>
                <div style={{ flex: 1, height: '24px', background: 'var(--surface-3)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                  <div style={{ height: '100%', width: pct, background: p.color, borderRadius: '6px' }} />
                </div>
                <div style={{ width: '30px', flexShrink: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text)', fontFamily: "'JetBrains Mono',monospace" }}>{p.count}</div>
              </div>
            );
          })}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Processing Outcomes</div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>Based on uploaded documents</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '22px', padding: '8px 0' }}>
            <div style={{ position: 'relative', width: '148px', height: '148px', flexShrink: 0 }}>
              <svg viewBox="0 0 42 42" width="148" height="148" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--surface-3)" strokeWidth="5" />
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#16A34A" strokeWidth="5" strokeDasharray={`${parseInt(outcomes[0].value, 10)} 100`} strokeLinecap="round" />
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="#D97706" strokeWidth="5" strokeDasharray={`${parseInt(outcomes[1].value, 10)} 100`} strokeDashoffset={`-${parseInt(outcomes[0].value, 10)}`} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '30px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{outcomes[0].value}</span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-3)', marginTop: '3px', letterSpacing: '0.4px' }}>COMPLETED</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {outcomes.map((o) => (
                <div key={o.label} style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: o.color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{o.value}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{o.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: '16px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Cases Requiring Attention</div>
            <button onClick={() => navigate('/case-reports')} style={{ fontSize: '12.5px', fontWeight: 600, color: '#007A33', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              View all
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.8fr 0.8fr 1fr 1fr', padding: '10px 20px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-3)', textTransform: 'uppercase' }}>
            <span>Case No.</span><span>Docs</span><span>Pages</span><span>Status</span><span style={{ textAlign: 'right' }}>Flag</span>
          </div>
          {attRows.length ? attRows.map((r) => {
            let phaseColor = '#64748B';
            let phaseBg = 'rgba(100,116,139,0.13)';
            if (r.status === 'inprogress') { phaseColor = '#B45309'; phaseBg = 'rgba(217,119,6,0.15)'; }
            if (r.status === 'pending') { phaseColor = '#B91C1C'; phaseBg = 'rgba(239,68,68,0.12)'; }

            return (
              <div key={r.caseNo} onClick={() => navigate('/case-reports')} style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.8fr 0.8fr 1fr 1fr', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border-2)', cursor: 'pointer' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", color: 'var(--text)' }}>{r.caseNo}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{r.docs}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{r.pages}</span>
                <span><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, color: phaseColor, background: phaseBg, padding: '3px 9px', borderRadius: '20px' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: phaseColor }} />{r.phase}</span></span>
                <span style={{ textAlign: 'right' }}><span style={{ fontSize: '11px', fontWeight: 600, color: r.flagColor }}>{r.flag}</span></span>
              </div>
            );
          }) : (
            <div style={{ padding: '16px 20px', fontSize: '12px', color: 'var(--text-3)' }}>No cases loaded.</div>
          )}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Recent Activity</div>
          <div style={{ padding: '6px 20px 16px' }}>
            {activity.length ? activity.map((a, i) => (
              <div key={`${a.case}-${i}`} style={{ display: 'flex', gap: '13px', padding: '12px 0' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: a.bg, color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={a.icon} /></svg></span>
                  <span style={{ flex: 1, width: '1.5px', background: 'var(--border)', marginTop: '4px', opacity: a.line }} />
                </div>
                <div style={{ paddingBottom: '4px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.35 }}>{a.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '3px' }}>
                    <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono',monospace", color: '#007A33', fontWeight: 600 }}>{a.case}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>· {a.time}</span>
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ padding: '12px 0', fontSize: '12px', color: 'var(--text-3)' }}>No recent activity.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
