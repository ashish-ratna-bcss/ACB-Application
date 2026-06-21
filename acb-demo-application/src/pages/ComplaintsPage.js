import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';

const statusMeta = {
  draft: { label: 'Draft', color: '#64748B', bg: 'rgba(100,116,139,0.13)' },
  assigned: { label: 'Assigned', color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  submitted: { label: 'Submitted', color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
};

const priorityMeta = {
  critical: { label: 'Critical', color: '#B91C1C', bg: 'rgba(220,38,38,0.12)' },
  high: { label: 'High', color: '#B45309', bg: 'rgba(217,119,6,0.15)' },
  medium: { label: 'Medium', color: '#1D4ED8', bg: 'rgba(37,99,235,0.12)' },
  low: { label: 'Low', color: '#64748B', bg: 'rgba(100,116,139,0.13)' },
};

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

const DSP_OPTIONS = [
  { id: 'dsp-001', name: 'DSP Ramesh Kumar' },
  { id: 'dsp-002', name: 'DSP Kiran Reddy' },
  { id: 'dsp-003', name: 'DSP Venkat Rao' },
];

export default function ComplaintsPage() {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [createOpen, setCreateOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [newComplaint, setNewComplaint] = useState({
    complainant: '',
    accused: '',
    designation: '',
    department: '',
    location: '',
    amount: '',
    channel: 'Walk-in',
    priority: 'medium',
    language: 'en',
    dspId: '',
    summary: '',
    hasEvidence: false,
    submitToVerification: false,
  });

  const loadComplaints = useCallback(() => {
    setLoading(true);
    api.getComplaints()
      .then((data) => setComplaints(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadComplaints(); }, [loadComplaints]);

  const filteredComplaints = useMemo(() => {
    const q = search.trim().toLowerCase();
    return complaints
      .filter((c) => {
        const matchesSearch = !q || [c.trackingId, c.complainantName, c.accusedName, c.accusedDepartment, c.location]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q));
        const matchesStatus = status === 'all' || c.status === status;
        const matchesPriority = priority === 'all' || c.priority === priority;
        return matchesSearch && matchesStatus && matchesPriority;
      })
      .sort((a, b) => {
        if (sortBy === 'amount') return (b.amountInvolved || 0) - (a.amountInvolved || 0);
        if (sortBy === 'priority') {
          const order = { critical: 4, high: 3, medium: 2, low: 1 };
          return (order[b.priority] || 0) - (order[a.priority] || 0);
        }
        return new Date(b.submittedOn || 0).getTime() - new Date(a.submittedOn || 0).getTime();
      });
  }, [complaints, search, status, priority, sortBy]);

  const stats = useMemo(() => ({
    total: complaints.length,
    critical: complaints.filter((c) => c.priority === 'critical').length,
    submitted: complaints.filter((c) => c.status === 'submitted').length,
    avgAmount: complaints.length ? complaints.reduce((s, c) => s + (c.amountInvolved || 0), 0) / complaints.length : 0,
  }), [complaints]);

  function updateNewComplaint(field, value) {
    setNewComplaint((prev) => ({ ...prev, [field]: value }));
    if (formError) setFormError('');
  }

  async function createComplaint() {
    if (!newComplaint.complainant.trim() || !newComplaint.accused.trim() || !newComplaint.department.trim() || !newComplaint.location.trim()) {
      setFormError('Please fill Complainant, Accused, Department, and Location.');
      return;
    }
    const amount = Number(newComplaint.amount || 0);
    if (Number.isNaN(amount) || amount < 0) {
      setFormError('Amount must be a valid number.');
      return;
    }

    const dsp = DSP_OPTIONS.find((d) => d.id === newComplaint.dspId);
    try {
      await api.createComplaint({
        complainantName: newComplaint.complainant.trim(),
        accusedName: newComplaint.accused.trim(),
        accusedDesignation: newComplaint.designation.trim() || undefined,
        accusedDepartment: newComplaint.department.trim(),
        location: newComplaint.location.trim(),
        amountInvolved: amount,
        channel: newComplaint.channel,
        priority: newComplaint.priority,
        language: newComplaint.language,
        summary: newComplaint.summary || undefined,
        hasEvidence: newComplaint.hasEvidence,
        dspId: dsp?.id,
        dspName: dsp?.name,
        submitToVerification: newComplaint.submitToVerification,
      });
      setNewComplaint({
        complainant: '', accused: '', designation: '', department: '', location: '',
        amount: '', channel: 'Walk-in', priority: 'medium', language: 'en', dspId: '',
        summary: '', hasEvidence: false, submitToVerification: false,
      });
      setCreateOpen(false);
      loadComplaints();
    } catch (e) {
      setFormError(e.message);
    }
  }

  async function submitToVerification(complaint) {
    try {
      await api.submitComplaint(complaint.id);
      loadComplaints();
      navigate('/verification');
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div style={{ maxWidth: '1480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section style={{ background: 'linear-gradient(135deg, #0E141F 0%, #162236 100%)', border: '1px solid #1C2A40', borderRadius: '14px', padding: '20px 22px', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#7F93AE', fontWeight: 600, marginBottom: '8px' }}>Complaint Intake Engine</div>
            <h1 style={{ margin: 0, fontSize: '28px', color: '#F8FAFC', fontWeight: 700 }}>Complaints Command Center</h1>
            <p style={{ margin: '8px 0 0', color: '#B8C7DA', fontSize: '14px', maxWidth: '720px' }}>Create draft complaints with language preferences, assign DSPs, generate tracking IDs, and initiate the case lifecycle.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/verification')} style={{ border: '1px solid #35507A', background: '#1D2F4E', color: '#E2E8F0', fontSize: '13px', fontWeight: 600, borderRadius: '10px', padding: '10px 14px' }}>Verification Queue</button>
            <button onClick={() => setCreateOpen(true)} style={{ border: '1px solid #00A84A', background: '#00C853', color: '#052E16', fontSize: '13px', fontWeight: 700, borderRadius: '10px', padding: '10px 14px' }}>Create Complaint</button>
          </div>
        </div>
      </section>

      {error ? <div style={errorBox}>{error}</div> : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        <StatCard label="Total Complaints" value={stats.total} />
        <StatCard label="Critical Priority" value={stats.critical} color="#B91C1C" />
        <StatCard label="Submitted" value={stats.submitted} color="#0F7A3D" />
        <StatCard label="Average Bribe Demand" value={currency.format(stats.avgAmount)} color="#1D4ED8" />
      </section>

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by tracking ID, complainant, accused..." style={{ ...input, flex: '1 1 280px' }} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={filterSelect}>
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="assigned">Assigned</option>
            <option value="submitted">Submitted</option>
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} style={filterSelect}>
            <option value="all">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={filterSelect}>
            <option value="newest">Sort: Newest</option>
            <option value="amount">Sort: Amount</option>
            <option value="priority">Sort: Priority</option>
          </select>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-3)' }}>Loading complaints…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'separate', minWidth: '940px' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th style={th}>Tracking ID</th>
                <th style={th}>Complainant & Accused</th>
                <th style={{ ...th, textAlign: 'right' }}>Risk</th>
                <th style={th}>Workflow</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredComplaints.map((c) => {
                const st = statusMeta[c.status] || statusMeta.draft;
                const pr = priorityMeta[c.priority] || priorityMeta.medium;
                return (
                  <tr key={c.id}>
                    <td style={td}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12.5px', fontWeight: 600 }}>{c.trackingId}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{formatSubmitted(c.submittedOn)} · {c.language === 'te' ? 'Telugu' : 'English'}</div>
                    </td>
                    <td style={td}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{c.complainantName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{c.accusedName} • {c.accusedDesignation || '—'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{c.accusedDepartment} • {c.location}</div>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{currency.format(c.amountInvolved || 0)}</div>
                      <span style={{ ...pill, color: pr.color, background: pr.bg }}>{pr.label}</span>
                    </td>
                    <td style={td}>
                      <span style={{ ...pill, color: st.color, background: st.bg }}>{st.label}</span>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '6px' }}>{c.dspName || c.channel}</div>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {c.status !== 'submitted' ? (
                        <button onClick={() => submitToVerification(c)} style={actionBtn}>Submit</button>
                      ) : (
                        <button onClick={() => navigate('/verification')} style={actionBtn}>Open</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {createOpen ? (
        <div style={modalBackdrop}>
          <div style={modalCard}>
            <div style={modalHead}>
              <div>
                <h2 style={{ margin: '6px 0 0', fontSize: '21px', color: '#F8FAFC' }}>Register Draft Complaint</h2>
                <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#BFD0DF' }}>Creates a case with unique tracking ID and optional verification submission.</p>
              </div>
              <button onClick={() => setCreateOpen(false)} style={closeBtn}>✕</button>
            </div>
            <div style={modalBody}>
              {formError ? <div style={errorBox}>{formError}</div> : null}
              <div style={formGrid}>
                <Field label="Complainant *"><input value={newComplaint.complainant} onChange={(e) => updateNewComplaint('complainant', e.target.value)} style={input} /></Field>
                <Field label="Accused Officer *"><input value={newComplaint.accused} onChange={(e) => updateNewComplaint('accused', e.target.value)} style={input} /></Field>
                <Field label="Designation"><input value={newComplaint.designation} onChange={(e) => updateNewComplaint('designation', e.target.value)} style={input} /></Field>
                <Field label="Department *"><input value={newComplaint.department} onChange={(e) => updateNewComplaint('department', e.target.value)} style={input} /></Field>
                <Field label="Location *"><input value={newComplaint.location} onChange={(e) => updateNewComplaint('location', e.target.value)} style={input} /></Field>
                <Field label="Language">
                  <select value={newComplaint.language} onChange={(e) => updateNewComplaint('language', e.target.value)} style={input}>
                    <option value="en">English</option>
                    <option value="te">Telugu</option>
                    <option value="bilingual">English + Telugu</option>
                  </select>
                </Field>
                <Field label="Assign DSP">
                  <select value={newComplaint.dspId} onChange={(e) => updateNewComplaint('dspId', e.target.value)} style={input}>
                    <option value="">— Select DSP —</option>
                    {DSP_OPTIONS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </Field>
                <Field label="Bribe Amount (₹)"><input type="number" value={newComplaint.amount} onChange={(e) => updateNewComplaint('amount', e.target.value)} style={input} /></Field>
                <Field label="Priority">
                  <select value={newComplaint.priority} onChange={(e) => updateNewComplaint('priority', e.target.value)} style={input}>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </Field>
                <Field label="Channel">
                  <select value={newComplaint.channel} onChange={(e) => updateNewComplaint('channel', e.target.value)} style={input}>
                    <option>Walk-in</option>
                    <option>Online Portal</option>
                    <option>Helpline</option>
                    <option>Vigilance Forward</option>
                  </select>
                </Field>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <input type="checkbox" checked={newComplaint.hasEvidence} onChange={(e) => updateNewComplaint('hasEvidence', e.target.checked)} />
                  Supporting evidence attached
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  <input type="checkbox" checked={newComplaint.submitToVerification} onChange={(e) => updateNewComplaint('submitToVerification', e.target.checked)} />
                  Submit to Verification immediately
                </label>
              </div>
            </div>
            <div style={modalFooter}>
              <button onClick={() => setCreateOpen(false)} style={cancelBtn}>Cancel</button>
              <button onClick={createComplaint} style={createBtn}>Create Complaint</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ marginTop: '8px', fontSize: '29px', fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function formatSubmitted(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const th = { fontSize: '10.5px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', textAlign: 'left', padding: '12px 14px', borderBottom: '1px solid var(--border)' };
const td = { padding: '12px 14px', borderBottom: '1px solid var(--border-2)' };
const pill = { display: 'inline-flex', marginTop: '6px', fontSize: '11px', fontWeight: 600, borderRadius: '999px', padding: '3px 9px' };
const input = { width: '100%', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 11px', fontSize: '12px', background: 'var(--surface)' };
const filterSelect = { ...input, minWidth: '162px' };
const actionBtn = { border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: '12px', fontWeight: 600, borderRadius: '8px', padding: '7px 10px', cursor: 'pointer' };
const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' };
const formGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' };
const modalBackdrop = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px' };
const modalCard = { width: 'min(980px, 96vw)', border: '1px solid var(--border)', borderRadius: '14px', background: 'var(--surface)', maxHeight: '88vh', display: 'flex', flexDirection: 'column' };
const modalHead = { borderBottom: '1px solid #1E3447', background: 'linear-gradient(135deg,#0E141F 0%,#182735 100%)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between' };
const closeBtn = { border: '1px solid #35507A', background: '#1D2F4E', color: '#E2E8F0', width: '30px', height: '30px', borderRadius: '8px' };
const modalBody = { padding: '14px 16px', overflowY: 'auto' };
const modalFooter = { borderTop: '1px solid var(--border)', padding: '11px 16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' };
const cancelBtn = { border: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: '9px', fontSize: '12px', fontWeight: 700, padding: '8px 12px' };
const createBtn = { border: '1px solid #00A84A', background: '#00C853', color: '#052E16', borderRadius: '9px', fontSize: '12px', fontWeight: 700, padding: '8px 12px' };
const errorBox = { border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', borderRadius: '10px', padding: '8px 10px', fontSize: '12px', fontWeight: 700 };
