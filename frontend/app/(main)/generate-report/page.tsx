"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { BACKEND_URL } from "@/lib/config";
import TopNav from "@/components/layout/TopNav";
import {
  FileText, Upload, Sparkles, X, CheckCircle2, AlertCircle,
  Download, Loader2, FileScan, ClipboardList, Cpu, ChevronRight,
  FileWarning, RotateCcw, CloudUpload, ImageIcon, ScanText,
  Database, BrainCircuit, Users, Calendar, Search, Zap,
  BookOpen, Tag, Shield, BarChart2,
} from "lucide-react";

type UIStage = "idle" | "uploading" | "uploaded" | "processing" | "done" | "error";
type StageStatus = "pending" | "active" | "completed" | "failed";
type CaseMode = "new" | "existing";

interface StageProgress {
  current: number;
  total: number;
  unit: string;
}

interface PipelineStage {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

interface SubDocContent {
  subject: string | null;
  purpose: string | null;
  summary: string | null;
  main_content: string | null;
  key_persons: string[];
  key_dates: string[];
  key_findings: string[];
  key_actions: string[];
  organizations: string[];
}

interface SubDoc {
  id: number;
  title: string;
  document_type: string;
  start_page: number;
  end_page: number;
  confidence_score: number;
  content: SubDocContent | null;
}

interface CaseItem {
  case_id: string;
  document_count: number;
  completed_count: number;
  processing_count: number;
  failed_count: number;
  total_pages: number;
}

const PIPELINE_STAGES: PipelineStage[] = [
  { key: "converting_pdf",        label: "Converting PDF to Images",     description: "300 DPI page rendering",              icon: <ImageIcon size={15} /> },
  { key: "running_ocr",           label: "OCR Text Extraction",          description: "PaddleOCR per page",                  icon: <ScanText size={15} /> },
  { key: "reconstructing_pages",  label: "Reading Order Reconstruction", description: "Sort blocks by position",             icon: <BookOpen size={15} /> },
  { key: "detecting_subdocuments",label: "AI Sub-document Detection",    description: "Identify boundaries & document types", icon: <BrainCircuit size={15} /> },
  { key: "extracting_content",    label: "AI Content Extraction",        description: "Extract people, dates, findings",     icon: <Search size={15} /> },
  { key: "storing_results",       label: "Storing Results",              description: "Saving to database",                  icon: <Database size={15} /> },
  { key: "generating_embeddings", label: "Generating Embeddings",        description: "Qdrant vector storage",               icon: <Cpu size={15} /> },
];

const DOC_TYPE_COLORS: Record<string, string> = {
  "Letter": "bg-blue-100 text-blue-700",
  "Investigation Report": "bg-red-100 text-red-700",
  "Preliminary Enquiry Report": "bg-orange-100 text-orange-700",
  "Witness Statement": "bg-purple-100 text-purple-700",
  "Charge Sheet": "bg-red-100 text-red-800",
  "Order": "bg-indigo-100 text-indigo-700",
  "Proceedings": "bg-teal-100 text-teal-700",
  "Government Communication": "bg-cyan-100 text-cyan-700",
  "Audit Report": "bg-amber-100 text-amber-700",
};

function docTypeColor(type: string) {
  return DOC_TYPE_COLORS[type] || "bg-slate-100 text-slate-600";
}

function LogPanel({ logs, logBoxRef }: { logs: string[]; logBoxRef: React.RefObject<HTMLDivElement> }) {
  if (logs.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(6,182,212,0.2)" }}>
      <div className="px-3 py-2 flex items-center gap-2" style={{ background: "#0F172A", borderBottom: "1px solid rgba(6,182,212,0.1)" }}>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        </div>
        <span className="text-xs text-slate-500 font-mono ml-1">pipeline logs</span>
        <span className="ml-auto text-xs text-slate-600 font-mono">{logs.length} lines</span>
      </div>
      <div ref={logBoxRef} className="overflow-y-auto p-3 space-y-0.5" style={{ background: "#060F1E", height: 200 }}>
        {logs.map((line, i) => {
          const isError   = /ERROR|Exception|failed/i.test(line);
          const isWarning = /WARNING|WARN/i.test(line);
          const color     = isError ? "#F87171" : isWarning ? "#FBBF24" : "#4ADE80";
          return (
            <div key={i} className="text-xs leading-relaxed whitespace-pre-wrap break-all"
              style={{ fontFamily: "monospace", color }}>
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Pill({ items, color }: { items: string[]; color: string }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, i) => (
        <span key={i} className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{item}</span>
      ))}
    </div>
  );
}

function SubDocCard({ subdoc, index }: { subdoc: SubDoc; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const c = subdoc.content;
  const pct = Math.round((subdoc.confidence_score ?? 0) * 100);

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
      {/* Header */}
      <div className="p-4 flex items-start gap-3 cursor-pointer" onClick={() => setExpanded(e => !e)}
        style={{ background: "linear-gradient(135deg, #F8FAFC, #F1F5F9)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
          style={{ background: "linear-gradient(135deg, #2563EB, #06B6D4)" }}>{index + 1}</div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className="text-sm font-bold text-slate-800 truncate">{subdoc.title}</h4>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${docTypeColor(subdoc.document_type)}`}>
              <Tag size={9} /> {subdoc.document_type}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Pages {subdoc.start_page}–{subdoc.end_page}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <BarChart2 size={10} />
              {pct}% confidence
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 text-slate-400">
          <ChevronRight size={14} className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
        </div>
      </div>

      {/* Summary always visible */}
      {c?.summary && (
        <div className="px-4 py-2 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">
          {c.summary}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && c && (
        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-slate-100">
          {c.subject && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Subject</div>
              <p className="text-xs text-slate-700">{c.subject}</p>
            </div>
          )}
          {c.purpose && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Purpose</div>
              <p className="text-xs text-slate-700">{c.purpose}</p>
            </div>
          )}
          {c.key_findings?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Search size={10} /> Key Findings
              </div>
              <ul className="space-y-1">
                {c.key_findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {c.key_actions?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Zap size={10} /> Key Actions
              </div>
              <Pill items={c.key_actions} color="bg-amber-50 text-amber-700 border border-amber-100" />
            </div>
          )}
          {c.key_persons?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Users size={10} /> People
              </div>
              <Pill items={c.key_persons} color="bg-purple-50 text-purple-700 border border-purple-100" />
            </div>
          )}
          {c.organizations?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Shield size={10} /> Organizations
              </div>
              <Pill items={c.organizations} color="bg-indigo-50 text-indigo-700 border border-indigo-100" />
            </div>
          )}
          {c.key_dates?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Calendar size={10} /> Important Dates
              </div>
              <Pill items={c.key_dates} color="bg-green-50 text-green-700 border border-green-100" />
            </div>
          )}
          {c.main_content && (
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Content Preview</div>
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-4">{c.main_content}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GenerateReportPage() {
  const [caseMode, setCaseMode]               = useState<CaseMode>("new");
  const [newCaseId, setNewCaseId]             = useState("");
  const [selectedExistingCase, setSelectedExistingCase] = useState<string>("");
  const [cases, setCases]                     = useState<CaseItem[]>([]);
  const [file, setFile]                       = useState<File | null>(null);
  const [dragging, setDragging]               = useState(false);
  const [uiStage, setUiStage]                 = useState<UIStage>("idle");
  const [uploadPct, setUploadPct]             = useState(0);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [documentId, setDocumentId]           = useState<number | null>(null);
  const [currentStage, setCurrentStage]       = useState<string | null>(null);
  const [totalPages, setTotalPages]           = useState(0);
  const [subdocs, setSubdocs]                 = useState<SubDoc[]>([]);
  const [errorMsg, setErrorMsg]               = useState("");
  const [logs, setLogs]                       = useState<string[]>([]);
  const [stageProgress, setStageProgress]     = useState<Record<string, StageProgress>>({});
  const [completedStages, setCompletedStages] = useState<string[]>([]);
  const [rerunConfirmStage, setRerunConfirmStage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef       = useRef<XMLHttpRequest | null>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const logBoxRef    = useRef<HTMLDivElement>(null);

  const caseId = caseMode === "new" ? newCaseId : selectedExistingCase;
  const caseIdValid = /^[a-zA-Z0-9-]+$/.test(caseId) && caseId.trim().length > 0;
  const canGenerate = caseIdValid && file !== null && uiStage === "idle" && caseMode === "new";
  const isBusy = uiStage === "uploading" || uiStage === "uploaded" || uiStage === "processing";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("http://localhost:8000/pdf/cases");
        const data = await res.json();
        setCases(data.cases || []);
      } catch { }
    })();
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
  }, [logs]);

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop      = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type === "application/pdf") setFile(f);
  }, []);
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type === "application/pdf") setFile(f);
  };

  function uploadPDF(f: File): Promise<{ file_name: string; document_id: number }> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("caseId", caseId.trim().toUpperCase());
      formData.append("file", f);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status === 201) {
          const data = JSON.parse(xhr.responseText);
          resolve({ file_name: data.file_name, document_id: data.document_id });
        } else {
          try { reject(new Error(JSON.parse(xhr.responseText).detail || "Upload failed")); }
          catch { reject(new Error(`Upload failed (${xhr.status})`)); }
        }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.onabort = () => reject(new Error("Upload cancelled"));
      xhr.open("POST", "http://localhost:8000/pdf/upload");
      xhr.send(formData);
    });
  }

  function startPolling(docId: number) {
    pollRef.current = setInterval(async () => {
      try {
        const [statusRes, logsRes] = await Promise.all([
          fetch(`http://localhost:8000/pdf/status/${docId}`),
          fetch(`http://localhost:8000/pdf/logs/${docId}`),
        ]);
        const data    = await statusRes.json();
        const logData = await logsRes.json();

        setCurrentStage(data.current_stage ?? null);
        setTotalPages(data.total_pages ?? 0);
        setLogs(logData.logs ?? []);
        if (data.stage_progress) setStageProgress(data.stage_progress);

        if (data.status === "completed") {
          stopPolling();
          const sdRes  = await fetch(`http://localhost:8000/pdf/subdocuments/${docId}`);
          const sdData = await sdRes.json();
          setSubdocs(sdData.subdocuments ?? []);
          setUiStage("done");
        } else if (data.status === "failed") {
          stopPolling();
          setErrorMsg(data.error_message || "Pipeline failed");
          setUiStage("error");
        }
      } catch { /* network blip */ }
    }, 2000);
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function handleGenerate() {
    if (!canGenerate) return;
    setErrorMsg(""); setSubdocs([]); setUploadPct(0); setCurrentStage(null); setLogs([]); setStageProgress({});
    setUiStage("uploading");

    try {
      const { file_name, document_id } = await uploadPDF(file!);
      setUploadedFileName(file_name);
      setDocumentId(document_id);
      setUploadPct(100);
      setUiStage("uploaded");
      await new Promise(r => setTimeout(r, 900));
      setUiStage("processing");
      startPolling(document_id);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error");
      setUiStage("error");
    }
  }

  async function handleRerunStage(stage: string) {
    if (!documentId) return;

    setErrorMsg(""); setSubdocs([]); setUploadPct(0); setCurrentStage(null); setLogs([]); setStageProgress({});
    setRerunConfirmStage(null);
    setUiStage("processing");

    try {
      const res = await fetch(`http://localhost:8000/pdf/rerun/${documentId}?start_stage=${stage}`, {
        method: "POST",
      });
      if (res.ok) {
        startPolling(documentId);
      } else {
        const errData = await res.json();
        setErrorMsg(errData.detail || "Rerun failed");
        setUiStage("error");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error");
      setUiStage("error");
    }
  }

  function reset() {
    xhrRef.current?.abort();
    stopPolling();
    setUiStage("idle"); setUploadPct(0); setUploadedFileName("");
    setDocumentId(null); setCurrentStage(null); setTotalPages(0);
    setSubdocs([]); setErrorMsg(""); setLogs([]); setStageProgress({}); setFile(null);
    setCompletedStages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function getStageStatus(key: string): StageStatus {
    if (uiStage === "done") return "completed";
    if (uiStage === "error" && currentStage === key) return "failed";
    const idx       = PIPELINE_STAGES.findIndex(s => s.key === key);
    const activeIdx = PIPELINE_STAGES.findIndex(s => s.key === currentStage);
    if (activeIdx === -1) return "pending";
    if (idx < activeIdx)  return "completed";
    if (idx === activeIdx) return "active";
    return "pending";
  }

  function downloadResults() {
    if (!subdocs.length) return;
    const text = subdocs.map((sd, i) => {
      const c = sd.content;
      const lines = [
        `${"=".repeat(70)}`,
        `[${i + 1}] ${sd.title.toUpperCase()}`,
        `Type: ${sd.document_type} | Pages: ${sd.start_page}–${sd.end_page} | Confidence: ${Math.round((sd.confidence_score ?? 0) * 100)}%`,
        `${"=".repeat(70)}`,
      ];
      if (c?.subject)   lines.push(`Subject: ${c.subject}`);
      if (c?.purpose)   lines.push(`Purpose: ${c.purpose}`);
      if (c?.summary)   lines.push(`\nSummary:\n${c.summary}`);
      if (c?.key_findings?.length) lines.push(`\nKey Findings:\n${c.key_findings.map(f => `• ${f}`).join("\n")}`);
      if (c?.key_actions?.length)  lines.push(`\nKey Actions:\n${c.key_actions.map(a => `• ${a}`).join("\n")}`);
      if (c?.key_persons?.length)  lines.push(`\nPeople: ${c.key_persons.join(", ")}`);
      if (c?.organizations?.length) lines.push(`Organizations: ${c.organizations.join(", ")}`);
      if (c?.key_dates?.length)    lines.push(`Dates: ${c.key_dates.join(", ")}`);
      if (c?.main_content)         lines.push(`\nContent:\n${c.main_content}`);
      return lines.join("\n");
    }).join("\n\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `SubDocuments_${caseId.toUpperCase()}_${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  const isExistingCaseMode = caseMode === "existing" && selectedExistingCase;
  const showRerunButtons = isExistingCaseMode && uiStage === "idle";

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="Generate Report" subtitle="Upload a case document and extract structured sub-documents using AI" />

      <div className="p-6 animate-fade-in">
        <div className="max-w-6xl mx-auto">

          {/* Hero */}
          <div className="rounded-2xl p-6 mb-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #0E4D6C 100%)", border: "1px solid rgba(6,182,212,0.2)" }}>
            <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #06B6D4, transparent)", transform: "translate(30%, -30%)" }} />
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ai-glow-pulse" style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.3), rgba(37,99,235,0.3))", border: "1px solid rgba(6,182,212,0.4)" }}>
                <Sparkles size={24} className="text-cyan-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">AI Sub-Document Extractor</h2>
                <p className="text-slate-400 text-sm mt-0.5">Upload a merged PDF. AI detects embedded sub-documents (letters, reports, statements, orders) and extracts structured content from each.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

            {/* ── Left: Form ── */}
            <div className="xl:col-span-2 space-y-5">

              {/* Case Selection */}
              <div className="content-card p-6">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center"><ClipboardList size={14} className="text-blue-600" /></div>
                  Case Selection
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCaseMode("new")}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        caseMode === "new"
                          ? "bg-blue-100 text-blue-700 border border-blue-300"
                          : "bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200"
                      }`}
                    >
                      New Case
                    </button>
                    <button
                      onClick={() => setCaseMode("existing")}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        caseMode === "existing"
                          ? "bg-blue-100 text-blue-700 border border-blue-300"
                          : "bg-slate-100 text-slate-600 border border-transparent hover:bg-slate-200"
                      }`}
                    >
                      Existing Case
                    </button>
                  </div>

                  {caseMode === "new" ? (
                    <div>
                      <label className="form-label" htmlFor="newCaseId">Case ID <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input
                          id="newCaseId"
                          type="text"
                          value={newCaseId}
                          onChange={e => setNewCaseId(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
                          placeholder="e.g. ACB-2024-00123"
                          className="form-input pr-10"
                          style={newCaseId && !/^[a-zA-Z0-9-]+$/.test(newCaseId) ? { borderColor: "#EF4444", boxShadow: "0 0 0 3px rgba(239,68,68,0.1)" } : {}}
                          disabled={isBusy}
                        />
                        {newCaseId && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {/^[a-zA-Z0-9-]+$/.test(newCaseId) ? <CheckCircle2 size={16} className="text-green-500" /> : <AlertCircle size={16} className="text-red-400" />}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Alphanumeric and hyphens only</p>
                    </div>
                  ) : (
                    <div>
                      <label className="form-label">Select Case</label>
                      <select
                        value={selectedExistingCase}
                        onChange={e => {
                          setSelectedExistingCase(e.target.value);
                          if (e.target.value) {
                            fetch(`${BACKEND_URL}/pdf/list`)
                              .then(r => r.json())
                              .then(data => {
                                const doc = data.documents?.find((d: any) => d.case_id === e.target.value);
                                if (doc) setDocumentId(doc.document_id);
                              })
                              .catch(err => console.error("Failed to fetch document_id:", err));
                          }
                        }}
                        className="form-input"
                        disabled={isBusy}
                      >
                        <option value="">-- Choose a case --</option>
                        {cases.map(c => (
                          <option key={c.case_id} value={c.case_id}>
                            {c.case_id} ({c.document_count} docs, {c.total_pages} pages)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload (only shown in new case mode) */}
              {caseMode === "new" && (
                <div className="content-card p-6">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-100 flex items-center justify-center"><Upload size={14} className="text-cyan-600" /></div>
                    Upload Document
                  </h3>
                  {file ? (
                    <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: "rgba(16,185,129,0.06)", border: "1.5px solid rgba(16,185,129,0.25)" }}>
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0"><FileText size={18} className="text-green-600" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">{file.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{file.size >= 1048576 ? `${(file.size / 1048576).toFixed(2)} MB` : `${(file.size / 1024).toFixed(1)} KB`} · PDF</div>
                      </div>
                      {!isBusy && (
                        <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors">
                          <X size={13} className="text-red-500" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className={`dropzone ${dragging ? "active" : ""}`} style={{ padding: "36px 24px" }}
                      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                      onClick={() => fileInputRef.current?.click()}>
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.12), rgba(37,99,235,0.12))", border: "1px solid rgba(6,182,212,0.2)" }}>
                        <Upload size={22} className="text-cyan-500" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700 mb-1">Drop your PDF here</p>
                      <p className="text-xs text-slate-400 mb-4">or click to browse</p>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100">
                        <FileWarning size={12} /> PDF only · Max 300 MB
                      </span>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="application/pdf" onChange={onFileChange} className="hidden" />
                </div>
              )}

              {/* Generate button (new case mode) */}
              {caseMode === "new" && (
                <button onClick={handleGenerate} disabled={!canGenerate}
                  className="btn-ai w-full justify-center py-4 text-base" style={{ borderRadius: "14px" }}>
                  {uiStage === "uploading" ? (
                    <><CloudUpload size={18} className="animate-bounce" /> Uploading… {uploadPct}%</>
                  ) : isBusy ? (
                    <><Loader2 size={18} className="animate-spin" /> Processing…</>
                  ) : (
                    <><Sparkles size={18} /> Extract Sub-Documents<ChevronRight size={16} /></>
                  )}
                </button>
              )}

              {/* Rerun buttons (existing case mode) */}
              {showRerunButtons && (
                <div className="content-card p-6">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center"><RotateCcw size={14} className="text-purple-600" /></div>
                    Rerun Pipeline Stage
                  </h3>
                  <div className="space-y-2">
                    {PIPELINE_STAGES.slice(3).map((stage, i) => (
                      <button
                        key={stage.key}
                        onClick={() => setRerunConfirmStage(stage.key)}
                        className="w-full px-3 py-2 rounded-lg text-sm font-medium text-left bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
                      >
                        Rerun Stage {i + 4}: {stage.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Rerun confirmation modal */}
              {rerunConfirmStage && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl shadow-xl max-w-sm">
                    <div className="p-6">
                      <h3 className="text-lg font-bold text-slate-800 mb-2">Confirm Stage Rerun</h3>
                      <p className="text-sm text-slate-600 mb-4">
                        Rerunning from <strong>{PIPELINE_STAGES.find(s => s.key === rerunConfirmStage)?.label}</strong> will delete all downstream results and restart the pipeline.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setRerunConfirmStage(null)}
                          className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleRerunStage(rerunConfirmStage)}
                          className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(uiStage === "done" || uiStage === "error") && (
                <button onClick={reset} className="btn-secondary w-full justify-center">
                  <RotateCcw size={15} /> Start New
                </button>
              )}
            </div>

            {/* ── Right: Output ── */}
            <div className="xl:col-span-3">

              {/* IDLE */}
              {uiStage === "idle" && (
                <div className="content-card h-full flex flex-col items-center justify-center p-12 text-center" style={{ minHeight: 460 }}>
                  <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5" style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.1), rgba(37,99,235,0.1))", border: "1px solid rgba(6,182,212,0.15)" }}>
                    <FileScan size={36} className="text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-400 mb-2">Pipeline Preview</h3>
                  <p className="text-sm text-slate-400 max-w-xs mb-8">
                    {caseMode === "new"
                      ? "Fill in Case ID, upload a merged PDF, and click Extract Sub-Documents."
                      : "Select an existing case to see rerun options."}
                  </p>
                  <div className="w-full space-y-2 text-left">
                    {PIPELINE_STAGES.map((s, i) => (
                      <div key={s.key} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                        <span className="text-slate-500">{s.icon}</span>
                        <span className="text-xs font-medium text-slate-500">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* UPLOADING */}
              {uiStage === "uploading" && (
                <div className="content-card p-8 animate-fade-in" style={{ minHeight: 460 }}>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(37,99,235,0.15))", border: "1px solid rgba(6,182,212,0.25)" }}>
                      <CloudUpload size={18} className="text-cyan-500" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">Uploading Document</div>
                      <div className="text-xs text-slate-400">Sending to server…</div>
                    </div>
                  </div>
                  <div className="rounded-xl p-4 mb-6 flex items-center gap-3" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0"><FileText size={18} className="text-red-500" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">{file?.name}</div>
                      <div className="text-xs text-slate-500">{file && (file.size >= 1048576 ? `${(file.size / 1048576).toFixed(2)} MB` : `${(file.size / 1024).toFixed(1)} KB`)} · PDF</div>
                    </div>
                    <div className="text-sm font-bold text-cyan-600 flex-shrink-0">{uploadPct}%</div>
                  </div>
                  <div className="mb-2 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Upload Progress</span>
                    <span className="text-xs font-bold text-cyan-600">{uploadPct}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden mb-2">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${uploadPct}%`, background: "linear-gradient(90deg, #2563EB, #06B6D4)", boxShadow: uploadPct > 0 ? "0 0 8px rgba(6,182,212,0.5)" : "none" }} />
                  </div>
                  <p className="text-xs text-slate-400 mt-4 text-center">
                    {uploadPct < 30 ? "Starting upload…" : uploadPct < 70 ? "Transferring data…" : uploadPct < 95 ? "Almost done…" : "Finalising…"}
                  </p>
                </div>
              )}

              {/* UPLOADED */}
              {uiStage === "uploaded" && (
                <div className="content-card p-8 flex flex-col items-center justify-center text-center animate-fade-in" style={{ minHeight: 460 }}>
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(16,185,129,0.1)", border: "2px solid rgba(16,185,129,0.3)" }}>
                    <CheckCircle2 size={36} className="text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Upload Successful!</h3>
                  <p className="text-xs font-mono bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 mt-1">{uploadedFileName}</p>
                  <div className="flex items-center gap-2 mt-6 text-xs text-cyan-600 font-semibold">
                    <Loader2 size={13} className="animate-spin" /> Starting pipeline…
                  </div>
                </div>
              )}

              {/* PROCESSING */}
              {uiStage === "processing" && (
                <div className="content-card p-6 animate-fade-in" style={{ minHeight: 460 }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center ai-glow-pulse" style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(37,99,235,0.2))", border: "1px solid rgba(6,182,212,0.3)" }}>
                      <Cpu size={18} className="text-cyan-400" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">Pipeline Running</div>
                      <div className="text-xs text-slate-400">
                        Document ID: {documentId}
                        {totalPages > 0 && <span className="ml-2">· {totalPages} pages</span>}
                      </div>
                    </div>
                  </div>

                  <div className="mb-5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.round(((PIPELINE_STAGES.findIndex(s => s.key === currentStage) + 1) / PIPELINE_STAGES.length) * 100)}%`,
                        background: "linear-gradient(90deg, #2563EB, #06B6D4)",
                      }} />
                  </div>

                  <div className="space-y-2">
                    {PIPELINE_STAGES.map((stage, i) => {
                      const status = getStageStatus(stage.key);
                      return (
                        <div key={stage.key}
                          className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-500 ${
                            status === "active"    ? "bg-cyan-50 border border-cyan-200" :
                            status === "completed" ? "bg-green-50 border border-green-100" :
                            status === "failed"    ? "bg-red-50 border border-red-200" :
                            "bg-slate-50 border border-transparent"
                          }`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                            status === "active"    ? "bg-cyan-100 text-cyan-600" :
                            status === "completed" ? "bg-green-100 text-green-600" :
                            status === "failed"    ? "bg-red-100 text-red-600" :
                            "bg-slate-100 text-slate-400"
                          }`}>
                            {status === "completed" ? <CheckCircle2 size={14} /> :
                             status === "failed"    ? <AlertCircle size={14} /> :
                             stage.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-semibold transition-colors duration-500 ${
                              status === "active"    ? "text-cyan-700" :
                              status === "completed" ? "text-green-700" :
                              status === "failed"    ? "text-red-700" :
                              "text-slate-400"
                            }`}>{stage.label}</div>
                            <div className="text-xs text-slate-400">{stage.description}</div>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            {(status === "active" || status === "completed") && (() => {
                              const sp = stageProgress[stage.key];
                              if (!sp || sp.total === 0) return null;
                              return (
                                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: status === "active" ? "rgba(6,182,212,0.15)" : "rgba(16,185,129,0.15)", color: status === "active" ? "#06B6D4" : "#10B981" }}>
                                  {sp.current}/{sp.total} {sp.unit}
                                </span>
                              );
                            })()}
                            {status === "active"    && <Loader2 size={14} className="text-cyan-400 animate-spin" />}
                            {status === "completed" && <CheckCircle2 size={14} className="text-green-400" />}
                            {status === "pending"   && <span className="text-xs text-slate-300 font-mono">{i + 1}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <LogPanel logs={logs} logBoxRef={logBoxRef} />
                </div>
              )}

              {/* ERROR */}
              {uiStage === "error" && (
                <div className="content-card p-8" style={{ minHeight: 460 }}>
                  <div className="flex flex-col items-center justify-center text-center mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
                      <AlertCircle size={28} className="text-red-500" />
                    </div>
                    <h3 className="font-bold text-slate-800 mb-2">Pipeline Failed</h3>
                    <p className="text-sm text-slate-500 mb-4">{errorMsg}</p>
                    <button onClick={reset} className="btn-secondary"><RotateCcw size={14} /> Try Again</button>
                  </div>
                  <LogPanel logs={logs} logBoxRef={logBoxRef} />
                </div>
              )}

              {/* DONE */}
              {uiStage === "done" && (
                <div className="content-card overflow-hidden animate-fade-in">
                  {/* Header */}
                  <div className="p-5 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #0F172A, #1E3A5F)", borderBottom: "1px solid rgba(6,182,212,0.2)" }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-green-400/20 flex items-center justify-center">
                        <CheckCircle2 size={18} className="text-green-400" />
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">Extraction Complete</div>
                        <div className="text-slate-400 text-xs">
                          {subdocs.length} sub-document{subdocs.length !== 1 ? "s" : ""} · {totalPages} pages · Case {caseId.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <button onClick={downloadResults} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-cyan-400 hover:text-white transition-colors" style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)" }}>
                      <Download size={14} /> Download
                    </button>
                  </div>

                  {/* Stage badges */}
                  <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-slate-100">
                    {PIPELINE_STAGES.map(s => (
                      <span key={s.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-100">
                        <CheckCircle2 size={10} /> {s.label}
                      </span>
                    ))}
                  </div>

                  {/* Sub-document cards */}
                  <div className="p-5 space-y-3 max-h-[600px] overflow-y-auto">
                    {subdocs.map((sd, i) => (
                      <SubDocCard key={sd.id} subdoc={sd} index={i} />
                    ))}
                  </div>

                  {/* Log panel */}
                  <div className="px-5 pb-5">
                    <LogPanel logs={logs} logBoxRef={logBoxRef} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
