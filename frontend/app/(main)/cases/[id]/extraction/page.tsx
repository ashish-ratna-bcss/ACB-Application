'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Cpu, Save, RefreshCw, ArrowRight, CheckCircle, Zap, AlertCircle } from 'lucide-react';
import TopNav from '@/components/layout/TopNav';
import type { Case, ExtractionData } from '@/lib/types';

export default function ExtractionPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [extraction, setExtraction] = useState<ExtractionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scanPhase, setScanPhase] = useState(0);
  const [editMode, setEditMode] = useState(false);

  const SCAN_PHASES = [
    'Initializing AI Engine...',
    'Scanning document content...',
    'Identifying entities (names, dates, amounts)...',
    'Cross-referencing departmental data...',
    'Computing confidence scores...',
    'Generating structured extraction...',
    'Extraction complete!',
  ];

  useEffect(() => {
    Promise.all([
      fetch(`/api/cases/${id}`).then(r => r.json()),
      fetch(`/api/extract?caseId=${id}`).then(r => r.json()),
    ]).then(([c, e]) => {
      setCaseData(c);
      if (e && !e.error) setExtraction(e);
    }).finally(() => setLoading(false));
  }, [id]);

  async function runExtraction() {
    setProcessing(true);
    setScanPhase(0);
    setExtraction(null);

    const phaseInterval = setInterval(() => {
      setScanPhase(prev => {
        if (prev >= SCAN_PHASES.length - 2) { clearInterval(phaseInterval); return prev; }
        return prev + 1;
      });
    }, 700);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: id }),
      });
      if (res.ok) {
        const data = await res.json();
        setScanPhase(SCAN_PHASES.length - 1);
        setTimeout(() => { setExtraction(data); setProcessing(false); }, 500);
      }
    } catch {
      setProcessing(false);
    }
    clearInterval(phaseInterval);
  }

  async function saveExtraction() {
    if (!extraction) return;
    setSaving(true);
    try {
      await fetch('/api/extract', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...extraction }),
      });
      setSaved(true);
      setEditMode(false);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof ExtractionData, value: unknown) {
    if (extraction) setExtraction({ ...extraction, [field]: value });
  }

  if (loading) return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="AI Extraction" />
      <div className="flex items-center justify-center flex-1">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  const EXTRACTED_FIELDS = extraction ? [
    { label: 'Accused Name', key: 'accusedName' as keyof ExtractionData, value: extraction.accusedName, type: 'text' },
    { label: 'Department', key: 'department' as keyof ExtractionData, value: extraction.department, type: 'text' },
    { label: 'Bribe Amount', key: 'bribeAmount' as keyof ExtractionData, value: extraction.bribeAmount, type: 'text' },
    { label: 'Location', key: 'location' as keyof ExtractionData, value: extraction.location, type: 'text' },
    { label: 'Additional Details', key: 'additionalDetails' as keyof ExtractionData, value: extraction.additionalDetails, type: 'textarea' },
  ] : [];

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="AI Extraction" subtitle={caseData?.caseNumber} />

      <div className="p-6 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push(`/cases/${id}/documents`)} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm transition-colors">
            <ArrowLeft size={16} /> Back to Documents
          </button>
          {extraction && (
            <button onClick={() => router.push(`/cases/${id}/draft`)} className="btn-primary">
              Generate Draft <ArrowRight size={16} />
            </button>
          )}
        </div>

        {/* Header Banner */}
        <div
          className="rounded-2xl p-6 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0F172A 0%, #164E63 60%, #0891B2 100%)' }}
        >
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 75% 50%, rgba(6,182,212,0.5) 0%, transparent 50%)' }} />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Cpu size={20} className="text-cyan-400" />
                <span className="text-cyan-400 font-semibold">AI-Powered OCR Extraction</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">Document Intelligence</h2>
              <p className="text-slate-400 text-sm">Automatically extract structured data from uploaded evidence documents</p>
            </div>
            <div className="flex gap-3">
              <button onClick={runExtraction} disabled={processing} className="btn-ai">
                {processing ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing...</>
                ) : (
                  <><RefreshCw size={16} /> {extraction ? 'Re-extract' : 'Run Extraction'}</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content - Split Screen */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Left: AI Processing Visualization */}
          <div className="content-card p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Zap size={18} className="text-cyan-500" /> AI Processing Status
            </h3>

            {!processing && !extraction && (
              <div className="text-center py-12">
                <div
                  className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(37,99,235,0.1))', border: '1px solid rgba(6,182,212,0.2)' }}
                >
                  <Cpu size={48} className="text-cyan-400" />
                </div>
                <p className="text-slate-600 font-semibold mb-2">Ready for Extraction</p>
                <p className="text-slate-400 text-sm mb-6">Click &quot;Run Extraction&quot; to analyze uploaded documents with AI</p>
                <button onClick={runExtraction} className="btn-ai">
                  <Cpu size={16} /> Start AI Extraction
                </button>
              </div>
            )}

            {processing && (
              <div className="space-y-4">
                {/* Scanning animation */}
                <div className="relative h-48 rounded-xl overflow-hidden bg-slate-900 ai-scanner">
                  <div className="absolute inset-0 p-4">
                    <div className="space-y-2 opacity-50">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-2 bg-slate-700 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
                      ))}
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Cpu size={32} className="text-cyan-400 mx-auto mb-2 animate-pulse" />
                      <p className="text-cyan-400 text-sm font-medium">{SCAN_PHASES[scanPhase]}</p>
                    </div>
                  </div>
                </div>

                {/* Phase progress */}
                <div className="space-y-2">
                  {SCAN_PHASES.slice(0, -1).map((phase, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        i < scanPhase ? 'bg-green-500' : i === scanPhase ? 'bg-cyan-500 animate-pulse' : 'bg-slate-200'
                      }`}>
                        {i < scanPhase ? (
                          <CheckCircle size={12} className="text-white" />
                        ) : (
                          <span className="text-xs text-white font-bold">{i + 1}</span>
                        )}
                      </div>
                      <span className={`text-sm transition-colors ${
                        i < scanPhase ? 'text-green-600 font-medium' : i === scanPhase ? 'text-cyan-600 font-semibold' : 'text-slate-400'
                      }`}>{phase}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {extraction && !processing && (
              <div className="space-y-4">
                {/* Success */}
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
                  <CheckCircle size={24} className="text-green-500 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-green-700">Extraction Complete</p>
                    <p className="text-sm text-green-600">AI successfully extracted {Object.keys(extraction).length} data fields</p>
                  </div>
                </div>

                {/* Confidence meter */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-700">AI Confidence Score</span>
                    <span className="text-2xl font-bold text-cyan-600">{extraction.confidence}%</span>
                  </div>
                  <div className="confidence-bar">
                    <div className="confidence-fill" style={{ width: `${extraction.confidence}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {extraction.confidence >= 90 ? 'High confidence – Data is reliable' : extraction.confidence >= 70 ? 'Medium confidence – Review recommended' : 'Low confidence – Manual verification required'}
                  </p>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Entities Found', value: extraction.officerNames.length + extraction.witnessNames.length + 1 },
                    { label: 'Dates Extracted', value: extraction.dates.length },
                    { label: 'Documents Scanned', value: extraction.documentIds.length },
                  ].map(s => (
                    <div key={s.label} className="text-center p-3 bg-slate-50 rounded-xl">
                      <div className="text-xl font-bold text-slate-700">{s.value}</div>
                      <div className="text-xs text-slate-500">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button onClick={runExtraction} className="btn-secondary flex-1 justify-center text-sm">
                    <RefreshCw size={14} /> Re-extract
                  </button>
                  <button onClick={() => setEditMode(!editMode)} className={`flex-1 justify-center text-sm ${editMode ? 'btn-primary' : 'btn-secondary'}`}>
                    {editMode ? 'Cancel Edit' : '✏️ Edit Fields'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Extracted Data */}
          <div className="content-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle size={18} className="text-green-500" /> Extracted Data
              </h3>
              {extraction && (
                <div className="flex gap-2">
                  {saved && (
                    <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                      <CheckCircle size={14} /> Saved
                    </span>
                  )}
                  <button onClick={saveExtraction} disabled={saving} className="btn-primary text-sm" style={{ padding: '6px 14px' }}>
                    {saving ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
                    Save
                  </button>
                </div>
              )}
            </div>

            {!extraction ? (
              <div className="text-center py-12 text-slate-400">
                <AlertCircle size={40} className="mx-auto mb-3 text-slate-300" />
                <p className="font-medium">No extraction data yet</p>
                <p className="text-sm mt-1">Run AI extraction to see results here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {EXTRACTED_FIELDS.map(field => (
                  <div key={field.key} className="group">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">{field.label}</label>
                    {editMode ? (
                      field.type === 'textarea' ? (
                        <textarea
                          value={String(field.value)}
                          onChange={e => updateField(field.key, e.target.value)}
                          className="form-input resize-none"
                          rows={3}
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(field.value)}
                          onChange={e => updateField(field.key, e.target.value)}
                          className="form-input"
                        />
                      )
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 group-hover:border-slate-200 transition-colors">
                        <p className="text-sm text-slate-800 font-medium">{String(field.value) || '—'}</p>
                      </div>
                    )}
                  </div>
                ))}

                {/* Lists */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Key Dates</label>
                  <div className="flex flex-wrap gap-2">
                    {extraction.dates.map((d, i) => (
                      <span key={i} className="badge bg-blue-50 text-blue-700">{d}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Officer Names</label>
                  <div className="space-y-1">
                    {extraction.officerNames.map((n, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {n}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Witnesses</label>
                  <div className="space-y-1">
                    {extraction.witnessNames.map((n, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> {n}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
