'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, FileText, ArrowRight, Search } from 'lucide-react';
import TopNav from '@/components/layout/TopNav';
import { getDraftTypeLabel, formatDate, getStatusConfig } from '@/lib/utils';
import type { Case, Draft } from '@/lib/types';

export default function DraftGeneratorPage() {
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/cases').then(r => r.json()),
      fetch('/api/draft').then(r => r.json()).catch(() => []),
    ]).then(([c, d]) => {
      setCases(Array.isArray(c) ? c : []);
      setDrafts(Array.isArray(d) ? d : []);
    }).finally(() => setLoading(false));
  }, []);

  const casesWithDrafts = cases.filter(c => c.draftsCount > 0);
  const filteredDrafts = drafts.filter(d => {
    const c = cases.find(x => x.id === d.caseId);
    const q = search.toLowerCase();
    return !q || (c && (c.title.toLowerCase().includes(q) || c.caseNumber.toLowerCase().includes(q)));
  });

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="AI Draft Generator" subtitle="Generate and manage investigation documents" />

      <div className="p-6 space-y-6 animate-fade-in">
        {/* Hero */}
        <div
          className="rounded-2xl p-8 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0F172A 0%, #164E63 50%, #0891B2 100%)' }}
        >
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 75% 50%, rgba(6,182,212,0.3) 0%, transparent 50%)' }} />
          <div className="relative z-10 max-w-lg">
            <div className="flex items-center gap-2 mb-3">
              <Cpu size={20} className="text-cyan-400" />
              <span className="text-cyan-400 font-semibold">AI Document Intelligence</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Generate Legal Documents Instantly</h2>
            <p className="text-slate-400 leading-relaxed">
              Select a case and generate professionally formatted government documents including FIRs, Preliminary Reports, Remand Applications, and Final Investigation Reports — powered by AI.
            </p>
          </div>
        </div>

        {/* Quick generate from case */}
        <div className="content-card p-6">
          <h3 className="font-bold text-slate-800 mb-4">Generate for a Case</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
              ))
            ) : (
              cases.slice(0, 6).map(c => {
                const status = getStatusConfig(c.status);
                return (
                  <button
                    key={c.id}
                    onClick={() => router.push(`/cases/${c.id}/draft`)}
                    className="text-left p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-500">{c.caseNumber}</span>
                      <span className={`badge ${status.bg} ${status.color} text-xs`}>{status.label}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-700 line-clamp-2 mb-2">{c.title}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{c.draftsCount} drafts</span>
                      <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* All Drafts */}
        <div className="content-card overflow-hidden">
          <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-800">All Generated Drafts</h3>
              <p className="text-xs text-slate-500">{drafts.length} documents generated</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <Search size={14} className="text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search drafts..."
                className="outline-none text-sm bg-transparent text-slate-700 placeholder-slate-400 w-40"
              />
            </div>
          </div>

          {filteredDrafts.length === 0 ? (
            <div className="text-center py-16">
              <FileText size={48} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No drafts yet</p>
              <p className="text-slate-400 text-sm mt-1">Generate your first AI draft from a case</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Draft Type</th>
                  <th>Case</th>
                  <th>Status</th>
                  <th>Generated</th>
                  <th>Comments</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrafts.map(d => {
                  const c = cases.find(x => x.id === d.caseId);
                  return (
                    <tr key={d.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg metric-icon-purple flex items-center justify-center">
                            <FileText size={14} />
                          </div>
                          <span className="font-semibold text-slate-700 text-sm">{getDraftTypeLabel(d.type)}</span>
                        </div>
                      </td>
                      <td>
                        {c ? (
                          <div>
                            <div className="text-sm font-medium text-slate-700">{c.caseNumber}</div>
                            <div className="text-xs text-slate-400 truncate max-w-[180px]">{c.title}</div>
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td>
                        <span className={`badge text-xs ${
                          d.status === 'finalized' ? 'bg-green-50 text-green-700' :
                          d.status === 'reviewed' ? 'bg-blue-50 text-blue-700' :
                          'bg-slate-50 text-slate-600'
                        }`}>{d.status}</span>
                      </td>
                      <td className="text-sm text-slate-500">{formatDate(d.generatedAt)}</td>
                      <td className="text-sm text-slate-500">{d.comments.length}</td>
                      <td>
                        <button
                          onClick={() => router.push(`/cases/${d.caseId}/draft`)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors"
                        >
                          <ArrowRight size={12} /> Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
