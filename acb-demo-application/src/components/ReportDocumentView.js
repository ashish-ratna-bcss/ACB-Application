import React from 'react';

const ACB_LOGO_URL = `${window.location.origin}${process.env.PUBLIC_URL}/acb-logo.png`;

// ── Watermark — centred faded logo, behind content ───────────────────────────
function Watermark() {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
    }}>
      <img
        src={ACB_LOGO_URL}
        alt=""
        style={{ width: 240, height: 240, opacity: 0.09, userSelect: 'none', display: 'block' }}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    </div>
  );
}

// ── shared styles injected into print window ─────────────────────────────────
const PRINT_BASE_CSS = `
  @page { size: A4 portrait; margin: 22mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Georgia, serif; color: #111; line-height: 1.75; font-size: 13px; }
  p { margin: 0 0 8px; orphans: 3; widows: 3; }
  table { border-collapse: collapse; width: 100%; }
  .header-centered { text-align: center; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 12px; page-break-inside: avoid; }
  .header-centered p { margin: 2px 0; font-size: 14px; }
  .header-underline { text-decoration: underline; }
  hr.thick { border: none; border-top: 2px solid #111; margin: 6px 0 14px; }
  .meta-row { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 12.5px; page-break-inside: avoid; }
  .to-address { margin-bottom: 12px; font-size: 13px; page-break-inside: avoid; }
  .to-address p { margin: 1px 0; }
  .sub-ref-table { page-break-inside: avoid; }
  .sub-ref-table td { padding: 3px 6px; vertical-align: top; font-size: 12.5px; }
  .sub-ref-table td.label { font-weight: 700; white-space: nowrap; padding-right: 10px; }
  .narrative-body { margin: 16px 0; }
  .numbered-para { margin-bottom: 10px; text-align: justify; page-break-inside: avoid; orphans: 3; widows: 3; }
  .sign-off-right { text-align: right; margin-top: 36px; page-break-inside: avoid; }
  .sign-off-right p { margin: 1px 0; }
  .evidence-details { page-break-inside: avoid; }
  .evidence-details p { margin: 2px 0; font-size: 12.5px; }
  .section-header { font-weight: 700; border-bottom: 1px solid #555; margin: 16px 0 6px; font-size: 13px; page-break-after: avoid; }
  .context-block { font-style: italic; margin-bottom: 10px; text-align: justify; font-size: 12.5px; orphans: 3; widows: 3; }
  .dialogue-table { margin: 8px 0 12px; page-break-inside: auto; }
  .dialogue-table tr { page-break-inside: avoid; }
  .dialogue-table td { border: 1px solid #bbb; padding: 4px 7px; vertical-align: top; font-size: 12px; }
  .dialogue-table td.timestamp { white-space: nowrap; color: #444; width: 90px; }
  .dialogue-table td.speaker { font-weight: 700; white-space: nowrap; width: 120px; }
  .dialogue-table td.separator { width: 10px; font-weight: 700; }
  .certification-block { border: 1px solid #999; background: #f9f9f9; padding: 8px 12px; margin: 14px 0; font-size: 12.5px; font-style: italic; text-align: justify; page-break-inside: avoid; }
  .consolidated-block { border-left: 3px solid #333; padding-left: 12px; margin: 16px 0; font-size: 12.5px; page-break-inside: avoid; }
  .consolidated-title { font-weight: 700; margin-bottom: 6px; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); opacity: 0.09; z-index: 0; pointer-events: none; }
  .content { position: relative; z-index: 1; }
`;

function e(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── print builders ────────────────────────────────────────────────────────────

function buildVerificationPrintHtml(r) {
  const paras = (r.narrativeParagraphs || []).map(
    (p, i) => `<p class="numbered-para">${i + 1}. ${e(p)}</p>`,
  ).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Verification Report</title>
<style>${PRINT_BASE_CSS}</style></head><body>
<img class="watermark" src="${ACB_LOGO_URL}" width="220" height="220" alt=""/>
<div class="content">
<div class="header-centered">
  <p>GOVERNMENT OF TELANGANA</p>
  <p>ANTI-CORRUPTION BUREAU</p>
</div>
<hr class="thick"/>
<div class="meta-row">
  <span>C.No. ${e(r.caseTrackingId)}</span>
  <span>Date: ${e(r.date)}</span>
</div>
<div class="to-address">
  <p>To,</p>
  <p>The Deputy Superintendent of Police,</p>
  <p>Anti-Corruption Bureau,</p>
  <p>${e(r.districtUnit)}.</p>
</div>
<table class="sub-ref-table"><tbody>
  <tr>
    <td class="label">Sub:</td>
    <td>ACB - ${e(r.districtUnit)} - Verification of Complaint against ${e(r.accusedName)}, ${e(r.accusedDesignation)} - Report Submitted - Reg.</td>
  </tr>
  <tr>
    <td class="label">Ref:</td>
    <td>Draft complaint received from ${e(r.complainantName)} on ${e(r.complaintDate)}.</td>
  </tr>
</tbody></table>
<div class="narrative-body">
  <p>Sir,</p>
  ${paras}
</div>
<div class="sign-off-right">
  <p>Yours faithfully,</p><br><br>
  <p>(${e(r.inspectorName)})</p>
  <p>Inspector of Police,</p>
  <p>ACB, ${e(r.districtUnit)}.</p>
</div>
</div>
</body></html>`;
}

function buildVerbatimPrintHtml(r) {
  const sections = (r.recordingSections || []).map((sec, si) => {
    const rows = (sec.dialogueLines || []).map(
      (dl) => `<tr>
        <td class="timestamp">[${e(dl.timestamp)}]</td>
        <td class="speaker">${e(dl.speaker)}</td>
        <td class="separator">:</td>
        <td class="spoken-text">${e(dl.text)}</td>
      </tr>`,
    ).join('');
    return `
      <div class="section-header">Recording ${si + 1}: ${e(sec.fileName)}</div>
      <div class="evidence-details">
        <p><strong>Recording Device:</strong> ${e(sec.recordingDevice)}</p>
        <p><strong>Language:</strong> ${e(sec.language)}</p>
      </div>
      <p class="context-block">${e(sec.contextBody)}</p>
      <table class="dialogue-table"><tbody>${rows}</tbody></table>
      <div class="certification-block">
        The above transcript was converted from the digital audio record and accurately reflects
        the exact words uttered, corroborating the demand for illegal gratification.
      </div>`;
  }).join('<hr style="border:none;border-top:1px dashed #999;margin:16px 0"/>');

  const consolidated = r.consolidatedConclusion
    ? `<div class="consolidated-block">
        <div class="consolidated-title">Consolidated Conclusion</div>
        <p>${e(r.consolidatedConclusion)}</p>
       </div>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><title>Verbatim Transcript Report</title>
<style>${PRINT_BASE_CSS}</style></head><body>
<img class="watermark" src="${ACB_LOGO_URL}" width="220" height="220" alt=""/>
<div class="content">
<div class="header-centered">
  <p>GOVERNMENT OF TELANGANA</p>
  <p>ANTI-CORRUPTION BUREAU</p>
  <p class="header-underline">VERBATIM TRANSCRIPT REPORT</p>
</div>
<hr class="thick"/>
<div class="meta-row">
  <span>C.No. ${e(r.caseTrackingId)}</span>
  <span>Date: ${e(r.date)}</span>
</div>
${sections}
${consolidated}
<div class="sign-off-right">
  <br>
  <p>(${e(r.inspectorName)})</p>
  <p>Inspector of Police,</p>
  <p>ACB, ${e(r.districtUnit || 'ACB')}.</p>
</div>
</div>
</body></html>`;
}

// ── Shared action bar ─────────────────────────────────────────────────────────

function ActionBar({ onCopy, onPrint }) {
  return (
    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: 'var(--surface-2)' }}>
      <button onClick={onCopy} style={actionBtn}>Copy Text</button>
      <button onClick={onPrint} style={{ ...actionBtn, background: '#0F172A', color: '#fff', border: '1px solid #0F172A' }}>🖨 Print</button>
    </div>
  );
}

// ── Verification Report renderer ──────────────────────────────────────────────

function VerificationReportDoc({ r }) {
  const paragraphs = r.narrativeParagraphs || [];

  function handlePrint() {
    const w = window.open('', '_blank', 'width=820,height=1000');
    if (!w) return;
    w.document.write(buildVerificationPrintHtml(r));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  return (
    <div style={docWrapper}>
      <div style={docTitleBar}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{r.title}</span>
        <ActionBar onCopy={() => navigator.clipboard.writeText(r.body || '')} onPrint={handlePrint} />
      </div>
      <div style={a4Viewport}>
        <div style={a4Page}>
          <Watermark />
          <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ textAlign: 'center', fontWeight: 700, marginBottom: '10px' }}>
            <div style={{ fontSize: '14px' }}>GOVERNMENT OF TELANGANA</div>
            <div style={{ fontSize: '14px' }}>ANTI-CORRUPTION BUREAU</div>
          </div>
          <hr style={thickRule} />

          {/* Ref / Date */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', fontSize: '13px' }}>
            <span>C.No. {r.caseTrackingId}</span>
            <span>Date: {r.date}</span>
          </div>

          {/* To address */}
          <div style={{ marginBottom: '12px', lineHeight: 1.6 }}>
            <div>To,</div>
            <div>The Deputy Superintendent of Police,</div>
            <div>Anti-Corruption Bureau,</div>
            <div>{r.districtUnit}.</div>
          </div>

          {/* Sub / Ref */}
          <table style={{ width: '100%', marginBottom: '16px', fontSize: '12.5px' }}>
            <tbody>
              <tr>
                <td style={subLabel}>Sub:</td>
                <td style={subContent}>ACB – {r.districtUnit} – Verification of Complaint against {r.accusedName}, {r.accusedDesignation} – Report Submitted – Reg.</td>
              </tr>
              <tr>
                <td style={subLabel}>Ref:</td>
                <td style={subContent}>Draft complaint received from {r.complainantName} on {r.complaintDate}.</td>
              </tr>
            </tbody>
          </table>

          {/* Narrative */}
          <div style={{ marginBottom: '12px' }}>Sir,</div>
          {paragraphs.map((p, i) => (
            <p key={i} style={{ marginBottom: '12px', textAlign: 'justify', pageBreakInside: 'avoid', orphans: 3, widows: 3 }}>
              {i + 1}. {p}
            </p>
          ))}

          {/* Sign-off */}
          <div style={{ textAlign: 'right', marginTop: '36px', lineHeight: 1.8, pageBreakInside: 'avoid' }}>
            <div>Yours faithfully,</div>
            <div style={{ marginTop: '36px' }}>({r.inspectorName})</div>
            <div>Inspector of Police,</div>
            <div>ACB, {r.districtUnit}.</div>
          </div>
          </div>{/* end zIndex wrapper */}
        </div>
      </div>
    </div>
  );
}

// ── Verbatim Report renderer ──────────────────────────────────────────────────

function VerbatimReportDoc({ r }) {
  function handlePrint() {
    const w = window.open('', '_blank', 'width=820,height=1000');
    if (!w) return;
    w.document.write(buildVerbatimPrintHtml(r));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  const sections = r.recordingSections || [];

  return (
    <div style={docWrapper}>
      <div style={docTitleBar}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{r.title}</span>
        <ActionBar onCopy={() => navigator.clipboard.writeText(r.body || '')} onPrint={handlePrint} />
      </div>
      <div style={a4Viewport}>
        <div style={a4Page}>
          {/* Header */}
          <Watermark />
          <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', fontWeight: 700, marginBottom: '10px' }}>
            <div style={{ fontSize: '14px' }}>GOVERNMENT OF TELANGANA</div>
            <div style={{ fontSize: '14px' }}>ANTI-CORRUPTION BUREAU</div>
            <div style={{ fontSize: '14px', textDecoration: 'underline', marginTop: '4px' }}>VERBATIM TRANSCRIPT REPORT</div>
          </div>
          <hr style={thickRule} />

          {/* Ref / Date */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', fontSize: '13px' }}>
            <span>C.No. {r.caseTrackingId}</span>
            <span>Date: {r.date}</span>
          </div>

          {/* Per-recording sections */}
          {sections.map((sec, si) => (
            <div key={si}>
              {/* Section heading */}
              <div style={{ fontWeight: 700, borderBottom: '1px solid #555', marginBottom: '8px', paddingBottom: '3px', fontSize: '13px' }}>
                Recording {sec.index}: {sec.fileName}
              </div>
              {/* Evidence details */}
              <div style={{ marginBottom: '8px', fontSize: '12.5px', lineHeight: 1.6 }}>
                <span><strong>Recording Device:</strong> {sec.recordingDevice}</span>
                {'  |  '}
                <span><strong>Language:</strong> {sec.language}</span>
              </div>
              {/* AI contextual intro */}
              {sec.contextBody && (
                <p style={{ fontStyle: 'italic', fontSize: '12.5px', marginBottom: '8px', textAlign: 'justify' }}>{sec.contextBody}</p>
              )}
              {/* Dialogue table — exact words, no AI */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }}>
                <tbody>
                  {(sec.dialogueLines || []).map((dl, di) => (
                    <tr key={di} style={{ pageBreakInside: 'avoid' }}>
                      <td style={{ border: '1px solid #bbb', padding: '4px 7px', fontSize: '12px', color: '#444', whiteSpace: 'nowrap', verticalAlign: 'top', width: '100px' }}>[{dl.timestamp}]</td>
                      <td style={{ border: '1px solid #bbb', padding: '4px 7px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', verticalAlign: 'top', width: '130px' }}>{dl.speaker}</td>
                      <td style={{ border: '1px solid #bbb', padding: '4px 7px', fontSize: '12px', fontWeight: 700, verticalAlign: 'top', width: '14px' }}>:</td>
                      <td style={{ border: '1px solid #bbb', padding: '4px 7px', fontSize: '12px', verticalAlign: 'top' }}>{dl.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Certification block per recording */}
              <div style={{ border: '1px solid #999', background: '#f9f9f9', padding: '8px 12px', marginBottom: '14px', fontSize: '12.5px', fontStyle: 'italic', textAlign: 'justify', pageBreakInside: 'avoid' }}>
                The above transcript was converted from the digital audio record and accurately reflects the exact words uttered, corroborating the demand for illegal gratification.
              </div>
              {si < sections.length - 1 && (
                <hr style={{ border: 'none', borderTop: '1px dashed #bbb', margin: '14px 0' }} />
              )}
            </div>
          ))}

          {/* Consolidated conclusion (only if multiple interlinked recordings) */}
          {r.consolidatedConclusion && (
            <div style={{ borderLeft: '3px solid #333', paddingLeft: '12px', margin: '14px 0', fontSize: '12.5px' }}>
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>Consolidated Conclusion</div>
              <p style={{ textAlign: 'justify' }}>{r.consolidatedConclusion}</p>
            </div>
          )}

          {/* Sign-off */}
          <div style={{ textAlign: 'right', marginTop: '32px', lineHeight: 1.8, pageBreakInside: 'avoid' }}>
            <div>({r.inspectorName})</div>
            <div>Inspector of Police,</div>
            <div>ACB, {r.districtUnit || 'ACB'}.</div>
          </div>
          </div>{/* end zIndex wrapper */}
        </div>
      </div>
    </div>
  );
}

// ── Head Office Memo renderer ─────────────────────────────────────────────────

function HoMemoReportDoc({ r }) {
  const paragraphs = r.narrativeParagraphs || [];

  function handlePrint() {
    const w = window.open('', '_blank', 'width=820,height=1000');
    if (!w) return;
    w.document.write(buildHoMemoPrintHtml(r));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  return (
    <div style={docWrapper}>
      <div style={docTitleBar}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{r.title}</span>
        <ActionBar onCopy={() => navigator.clipboard.writeText(r.body || '')} onPrint={handlePrint} />
      </div>
      <div style={a4Viewport}>
        <div style={a4Page}>
          <Watermark />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ textAlign: 'center', fontWeight: 700, marginBottom: '10px' }}>
              <div style={{ fontSize: '14px' }}>GOVERNMENT OF TELANGANA</div>
              <div style={{ fontSize: '14px' }}>ANTI-CORRUPTION BUREAU, HEAD OFFICE</div>
              <div style={{ fontSize: '12px', fontWeight: 'normal', marginTop: '3px' }}>ROAD NO. 12, BANJARA HILLS, HYDERABAD</div>
            </div>
            <hr style={thickRule} />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', fontSize: '13px' }}>
              <span>Memo No: {r.memoNumber}</span>
              <span>Date: {r.date}</span>
            </div>

            <table style={{ width: '100%', marginBottom: '16px', fontSize: '12.5px' }}>
              <tbody>
                <tr>
                  <td style={subLabel}>SUB:</td>
                  <td style={subContent}>{r.subject}</td>
                </tr>
                <tr>
                  <td style={subLabel}>REF:</td>
                  <td style={subContent}>{r.reference}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: '20px' }}>
              {paragraphs.map((p, i) => (
                <p key={i} style={{ marginBottom: '12px', textAlign: 'justify', pageBreakInside: 'avoid', orphans: 3, widows: 3 }}>
                  {i + 1}. {p}
                </p>
              ))}
            </div>

            <div style={{ textAlign: 'right', marginTop: '48px', lineHeight: 1.8, pageBreakInside: 'avoid' }}>
              <div style={{ fontWeight: 700 }}>({r.signatoryName || 'Sri C. V. Anand, IPS'})</div>
              <div>{r.signatoryDesignation || 'Director General'}</div>
              <div>ACB, Head Office, Hyderabad.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildHoMemoPrintHtml(r) {
  const paras = (r.narrativeParagraphs || []).map(
    (p, i) => `<p class="numbered-para">${i + 1}. ${e(p)}</p>`,
  ).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Head Office Decision Memo</title>
<style>${PRINT_BASE_CSS}</style></head><body>
<img class="watermark" src="${ACB_LOGO_URL}" width="220" height="220" alt=""/>
<div class="content">
<div class="header-centered">
  <p>GOVERNMENT OF TELANGANA</p>
  <p>ANTI-CORRUPTION BUREAU, HEAD OFFICE</p>
  <p style="font-size: 11px; font-weight: normal;">ROAD NO. 12, BANJARA HILLS, HYDERABAD</p>
</div>
<hr class="thick"/>
<div class="meta-row">
  <span>Memo No: ${e(r.memoNumber)}</span>
  <span>Date: ${e(r.date)}</span>
</div>
<table class="sub-ref-table"><tbody>
  <tr>
    <td class="label">SUB:</td>
    <td>${e(r.subject)}</td>
  </tr>
  <tr>
    <td class="label">REF:</td>
    <td>${e(r.reference)}</td>
  </tr>
</tbody></table>
<div class="narrative-body">
  ${paras}
</div>
<div class="sign-off-right">
  <br><br>
  <p><strong>(${e(r.signatoryName)})</strong></p>
  <p>${e(r.signatoryDesignation)}</p>
  <p>Anti-Corruption Bureau, H.O.</p>
</div>
</div>
</body></html>`;
}

// ── Main export — dispatches by documentType ─────────────────────────────────

export default function ReportDocumentView({ report }) {
  if (!report) return null;
  if (report.documentType === 'verification') return <VerificationReportDoc r={report} />;
  if (report.documentType === 'verbatim') return <VerbatimReportDoc r={report} />;
  if (report.documentType === 'ho_memo') return <HoMemoReportDoc r={report} />;
  // Unknown type — plain fallback
  return (
    <div style={docWrapper}>
      <div style={docTitleBar}><span style={{ fontSize: '13px', fontWeight: 700 }}>{report.title}</span></div>
      <div style={{ padding: '16px', whiteSpace: 'pre-wrap', fontSize: '12px', fontFamily: 'monospace' }}>{report.body}</div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const docWrapper = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)', overflow: 'hidden' };
const docTitleBar = { padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', background: 'var(--surface-2)' };
// A4 at 96 dpi = 794 × 1123px. The viewport is a scrollable grey tray —
// no height cap so multi-page content is never clipped on screen.
const a4Viewport = { padding: '28px 20px', background: '#D1D5DB' };
const a4Page = {
  position: 'relative',
  background: '#fff',
  margin: '0 auto 24px',          // gap between simulated pages
  maxWidth: '794px',               // A4 width at 96 dpi
  minHeight: '1123px',             // A4 height at 96 dpi — first page always full height
  padding: '96px 80px',            // ~25mm margins
  boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
  fontFamily: "'Times New Roman', Georgia, serif",
  color: '#111', lineHeight: 1.75, fontSize: '13px',
};
const thickRule = { border: 'none', borderTop: '2px solid #111', margin: '6px 0 14px' };
const subLabel = { fontWeight: 700, verticalAlign: 'top', whiteSpace: 'nowrap', paddingRight: '10px' };
const subContent = { verticalAlign: 'top' };
const actionBtn = { fontSize: '11px', fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer' };
