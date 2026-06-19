import React from 'react';

export default function DocumentList({ documents }) {
  if (!documents || documents.length === 0) return null;
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text)' }}>Auto-Generated Documents</div>
        <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Pulled from master case record</span>
      </div>
      <div>
        {documents.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '13px', padding: '13px 22px', borderBottom: '1px solid var(--border-2)' }}>
            <span style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--surface-3)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5"></path></svg>
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}>{d.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '1px', fontFamily: "'JetBrains Mono',monospace" }}>{d.meta}</div>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: d.statusColor, background: d.statusBg, padding: '3px 10px', borderRadius: '20px' }}>{d.status}</span>
            <button style={{ fontSize: '12.5px', fontWeight: 600, color: d.btnColor, background: d.btnBg, border: `1px solid ${d.btnBorder}`, borderRadius: '7px', padding: '6px 13px', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
              {d.btnLabel}
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d.btnIcon}></path></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
