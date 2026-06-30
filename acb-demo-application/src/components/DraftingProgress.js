import React from 'react';

/**
 * Step-by-step progress indicator for verification-phase report drafting.
 *
 * steps: [{ id, label, sublabel }]
 * currentStep: id of the active step
 * completedSteps: Set of completed step ids
 * error: string | null
 */

const SPIN_CSS = `@keyframes dpSpin { to { transform: rotate(360deg); } }
@keyframes dpPulse { 0%,100%{opacity:1} 50%{opacity:.4} }`;

function StepIcon({ status }) {
  if (status === 'done') {
    return (
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  if (status === 'active') {
    return (
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid #F59E0B', borderTopColor: '#92400E', display: 'inline-block', flexShrink: 0, animation: 'dpSpin 0.8s linear infinite' }} />
    );
  }
  if (status === 'error') {
    return (
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </div>
    );
  }
  // pending
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #475569', background: 'var(--surface-2)', flexShrink: 0 }} />
  );
}

export default function DraftingProgress({ steps, currentStep, completedSteps, error }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid #F59E0B', borderRadius: '12px', padding: '18px 20px', boxShadow: 'var(--shadow)' }}>
      <style>{SPIN_CSS}</style>
      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '16px' }}>
        Drafting Phase Reports
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {steps.map((step, i) => {
          const done = completedSteps.has(step.id);
          const active = !done && step.id === currentStep;
          const isError = error && step.id === currentStep;
          const status = isError ? 'error' : done ? 'done' : active ? 'active' : 'pending';
          const isLast = i === steps.length - 1;

          return (
            <div key={step.id} style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
              {/* Icon + connector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '1px' }}>
                <StepIcon status={status} />
                {!isLast && (
                  <div style={{ width: 2, flex: 1, minHeight: 16, background: done ? '#16A34A' : '#334155', margin: '4px 0', borderRadius: 2 }} />
                )}
              </div>
              {/* Text */}
              <div style={{ paddingBottom: isLast ? 0 : '14px', paddingTop: '2px', minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: active ? 700 : 600, color: done ? '#16A34A' : active ? 'var(--text)' : isError ? '#DC2626' : '#64748B' }}>
                  {step.label}
                  {active && !isError && (
                    <span style={{ marginLeft: 6, fontSize: '11px', fontWeight: 400, color: '#F59E0B', animation: 'dpPulse 1.2s ease-in-out infinite' }}>
                      processing…
                    </span>
                  )}
                  {done && (
                    <span style={{ marginLeft: 6, fontSize: '11px', fontWeight: 400, color: '#16A34A' }}>done</span>
                  )}
                </div>
                {step.sublabel && (
                  <div style={{ fontSize: '11px', color: active ? '#B45309' : '#64748B', marginTop: '2px' }}>
                    {step.sublabel}
                  </div>
                )}
                {isError && (
                  <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '4px' }}>{error}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
