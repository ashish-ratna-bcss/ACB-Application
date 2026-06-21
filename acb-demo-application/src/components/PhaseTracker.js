import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PhaseTracker({ trackerItems, caseId }) {
  const navigate = useNavigate();

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '22px 24px 20px', boxShadow: 'var(--shadow)', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.4px', color: 'var(--text)', textTransform: 'uppercase' }}>Case Progress</div>
        <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: "'JetBrains Mono',monospace" }}>{caseId}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {trackerItems.map((s, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', minWidth: 0 }}>
            <div style={{ position: 'absolute', top: '17px', left: '-50%', width: '100%', height: '3px', background: s.lineColor, display: s.lineDisplay }}></div>
            <button
              onClick={() => { if (!s.locked && s.route) navigate(s.route); }}
              disabled={s.locked}
              style={{
                position: 'relative', zIndex: 2, width: '36px', height: '36px', borderRadius: '50%',
                background: s.circleBg, border: `2px solid ${s.circleBorder}`, color: s.circleColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700,
                boxShadow: s.ring, cursor: s.locked ? 'not-allowed' : 'pointer', opacity: s.locked ? 0.5 : 1,
              }}
            >
              {s.done ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"></path></svg> : <span>{s.num}</span>}
            </button>
            <div style={{ fontSize: '12.5px', fontWeight: s.labelWeight, color: s.labelColor, marginTop: '9px', textAlign: 'center' }}>{s.label}</div>
            <div style={{ fontSize: '10.5px', color: s.statusColor, fontWeight: 600, marginTop: '2px', textAlign: 'center' }}>{s.statusLabel}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
