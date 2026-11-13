import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DOMParser as PMDOMParser } from '@tiptap/pm/model';
import type { Slice } from '@tiptap/pm/model';

/**
 * MarkdownPaste — intercepts pasted plain text that looks like Markdown and
 * converts it to the TipTap-compatible HTML used by HUSK. The result is styled
 * automatically by the document's CSS (headings, tables, code blocks, etc.).
 *
 * When the clipboard already carries `text/html` (a paste from a browser, Word,
 * Google Docs, etc.) TipTap's built-in HTML paste is used instead — this
 * extension only activates for raw text that looks like Markdown.
 */

// ─── Markdown detection ──────────────────────────────────────────────

/** Quick check: does the plain text look like it contains Markdown formatting? */
function looksLikeMarkdown(text: string): boolean {
  const lines = text.split('\n');
  let signals = 0;
  for (const line of lines) {
    const t = line.trimStart();
    if (/^#{1,6}\s/.test(t)) signals++;                // headings
    if (/^[-*+]\s/.test(t)) signals++;                 // unordered list
    if (/^\d+[.)]\s/.test(t)) signals++;               // ordered list
    if (/^>\s/.test(t)) signals++;                     // blockquote
    if (/^```/.test(t)) signals++;                     // fenced code
    if (/^---\s*$|^\*\*\*\s*$|^___\s*$/.test(t)) signals++; // hr
    if (/\|.+\|/.test(t) && t.includes('|')) signals++; // table row
    if (/\*\*[^*]+\*\*/.test(t)) signals++;            // bold
    if (/\*[^*]+\*/.test(t)) signals++;                // italic
    if (/`[^`]+`/.test(t)) signals++;                  // inline code
    if (/\[.+?\]\(.+?\)/.test(t)) signals++;           // link
    if (/!\[.*?\]\(.+?\)/.test(t)) signals++;          // image
    if (signals >= 2) return true;                     // confident enough
  }
  return false;
}

// ─── Markdown → HTML conversion ──────────────────────────────────────

/** Escape HTML special characters. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Convert inline Markdown (bold, italic, code, links, images, strikethrough) to HTML. */
function inlineToHtml(text: string): string {
  let out = esc(text);

  // images: ![alt](src)
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  // links: [text](href)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // inline code (must come before bold/italic so backtick-wrapped text isn't mangled)
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold + italic: ***text*** or ___text___
  out = out.replace(/\*{3}(.+?)\*{3}/g, '<strong><em>$1</em></strong>');
  out = out.replace(/_{3}(.+?)_{3}/g, '<strong><em>$1</em></strong>');
  // bold: **text** or __text__
  out = out.replace(/\*{2}(.+?)\*{2}/g, '<strong>$1</strong>');
  out = out.replace(/_{2}(.+?)_{2}/g, '<strong>$1</strong>');
  // italic: *text* or _text_
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  out = out.replace(/(?<=\s|^)_([^_]+)_(?=[\s.,;:!?)]|$)/g, '<em>$1</em>');
  // strikethrough: ~~text~~
  out = out.replace(/~~(.+?)~~/g, '<s>$1</s>');
  // highlight: ==text==
  out = out.replace(/==(.+?)==/g, '<mark>$1</mark>');

  return out;
}

interface ListItem {
  indent: number;
  ordered: boolean;
  html: string;
}

/**
 * Recursively build nested list HTML from a flat array of items with indentation levels.
 */
function buildListHtml(items: ListItem[], from: number, baseIndent: number): { html: string; consumed: number } {
  if (from >= items.length) return { html: '', consumed: 0 };

  const ordered = items[from].ordered;
  const tag = ordered ? 'ol' : 'ul';
  let html = `<${tag}>`;
  let i = from;

  while (i < items.length && items[i].indent >= baseIndent) {
    if (items[i].indent > baseIndent) {
      // Nested list — attach to the previous <li>
      const nested = buildListHtml(items, i, items[i].indent);
      html = html.replace(/<\/li>$/, '') + nested.html + '</li>';
      i += nested.consumed;
    } else {
      html += `<li><p>${items[i].html}</p></li>`;
      i++;
    }
  }

  html += `</${tag}>`;
  return { html, consumed: i - from };
}

/** Parse a full Markdown string into an HTML string compatible with HUSK's TipTap schema. */
function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // ── Fenced code block ───────────────────────────────────────
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(esc(lines[i]));
        i++;
      }
      i++; // skip closing ```
      const langAttr = lang ? ` class="language-${esc(lang)}"` : '';
      blocks.push(`<pre><code${langAttr}>${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    // ── Heading ─────────────────────────────────────────────────
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3); // HUSK supports h1–h3
      blocks.push(`<h${level}>${inlineToHtml(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // ── Horizontal rule ─────────────────────────────────────────
    if (/^(---+|\*\*\*+|___+)\s*$/.test(trimmed)) {
      blocks.push('<hr>');
      i++;
      continue;
    }

    // ── Table ───────────────────────────────────────────────────
    if (trimmed.includes('|') && i + 1 < lines.length) {
      const nextTrimmed = (lines[i + 1] ?? '').trimStart();
      if (/^\|?\s*[-:]+[-|\s:]*$/.test(nextTrimmed)) {
        const parseRow = (row: string): string[] => {
          let r = row.trim();
          if (r.startsWith('|')) r = r.slice(1);
          if (r.endsWith('|')) r = r.slice(0, -1);
          return r.split('|').map((c) => c.trim());
        };

        const headerCells = parseRow(trimmed);
        i += 2; // skip header + separator

        let tableHtml = '<table><tbody><tr>';
        for (const cell of headerCells) {
          tableHtml += `<th><p>${inlineToHtml(cell)}</p></th>`;
        }
        tableHtml += '</tr>';

        while (i < lines.length && lines[i].trimStart().includes('|')) {
          const cells = parseRow(lines[i]);
          tableHtml += '<tr>';
          for (let c = 0; c < headerCells.length; c++) {
            tableHtml += `<td><p>${inlineToHtml(cells[c] ?? '')}</p></td>`;
          }
          tableHtml += '</tr>';
          i++;
        }

        tableHtml += '</tbody></table>';
        blocks.push(tableHtml);
        continue;
      }
    }

    // ── Blockquote ──────────────────────────────────────────────
    if (trimmed.startsWith('> ') || trimmed === '>') {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const qt = lines[i].trimStart();
        if (qt.startsWith('> ')) {
          quoteLines.push(qt.slice(2));
        } else if (qt === '>') {
          quoteLines.push('');
        } else {
          break;
        }
        i++;
      }
      // Each contiguous run of non-empty lines becomes a <p> inside the blockquote
      const paragraphs: string[] = [];
      let current: string[] = [];
      for (const ql of quoteLines) {
        if (ql === '' && current.length) {
          paragraphs.push(`<p>${current.map(inlineToHtml).join(' ')}</p>`);
          current = [];
        } else if (ql !== '') {
          current.push(ql);
        }
      }
      if (current.length) paragraphs.push(`<p>${current.map(inlineToHtml).join(' ')}</p>`);
      blocks.push(`<blockquote>${paragraphs.join('')}</blockquote>`);
      continue;
    }

    // ── List (unordered or ordered) ─────────────────────────────
    if (/^[-*+]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) {
      const listItems: ListItem[] = [];
      while (i < lines.length) {
        const lt = lines[i];
        const ltTrimmed = lt.trimStart();
        const indent = lt.length - ltTrimmed.length;
        const ulMatch = ltTrimmed.match(/^[-*+]\s+(.*)$/);
        const olMatch = ltTrimmed.match(/^\d+[.)]\s+(.*)$/);
        if (!ulMatch && !olMatch) break;
        const isOrdered = !!olMatch;
        const content = isOrdered ? olMatch![1] : ulMatch![1];
        listItems.push({
          indent,
          ordered: isOrdered,
          html: inlineToHtml(content),
        });
        i++;
      }
      const { html } = buildListHtml(listItems, 0, listItems[0].indent);
      blocks.push(html);
      continue;
    }

    // ── Blank line ──────────────────────────────────────────────
    if (trimmed === '') {
      i++;
      continue;
    }

    // ── Paragraph (default) — collect continuation lines ────────
    const paraLines: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const next = lines[i].trimStart();
      if (
        next === '' ||
        /^#{1,6}\s/.test(next) ||
        /^[-*+]\s/.test(next) ||
        /^\d+[.)]\s/.test(next) ||
        /^>\s/.test(next) ||
        /^```/.test(next) ||
        /^(---+|\*\*\*+|___+)\s*$/.test(next) ||
        (next.includes('|') && lines[i + 1]?.trimStart().match(/^\|?\s*[-:]+[-|\s:]*$/))
      ) break;
      paraLines.push(next);
      i++;
    }
    blocks.push(`<p>${paraLines.map(inlineToHtml).join(' ')}</p>`);
  }

  return blocks.join('');
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Detect HTML that comes from a code editor (VS Code, JetBrains, etc.)
 * rather than a rich document. These editors wrap code in styled divs
 * but the plain text version is more useful as Markdown.
 */
function isCodeEditorHtml(html: string): boolean {
  if (html.includes('vscode-') || html.includes('data-vscode')) return true;
  if (html.includes('JetBrains') || html.includes('intellij')) return true;
  return false;
}

// ─── TipTap extension ────────────────────────────────────────────────

const mdPasteKey = new PluginKey('huskMarkdownPaste');

export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  addProseMirrorPlugins() {
    const schema = this.editor.schema;

    return [
      new Plugin({
        key: mdPasteKey,
        props: {
          handlePaste(view, event) {
            const data = event.clipboardData;
            if (!data) return false;

            const html = data.getData('text/html');
            const text = data.getData('text/plain');

            if (!text) return false;

            // If there's rich HTML from a real editor (not a code editor), let TipTap handle it.
            if (html && !isCodeEditorHtml(html)) return false;

            // Only process text that looks like Markdown.
            if (!looksLikeMarkdown(text)) return false;

            event.preventDefault();

            // Convert to HTML and parse into a ProseMirror Slice.
            const converted = markdownToHtml(text);
            const wrapper = document.createElement('div');
            wrapper.innerHTML = converted;

            const parser = PMDOMParser.fromSchema(schema);
            const slice: Slice = parser.parseSlice(wrapper);

            const tr = view.state.tr.replaceSelection(slice);
            view.dispatch(tr.scrollIntoView());
            return true;
          },
        },
      }),
    ];
  },
});
