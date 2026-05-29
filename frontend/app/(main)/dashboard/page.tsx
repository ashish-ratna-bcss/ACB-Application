'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderOpen, FileText, Clock, Download, TrendingUp,
  ArrowRight, Cpu, CheckCircle, AlertCircle, Activity,
  Plus, Eye
} from 'lucide-react';
import TopNav from '@/components/layout/TopNav';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { formatCurrency, formatDate, getRelativeTime, getStatusConfig, getCaseTypeLabel } from '@/lib/utils';
import type { DashboardStats, Case, ActivityLog } from '@/lib/types';

const COLORS = ['#2563EB', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6'];

function AnimatedCounter({ target, prefix = '', suffix = '' }: { target: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const duration = 1200;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);
  return <span>{prefix}{count.toLocaleString('en-IN')}{suffix}</span>;
}

interface StatCard {
  title: string;
  value: number;
  prefix?: string;
  icon: React.ReactNode;
  iconClass: string;
  change: string;
  changePositive: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/cases').then(r => r.json()),
      fetch('/api/logs').then(r => r.json()),
    ]).then(([statsData, casesData, logsData]) => {
      setStats(statsData);
      setCases(casesData.slice(0, 5));
      setLogs(logsData.slice(0, 6));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col">
        <TopNav title="Dashboard" subtitle="Anti-Corruption Bureau – Investigation Platform" />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
            <span className="text-slate-500 text-sm">Loading dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  const statCards: StatCard[] = [
    {
      title: 'Total Cases', value: stats?.totalCases || 0,
      icon: <FolderOpen size={22} />, iconClass: 'metric-icon-blue',
      change: `+${stats?.casesThisMonth || 0} this month`, changePositive: true,
    },
    {
      title: 'AI Drafts Generated', value: stats?.draftsGenerated || 0,
      icon: <FileText size={22} />, iconClass: 'metric-icon-cyan',
      change: '+3 this week', changePositive: true,
    },
    {
      title: 'Pending Reviews', value: stats?.pendingReviews || 0,
      icon: <Clock size={22} />, iconClass: 'metric-icon-amber',
      change: '2 require action', changePositive: false,
    },
    {
      title: 'Reports Exported', value: stats?.reportsExported || 0,
      icon: <Download size={22} />, iconClass: 'metric-icon-green',
      change: '+5 this month', changePositive: true,
    },
  ];

  const logTypeConfig: Record<string, { color: string; bg: string }> = {
    upload: { color: 'text-blue-600', bg: 'bg-blue-50' },
    extraction: { color: 'text-cyan-600', bg: 'bg-cyan-50' },
    draft: { color: 'text-purple-600', bg: 'bg-purple-50' },
    export: { color: 'text-green-600', bg: 'bg-green-50' },
    create: { color: 'text-slate-600', bg: 'bg-slate-50' },
    review: { color: 'text-orange-600', bg: 'bg-orange-50' },
    update: { color: 'text-slate-600', bg: 'bg-slate-50' },
    finalize: { color: 'text-green-700', bg: 'bg-green-50' },
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <TopNav title="Dashboard" subtitle="Anti-Corruption Bureau – Investigation Platform" />

      <div className="p-6 space-y-6 animate-fade-in">
        {/* Welcome Banner */}
        <div
          className="rounded-2xl p-6 text-white overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #1D4ED8 100%)' }}
        >
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(6,182,212,0.4) 0%, transparent 60%)' }} />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-cyan-400 text-sm font-medium">AI Engine Active</span>
              </div>
              <h2 className="text-2xl font-bold mb-1">Good morning, Insp. Rajesh Kumar</h2>
              <p className="text-slate-300 text-sm">You have {stats?.pendingReviews || 0} pending reviews and {stats?.activeCases || 0} active cases</p>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <button onClick={() => router.push('/cases/new')} className="btn-primary">
                <Plus size={16} /> New Case
              </button>
              <button onClick={() => router.push('/cases')} className="btn-secondary text-white border-white/20 hover:bg-white/10">
                <Eye size={16} /> View All Cases
              </button>
            </div>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {statCards.map((card, i) => (
            <div key={card.title} className="stat-card animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${card.iconClass}`}>
                  {card.icon}
                </div>
                <TrendingUp size={16} className={card.changePositive ? 'text-green-500' : 'text-amber-500'} />
              </div>
              <div className="text-3xl font-bold text-slate-800 mb-1">
                <AnimatedCounter target={card.value} prefix={card.prefix} />
              </div>
              <div className="text-sm font-semibold text-slate-600 mb-2">{card.title}</div>
              <div className={`text-xs font-medium ${card.changePositive ? 'text-green-600' : 'text-amber-600'}`}>
                {card.change}
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Monthly Cases Chart */}
          <div className="xl:col-span-2 content-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-slate-800">Case & Draft Activity</h3>
                <p className="text-xs text-slate-500">Monthly overview for 2024</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" /> Cases</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-cyan-500 inline-block" /> Drafts</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats?.monthlyData || []}>
                <defs>
                  <linearGradient id="casesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="draftsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: 12 }} />
                <Area type="monotone" dataKey="cases" stroke="#2563EB" strokeWidth={2} fill="url(#casesGrad)" />
                <Area type="monotone" dataKey="drafts" stroke="#06B6D4" strokeWidth={2} fill="url(#draftsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Case Type Distribution */}
          <div className="content-card p-6">
            <div className="mb-4">
              <h3 className="font-bold text-slate-800">Cases by Type</h3>
              <p className="text-xs text-slate-500">Distribution overview</p>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={stats?.casesByType || []} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                  paddingAngle={3} dataKey="count" nameKey="type">
                  {(stats?.casesByType || []).map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v, n) => [v, String(n).replace(/_/g, ' ')]}
                  contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {(stats?.casesByType || []).map((item, idx) => (
                <div key={item.type} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
                    <span className="text-slate-600 capitalize">{item.type.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="font-semibold text-slate-700">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Cases + Activity */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Recent Cases */}
          <div className="xl:col-span-2 content-card overflow-hidden">
            <div className="flex items-center justify-between p-6 pb-0">
              <div>
                <h3 className="font-bold text-slate-800">Recent Cases</h3>
                <p className="text-xs text-slate-500">Latest investigation cases</p>
              </div>
              <button
                onClick={() => router.push('/cases')}
                className="flex items-center gap-1 text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors"
              >
                View all <ArrowRight size={14} />
              </button>
            </div>
            <div className="mt-4">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Accused</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map(c => {
                    const status = getStatusConfig(c.status);
                    return (
                      <tr key={c.id} className="cursor-pointer" onClick={() => router.push(`/cases/${c.id}`)}>
                        <td>
                          <div>
                            <div className="font-semibold text-slate-800 text-sm">{c.caseNumber}</div>
                            <div className="text-slate-500 text-xs truncate max-w-[180px]">{c.title}</div>
                          </div>
                        </td>
                        <td className="text-slate-600 text-sm">{c.accusedName.split(' ').slice(0, 2).join(' ')}</td>
                        <td className="font-semibold text-slate-700 text-sm">{formatCurrency(c.amountInvolved)}</td>
                        <td>
                          <span className={`badge ${status.bg} ${status.color}`}>{status.label}</span>
                        </td>
                        <td className="text-slate-500 text-sm">{formatDate(c.createdAt)}</td>
                        <td>
                          <ArrowRight size={14} className="text-slate-300" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Activity Log */}
          <div className="content-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800">Activity Feed</h3>
                <p className="text-xs text-slate-500">Recent system events</p>
              </div>
              <Activity size={16} className="text-slate-400" />
            </div>
            <div className="space-y-1">
              {logs.map((log, i) => {
                const cfg = logTypeConfig[log.type] || { color: 'text-slate-600', bg: 'bg-slate-50' };
                const icons: Record<string, React.ReactNode> = {
                  upload: <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
                  extraction: <Cpu size={12} />,
                  draft: <FileText size={12} />,
                  export: <Download size={12} />,
                  create: <Plus size={12} />,
                  review: <CheckCircle size={12} />,
                  finalize: <CheckCircle size={12} />,
                };
                return (
                  <div key={log.id} className="timeline-item" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                      {icons[log.type] || <AlertCircle size={12} />}
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-xs font-semibold text-slate-700">{log.action}</p>
                      <p className="text-xs text-slate-500 truncate">{log.description}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{getRelativeTime(log.timestamp)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* AI Quick Stats Bar */}
        <div
          className="rounded-2xl p-5 flex flex-wrap gap-6 items-center"
          style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(37,99,235,0.08))', border: '1px solid rgba(6,182,212,0.15)' }}
        >
          <div className="flex items-center gap-2">
            <Cpu size={18} className="text-cyan-500" />
            <span className="font-bold text-slate-700 text-sm">AI Performance</span>
          </div>
          {[
            { label: 'Avg. Extraction Confidence', value: '93.4%' },
            { label: 'Avg. Draft Quality Score', value: '97.1%' },
            { label: 'Time Saved per Case', value: '~4.5 hrs' },
            { label: 'Docs Processed Today', value: '12' },
          ].map(m => (
            <div key={m.label} className="flex flex-col">
              <span className="text-xs text-slate-500">{m.label}</span>
              <span className="text-lg font-bold text-cyan-600">{m.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
