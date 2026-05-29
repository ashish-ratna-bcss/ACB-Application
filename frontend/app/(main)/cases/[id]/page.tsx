'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Upload, Cpu, FileText, Download,
  Calendar, MapPin, User, Building, DollarSign,
  CheckCircle, Clock, Activity, ArrowRight
} from 'lucide-react';
import TopNav from '@/components/layout/TopNav';
import { formatCurrency, formatDate, formatDateTime, getStatusConfig, getCaseTypeLabel } from '@/lib/utils';
import type { Case, ActivityLog } from '@/lib/types';

const STEPS = [
  { id: 'upload', label: 'Upload Evidence', icon: <Upload size={16} />, href: (id: string) => `/cases/${id}/documents` },
  { id: 'extract', label: 'AI Extraction', icon: <Cpu size={16} />, href: (id: string) => `/cases/${id}/extraction` },
  { id: 'draft', label: 'Generate Draft', icon: <FileText size={16} />, href: (id: string) => `/cases/${id}/draft` },
  { id: 'export', label: 'Export PDF', icon: <Download size={16} />, href: (id: string) => `/cases/${id}/export` },
];

export default function CaseDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/cases/${id}`).then(r => r.json()),
      fetch(`/api/logs?caseId=${id}`).then(r => r.json()),
    ]).then(([c, l]) => {
      setCaseData(c);
      setLogs(Array.isArray(l) ? l : []);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="Case Details" />
      <div className="flex items-center justify-center flex-1">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  if (!caseData) return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="Case Not Found" />
      <div className="flex items-center justify-center flex-1">
        <div className="text-center">
          <p className="text-slate-500">Case not found</p>
          <button onClick={() => router.push('/cases')} className="btn-primary mt-4">Back to Cases</button>
        </div>
      </div>
    </div>
  );

  const status = getStatusConfig(caseData.status);

  const logTypeConfig: Record<string, { color: string; bg: string }> = {
    upload: { color: 'text-blue-600', bg: 'bg-blue-50' },
    extraction: { color: 'text-cyan-600', bg: 'bg-cyan-50' },
    draft: { color: 'text-purple-600', bg: 'bg-purple-50' },
    export: { color: 'text-green-600', bg: 'bg-green-50' },
    create: { color: 'text-slate-600', bg: 'bg-slate-100' },
    review: { color: 'text-orange-600', bg: 'bg-orange-50' },
    update: { color: 'text-slate-600', bg: 'bg-slate-100' },
    finalize: { color: 'text-green-700', bg: 'bg-green-50' },
  };

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav title={caseData.caseNumber} subtitle={caseData.title} />

      <div className="p-6 space-y-5 animate-fade-in">
        {/* Back + Status */}
        <div className="flex items-center justify-between">
          <button onClick={() => router.push('/cases')} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm transition-colors">
            <ArrowLeft size={16} /> Back to Cases
          </button>
          <div className="flex items-center gap-3">
            <span className={`badge ${status.bg} ${status.color} text-sm px-3 py-1`}>
              {status.label}
            </span>
            <select
              value={caseData.status}
              onChange={async e => {
                const res = await fetch(`/api/cases/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: e.target.value }),
                });
                if (res.ok) { const updated = await res.json(); setCaseData(updated); }
              }}
              className="form-select text-sm"
              style={{ width: 'auto', padding: '6px 32px 6px 12px' }}
            >
              {['draft', 'active', 'under_review', 'finalized', 'closed'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Workflow Steps */}
        <div
          className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, #0F172A, #1E3A5F)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold text-sm">Investigation Workflow</h3>
            <span className="text-slate-400 text-xs">Complete all steps to finalize</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {STEPS.map((step, i) => {
              const completed = (step.id === 'upload' && caseData.documentsCount > 0)
                || (step.id === 'draft' && caseData.draftsCount > 0)
                || (step.id === 'export' && caseData.status === 'finalized');
              return (
                <button
                  key={step.id}
                  onClick={() => router.push(step.href(id))}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all hover:scale-105 text-center"
                  style={{
                    background: completed ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${completed ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${completed ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {completed ? <CheckCircle size={20} /> : step.icon}
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${completed ? 'text-green-400' : 'text-slate-300'}`}>{step.label}</div>
                    <div className="text-slate-500 text-xs">Step {i + 1}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Case Details */}
          <div className="xl:col-span-2 space-y-4">
            {/* Case Info */}
            <div className="content-card p-6">
              <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                <FileText size={18} className="text-blue-600" /> Case Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Case Number', value: caseData.caseNumber, icon: <FileText size={14} /> },
                  { label: 'Case Type', value: getCaseTypeLabel(caseData.type), icon: <CheckCircle size={14} /> },
                  { label: 'FIR Number', value: caseData.firNumber, icon: <FileText size={14} /> },
                  { label: 'Investigating Officer', value: caseData.officerName, icon: <User size={14} /> },
                  { label: 'Officer Department', value: caseData.officerDepartment, icon: <Building size={14} /> },
                  { label: 'Incident Date', value: formatDate(caseData.incidentDate), icon: <Calendar size={14} /> },
                  { label: 'Location', value: caseData.location, icon: <MapPin size={14} /> },
                  { label: 'Amount Involved', value: formatCurrency(caseData.amountInvolved), icon: <DollarSign size={14} />, highlight: true },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg metric-icon-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 font-medium">{item.label}</div>
                      <div className={`text-sm font-semibold ${item.highlight ? 'text-red-600 text-base' : 'text-slate-800'} mt-0.5`}>
                        {item.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-500 font-medium mb-2">Complaint Summary</div>
                <p className="text-sm text-slate-700 leading-relaxed">{caseData.complaintSummary}</p>
              </div>
            </div>

            {/* Accused Info */}
            <div className="content-card p-6">
              <h3 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                <User size={18} className="text-red-500" /> Accused Information
              </h3>
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <User size={28} className="text-red-400" />
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { label: 'Name', value: caseData.accusedName },
                    { label: 'Designation', value: caseData.accusedDesignation },
                    { label: 'Department', value: caseData.accusedDepartment },
                    { label: 'Contact', value: caseData.accusedContact || 'N/A' },
                  ].map(item => (
                    <div key={item.label}>
                      <div className="text-xs text-slate-500">{item.label}</div>
                      <div className="text-sm font-semibold text-slate-800 mt-0.5">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {STEPS.map(step => (
                <button
                  key={step.id}
                  onClick={() => router.push(step.href(id))}
                  className="content-card p-4 flex flex-col items-center gap-2 hover:border-blue-300 hover:bg-blue-50/30 transition-all text-center group"
                >
                  <div className="w-10 h-10 rounded-xl metric-icon-blue flex items-center justify-center group-hover:scale-110 transition-transform">
                    {step.icon}
                  </div>
                  <span className="text-xs font-semibold text-slate-700">{step.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar: Stats + Logs */}
          <div className="space-y-4">
            {/* Stats */}
            <div className="content-card p-5">
              <h3 className="font-bold text-slate-800 mb-4">Case Stats</h3>
              <div className="space-y-3">
                {[
                  { label: 'Documents', value: caseData.documentsCount, icon: <Upload size={16} />, color: 'metric-icon-blue', href: `/cases/${id}/documents` },
                  { label: 'AI Drafts', value: caseData.draftsCount, icon: <FileText size={16} />, color: 'metric-icon-purple', href: `/cases/${id}/draft` },
                ].map(stat => (
                  <button
                    key={stat.label}
                    onClick={() => router.push(stat.href)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                      {stat.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-slate-700">{stat.label}</div>
                      <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
                    </div>
                    <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </button>
                ))}
              </div>
              <div className="pt-3 border-t border-slate-100 mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                <div>Created: <span className="text-slate-700 font-medium">{formatDate(caseData.createdAt)}</span></div>
                <div>Updated: <span className="text-slate-700 font-medium">{formatDate(caseData.updatedAt)}</span></div>
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="content-card p-5">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Activity size={16} className="text-slate-500" /> Activity Log
              </h3>
              {logs.length === 0 ? (
                <div className="text-center py-6">
                  <Clock size={32} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">No activity yet</p>
                </div>
              ) : (
                <div className="space-y-0">
                  {logs.slice(0, 8).map((log, i) => {
                    const cfg = logTypeConfig[log.type] || { color: 'text-slate-600', bg: 'bg-slate-100' };
                    return (
                      <div key={log.id} className="timeline-item">
                        <div className={`w-8 h-8 rounded-full ${cfg.bg} ${cfg.color} flex items-center justify-center flex-shrink-0 text-xs font-bold`}>
                          {log.action.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0 pb-2">
                          <p className="text-xs font-semibold text-slate-700">{log.action}</p>
                          <p className="text-xs text-slate-500 leading-relaxed">{log.description}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(log.timestamp)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
