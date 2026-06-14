"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import {
  X, Download, Bold, Italic, Undo, Redo,
  FileText, AlertTriangle, Mic, ClipboardPaste,
  Loader2, Radio, Users, Save,
} from "lucide-react";
import { BACKEND_URL } from "@/lib/config";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DraftSubSection {
  number: string;
  heading: string;
  content: string;
}

interface DraftSection {
  number: string;
  heading: string;
  subsections: DraftSubSection[];
}

export interface DraftReport {
  case_id: string;
  office?: string;
  case_name?: string;
  date?: string;
  doc_title?: string;
  sub?: string;
  title?: string;
  case_number: string;
  header?: { from: string; to: string };
  sections: DraftSection[];
  html_content?: string;  // persisted editor HTML — takes priority over regenerating from sections
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
  speakerCount: number;
  diarization: boolean;
  processingTime: number | null;
  createdAt: string | null;
}

interface Props {
  draft: DraftReport;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(v?: number | null) {
  if (typeof v !== "number") return "00:00";
  const m = Math.floor(v / 60).toString().padStart(2, "0");
  const s = Math.floor(v % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// Build HTML table from media record segments for TipTap insertion
function buildTableHtml(rec: MediaRecord): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const title = rec.audioDescription || rec.fileName || "Media Record";
  const lang = rec.languageName || rec.language || "";
  const isTranslate = rec.task === "translate";

  let html = "";

  // Header paragraph
  html += `<p><strong>${esc(title)}</strong>`;
  if (lang) html += ` &nbsp;|&nbsp; ${esc(lang)}`;
  if (isTranslate && rec.targetLanguageName) html += ` → ${esc(rec.targetLanguageName)}`;
  if (rec.diarization) html += ` &nbsp;|&nbsp; ${rec.speakerCount} speaker${rec.speakerCount !== 1 ? "s" : ""}`;
  if (rec.createdAt) html += ` &nbsp;|&nbsp; ${esc(fmtDate(rec.createdAt))}`;
  html += `</p>`;

  if (rec.segments.length > 0) {
    // Speaker segment table
    html += `<table>`;
    html += `<tbody>`;
    html += `<tr><th><strong>Speaker</strong></th><th><strong>Time</strong></th><th><strong>Transcript</strong></th></tr>`;
    for (const seg of rec.segments) {
      const speaker = esc(seg.speaker || "—");
      const time = `${fmtTime(seg.start)} – ${fmtTime(seg.end)}`;
      const text = esc(seg.text || "");
      const origText = seg.original_text ? `<br/><em>${esc(seg.original_text)}</em>` : "";
      html += `<tr><td>${speaker}</td><td>${time}</td><td>${text}${origText}</td></tr>`;
    }
    html += `</tbody></table>`;
  } else if (rec.text) {
    // No segments — just the full transcript text
    html += `<table><tbody>`;
    html += `<tr><th><strong>Transcript</strong></th></tr>`;
    for (const line of rec.text.split("\n")) {
      if (line.trim()) html += `<tr><td>${esc(line)}</td></tr>`;
    }
    html += `</tbody></table>`;
  }

  html += `<p></p>`;
  return html;
}

// ── Draft → HTML ──────────────────────────────────────────────────────────────

function draftToHtml(draft: DraftReport): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const contentHtml = (raw: string, heading?: string) => {
    if (!raw) return `<p><strong style="color:#000000">[TO BE FILLED${heading ? ` — ${esc(heading)}` : ""}]</strong></p>`;
    return raw
      .split("\n")
      .map(line => {
        const escaped = esc(line);
        if (line.trim() === "TO DO" || line.trim() === "[TO BE FILLED]" || line.trim().startsWith("[NOT IN SOURCE")) {
          const label = line.trim().startsWith("[NOT IN SOURCE") ? "NOT IN SOURCE" : "TO BE FILLED";
          return `<p><strong style="color:#000000">[${label}${heading ? ` — ${esc(heading)}` : ""}]</strong></p>`;
        }
        return `<p>${escaped || "&nbsp;"}</p>`;
      })
      .join("");
  };

  let html = "";

  if (draft.office) {
    html += `<p style="text-align:right;line-height:1.8">${esc(draft.office).replace(/\n/g, "<br/>")}</p>`;
  }

  html += `<table width="100%" style="margin:1rem 0"><tr>`;
  html += `<td style="text-align:left"><strong>${esc(draft.case_name || draft.case_id)}</strong></td>`;
  html += `<td style="text-align:right"><strong>${esc(draft.date || "")}</strong></td>`;
  html += `</tr></table>`;

  html += `<h1 style="text-align:center;text-decoration:underline;font-weight:bold">${esc(draft.doc_title || "CIRCULAR MEMORANDUM")}</h1>`;

  if (draft.sub) {
    html += `<p style="margin:0.8rem 0">${esc(draft.sub).replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")}</p>`;
  }

  html += `<hr/>`;

  for (const section of draft.sections) {
    html += `<h2>${esc(section.heading)}</h2>`;
    for (const sub of section.subsections) {
      html += contentHtml(sub.content, sub.heading);
    }
  }

  html += `<hr/>`;
  html += `<p>Director General,<br/>Anti-Corruption Bureau,<br/>TG, Hyderabad</p>`;
  html += `<br/>`;
  html += `<p><strong>To</strong><br/>All the Dy. Superintendents of Police, ACB, Telangana.<br/>AO (SB), MSB (SB), SB Managers &amp; all the S.B. Assistants.</p>`;
  html += `<br/>`;
  html += `<p><strong>Copy to:</strong><br/>The LA and Prl. CLA, ACB, TG, Hyderabad.<br/>Copy to all the Joint Directors/Deputy Directors, ACB, TG, Hyderabad.<br/>Copy to the Peshis of the Director General and the Director, ACB, TG, Hyd.</p>`;

  return html;
}

// ── DOCX export ───────────────────────────────────────────────────────────────

async function exportDocx(draft: DraftReport) {
  const { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType } = await import("docx");
  const fileSaver = await import("file-saver");
  const saveAs = fileSaver.saveAs || (fileSaver as any).default?.saveAs || (fileSaver as any).default;

  const children: InstanceType<typeof Paragraph>[] = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "Office of the Director General,", size: 20, font: "Trebuchet MS" })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "Anti-Corruption Bureau, TG, Hyderabad.", size: 20, font: "Trebuchet MS" })],
    }),
    new Paragraph({ text: "" }),
  );

  children.push(
    new Paragraph({
      text: draft.title || "GOVERNMENT OF TELANGANA ANTI-CORRUPTION BUREAU",
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Case No.: ${draft.case_id}`, bold: true, size: 24 })],
    }),
    new Paragraph({ text: "" }),
  );

  for (const section of draft.sections) {
    children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1 }));
    for (const sub of section.subsections) {
      const raw = sub.content || "";
      const isTodo = !raw || raw.trim() === "TO DO" || raw.trim() === "[TO BE FILLED]" || raw.trim().startsWith("[NOT IN SOURCE") || raw.trim().startsWith("[TO BE FILLED");
      if (isTodo) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `[TO BE FILLED — ${sub.heading}]`, color: "000000", bold: true, size: 22 })],
        }));
      } else {
        for (const line of raw.split("\n")) {
          children.push(new Paragraph({ children: [new TextRun({ text: line || " ", size: 22 })] }));
        }
      }
      children.push(new Paragraph({ text: "" }));
    }
  }

  children.push(new Paragraph({ text: "" }));
  children.push(new Paragraph({ children: [new TextRun({ text: "─".repeat(60) })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: "Director General,", size: 22 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: "Anti-Corruption Bureau,", size: 22 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: "TG, Hyderabad", size: 22 })] }));
  children.push(new Paragraph({ text: "" }));
  children.push(new Paragraph({ children: [new TextRun({ text: "To", bold: true, size: 22 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: "All the Dy. Superintendents of Police, ACB, Telangana.", size: 22 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: "AO (SB), MSB (SB), SB Managers & all the S.B. Assistants.", size: 22 })] }));
  children.push(new Paragraph({ text: "" }));
  children.push(new Paragraph({ children: [new TextRun({ text: "Copy to:", bold: true, size: 22 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: "The LA and Prl. CLA, ACB, TG, Hyderabad.", size: 22 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: "Copy to all the Joint Directors/Deputy Directors, ACB, TG, Hyderabad.", size: 22 })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: "Copy to the Peshis of the Director General and the Director, ACB, TG, Hyd.", size: 22 })] }));

  const doc = new Document({
    styles: { default: { document: { run: { font: "Trebuchet MS" } } } },
    sections: [{ properties: {}, children }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `ACB_Draft_Report_${draft.case_id}.docx`);
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  const btn = (active: boolean, onClick: () => void, icon: React.ReactNode, title: string) => (
    <button
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded transition-colors ${active ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"}`}
    >
      {icon}
    </button>
  );
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-700">
      {btn(editor.isActive("bold"),   () => editor.chain().focus().toggleBold().run(),   <Bold size={14} />,   "Bold")}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <Italic size={14} />, "Italic")}
      <div className="w-px h-4 bg-slate-600 mx-1" />
      {btn(false, () => editor.chain().focus().undo().run(), <Undo size={14} />, "Undo")}
      {btn(false, () => editor.chain().focus().redo().run(), <Redo size={14} />, "Redo")}
      <div className="ml-auto flex items-center gap-1.5 text-xs text-amber-400">
        <AlertTriangle size={12} />
        <span>Fill all [TO BE FILLED] fields before submitting</span>
      </div>
    </div>
  );
}

// ── Media record side panel ───────────────────────────────────────────────────

function MediaPanel({
  caseId,
  onInsert,
}: {
  caseId: string;
  onInsert: (rec: MediaRecord) => void;
}) {
  const [records, setRecords] = useState<MediaRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/media-records?case_id=${encodeURIComponent(caseId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRecords(Array.isArray(d) ? d : []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [caseId]);

  return (
    <div className="flex flex-col h-full" style={{ background: "#0F172A", borderLeft: "1px solid rgba(139,92,246,0.2)" }}>
      {/* Panel header */}
      <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(139,92,246,0.15)", background: "linear-gradient(135deg,#1E1B4B,#0F172A)" }}>
        <Mic size={15} className="text-violet-400 flex-shrink-0" />
        <span className="text-white font-bold text-sm">Media Records</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: "rgba(139,92,246,0.2)", color: "#A78BFA" }}>
          {loading ? "…" : records.length}
        </span>
      </div>

      {/* Panel hint */}
      <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <ClipboardPaste size={10} className="text-slate-600" />
          Click insert to paste at cursor
        </p>
      </div>

      {/* Records list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-slate-500 text-xs">
            <Loader2 size={14} className="animate-spin text-violet-400" /> Loading…
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-600 text-xs text-center">
            <Mic size={24} className="text-slate-700" />
            No media records for this case
          </div>
        ) : (
          records.map((rec) => {
            const isOpen = expanded === rec.id;
            const title = rec.audioDescription || rec.fileName || "Untitled";
            const isTranslate = rec.task === "translate";

            return (
              <div key={rec.id} className="rounded-xl overflow-hidden"
                style={{ border: "1px solid rgba(139,92,246,0.15)", background: "rgba(255,255,255,0.03)" }}>
                {/* Record header */}
                <div className="p-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-200 truncate mb-1">{title}</div>
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {rec.languageName && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-900/40 text-violet-300">
                            {rec.languageName}
                          </span>
                        )}
                        {isTranslate && rec.targetLanguageName && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-900/40 text-blue-300">
                            → {rec.targetLanguageName}
                          </span>
                        )}
                        {rec.diarization && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-300 flex items-center gap-0.5">
                            <Users size={8} /> {rec.speakerCount}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600">{fmtDate(rec.createdAt)}</div>
                    </div>
                    {/* Insert button */}
                    <button
                      onClick={() => onInsert(rec)}
                      title="Insert as table at cursor"
                      className="flex-shrink-0 p-2 rounded-lg transition-colors text-violet-400 hover:text-white hover:bg-violet-600"
                    >
                      <ClipboardPaste size={14} />
                    </button>
                  </div>

                  {/* Toggle transcript preview */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : rec.id)}
                    className="mt-2 text-xs text-slate-600 hover:text-slate-400 transition-colors flex items-center gap-1"
                  >
                    <Radio size={9} />
                    {isOpen ? "Hide" : "Preview"} transcript
                  </button>
                </div>

                {/* Transcript preview */}
                {isOpen && (
                  <div className="border-t px-3 pb-3 pt-2"
                    style={{ borderColor: "rgba(139,92,246,0.1)", background: "rgba(0,0,0,0.2)" }}>
                    {rec.segments.length > 0 ? (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {rec.segments.map((seg, i) => (
                          <div key={i} className="text-xs">
                            <span className="font-semibold text-violet-400">{seg.speaker || "—"}</span>
                            <span className="text-slate-600 mx-1">{fmtTime(seg.start)}–{fmtTime(seg.end)}</span>
                            <span className="text-slate-300">{seg.text}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-6">{rec.text || "—"}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function DraftReportModal({ draft, onClose }: Props) {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: draft.html_content || draftToHtml(draft),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none p-6 min-h-full",
        style: "font-family: 'Trebuchet MS', sans-serif; font-size: 16px; line-height: 2; color: #000000;",
      },
    },
  });

  // Refs declared before any callbacks that reference them
  const isDirtyRef = useRef(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDraft = useCallback(async (htmlContent: string) => {
    setSaveState('saving');
    try {
      const res = await fetch(`${BACKEND_URL}/pdf/save-draft/${draft.case_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, html_content: htmlContent }),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }, [draft]);

  const handleClose = useCallback(async () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (isDirtyRef.current && editor) {
      isDirtyRef.current = false;
      await saveDraft(editor.getHTML());
    }
    onClose();
  }, [editor, onClose, saveDraft]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  const handleDownload = useCallback(() => { exportDocx(draft); }, [draft]);

  // Debounced auto-save on every editor change (2s idle)
  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => {
      isDirtyRef.current = true;
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        isDirtyRef.current = false;
        saveDraft(editor.getHTML());
      }, 2000);
    };
    editor.on('update', handleUpdate);
    return () => {
      editor.off('update', handleUpdate);
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [editor, saveDraft]);

  const handleInsertMedia = useCallback((rec: MediaRecord) => {
    if (!editor) return;
    const html = buildTableHtml(rec);
    editor.chain().focus().insertContent(html).run();
  }, [editor]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      {/* Save toast */}
      {saveState !== 'idle' && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold transition-all"
          style={{
            background: saveState === 'saved' ? '#065F46' : saveState === 'error' ? '#7F1D1D' : '#1E3A5F',
            border: saveState === 'saved' ? '1px solid #059669' : saveState === 'error' ? '1px solid #DC2626' : '1px solid rgba(6,182,212,0.5)',
            color: 'white',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {saveState === 'saving' && <><Loader2 size={15} className="animate-spin text-cyan-400" /> Saving draft…</>}
          {saveState === 'saved'  && <>✓ Draft saved</>}
          {saveState === 'error'  && <>✗ Save failed — check backend</>}
        </div>
      )}
      <div className="flex flex-col m-4 rounded-2xl overflow-hidden shadow-2xl flex-1"
        style={{ background: "#0F172A", border: "1px solid rgba(6,182,212,0.25)" }}>

        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-4 flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#0F172A,#1E3A5F)", borderBottom: "1px solid rgba(6,182,212,0.2)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)" }}>
            <FileText size={18} className="text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm">Draft Final Report — Case {draft.case_id}</div>
            <div className="text-slate-400 text-xs mt-0.5">Edit fields · Download as DOCX · Insert media records</div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => editor && saveDraft(editor.getHTML())}
              disabled={saveState === 'saving'}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: saveState === 'saved' ? '#065F46' : saveState === 'error' ? '#7F1D1D' : 'rgba(255,255,255,0.08)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {saveState === 'saving' ? <><Loader2 size={14} className="animate-spin" /> Saving…</> :
               saveState === 'saved'  ? <>✓ Saved</> :
               saveState === 'error'  ? <>✗ Retry</> :
               <><Save size={14} /> Save</>}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "linear-gradient(135deg,#2563EB,#06B6D4)", color: "white", boxShadow: "0 0 16px rgba(6,182,212,0.3)" }}
            >
              <Download size={15} /> Download DOCX
            </button>
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex-shrink-0" style={{ background: "#1E293B" }}>
          <Toolbar editor={editor} />
        </div>

        {/* Body: editor + media panel */}
        <div className="flex flex-row flex-1 overflow-hidden">

          {/* Editor */}
          <div className="flex-1 overflow-y-auto" style={{ background: "#FAFAF9" }}>
            <div className="max-w-4xl mx-auto min-h-full shadow-lg" style={{ background: "white" }}>
              <style>{`
                .ProseMirror h1 { font-size: 1.6rem; font-weight: 700; margin: 1.5rem 0 1rem; text-align: center; text-decoration: underline; }
                .ProseMirror h2 { font-size: 1.3rem; font-weight: 700; margin: 1.5rem 0 0.6rem; }
                .ProseMirror p  { margin: 0.4rem 0; text-align: justify; font-size: 16px; line-height: 2; }
                .ProseMirror hr { border-color: #CBD5E1; margin: 1.2rem 0; }
                .ProseMirror table { width: 100%; margin: 1rem 0; border-collapse: collapse; font-size: 14px; }
                .ProseMirror td, .ProseMirror th { border: 1px solid #CBD5E1; padding: 6px 10px; vertical-align: top; line-height: 1.6; }
                .ProseMirror th { background: #F1F5F9; font-weight: 600; }
              `}</style>
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Media records panel */}
          <div className="w-72 flex-shrink-0 overflow-hidden flex flex-col">
            <MediaPanel caseId={draft.case_id} onInsert={handleInsertMedia} />
          </div>
        </div>
      </div>
    </div>
  );
}
