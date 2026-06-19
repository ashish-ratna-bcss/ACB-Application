import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CaseDetailsPanel } from '../components';

const mockDataSeed = Array.from({ length: 32 }).map((_, i) => ({
  id: `CASE-2026-${String(81 + i).padStart(3, '0')}`,
  accused: ['Sri K. Venkateswara Rao', 'Smt. P. Lakshmi', 'Sri B. Ramesh', 'Sri A. Saidulu', 'Sri N. Prasad'][i % 5],
  department: ['Panchayat Raj', 'Revenue', 'Registration & Stamps', 'Rural Development', 'Irrigation'][i % 5],
  location: ['Warangal', 'Rangareddy', 'Karimnagar', 'Nalgonda', 'Khammam'][i % 5],
  priority: ['critical', 'high', 'medium', 'low'][i % 4],
  detail: ['DSP Ramesh', 'CI Prasad', 'DSP Kiran', 'DSP Venkat', 'CI Reddy'][i % 5],
  lastUpdated: new Date(Date.now() - Math.floor(Math.random() * 10) * 86400000).toISOString()
}));

const priorityMeta = {
  critical: { label: 'Critical', color: '#B91C1C', bg: 'rgba(220,38,38,0.12)' },
  high: { label: 'High', color: '#B45309', bg: 'rgba(217,119,6,0.15)' },
  medium: { label: 'Medium', color: '#1D4ED8', bg: 'rgba(37,99,235,0.12)' },
  low: { label: 'Low', color: '#64748B', bg: 'rgba(100,116,139,0.13)' },
};

const statusMeta = {
  'pending': { color: '#B45309', bg: 'rgba(217,119,6,0.15)' },
  'in-progress': { color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  'verified': { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
  'drafting': { color: '#7C3AED', bg: 'rgba(124,58,237,0.13)' },
  'approved': { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
  'planning': { color: '#7C3AED', bg: 'rgba(124,58,237,0.13)' },
  'scheduled': { color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  'executed': { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
  'active': { color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  'extended': { color: '#B45309', bg: 'rgba(217,119,6,0.15)' },
  'bail': { color: '#64748B', bg: 'rgba(100,116,139,0.13)' },
  'assigned': { color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  'report': { color: '#7C3AED', bg: 'rgba(124,58,237,0.13)' },
  'logged': { color: '#64748B', bg: 'rgba(100,116,139,0.13)' },
  'secured': { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
  'archived': { color: '#64748B', bg: 'rgba(100,116,139,0.13)' },
  'pre-trial': { color: '#7C3AED', bg: 'rgba(124,58,237,0.13)' },
  'hearing': { color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
  'closed': { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
  'preparing': { color: '#B45309', bg: 'rgba(217,119,6,0.15)' },
  'ready': { color: '#0F7A3D', bg: 'rgba(0,200,83,0.13)' },
  'in-court': { color: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
};

const statusOptions = [{"val":"active","lbl":"Active"},{"val":"extended","lbl":"Extended"},{"val":"bail","lbl":"Bail Granted"}];

export default function RemandPage() {
  const { caseId } = useParams();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [selectedCase, setSelectedCase] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mockDataSeed.map((item, i) => {
        const matchingStatus = statusOptions[i % statusOptions.length];
        return { ...item, statusVal: matchingStatus.val, statusLbl: matchingStatus.lbl };
      })
      .filter((item) => {
        const matchesSearch = !q || [item.id, item.accused, item.department, item.location]
          .some((field) => field.toLowerCase().includes(q));
        const matchesStatus = status === 'all' || item.statusVal === status;
        const matchesPriority = priority === 'all' || item.priority === priority;
        return matchesSearch && matchesStatus && matchesPriority;
      });
  }, [search, status, priority]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset to page 1 if search/filters change and current page is out of bounds
  if (currentPage > totalPages) setCurrentPage(1);

  return (
    <div style={{ maxWidth: '1480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section style={{ background: 'linear-gradient(135deg, #0E141F 0%, #162236 100%)', border: '1px solid #1C2A40', borderRadius: '14px', padding: '20px 22px', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#7F93AE', fontWeight: 600, marginBottom: '8px' }}>
              Phase Overview {caseId ? '• Case ' + caseId : ''}
            </div>
            <h1 style={{ margin: 0, fontSize: '28px', color: '#F8FAFC', fontWeight: 700 }}>Remand Tracking</h1>
            <p style={{ margin: '8px 0 0', color: '#B8C7DA', fontSize: '14px', maxWidth: '720px' }}>Track remand status, custody timelines, and associated court documentation.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button style={{ border: '1px solid #00A84A', background: '#00C853', color: '#052E16', fontSize: '13px', fontWeight: 700, borderRadius: '10px', padding: '10px 14px' }}>
              Update Remand
            </button>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Total Cases</div>
          <div style={{ marginTop: '8px', fontSize: '29px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{filteredData.length}</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Critical Priority</div>
          <div style={{ marginTop: '8px', fontSize: '29px', fontWeight: 700, color: '#B91C1C', lineHeight: 1 }}>
            {filteredData.filter(d => d.priority === 'critical').length}
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Active Remands</div>
          <div style={{ marginTop: '8px', fontSize: '29px', fontWeight: 700, color: '#0F7A3D', lineHeight: 1 }}>17</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Expiring Soon</div>
          <div style={{ marginTop: '8px', fontSize: '29px', fontWeight: 700, color: '#1D4ED8', lineHeight: 1 }}>3</div>
        </div>
      </section>

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 280px', minWidth: '240px' }}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search cases..."
              style={input}
            />
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} style={filterSelect}>
            <option value="all">All Status</option>
            {statusOptions.map(opt => (
              <option key={opt.val} value={opt.val}>{opt.lbl}</option>
            ))}
          </select>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} style={filterSelect}>
            <option value="all">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto', minHeight: '480px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
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
                <th style={th}>Case Tracking</th>
                <th style={th}>Accused Details</th>
                <th style={th}>Remand Expiry</th>
                <th style={th}>Current Status</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item) => {
                const priorityPill = priorityMeta[item.priority];
                const statusTheme = statusMeta[item.statusVal] || { color: '#64748B', bg: 'rgba(100,116,139,0.13)' };
                return (
                  <tr
                    key={item.id}
                    style={{ background: 'var(--surface)', transition: 'background 120ms ease' }}
                    onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={(event) => { event.currentTarget.style.background = 'var(--surface)'; }}
                  >
                    <td style={td}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12.5px', fontWeight: 600, color: 'var(--text)' }}>{item.id}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>Updated {formatDate(item.lastUpdated)}</div>
                    </td>
                    <td style={td}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{item.accused}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{item.department} • {item.location}</div>
                    </td>
                    <td style={td}>
                      <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text)' }}>{item.detail}</div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', marginTop: '6px', fontSize: '11px', fontWeight: 600, borderRadius: '999px', padding: '3px 9px', color: priorityPill.color, background: priorityPill.bg }}>{priorityPill.label} Risk</span>
                    </td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '11px', fontWeight: 600, borderRadius: '999px', padding: '3px 9px', color: statusTheme.color, background: statusTheme.bg }}>{item.statusLbl}</span>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => setSelectedCase(item)} style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '12px', fontWeight: 600, borderRadius: '8px', padding: '7px 10px', cursor: 'pointer' }}>Review</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {paginatedData.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontSize: '13px' }}>No cases found matching the criteria.</div>}
        </div>
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 500 }}>
            Showing {filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredData.length)} of {filteredData.length} entries
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button 
              disabled={currentPage === 1} 
              onClick={() => setCurrentPage(p => p - 1)} 
              style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? 'var(--text-3)' : 'var(--text)', transition: 'background 0.2s' }}
            >
              Prev
            </button>
            <button 
              disabled={currentPage === totalPages || filteredData.length === 0} 
              onClick={() => setCurrentPage(p => p + 1)} 
              style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', cursor: (currentPage === totalPages || filteredData.length === 0) ? 'not-allowed' : 'pointer', color: (currentPage === totalPages || filteredData.length === 0) ? 'var(--text-3)' : 'var(--text)', transition: 'background 0.2s' }}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      <CaseDetailsPanel caseData={selectedCase} onClose={() => setSelectedCase(null)} />
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

const input = {
  width: '100%',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '10px 12px',
  fontSize: '13px',
  color: 'var(--text)',
  background: 'var(--surface-2)',
};

const filterSelect = {
  ...input,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  paddingRight: '36px',
  minWidth: '162px',
  backgroundImage: 'linear-gradient(45deg, transparent 50%, #64748B 50%), linear-gradient(135deg, #64748B 50%, transparent 50%)',
  backgroundPosition: 'calc(100% - 16px) calc(50% - 3px), calc(100% - 11px) calc(50% - 3px)',
  backgroundSize: '5px 5px, 5px 5px',
  backgroundRepeat: 'no-repeat',
};

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}
