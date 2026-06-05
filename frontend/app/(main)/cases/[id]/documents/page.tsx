'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import {
  ArrowLeft, Upload, FileText, Image, File, Trash2,
  CheckCircle, Clock, AlertCircle, Cpu, Eye
} from 'lucide-react';
import TopNav from '@/components/layout/TopNav';
import { formatDate, formatFileSize } from '@/lib/utils';
import type { CaseDocument, Case } from '@/lib/types';

const STATUS_CONFIG = {
  uploaded: { label: 'Uploaded', color: 'text-blue-600', bg: 'bg-blue-50', icon: <Clock size={12} /> },
  processing: { label: 'Processing', color: 'text-amber-600', bg: 'bg-amber-50', icon: <div className="w-3 h-3 border border-amber-600 border-t-transparent rounded-full animate-spin" /> },
  extracted: { label: 'Extracted', color: 'text-green-600', bg: 'bg-green-50', icon: <CheckCircle size={12} /> },
  failed: { label: 'Failed', color: 'text-red-600', bg: 'bg-red-50', icon: <AlertCircle size={12} /> },
};

function FileIcon({ type }: { type: string }) {
  if (type.includes('pdf')) return <FileText size={22} className="text-red-500" />;
  if (type.includes('image')) return <Image size={22} className="text-blue-500" />;
  return <File size={22} className="text-slate-500" />;
}

export default function DocumentsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [dragFiles, setDragFiles] = useState<File[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/cases/${id}`).then(r => r.json()),
      fetch(`/api/documents?caseId=${id}`).then(r => r.json()),
    ]).then(([c, d]) => {
      setCaseData(c);
      setDocuments(Array.isArray(d) ? d : []);
    }).finally(() => setLoading(false));
  }, [id]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setDragFiles([]);
    setUploading(true);

    for (const file of acceptedFiles) {
      const fileName = file.name;
      setUploadProgress(p => ({ ...p, [fileName]: 0 }));

      const interval = setInterval(() => {
        setUploadProgress(p => {
          const current = p[fileName] || 0;
          if (current >= 90) { clearInterval(interval); return p; }
          return { ...p, [fileName]: current + Math.random() * 20 };
        });
      }, 200);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('caseId', id);

      try {
        const res = await fetch('/api/documents', { method: 'POST', body: formData });
        if (res.ok) {
          const doc = await res.json();
          setDocuments(prev => [...prev, doc]);
          setUploadProgress(p => ({ ...p, [fileName]: 100 }));
        }
      } catch (err) {
        console.error('Upload failed:', err);
      } finally {
        clearInterval(interval);
        setTimeout(() => setUploadProgress(p => {
          const next = { ...p }; delete next[fileName]; return next;
        }), 1000);
      }
    }
    setUploading(false);
  }, [id]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter: () => setDragFiles([]),
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/tiff': ['.tiff', '.tif'],
    },
    maxSize: 300 * 1024 * 1024,
  });

  async function processOCR(docId: string) {
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ocrStatus: 'processing' } : d));
    try {
      const res = await fetch(`/api/extract?docId=${docId}&caseId=${id}`, { method: 'POST' });
      if (res.ok) {
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ocrStatus: 'extracted' } : d));
      }
    } catch {
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ocrStatus: 'failed' } : d));
    }
  }

  async function processAllOCR() {
    const toProcess = documents.filter(d => d.ocrStatus === 'uploaded');
    for (const doc of toProcess) await processOCR(doc.id);
  }

  if (loading) return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="Document Upload" />
      <div className="flex items-center justify-center flex-1">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <TopNav title="Evidence Documents" subtitle={caseData?.caseNumber} />

      <div className="p-6 space-y-5 animate-fade-in">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push(`/cases/${id}`)} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm transition-colors">
            <ArrowLeft size={16} /> Back to Case
          </button>
          {documents.some(d => d.ocrStatus === 'uploaded') && (
            <button onClick={processAllOCR} className="btn-ai ml-auto">
              <Cpu size={16} /> Process All with OCR
            </button>
          )}
          {documents.some(d => d.ocrStatus === 'extracted') && (
            <button onClick={() => router.push(`/cases/${id}/extraction`)} className="btn-primary">
              <CheckCircle size={16} /> Review Extraction →
            </button>
          )}
        </div>

        {/* Drop Zone */}
        <div
          {...getRootProps()}
          className={`dropzone transition-all ${isDragActive ? 'active' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center transition-all"
              style={{
                background: isDragActive ? 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(37,99,235,0.15))' : '#F1F5F9',
                border: isDragActive ? '2px solid rgba(6,182,212,0.4)' : '2px solid transparent',
              }}
            >
              <Upload size={36} className={isDragActive ? 'text-cyan-500' : 'text-slate-400'} />
            </div>
            <div>
              <p className="text-slate-700 font-semibold text-lg">
                {isDragActive ? 'Drop files to upload' : 'Drag & drop files here'}
              </p>
              <p className="text-slate-500 text-sm mt-1">
                Supports PDF, JPG, PNG, TIFF • Max 300MB per file
              </p>
            </div>
            <button type="button" className="btn-primary">
              <Upload size={16} /> Browse Files
            </button>
          </div>
        </div>

        {/* Upload Progress */}
        {Object.entries(uploadProgress).length > 0 && (
          <div className="content-card p-4 space-y-3">
            <h3 className="font-semibold text-slate-700 text-sm">Uploading Files...</h3>
            {Object.entries(uploadProgress).map(([name, progress]) => (
              <div key={name}>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span className="truncate">{name}</span>
                  <span>{Math.round(Math.min(progress, 100))}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(progress, 100)}%`,
                      background: 'linear-gradient(90deg, #2563EB, #06B6D4)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Documents Table */}
        <div className="content-card overflow-hidden">
          <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-800">Uploaded Documents</h3>
              <p className="text-xs text-slate-500">{documents.length} document{documents.length !== 1 ? 's' : ''} attached</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                <span key={key} className={`flex items-center gap-1 badge ${val.bg} ${val.color}`}>
                  {val.icon} {val.label}
                </span>
              ))}
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-16">
              <Upload size={48} className="text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No documents uploaded yet</p>
              <p className="text-slate-400 text-sm mt-1">Upload evidence documents to start AI extraction</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Upload Date</th>
                  <th>OCR Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => {
                  const statusCfg = STATUS_CONFIG[doc.ocrStatus] || STATUS_CONFIG.uploaded;
                  return (
                    <tr key={doc.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                            <FileIcon type={doc.mimeType} />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800 text-sm">{doc.originalName}</div>
                            <div className="text-slate-400 text-xs">{doc.fileName}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-medium text-slate-500 uppercase">{doc.fileType}</span>
                      </td>
                      <td className="text-sm text-slate-500">{formatFileSize(doc.fileSize)}</td>
                      <td className="text-sm text-slate-500">{formatDate(doc.uploadDate)}</td>
                      <td>
                        <span className={`badge ${statusCfg.bg} ${statusCfg.color} flex items-center gap-1.5 w-fit`}>
                          {statusCfg.icon} {statusCfg.label}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {doc.ocrStatus === 'uploaded' && (
                            <button
                              onClick={() => processOCR(doc.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg btn-ai text-xs"
                              style={{ padding: '5px 10px', fontSize: '11px' }}
                            >
                              <Cpu size={11} /> OCR
                            </button>
                          )}
                          {doc.ocrStatus === 'extracted' && (
                            <button
                              onClick={() => router.push(`/cases/${id}/extraction`)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors"
                              style={{ padding: '5px 10px', fontSize: '11px' }}
                            >
                              <Eye size={11} /> View
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Info Banner */}
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)' }}
        >
          <Cpu size={18} className="text-cyan-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-cyan-700">AI-Powered OCR Extraction</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload complaint letters, FIR copies, or any supporting documents. Our AI will automatically extract case details including accused information, bribe amounts, dates, and witnesses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
