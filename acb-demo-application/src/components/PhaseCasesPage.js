import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { PHASE_ROUTES } from '../utils/workflow';

const priorityMeta = {
  critical: { label: 'Critical', color: '#B91C1C', bg: 'rgba(220,38,38,0.12)' },
  high: { label: 'High', color: '#B45309', bg: 'rgba(217,119,6,0.15)' },
  medium: { label: 'Medium', color: '#1D4ED8', bg: 'rgba(37,99,235,0.12)' },
  low: { label: 'Low', color: '#64748B', bg: 'rgba(100,116,139,0.13)' },
};

const statusMeta = {
  pending: { color: '#B45309', bg: 'rgba(217,119,6,0.15)' },
  draft: { color: '#64748B', bg: 'rgba(100,116,139,0.13)' },
  assigned: { color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  submitted: { color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  in_progress: { color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  approved: { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
  rejected: { color: '#B91C1C', bg: 'rgba(220,38,38,0.12)' },
  fir_registered: { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
  planning: { color: '#7C3AED', bg: 'rgba(124,58,237,0.13)' },
  scheduled: { color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  executed: { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
  custody_active: { color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  active: { color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  logged: { color: '#64748B', bg: 'rgba(100,116,139,0.13)' },
  secured: { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
  pre_trial: { color: '#7C3AED', bg: 'rgba(124,58,237,0.13)' },
  hearing: { color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  preparing: { color: '#B45309', bg: 'rgba(217,119,6,0.15)' },
  filed: { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
  convicted: { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
};

/**
 * Shared phase list page — loads cases from workflow API filtered by phase.
 */
export default function PhaseCasesPage({
  phase,
  title,
  subtitle,
  eyebrow,
  statusOptions = [],
  statCards = [],
  primaryAction,
  detailColumnLabel = 'Officer / Detail',
}) {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const loadCases = useCallback(() => {
    setLoading(true);
    api.getCasesByPhase(phase)
      .then((data) => setCases(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [phase]);

  useEffect(() => { loadCases(); }, [loadCases]);

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((item) => {
      const matchesSearch = !q || [item.id, item.accused, item.department, item.location, item.trackingId]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q));
      const matchesStatus = status === 'all' || item.statusVal === status;
      const matchesPriority = priority === 'all' || item.priority === priority;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [cases, search, status, priority]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const computedStats = statCards.length ? statCards : [
    { label: 'Total Cases', value: filteredData.length, color: 'var(--text)' },
    { label: 'Critical', value: filteredData.filter((d) => d.priority === 'critical').length, color: '#B91C1C' },
    { label: 'In Progress', value: filteredData.filter((d) => d.statusVal === 'in_progress' || d.statusVal === 'scheduled').length, color: '#0F7A3D' },
    { label: 'High Priority', value: filteredData.filter((d) => d.priority === 'high').length, color: '#1D4ED8' },
  ];

  if (currentPage > totalPages && totalPages > 0) setCurrentPage(1);

  return (
    <div style={{ maxWidth: '1480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section style={{ background: 'linear-gradient(135deg, #0E141F 0%, #162236 100%)', border: '1px solid #1C2A40', borderRadius: '14px', padding: '20px 22px', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#7F93AE', fontWeight: 600, marginBottom: '8px' }}>{eyebrow || 'Case Phase'}</div>
            <h1 style={{ margin: 0, fontSize: '28px', color: '#F8FAFC', fontWeight: 700 }}>{title}</h1>
            <p style={{ margin: '8px 0 0', color: '#B8C7DA', fontSize: '14px', maxWidth: '720px' }}>{subtitle}</p>
          </div>
          {primaryAction || null}
        </div>
      </section>

      {error ? (
        <div style={{ border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', borderRadius: '10px', padding: '10px 12px', fontSize: '12px' }}>
          {error}
        </div>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {computedStats.map((s) => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{s.label}</div>
            <div style={{ marginTop: '8px', fontSize: '29px', fontWeight: 700, color: s.color || 'var(--text)', lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </section>

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 280px', minWidth: '240px' }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cases..." style={input} />
          </div>
          {statusOptions.length > 0 && (
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={filterSelect}>
              <option value="all">All Status</option>
              {statusOptions.map((opt) => (
                <option key={opt.val} value={opt.val}>{opt.lbl}</option>
              ))}
            </select>
          )}
          <select value={priority} onChange={(e) => setPriority(e.target.value)} style={filterSelect}>
            <option value="all">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto', minHeight: '480px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>Loading cases...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '940px' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th style={th}>Case Tracking</th>
                  <th style={th}>Accused Details</th>
                  <th style={th}>{detailColumnLabel}</th>
                  <th style={th}>Current Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((item) => {
                  const priorityPill = priorityMeta[item.priority] || priorityMeta.medium;
                  const statusTheme = statusMeta[item.statusVal] || { color: '#64748B', bg: 'rgba(100,116,139,0.13)' };
                  return (
                    <tr key={item.caseId || item.id} style={{ background: 'var(--surface)' }}>
                      <td style={td}>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12.5px', fontWeight: 600 }}>{item.trackingId || item.id}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{formatDate(item.lastUpdated)}</div>
                      </td>
                      <td style={td}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{item.accused}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{item.department} • {item.location}</div>
                      </td>
                      <td style={td}>
                        <div style={{ fontSize: '12.5px' }}>{item.dspName || '—'}</div>
                        <span style={{ display: 'inline-flex', marginTop: '6px', fontSize: '11px', fontWeight: 600, borderRadius: '999px', padding: '3px 9px', color: priorityPill.color, background: priorityPill.bg }}>{priorityPill.label}</span>
                      </td>
                      <td style={td}>
                        <span style={{ display: 'inline-flex', fontSize: '11px', fontWeight: 600, borderRadius: '999px', padding: '3px 9px', color: statusTheme.color, background: statusTheme.bg }}>{item.statusLbl}</span>
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <button onClick={() => navigate(`${PHASE_ROUTES[phase]}/${item.trackingId || item.id}`)} style={actionBtn}>Review</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!loading && paginatedData.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontSize: '13px' }}>No cases in this phase.</div>
          )}
        </div>

        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
            Showing {filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} style={pageBtn(currentPage === 1)}>Prev</button>
            <button disabled={currentPage === totalPages || !filteredData.length} onClick={() => setCurrentPage((p) => p + 1)} style={pageBtn(currentPage === totalPages || !filteredData.length)}>Next</button>
          </div>
        </div>
      </section>
    </div>
  );
}

const th = { fontSize: '10.5px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', textAlign: 'left', padding: '12px 14px', borderBottom: '1px solid var(--border)' };
const td = { padding: '12px 14px', verticalAlign: 'middle', borderBottom: '1px solid var(--border-2)' };
const input = { width: '100%', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: 'var(--text)', background: 'var(--surface-2)' };
const filterSelect = { ...input, minWidth: '162px', appearance: 'none' };
const actionBtn = { border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '12px', fontWeight: 600, borderRadius: '8px', padding: '7px 10px', cursor: 'pointer' };
const pageBtn = (disabled) => ({ padding: '6px 12px', fontSize: '12px', fontWeight: 600, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? 'var(--text-3)' : 'var(--text)' });

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
