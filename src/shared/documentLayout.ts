// Page geometry and document CSS shared by the editor (renderer) and the PDF exporter (main).
// Both sides render the same markup with the same CSS, so the editor page matches the PDF page.

const MM = 96 / 25.4; // CSS px per millimetre

export const PAGE_MM = { width: 210, height: 297, marginTop: 16, marginBottom: 20, marginX: 16 } as const;

// The printed page is not exactly the A4 size in millimetres: Chromium rounds the page and the margins to
// whole CSS pixels when it prints (measured with a ruler page). The editor uses the sizes that Chromium really
// lays out, so lines wrap and pages break at the same places as in the PDF.
export const PAGE = {
  width: 794,
  height: 1123.84,
  marginTop: 61,
  marginBottom: 74.84,
  marginX: 60, // text column: 674 px wide
  gap: 28, // visual gap between pages in the editor
} as const;

export interface DocumentCssBrand {
  primaryColor: string;
  accentColor: string;
  borderColor: string;
}

export type DocumentCssMode = 'editor' | 'print';

const FONT_STACK = `"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

export function buildDocumentCss(brand: DocumentCssBrand, mode: DocumentCssMode): string {
  const { primaryColor: primary, accentColor: accent, borderColor: border } = brand;

  const pageBreakCss =
    mode === 'print'
      ? `
.hd-body .husk-page-break { display:block; height:0; margin:0; padding:0; border:0; overflow:hidden; break-before:page; page-break-before:always; }
.hd-body .husk-page-break-tag { display:none; }`
      : `
.hd-body .husk-page-break { display:flex; align-items:center; justify-content:center; height:22px; margin:8px 0; border-top:1px dashed #cbd5e1; user-select:none; position:relative; }
.hd-body .husk-page-break-tag { position:absolute; top:-9px; background:#fff; color:${primary}; font-size:10px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; padding:1px 10px; }`;

  return `
.hd, .hd * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.hd { font-family:${FONT_STACK}; color:#1e293b; font-size:13.5px; line-height:1.6; text-rendering:geometricPrecision; font-kerning:normal; font-variant-ligatures:none; }
.hd input { font:inherit; color:inherit; letter-spacing:inherit; background:transparent; border:0; outline:0; padding:0; margin:0; width:100%; min-width:0; }

.hd-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; padding-bottom:12px; border-bottom:2px solid ${primary}; }
.hd-logo { max-height:64px; object-fit:contain; display:block; }
.hd-company { font-size:24px; font-weight:800; letter-spacing:-.01em; color:${primary}; }
.hd-right { text-align:right; font-size:11px; color:#64748b; line-height:1.45; }
.hd-right .legal { font-weight:600; color:#334155; }

.hd-titlebox { margin-top:22px; margin-bottom:18px; }
.hd .hd-title { display:block; width:100%; font-size:26px; font-weight:800; color:#0f172a; letter-spacing:-.02em; line-height:1.25; margin:0 0 6px; }
.hd .hd-subtitle { display:block; width:100%; font-size:14px; font-weight:400; color:#64748b; line-height:1.4; margin:0; }

.hd-meta, .hd-signoff-table { width:100%; border-collapse:collapse; border:1px solid ${border}; font-size:11.5px; table-layout:fixed; }
.hd-meta { margin-bottom:22px; }
.hd-meta td, .hd-signoff-table td { border:1px solid ${border}; padding:7px 11px; vertical-align:middle; word-break:break-word; }
.hd-meta .lbl { background:${accent}; color:${primary}; font-weight:600; width:18%; }
.hd-meta .val { width:32%; color:#1e293b; }
.hd-signoff-table td { vertical-align:top; padding:9px 12px; width:50%; }

.hd-signoff { margin-top:28px; break-inside:avoid; page-break-inside:avoid; }
.hd-signoff-title { font-size:16px; font-weight:700; color:${primary}; margin:0 0 8px; }
.hd-signoff-label { font-size:11px; font-weight:600; color:#64748b; display:block; margin-bottom:4px; }
.hd .hd-signoff-val { font-size:13px; font-weight:500; color:#0f172a; min-height:20px; }
.hd-signoff-img { max-height:48px; max-width:180px; object-fit:contain; display:block; }

/* Rich text body (TipTap output in the editor, same HTML in the PDF) */
.hd-body { display:flow-root; font-size:13.5px; line-height:1.6; color:#1e293b; }
.hd-body p { margin:6px 0 10px; color:#334155; }
.hd-body h1 { font-size:21px; font-weight:800; line-height:1.25; color:${primary}; margin:20px 0 8px; }
.hd-body h2 { font-size:17px; font-weight:700; line-height:1.3; color:${primary}; margin:18px 0 6px; }
.hd-body h3 { font-size:14.5px; font-weight:600; line-height:1.35; color:${primary}; margin:14px 0 4px; }
.hd-body h1, .hd-body h2, .hd-body h3 { break-after:avoid; page-break-after:avoid; }
.hd-body ul, .hd-body ol { margin:6px 0 10px; padding-left:24px; }
.hd-body li ul, .hd-body li ol { margin:0; }
.hd-body ul { list-style:disc; }
.hd-body ol { list-style:decimal; }
.hd-body li { margin:0; padding:1.5px 0; }
.hd-body li p { margin:0; }
.hd-body blockquote { border-left:3px solid ${primary}; padding-left:12px; margin:12px 0; color:#475569; font-style:italic; }
.hd-body blockquote p { margin:0; padding:3px 0 5px; }
.hd-body hr { border:0; border-top:1.5px solid ${border}; margin:18px 0; }
.hd-body img { max-width:100%; height:auto; }
.hd-body { orphans:2; widows:2; }
.hd-body h1, .hd-body h2, .hd-body h3, .hd-body img, .hd-body tr { break-inside:avoid; page-break-inside:avoid; }
.hd-body tr[data-keep] { break-after:avoid; page-break-after:avoid; }
.hd-body mark { border-radius:2px; padding:0 1px; }

/* Tables always fill the text column exactly; column widths are stored as ratios */
.hd-body table { width:100%; max-width:100%; table-layout:fixed; border-collapse:collapse; margin:14px 0; font-size:12.5px; }
.hd-body th, .hd-body td { border:1px solid ${border}; padding:8px 11px; vertical-align:middle; text-align:left; position:relative; overflow-wrap:anywhere; word-break:break-word; min-width:0; }
.hd-body th { background:${accent}; color:${primary}; font-weight:700; }
.hd-body td p, .hd-body th p { margin:0; line-height:1.4; }
.hd-body table[data-density="compact"] th, .hd-body table[data-density="compact"] td { padding:4px 9px; }
.hd-body table[data-density="spacious"] th, .hd-body table[data-density="spacious"] td { padding:14px 14px; }
${pageBreakCss}
`;
}

export function buildEditorChromeCss(): string {
  return `
.hd-edit input:hover { box-shadow:inset 0 -1px 0 #cbd5e1; }
.hd-edit input:focus { box-shadow:inset 0 -1px 0 #FF4C00; }
.hd-edit .ProseMirror { display:flow-root; outline:none; min-height:120px; white-space:pre-wrap; word-wrap:break-word; }
.hd-edit .ProseMirror p.is-editor-empty:first-child::before { color:#94a3b8; content:attr(data-placeholder); float:left; height:0; pointer-events:none; }
.hd-edit .husk-pg-spacer { pointer-events:none; user-select:none; margin:0; padding:0; border:0; }
.hd-edit table .husk-pg-repeat { pointer-events:none; user-select:none; }
.hd-edit table .husk-pg-spacer td { border:0 !important; padding:0 !important; background:transparent !important; }
.hd-edit table .selectedCell::after { content:""; position:absolute; inset:0; background:rgba(255,76,0,.14); border:1.5px solid #FF4C00; pointer-events:none; z-index:2; }
.hd-edit table td.husk-hot-col, .hd-edit table th.husk-hot-col { box-shadow:inset -3px 0 0 #FF4C00; }
.hd-edit table td.husk-hot-row, .hd-edit table th.husk-hot-row { box-shadow:inset 0 -3px 0 #FF4C00; }
.hd-edit table td.husk-hot-col.husk-hot-row, .hd-edit table th.husk-hot-col.husk-hot-row { box-shadow:inset -3px 0 0 #FF4C00, inset 0 -3px 0 #FF4C00; }
`;
}
