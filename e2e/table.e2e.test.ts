import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Sandbox, makeSandbox, runSession, sampleDoc, writeDocFile } from './helpers';

let box: Sandbox;
beforeEach(() => {
  box = makeSandbox();
});
afterEach(() => box.cleanup());

function tableDocument() {
  const rows = Array.from(
    { length: 30 },
    (_, i) => `<tr><td><p>Req ${i + 1}</p></td><td><p>Requirement text ${i + 1} that wraps onto a second line</p></td><td><p>Yes</p></td></tr>`
  ).join('');
  return sampleDoc({
    id: 'doc_table',
    contentHtml: `<p>Intro</p><table><tbody><tr><th><p>ID</p></th><th><p>Requirement</p></th><th><p>Status</p></th></tr>${rows}</tbody></table><p>After</p>`,
  });
}

describe('table editing with the mouse', () => {
  it('moves column borders without ever making the table wider than the page', () => {
    writeDocFile(box, tableDocument());
    const { result } = runSession(box, 'table-resize');

    expect(result.colCursor).toBe('col-resize');
    // all columns start equal
    result.before.cols.forEach((c: number) => expect(c).toBeCloseTo(33.33, 1));

    // +120px moves width from the next column into this one; the table keeps its width
    expect(result.afterNarrow.cols[0]).toBeGreaterThan(result.before.cols[0] + 10);
    expect(result.afterNarrow.cols[1]).toBeLessThan(result.before.cols[1] - 10);
    expect(result.afterNarrow.cols[2]).toBeCloseTo(result.before.cols[2], 1);
    expect(Math.round(result.afterNarrow.tableWidth)).toBe(Math.round(result.before.tableWidth));

    // a drag far past the page edge stops at the neighbour's minimum width
    expect(result.afterWide.inside).toBe(true);
    expect(Math.round(result.afterWide.tableWidth)).toBe(Math.round(result.before.tableWidth));
    expect(result.afterWide.cols.reduce((a: number, b: number) => a + b, 0)).toBeCloseTo(100, 1);
    expect(Math.min(...result.afterWide.cols)).toBeGreaterThan(4);
  });

  it('sets the height of a row by dragging its bottom border, and undo reverts one drag at a time', () => {
    writeDocFile(box, tableDocument());
    const { result } = runSession(box, 'table-resize');

    expect(result.rowCursor).toBe('row-resize');
    const rowIndex = 16;
    expect(result.afterRowGrow.rowHeights[rowIndex]).toBeCloseTo(result.rowStart + 60, 0);
    expect(Number(result.afterRowGrow.rowAttr[rowIndex])).toBeCloseTo(result.rowStart + 60, 0);
    expect(result.afterRowShrink.rowHeights[rowIndex]).toBeLessThan(result.afterRowGrow.rowHeights[rowIndex] - 30);

    // undo: back to the grown height (the shrink was one undo step)
    expect(result.afterUndo.rowHeights[rowIndex]).toBeCloseTo(result.afterRowGrow.rowHeights[rowIndex], 0);
  });
});
