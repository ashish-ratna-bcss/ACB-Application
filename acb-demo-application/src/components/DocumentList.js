import React, { useState } from 'react';

const DOC_STATUS_THEME = {
  Template: { statusColor: '#1D4ED8', statusBg: 'rgba(37,99,235,0.13)', btnColor: '#1D4ED8', btnBg: 'rgba(37,99,235,0.08)', btnBorder: 'rgba(37,99,235,0.25)', btnLabel: 'View Structure', btnIcon: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
  Generated: { statusColor: '#0F7A3D', statusBg: 'rgba(0,200,83,0.13)', btnColor: '#0F7A3D', btnBg: 'rgba(0,200,83,0.08)', btnBorder: 'rgba(0,200,83,0.25)', btnLabel: 'Open', btnIcon: 'M5 12h14M12 5l7 7-7 7' },
  Registered: { statusColor: '#0F7A3D', statusBg: 'rgba(0,200,83,0.13)', btnColor: '#0F7A3D', btnBg: 'rgba(0,200,83,0.08)', btnBorder: 'rgba(0,200,83,0.25)', btnLabel: 'Open', btnIcon: 'M5 12h14M12 5l7 7-7 7' },
  Uploaded: { statusColor: '#0F7A3D', statusBg: 'rgba(0,200,83,0.13)', btnColor: '#0F7A3D', btnBg: 'rgba(0,200,83,0.08)', btnBorder: 'rgba(0,200,83,0.25)', btnLabel: 'View', btnIcon: 'M5 12h14M12 5l7 7-7 7' },
  Pending: { statusColor: '#B45309', statusBg: 'rgba(217,119,6,0.15)', btnColor: '#B45309', btnBg: 'rgba(217,119,6,0.08)', btnBorder: 'rgba(217,119,6,0.25)', btnLabel: 'Generate', btnIcon: 'M12 5v14M5 12h14' },
  Draft: { statusColor: '#1D4ED8', statusBg: 'rgba(37,99,235,0.13)', btnColor: '#1D4ED8', btnBg: 'rgba(37,99,235,0.08)', btnBorder: 'rgba(37,99,235,0.25)', btnLabel: 'Edit', btnIcon: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' },
  'Not Started': { statusColor: '#64748B', statusBg: 'rgba(100,116,139,0.13)', btnColor: '#64748B', btnBg: 'rgba(100,116,139,0.08)', btnBorder: 'rgba(100,116,139,0.25)', btnLabel: 'Start', btnIcon: 'M12 5v14M5 12h14' },
  linked: { statusColor: '#0F7A3D', statusBg: 'rgba(0,200,83,0.13)', btnColor: '#0F7A3D', btnBg: 'rgba(0,200,83,0.08)', btnBorder: 'rgba(0,200,83,0.25)', btnLabel: 'View', btnIcon: 'M5 12h14M12 5l7 7-7 7' },
};

function withTheme(doc) {
  const theme = DOC_STATUS_THEME[doc.status] || DOC_STATUS_THEME['Not Started'];
  return { ...theme, ...doc };
}

function TemplateStructureModal({ template, onClose }) {
  if (!template) return null;
  const sections = template.structure?.sections || [];
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '720px', maxHeight: '85vh', overflow: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>{template.title}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>{template.description}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '18px', color: 'var(--text-3)' }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {sections.map((sec) => (
            <div key={sec.key} style={{ marginBottom: '16px', padding: '12px 14px', border: '1px solid var(--border-2)', borderRadius: '8px', background: 'var(--surface-2)' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: sec.description ? '4px' : '8px' }}>{sec.title}</div>
              {sec.description ? <div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginBottom: '8px' }}>{sec.description}</div> : null}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(sec.fields || []).map((f) => (
                  <div key={f.key} style={{ fontSize: '12px', color: 'var(--text-2)' }}>
                    <span style={{ fontWeight: 600 }}>{f.label}</span>
                    {f.required ? <span style={{ color: '#B91C1C', marginLeft: '4px' }}>*</span> : null}
                    {f.type && f.type !== 'text' ? <span style={{ color: 'var(--text-3)', marginLeft: '6px' }}>({f.type})</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DocumentList({ documents, reportTemplates = [] }) {
  const [activeTemplate, setActiveTemplate] = useState(null);

  if (!documents || documents.length === 0) return null;

  const templateMap = Object.fromEntries((reportTemplates || []).map((t) => [t.id, t]));

  return (
    <>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text)' }}>Phase Report Templates</div>
          <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Standardized ACB sub-document formats</span>
        </div>
        <div>
          {documents.map((raw, i) => {
            const d = withTheme(raw);
            const tpl = d.templateId ? templateMap[d.templateId] : null;
            return (
              <div key={d.templateId || i} style={{ display: 'flex', alignItems: 'center', gap: '13px', padding: '13px 22px', borderBottom: '1px solid var(--border-2)' }}>
                <span style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--surface-3)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" /></svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}>{d.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '1px', fontFamily: "'JetBrains Mono',monospace" }}>{d.meta}</div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: d.statusColor, background: d.statusBg, padding: '3px 10px', borderRadius: '20px' }}>{d.status}</span>
                <button
                  type="button"
                  onClick={() => tpl && setActiveTemplate(tpl)}
                  disabled={!tpl}
                  style={{ fontSize: '12.5px', fontWeight: 600, color: d.btnColor, background: d.btnBg, border: `1px solid ${d.btnBorder}`, borderRadius: '7px', padding: '6px 13px', display: 'flex', alignItems: 'center', gap: '5px', cursor: tpl ? 'pointer' : 'not-allowed', opacity: tpl ? 1 : 0.5 }}
                >
                  {d.btnLabel}
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d.btnIcon} /></svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <TemplateStructureModal template={activeTemplate} onClose={() => setActiveTemplate(null)} />
    </>
  );
}
