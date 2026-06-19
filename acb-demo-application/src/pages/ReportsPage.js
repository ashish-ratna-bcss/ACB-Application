import React, { useState, useMemo } from 'react';

const reportsSeed = [
  { id: 'REP-101', name: 'Monthly Traps Overview', category: 'Operational', format: 'PDF', frequency: 'Monthly', lastGenerated: '2026-06-01T08:00:00' },
  { id: 'REP-102', name: 'Pending FIR Approvals', category: 'Workflow', format: 'Excel', frequency: 'Weekly', lastGenerated: '2026-06-15T09:30:00' },
  { id: 'REP-103', name: 'Conviction Rate Analysis', category: 'Analytics', format: 'Dashboard', frequency: 'Quarterly', lastGenerated: '2026-04-01T10:00:00' },
  { id: 'REP-104', name: 'Department-wise Complaints', category: 'Operational', format: 'PDF', frequency: 'Daily', lastGenerated: '2026-06-18T18:00:00' },
];

export default function ReportsPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reportsSeed.filter((item) => {
      const matchesSearch = !q || [item.name, item.category].some((field) => field.toLowerCase().includes(q));
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [search, categoryFilter]);

  return (
    <div style={{ maxWidth: '1480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section style={{ background: 'linear-gradient(135deg, #0E141F 0%, #162236 100%)', border: '1px solid #1C2A40', borderRadius: '14px', padding: '20px 22px', boxShadow: 'var(--shadow)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.8px', textTransform: 'uppercase', color: '#7F93AE', fontWeight: 600, marginBottom: '8px' }}>
              System Analytics
            </div>
            <h1 style={{ margin: 0, fontSize: '28px', color: '#F8FAFC', fontWeight: 700 }}>Reports & Insights</h1>
            <p style={{ margin: '8px 0 0', color: '#B8C7DA', fontSize: '14px', maxWidth: '720px' }}>Access system-wide report catalogs and analytics views.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button style={{ border: '1px solid #00A84A', background: '#00C853', color: '#052E16', fontSize: '13px', fontWeight: 700, borderRadius: '10px', padding: '10px 14px' }}>
              Create Custom Report
            </button>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Total Reports</div>
          <div style={{ marginTop: '8px', fontSize: '29px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>342</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Scheduled Jobs</div>
          <div style={{ marginTop: '8px', fontSize: '29px', fontWeight: 700, color: '#1D4ED8', lineHeight: 1 }}>12</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Data Sources</div>
          <div style={{ marginTop: '8px', fontSize: '29px', fontWeight: 700, color: '#0F7A3D', lineHeight: 1 }}>4</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Storage Used</div>
          <div style={{ marginTop: '8px', fontSize: '29px', fontWeight: 700, color: '#7C3AED', lineHeight: 1 }}>1.4 GB</div>
        </div>
      </section>

      <section style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 280px', minWidth: '240px' }}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reports..."
              style={input}
            />
          </div>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} style={filterSelect}>
            <option value="all">All Categories</option>
            <option value="Operational">Operational</option>
            <option value="Workflow">Workflow</option>
            <option value="Analytics">Analytics</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: '940px' }}>
            <colgroup>
              <col style={{ width: '30%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th style={th}>Report Details</th>
                <th style={th}>Category</th>
                <th style={th}>Frequency</th>
                <th style={th}>Last Generated</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((report) => (
                <tr key={report.id} style={{ background: 'var(--surface)', transition: 'background 120ms ease' }} onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}>
                  <td style={td}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{report.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>{report.id} • {report.format}</div>
                  </td>
                  <td style={td}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '11px', fontWeight: 600, borderRadius: '999px', padding: '3px 9px', color: '#2563EB', background: 'rgba(37,99,235,0.12)' }}>{report.category}</span>
                  </td>
                  <td style={td}>
                    <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text)' }}>{report.frequency}</div>
                  </td>
                  <td style={td}>
                    <div style={{ fontSize: '12px', color: 'var(--text-2)' }}>{new Date(report.lastGenerated).toLocaleString()}</div>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: '12px', fontWeight: 600, borderRadius: '8px', padding: '7px 10px' }}>Download</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const th = { fontSize: '10.5px', color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', textAlign: 'left', padding: '12px 14px', borderBottom: '1px solid var(--border)' };
const td = { padding: '12px 14px', verticalAlign: 'middle', borderBottom: '1px solid var(--border-2)' };
const input = { width: '100%', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: 'var(--text)', background: 'var(--surface-2)' };
const filterSelect = { ...input, appearance: 'none', paddingRight: '36px', minWidth: '162px', backgroundImage: 'linear-gradient(45deg, transparent 50%, #64748B 50%), linear-gradient(135deg, #64748B 50%, transparent 50%)', backgroundPosition: 'calc(100% - 16px) calc(50% - 3px), calc(100% - 11px) calc(50% - 3px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' };
