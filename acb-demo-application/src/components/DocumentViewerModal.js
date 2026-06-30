import React, { useState, useEffect } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export default function DocumentViewerModal({ isOpen, onClose, document, caseId, CASE_PHASES }) {
  const [documentContent, setDocumentContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !document || !caseId) return;

    setLoading(true);
    setError(null);
    setDocumentContent(null);

    const fetchDocumentContent = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/pdf/document/${encodeURIComponent(caseId)}/${encodeURIComponent(document.document_id || document.file_name)}`);
        if (!res.ok) throw new Error('Failed to fetch document');
        const data = await res.json();
        setDocumentContent(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentContent();
  }, [isOpen, document, caseId]);

  if (!isOpen) return null;

  const phaseLabel = document?.phase
    ? CASE_PHASES.find((p) => p.key === document.phase)?.label || document.phase
    : 'No phase';

  return (
    <div style={modalOverlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeader}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 700 }}>
              {document?.original_name || document?.file_name}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
              <span style={stageBadge}>{phaseLabel}</span>
              {document?.total_pages && <span> · {document.total_pages} pages</span>}
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <div style={modalBody}>
          {loading && <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px' }}>Loading document...</div>}
          {error && <div style={{ color: '#991B1B', padding: '20px', fontSize: '12px' }}>Error: {error}</div>}

          {documentContent && (
            <div style={{ display: 'grid', gap: '16px' }}>
              {/* Extracted Text Content */}
              {documentContent.pages && documentContent.pages.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Extracted Content</h3>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {documentContent.pages.map((page, idx) => (
                      <div key={idx} style={{ ...contentBlock }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', marginBottom: '6px' }}>
                          Page {page.page_number}
                        </div>
                        <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--text)' }}>
                          {page.page_text || 'No text extracted'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Subdocuments */}
              {documentContent.subdocuments && documentContent.subdocuments.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>Detected Documents</h3>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {documentContent.subdocuments.map((subdoc, idx) => (
                      <div key={idx} style={contentBlock}>
                        <div style={{ fontSize: '12px', fontWeight: 700 }}>{idx + 1}. {subdoc.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
                          {subdoc.document_type} · Pages {subdoc.start_page}-{subdoc.end_page}
                          {subdoc.confidence_score && ` · ${Math.round(subdoc.confidence_score * 100)}% confidence`}
                        </div>
                        {subdoc.content?.summary && (
                          <div style={{ fontSize: '11px', color: 'var(--text-2)', marginTop: '6px' }}>
                            {subdoc.content.summary}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!documentContent.pages && !documentContent.subdocuments && (
                <div style={{ color: 'var(--text-3)', fontSize: '12px' }}>No extracted content available</div>
              )}
            </div>
          )}
        </div>

        {document?.file_name && (
          <div style={modalFooter}>
            <a
              href={`${BACKEND_URL}/api/pdf/file/${encodeURIComponent(caseId)}/${encodeURIComponent(document.file_name)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={downloadBtn}
            >
              Open PDF
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

const modalOverlay = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-end',
  zIndex: 1000,
  padding: '20px',
};

const modalContent = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  maxHeight: 'calc(100vh - 40px)',
  width: '100%',
  maxWidth: '520px',
};

const modalHeader = {
  padding: '16px',
  borderBottom: '1px solid var(--border)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
};

const closeBtn = {
  background: 'none',
  border: 'none',
  color: 'var(--text-3)',
  fontSize: '18px',
  cursor: 'pointer',
  padding: '0',
  width: '28px',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '6px',
  transition: 'all 0.2s',
};

Object.assign(closeBtn, {
  ':hover': {
    background: 'var(--surface-2)',
    color: 'var(--text)',
  }
});

const modalBody = {
  flex: 1,
  overflowY: 'auto',
  padding: '16px',
};

const modalFooter = {
  padding: '12px 16px',
  borderTop: '1px solid var(--border)',
  display: 'flex',
  gap: '8px',
  background: 'var(--surface-2)',
};

const contentBlock = {
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '12px',
  background: 'var(--surface-2)',
};

const stageBadge = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 700,
  background: 'rgba(37,99,235,0.12)',
  color: '#1D4ED8',
};

const downloadBtn = {
  flex: 1,
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #2563EB',
  background: '#2563EB',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 700,
  textAlign: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
};
