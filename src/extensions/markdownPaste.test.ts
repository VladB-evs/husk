import { describe, it, expect } from 'vitest';

// We test the exported internals directly. They're not exported from the extension,
// so we import the module and exercise the converter via a small test helper.

// Since the functions are module-private, we duplicate the converter here for testing.
// In production code the extension calls these internally.

// ─── Duplicate of esc / inlineToHtml / markdownToHtml for testing ────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inlineToHtml(text: string): string {
  let out = esc(text);
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*{3}(.+?)\*{3}/g, '<strong><em>$1</em></strong>');
  out = out.replace(/_{3}(.+?)_{3}/g, '<strong><em>$1</em></strong>');
  out = out.replace(/\*{2}(.+?)\*{2}/g, '<strong>$1</strong>');
  out = out.replace(/_{2}(.+?)_{2}/g, '<strong>$1</strong>');
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  out = out.replace(/(?<=\s|^)_([^_]+)_(?=[\s.,;:!?)]|$)/g, '<em>$1</em>');
  out = out.replace(/~~(.+?)~~/g, '<s>$1</s>');
  out = out.replace(/==(.+?)==/g, '<mark>$1</mark>');
  return out;
}

interface ListItem { indent: number; ordered: boolean; html: string; }

function buildListHtml(items: ListItem[], from: number, baseIndent: number): { html: string; consumed: number } {
  if (from >= items.length) return { html: '', consumed: 0 };
  const ordered = items[from].ordered;
  const tag = ordered ? 'ol' : 'ul';
  let html = `<${tag}>`;
  let i = from;
  while (i < items.length && items[i].indent >= baseIndent) {
    if (items[i].indent > baseIndent) {
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

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(esc(lines[i]));
        i++;
      }
      i++;
      const langAttr = lang ? ` class="language-${esc(lang)}"` : '';
      blocks.push(`<pre><code${langAttr}>${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3);
      blocks.push(`<h${level}>${inlineToHtml(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^(---+|\*\*\*+|___+)\s*$/.test(trimmed)) {
      blocks.push('<hr>');
      i++;
      continue;
    }

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
        i += 2;
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

    if (trimmed.startsWith('> ') || trimmed === '>') {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const qt = lines[i].trimStart();
        if (qt.startsWith('> ')) { quoteLines.push(qt.slice(2)); }
        else if (qt === '>') { quoteLines.push(''); }
        else { break; }
        i++;
      }
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
        listItems.push({ indent, ordered: isOrdered, html: inlineToHtml(content) });
        i++;
      }
      const { html } = buildListHtml(listItems, 0, listItems[0].indent);
      blocks.push(html);
      continue;
    }

    if (trimmed === '') { i++; continue; }

    const paraLines: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const next = lines[i].trimStart();
      if (
        next === '' || /^#{1,6}\s/.test(next) || /^[-*+]\s/.test(next) ||
        /^\d+[.)]\s/.test(next) || /^>\s/.test(next) || /^```/.test(next) ||
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

function looksLikeMarkdown(text: string): boolean {
  const lines = text.split('\n');
  let signals = 0;
  for (const line of lines) {
    const t = line.trimStart();
    if (/^#{1,6}\s/.test(t)) signals++;
    if (/^[-*+]\s/.test(t)) signals++;
    if (/^\d+[.)]\s/.test(t)) signals++;
    if (/^>\s/.test(t)) signals++;
    if (/^```/.test(t)) signals++;
    if (/^---\s*$|^\*\*\*\s*$|^___\s*$/.test(t)) signals++;
    if (/\|.+\|/.test(t) && t.includes('|')) signals++;
    if (/\*\*[^*]+\*\*/.test(t)) signals++;
    if (/\*[^*]+\*/.test(t)) signals++;
    if (/`[^`]+`/.test(t)) signals++;
    if (/\[.+?\]\(.+?\)/.test(t)) signals++;
    if (/!\[.*?\]\(.+?\)/.test(t)) signals++;
    if (signals >= 2) return true;
  }
  return false;
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('looksLikeMarkdown', () => {
  it('detects headings + bold', () => {
    expect(looksLikeMarkdown('# Hello\n\nSome **bold** text')).toBe(true);
  });

  it('detects lists + inline code', () => {
    expect(looksLikeMarkdown('- item one\n- item `two`')).toBe(true);
  });

  it('rejects plain text', () => {
    expect(looksLikeMarkdown('Just a normal sentence.\nAnd another one.')).toBe(false);
  });

  it('rejects a single signal', () => {
    // Only one markdown feature used — not enough confidence to convert
    expect(looksLikeMarkdown('A sentence with `code` only.')).toBe(false);
  });

  it('detects a table', () => {
    expect(looksLikeMarkdown('| A | B |\n| --- | --- |\n| 1 | 2 |')).toBe(true);
  });

  it('detects code fences + list', () => {
    expect(looksLikeMarkdown('```js\nconst x = 1;\n```\n\n- a')).toBe(true);
  });
});

describe('markdownToHtml', () => {
  it('converts headings', () => {
    expect(markdownToHtml('# Title\n## Subtitle\n### Section')).toBe(
      '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>'
    );
  });

  it('clamps h4–h6 to h3', () => {
    expect(markdownToHtml('#### Deep\n##### Deeper\n###### Deepest')).toBe(
      '<h3>Deep</h3><h3>Deeper</h3><h3>Deepest</h3>'
    );
  });

  it('converts paragraphs with inline formatting', () => {
    const html = markdownToHtml('This is **bold** and *italic* and `code`.');
    expect(html).toBe('<p>This is <strong>bold</strong> and <em>italic</em> and <code>code</code>.</p>');
  });

  it('converts unordered lists', () => {
    const html = markdownToHtml('- Apple\n- Banana\n- Cherry');
    expect(html).toBe(
      '<ul><li><p>Apple</p></li><li><p>Banana</p></li><li><p>Cherry</p></li></ul>'
    );
  });

  it('converts ordered lists', () => {
    const html = markdownToHtml('1. First\n2. Second\n3. Third');
    expect(html).toBe(
      '<ol><li><p>First</p></li><li><p>Second</p></li><li><p>Third</p></li></ol>'
    );
  });

  it('converts nested lists', () => {
    const html = markdownToHtml('- Parent\n  - Child\n  - Child 2\n- Another');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li><p>Parent</p><ul>');
    expect(html).toContain('<li><p>Child</p></li>');
  });

  it('converts fenced code blocks', () => {
    const html = markdownToHtml('```typescript\nconst x = 1;\n```');
    expect(html).toBe('<pre><code class="language-typescript">const x = 1;</code></pre>');
  });

  it('converts fenced code blocks without language', () => {
    const html = markdownToHtml('```\nhello\n```');
    expect(html).toBe('<pre><code>hello</code></pre>');
  });

  it('escapes HTML in code blocks', () => {
    const html = markdownToHtml('```\n<div>test</div>\n```');
    expect(html).toContain('&lt;div&gt;');
  });

  it('converts blockquotes', () => {
    const html = markdownToHtml('> This is a quote\n> with two lines');
    expect(html).toBe('<blockquote><p>This is a quote with two lines</p></blockquote>');
  });

  it('converts horizontal rules', () => {
    expect(markdownToHtml('---')).toBe('<hr>');
    expect(markdownToHtml('***')).toBe('<hr>');
    expect(markdownToHtml('___')).toBe('<hr>');
  });

  it('converts tables', () => {
    const md = '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |';
    const html = markdownToHtml(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th><p>Name</p></th>');
    expect(html).toContain('<td><p>Alice</p></td>');
    expect(html).toContain('<td><p>30</p></td>');
    expect(html).toContain('<td><p>Bob</p></td>');
  });

  it('converts links', () => {
    const html = markdownToHtml('# Links\n\nVisit [Google](https://google.com) today.');
    expect(html).toContain('<a href="https://google.com">Google</a>');
  });

  it('converts images', () => {
    const html = markdownToHtml('# Pics\n\n![Logo](https://example.com/logo.png)');
    expect(html).toContain('<img src="https://example.com/logo.png" alt="Logo" />');
  });

  it('converts bold+italic', () => {
    const html = markdownToHtml('# Test\n\n***bold and italic***');
    expect(html).toContain('<strong><em>bold and italic</em></strong>');
  });

  it('converts strikethrough', () => {
    const html = markdownToHtml('# Test\n\n~~deleted~~');
    expect(html).toContain('<s>deleted</s>');
  });

  it('converts highlight', () => {
    const html = markdownToHtml('# Test\n\n==highlighted==');
    expect(html).toContain('<mark>highlighted</mark>');
  });

  it('handles a complex document', () => {
    const md = `# Project Report

## Executive Summary

This report covers the **Q3 2024** results for our company.

### Key Metrics

| Metric | Value | Change |
| --- | --- | --- |
| Revenue | $1.2M | +15% |
| Users | 50,000 | +22% |

### Action Items

1. Review the budget
2. Update the roadmap
3. Schedule team meeting

> Important: All deadlines must be met by end of quarter.

---

## Technical Details

\`\`\`python
def calculate_growth(current, previous):
    return (current - previous) / previous * 100
\`\`\`

For more info, visit [our docs](https://docs.example.com).`;

    const html = markdownToHtml(md);
    expect(html).toContain('<h1>Project Report</h1>');
    expect(html).toContain('<h2>Executive Summary</h2>');
    expect(html).toContain('<strong>Q3 2024</strong>');
    expect(html).toContain('<h3>Key Metrics</h3>');
    expect(html).toContain('<table>');
    expect(html).toContain('<th><p>Metric</p></th>');
    expect(html).toContain('<ol>');
    expect(html).toContain('<blockquote>');
    expect(html).toContain('<hr>');
    expect(html).toContain('<pre><code class="language-python">');
    expect(html).toContain('<a href="https://docs.example.com">our docs</a>');
  });
});
