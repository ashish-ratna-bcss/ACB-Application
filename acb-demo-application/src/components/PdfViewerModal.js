import React from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL ?? 'http://localhost:8000';

export default function PdfViewerModal({ isOpen, onClose, pdfUrl, fileName }) {
  if (!isOpen || !pdfUrl) return null;

  const isDocx = fileName?.toLowerCase().endsWith('.docx');
  const isPdf = fileName?.toLowerCase().endsWith('.pdf');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: '900px',
          height: '90vh',
          maxHeight: '90vh',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
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
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
              {fileName || 'PDF Viewer'}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>Click to interact with PDF</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-3)',
              padding: '4px 8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Viewer */}
        <div style={{ flex: 1, overflow: 'hidden', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isPdf ? (
            <iframe
              src={pdfUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '0 0 12px 12px',
              }}
              title="PDF Viewer"
            />
          ) : isDocx ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
                Word Document
              </div>
              <div style={{ fontSize: '12px', marginBottom: '24px', maxWidth: '300px', margin: '0 auto 24px' }}>
                DOCX files can be downloaded and opened with Microsoft Word or compatible applications.
              </div>
              <a
                href={pdfUrl}
                download={fileName}
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
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
                Download DOCX
              </a>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📎</div>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>
                File Format
              </div>
              <div style={{ fontSize: '12px', marginBottom: '24px' }}>
                This file format is not directly viewable in the browser.
              </div>
              <a
                href={pdfUrl}
                download={fileName}
                style={{
                  display: 'inline-block',
                  padding: '10px 20px',
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
                Download File
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        {isPdf && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: '8px',
              background: 'var(--surface-2)',
              justifyContent: 'flex-end',
            }}
          >
            <a
              href={pdfUrl}
              download={fileName}
              style={{
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
              Download PDF
            </a>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
