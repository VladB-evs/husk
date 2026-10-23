import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { PAGE } from '../src/shared/documentLayout';
import { Sandbox, makeSandbox, pdfPageTexts, runSession, sampleDoc, writeDocFile } from './helpers';

let box: Sandbox;
beforeEach(() => {
  box = makeSandbox();
});
afterEach(() => box.cleanup());

const geometry = { height: PAGE.height, marginTop: PAGE.marginTop, marginBottom: PAGE.marginBottom, gap: PAGE.gap };

/** Open the document in the editor, export it, and return what the editor and the PDF show. */
async function layoutOf(doc: any) {
  writeDocFile(box, doc);
  const exportPath = path.join(box.dir, 'out.pdf');
  const { result } = runSession(box, 'layout', { exportPath, docId: doc.id, geometry });
  expect(result.exported.success).toBe(true);
  return { info: result.info, pdfPages: await pdfPageTexts(exportPath) };
}

const words = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `w${String(from + i).padStart(4, '0')}`).join(' ');

describe('blocks taller than a page', () => {
  it('cuts a long paragraph into lines, at the same place in the editor and in the PDF', async () => {
    // about 2.5 pages of one paragraph
    const doc = sampleDoc({ id: 'doc_long_p', contentHtml: `<h1>Long paragraph</h1><p>${words(1, 1900)}</p><p>${words(2001, 2010)}</p>` });
    const { info, pdfPages } = await layoutOf(doc);

    expect(info.violations).toBe(0);
    expect(info.pages).toBe(pdfPages.length);
    const cuts = info.breaks.filter((b: any) => b.tag === 'SPAN');
    expect(cuts.length).toBeGreaterThanOrEqual(2);

    // each page after the first starts with the first word of the line the editor cut before
    const expectedStarts = cuts.map((c: any) => c.text.split(' ')[0]);
    const pdfStarts = pdfPages.slice(1, 1 + expectedStarts.length).map((t) => t.match(/w\d{4}/)?.[0]);
    expect(pdfStarts).toEqual(expectedStarts);
  });

  it('cuts a long list between items, at the same place in the editor and in the PDF', async () => {
    const items = Array.from(
      { length: 60 },
      (_, i) => `<li><p>Item ${String(i + 1).padStart(3, '0')} ${words(1, 28)}</p></li>`
    ).join('');
    const doc = sampleDoc({ id: 'doc_long_list', contentHtml: `<p>Intro</p><ul>${items}</ul><p>After the list</p>` });
    const { info, pdfPages } = await layoutOf(doc);

    expect(info.violations).toBe(0);
    expect(info.pages).toBe(pdfPages.length);
    // a cut is either before an item (LI) or inside one, between two of its lines (SPAN)
    const cuts = info.breaks.filter((b: any) => b.tag === 'LI' || b.tag === 'SPAN');
    expect(cuts.length).toBeGreaterThanOrEqual(2);
    expect(cuts.some((c: any) => c.tag === 'LI')).toBe(true);
    const firstTokens = (text: string) => text.trim().split(/\s+/).slice(0, 2).join(' ');
    const expectedStarts = cuts.map((c: any) => firstTokens(c.text));
    const pdfStarts = pdfPages.slice(1, 1 + expectedStarts.length).map(firstTokens);
    expect(pdfStarts).toEqual(expectedStarts);
  });

  it('cuts a long quote between its paragraphs', async () => {
    const paragraphs = Array.from({ length: 14 }, (_, i) => `<p>Quote part ${String(i + 1).padStart(2, '0')} ${words(1, 120)}</p>`).join('');
    const doc = sampleDoc({ id: 'doc_quote', contentHtml: `<blockquote>${paragraphs}</blockquote>` });
    const { info, pdfPages } = await layoutOf(doc);

    expect(info.violations).toBe(0);
    expect(info.pages).toBe(pdfPages.length);
    const cuts = info.breaks.filter((b: any) => b.tag === 'DIV' || b.tag === 'SPAN');
    expect(cuts.length).toBeGreaterThanOrEqual(1);
  });
});

describe('merged cells', () => {
  it('keeps rows that share a merged cell on one page, in the editor and in the PDF', async () => {
    // 12 groups of 5 rows. The first cell of each group spans its 5 rows.
    let body = '';
    for (let g = 1; g <= 12; g++) {
      for (let r = 1; r <= 5; r++) {
        const merged = r === 1 ? `<td rowspan="5"><p>Group ${String(g).padStart(2, '0')}</p></td>` : '';
        body += `<tr>${merged}<td><p>G${g}.r${r}</p></td><td><p>Some value for group ${g}, row ${r}, long enough to wrap onto two lines in this column</p></td></tr>`;
      }
    }
    const table = `<table><tbody><tr><th><p>Group</p></th><th><p>Row</p></th><th><p>Value</p></th></tr>${body}</tbody></table>`;
    const doc = sampleDoc({ id: 'doc_merged', contentHtml: `<p>Intro</p>${table}` });
    const { info, pdfPages } = await layoutOf(doc);

    expect(info.violations).toBe(0);
    expect(info.pages).toBe(pdfPages.length);
    const cuts = info.breaks.filter((b: any) => b.tag === 'TR');
    expect(cuts.length).toBeGreaterThanOrEqual(2);
    // every page starts a new group: the first row after a cut holds the merged cell
    cuts.forEach((c: any) => expect(c.text).toMatch(/^Group \d\d/));
    // and the PDF starts its pages at the same groups
    const expected = cuts.map((c: any) => c.text.match(/^Group \d\d/)?.[0]);
    const pdfStarts = pdfPages.slice(1, 1 + expected.length).map((t) => t.match(/Group Row Value (Group \d\d)/)?.[1]);
    expect(pdfStarts).toEqual(expected);
  });
});

describe('no text in the margins', () => {
  it('keeps all text of an ordinary long document inside the text area of its pages', async () => {
    const para = (n: number) => `<p>Paragraph ${n}. ${words(1, 45)}</p>`;
    const doc = sampleDoc({ id: 'doc_plain', contentHtml: Array.from({ length: 40 }, (_, i) => para(i + 1)).join('') });
    const { info } = await layoutOf(doc);
    expect(info.violations).toBe(0);
  });
});
