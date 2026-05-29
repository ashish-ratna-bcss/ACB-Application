'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Download, FileText, CheckCircle,
  Printer, Share2, Shield, Calendar, User, Building
} from 'lucide-react';
import TopNav from '@/components/layout/TopNav';
import { formatDate, getDraftTypeLabel } from '@/lib/utils';
import type { Case, Draft } from '@/lib/types';

export default function ExportPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/cases/${id}`).then(r => r.json()),
      fetch(`/api/draft?caseId=${id}`).then(r => r.json()).catch(() => []),
    ]).then(([c, d]) => {
      setCaseData(c);
      const draftList = Array.isArray(d) ? d : [];
      setDrafts(draftList);
      if (draftList.length > 0) setSelectedDraft(draftList[0]);
    }).finally(() => setLoading(false));
  }, [id]);

  async function exportPDF() {
    if (!caseData || !selectedDraft) return;
    setExporting(true);

    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - 2 * margin;

      // Header background
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 45, 'F');

      // Header text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('ANTI-CORRUPTION BUREAU', pageWidth / 2, 15, { align: 'center' });
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Government of Telangana', pageWidth / 2, 22, { align: 'center' });
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text('CONFIDENTIAL – FOR OFFICIAL USE ONLY', pageWidth / 2, 30, { align: 'center' });

      // Accent line
      doc.setFillColor(6, 182, 212);
      doc.rect(0, 43, pageWidth, 2, 'F');

      // Document title
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(getDraftTypeLabel(selectedDraft.type).toUpperCase(), margin, 58);

      // Case info box
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, 64, contentWidth, 32, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, 64, contentWidth, 32, 2, 2, 'S');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      const infoItems = [
        ['Case No:', caseData.caseNumber],
        ['FIR No:', caseData.firNumber],
        ['Accused:', caseData.accusedName],
        ['Department:', caseData.accusedDepartment],
        ['Date Generated:', new Date().toLocaleDateString('en-IN')],
        ['Status:', getDraftTypeLabel(selectedDraft.type)],
      ];

      infoItems.forEach(([label, value], i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = margin + 5 + col * (contentWidth / 2);
        const y = 72 + row * 10;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text(label, x, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        doc.text(value || '—', x + 22, y);
      });

      // Divider
      doc.setDrawColor(6, 182, 212);
      doc.setLineWidth(0.5);
      doc.line(margin, 100, pageWidth - margin, 100);

      // Content
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);

      const lines = doc.splitTextToSize(selectedDraft.content, contentWidth);
      let y = 108;

      for (const line of lines) {
        if (y > pageHeight - 30) {
          doc.addPage();

          // Continuation header
          doc.setFillColor(15, 23, 42);
          doc.rect(0, 0, pageWidth, 12, 'F');
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text(`ACB – ${caseData.caseNumber} – Continued`, margin, 8);

          doc.setFillColor(6, 182, 212);
          doc.rect(0, 11, pageWidth, 1, 'F');

          y = 22;
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 41, 59);
        }

        if (line.startsWith('─') || line.startsWith('=')) {
          doc.setDrawColor(226, 232, 240);
          doc.line(margin, y - 1, pageWidth - margin, y - 1);
        } else if (line.trim() && line === line.toUpperCase() && line.length > 3 && !line.startsWith('₹')) {
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(line, margin, y);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(30, 41, 59);
        } else {
          doc.text(line, margin, y);
        }
        y += 5;
      }

      // Footer on last page
      const totalPages = (doc as { internal: { pages: unknown[] } }).internal.pages.length - 1;
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Anti-Corruption Bureau, Telangana | Confidential | Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
        doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, margin, pageHeight - 6);
      }

      // Download
      const filename = `ACB_${caseData.caseNumber.replace(/\//g, '_')}_${selectedDraft.type.toUpperCase()}.pdf`;
      doc.save(filename);

      // Log export
      await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: id, draftId: selectedDraft.id, filename }),
      });

      setExported(true);
      setTimeout(() => setExported(false), 4000);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  if (loading) return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="Export PDF" />
      <div className="flex items-center justify-center flex-1">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="Export Report" subtitle={caseData?.caseNumber} />

      <div className="p-6 space-y-5 animate-fade-in max-w-4xl mx-auto w-full">
        <button onClick={() => router.push(`/cases/${id}/draft`)} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm transition-colors">
          <ArrowLeft size={16} /> Back to Drafts
        </button>

        {drafts.length === 0 ? (
          <div className="content-card p-12 text-center">
            <FileText size={48} className="text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-700 mb-2">No Drafts Available</h3>
            <p className="text-slate-400 mb-5">Generate a draft first before exporting to PDF</p>
            <button onClick={() => router.push(`/cases/${id}/draft`)} className="btn-primary">
              Generate Draft
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Draft Selection */}
            <div className="space-y-4">
              <div className="content-card p-5">
                <h3 className="font-bold text-slate-800 mb-4">Select Draft to Export</h3>
                <div className="space-y-2">
                  {drafts.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDraft(d)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selectedDraft?.id === d.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          selectedDraft?.id === d.id ? 'metric-icon-blue' : 'bg-slate-100'
                        }`}>
                          <FileText size={18} className={selectedDraft?.id === d.id ? 'text-blue-600' : 'text-slate-500'} />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800 text-sm">{getDraftTypeLabel(d.type)}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Generated {formatDate(d.generatedAt)} · {d.status}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">{d.comments.length} review comments</div>
                        </div>
                        {selectedDraft?.id === d.id && <CheckCircle size={16} className="text-blue-500 ml-auto flex-shrink-0" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Export Options */}
              <div className="content-card p-5">
                <h3 className="font-bold text-slate-800 mb-4">Export Options</h3>
                <div className="space-y-3">
                  <button
                    onClick={exportPDF}
                    disabled={!selectedDraft || exporting}
                    className="btn-primary w-full justify-center py-3"
                  >
                    {exporting ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating PDF...</>
                    ) : exported ? (
                      <><CheckCircle size={16} /> Downloaded Successfully!</>
                    ) : (
                      <><Download size={16} /> Download PDF</>
                    )}
                  </button>
                  <button onClick={() => window.print()} className="btn-secondary w-full justify-center py-3">
                    <Printer size={16} /> Print Document
                  </button>
                  <button className="btn-secondary w-full justify-center py-3">
                    <Share2 size={16} /> Share Internally
                  </button>
                </div>

                {exported && (
                  <div className="mt-3 flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm animate-fade-in">
                    <CheckCircle size={16} />
                    PDF exported successfully and saved to activity log!
                  </div>
                )}
              </div>
            </div>

            {/* Preview Panel */}
            <div className="content-card overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Document Preview</h3>
                <p className="text-xs text-slate-500">Preview of the final exported PDF</p>
              </div>

              {selectedDraft ? (
                <div className="flex-1 overflow-auto">
                  {/* Mock PDF preview */}
                  <div className="m-4 bg-white shadow-lg" style={{ border: '1px solid #E2E8F0', minHeight: 400 }}>
                    {/* Header */}
                    <div className="p-4 text-white text-center" style={{ background: '#0F172A' }}>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Shield size={18} />
                        <span className="font-bold text-sm">ANTI-CORRUPTION BUREAU</span>
                      </div>
                      <div className="text-xs text-slate-400">Government of Telangana</div>
                      <div className="w-full h-0.5 mt-2" style={{ background: '#06B6D4' }} />
                    </div>

                    {/* Content preview */}
                    <div className="p-4">
                      <h4 className="font-bold text-slate-800 text-sm mb-3">
                        {getDraftTypeLabel(selectedDraft.type).toUpperCase()}
                      </h4>

                      {caseData && (
                        <div className="bg-slate-50 rounded-lg p-3 mb-3 text-xs space-y-1">
                          {[
                            { icon: <FileText size={11} />, label: 'Case', value: caseData.caseNumber },
                            { icon: <User size={11} />, label: 'Accused', value: caseData.accusedName },
                            { icon: <Building size={11} />, label: 'Dept', value: caseData.accusedDepartment.slice(0, 25) + '...' },
                            { icon: <Calendar size={11} />, label: 'Date', value: formatDate(caseData.incidentDate) },
                          ].map(item => (
                            <div key={item.label} className="flex items-center gap-2 text-slate-600">
                              <span className="text-slate-400">{item.icon}</span>
                              <span className="text-slate-400">{item.label}:</span>
                              <span className="font-medium">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="text-xs text-slate-600 leading-relaxed line-clamp-12 whitespace-pre-wrap">
                        {selectedDraft.content.slice(0, 600)}...
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 text-center">
                        Page 1 of N | Confidential | ACB Telangana
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center flex-1 py-12">
                  <div className="text-center text-slate-400">
                    <FileText size={40} className="mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">Select a draft to preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
