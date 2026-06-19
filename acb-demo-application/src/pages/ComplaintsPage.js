import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const complaintsSeed = [
  { id: 'CMP-2026-0187', complainant: 'Sri M. Srinivas', accused: 'Sri K. Venkateswara Rao', designation: 'Assistant Engineer', department: 'Panchayat Raj', location: 'Warangal', amount: 50000, channel: 'Walk-in', priority: 'high', status: 'verification', submittedOn: '2026-06-16T09:20:00' },
  { id: 'CMP-2026-0189', complainant: 'Smt. P. Lalitha', accused: 'Sri B. Ramesh', designation: 'Sub-Registrar', department: 'Registration & Stamps', location: 'Karimnagar', amount: 100000, channel: 'Online Portal', priority: 'critical', status: 'approval', submittedOn: '2026-06-17T12:05:00' },
  { id: 'CMP-2026-0191', complainant: 'Sri N. Harish', accused: 'Smt. P. Lakshmi', designation: 'Revenue Inspector', department: 'Revenue', location: 'Rangareddy', amount: 25000, channel: 'Helpline', priority: 'medium', status: 'drafting', submittedOn: '2026-06-17T16:40:00' },
  { id: 'CMP-2026-0194', complainant: 'Sri A. Raju', accused: 'Sri A. Saidulu', designation: 'MPDO', department: 'Rural Development', location: 'Nalgonda', amount: 75000, channel: 'Walk-in', priority: 'high', status: 'verification', submittedOn: '2026-06-18T08:35:00' },
  { id: 'CMP-2026-0196', complainant: 'Sri V. Prasad', accused: 'Sri N. Prasad', designation: 'AEE', department: 'Irrigation', location: 'Khammam', amount: 200000, channel: 'Vigilance Forward', priority: 'critical', status: 'assigned', submittedOn: '2026-06-18T10:25:00' },
  { id: 'CMP-2026-0198', complainant: 'Smt. B. Kavitha', accused: 'Sri P. Gopal', designation: 'Municipal Officer', department: 'Municipal Administration', location: 'Hyderabad', amount: 40000, channel: 'Online Portal', priority: 'low', status: 'assigned', submittedOn: '2026-06-18T11:45:00' },
];

const statusMeta = {
  assigned: { label: 'Assigned', color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  verification: { label: 'Verification', color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
  drafting: { label: 'Drafting Note', color: '#7C3AED', bg: 'rgba(124,58,237,0.13)' },
  approval: { label: 'Approval Queue', color: '#B45309', bg: 'rgba(217,119,6,0.15)' },
};

const priorityMeta = {
  critical: { label: 'Critical', color: '#B91C1C', bg: 'rgba(220,38,38,0.12)' },
  high: { label: 'High', color: '#B45309', bg: 'rgba(217,119,6,0.15)' },
  medium: { label: 'Medium', color: '#1D4ED8', bg: 'rgba(37,99,235,0.12)' },
  low: { label: 'Low', color: '#64748B', bg: 'rgba(100,116,139,0.13)' },
};

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function ComplaintsPage() {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState(complaintsSeed);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [newComplaint, setNewComplaint] = useState(() => ({
    complainant: '',
    accused: '',
    designation: '',
    department: '',
    location: '',
    amount: '',
    channel: 'Walk-in',
    priority: 'medium',
    status: 'assigned',
  }));

  const filteredComplaints = useMemo(() => {
    const q = search.trim().toLowerCase();
    return complaints
      .filter((complaint) => {
        const matchesSearch = !q || [complaint.id, complaint.complainant, complaint.accused, complaint.department, complaint.location]
          .some((field) => field.toLowerCase().includes(q));
        const matchesStatus = status === 'all' || complaint.status === status;
        const matchesPriority = priority === 'all' || complaint.priority === priority;
        return matchesSearch && matchesStatus && matchesPriority;
      })
      .sort((a, b) => {
        if (sortBy === 'amount') {
          return b.amount - a.amount;
        }
        if (sortBy === 'priority') {
          const order = { critical: 4, high: 3, medium: 2, low: 1 };
          return order[b.priority] - order[a.priority];
        }
        return new Date(b.submittedOn).getTime() - new Date(a.submittedOn).getTime();
      });
  }, [complaints, search, status, priority, sortBy]);

  const stats = useMemo(() => ({
    total: complaints.length,
    critical: complaints.filter((complaint) => complaint.priority === 'critical').length,
    verification: complaints.filter((complaint) => complaint.status === 'verification').length,
    avgAmount: complaints.length ? complaints.reduce((sum, complaint) => sum + complaint.amount, 0) / complaints.length : 0,
  }), [complaints]);

  function updateNewComplaint(field, value) {
    setNewComplaint((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError('');
  }

  function createComplaint() {
    if (!newComplaint.complainant.trim() || !newComplaint.accused.trim() || !newComplaint.department.trim() || !newComplaint.location.trim()) {
      setFormError('Please fill Complainant, Accused, Department, and Location.');
      return;
    }
    const amount = Number(newComplaint.amount || 0);
    if (Number.isNaN(amount) || amount < 0) {
      setFormError('Amount must be a valid number.');
      return;
    }

    const nextId = `CMP-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    setComplaints((prev) => ([
      {
        id: nextId,
        complainant: newComplaint.complainant.trim(),
        accused: newComplaint.accused.trim(),
        designation: newComplaint.designation.trim() || 'Not specified',
        department: newComplaint.department.trim(),
        location: newComplaint.location.trim(),
        amount,
        channel: newComplaint.channel,
        priority: newComplaint.priority,
        status: newComplaint.status,
        submittedOn: new Date().toISOString(),
      },
      ...prev,
    ]));

    setNewComplaint({
      complainant: '',
      accused: '',
      designation: '',
      department: '',
      location: '',
      amount: '',
      channel: 'Walk-in',
      priority: 'medium',
      status: 'assigned',
    });
    setCreateOpen(false);
    setFormError('');
  }

  return (
    <div style={{ maxWidth: '1480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section style={{ background: 'linear-gradient(135deg, #0E141F 0%, #162236 100%)', border: '1px solid #1C2A40', borderRadius: '14px', padding: '20px 22px', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#7F93AE', fontWeight: 600, marginBottom: '8px' }}>Complaint Intake Desk</div>
            <h1 style={{ margin: 0, fontSize: '28px', color: '#F8FAFC', fontWeight: 700 }}>Complaints Command Center</h1>
            <p style={{ margin: '8px 0 0', color: '#B8C7DA', fontSize: '14px', maxWidth: '720px' }}>Track new complaints, prioritize sensitive bribery allegations, and push high-risk entries into verification and approval workflow quickly.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/verification')} style={{ border: '1px solid #35507A', background: '#1D2F4E', color: '#E2E8F0', fontSize: '13px', fontWeight: 600, borderRadius: '10px', padding: '10px 14px' }}>Send to Verification</button>
            <button onClick={() => setCreateOpen(true)} style={{ border: '1px solid #00A84A', background: '#00C853', color: '#052E16', fontSize: '13px', fontWeight: 700, borderRadius: '10px', padding: '10px 14px' }}>Create Complaint</button>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Total Complaints</div>
          <div style={{ marginTop: '8px', fontSize: '29px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{stats.total}</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Critical Priority</div>
          <div style={{ marginTop: '8px', fontSize: '29px', fontWeight: 700, color: '#B91C1C', lineHeight: 1 }}>{stats.critical}</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>In Verification</div>
          <div style={{ marginTop: '8px', fontSize: '29px', fontWeight: 700, color: '#0F7A3D', lineHeight: 1 }}>{stats.verification}</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Average Bribe Demand</div>
          <div style={{ marginTop: '8px', fontSize: '29px', fontWeight: 700, color: '#1D4ED8', lineHeight: 1 }}>{currency.format(stats.avgAmount)}</div>
        </div>
      </section>

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 280px', minWidth: '240px' }}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by complaint ID, complainant, accused, department..."
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: 'var(--text)', background: 'var(--surface-2)' }}
            />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} style={filterSelect}>
            <option value="all">All Status</option>
            <option value="assigned">Assigned</option>
            <option value="verification">Verification</option>
            <option value="drafting">Drafting</option>
            <option value="approval">Approval Queue</option>
          </select>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} style={filterSelect}>
            <option value="all">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={filterSelect}>
            <option value="newest">Sort: Newest</option>
            <option value="amount">Sort: Amount</option>
            <option value="priority">Sort: Priority</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '940px' }}>
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '33%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th style={th}>Complaint</th>
                <th style={th}>Complainant & Accused</th>
                <th style={{ ...th, textAlign: 'right' }}>Risk</th>
                <th style={th}>Workflow</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredComplaints.map((complaint) => {
                const statusPill = statusMeta[complaint.status];
                const priorityPill = priorityMeta[complaint.priority];
                return (
                  <tr
                    key={complaint.id}
                    style={{ background: 'var(--surface)', transition: 'background 120ms ease' }}
                    onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={(event) => { event.currentTarget.style.background = 'var(--surface)'; }}
                  >
                    <td style={td}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12.5px', fontWeight: 600, color: 'var(--text)' }}>{complaint.id}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{formatSubmitted(complaint.submittedOn)}</div>
                    </td>
                    <td style={td}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{complaint.complainant}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{complaint.accused} • {complaint.designation}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{complaint.department} • {complaint.location}</div>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{currency.format(complaint.amount)}</div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', marginTop: '6px', fontSize: '11px', fontWeight: 600, borderRadius: '999px', padding: '3px 9px', color: priorityPill.color, background: priorityPill.bg }}>{priorityPill.label}</span>
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '11px', fontWeight: 600, borderRadius: '999px', padding: '3px 9px', color: statusPill.color, background: statusPill.bg }}>{statusPill.label}</span>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '6px' }}>{complaint.channel}</div>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => navigate('/verification')} style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '12px', fontWeight: 600, borderRadius: '8px', padding: '7px 10px' }}>Open</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {createOpen ? (
        <div style={modalBackdrop}>
          <div style={modalCard}>
            <div style={modalHead}>
              <div>
                <div style={{ fontSize: '11px', letterSpacing: '0.7px', textTransform: 'uppercase', color: '#9FB3C8', fontWeight: 700 }}>New Complaint</div>
                <h2 style={{ margin: '6px 0 0', fontSize: '21px', color: '#F8FAFC' }}>Register Complaint</h2>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#BFD0DF' }}>Capture complaint details and add it directly to intake queue.</p>
              </div>
              <button onClick={() => { setCreateOpen(false); setFormError(''); }} style={closeBtn}>✕</button>
            </div>

            <div style={modalBody}>
              {formError ? <div style={errorBox}>{formError}</div> : null}

              <div style={formSection}>
                <div style={sectionTitle}>People & Incident</div>
                <div style={formGrid}>
                  <div>
                    <label style={label}>Complainant *</label>
                    <input value={newComplaint.complainant} onChange={(event) => updateNewComplaint('complainant', event.target.value)} style={input} placeholder="Enter complainant name" />
                  </div>
                  <div>
                    <label style={label}>Accused Officer *</label>
                    <input value={newComplaint.accused} onChange={(event) => updateNewComplaint('accused', event.target.value)} style={input} placeholder="Enter accused officer name" />
                  </div>
                  <div>
                    <label style={label}>Designation</label>
                    <input value={newComplaint.designation} onChange={(event) => updateNewComplaint('designation', event.target.value)} style={input} placeholder="e.g. Assistant Engineer" />
                  </div>
                  <div>
                    <label style={label}>Department *</label>
                    <input value={newComplaint.department} onChange={(event) => updateNewComplaint('department', event.target.value)} style={input} placeholder="Enter department" />
                  </div>
                  <div style={spanTwoCols}>
                    <label style={label}>Location *</label>
                    <input value={newComplaint.location} onChange={(event) => updateNewComplaint('location', event.target.value)} style={input} placeholder="Enter incident location" />
                  </div>
                </div>
              </div>

              <div style={formSection}>
                <div style={sectionTitle}>Workflow Classification</div>
                <div style={formGrid}>
                  <div>
                    <label style={label}>Bribe Amount (₹)</label>
                    <input value={newComplaint.amount} onChange={(event) => updateNewComplaint('amount', event.target.value)} style={input} placeholder="e.g. 50000" type="number" min="0" />
                  </div>
                  <div>
                    <label style={label}>Channel</label>
                    <select value={newComplaint.channel} onChange={(event) => updateNewComplaint('channel', event.target.value)} style={selectInput}>
                      <option>Walk-in</option>
                      <option>Online Portal</option>
                      <option>Helpline</option>
                      <option>Vigilance Forward</option>
                    </select>
                  </div>
                  <div>
                    <label style={label}>Priority</label>
                    <select value={newComplaint.priority} onChange={(event) => updateNewComplaint('priority', event.target.value)} style={selectInput}>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label style={label}>Workflow Status</label>
                    <select value={newComplaint.status} onChange={(event) => updateNewComplaint('status', event.target.value)} style={selectInput}>
                      <option value="assigned">Assigned</option>
                      <option value="verification">Verification</option>
                      <option value="drafting">Drafting</option>
                      <option value="approval">Approval Queue</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div style={modalFooter}>
                <button onClick={() => { setCreateOpen(false); setFormError(''); }} style={cancelBtn}>Cancel</button>
                <button onClick={createComplaint} style={createBtn}>Create Complaint</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const th = {
  fontSize: '10.5px',
  color: 'var(--text-3)',
  fontWeight: 600,
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  textAlign: 'left',
  padding: '12px 14px',
  borderBottom: '1px solid var(--border)',
};

const td = {
  padding: '12px 14px',
  verticalAlign: 'middle',
  borderBottom: '1px solid var(--border-2)',
};

function formatSubmitted(submittedOn) {
  return new Date(submittedOn).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const modalBackdrop = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 999,
  padding: '20px',
};

const modalCard = {
  width: 'min(980px, 96vw)',
  border: '1px solid var(--border)',
  borderRadius: '14px',
  background: 'var(--surface)',
  boxShadow: '0 18px 48px rgba(15,23,42,0.25)',
  overflow: 'hidden',
  maxHeight: '88vh',
  display: 'flex',
  flexDirection: 'column',
};

const modalHead = {
  borderBottom: '1px solid #1E3447',
  background: 'linear-gradient(135deg,#0E141F 0%,#182735 100%)',
  padding: '14px 16px 12px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '10px',
};

const closeBtn = {
  border: '1px solid #35507A',
  background: '#1D2F4E',
  color: '#E2E8F0',
  width: '30px',
  height: '30px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: 1,
};

const modalBody = {
  padding: '14px 16px 16px',
  display: 'grid',
  gap: '10px',
  overflowY: 'auto',
};

const formSection = {
  border: '1px solid var(--border)',
  borderRadius: '12px',
  background: 'var(--surface-2)',
  padding: '12px',
  display: 'grid',
  gap: '10px',
};

const sectionTitle = {
  fontSize: '11px',
  letterSpacing: '0.6px',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--text-3)',
};

const formGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
};

const label = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '11px',
  letterSpacing: '0.4px',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--text-3)',
};

const input = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '10px 11px',
  fontSize: '12px',
  color: 'var(--text)',
  background: 'var(--surface)',
  minHeight: '40px',
};

const selectInput = {
  ...input,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  paddingRight: '36px',
  backgroundImage: 'linear-gradient(45deg, transparent 50%, #64748B 50%), linear-gradient(135deg, #64748B 50%, transparent 50%)',
  backgroundPosition: 'calc(100% - 16px) calc(50% - 3px), calc(100% - 11px) calc(50% - 3px)',
  backgroundSize: '5px 5px, 5px 5px',
  backgroundRepeat: 'no-repeat',
};

const filterSelect = {
  ...selectInput,
  minWidth: '162px',
  borderRadius: '10px',
  fontSize: '13px',
  backgroundColor: 'var(--surface-2)',
};

const spanTwoCols = {
  gridColumn: '1 / -1',
};

const modalFooter = {
  borderTop: '1px solid var(--border)',
  padding: '11px 16px 12px',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '8px',
  background: 'var(--surface)',
};

const cancelBtn = {
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text-2)',
  borderRadius: '9px',
  fontSize: '12px',
  fontWeight: 700,
  padding: '8px 12px',
};

const createBtn = {
  border: '1px solid #00A84A',
  background: '#00C853',
  color: '#052E16',
  borderRadius: '9px',
  fontSize: '12px',
  fontWeight: 700,
  padding: '8px 12px',
};

const errorBox = {
  border: '1px solid #FCA5A5',
  background: '#FEF2F2',
  color: '#991B1B',
  borderRadius: '10px',
  padding: '8px 10px',
  fontSize: '12px',
  fontWeight: 700,
};