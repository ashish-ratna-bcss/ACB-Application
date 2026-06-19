import React from 'react';
import { caseRec, phaseDefs, statusMeta, panelData, caseRightRailData, trapSpecificData } from '../data';
import CaseHeaderBand from './CaseHeaderBand';
import PhaseTracker from './PhaseTracker';
import PhasePanel from './PhasePanel';
import RightRail from './RightRail';
import DocumentList from './DocumentList';

export default function CaseDetailsPanel({ caseData, onClose }) {
  if (!caseData) return null;

  // Determine active phase based on URL
  const path = window.location.pathname.replace('/', '');
  const ids = ['complaint', 'verification', 'approval', 'trap', 'remand', 'investigation', 'prosecution'];
  const activePhase = ids.includes(path) ? path : 'trap';
  const phaseDefsData = phaseDefs(activePhase);
  const activeDef = phaseDefsData.find(p => p.id === activePhase);

  const c = caseRec();
  // Override mock case data with actual clicked row data if possible
  c.caseId = caseData.id || c.caseId;
  c.ao = {
    name: caseData.accused || c.ao.name,
    desig: caseData.department || c.ao.desig,
    dept: caseData.department || c.ao.dept,
    station: caseData.location || c.ao.station
  };
  
  const sm = statusMeta(activeDef.status);
  const panel = panelData(activePhase);

  const tracker = phaseDefsData.map((p, i) => {
    const m = statusMeta(p.status);
    const done = p.status === 'completed';
    const active = p.id === activePhase;
    const prevDone = i > 0 && (phaseDefsData[i-1].status === 'completed');
    
    const circleBg = done ? '#16A34A' : (active ? 'var(--surface-3, #fff)' : 'var(--surface, #fff)');
    const circleBorder = done ? '#16A34A' : (p.status === 'inprogress' ? '#2563EB' : '#94A3B8');
    const circleColor = done ? '#fff' : (p.status === 'inprogress' ? '#2563EB' : '#94A3B8');
    const ring = active ? '0 0 0 4px rgba(0,200,83,0.22)' : 'none';
    
    return {
      id: p.id,
      label: p.label, num: i + 1, done,
      statusLabel: m.label, statusColor: m.color,
      circleBg, circleBorder, circleColor, ring,
      labelWeight: active ? 700 : 600,
      labelColor: active ? '#0F7A3D' : 'var(--text-2)',
      lineColor: prevDone ? '#16A34A' : 'var(--border)',
      lineDisplay: i === 0 ? 'none' : 'block'
    };
  });

  const { metadata, evidence, audit } = caseRightRailData;
  const { currencyNotes, mediators, trapSequence } = trapSpecificData;

  return (
    <>
      {/* Backdrop */}
      <div 
        style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.6)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} 
        onClick={onClose} 
      >
        {/* Center Modal */}
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{ 
            width: '100%', maxWidth: '1280px', height: '94vh', 
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', 
            zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' 
          }}
        >
          <style>{`
            @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
          `}</style>
          
          {/* Header Action Bar */}
          <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-2)' }}>Case Detailed View</div>
            <button 
              onClick={onClose} 
              style={{ width: '30px', height: '30px', borderRadius: '6px', background: 'transparent', border: 'none', color: '#7F93AE', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1A2230'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
            </button>
          </div>

          {/* Scrolling Content Area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <CaseHeaderBand caseData={c} />
            <PhaseTracker trackerItems={tracker} caseId={c.caseId} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px', alignItems: 'start' }}>
              {/* LEFT: PHASE CONTENT */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
                <PhasePanel panel={panel} statusMeta={sm} />

                {/* Trap specifics if phase is trap */}
                {activePhase === 'trap' && (
                  <>
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
                      <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '11px', background: 'var(--surface-2)' }}>
                        <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(0,200,83,0.13)', color: '#0F7A3D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg></span>
                        <div style={{ flex: 1 }}><div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text)' }}>Pre-Trap Proceedings — Mediators Report-I</div><div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '1px' }}>ACB Office · 14 May 2026 · 14:10–16:30 hrs</div></div>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#0F7A3D', background: 'rgba(0,200,83,0.13)', padding: '3px 10px', borderRadius: '20px' }}>Completed</span>
                      </div>
                      <div style={{ padding: '18px 22px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '11px' }}>Currency Note Inventory · Total ₹50,000</div>
                        <div style={{ border: '1px solid var(--border)', borderRadius: '9px', overflow: 'hidden', marginBottom: '18px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 1.3fr 1.3fr 70px', padding: '9px 14px', background: 'var(--surface-2)', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.4px', color: 'var(--text-3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
                            <span>Sl.</span><span>Denom.</span><span>From Serial</span><span>To Serial</span><span style={{ textAlign: 'right' }}>Count</span>
                          </div>
                          {currencyNotes.map((n, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '48px 1fr 1.3fr 1.3fr 70px', padding: '10px 14px', fontSize: '12.5px', color: 'var(--text-2)', background: n.rowBg, fontFamily: "'JetBrains Mono',monospace" }}>
                              <span>{n.sl}</span><span style={{ fontWeight: 600, color: 'var(--text)' }}>{n.denom}</span><span>{n.from}</span><span>{n.to}</span><span style={{ textAlign: 'right', fontWeight: 600 }}>{n.count}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                          <div style={{ border: '1px solid var(--border)', borderRadius: '9px', padding: '13px 15px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', marginBottom: '9px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Phenolphthalein Test</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><span style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'rgba(190, 24, 93, 0.1)', border: '1px solid rgba(190, 24, 93, 0.3)', flexShrink: 0 }}></span><div style={{ fontSize: '12.5px', color: 'var(--text-2)', lineHeight: 1.4 }}>Notes smeared & demonstrated — sodium carbonate solution turned <b style={{ color: '#F472B6' }}>pink</b> before mediators.</div></div>
                          </div>
                          <div style={{ border: '1px solid var(--border)', borderRadius: '9px', padding: '13px 15px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)', marginBottom: '9px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>Pre-Arranged Signal</div>
                            <div style={{ fontSize: '12.5px', color: 'var(--text-2)', lineHeight: 1.4 }}>Complainant to wipe face with handkerchief <b style={{ color: 'var(--text)' }}>only after</b> bribe is paid on demand.</div>
                          </div>
                        </div>
                        <div style={{ marginTop: '16px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: '11px' }}>Independent Mediators</div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          {mediators.map((m, i) => (
                            <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '11px', border: '1px solid var(--border)', borderRadius: '9px', padding: '11px 13px' }}>
                              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--text-2)', flexShrink: 0 }}>{m.initials}</div>
                              <div style={{ minWidth: 0 }}><div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{m.name}</div><div style={{ fontSize: '11px', color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.desig}</div></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
                      <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '11px', background: 'var(--surface-2)' }}>
                        <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(37,99,235,0.12)', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M2 12h4M18 12h4"></path><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="3"></circle></svg></span>
                        <div style={{ flex: 1 }}><div style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text)' }}>Post-Trap Proceedings — Mediators Report-II</div><div style={{ fontSize: '11.5px', color: 'var(--text-3)', marginTop: '1px' }}>Scene: AO's chamber · 17:40 hrs</div></div>
                      </div>
                      <div style={{ padding: '18px 22px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {trapSequence.map((e, i) => (
                            <div key={i} style={{ display: 'flex', gap: '13px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}><span style={{ width: '11px', height: '11px', borderRadius: '50%', background: e.dot, border: '2px solid var(--surface)', boxShadow: '0 0 0 1.5px ' + e.dot, marginTop: '4px' }}></span><span style={{ flex: 1, width: '2px', background: 'var(--border)', opacity: e.line }}></span></div>
                              <div style={{ paddingBottom: '15px' }}><div style={{ fontSize: '11px', fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", color: '#00C853' }}>{e.time}</div><div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.45, marginTop: '2px' }}>{e.text}</div></div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '13px', marginTop: '6px', padding: '13px 15px', borderRadius: '9px', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)' }}>
                          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 12l2 2 4-4"></path><circle cx="12" cy="12" r="9"></circle></svg>
                          <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.4 }}><b style={{ color: 'var(--text)' }}>Recovery confirmed.</b> Tainted notes recovered from AO's pocket; serial numbers tallied. AO formally arrested.</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                
                <DocumentList documents={panel.documents} />
              </div>

              {/* RIGHT RAIL */}
              <RightRail metadata={metadata} evidence={evidence} audit={audit} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
