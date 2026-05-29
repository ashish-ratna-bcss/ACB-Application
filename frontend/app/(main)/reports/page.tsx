'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Download, FileText, TrendingUp, Activity } from 'lucide-react';
import TopNav from '@/components/layout/TopNav';
import { formatCurrency, formatDate, getCaseTypeLabel, getStatusConfig } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import type { DashboardStats, Case } from '@/lib/types';

const COLORS = ['#2563EB', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];

export default function ReportsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/cases').then(r => r.json()),
    ]).then(([s, c]) => { setStats(s); setCases(Array.isArray(c) ? c : []); }).finally(() => setLoading(false));
  }, []);

  const totalAmount = cases.reduce((sum, c) => sum + c.amountInvolved, 0);

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="Reports & Analytics" subtitle="Investigation statistics and performance metrics" />

      <div className="p-6 space-y-6 animate-fade-in">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Cases', value: cases.length, icon: <FileText size={20} />, color: 'metric-icon-blue' },
            { label: 'Total Amount', value: formatCurrency(totalAmount), icon: <TrendingUp size={20} />, color: 'metric-icon-red' },
            { label: 'Drafts Generated', value: stats?.draftsGenerated || 0, icon: <BarChart3 size={20} />, color: 'metric-icon-purple' },
            { label: 'Reports Exported', value: stats?.reportsExported || 0, icon: <Download size={20} />, color: 'metric-icon-green' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${s.color}`}>{s.icon}</div>
              <div className="text-2xl font-bold text-slate-800">{s.value}</div>
              <div className="text-sm text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Monthly Chart */}
          <div className="content-card p-6">
            <h3 className="font-bold text-slate-800 mb-4">Monthly Case Registration</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stats?.monthlyData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: 12 }} />
                <Bar dataKey="cases" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="drafts" fill="#06B6D4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status Distribution */}
          <div className="content-card p-6">
            <h3 className="font-bold text-slate-800 mb-4">Case Status Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={stats?.casesByStatus || []} cx="50%" cy="50%" outerRadius={80} dataKey="count" nameKey="status" label={({ name, value }) => `${value}`}>
                  {(stats?.casesByStatus || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, String(n).replace(/_/g, ' ')]} contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: 12 }} />
                <Legend formatter={v => String(v).replace(/_/g, ' ')} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Case Details Table */}
        <div className="content-card overflow-hidden">
          <div className="p-6 pb-0 border-b border-slate-100 pb-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">All Cases Report</h3>
              <button className="btn-secondary text-sm"><Download size={14} /> Export CSV</button>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Case Number</th>
                <th>Title</th>
                <th>Type</th>
                <th>Accused</th>
                <th>Amount Involved</th>
                <th>Status</th>
                <th>Docs</th>
                <th>Drafts</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => {
                const status = getStatusConfig(c.status);
                return (
                  <tr key={c.id}>
                    <td className="font-semibold text-slate-700">{c.caseNumber}</td>
                    <td className="text-sm text-slate-600 max-w-[200px] truncate">{c.title}</td>
                    <td><span className="badge bg-blue-50 text-blue-700 text-xs">{getCaseTypeLabel(c.type)}</span></td>
                    <td className="text-sm text-slate-600">{c.accusedName}</td>
                    <td className="font-semibold text-red-600">{formatCurrency(c.amountInvolved)}</td>
                    <td><span className={`badge ${status.bg} ${status.color}`}>{status.label}</span></td>
                    <td className="text-sm text-slate-600 text-center">{c.documentsCount}</td>
                    <td className="text-sm text-slate-600 text-center">{c.draftsCount}</td>
                    <td className="text-sm text-slate-500">{formatDate(c.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
