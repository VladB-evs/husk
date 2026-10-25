import { PAGE, PAGE_MM, buildDocumentCss } from './documentLayout';

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

/**
 * The footer reads "<document title> | <text>". People only write the text; the title always comes from the
 * document. A stored footer text such as "Old title | Confidential" keeps what follows the first "|".
 */
export function footerSuffix(leftText: string | undefined): string {
  const text = leftText ?? '';
  const bar = text.indexOf('|');
  return (bar < 0 ? text : text.slice(bar + 1)).trim();
}

/** The value to store for a footer text that the user typed. */
export function footerLeftTextFor(suffix: string): string {
  return suffix.trim() ? `| ${suffix.trim()}` : '';
}

export function footerLeftText(doc: any): string {
  return [String(doc.title ?? '').trim(), footerSuffix(doc.footerConfig?.leftText)].filter(Boolean).join(' | ');
}

/** Height of the running header, rule included. It sits in the top margin (PAGE_MM.marginTop is taller), so it never moves the text. */
export const RUNNING_HEADER_H = 49;

/**
 * The header that every page has: the logo (or company name) on the left, the legal name and contact on the right.
 * One string with inline styles, used for the editor pages and for the header of the PDF, so both look the same.
 */
export function buildRunningHeaderHtml(brand: any): string {
  const primary = brand?.primaryColor || '#9353d3';
  const logo = brand?.logoUrl
    ? `<img src="${escapeHtml(brand.logoUrl)}" alt="Logo" style="display:block;height:28px;width:auto;max-width:${Number(brand.logoWidth) || 140}px;object-fit:contain;object-position:left bottom">`
    : `<span style="font-size:16px;font-weight:800;letter-spacing:-.01em;line-height:1;color:${escapeHtml(primary)}">${escapeHtml(brand?.companyName || 'Company')}</span>`;
  const legal = brand?.legalEntity ? `<div style="font-weight:600;color:#334155">${escapeHtml(brand.legalEntity)}</div>` : '';
  const contact = brand?.contactInfo ? `<div>${escapeHtml(brand.contactInfo)}</div>` : '';
  return `<div style="box-sizing:border-box;width:100%;height:${RUNNING_HEADER_H}px;padding:12px 0 6px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:2px solid ${escapeHtml(primary)};font-family:'Inter Variable',Inter,-apple-system,Helvetica,Arial,sans-serif;-webkit-print-color-adjust:exact;">
    <div style="font-size:16px;line-height:1">${logo}</div>
    <div style="text-align:right;font-size:9px;line-height:1.3;color:#64748b">${legal}${contact}</div>
  </div>`;
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
${options.preview ? `<div style="position:relative;width:${PAGE_PX_W}px;height:${PAGE_PX_H}px;overflow:hidden;padding:${PAGE_MM.marginTop}mm ${PAGE_MM.marginX}mm 0;box-sizing:border-box;background:#fff"><div style="position:absolute;left:${PAGE_MM.marginX}mm;right:${PAGE_MM.marginX}mm;top:0">${buildRunningHeaderHtml(brand)}</div>` : ''}
<div class="hd">
  ${options.browserPrint ? `<header class="hd-header">
    <div>${
      brand.logoUrl
        ? `<img src="${escapeHtml(brand.logoUrl)}" class="hd-logo" style="width:${Number(brand.logoWidth) || 140}px" alt="Logo">`
        : `<span class="hd-company">${escapeHtml(brand.companyName || 'Company')}</span>`
    }</div>
    <div class="hd-right">
      ${brand.legalEntity ? `<div class="legal">${escapeHtml(brand.legalEntity)}</div>` : ''}
      ${brand.contactInfo ? `<div>${escapeHtml(brand.contactInfo)}</div>` : ''}
    </div>
  </header>` : ''}
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
        <span>${escapeHtml(doc.footerConfig?.enabled === false ? '' : footerLeftText(doc))}</span>
        <span>${doc.footerConfig?.enabled === false ? '' : 'Page 1 of 1'}</span>
      </div></div>`
    : ''
}
</body>
</html>`;
}

/**
 * Footer printed by Chromium in the bottom margin of every page ("Page 2 of 3" is filled in by Chromium).
 * It is placed with absolute coordinates (Chromium adds its own offset to text that is not placed) and has the
 * same rule, spacing and font size as the footer the editor draws on each page.
 */
export function buildFooterTemplate(doc: any, fontCss = ''): string {
  const left = footerLeftText(doc);
  return `<style>${fontCss}</style><div style="position:absolute;left:${PAGE.marginX}px;right:${PAGE.marginX}px;bottom:0;height:${PAGE.marginBottom - 12}px;box-sizing:border-box;border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between;gap:16px;font-family:'Inter Variable',Inter,-apple-system,Helvetica,Arial,sans-serif;font-size:10px;line-height:14px;color:#94a3b8;-webkit-print-color-adjust:exact;">
    <span>${escapeHtml(left)}</span>
    <span style="white-space:nowrap">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>`;
}

/** Header printed by Chromium in the top margin of every page: the same one the editor shows on each page. */
export function buildHeaderTemplate(doc: any, fontCss = ''): string {
  return `<style>${fontCss}</style><div style="position:absolute;left:${PAGE.marginX}px;right:${PAGE.marginX}px;top:0;">${buildRunningHeaderHtml(doc.branding || {})}</div>`;
}
