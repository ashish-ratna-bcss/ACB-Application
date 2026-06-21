import React from 'react';

const STATUS_THEME = {
  completed: { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)', label: 'Completed' },
  in_progress: { color: '#1D4ED8', bg: 'rgba(37,99,235,0.13)', label: 'In Progress' },
  pending: { color: '#64748B', bg: 'rgba(100,116,139,0.13)', label: 'Pending' },
};

export default function CaseFlowSteps({ steps = [], title = 'Case Processing Flow', compact = false }) {
  if (!steps.length) return null;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '14px', fontWeight: 700 }}>{title}</div>
        {!compact && (
          <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '4px' }}>
            25-step ACB trap case lifecycle — a case may contain multiple complaints and supporting documents
          </div>
        )}
      </div>
      <div style={{ maxHeight: compact ? '280px' : '420px', overflowY: 'auto' }}>
        {steps.map((s) => {
          const theme = STATUS_THEME[s.status] || STATUS_THEME.pending;
          return (
            <div key={s.id || s.step} style={{ display: 'grid', gridTemplateColumns: compact ? '36px 1fr' : '48px 1fr auto', gap: '12px', padding: '12px 18px', borderBottom: '1px solid var(--border-2)', alignItems: 'start' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: theme.bg, color: theme.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>
                {s.step}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{s.stage}</span>
                  {s.optional ? (
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#7C3AED', background: 'rgba(124,58,237,0.12)', padding: '2px 7px', borderRadius: '999px' }}>Optional</span>
                  ) : null}
                </div>
                {!compact && s.activity ? (
                  <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '4px', lineHeight: 1.45 }}>{s.activity}</div>
                ) : null}
                {s.templateIds?.length ? (
                  <div style={{ fontSize: '10.5px', color: 'var(--text-3)', marginTop: '6px', fontFamily: "'JetBrains Mono',monospace" }}>
                    Templates: {s.templateIds.join(', ')}
                  </div>
                ) : null}
              </div>
              {!compact ? (
                <span style={{ fontSize: '10px', fontWeight: 600, color: theme.color, background: theme.bg, padding: '3px 9px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                  {theme.label}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ComplaintsList({ complaints = [] }) {
  if (!complaints.length) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px' }}>Linked Complaints ({complaints.length})</div>
      {complaints.map((c) => (
        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border-2)', fontSize: '12px' }}>
          <div>
            <span style={{ fontWeight: 600 }}>{c.complainantName}</span>
            <span style={{ color: 'var(--text-3)', marginLeft: '8px' }}>{c.trackingId}</span>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'capitalize', color: c.complaintType === 'further' ? '#7C3AED' : '#2563EB' }}>
            {c.complaintType || 'initial'}
          </span>
        </div>
      ))}
    </div>
  );
}
