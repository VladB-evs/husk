import { describe, expect, it } from 'vitest';
import { columnPercents } from './CustomTable';

// A table node reduced to what columnPercents reads: the cells of its first row.
const table = (cells: Array<{ colspan?: number; colwidth?: number[] | null }>) =>
  ({
    firstChild: {
      forEach: (cb: (cell: any) => void) => cells.forEach((c) => cb({ attrs: { colspan: c.colspan ?? 1, colwidth: c.colwidth ?? null } })),
    },
  }) as any;

describe('columnPercents', () => {
  it('shares the width equally when no column has a width', () => {
    expect(columnPercents(table([{}, {}, {}, {}]))).toEqual([25, 25, 25, 25]);
  });

  it('turns pixel widths into percentages that add up to 100', () => {
    const result = columnPercents(table([{ colwidth: [234] }, { colwidth: [544] }]));
    expect(result[0]).toBeCloseTo(30.08, 1);
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
  });

  it('gives a column without a width the average of the others', () => {
    const result = columnPercents(table([{ colwidth: [100] }, { colwidth: [300] }, {}]));
    expect(result[2]).toBeCloseTo(result[0] + (result[1] - result[0]) / 2, 6);
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
  });

  it('spreads a merged cell over its columns', () => {
    expect(columnPercents(table([{ colspan: 2, colwidth: [100, 300] }, { colwidth: [100] }]))).toHaveLength(3);
  });

  it('never grows beyond 100 percent whatever the stored widths are', () => {
    const result = columnPercents(table([{ colwidth: [5000] }, { colwidth: [4000] }]));
    expect(result.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
  });

  it('returns nothing for a table without rows', () => {
    expect(columnPercents({ firstChild: null } as any)).toEqual([]);
  });
});
