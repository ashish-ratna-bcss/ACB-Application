"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { BACKEND_URL } from "@/lib/config";
import dynamic from "next/dynamic";
import TopNav from "@/components/layout/TopNav";
import {
  FolderSearch,
  ChevronDown,
  FileText,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Users,
  Calendar,
  Search,
  Shield,
  Zap,
  Tag,
  BarChart2,
  BookOpen,
  ChevronRight,
  FileWarning,
  RefreshCw,
  Download,
  Hash,
  ScrollText,
  Sparkles,
  DatabaseZap,
  Mic,
  Radio,
} from "lucide-react";
import type { DraftReport } from "@/components/DraftReportModal";
import CaseSearchSelect from "@/components/CaseSearchSelect";

const DraftReportModal = dynamic(
  () => import("@/components/DraftReportModal"),
  { ssr: false },
);

// ── Types ─────────────────────────────────────────────────────────────────────

interface CaseSummary {
  case_id: string;
  document_count: number;
  completed_count: number;
  processing_count: number;
  failed_count: number;
  total_pages: number;
  last_uploaded: string | null;
}

interface AllCaseItem {
  id: string;
  caseNumber: string;
  title: string;
  type: string;
  status: string;
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

interface CaseDocument {
  document_id: number;
  file_name: string;
  original_name: string | null;
  status: string;
  current_stage: string | null;
  total_pages: number;
  error_message: string | null;
  created_at: string | null;
  subdocument_count: number;
  subdocuments: SubDoc[];
}

interface CaseDetail {
  case_id: string;
  document_count: number;
  total_subdocuments: number;
  documents: CaseDocument[];
}

interface MediaSegment {
  speaker?: string;
  start?: number;
  end?: number;
  text: string;
  original_text?: string;
}

interface MediaRecord {
  id: string;
  caseId: string;
  fileName: string | null;
  audioDescription: string | null;
  language: string | null;
  languageName: string | null;
  targetLanguage: string | null;
  targetLanguageName: string | null;
  task: string | null;
  text: string | null;
  originalText: string | null;
  segments: MediaSegment[];
  originalSegments: MediaSegment[];
  speakerCount: number;
  diarization: boolean;
  processingTime: number | null;
  createdAt: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DOC_TYPE_COLORS: Record<string, string> = {
  Letter: "bg-blue-100 text-blue-700",
  "Investigation Report": "bg-red-100 text-red-700",
  "Preliminary Enquiry Report": "bg-orange-100 text-orange-700",
  "Witness Statement": "bg-purple-100 text-purple-700",
  "Charge Sheet": "bg-red-100 text-red-800",
  Order: "bg-indigo-100 text-indigo-700",
  Proceedings: "bg-teal-100 text-teal-700",
  "Government Communication": "bg-cyan-100 text-cyan-700",
  "Audit Report": "bg-amber-100 text-amber-700",
};
function docTypeColor(t: string) {
  return DOC_TYPE_COLORS[t] || "bg-slate-100 text-slate-600";
}

function statusConfig(s: string) {
  switch (s) {
    case "completed":
      return {
        label: "Completed",
        bg: "bg-green-100",
        text: "text-green-700",
        icon: <CheckCircle2 size={12} />,
      };
    case "processing":
      return {
        label: "Processing",
        bg: "bg-cyan-100",
        text: "text-cyan-700",
        icon: <Loader2 size={12} className="animate-spin" />,
      };
    case "failed":
      return {
        label: "Failed",
        bg: "bg-red-100",
        text: "text-red-700",
        icon: <AlertCircle size={12} />,
      };
    default:
      return {
        label: "Uploaded",
        bg: "bg-slate-100",
        text: "text-slate-600",
        icon: <Clock size={12} />,
      };
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function Pill({ items, color }: { items: string[]; color: string }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span
          key={i}
          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ── Sub-document card ─────────────────────────────────────────────────────────

function SubDocCard({ sd, index }: { sd: SubDoc; index: number }) {
  const [open, setOpen] = useState(false);
  const c = sd.content;
  const pct = Math.round((sd.confidence_score ?? 0) * 100);

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div
        className="p-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: open
            ? "linear-gradient(135deg,#F0FDF4,#F0F9FF)"
            : "linear-gradient(135deg,#F8FAFC,#F1F5F9)",
        }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
          style={{ background: "linear-gradient(135deg,#2563EB,#06B6D4)" }}
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h5 className="text-sm font-bold text-slate-800">{sd.title}</h5>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${docTypeColor(sd.document_type)}`}
            >
              <Tag size={9} /> {sd.document_type}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>
              Pages {sd.start_page}–{sd.end_page}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <BarChart2 size={10} /> {pct}% confidence
            </span>
            {c?.key_persons?.length ? (
              <span>
                · {c.key_persons.length} person
                {c.key_persons.length !== 1 ? "s" : ""}
              </span>
            ) : null}
            {c?.key_findings?.length ? (
              <span>
                · {c.key_findings.length} finding
                {c.key_findings.length !== 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
        </div>
        <ChevronRight
          size={14}
          className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      </div>

      {/* Summary always visible */}
      {c?.summary && (
        <div className="px-4 py-2.5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/60">
          {c.summary}
        </div>
      )}

      {/* Expanded */}
      {open && c && (
        <div className="border-t border-slate-100 px-4 pb-5 pt-3 space-y-4">
          {c.subject && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                Subject
              </div>
              <p className="text-xs text-slate-700">{c.subject}</p>
            </div>
          )}
          {c.purpose && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                Purpose
              </div>
              <p className="text-xs text-slate-700">{c.purpose}</p>
            </div>
          )}
          {c.key_findings?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Search size={10} /> Key Findings
              </div>
              <ul className="space-y-1.5">
                {c.key_findings.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-slate-700"
                  >
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {c.key_actions?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Zap size={10} /> Key Actions
              </div>
              <Pill
                items={c.key_actions}
                color="bg-amber-50 text-amber-700 border border-amber-100"
              />
            </div>
          )}
          {c.key_persons?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Users size={10} /> People
              </div>
              <Pill
                items={c.key_persons}
                color="bg-purple-50 text-purple-700 border border-purple-100"
              />
            </div>
          )}
          {c.organizations?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Shield size={10} /> Organizations
              </div>
              <Pill
                items={c.organizations}
                color="bg-indigo-50 text-indigo-700 border border-indigo-100"
              />
            </div>
          )}
          {c.key_dates?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Calendar size={10} /> Important Dates
              </div>
              <Pill
                items={c.key_dates}
                color="bg-green-50 text-green-700 border border-green-100"
              />
            </div>
          )}
          {c.main_content && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <BookOpen size={10} /> Main Content
              </div>
              <div
                className="rounded-lg p-3 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap"
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  maxHeight: 320,
                  overflowY: "auto",
                }}
              >
                {c.main_content}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Document card ─────────────────────────────────────────────────────────────

function DocCard({ doc }: { doc: CaseDocument }) {
  const [open, setOpen] = useState(true);
  const st = statusConfig(doc.status);

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-sm"
      style={{ border: "1px solid #E2E8F0" }}
    >
      {/* Doc header */}
      <div
        className="p-5 flex items-start gap-4 cursor-pointer"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: "linear-gradient(135deg,#0F172A,#1E3A5F)",
          borderBottom: open ? "1px solid rgba(6,182,212,0.2)" : "none",
        }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "rgba(6,182,212,0.15)",
            border: "1px solid rgba(6,182,212,0.25)",
          }}
        >
          <FileText size={20} className="text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className="text-white font-bold text-sm truncate">
              {doc.original_name || doc.file_name}
            </h4>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.bg} ${st.text}`}
            >
              {st.icon} {st.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Hash size={10} /> Doc ID: {doc.document_id}
            </span>
            <span className="flex items-center gap-1">
              <BookOpen size={10} /> {doc.total_pages} pages
            </span>
            <span className="flex items-center gap-1">
              <Layers size={10} /> {doc.subdocument_count} sub-docs
            </span>
            <span className="flex items-center gap-1">
              <Clock size={10} /> {fmtDate(doc.created_at)}
            </span>
          </div>
          {doc.status === "failed" && doc.error_message && (
            <div className="mt-2 text-xs text-red-400 flex items-center gap-1">
              <AlertCircle size={10} /> {doc.error_message}
            </div>
          )}
          {doc.status === "processing" && doc.current_stage && (
            <div className="mt-2 text-xs text-cyan-400 flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" />{" "}
              {doc.current_stage.replace(/_/g, " ")}
            </div>
          )}
        </div>
        <ChevronRight
          size={16}
          className={`text-slate-400 flex-shrink-0 mt-1 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      </div>

      {/* Sub-documents */}
      {open && (
        <div className="p-4 space-y-3 bg-slate-50">
          {doc.subdocuments.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm flex flex-col items-center gap-2">
              <FileWarning size={28} className="text-slate-300" />
              {doc.status === "completed"
                ? "No sub-documents extracted"
                : "Sub-documents will appear after processing completes"}
            </div>
          ) : (
            doc.subdocuments.map((sd, i) => (
              <SubDocCard key={sd.id} sd={sd} index={i} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Media record card ─────────────────────────────────────────────────────────

function formatTime(v?: number | null) {
  if (typeof v !== "number") return "00:00";
  const m = Math.floor(v / 60).toString().padStart(2, "0");
  const s = Math.floor(v % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function MediaRecordCard({ rec, index }: { rec: MediaRecord; index: number }) {
  const [open, setOpen] = useState(false);
  const isTranslate = rec.task === "translate";

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div
        className="p-4 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
        style={{
          background: open
            ? "linear-gradient(135deg,#F0F9FF,#EFF6FF)"
            : "linear-gradient(135deg,#F8FAFC,#F1F5F9)",
        }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-bold flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#7C3AED,#2563EB)" }}
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h5 className="text-sm font-bold text-slate-800 truncate">
              {rec.audioDescription || rec.fileName || "Untitled recording"}
            </h5>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700 flex-shrink-0">
              <Radio size={9} /> {isTranslate ? "Translated" : "Transcribed"}
            </span>
            {rec.diarization && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 flex-shrink-0">
                <Users size={9} /> {rec.speakerCount} speaker{rec.speakerCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            {rec.languageName && <span>{rec.languageName}</span>}
            {isTranslate && rec.targetLanguageName && (
              <><span>·</span><span>→ {rec.targetLanguageName}</span></>
            )}
            {rec.fileName && rec.audioDescription && (
              <><span>·</span><span className="truncate max-w-[180px]">{rec.fileName}</span></>
            )}
            {rec.processingTime != null && (
              <><span>·</span><span>{rec.processingTime.toFixed(1)}s</span></>
            )}
            {rec.createdAt && (
              <><span>·</span><span>{fmtDate(rec.createdAt)}</span></>
            )}
          </div>
        </div>
        <ChevronRight
          size={14}
          className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      </div>

      {/* Text preview always visible */}
      {rec.text && (
        <div className="px-4 py-2.5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/60 line-clamp-2">
          {rec.text}
        </div>
      )}

      {/* Expanded */}
      {open && (
        <div className="border-t border-slate-100 px-4 pb-5 pt-3 space-y-4">
          {/* Full transcript */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
              <ScrollText size={10} /> Full Transcript
            </div>
            <div
              className="rounded-lg p-3 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap"
              style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", maxHeight: 240, overflowY: "auto" }}
            >
              {rec.text || "—"}
            </div>
          </div>

          {/* Segments */}
          {rec.segments.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Users size={10} /> Speaker Segments ({rec.segments.length})
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {rec.segments.map((seg, i) => (
                  <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      {seg.speaker && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
                          {seg.speaker}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {formatTime(seg.start)} – {formatTime(seg.end)}
                      </span>
                    </div>
                    {seg.original_text && (
                      <p className="text-xs text-slate-400 italic mb-0.5">{seg.original_text}</p>
                    )}
                    <p className="text-xs text-slate-700 leading-relaxed">{seg.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Draft section groups (mirrors backend SECTION_GROUPS order) ───────────────
const DRAFT_SECTIONS = [
  { num: "1",  label: "Introduction" },
  { num: "2",  label: "Service Particulars of Accused Officer" },
  { num: "3",  label: "Allegation in Brief" },
  { num: "4",  label: "Complaint" },
  { num: "5",  label: "Registration of FIR" },
  { num: "6",  label: "Pre-Trap Proceedings" },
  { num: "7",  label: "Post-Trap Proceedings" },
  { num: "8",  label: "Oral Evidence" },
  { num: "9",  label: "Documentary Evidence" },
  { num: "10", label: "Analysis of Evidence" },
  { num: "11", label: "Findings of Investigation" },
  { num: "12", label: "Abstract of Findings & Recommendations" },
  { num: "13", label: "Request for Prosecution Sanction" },
  { num: "14", label: "Call Data Records" },
  { num: "15", label: "Legal Precedents" },
];

function DraftProgressPanel({ current, total }: { current: number; total: number }) {
  return (
    <div className="mt-4 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(6,182,212,0.2)", background: "linear-gradient(135deg,#0F172A,#1E293B)" }}>
      <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ borderColor: "rgba(6,182,212,0.15)" }}>
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-cyan-400 text-sm font-bold">Generating Draft Report</span>
        <span className="ml-auto text-slate-500 text-xs font-mono">{current}/{total} sections</span>
      </div>
      <div className="p-3 grid grid-cols-1 gap-1.5">
        {DRAFT_SECTIONS.map((sec, idx) => {
          const groupIdx = idx + 1;
          const isCompleted = groupIdx < current;
          const isActive    = groupIdx === current;
          const isPending   = groupIdx > current;
          return (
            <div
              key={sec.num}
              className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all"
              style={{
                background: isActive
                  ? "linear-gradient(135deg,rgba(37,99,235,0.25),rgba(6,182,212,0.15))"
                  : isCompleted
                  ? "rgba(16,185,129,0.08)"
                  : "rgba(255,255,255,0.02)",
                border: isActive
                  ? "1px solid rgba(6,182,212,0.4)"
                  : isCompleted
                  ? "1px solid rgba(16,185,129,0.2)"
                  : "1px solid rgba(255,255,255,0.04)",
                opacity: isPending ? 0.45 : 1,
              }}
            >
              {/* Status icon */}
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: isActive
                    ? "rgba(6,182,212,0.2)"
                    : isCompleted
                    ? "rgba(16,185,129,0.15)"
                    : "rgba(255,255,255,0.05)",
                }}
              >
                {isCompleted && <CheckCircle2 size={14} className="text-emerald-400" />}
                {isActive    && <Loader2 size={14} className="text-cyan-400 animate-spin" />}
                {isPending   && <span className="text-slate-600 text-xs font-bold">{sec.num}</span>}
              </div>
              {/* Label */}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${isCompleted ? "text-emerald-400" : isActive ? "text-cyan-300" : "text-slate-500"}`}>
                  {sec.label}
                </div>
              </div>
              {/* Right status tag */}
              {isActive && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(6,182,212,0.15)", color: "#22D3EE" }}>
                  Processing
                </span>
              )}
              {isCompleted && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.15)", color: "#34D399" }}>
                  Done
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ViewReportsPage() {
  const [cases, setCases] = useState<AllCaseItem[]>([]);
  const [caseStats, setCaseStats] = useState<Record<string, CaseSummary>>({});
  const [selectedCase, setSelectedCase] = useState<string>("");
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [casesLoading, setCasesLoading] = useState(true);
  const [error, setError] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draft, setDraft] = useState<DraftReport | null>(null);
  const [draftProgress, setDraftProgress] = useState<{
    current: number;
    total: number;
    sections: string[];
  } | null>(null);
  const [savedDraftExists, setSavedDraftExists] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState("");
  const [mediaRecords, setMediaRecords] = useState<MediaRecord[]>([]);
  const [mediaRecordsLoading, setMediaRecordsLoading] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(true);

  // Load case list on mount — all cases from SQLite + doc stats from pdf/cases
  useEffect(() => {
    Promise.all([
      fetch("/api/cases").then((r) => r.json()),
      fetch(`${BACKEND_URL}/pdf/cases`).then((r) => r.json()).catch(() => ({ cases: [] })),
    ])
      .then(([allCases, pdfData]) => {
        setCases(Array.isArray(allCases) ? allCases : []);
        const statsMap: Record<string, CaseSummary> = {};
        for (const s of (pdfData.cases || [])) statsMap[s.case_id] = s;
        setCaseStats(statsMap);
      })
      .catch(() => setError("Failed to load cases"))
      .finally(() => setCasesLoading(false));
  }, []);

  function selectCase(cid: string) {
    setSelectedCase(cid);
    setCaseDetail(null);
    setError("");
    setSavedDraftExists(false);
    setMediaRecords([]);
    setLoading(true);
    fetch(`${BACKEND_URL}/pdf/case/${cid}`)
      .then((r) => r.json())
      .then((d) => setCaseDetail(d))
      .catch(() => setError("Failed to load case details"))
      .finally(() => setLoading(false));
    // Check if saved draft exists
    fetch(`http://localhost:8000/pdf/saved-draft/${cid}`, { cache: "no-store" })
      .then((r) => { if (r.ok) setSavedDraftExists(true); })
      .catch(() => {});
    // Load media records
    setMediaRecordsLoading(true);
    fetch(`${BACKEND_URL}/media-records?case_id=${encodeURIComponent(cid)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMediaRecords(Array.isArray(d) ? d : []))
      .catch(() => setMediaRecords([]))
      .finally(() => setMediaRecordsLoading(false));
  }

  async function viewSavedDraft() {
    if (!selectedCase) return;
    try {
      const res = await fetch(
        `http://localhost:8000/pdf/saved-draft/${selectedCase}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Not found");
      const data: DraftReport = await res.json();
      setDraft(data);
    } catch {
      setError("Failed to load saved draft");
    }
  }

  function refresh() {
    if (selectedCase) selectCase(selectedCase);
  }

  function refreshMedia() {
    if (!selectedCase) return;
    setMediaRecordsLoading(true);
    fetch(`${BACKEND_URL}/media-records?case_id=${encodeURIComponent(selectedCase)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setMediaRecords(Array.isArray(d) ? d : []))
      .catch(() => setMediaRecords([]))
      .finally(() => setMediaRecordsLoading(false));
  }

  async function reindexCase() {
    if (!selectedCase || reindexing) return;
    setReindexing(true);
    setReindexMsg("");
    try {
      const res = await fetch(`${BACKEND_URL}/pdf/reindex/${selectedCase}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Reindex failed");
      setReindexMsg(`✓ ${data.embeddings_stored} embeddings stored`);
    } catch (e) {
      setReindexMsg(`✗ ${e instanceof Error ? e.message : "Reindex failed"}`);
    } finally {
      setReindexing(false);
    }
  }

  async function generateDraft() {
    if (!selectedCase || draftLoading) return;
    setDraftLoading(true);
    setDraftProgress(null);

    // Poll progress every 2s while generating
    const pollInterval = setInterval(async () => {
      try {
        const p = await fetch(
          `http://localhost:8000/pdf/draft-progress/${selectedCase}`,
        ).then((r) => r.json());
        if (p && p.total) setDraftProgress(p);
      } catch {
        /* ignore */
      }
    }, 2000);

    try {
      const res = await fetch(
        `http://localhost:8000/pdf/generate-draft/${selectedCase}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Failed to generate draft");
      const data: DraftReport = await res.json();
      setDraft(data);
    } catch {
      setError("Failed to generate draft report");
    } finally {
      clearInterval(pollInterval);
      setDraftLoading(false);
      setDraftProgress(null);
    }
  }

  const selected = cases.find((c) => c.id === selectedCase);
  const selectedStats = selectedCase ? caseStats[selectedCase] : undefined;

  function downloadReport() {
    if (!caseDetail) return;
    const lines: string[] = [
      `ACB INVESTIGATION REPORT`,
      `Case ID: ${caseDetail.case_id}`,
      `Generated: ${new Date().toLocaleString("en-IN")}`,
      `Documents: ${caseDetail.document_count} | Sub-documents: ${caseDetail.total_subdocuments}`,
      "═".repeat(70),
    ];
    for (const doc of caseDetail.documents) {
      lines.push(`\nDOCUMENT: ${doc.original_name || doc.file_name}`);
      lines.push(
        `Status: ${doc.status} | Pages: ${doc.total_pages} | Sub-docs: ${doc.subdocument_count}`,
      );
      lines.push("─".repeat(70));
      for (let i = 0; i < doc.subdocuments.length; i++) {
        const sd = doc.subdocuments[i];
        const c = sd.content;
        lines.push(`\n[${i + 1}] ${sd.title}`);
        lines.push(
          `Type: ${sd.document_type} | Pages ${sd.start_page}–${sd.end_page} | Confidence: ${Math.round(sd.confidence_score * 100)}%`,
        );
        if (c?.subject) lines.push(`Subject: ${c.subject}`);
        if (c?.purpose) lines.push(`Purpose: ${c.purpose}`);
        if (c?.summary) lines.push(`\nSummary:\n${c.summary}`);
        if (c?.key_findings?.length)
          lines.push(
            `\nKey Findings:\n${c.key_findings.map((f: string) => `• ${f}`).join("\n")}`,
          );
        if (c?.key_actions?.length)
          lines.push(
            `Key Actions:\n${c.key_actions.map((a: string) => `• ${a}`).join("\n")}`,
          );
        if (c?.key_persons?.length)
          lines.push(`People: ${c.key_persons.join(", ")}`);
        if (c?.organizations?.length)
          lines.push(`Organizations: ${c.organizations.join(", ")}`);
        if (c?.key_dates?.length)
          lines.push(`Dates: ${c.key_dates.join(", ")}`);
        if (c?.main_content) lines.push(`\nContent:\n${c.main_content}`);
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ACB_Report_${caseDetail.case_id}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav
        title="Case Reports"
        subtitle="Select a case to review all uploaded documents and extracted sub-documents"
      />

      <div className="p-6 animate-fade-in">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* ── Case Selector ── */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "linear-gradient(135deg,#0F172A,#1E3A5F,#0E4D6C)",
              border: "1px solid rgba(6,182,212,0.2)",
            }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "rgba(6,182,212,0.2)",
                  border: "1px solid rgba(6,182,212,0.3)",
                }}
              >
                <FolderSearch size={22} className="text-cyan-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">
                  Select Investigation Case
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  Choose a case to view all documents and AI-extracted
                  sub-documents
                </p>
              </div>
            </div>

            {/* Searchable case dropdown */}
            {casesLoading ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm px-1">
                <Loader2 size={15} className="animate-spin text-cyan-400" /> Loading cases…
              </div>
            ) : (
              <CaseSearchSelect
                cases={cases}
                value={selectedCase}
                onChange={(id) => { if (id) selectCase(id); else { setSelectedCase(""); } }}
                placeholder="— Select a case —"
                dark
              />
            )}

            {/* Case stat strip */}
            {selected && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "Documents",
                    value: selectedStats?.document_count ?? "—",
                    color: "text-cyan-400",
                  },
                  {
                    label: "Completed",
                    value: selectedStats?.completed_count ?? "—",
                    color: "text-green-400",
                  },
                  {
                    label: "Total Pages",
                    value: selectedStats?.total_pages ?? "—",
                    color: "text-blue-400",
                  },
                  {
                    label: "Sub-docs",
                    value: caseDetail?.total_subdocuments ?? "—",
                    color: "text-purple-400",
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl px-4 py-3 text-center"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className={`text-2xl font-bold ${s.color}`}>
                      {s.value}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Loading ── */}
          {loading && (
            <div className="content-card p-12 flex flex-col items-center justify-center gap-4">
              <Loader2 size={36} className="text-cyan-400 animate-spin" />
              <div className="text-slate-500 text-sm font-semibold">
                Loading case data…
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {error && !loading && (
            <div className="content-card p-8 flex flex-col items-center gap-3 text-center">
              <AlertCircle size={32} className="text-red-400" />
              <div className="text-slate-700 font-semibold">{error}</div>
            </div>
          )}

          {/* ── Case detail ── */}
          {caseDetail && !loading && (
            <div className="space-y-4">
              {/* Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Layers size={16} className="text-cyan-500" />
                  {caseDetail.document_count} Document
                  {caseDetail.document_count !== 1 ? "s" : ""}
                  <span className="text-slate-400 font-normal text-sm">
                    · {caseDetail.total_subdocuments} sub-document
                    {caseDetail.total_subdocuments !== 1 ? "s" : ""}
                  </span>
                </h3>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={refresh}
                    className="btn-secondary text-xs py-2 px-3"
                  >
                    <RefreshCw size={13} /> Refresh
                  </button>
                  {caseDetail.total_subdocuments > 0 && (
                    <button
                      onClick={downloadReport}
                      className="btn-secondary text-xs py-2 px-3 text-cyan-600 border-cyan-200 hover:bg-cyan-50"
                    >
                      <Download size={13} /> Download Raw
                    </button>
                  )}
                  {/* Reindex button */}
                  <div className="flex flex-col items-end gap-0.5">
                    <button
                      onClick={reindexCase}
                      disabled={reindexing}
                      title="Re-generate Qdrant vector embeddings from existing DB content"
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    >
                      {reindexing ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <DatabaseZap size={13} />
                      )}
                      {reindexing ? "Indexing…" : "Reindex Embeddings"}
                    </button>
                    {reindexMsg && (
                      <span
                        className={`text-xs font-mono ${reindexMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}
                      >
                        {reindexMsg}
                      </span>
                    )}
                  </div>

                  {/* View saved draft button */}
                  {savedDraftExists && (
                    <button
                      onClick={viewSavedDraft}
                      className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: "linear-gradient(135deg,#065F46,#059669)",
                        color: "white",
                        border: "1px solid rgba(16,185,129,0.4)",
                      }}
                    >
                      <ScrollText size={14} /> View Draft Report
                    </button>
                  )}

                  {/* Generate Draft Report button */}
                  <button
                    onClick={generateDraft}
                    disabled={draftLoading}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: draftLoading
                        ? "linear-gradient(135deg,#64748B,#475569)"
                        : "linear-gradient(135deg,#2563EB,#06B6D4)",
                      color: "white",
                      boxShadow: draftLoading
                        ? "none"
                        : "0 0 20px rgba(6,182,212,0.4), 0 4px 12px rgba(37,99,235,0.3)",
                      border: "1px solid rgba(6,182,212,0.4)",
                    }}
                  >
                    {draftLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {draftProgress ? "Generating…" : "Starting…"}
                      </>
                    ) : (
                      <>
                        <ScrollText size={14} />
                        <Sparkles size={12} /> Generate Draft Report
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Draft generation progress panel */}
              {draftLoading && (
                <DraftProgressPanel
                  current={draftProgress?.current ?? 0}
                  total={draftProgress?.total ?? DRAFT_SECTIONS.length}
                />
              )}

              {/* Document cards */}
              {caseDetail.documents.map((doc) => (
                <DocCard key={doc.document_id} doc={doc} />
              ))}

              {/* ── Media Records panel ── */}
              <div
                className="rounded-2xl overflow-hidden shadow-sm"
                style={{ border: "1px solid #E2E8F0" }}
              >
                {/* Panel header */}
                <div
                  className="p-5 flex items-center gap-4 cursor-pointer"
                  onClick={() => setMediaOpen((o) => !o)}
                  style={{
                    background: "linear-gradient(135deg,#2E1065,#1E1B4B)",
                    borderBottom: mediaOpen ? "1px solid rgba(139,92,246,0.2)" : "none",
                  }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "rgba(139,92,246,0.15)",
                      border: "1px solid rgba(139,92,246,0.25)",
                    }}
                  >
                    <Mic size={20} className="text-violet-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-bold text-sm">Media Records</h4>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: "rgba(139,92,246,0.2)", color: "#A78BFA" }}
                      >
                        {mediaRecordsLoading ? "…" : mediaRecords.length}
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Speech transcriptions and diarization records saved to this case
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); refreshMedia(); }}
                    className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-200"
                    title="Refresh media records"
                  >
                    <RefreshCw size={13} />
                  </button>
                  <ChevronRight
                    size={16}
                    className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${mediaOpen ? "rotate-90" : ""}`}
                  />
                </div>

                {/* Panel body */}
                {mediaOpen && (
                  <div className="p-4 space-y-3 bg-slate-50">
                    {mediaRecordsLoading ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-slate-400 text-sm">
                        <Loader2 size={18} className="animate-spin text-violet-400" />
                        Loading media records…
                      </div>
                    ) : mediaRecords.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-sm flex flex-col items-center gap-2">
                        <Mic size={28} className="text-slate-300" />
                        No media records saved for this case yet
                      </div>
                    ) : (
                      mediaRecords.map((rec, i) => (
                        <MediaRecordCard key={rec.id} rec={rec} index={i} />
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Empty state ── */}
          {!selectedCase && !casesLoading && (
            <div className="content-card p-16 flex flex-col items-center justify-center text-center">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
                style={{
                  background:
                    "linear-gradient(135deg,rgba(6,182,212,0.08),rgba(37,99,235,0.08))",
                  border: "1px solid rgba(6,182,212,0.12)",
                }}
              >
                <FolderSearch size={36} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-400 mb-2">
                Select a Case
              </h3>
              <p className="text-sm text-slate-400 max-w-xs">
                Choose a case from the dropdown above to view all uploaded
                documents and AI-extracted sub-documents with full content.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Draft report modal */}
      {draft && (
        <DraftReportModal draft={draft} onClose={() => setDraft(null)} />
      )}
    </div>
  );
}
