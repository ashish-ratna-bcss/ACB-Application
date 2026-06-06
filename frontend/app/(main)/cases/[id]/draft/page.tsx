'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Cpu, FileText, Save, CheckCircle,
  MessageSquare, ArrowRight, Zap, RefreshCw, Bold,
  Italic, AlignLeft, AlignCenter, List
} from 'lucide-react';
import TopNav from '@/components/layout/TopNav';
import { getDraftTypeLabel } from '@/lib/utils';
import type { Case, Draft, DraftType, ExtractionData } from '@/lib/types';

const DRAFT_TYPES: { value: DraftType; label: string; desc: string }[] = [
  { value: 'fir', label: 'FIR', desc: 'First Information Report – for court submission' },
  { value: 'preliminary_report', label: 'Preliminary Report', desc: 'Initial investigation findings' },
  { value: 'remand_report', label: 'Remand Report', desc: 'Application for police custody' },
  { value: 'final_report', label: 'Final Report', desc: 'Comprehensive investigation report' },
  { value: 'charge_sheet', label: 'Charge Sheet', desc: 'Formal charges against the accused' },
];

function TypingText({ text, speed = 5, onComplete }: { text: string; speed?: number; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const idxRef = useRef(0);

  useEffect(() => {
    idxRef.current = 0;
    setDisplayed('');
    setDone(false);
    const interval = setInterval(() => {
      idxRef.current += speed;
      if (idxRef.current >= text.length) {
        setDisplayed(text);
        setDone(true);
        clearInterval(interval);
        onComplete?.();
      } else {
        setDisplayed(text.slice(0, idxRef.current));
      }
    }, 16);
    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <pre className={`rich-editor whitespace-pre-wrap ${!done ? 'typing-cursor' : ''}`} style={{ fontFamily: 'Georgia, serif' }}>
      {displayed}
    </pre>
  );
}

export default function DraftPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const editorRef = useRef<HTMLDivElement>(null);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [extraction, setExtraction] = useState<ExtractionData | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [selectedType, setSelectedType] = useState<DraftType>('fir');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/cases/${id}`).then(r => r.json()),
      fetch(`/api/extract?caseId=${id}`).then(r => r.json()).catch(() => null),
      fetch(`/api/draft?caseId=${id}`).then(r => r.json()).catch(() => []),
    ]).then(([c, e, d]) => {
      setCaseData(c);
      if (e && !e.error) setExtraction(e);
      const draftList = Array.isArray(d) ? d : [];
      setDrafts(draftList);
      if (draftList.length > 0) setSelectedDraft(draftList[0]);
    }).finally(() => setLoading(false));
  }, [id]);

  async function generateDraft() {
    setGenerating(true);
    setGeneratedText('');
    setTypingDone(false);
    setSelectedDraft(null);

    try {
      const res = await fetch(`http://localhost:8000/pdf/generate-draft/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
      }
      const data = await res.json();

      // Convert structured sections → formatted report text
      const lines: string[] = [];
      lines.push(data.title || 'GOVERNMENT OF TELANGANA ANTI-CORRUPTION BUREAU');
      lines.push('');
      if (data.header) {
        lines.push(data.header.from || '');
        lines.push('');
        lines.push(data.header.to || '');
        lines.push('');
        lines.push('─'.repeat(60));
        lines.push('');
      }
      for (const section of (data.sections || [])) {
        lines.push(`${section.number}. ${section.heading}`);
        lines.push('');
        for (const sub of (section.subsections || [])) {
          if (sub.heading) lines.push(`  ${sub.number}. ${sub.heading}`);
          if (sub.content && sub.content !== 'TO DO') {
            lines.push(`  ${sub.content}`);
          } else {
            lines.push(`  [TO BE FILLED]`);
          }
          lines.push('');
        }
      }

      const content = lines.join('\n');
      const draft: Draft = {
        id: `rag-${Date.now()}`,
        caseId: id,
        type: 'final_report',
        title: data.title || 'ACB Final Report',
        content,
        status: 'generating',
        comments: [],
        generatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setGeneratedText(content);
      setSelectedDraft(draft);
      setDrafts(prev => [draft, ...prev]);
    } catch (err) {
      alert(`Draft generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  }

  async function saveDraft() {
    if (!selectedDraft) return;
    setSaving(true);
    const content = editorRef.current?.innerText || selectedDraft.content;
    try {
      const res = await fetch(`/api/draft/${selectedDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, status: 'reviewed' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedDraft(updated);
        setDrafts(prev => prev.map(d => d.id === updated.id ? updated : d));
      }
    } finally {
      setSaving(false);
    }
  }

  async function addComment() {
    if (!selectedDraft || !comment.trim()) return;
    const res = await fetch(`/api/draft/${selectedDraft.id}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: comment }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSelectedDraft(updated);
      setComment('');
    }
  }

  function applyFormat(command: string) {
    document.execCommand(command, false);
    editorRef.current?.focus();
  }

  if (loading) return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="AI Draft Generator" />
      <div className="flex items-center justify-center flex-1">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="AI Draft Generator" subtitle={caseData?.caseNumber} />

      <div className="p-6 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <button onClick={() => router.push(`/cases/${id}/extraction`)} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm transition-colors">
            <ArrowLeft size={16} /> Back to Extraction
          </button>
          {selectedDraft && (
            <button onClick={() => router.push(`/cases/${id}/export`)} className="btn-primary">
              Export PDF <ArrowRight size={16} />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Left Panel: Controls + Evidence Summary */}
          <div className="space-y-4">
            {/* Draft Type Selector */}
            <div className="content-card p-5">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Zap size={16} className="text-cyan-500" /> Generate New Draft
              </h3>
              <div className="space-y-2 mb-4">
                {DRAFT_TYPES.map(dt => (
                  <button
                    key={dt.value}
                    onClick={() => setSelectedType(dt.value)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      selectedType === dt.value
                        ? 'border-cyan-400 bg-cyan-50'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className={`text-sm font-semibold ${selectedType === dt.value ? 'text-cyan-700' : 'text-slate-700'}`}>{dt.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{dt.desc}</div>
                  </button>
                ))}
              </div>
              <button onClick={generateDraft} disabled={generating} className="btn-ai w-full justify-center">
                {generating ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
                ) : (
                  <><Cpu size={16} /> Generate {DRAFT_TYPES.find(d => d.value === selectedType)?.label}</>
                )}
              </button>
            </div>

            {/* Evidence Summary */}
            {extraction && (
              <div className="content-card p-5">
                <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-blue-500" /> Evidence Summary
                </h3>
                <div className="space-y-2.5 text-sm">
                  {[
                    { label: 'Accused', value: extraction.accusedName },
                    { label: 'Department', value: extraction.department },
                    { label: 'Bribe Amount', value: extraction.bribeAmount, highlight: true },
                    { label: 'Location', value: extraction.location },
                    { label: 'Witnesses', value: `${extraction.witnessNames.length} identified` },
                    { label: 'AI Confidence', value: `${extraction.confidence}%` },
                  ].map(item => (
                    <div key={item.label} className="flex justify-between items-start gap-2">
                      <span className="text-slate-500 flex-shrink-0">{item.label}</span>
                      <span className={`font-medium text-right ${item.highlight ? 'text-red-600' : 'text-slate-700'}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Previous Drafts */}
            {drafts.length > 0 && (
              <div className="content-card p-5">
                <h3 className="font-bold text-slate-800 mb-3">Saved Drafts</h3>
                <div className="space-y-2">
                  {drafts.map(d => (
                    <button
                      key={d.id}
                      onClick={() => { setSelectedDraft(d); setGeneratedText(''); }}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selectedDraft?.id === d.id ? 'border-blue-400 bg-blue-50' : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="text-sm font-semibold text-slate-700">{getDraftTypeLabel(d.type)}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`badge text-xs ${
                          d.status === 'finalized' ? 'bg-green-50 text-green-700' :
                          d.status === 'reviewed' ? 'bg-blue-50 text-blue-700' :
                          'bg-slate-50 text-slate-600'
                        }`}>{d.status}</span>
                        <span className="text-xs text-slate-400">{d.comments.length} comments</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Editor */}
          <div className="xl:col-span-2 content-card flex flex-col overflow-hidden" style={{ minHeight: 600 }}>
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-4 border-b border-slate-100 flex-wrap">
              <span className="text-sm font-semibold text-slate-700 mr-2">
                {selectedDraft ? getDraftTypeLabel(selectedDraft.type) : 'Draft Editor'}
              </span>
              <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1">
                {[
                  { icon: <Bold size={14} />, cmd: 'bold', title: 'Bold' },
                  { icon: <Italic size={14} />, cmd: 'italic', title: 'Italic' },
                  { icon: <AlignLeft size={14} />, cmd: 'justifyLeft', title: 'Left' },
                  { icon: <AlignCenter size={14} />, cmd: 'justifyCenter', title: 'Center' },
                  { icon: <List size={14} />, cmd: 'insertUnorderedList', title: 'List' },
                ].map(btn => (
                  <button
                    key={btn.cmd}
                    onMouseDown={e => { e.preventDefault(); applyFormat(btn.cmd); }}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                    title={btn.title}
                  >
                    {btn.icon}
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              {selectedDraft && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowCommentBox(!showCommentBox)} className="btn-secondary text-sm" style={{ padding: '6px 12px' }}>
                    <MessageSquare size={14} /> {selectedDraft.comments.length}
                  </button>
                  <button onClick={saveDraft} disabled={saving} className="btn-primary text-sm" style={{ padding: '6px 14px' }}>
                    {saving ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Save size={14} />}
                    Save Draft
                  </button>
                </div>
              )}
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-auto p-6">
              {!selectedDraft && !generating && (
                <div className="h-full flex items-center justify-center text-center">
                  <div>
                    <div
                      className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4"
                      style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(37,99,235,0.1))' }}
                    >
                      <FileText size={40} className="text-cyan-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 mb-2">No Draft Generated Yet</h3>
                    <p className="text-slate-400 text-sm">Select a document type and click Generate</p>
                  </div>
                </div>
              )}

              {generating && (
                <div className="flex items-center justify-center h-32 mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #06B6D4, #2563EB)' }}
                    >
                      <Cpu size={20} className="text-white animate-pulse" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">AI is generating your draft...</p>
                      <p className="text-sm text-slate-400">This may take a moment</p>
                    </div>
                  </div>
                </div>
              )}

              {generatedText && !typingDone ? (
                <TypingText text={generatedText} speed={8} onComplete={() => setTypingDone(true)} />
              ) : selectedDraft && (typingDone || !generatedText) ? (
                <div
                  ref={editorRef}
                  className="rich-editor outline-none"
                  contentEditable
                  suppressContentEditableWarning
                  style={{ fontFamily: 'Georgia, serif' }}
                  onBlur={e => {
                    if (selectedDraft) setSelectedDraft({ ...selectedDraft, content: e.currentTarget.innerText });
                  }}
                  dangerouslySetInnerHTML={{ __html: selectedDraft.content.replace(/\n/g, '<br>') }}
                />
              ) : null}
            </div>

            {/* Comments Panel */}
            {showCommentBox && selectedDraft && (
              <div className="border-t border-slate-100 p-4 bg-slate-50">
                <h4 className="font-semibold text-slate-700 text-sm mb-3">Review Comments ({selectedDraft.comments.length})</h4>
                <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                  {selectedDraft.comments.map(c => (
                    <div key={c.id} className="p-2 bg-white rounded-lg border border-slate-200 text-xs">
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span className="font-semibold text-slate-600">{c.author}</span>
                        <span>{c.createdAt.slice(0, 10)}</span>
                      </div>
                      <p className="text-slate-700">{c.text}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Add a review comment..."
                    className="form-input text-sm flex-1"
                    onKeyDown={e => { if (e.key === 'Enter') addComment(); }}
                  />
                  <button onClick={addComment} className="btn-primary text-sm" style={{ padding: '8px 14px' }}>Add</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
