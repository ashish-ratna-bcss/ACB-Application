export const PHASE_ORDER = [
  'complaint',
  'verification',
  'approval',
  'trap',
  'remand',
  'investigation',
  'evidence',
  'court',
  'prosecution',
];

export const PHASE_LABELS = {
  complaint: 'Complaint',
  verification: 'Verification',
  approval: 'FIR / Approval',
  trap: 'Trap Operations',
  remand: 'Remand',
  investigation: 'Investigation',
  evidence: 'Evidence',
  court: 'Court',
  prosecution: 'Prosecution',
};

export const PHASE_ROUTES = {
  complaint: '/complaints',
  verification: '/verification',
  approval: '/fir-approval',
  trap: '/trap',
  remand: '/remand',
  investigation: '/investigation',
  evidence: '/evidence',
  court: '/court',
  prosecution: '/prosecution',
};

/** Phases locked in sidebar until cases reach investigation+ */
export function isPhaseNavLocked(phase, casesAtPhase = {}) {
  if (phase === 'evidence') {
    const inv = casesAtPhase.investigation || 0;
    const ev = casesAtPhase.evidence || 0;
    return inv + ev === 0;
  }
  if (phase === 'court') {
    const ev = casesAtPhase.evidence || 0;
    const co = casesAtPhase.court || 0;
    return ev + co === 0;
  }
  return false;
}

export function phaseDefsFromWorkflow(phases, activeId) {
  if (Array.isArray(phases) && phases.length) {
    return phases.map((p) => ({
      id: p.id,
      label: p.label,
      status: p.status,
      locked: p.locked,
    }));
  }
  const activeIdx = PHASE_ORDER.indexOf(activeId);
  return PHASE_ORDER.map((id, i) => ({
    id,
    label: PHASE_LABELS[id],
    status: i < activeIdx ? 'completed' : i === activeIdx ? 'inprogress' : 'notstarted',
    locked: false,
  }));
}
