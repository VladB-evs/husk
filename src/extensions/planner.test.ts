import { describe, expect, it } from 'vitest';
import { BlockInput, PieceInput, PlanInput, planPages } from './planner';

// A small page keeps the numbers readable: 1000 high, 100 margin top and bottom, 800 of content.
const geometry = { height: 1000, marginTop: 100, marginBottom: 100, gap: 50 };
const PITCH = 1050;
const base = (over: Partial<PlanInput> = {}): PlanInput => ({ editorTop: 100, blocks: [], signoff: null, geometry, safety: 0, ...over });
const block = (pos: number, h: number, over: Partial<BlockInput> = {}): BlockInput => ({
  kind: 'block',
  pos,
  h,
  mt: 0,
  mb: 0,
  leadingH: h,
  ...over,
});

describe('planPages', () => {
  it('needs one page and no spacers when everything fits', () => {
    const plan = planPages(base({ blocks: [block(0, 300), block(10, 300)] }));
    expect(plan.spacers).toEqual([]);
    expect(plan.pages).toBe(1);
  });

  it('moves a block that would cross the page edge to the top of the next page', () => {
    // content ends at y=900; the second block would run from 600 to 1000
    const plan = planPages(base({ blocks: [block(0, 500), block(10, 400)] }));
    expect(plan.spacers).toEqual([{ kind: 'block', pos: 10, h: PITCH + 100 - 600 }]);
    expect(plan.pages).toBe(2);
  });

  it('accounts for the block margins when it computes the spacer', () => {
    const plan = planPages(base({ blocks: [block(0, 500, { mb: 20 }), block(10, 400, { mt: 30 })] }));
    // natural top = 600 + max(20, 30) = 630 -> would end at 1030, so move to 1150; spacer = 1150 - (600 + 20) - 30
    expect(plan.spacers[0].h).toBe(1150 - 620 - 30);
  });

  it('moves a block that would start inside the bottom margin', () => {
    // the first block ends at y=890; the margin before the second block puts its top at 910, below the content area (900)
    const plan = planPages(base({ blocks: [block(0, 790), block(10, 50, { mt: 20 })] }));
    expect(plan.spacers.map((s) => s.pos)).toEqual([10]);
    expect(plan.pages).toBe(2);
  });

  it('does not move a block that is taller than a whole page', () => {
    const plan = planPages(base({ blocks: [block(0, 100), block(10, 900)] }));
    expect(plan.spacers).toEqual([]);
  });

  it('keeps a heading with the block that follows it', () => {
    const heading = block(10, 40, { kind: 'heading', mb: 10 });
    const next = block(20, 200, { mt: 10 });
    // heading alone fits (y 800..840) but heading + next does not
    const plan = planPages(base({ blocks: [block(0, 700), heading, next] }));
    expect(plan.spacers.map((s) => s.pos)).toEqual([10]);
  });

  it('starts the block after a page break on a new page', () => {
    const plan = planPages(base({ blocks: [block(0, 100), block(10, 20, { kind: 'pageBreak' }), block(20, 100)] }));
    expect(plan.spacers.map((s) => s.pos)).toEqual([20]);
    expect(plan.pages).toBe(2);
  });

  it('counts an empty page after a page break at the end', () => {
    const plan = planPages(base({ blocks: [block(0, 100), block(10, 20, { kind: 'pageBreak' })] }));
    expect(plan.pages).toBe(2);
  });

  it('pushes the sign-off block to the next page when it does not fit', () => {
    const plan = planPages(base({ blocks: [block(0, 700)], signoff: { h: 150, margin: 28 } }));
    expect(plan.signoffPush).toBeGreaterThan(0);
    expect(plan.pages).toBe(2);
  });

  it('leaves the sign-off block where it is when it fits', () => {
    const plan = planPages(base({ blocks: [block(0, 300)], signoff: { h: 150, margin: 28 } }));
    expect(plan.signoffPush).toBe(0);
    expect(plan.pages).toBe(1);
  });

  describe('tables', () => {
    const table = (rowCount: number, rowH: number, headerRow: boolean): BlockInput => ({
      kind: 'table',
      pos: 0,
      h: rowCount * rowH,
      mt: 0,
      mb: 0,
      leadingH: headerRow ? rowH * 2 : rowH,
      headerRow,
      naturalHeight: rowCount * rowH,
      rows: Array.from({ length: rowCount }, (_, i) => ({ pos: 1 + i * 10, top: i * rowH, h: rowH })),
    });

    it('splits a table between rows, never inside one', () => {
      // 800 of content, rows of 300: two rows per page
      const plan = planPages(base({ blocks: [table(5, 300, false)] }));
      expect(plan.spacers.map((s) => s.pos)).toEqual([21, 41]);
      expect(plan.spacers.every((s) => s.kind === 'row')).toBe(true);
      expect(plan.pages).toBe(3);
    });

    it('repeats the header row on each page the table continues on', () => {
      const plan = planPages(base({ blocks: [table(7, 200, true)] }));
      expect(plan.spacers.length).toBeGreaterThan(0);
      plan.spacers.forEach((s) => expect(s.repeatHeader).toBe(true));
    });

    it('makes room for the repeated header: continuation pages hold one row less', () => {
      // page 1: header + 3 rows (800); continuation: header + 3 rows (800)
      const plan = planPages(base({ blocks: [table(8, 200, true)] }));
      // rows 0..3 on page 1 (header, 3 rows), then rows 4..6 after a repeated header on page 2
      expect(plan.spacers[0].pos).toBe(1 + 4 * 10);
      expect(plan.spacers[1].pos).toBe(1 + 7 * 10);
    });

    it('does not repeat a header when the table has none', () => {
      const plan = planPages(base({ blocks: [table(5, 300, false)] }));
      plan.spacers.forEach((s) => expect(s.repeatHeader).toBeUndefined());
    });

    it('keeps the header row together with the first body row', () => {
      // header row sits at the very end of page 1 (y 700..900 with the next row not fitting)
      const plan = planPages(base({ blocks: [block(0, 600), table(3, 200, true)] }));
      expect(plan.spacers.map((s) => s.pos)).toContain(1);
    });
  });

  describe('text blocks cut at a page edge', () => {
    const LINE = 30;
    /** A paragraph of `n` lines: the first piece stands for the whole block, the others are lines. */
    const paragraph = (pos: number, n: number): PieceInput[] =>
      Array.from({ length: n }, (_, i) => ({
        kind: i === 0 ? ('block' as const) : ('inline' as const),
        pos: i === 0 ? pos : pos + i * 10,
        top: i * LINE,
        h: LINE,
        ...(i === 0 ? { topLevel: true } : {}),
        line: { index: i, count: n, first: 0 },
      }));
    const text = (pos: number, n: number, over: Partial<BlockInput> = {}): BlockInput => ({
      kind: 'block',
      pos,
      h: n * LINE,
      mt: 0,
      mb: 0,
      leadingH: Math.min(n * LINE, 2 * LINE),
      naturalHeight: n * LINE,
      getPieces: () => paragraph(pos, n),
      ...over,
    });

    it('cuts between lines instead of moving the whole paragraph', () => {
      // starts at y=700; six lines fit above the content bottom (900)
      const plan = planPages(base({ blocks: [block(0, 600), text(100, 10)] }));
      expect(plan.spacers).toEqual([{ kind: 'inline', pos: 160, h: PITCH + 100 - 880 }]);
      expect(plan.pages).toBe(2);
    });

    it('does not ask for the pieces of a block that fits', () => {
      let asked = false;
      const fits = text(100, 3, { getPieces: () => ((asked = true), paragraph(100, 3)) });
      planPages(base({ blocks: [block(0, 100), fits] }));
      expect(asked).toBe(false);
    });

    it('leaves two lines for the next page (widows)', () => {
      // seven lines, six would fit: the cut moves one line earlier so that two lines go to the next page
      const plan = planPages(base({ blocks: [block(0, 600), text(100, 7)] }));
      expect(plan.spacers).toEqual([{ kind: 'inline', pos: 150, h: PITCH + 100 - 850 }]);
    });

    it('cuts a three-line paragraph after two lines, like Chromium (no widows possible)', () => {
      // the paragraph starts at y=840: two lines fit (to 900), the third would end at 930
      const plan = planPages(base({ blocks: [block(0, 740), text(100, 3)] }));
      expect(plan.spacers.map((s) => s.pos)).toEqual([120]);
    });

    it('moves a paragraph as a whole when only one line would stay on the page (orphans)', () => {
      // room for one line only
      const plan = planPages(base({ blocks: [block(0, 770), text(100, 6)] }));
      expect(plan.spacers).toEqual([{ kind: 'block', pos: 100, h: PITCH + 100 - 870 }]);
    });

    it('takes the block margins into account when a whole paragraph moves', () => {
      const plan = planPages(base({ blocks: [block(0, 770, { mb: 10 }), text(100, 6, { mt: 6 })] }));
      // natural top 870 (margins collapse to 10); spacer = 1150 - (870 + 10... ) computed from the previous bottom
      expect(plan.spacers[0].h).toBe(1150 - (870 + 10) - 6);
    });

    it('cuts a very long paragraph on every page', () => {
      // 60 lines of 30 = 1800: starts at y=100, 26 lines per page (780 px)
      const plan = planPages(base({ blocks: [text(100, 60)] }));
      expect(plan.spacers.length).toBe(2);
      expect(plan.spacers.every((s) => s.kind === 'inline')).toBe(true);
      expect(plan.pages).toBe(3);
    });

    it('cuts a list between items', () => {
      const items: PieceInput[] = Array.from({ length: 6 }, (_, i) => ({
        kind: i === 0 ? ('block' as const) : ('li' as const),
        pos: 200 + i * 20,
        top: i * 150,
        h: 150,
        ...(i === 0 ? { topLevel: true } : {}),
        line: { index: 0, count: 1, first: i },
      }));
      const list = text(200, 0, { h: 900, naturalHeight: 900, getPieces: () => items });
      const plan = planPages(base({ blocks: [list] }));
      // 800 of room: five items fit (750); the sixth moves
      expect(plan.spacers.map((s) => [s.kind, s.pos])).toEqual([['li', 200 + 5 * 20]]);
    });
  });

  describe('merged cells', () => {
    it('keeps rows that share a merged cell on one page', () => {
      const rows = Array.from({ length: 8 }, (_, i) => ({
        pos: 1 + i * 10,
        top: i * 200,
        h: 200,
        keepWithNext: i % 4 !== 3, // groups of four rows (800 high each)
      }));
      const table: BlockInput = { kind: 'table', pos: 0, h: 1600, mt: 0, mb: 0, leadingH: 200, naturalHeight: 1600, rows };
      // a paragraph of 100 first: the first group (800) no longer fits above the content bottom
      const plan = planPages(base({ blocks: [block(0, 100), table] }));
      expect(plan.spacers.map((s) => s.pos)).toEqual([1, 41]);
    });

    it('does not cut inside a group even when the rows would fit one by one', () => {
      const rows = Array.from({ length: 4 }, (_, i) => ({ pos: 1 + i * 10, top: i * 250, h: 250, keepWithNext: i === 1 || i === 2 }));
      const table: BlockInput = { kind: 'table', pos: 0, h: 1000, mt: 0, mb: 0, leadingH: 250, naturalHeight: 1000, rows };
      // rows 1-3 form a group (750 high): it does not fit below row 0 (y 350 to 1100), so it moves as one
      const plan = planPages(base({ blocks: [table] }));
      expect(plan.spacers.map((s) => s.pos)).toEqual([11]);
    });
  });
});
