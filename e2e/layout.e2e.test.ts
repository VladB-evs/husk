import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Sandbox, makeSandbox, pdfPageCount, pdfPageTexts, runSession, sampleDoc, writeDocFile } from './helpers';

let box: Sandbox;
beforeEach(() => {
  box = makeSandbox();
});
afterEach(() => box.cleanup());

const paragraph = (n: number) =>
  `<p>Paragraph ${n}. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.</p>`;

function longDocument(rows = 34) {
  let body = '';
  for (let i = 1; i <= rows; i++) {
    body += `<tr><td><p>Req ${i}</p></td><td><p>Requirement text number ${i} that is long enough to wrap onto a second line in this column</p></td><td><p>Yes</p></td></tr>`;
  }
  const table = `<table><tbody><tr><th><p>ID</p></th><th><p>Requirement</p></th><th><p>Status</p></th></tr>${body}</tbody></table>`;
  const intro = Array.from({ length: 6 }, (_, i) => paragraph(i + 1)).join('');
  const outro = Array.from({ length: 6 }, (_, i) => paragraph(i + 7)).join('');
  return sampleDoc({
    id: 'doc_long',
    title: 'Long document',
    contentHtml: `<h1>Section one</h1>${intro}<h2>Checklist table</h2>${table}<h2>After the table</h2>${outro}`,
  });
}

describe('pages and PDF', () => {
  it('breaks pages at the same table rows in the editor and in the exported PDF', async () => {
    const doc = longDocument();
    writeDocFile(box, doc);
    const exportPath = path.join(box.dir, 'long.pdf');
    const { result } = runSession(box, 'layout', { exportPath, docId: doc.id });

    if (process.env.HUSK_E2E_SHOTS) fs.copyFileSync(exportPath, path.join(process.env.HUSK_E2E_SHOTS, 'long.pdf'));
    expect(result.exported.success).toBe(true);
    expect(result.info.pages).toBeGreaterThanOrEqual(3);
    expect(pdfPageCount(exportPath)).toBe(result.info.pages);
    expect(result.info.footerTexts).toHaveLength(result.info.pages);

    // The first table row on each continuation page is the same in the PDF and in the editor,
    // and the header row is repeated above it.
    const pdfPages = await pdfPageTexts(exportPath);
    const pdfStarts = pdfPages
      .slice(1)
      .map((text) => text.match(/ID Requirement Status (Req \d+)/)?.[1])
      .filter(Boolean);
    const editorStarts = result.info.firstAfterGap.map((t: string) => t.match(/^Req \d+/)?.[0]);
    expect(pdfStarts.length).toBeGreaterThan(0);
    expect(pdfStarts).toEqual(editorStarts);
  });

  it('keeps tables inside the text column and repeats the header row on every page the table continues on', () => {
    writeDocFile(box, longDocument());
    const { result } = runSession(box, 'layout', {});
    expect(result.info.tableInsidePage).toBe(true);
    expect(Math.round(result.info.tableWidth)).toBe(Math.round(result.info.pmWidth));
    expect(result.info.repeatedHeaders).toBeGreaterThanOrEqual(1);
    // no row is cut: each page starts with a whole row, never in the middle of one
    result.info.firstAfterGap.forEach((text: string | null) => expect(text).toMatch(/^Req \d+/));
  });

  it('uses the bundled Inter font', () => {
    writeDocFile(box, sampleDoc());
    const { result } = runSession(box, 'layout', {});
    expect(result.info.font).toContain('Inter Variable');
    expect(result.info.fontLoaded).toBe(true);
  });
});
