export const navIcon = (id) => ({
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  complaints: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  verification: 'M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  fir: 'M9 2h6v3H9zM8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2M9 13h6M9 17h6',
  trap: 'M12 2v4M12 18v4M2 12h4M18 12h4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  remand: 'M12 3v18M5 7h14M7 7l-3 7h6zM17 7l-3 7h6zM7 21h10',
  investigation: 'M21 21l-4.3-4.3M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14z',
  evidence: 'M3 8h18v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM2 4h20v4H2zM10 12h4',
  court: 'M3 21h18M5 21V10M19 21V10M3 10l9-6 9 6M9 21v-6h6v6',
  prosecution: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 15l2 2 4-4',
  reports: 'M3 3v18h18M8 17V9M13 17V5M18 17v-6',
  admin: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
})[id];

export const statusMeta = (s) => ({
  completed: { label: 'Completed', color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)', dot: '#16A34A' },
  inprogress: { label: 'In Progress', color: '#1D4ED8', bg: 'rgba(37,99,235,0.13)', dot: '#2563EB' },
  pending: { label: 'Pending Approval', color: '#B45309', bg: 'rgba(217,119,6,0.15)', dot: '#D97706' },
  notstarted: { label: 'Not Started', color: '#64748B', bg: 'rgba(100,116,139,0.13)', dot: '#94A3B8' },
  returned: { label: 'Returned', color: '#B91C1C', bg: 'rgba(220,38,38,0.13)', dot: '#DC2626' },
})[s];

export const docStatusMeta = (s) => {
  const m = {
    'Generated': { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
    'Registered': { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
    'Uploaded': { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
    'Pending': { color: '#B45309', bg: 'rgba(217,119,6,0.15)' },
    'Draft': { color: '#1D4ED8', bg: 'rgba(37,99,235,0.13)' },
    'Not Started': { color: '#64748B', bg: 'rgba(100,116,139,0.13)' },
  };
  return m[s] || m['Not Started'];
};

export const phaseDefs = (activeId = 'trap') => {
  const ids = ['complaint', 'verification', 'approval', 'trap', 'remand', 'investigation', 'evidence', 'court', 'prosecution'];
  const activeIdx = ids.includes(activeId) ? ids.indexOf(activeId) : ids.indexOf('trap');

  return ids.map((id, i) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' '),
    status: i < activeIdx ? 'completed' : i === activeIdx ? 'inprogress' : 'notstarted',
  }));
};

export const caseRec = () => ({
  caseId: 'TS-ACB-2026-RCT-0142',
  statusLabel: 'Remand · In Progress',
  ao: { name: 'Sri K. Venkateswara Rao', desig: 'Assistant Engineer', dept: 'TS Panchayat Raj (Engg.)', station: 'Warangal' },
});

export const panelData = (id) => {
  const cp = (label, done) => ({ label, done });
  const map = {
    complaint: {
      title: 'Complaint & Statement', desc: 'Capture and validate the complainant statement, recorded in Telugu and translated to English with entity extraction.',
      checkpoints: [cp('Complaint recorded', 1), cp('Complainant profile captured', 1), cp('Audio statement uploaded', 1), cp('Telugu → English transcript validated', 1)],
      fields: [
        { label: 'Complaint ID', value: 'CMP-2026-0142', font: "'JetBrains Mono',monospace" },
        { label: 'Recorded By', value: 'Insp. D. Prakash Reddy', font: 'inherit' },
        { label: 'Complainant', value: 'Sri M. Srinivas', font: 'inherit' },
        { label: 'Work Pending', value: 'MGNREGS bill release', font: 'inherit' },
        { label: 'Demand Amount', value: '₹50,000', font: "'JetBrains Mono',monospace" },
        { label: 'Language', value: 'Telugu (translated)', font: 'inherit' },
      ],
      documents: [
        { name: 'Complaint Acknowledgement', meta: 'CMP-2026-0142 · v1.0', status: 'Generated', doc: null },
        { name: 'Verbatim / Transcript (EN+TE)', meta: 'TRN-0142 · validated', status: 'Generated', doc: null },
      ],
    },
    verification: {
      title: 'Verification', desc: 'Independently verify the demand before seeking trap permission. Findings approved by the DSP.',
      checkpoints: [cp('Verification observation recorded', 1), cp('Demand independently confirmed', 1), cp('Evidence attached', 1), cp('Approved by DSP', 1)],
      fields: [
        { label: 'Verification Officer', value: 'Insp. D. Prakash Reddy', font: 'inherit' },
        { label: 'Verified On', value: '12-05-2026', font: "'JetBrains Mono',monospace" },
        { label: 'Demand Confirmed', value: '₹50,000', font: "'JetBrains Mono',monospace" },
        { label: 'Approving Authority', value: 'DSP, Warangal Range', font: 'inherit' },
      ],
      documents: [{ name: 'Verification Report', meta: 'VR-0142 · v1.0', status: 'Generated', doc: null }, { name: 'Case Summary Note', meta: 'CSN-0142', status: 'Generated', doc: null }],
    },
    approval: {
      title: 'Approval & FIR Registration', desc: 'Trap permission obtained from Head Office; FIR drafted with recommended legal sections and registered.',
      checkpoints: [cp('Approval request submitted', 1), cp('Head Office approval received', 1), cp('FIR approved', 1), cp('FIR number generated', 1)],
      fields: [
        { label: 'FIR No.', value: '14/RCT-CIU/2026', font: "'JetBrains Mono',monospace" },
        { label: 'Crime No.', value: 'RC 14/2026', font: "'JetBrains Mono',monospace" },
        { label: 'Sections', value: 'Sec. 7, P.C. Act 1988', font: 'inherit' },
        { label: 'Approved By', value: 'DG, ACB (HO)', font: 'inherit' },
      ],
      documents: [
        { name: 'Trap Permission Note', meta: 'TPN-0142 · v1.0', status: 'Generated', doc: null },
        { name: 'First Information Report', meta: '14/RCT-CIU/2026', status: 'Registered', doc: 'fir' },
      ],
    },
    trap: {
      title: 'Trap Operations', desc: 'Pre-trap and post-trap proceedings, currency note inventory, phenolphthalein test, recovery and arrest — auto-compiled into Mediators Reports.',
      checkpoints: [cp('Pre-trap checklist complete', 1), cp('Currency inventory recorded', 1), cp('Audio/video evidence captured', 1), cp('Post-trap report approved', 1)],
      fields: [
        { label: 'Trap Date', value: '14-05-2026', font: "'JetBrains Mono',monospace" },
        { label: 'Time of Occurrence', value: '17:40 hrs', font: "'JetBrains Mono',monospace" },
        { label: 'Scene', value: "AO's chamber, PR Office", font: 'inherit' },
        { label: 'Trap Amount', value: '₹50,000', font: "'JetBrains Mono',monospace" },
        { label: 'Recovery', value: 'Right hip pocket', font: 'inherit' },
        { label: 'Arrest Time', value: '18:05 hrs', font: "'JetBrains Mono',monospace" },
      ],
      documents: [
        { name: 'Mediators Report-I (Pre-Trap)', meta: 'MR1-0142 · v1.0', status: 'Generated', doc: 'med' },
        { name: 'Mediators Report-II (Post-Trap)', meta: 'MR2-0142 · v1.0', status: 'Generated', doc: null },
        { name: 'Seizure Memo', meta: 'SM-0142', status: 'Generated', doc: null },
        { name: 'Scene Sketch', meta: 'SK-0142', status: 'Uploaded', doc: null },
      ],
    },
    remand: {
      title: 'Remand & Administrative Communications', desc: 'Compile the remand bundle and dispatch administrative communications. Radio messages auto-fill recipient details.',
      checkpoints: [cp('Remand diary complete', 1), cp('Court documents dispatched', 1), cp('IO assigned', 1), cp('Radio messages sent', 0)],
      fields: [
        { label: 'Remand Court', value: 'Prl. Special Judge, ACB', font: 'inherit' },
        { label: 'Remand Date', value: '15-05-2026', font: "'JetBrains Mono',monospace" },
        { label: 'IO Assigned', value: 'Insp. D. Prakash Reddy', font: 'inherit' },
        { label: 'Suspension', value: 'Recommended', font: 'inherit' },
      ],
      documents: [
        { name: 'Remand Case Diary', meta: 'RCD-0142', status: 'Generated', doc: null },
        { name: 'Preliminary Report', meta: 'PR-0142', status: 'Generated', doc: null },
        { name: 'Radio Message (Initial)', meta: 'RM-0142-A', status: 'Pending', doc: null },
      ],
    },
    investigation: {
      title: 'Investigation & Departmental Proceedings', desc: 'Plan of action, witness statements (Sec. 164), suspension and reimbursement tracking with evidence-gap analysis.',
      checkpoints: [cp('Plan of action approved', 0), cp('Witness statements completed', 0), cp('Suspension order received', 0), cp('Reimbursement processed', 0)],
      fields: [
        { label: 'Witnesses Listed', value: '7 (LW-1 … LW-7)', font: 'inherit' },
        { label: 'Sec. 164 Statements', value: 'Pending', font: 'inherit' },
        { label: 'Retirement Date', value: '31-07-2031', font: "'JetBrains Mono',monospace" },
        { label: 'Plan Status', value: 'Draft', font: 'inherit' },
      ],
      documents: [
        { name: 'Plan of Action', meta: 'POA-0142', status: 'Draft', doc: null },
        { name: 'Witness Statement Summaries', meta: 'WSS-0142', status: 'Pending', doc: null },
        { name: 'Suspension Recommendation', meta: 'SR-0142', status: 'Pending', doc: null },
      ],
    },
    evidence: {
      title: 'Evidence Chain of Custody', desc: 'Digital vault logging uploads, views, and modifications. Links operational files to Qdrant embeddings for semantic search auditing.',
      checkpoints: [cp('Chain of custody logged', 0), cp('Embeddings linked', 0), cp('Access audit complete', 0)],
      fields: [
        { label: 'Evidence Items', value: '5 logged', font: 'inherit' },
        { label: 'Secured Items', value: '3', font: 'inherit' },
        { label: 'Last Access', value: 'Insp. D. Prakash Reddy', font: 'inherit' },
      ],
      documents: [{ name: 'Evidence Register', meta: 'ER-0142', status: 'Generated', doc: null }],
    },
    court: {
      title: 'Court Proceedings', desc: 'Litigation tracker for hearing dates, bench details, witness summons statuses, and court orders.',
      checkpoints: [cp('Hearings scheduled', 0), cp('Summons tracked', 0), cp('Orders recorded', 0)],
      fields: [
        { label: 'Court', value: 'Prl. Special Judge, SPE & ACB', font: 'inherit' },
        { label: 'Next Hearing', value: 'Pending', font: "'JetBrains Mono',monospace" },
        { label: 'Bench', value: '—', font: 'inherit' },
      ],
      documents: [{ name: 'Hearing Diary', meta: 'HD-0142', status: 'Draft', doc: null }],
    },
    prosecution: {
      title: 'Prosecution & Charge Sheet', desc: 'Draft Final Report, charge sheet, memo of evidence and sanction order — with evidence-to-charge mapping and witness consistency checks.',
      checkpoints: [cp('Forensic reports attached', 0), cp('Evidence indexed', 0), cp('PP review completed', 0), cp('Charge sheet finalised', 0)],
      fields: [
        { label: 'Special Court', value: 'Prl. Special Judge, SPE & ACB', font: 'inherit' },
        { label: 'Sanction Authority', value: 'Govt. of Telangana', font: 'inherit' },
        { label: 'Charges u/s', value: 'Sec. 7 r/w 13, P.C. Act', font: 'inherit' },
        { label: 'DFR Status', value: 'Not Started', font: 'inherit' },
      ],
      documents: [
        { name: 'Draft Final Report (DFR)', meta: 'DFR-0142', status: 'Not Started', doc: null },
        { name: 'Draft Charge Sheet', meta: 'CS-0142', status: 'Not Started', doc: null },
        { name: 'Sanction Order (G.O.)', meta: 'SSO-0142', status: 'Not Started', doc: null },
      ],
    },
  };
  return map[id] || map.trap;
};

export const dashboardData = {
  kpis: [
    { label: 'Active Cases', value: '37', icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11', iconBg: 'rgba(0,200,83,0.13)', iconColor: '#0F7A3D', delta: '+4', deltaColor: '#16A34A', deltaLabel: 'this month' },
    { label: 'Traps (Jun)', value: '5', icon: 'M12 2v4M2 12h4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', iconBg: 'rgba(37,99,235,0.12)', iconColor: '#2563EB', delta: '+2', deltaColor: '#16A34A', deltaLabel: 'vs last month' },
    { label: 'Pending Approvals', value: '6', icon: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', iconBg: 'rgba(217,119,6,0.14)', iconColor: '#B45309', delta: '3', deltaColor: '#B45309', deltaLabel: 'due today' },
    { label: 'Chargesheets (YTD)', value: '23', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 15l2 2 4-4', iconBg: 'rgba(124,58,237,0.13)', iconColor: '#7C3AED', delta: '+6', deltaColor: '#16A34A', deltaLabel: 'this quarter' },
    { label: 'Conviction Rate', value: '71%', icon: 'M3 3v18h18M8 17V9M13 17V5M18 17v-6', iconBg: 'rgba(183,155,74,0.18)', iconColor: '#9A7B2E', delta: '+3pp', deltaColor: '#16A34A', deltaLabel: 'YoY' },
  ],
  distRaw: [
    { label: 'Complaint', count: 4, color: '#94A3B8' },
    { label: 'Verification', count: 6, color: '#2563EB' },
    { label: 'Approval / FIR', count: 2, color: '#D97706' },
    { label: 'Trap', count: 3, color: '#00C853' },
    { label: 'Remand', count: 5, color: '#0EA5A4' },
    { label: 'Investigation', count: 8, color: '#7C3AED' },
    { label: 'Prosecution', count: 7, color: '#007A33' },
  ],
  outcomes: [
    { value: '71%', label: 'Convicted', color: '#16A34A' },
    { value: '17%', label: 'Pending trial', color: '#D97706' },
    { value: '12%', label: 'Acquitted', color: '#CBD5E1' },
  ],
  attRows: [
    { caseNo: 'RCT-0142', ao: 'Sri K. Venkateswara Rao', desig: 'AE, Panchayat Raj', phase: 'Remand', status: 'inprogress', amount: '₹50,000', flag: 'DSP sign-off', flagColor: '#B45309' },
    { caseNo: 'RCT-0151', ao: 'Sri B. Ramesh', desig: 'Sub-Registrar, Karimnagar', phase: 'Investigation', status: 'inprogress', amount: '₹1,00,000', flag: 'Witness due', flagColor: '#B45309' },
    { caseNo: 'RCT-0138', ao: 'Smt. P. Lakshmi', desig: 'Revenue Insp., Rangareddy', phase: 'Verification', status: 'pending', amount: '₹25,000', flag: 'Approval pending', flagColor: '#B45309' },
    { caseNo: 'RCT-0129', ao: 'Sri A. Saidulu', desig: 'MPDO, Nalgonda', phase: 'Prosecution', status: 'inprogress', amount: '₹75,000', flag: 'PP review', flagColor: '#1D4ED8' },
    { caseNo: 'RCT-0155', ao: 'Sri N. Prasad', desig: 'AEE, Irrigation', phase: 'Complaint', status: 'notstarted', amount: '₹2,00,000', flag: 'New', flagColor: '#16A34A' },
  ],
  activity: [
    { title: 'Mediators Report-II generated', case: 'RCT-0142', time: '2h ago', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 15l2 2 4-4', bg: 'rgba(0,200,83,0.13)', color: '#0F7A3D', line: 1 },
    { title: 'FIR registered u/s 7 P.C. Act', case: 'RCT-0155', time: '5h ago', icon: 'M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', bg: 'rgba(37,99,235,0.12)', color: '#2563EB', line: 1 },
    { title: 'Suspension order received', case: 'RCT-0129', time: 'Yesterday', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', bg: 'rgba(183,155,74,0.18)', color: '#9A7B2E', line: 1 },
    { title: 'Audio evidence uploaded', case: 'RCT-0151', time: 'Yesterday', icon: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', bg: 'rgba(124,58,237,0.13)', color: '#7C3AED', line: 1 },
    { title: 'Trap approval granted', case: 'RCT-0142', time: '2 days ago', icon: 'M20 6L9 17l-5-5', bg: 'rgba(22,163,74,0.13)', color: '#16A34A', line: 0 },
  ],
};

export const caseRightRailData = {
  metadata: [
    { label: 'Case No.', value: caseRec().caseId, font: "'JetBrains Mono',monospace" },
    { label: 'FIR No.', value: '14/RCT-CIU/2026', font: "'JetBrains Mono',monospace" },
    { label: 'Registered', value: '14-05-2026', font: "'JetBrains Mono',monospace" },
    { label: 'Complainant', value: 'Sri M. Srinivas', font: 'inherit' },
    { label: 'Department', value: 'Panchayat Raj', font: 'inherit' },
    { label: 'IO', value: 'Insp. D. Prakash Reddy', font: 'inherit' },
    { label: 'Supervising DSP', value: 'G. Anil Kumar', font: 'inherit' },
  ],
  evidence: [
    { type: 'Audio', name: 'Pre-trap conversation (TE)', id: 'EV-0142-A1', meta: '14:22', status: 'Verified', statusColor: '#0F7A3D', icon: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', bg: 'rgba(37,99,235,0.12)', color: '#2563EB' },
    { type: 'Video', name: 'Trap execution CCTV', id: 'EV-0142-V1', meta: '02:08', status: 'Verified', statusColor: '#0F7A3D', icon: 'M23 7l-7 5 7 5zM1 5h15v14H1z', bg: 'rgba(124,58,237,0.13)', color: '#7C3AED' },
    { type: 'Currency', name: 'Tainted notes ₹50,000', id: 'EV-0142-C1', meta: '100 × ₹500', status: 'Seized', statusColor: '#B45309', icon: 'M2 7h20v10H2zM12 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM6 7v10M18 7v10', bg: 'rgba(0,200,83,0.13)', color: '#0F7A3D' },
    { type: 'Document', name: 'Bribe-related official file', id: 'EV-0142-D1', meta: '12 pp.', status: 'Seized', statusColor: '#B45309', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6', bg: 'var(--surface-3,#EEF2F6)', color: 'var(--text-2,#374151)' },
    { type: 'Apparel', name: "AO's shirt (test +ve)", id: 'EV-0142-AP1', meta: 'chemical', status: 'Seized', statusColor: '#B45309', icon: 'M20.4 14.5L16 10 4 22M6 4l4 4 4-4M6 4l-4 4 4 4M18 4l4 4-4 4', bg: 'rgba(217,119,6,0.14)', color: '#B45309' },
  ],
  audit: [
    { act: 'Generated Mediators Report-II', who: 'Insp. D. Prakash Reddy', time: '14 May, 19:42' },
    { act: 'Approved post-trap proceedings', who: 'DSP G. Anil Kumar', time: '14 May, 21:10' },
    { act: 'Hash recorded for EV-0142-V1', who: 'System', time: '14 May, 21:11' },
  ]
};

export const trapSpecificData = {
  currencyNotes: [
    { sl: '1', denom: '₹500', from: '9KL 742301', to: '9KL 742350', count: '50', rowBg: 'var(--surface,#fff)' },
    { sl: '2', denom: '₹500', from: '8AB 553001', to: '8AB 553050', count: '50', rowBg: 'var(--surface-2,#F7F9FB)' },
  ],
  mediators: [
    { name: 'Sri T. Naresh', desig: 'Sr. Asst., Treasury Dept.', initials: 'TN' },
    { name: 'Sri V. Mahesh', desig: 'Jr. Asst., Dist. Registrar', initials: 'VM' },
  ],
  trapSequence: [
    { time: '17:25 hrs', text: 'Trap party positioned discreetly around the Panchayat Raj office. Complainant proceeded to the AO’s chamber with the tainted amount.', dot: '#16A34A', line: 1 },
    { time: '17:40 hrs', text: 'AO demanded and accepted the bribe; complainant executed the pre-arranged signal by wiping his face with a handkerchief.', dot: '#16A34A', line: 1 },
    { time: '17:42 hrs', text: 'Trap party rushed in, identified themselves and secured the AO. AO’s right-hand fingers dipped in fresh sodium carbonate solution — turned pink.', dot: '#16A34A', line: 1 },
    { time: '17:55 hrs', text: 'Tainted notes recovered from AO’s right hip pocket; serial numbers tallied with Mediators Report-I. Official file and shirt seized.', dot: '#16A34A', line: 1 },
    { time: '18:05 hrs', text: 'AO’s spontaneous explanation recorded; formal arrest effected in the presence of both mediators.', dot: '#16A34A', line: 0 },
  ],
};
