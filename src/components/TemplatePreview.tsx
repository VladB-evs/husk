import React, { useEffect, useMemo, useState } from 'react';
import { DocumentTemplate } from '../types';
import { buildPrintHtml } from '../shared/printDocument';
import { PAGE_MM } from '../shared/documentLayout';
import { INTER_FACE_CSS } from '../utils/fonts';

const PX_W = Math.round((PAGE_MM.width * 96) / 25.4);
const PX_H = Math.round((PAGE_MM.height * 96) / 25.4);

const SAMPLE_BODY = `<h2>Document content</h2>
<p>Headings use your brand color. Tables use your brand tint and border line.</p>
<table><tbody>
<tr><th><p>Item</p></th><th><p>Details</p></th><th><p>Status</p></th></tr>
<tr><td><p>Sample row</p></td><td><p>Value A</p></td><td><p>OK</p></td></tr>
<tr><td><p>Sample row</p></td><td><p>Value B</p></td><td><p>OK</p></td></tr>
</tbody></table>`;

/** The page a template produces: same HTML and CSS as the PDF export, shown as a page-sized frame. */
export const TemplatePreview: React.FC<{
  template: DocumentTemplate;
  scale: number;
  debounceMs?: number;
}> = ({ template, scale, debounceMs = 0 }) => {
  const html = useMemo(
    () =>
      buildPrintHtml(
        {
          title: template.titlePlaceholder || 'Document title',
          subtitle: template.subtitlePlaceholder,
          branding: template.branding,
          metadataFields: template.metadataFields,
          contentHtml: template.contentHtml?.trim() ? template.contentHtml : SAMPLE_BODY,
          signOff: template.signOffConfig,
          footerConfig: template.footerConfig,
        },
        { preview: true, fontCss: INTER_FACE_CSS }
      ),
    [template]
  );

  const [shown, setShown] = useState(html);
  useEffect(() => {
    if (!debounceMs) return setShown(html);
    const t = setTimeout(() => setShown(html), debounceMs);
    return () => clearTimeout(t);
  }, [html, debounceMs]);

  return (
    <div
      className="relative bg-white shadow-xl shrink-0 overflow-hidden"
      style={{ width: PX_W * scale, height: PX_H * scale }}
    >
      <iframe
        title={`Preview of ${template.name}`}
        srcDoc={shown}
        sandbox=""
        tabIndex={-1}
        style={{
          width: PX_W,
          height: PX_H,
          border: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
          background: '#fff',
        }}
      />
    </div>
  );
};
