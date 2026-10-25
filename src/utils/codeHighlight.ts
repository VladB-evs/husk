import { common, createLowlight } from 'lowlight';

/** One highlighter for the editor and for the PDF, so both color code the same way. */
export const lowlight = createLowlight(common);

const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescapeText = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');

function toHtml(node: any): string {
  if (node.type === 'text') return escapeText(node.value);
  const inner = (node.children || []).map(toHtml).join('');
  if (node.type !== 'element') return inner;
  const cls = (node.properties?.className || []).join(' ');
  return `<span class="${cls}">${inner}</span>`;
}

/**
 * The editor saves code blocks as plain text (<pre><code>…</code></pre>) and colors them on screen only.
 * This adds the color spans, so the PDF shows the same colors as the page.
 */
export function highlightCodeInHtml(html: string): string {
  return html.replace(/<pre><code(?: class="language-([\w-]+)")?>([\s\S]*?)<\/code><\/pre>/g, (whole, lang, code) => {
    try {
      const text = unescapeText(code);
      const tree = lang && lowlight.registered(lang) ? lowlight.highlight(lang, text) : lowlight.highlightAuto(text);
      return `<pre><code>${tree.children.map(toHtml).join('')}</code></pre>`;
    } catch {
      return whole;
    }
  });
}
