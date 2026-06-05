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
  office?: string;
  case_name?: string;
  date?: string;
  doc_title?: string;
  sub?: string;
  title?: string;
  case_number: string;
  header?: { from: string; to: string };
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

  // Office header
  if (draft.office) {
    html += `<p style="text-align:right;line-height:1.8">${esc(draft.office).replace(/\n/g, "<br/>")}</p>`;
  }

  // Case name + Date row
  html += `<table width="100%" style="margin:1rem 0"><tr>`;
  html += `<td style="text-align:left"><strong>${esc(draft.case_name || draft.case_id)}</strong></td>`;
  html += `<td style="text-align:right"><strong>${esc(draft.date || "")}</strong></td>`;
  html += `</tr></table>`;

  // Document title
  html += `<h1 style="text-align:center;text-decoration:underline;font-weight:bold">${esc(draft.doc_title || "CIRCULAR MEMORANDUM")}</h1>`;

  // Sub line
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

  // Footer
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

  // Office header
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

  // Title
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
    children.push(
      new Paragraph({
        text: section.heading,
        heading: HeadingLevel.HEADING_1,
      }),
    );

    for (const sub of section.subsections) {
      const raw = sub.content || "";
      const isTodo = !raw || raw.trim() === "TO DO" || raw.trim() === "[TO BE FILLED]" || raw.trim().startsWith("[NOT IN SOURCE") || raw.trim().startsWith("[TO BE FILLED");
      if (isTodo) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `[TO BE FILLED — ${sub.heading}]`, color: "000000", bold: true, size: 22 })],
        }));
      } else {
        for (const line of raw.split("\n")) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line || " ", size: 22 })],
          }));
        }
      }
      children.push(new Paragraph({ text: "" }));
    }
  }

  // Footer
  children.push(new Paragraph({ text: "" }));
  children.push(new Paragraph({ text: "─".repeat(60) }));
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
      {btn(editor.isActive("bold"),   () => editor.chain().focus().toggleBold().run(),   <Bold size={14} />,  "Bold")}
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

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function DraftReportModal({ draft, onClose }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: draftToHtml(draft),
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none p-6 min-h-full",
        style: "font-family: 'Trebuchet MS', sans-serif; font-size: 16px; line-height: 2; color: #000000;",
      },
    },
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleDownload = useCallback(() => {
    exportDocx(draft);
  }, [draft]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
    >
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
            <div className="text-slate-400 text-xs mt-0.5">Edit fields · Download as DOCX</div>
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

        {/* Editor */}
        <div className="flex-1 overflow-y-auto" style={{ background: "#FAFAF9" }}>
          <div className="max-w-4xl mx-auto min-h-full shadow-lg" style={{ background: "white" }}>
            <style>{`
              .ProseMirror h1 { font-size: 1.6rem; font-weight: 700; margin: 1.5rem 0 1rem; text-align: center; text-decoration: underline; }
              .ProseMirror h2 { font-size: 1.3rem; font-weight: 700; margin: 1.5rem 0 0.6rem; }
              .ProseMirror p  { margin: 0.4rem 0; text-align: justify; font-size: 16px; line-height: 2; }
              .ProseMirror hr { border-color: #CBD5E1; margin: 1.2rem 0; }
              .ProseMirror table { width: 100%; margin-bottom: 1.5rem; font-size: 16px; }
              .ProseMirror td  { vertical-align: top; line-height: 2; }
            `}</style>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );
}
