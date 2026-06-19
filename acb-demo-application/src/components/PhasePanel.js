import React from 'react';

export default function PhasePanel({ panel, statusMeta }) {
  if (!panel) return null;
  
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
      <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', margin: 0 }}>{panel.title}</h2>
            {statusMeta && (
              <span style={{ fontSize: '11px', fontWeight: 600, color: statusMeta.color, background: statusMeta.bg, padding: '3px 10px', borderRadius: '20px' }}>
                {statusMeta.label}
              </span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-3)', marginTop: '5px', maxWidth: '560px' }}>{panel.desc}</div>
        </div>
      </div>

      {panel.checkpoints && panel.checkpoints.length > 0 && (
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '13px' }}>Phase Checkpoints</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
            {panel.checkpoints.map((cp, i) => {
              const done = cp.done;
              const icon = done ? 'M20 6L9 17l-5-5' : 'M5 12h14';
              const bg = done ? 'rgba(22,163,74,0.13)' : 'transparent';
              const border = done ? '#16A34A' : '#94A3B8';
              const iconColor = done ? '#16A34A' : '#94A3B8';
              const textColor = done ? 'var(--text)' : 'var(--text-3)';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, background: bg, border: `1.5px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor }}>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d={icon}></path></svg>
                  </span>
                  <span style={{ fontSize: '13.5px', fontWeight: 500, color: textColor }}>{cp.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {panel.fields && panel.fields.length > 0 && (
        <div style={{ padding: '18px 22px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '13px' }}>Key Particulars</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 28px' }}>
            {panel.fields.map((f, i) => (
              <div key={i}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-3)', marginBottom: '3px' }}>{f.label}</div>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)', fontFamily: f.font }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
