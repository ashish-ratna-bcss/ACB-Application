"use client";

import { useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  X, Download, Bold, Italic, Undo, Redo,
  FileText, AlertTriangle,
} from "lucide-react";

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
  title: string;
  case_number: string;
  sections: DraftSection[];
}

interface Props {
  draft: DraftReport;
  onClose: () => void;
}

// ── Draft → HTML ──────────────────────────────────────────────────────────────

function draftToHtml(draft: DraftReport): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const contentHtml = (raw: string) => {
    if (!raw) return "<p></p>";
    return raw
      .split("\n")
      .map(line => {
        const escaped = esc(line);
        if (line === "TO DO") {
          return `<p><strong style="color:#EF4444">[TO DO]</strong></p>`;
        }
        return `<p>${escaped || "&nbsp;"}</p>`;
      })
      .join("");
  };

  let html = `<h1>FORMAT FOR FINAL REPORT IN TRAP CASES</h1>`;
  html += `<h2>Case No.: ${esc(draft.case_id)}</h2>`;
  html += `<hr/>`;

  for (const section of draft.sections) {
    html += `<h2>${esc(section.number)}. ${esc(section.heading)}</h2>`;
    for (const sub of section.subsections) {
      if (sub.heading) {
        html += `<h3>${esc(sub.number)} ${esc(sub.heading)}</h3>`;
      }
      html += contentHtml(sub.content);
    }
  }

  return html;
}

// ── DOCX export ───────────────────────────────────────────────────────────────

async function exportDocx(draft: DraftReport, editorHtml: string) {
  const { Document, Paragraph, TextRun, HeadingLevel, Packer, AlignmentType, BorderStyle } = await import("docx");
  const { saveAs } = await import("file-saver");

  const children: InstanceType<typeof Paragraph>[] = [];

  // Office header
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "Office of the Director General,", size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "Anti-Corruption Bureau, TG, Hyderabad.", size: 20 })],
    }),
    new Paragraph({ text: "" }),
  );

  // Title
  children.push(
    new Paragraph({
      text: "FORMAT FOR FINAL REPORT IN TRAP CASES",
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
    // Main section heading
    children.push(
      new Paragraph({
        text: `${section.number}. ${section.heading}`,
        heading: HeadingLevel.HEADING_1,
      }),
    );

    for (const sub of section.subsections) {
      // Sub-section heading
      if (sub.heading) {
        children.push(
          new Paragraph({
            text: `${sub.number}  ${sub.heading}`,
            heading: HeadingLevel.HEADING_2,
          }),
        );
      }

      // Content lines
      const lines = sub.content.split("\n");
      for (const line of lines) {
        const isTodo = line.trim() === "TO DO";
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line || " ",
                color: isTodo ? "EF4444" : "000000",
                bold: isTodo,
                size: 22,
              }),
            ],
          }),
        );
      }
      children.push(new Paragraph({ text: "" })); // spacer
    }
  }

  const doc = new Document({
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
      {btn(editor.isActive("bold"),   () => editor.chain().focus().toggleBold().run(),   <Bold size={14} />,  "Bold")}
      {btn(editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), <Italic size={14} />, "Italic")}
      <div className="w-px h-4 bg-slate-600 mx-1" />
      {btn(false, () => editor.chain().focus().undo().run(), <Undo size={14} />, "Undo")}
      {btn(false, () => editor.chain().focus().redo().run(), <Redo size={14} />, "Redo")}
      <div className="ml-auto flex items-center gap-1.5 text-xs text-amber-400">
        <AlertTriangle size={12} />
        <span>Fill all [TO DO] fields before submitting</span>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function DraftReportModal({ draft, onClose }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: draftToHtml(draft),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none p-6 min-h-full",
        style: "font-family: 'Times New Roman', serif; font-size: 13px; line-height: 1.8; color: #1E293B;",
      },
    },
  });

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleDownload = useCallback(() => {
    exportDocx(draft, editor?.getHTML() ?? "");
  }, [draft, editor]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
      {/* Modal box */}
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
            <div className="text-slate-400 text-xs mt-0.5">
              13 sections · edit [TO DO] fields · download as DOCX
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "linear-gradient(135deg,#2563EB,#06B6D4)",
                color: "white",
                boxShadow: "0 0 16px rgba(6,182,212,0.3)",
              }}
            >
              <Download size={15} /> Download DOCX
            </button>
            <button
              onClick={onClose}
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

        {/* Editor area */}
        <div className="flex-1 overflow-y-auto" style={{ background: "#FAFAF9" }}>
          <div className="max-w-4xl mx-auto min-h-full shadow-lg" style={{ background: "white" }}>
            <style>{`
              .ProseMirror h1 { font-size: 1.4rem; font-weight: 700; margin: 1.5rem 0 0.75rem; text-align: center; text-decoration: underline; }
              .ProseMirror h2 { font-size: 1.1rem; font-weight: 700; margin: 1.25rem 0 0.5rem; }
              .ProseMirror h3 { font-size: 0.95rem; font-weight: 600; margin: 0.9rem 0 0.3rem; color: #374151; }
              .ProseMirror p  { margin: 0.2rem 0; }
              .ProseMirror hr { border-color: #CBD5E1; margin: 1rem 0; }
            `}</style>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}
