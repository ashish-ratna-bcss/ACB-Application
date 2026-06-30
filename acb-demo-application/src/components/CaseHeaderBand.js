import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function CaseHeaderBand({ caseData }) {
  const navigate = useNavigate();
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 22px', boxShadow: 'var(--shadow)', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <button onClick={() => navigate('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', background: 'none', border: 'none', padding: 0, marginBottom: '9px', cursor: 'pointer' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"></path></svg> Dashboard
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: '#fff', background: '#0E141F', padding: '4px 11px', borderRadius: '7px', letterSpacing: '0.3px' }}>{caseData.caseId}</span>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.3px' }}>{caseData.ao.name}</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#1D4ED8', background: 'rgba(37,99,235,0.12)', padding: '4px 11px', borderRadius: '20px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#1D4ED8', animation: 'acbPulse 2s ease infinite' }}></span>{caseData.statusLabel}
            </span>
          </div>
          <div style={{ fontSize: '13.5px', color: 'var(--text-2)', marginTop: '6px' }}>
            {[caseData.ao.desig, caseData.ao.dept, caseData.ao.station].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
        {caseData.trapAmount && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.4px', color: 'var(--text-3)', textTransform: 'uppercase' }}>Trap Amount</div>
            <div style={{ fontSize: '21px', fontWeight: 700, color: '#16A34A', fontFamily: "'JetBrains Mono',monospace", marginTop: '3px' }}>{caseData.trapAmount}</div>
          </div>
        )}
      </div>
    </div>
  );
}
