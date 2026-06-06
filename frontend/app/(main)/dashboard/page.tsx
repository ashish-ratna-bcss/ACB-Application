'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderOpen, FileText, Layers, CheckCircle2, AlertCircle,
  Loader2, ArrowRight, Activity, FileOutput, ScrollText, BookOpen,
  Send, Bot, User
} from 'lucide-react';
import TopNav from '@/components/layout/TopNav';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { BACKEND_URL } from '@/lib/config';

const STATUS_COLORS = ['#10B981', '#06B6D4', '#EF4444'];
const BAR_COLOR = '#2563EB';
const TYPE_COLORS = ['#2563EB','#06B6D4','#10B981','#F59E0B','#8B5CF6','#EC4899','#EF4444','#64748B'];

function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const steps = 50;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, 1000 / steps);
    return () => clearInterval(timer);
  }, [target]);
  return <>{count.toLocaleString('en-IN')}{suffix}</>;
}

interface Stats {
  total_cases: number;
  total_documents: number;
  completed_documents: number;
  processing_documents: number;
  failed_documents: number;
  total_pages: number;
  total_subdocuments: number;
  draft_reports: number;
  monthly_uploads: { month: string; docs: number }[];
  pages_per_case: { case: string; pages: number }[];
  doc_status: { name: string; value: number }[];
  subdoc_types: { name: string; value: number }[];
  avg_confidence: number;
  processing_trend: { day: string; avg_min: number; docs: number }[];
}

interface CaseSummary {
  case_id: string;
  document_count: number;
  completed_count: number;
  processing_count: number;
  failed_count: number;
  total_pages: number;
  last_uploaded: string | null;
}

interface ChatMsg {
  role: 'user' | 'bot';
  text: string;
  sources?: { title: string; case_id: string; pages: string }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([
    { role: 'bot', text: 'Ask me anything about case documents. e.g. "What was the bribe amount?" or "Who were the witnesses?"' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const SUGGESTED_PROMPTS = [
    { icon: '💰', text: 'What was the bribe amount?' },
    { icon: '👤', text: 'Who are the key accused persons?' },
    { icon: '🧾', text: 'Summarize the FIR details' },
    { icon: '👁️', text: 'List all witnesses mentioned' },
    { icon: '🏛️', text: 'What government posts are involved?' },
    { icon: '📦', text: 'What assets or properties were seized?' },
  ];

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND_URL}/pdf/stats`).then(r => r.json()),
      fetch(`${BACKEND_URL}/pdf/cases`).then(r => r.json()),
    ]).then(([s, c]) => {
      setStats(s);
      setCases((c.cases || []).slice(0, 6));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs]);

  async function sendChat(overrideText?: string) {
    const q = (overrideText ?? chatInput).trim();
    if (!q || chatLoading) return;
    if (!overrideText) setChatInput('');
    setChatMsgs(prev => [...prev, { role: 'user', text: q }]);
    setChatLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/pdf/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error');
      setChatMsgs(prev => [...prev, { role: 'bot', text: data.answer, sources: data.sources }]);
    } catch (e) {
      setChatMsgs(prev => [...prev, { role: 'bot', text: `Error: ${e instanceof Error ? e.message : 'Failed'}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  if (loading) return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="Dashboard" subtitle="ACB Investigation Platform" />
      <div className="flex items-center justify-center flex-1">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  const metricCards = [
    { label: 'Total Cases',             value: stats?.total_cases ?? 0,         icon: <FolderOpen size={20} />,   bg: 'metric-icon-blue',       sub: `${stats?.total_documents ?? 0} documents` },
    { label: 'Pages Processed',         value: stats?.total_pages ?? 0,          icon: <BookOpen size={20} />,     bg: 'metric-icon-cyan',       sub: `${stats?.total_subdocuments ?? 0} sub-docs` },
    { label: 'Completed',               value: stats?.completed_documents ?? 0,  icon: <CheckCircle2 size={20} />, bg: 'metric-icon-green',      sub: 'documents' },
    { label: 'Failed',                  value: stats?.failed_documents ?? 0,     icon: <AlertCircle size={20} />,  bg: 'bg-red-50 text-red-600', sub: 'require attention' },
    { label: 'Processing',              value: stats?.processing_documents ?? 0, icon: <Loader2 size={20} />,      bg: 'metric-icon-amber',      sub: 'in progress' },
    { label: 'Sub-documents',           value: stats?.total_subdocuments ?? 0,   icon: <Layers size={20} />,       bg: 'metric-icon-blue',       sub: 'extracted' },
    { label: 'Draft Reports',           value: stats?.draft_reports ?? 0,        icon: <ScrollText size={20} />,   bg: 'metric-icon-cyan',       sub: 'generated' },
    { label: 'Total Documents',         value: stats?.total_documents ?? 0,      icon: <FileText size={20} />,     bg: 'metric-icon-green',      sub: 'uploaded' },
    { label: 'AI Confidence',           value: stats?.avg_confidence ?? 0,       icon: <Activity size={20} />,     bg: 'metric-icon-cyan',       sub: 'avg detection %', suffix: '%' },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <TopNav title="Dashboard" subtitle="ACB Investigation Platform" />

      <div className="p-6 space-y-6 animate-fade-in">

        {/* Welcome banner */}
        <div className="rounded-2xl p-6 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #1D4ED8 100%)' }}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(6,182,212,0.4) 0%, transparent 60%)' }} />
          <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-cyan-400 text-base font-medium">System Active</span>
              </div>
              <h2 className="text-2xl font-bold mb-1">ACB Investigation Platform</h2>
              <p className="text-slate-300 text-base">
                {stats?.total_cases} cases · {stats?.total_pages} pages processed · {stats?.draft_reports} draft reports
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/generate-report')} className="btn-primary">
                <FileOutput size={15} /> Generate Report
              </button>
              <button onClick={() => router.push('/view-reports')} className="btn-secondary text-white border-white/20 hover:bg-white/10">
                <ScrollText size={15} /> Case Reports
              </button>
            </div>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-9 gap-3">
          {metricCards.map((card, i) => (
            <div key={card.label} className="content-card p-4 flex flex-col gap-2 animate-slide-up"
              style={{ animationDelay: `${i * 0.05}s` }}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.bg}`}>
                {card.icon}
              </div>
              <div className="text-2xl font-bold text-slate-800">
                <AnimatedCounter target={card.value} suffix={(card as any).suffix} />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-700">{card.label}</div>
                <div className="text-xs text-slate-400">{card.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Main layout: charts (left) + chatbot (right) */}
        <div className="grid grid-cols-1 xl:grid-cols-[72%_28%] gap-5">

          {/* ── Left column: charts ── */}
          <div className="space-y-5">

            {/* Pages per case + doc status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="content-card p-6">
                <div className="mb-4">
                  <h3 className="font-bold text-slate-800">Pages per Case</h3>
                  <p className="text-xs text-slate-500">Top cases by volume</p>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats?.pages_per_case || []} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="case" tick={{ fontSize: 12, fill: '#94A3B8' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }} />
                    <Bar dataKey="pages" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="content-card p-6">
                <div className="mb-4">
                  <h3 className="font-bold text-slate-800">Document Status</h3>
                  <p className="text-xs text-slate-500">Processing breakdown</p>
                </div>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={stats?.doc_status || []} cx="50%" cy="50%"
                      innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                      {(stats?.doc_status || []).map((_, idx) => (
                        <Cell key={idx} fill={STATUS_COLORS[idx % STATUS_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {(stats?.doc_status || []).map((s, i) => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[i] }} />
                        <span className="text-slate-600">{s.name}</span>
                      </div>
                      <span className="font-bold text-slate-700">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Processing Time */}
            <div className="content-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">AI Processing Time</h3>
                  <p className="text-xs text-slate-500">Avg minutes per document by day</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-1 rounded bg-cyan-500 inline-block" /> Avg min</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-1 rounded bg-blue-300 inline-block" /> Docs</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={stats?.processing_trend || []} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }}
                    formatter={(v, n) => [v, n === 'avg_min' ? 'Avg min' : 'Docs']} />
                  <Line yAxisId="left" type="monotone" dataKey="avg_min" stroke="#06B6D4" strokeWidth={2.5} dot={{ r: 4, fill: '#06B6D4' }} />
                  <Line yAxisId="right" type="monotone" dataKey="docs" stroke="#93C5FD" strokeWidth={2} dot={{ r: 3, fill: '#93C5FD' }} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Sub-document types */}
            <div className="content-card p-6">
              <div className="mb-4">
                <h3 className="font-bold text-slate-800">Sub-document Types</h3>
                <p className="text-xs text-slate-500">Distribution of {stats?.total_subdocuments} extracted sub-documents</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={stats?.subdoc_types || []} cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" nameKey="name">
                      {(stats?.subdoc_types || []).map((_, idx) => (
                        <Cell key={idx} fill={TYPE_COLORS[idx % 8]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {(stats?.subdoc_types || []).map((t, i) => {
                    const total = (stats?.subdoc_types || []).reduce((s, x) => s + x.value, 0);
                    const pct = total ? Math.round((t.value / total) * 100) : 0;
                    return (
                      <div key={t.name} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[i % 8] }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-700 font-medium truncate">{t.name}</span>
                            <span className="text-slate-500 ml-2">{t.value} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100">
                            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: TYPE_COLORS[i % 8] }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recent cases */}
            <div className="content-card overflow-hidden">
              <div className="flex items-center justify-between p-6 pb-0">
                <div>
                  <h3 className="font-bold text-slate-800">Recent Cases</h3>
                  <p className="text-xs text-slate-500">Latest uploaded cases</p>
                </div>
                <button onClick={() => router.push('/view-reports')}
                  className="flex items-center gap-1 text-base text-blue-600 font-medium hover:text-blue-700">
                  View all <ArrowRight size={14} />
                </button>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Case ID</th><th>Docs</th><th>Pages</th><th>Done</th><th>Failed</th><th>Status</th><th>Last Upload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.map(c => {
                      const hasFailed = c.failed_count > 0;
                      const isProcessing = c.processing_count > 0;
                      return (
                        <tr key={c.case_id} className="cursor-pointer" onClick={() => router.push('/view-reports')}>
                          <td><span className="font-semibold text-slate-800">{c.case_id}</span></td>
                          <td className="text-slate-600">{c.document_count}</td>
                          <td className="text-slate-600">{c.total_pages}</td>
                          <td><span className="text-green-600 font-semibold">{c.completed_count}</span></td>
                          <td><span className={c.failed_count > 0 ? 'text-red-500 font-semibold' : 'text-slate-400'}>{c.failed_count}</span></td>
                          <td>
                            <span className={`badge text-xs ${isProcessing ? 'bg-cyan-50 text-cyan-700' : hasFailed ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                              {isProcessing ? 'Processing' : hasFailed ? 'Has Errors' : 'Completed'}
                            </span>
                          </td>
                          <td className="text-slate-500 text-xs">
                            {c.last_uploaded ? new Date(c.last_uploaded).toLocaleDateString('en-IN') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick stats bar */}
            <div className="rounded-2xl p-5 flex flex-wrap gap-6 items-center"
              style={{ background: 'linear-gradient(135deg,rgba(6,182,212,0.08),rgba(37,99,235,0.08))', border: '1px solid rgba(6,182,212,0.15)' }}>
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-cyan-500" />
                <span className="font-bold text-slate-700 text-base">System Overview</span>
              </div>
              {[
                { label: 'Success Rate',    value: stats ? `${Math.round((stats.completed_documents / Math.max(stats.total_documents, 1)) * 100)}%` : '—' },
                { label: 'Avg Pages/Case',  value: stats ? Math.round(stats.total_pages / Math.max(stats.total_cases, 1)).toString() : '—' },
                { label: 'Sub-docs/Case',   value: stats ? Math.round(stats.total_subdocuments / Math.max(stats.total_cases, 1)).toString() : '—' },
                { label: 'Drafts',          value: stats?.draft_reports.toString() ?? '0' },
              ].map(m => (
                <div key={m.label} className="flex flex-col">
                  <span className="text-xs text-slate-500">{m.label}</span>
                  <span className="text-lg font-bold text-cyan-600">{m.value}</span>
                </div>
              ))}
            </div>

          </div>{/* end left column */}

          {/* ── Right column: chatbot ── */}
          <div>
            <div className="content-card flex flex-col sticky top-6" style={{ height: '60vh' }}>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100"
                style={{ background: 'linear-gradient(135deg,#0F172A,#1E3A5F)', borderRadius: '0.75rem 0.75rem 0 0' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(6,182,212,0.2)', border: '1px solid rgba(6,182,212,0.3)' }}>
                  <Bot size={16} className="text-cyan-400" />
                </div>
                <div>
                  <div className="text-white text-base font-bold">ACB Investigation Assistant</div>
                  <div className="text-slate-400 text-xs">Powered by RAG + LLM</div>
                </div>
                <div className="ml-auto w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMsgs.length === 1 && (
                  <div className="pt-2 pb-1">
                    <p className="text-xs text-slate-400 font-medium mb-2 text-center">Try asking</p>
                    <div className="flex flex-col gap-2">
                      {SUGGESTED_PROMPTS.map((p) => (
                        <button
                          key={p.text}
                          onClick={() => sendChat(p.text)}
                          disabled={chatLoading}
                          className="flex items-start gap-2 px-3 py-2 rounded-xl text-left text-base text-slate-600 bg-slate-50 border border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-all disabled:opacity-40"
                        >
                          <span className="text-base leading-none mt-0.5">{p.icon}</span>
                          <span className="leading-snug">{p.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMsgs.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'bot' && (
                      <div className="w-7 h-7 rounded-full bg-cyan-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot size={14} className="text-cyan-600" />
                      </div>
                    )}
                    <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                      <div className={`px-3 py-2 rounded-2xl text-base leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-slate-100 text-slate-700 rounded-bl-sm'
                      }`}>
                        {msg.text}
                      </div>
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {msg.sources.map((s, si) => (
                            <div key={si} className="text-xs text-slate-400 flex items-center gap-1">
                              <FileText size={10} />
                              <span>{s.title} · {s.case_id} · pp {s.pages}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User size={14} className="text-blue-600" />
                      </div>
                    )}
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-7 h-7 rounded-full bg-cyan-50 flex items-center justify-center flex-shrink-0">
                      <Bot size={14} className="text-cyan-600" />
                    </div>
                    <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                      <div className="flex gap-1">
                        {[0,1,2].map(j => (
                          <div key={j} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${j * 0.15}s` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-slate-100">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                    placeholder="Ask about case documents..."
                    className="form-input text-base flex-1"
                    disabled={chatLoading}
                  />
                  <button
                    onClick={() => sendChat()}
                    disabled={chatLoading || !chatInput.trim()}
                    className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    style={{ background: 'linear-gradient(135deg,#2563EB,#06B6D4)', color: 'white' }}
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>
          </div>{/* end right column */}

        </div>{/* end main grid */}

      </div>
    </div>
  );
}
