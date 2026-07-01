import React, { useState, useEffect } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL ?? 'http://localhost:8000';

export default function DocumentSidePanel({ isOpen, onClose, pdfUrl, fileName, document }) {
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    setIframeLoaded(false);
  }, [pdfUrl]);

  if (!isOpen || !pdfUrl) return null;

  const isDocx = fileName?.toLowerCase().endsWith('.docx');
  const isPdf = fileName?.toLowerCase().endsWith('.pdf');

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        height: '100vh',
        width: '500px',
        maxWidth: '100%',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          background: 'var(--surface-2)',
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {fileName || 'Document'}
          </h3>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {document?.status && <span>{document.status}</span>}
            {document?.total_pages > 0 && <span>{document.total_pages} pages</span>}
            {document?.phase && (
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: 'rgba(37,99,235,0.12)', color: '#1D4ED8' }}>
                {document.phase}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: 'var(--text-3)',
            padding: '4px 8px',
            borderRadius: '6px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Viewer */}
      <div style={{ flex: 1, overflow: 'hidden', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {isPdf ? (
          <>
            {!iframeLoaded && (
              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: 'var(--text-3)' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTop: '3px solid #2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ fontSize: '12px' }}>Loading PDF...</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}
            <iframe
              src={pdfUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                opacity: iframeLoaded ? 1 : 0.5,
              }}
              title="PDF Viewer"
              onLoad={() => setIframeLoaded(true)}
            /></>
        ) : isDocx ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
              Word Document
            </div>
            <div style={{ fontSize: '12px', marginBottom: '24px', maxWidth: '250px', margin: '0 auto 24px' }}>
              Download to view in Word or compatible application.
            </div>
            <a
              href={pdfUrl}
              download={fileName}
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #2563EB',
                background: '#2563EB',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Download
            </a>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📎</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
              File
            </div>
            <div style={{ fontSize: '12px', marginBottom: '24px' }}>
              Format not viewable in browser.
            </div>
            <a
              href={pdfUrl}
              download={fileName}
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #2563EB',
                background: '#2563EB',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Download
            </a>
          </div>
        )}
      </div>

      {/* Footer - Download button for PDF */}
      {isPdf && (
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2)',
            flexShrink: 0,
          }}
        >
          <a
            href={pdfUrl}
            download={fileName}
            style={{
              display: 'block',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #2563EB',
              background: '#2563EB',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
              textDecoration: 'none',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            Download PDF
          </a>
        </div>
      )}
    </div>
  );
}
