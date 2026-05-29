'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus, Search, Filter, FolderOpen, ArrowRight,
  FileText, Upload, Cpu, ChevronDown
} from 'lucide-react';
import TopNav from '@/components/layout/TopNav';
import { formatCurrency, formatDate, getStatusConfig, getCaseTypeLabel } from '@/lib/utils';
import type { Case, CaseStatus, CaseType } from '@/lib/types';

function CasesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<CaseStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<CaseType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  useEffect(() => {
    fetch('/api/cases').then(r => r.json()).then(setCases).finally(() => setLoading(false));
  }, []);

  const filtered = cases.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      c.title.toLowerCase().includes(q) ||
      c.caseNumber.toLowerCase().includes(q) ||
      c.accusedName.toLowerCase().includes(q) ||
      c.officerName.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchType = typeFilter === 'all' || c.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  }).sort((a, b) => {
    if (sortBy === 'amount') return b.amountInvolved - a.amountInvolved;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const statuses: { value: CaseStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'draft', label: 'Draft' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'finalized', label: 'Finalized' },
    { value: 'closed', label: 'Closed' },
  ];

  const types: { value: CaseType | 'all'; label: string }[] = [
    { value: 'all', label: 'All Types' },
    { value: 'bribery', label: 'Bribery' },
    { value: 'corruption', label: 'Corruption' },
    { value: 'fraud', label: 'Fraud' },
    { value: 'misappropriation', label: 'Misappropriation' },
    { value: 'abuse_of_power', label: 'Abuse of Power' },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="Investigation Cases" subtitle={`${cases.length} total cases`} />

      <div className="p-6 space-y-5 animate-fade-in">
        {/* Header actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <div
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl max-w-sm focus-within:border-blue-400 focus-within:shadow-sm transition-all"
            >
              <Search size={15} className="text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by case, officer, accused..."
                className="flex-1 outline-none text-sm text-slate-800 placeholder-slate-400 bg-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-slate-400" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as CaseStatus | 'all')} className="form-select" style={{ width: 'auto', minWidth: 120 }}>
              {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as CaseType | 'all')} className="form-select" style={{ width: 'auto', minWidth: 130 }}>
              {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as 'date' | 'amount')} className="form-select" style={{ width: 'auto', minWidth: 110 }}>
              <option value="date">Sort: Date</option>
              <option value="amount">Sort: Amount</option>
            </select>
          </div>

          <button onClick={() => router.push('/cases/new')} className="btn-primary">
            <Plus size={16} /> New Case
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: cases.length, color: 'text-slate-700' },
            { label: 'Active', value: cases.filter(c => c.status === 'active').length, color: 'text-green-600' },
            { label: 'Under Review', value: cases.filter(c => c.status === 'under_review').length, color: 'text-amber-600' },
            { label: 'Finalized', value: cases.filter(c => c.status === 'finalized').length, color: 'text-blue-600' },
            { label: 'Draft', value: cases.filter(c => c.status === 'draft').length, color: 'text-slate-400' },
          ].map(s => (
            <div key={s.label} className="content-card p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Cases Table */}
        <div className="content-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <FolderOpen size={48} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No cases found</p>
              <p className="text-slate-400 text-sm mt-1">Adjust your filters or create a new case</p>
              <button onClick={() => router.push('/cases/new')} className="btn-primary mt-4">
                <Plus size={16} /> Create First Case
              </button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Accused</th>
                  <th>Type</th>
                  <th>Amount Involved</th>
                  <th>Documents</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const status = getStatusConfig(c.status);
                  return (
                    <tr key={c.id} className="cursor-pointer group" onClick={() => router.push(`/cases/${c.id}`)}>
                      <td>
                        <div>
                          <div className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{c.caseNumber}</div>
                          <div className="text-slate-500 text-xs max-w-[200px] truncate">{c.title}</div>
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="text-sm font-medium text-slate-700">{c.accusedName}</div>
                          <div className="text-xs text-slate-400">{c.accusedDesignation}</div>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-blue-50 text-blue-700 text-xs">{getCaseTypeLabel(c.type)}</span>
                      </td>
                      <td className="font-semibold text-slate-700">{formatCurrency(c.amountInvolved)}</td>
                      <td>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Upload size={12} /> {c.documentsCount}</span>
                          <span className="flex items-center gap-1"><FileText size={12} /> {c.draftsCount}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${status.bg} ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="text-sm text-slate-500">{formatDate(c.createdAt)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => router.push(`/cases/${c.id}`)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                            title="View Case"
                          >
                            <ArrowRight size={14} />
                          </button>
                          <button
                            onClick={() => router.push(`/cases/${c.id}/documents`)}
                            className="p-1.5 rounded-lg hover:bg-cyan-50 text-slate-400 hover:text-cyan-600 transition-colors"
                            title="Upload Documents"
                          >
                            <Upload size={14} />
                          </button>
                          <button
                            onClick={() => router.push(`/cases/${c.id}/draft`)}
                            className="p-1.5 rounded-lg hover:bg-purple-50 text-slate-400 hover:text-purple-600 transition-colors"
                            title="Generate Draft"
                          >
                            <Cpu size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="text-xs text-slate-400 text-right">
          Showing {filtered.length} of {cases.length} cases
        </div>
      </div>
    </div>
  );
}

export default function CasesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <CasesContent />
    </Suspense>
  );
}
