import { PAGE_MM, buildDocumentCss } from './documentLayout';

// Builds the standalone HTML that is printed to PDF. It uses the same markup classes and the same CSS
// as the editor page (see documentLayout.ts), so pages break in the PDF where they break on screen.

export function escapeHtml(str: unknown): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const PAGE_PX_W = Math.round((PAGE_MM.width * 96) / 25.4);
const PAGE_PX_H = Math.round((PAGE_MM.height * 96) / 25.4);

// The printed page needs no script, network or navigation. Local images (file:) and embedded ones (data:) are allowed.
const PRINT_CSP =
  "default-src 'none'; img-src data: file:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'";

/**
 * Rows that share a merged cell (rowspan) must stay on one page, so every row but the last of such a group
 * is marked "do not break after". The editor keeps the same rows together.
 */
export function markRowGroups(html: string): string {
  return html.replace(/<table\b[\s\S]*?<\/table>/g, (table) => {
    let r = 0;
    let through = -1; // last row covered by a merged cell seen so far
    return table.replace(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g, (whole, attrs: string, inner: string) => {
      const spans = Array.from(inner.matchAll(/<t[dh]\b[^>]*\browspan="(\d+)"/g), (m) => Number(m[1]));
      through = Math.max(through, r + Math.max(1, ...spans) - 1);
      const keep = through > r;
      r += 1;
      return keep ? `<tr${attrs} data-keep="1">${inner}</tr>` : whole;
    });
  });
}

/**
 * A table whose first row holds only header cells gets that row in <thead>, so Chromium repeats it at the
 * top of every page the table continues on. The editor shows the same repeated header.
 */
export function promoteHeaderRows(html: string): string {
  return html.replace(
    /<tbody>(\s*<tr\b[^>]*>(?:\s*<th\b[^>]*>(?:(?!<\/th>)[\s\S])*<\/th>)+\s*<\/tr>)/g,
    '<thead>$1</thead><tbody>'
  );
}

export function buildPrintHtml(doc: any, options: { browserPrint?: boolean; preview?: boolean; fontCss?: string } = {}): string {
  const brand = doc.branding || {};
  const colors = {
    primaryColor: brand.primaryColor || '#9353d3',
    accentColor: brand.accentColor || '#f6f3ff',
    borderColor: brand.borderColor || '#ede9fe',
  };

  const metaFields: any[] = doc.metadataFields || [];
  const metaRows: string[] = [];
  for (let i = 0; i < metaFields.length; i += 2) {
    const a = metaFields[i];
    const b = metaFields[i + 1];
    metaRows.push(`<tr>
      <td class="lbl">${escapeHtml(a.label)}</td><td class="val">${escapeHtml(a.value || '—')}</td>
      ${
        b
          ? `<td class="lbl">${escapeHtml(b.label)}</td><td class="val">${escapeHtml(b.value || '—')}</td>`
          : '<td class="lbl"></td><td class="val"></td>'
      }
    </tr>`);
  }

  let body = (doc.contentHtml || '').trim();
  if (body === '<p></p>' || body === '<p><br></p>') body = '';
  // The editor shows an empty paragraph as one empty line; make the printed page do the same.
  body = promoteHeaderRows(markRowGroups(body.replace(/<p\b([^>]*)><\/p>/g, '<p$1><br></p>')));

  const so = doc.signOff;
  const signOff =
    so && so.enabled !== false
      ? `<div class="hd-signoff">
          <div class="hd-signoff-title">${escapeHtml(so.title || 'Sign-off')}</div>
          <table class="hd-signoff-table"><tbody>
            <tr>
              <td><span class="hd-signoff-label">Name</span><div class="hd-signoff-val">${escapeHtml(so.name || '—')}</div></td>
              <td><span class="hd-signoff-label">Role</span><div class="hd-signoff-val">${escapeHtml(so.role || '—')}</div></td>
            </tr>
            <tr>
              <td><span class="hd-signoff-label">Date</span><div class="hd-signoff-val">${escapeHtml(so.date || '—')}</div></td>
              <td><span class="hd-signoff-label">Signature</span>
                <div class="hd-signoff-val" style="min-height:56px;display:flex;align-items:center">
                  ${
                    so.signatureUrl
                      ? `<img src="${escapeHtml(so.signatureUrl)}" class="hd-signoff-img" alt="Signature">`
                      : '<span style="color:#94a3b8;font-style:italic;font-size:11px">Unsigned</span>'
                  }
                </div>
              </td>
            </tr>
          </tbody></table>
        </div>`
      : '';

  const pageRule = options.browserPrint
    ? `@page { size: A4 portrait; margin: ${PAGE_MM.marginTop}mm ${PAGE_MM.marginX}mm ${PAGE_MM.marginBottom}mm; }`
    : '@page { size: A4 portrait; }';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(doc.title || 'Document')}</title>
<meta http-equiv="Content-Security-Policy" content="${PRINT_CSP}">
<style>
${options.fontCss || ''}
${pageRule}
html, body { margin:0; padding:0; background:#ffffff; }
${buildDocumentCss(colors, 'print')}
</style>
</head>
<body>
${options.preview ? `<div style="position:relative;width:${PAGE_PX_W}px;height:${PAGE_PX_H}px;overflow:hidden;padding:${PAGE_MM.marginTop}mm ${PAGE_MM.marginX}mm 0;box-sizing:border-box;background:#fff">` : ''}
<div class="hd">
  <header class="hd-header">
    <div>${
      brand.logoUrl
        ? `<img src="${escapeHtml(brand.logoUrl)}" class="hd-logo" style="width:${Number(brand.logoWidth) || 140}px" alt="Logo">`
        : `<span class="hd-company">${escapeHtml(brand.companyName || 'Company')}</span>`
    }</div>
    <div class="hd-right">
      ${brand.legalEntity ? `<div class="legal">${escapeHtml(brand.legalEntity)}</div>` : ''}
      ${brand.contactInfo ? `<div>${escapeHtml(brand.contactInfo)}</div>` : ''}
    </div>
  </header>
  <div class="hd-titlebox">
    <h1 class="hd-title">${escapeHtml(doc.title || 'Document title')}</h1>
    ${doc.subtitle ? `<p class="hd-subtitle">${escapeHtml(doc.subtitle)}</p>` : ''}
  </div>
  ${metaRows.length ? `<table class="hd-meta"><tbody>${metaRows.join('')}</tbody></table>` : ''}
  <div class="hd-body">${body}</div>
  ${signOff}
</div>
${
  options.preview
    ? `<div style="position:absolute;left:${PAGE_MM.marginX}mm;right:${PAGE_MM.marginX}mm;bottom:${PAGE_MM.marginBottom - 12 / 3.7795}mm;display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:6px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:10px;color:#94a3b8">
        <span>${escapeHtml(doc.footerConfig?.enabled === false ? '' : doc.footerConfig?.leftText || '')}</span>
        <span>${doc.footerConfig?.enabled === false ? '' : 'Page 1 of 1'}</span>
      </div></div>`
    : ''
}
</body>
</html>`;
}

/** Footer printed by Chromium in the bottom margin of every page ("Page 2 of 3" is filled in by Chromium). */
export function buildFooterTemplate(doc: any, fontCss = ''): string {
  const left = doc.footerConfig?.leftText || (doc.title ? `${doc.title} | Confidential` : 'Confidential');
  return `<style>${fontCss}</style><div style="width:100%;box-sizing:border-box;padding:0 ${PAGE_MM.marginX}mm;font-family:'Inter Variable',Inter,-apple-system,Helvetica,Arial,sans-serif;font-size:8px;color:#94a3b8;-webkit-print-color-adjust:exact;">
    <div style="display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;padding-top:6px;">
      <span>${escapeHtml(left)}</span>
      <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>
  </div>`;
}
