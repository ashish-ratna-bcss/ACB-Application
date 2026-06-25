import React from 'react';

export default function RightRail({ metadata, evidence, audit }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* METADATA */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Case Metadata</div>
        <div style={{ padding: '6px 18px 14px' }}>
          {metadata.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '9px 0', borderBottom: '1px solid var(--border-2)' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-3)', flexShrink: 0 }}>{m.label}</span>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', textAlign: 'right', fontFamily: m.font }}>{m.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* EVIDENCE INVENTORY */}
      {evidence && evidence.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Evidence Inventory</span>
            <span style={{ fontSize: '11px', fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", color: 'var(--text-3)' }}>{evidence.length} items</span>
          </div>
          <div style={{ padding: '6px 18px 12px' }}>
            {evidence.map((ev, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 0', borderBottom: '1px solid var(--border-2)' }}>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: ev.bg, color: ev.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={ev.icon}></path></svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.name}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-3)', fontFamily: "'JetBrains Mono',monospace", marginTop: '1px' }}>{ev.id} · {ev.meta}</div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 600, color: ev.statusColor }}>{ev.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AUDIT TRAIL */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v4l3 2"></path><circle cx="12" cy="12" r="9"></circle></svg>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Audit Trail</span>
        </div>
        <div style={{ padding: '8px 18px 14px' }}>
          {audit.map((al, i) => (
            <div key={i} style={{ padding: '9px 0', borderBottom: '1px solid var(--border-2)' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text)', lineHeight: 1.35 }}>{al.act}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{al.who} · {al.time}</div>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '10px', padding: '8px 11px', background: 'var(--surface-2)', borderRadius: '7px' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#0F7A3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            <span style={{ fontSize: '10.5px', color: 'var(--text-3)', fontFamily: "'JetBrains Mono',monospace" }}>SHA-256 ledger · a3f9c7…d219</span>
          </div>
        </div>
      </div>
    </div>
  );
}
