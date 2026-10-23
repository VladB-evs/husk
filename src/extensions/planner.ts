import { PAGE } from '../shared/documentLayout';

/*
 * Page planner: pure geometry, no DOM. Given the measured size of every block (and every table row),
 * it decides where content has to move to the next page, so nothing crosses a page edge.
 * The editor measures the blocks (Pagination.ts) and the same rules are applied by Chromium when it prints.
 */

/** Height of the text area of one page, as the planner sees it. */
export const PAGE_ROOM = PAGE.height - PAGE.marginTop - PAGE.marginBottom - 0.5;

export interface Spacer {
  /**
   * block: before a block (top level, or inside a quote); row: before a table row;
   * li: before a list item; inline: in the middle of a paragraph, before a line.
   */
  kind: 'block' | 'row' | 'li' | 'inline';
  pos: number;
  h: number;
  /** Row spacers only: show a copy of the table header row at the top of the new page. */
  repeatHeader?: boolean;
}

export interface PaginationPlan {
  spacers: Spacer[];
  signoffPush: number;
  pages: number;
}

export interface RowInput {
  pos: number;
  top: number; // natural top, relative to the table top
  h: number;
  /** The row shares a merged cell (rowspan) with the next row, so the two must stay on one page. */
  keepWithNext?: boolean;
}

/**
 * One place where a block taller than a page may be cut: a list item, a paragraph in a quote, or a line.
 * Pieces are in document order.
 */
export interface PieceInput {
  /** block: before a block or a block inside a quote; li: before a list item; inline: before a line. */
  kind: 'block' | 'li' | 'inline';
  pos: number; // where the spacer goes
  top: number; // natural top, relative to the block top
  h: number;
  /** The first piece of a top-level block: its spacer has to take the block margins into account. */
  topLevel?: boolean;
  /** Lines of one paragraph. `first` is the index (in the pieces list) of the paragraph's first line. */
  line?: { index: number; count: number; first: number };
}

export interface BlockInput {
  kind: 'block' | 'heading' | 'table' | 'pageBreak';
  pos: number;
  h: number;
  mt: number;
  mb: number;
  /** Height that must stay together at the start of the block (tables: header and first row). */
  leadingH: number;
  rows?: RowInput[];
  /**
   * For text blocks (paragraph, list, quote): the places where the block may be cut. Only called when the
   * block crosses a page edge. Returns null when the block cannot be cut.
   */
  getPieces?: () => PieceInput[] | null;
  naturalHeight?: number;
  headerRow?: boolean;
}

export interface PlanInput {
  editorTop: number;
  blocks: BlockInput[];
  signoff: { h: number; margin: number } | null;
  geometry?: { height: number; marginTop: number; marginBottom: number; gap: number };
  safety?: number;
}

export function planPages(input: PlanInput): PaginationPlan {
  const g = input.geometry ?? PAGE;
  const safety = input.safety ?? 0.5;
  const pitch = g.height + g.gap;
  const contentH = g.height - g.marginTop - g.marginBottom - safety;
  const contentTop = (k: number) => k * pitch + g.marginTop;
  const contentBottom = (k: number) => k * pitch + g.height - g.marginBottom - safety;
  const pageOf = (y: number) => {
    let k = Math.floor(y / pitch);
    if (y >= contentBottom(k)) k += 1;
    return k;
  };
  /**
   * Where a unit of the given size has to start so that it does not cross the page edge: the top of the next
   * page, or null when it stays where it is. A unit that starts inside the bottom margin always moves on.
   * A unit that is taller than the room on a page stays put (it cannot be helped).
   */
  const moveTarget = (top: number, extent: number, room: number): number | null => {
    if (extent > room) return null;
    const k = Math.floor(top / pitch);
    return top >= contentBottom(k) - 0.01 || top + extent > contentBottom(k) + 0.01 ? contentTop(k + 1) : null;
  };

  const { blocks, editorTop } = input;
  const spacers: Spacer[] = [];
  let cursor = editorTop; // bottom edge of the previous block
  let prevMb = 0;
  let contentEnd = editorTop; // bottom of the last real content
  let forcedTarget: number | null = null; // set after a page break

  blocks.forEach((block, i) => {
    const natTop = i === 0 ? cursor + block.mt : cursor + Math.max(prevMb, block.mt);

    if (block.kind === 'pageBreak') {
      forcedTarget = contentTop(pageOf(contentEnd - 0.01) + 1);
      contentEnd = forcedTarget;
      cursor = natTop + block.h;
      prevMb = block.mb;
      return;
    }

    if (block.kind === 'table' && block.rows) {
      const rows = block.rows;
      const headerGroup = !!block.headerRow && rows.length > 1;
      const headerH = headerGroup ? rows[0].h : 0;

      // Rows that share a merged cell form one unit; the header row stays with the first body unit.
      const units: { s: number; e: number }[] = [];
      for (let r = 0; r < rows.length; r++) {
        const s = r;
        while (rows[r].keepWithNext && r + 1 < rows.length) r++;
        units.push({ s, e: r });
      }
      if (headerGroup && units.length > 1) units.splice(0, 2, { s: 0, e: units[1].e });

      let shift = 0;
      units.forEach(({ s, e }) => {
        const top = natTop + rows[s].top + shift;
        const extent = rows[e].top + rows[e].h - rows[s].top;
        let target: number | null = null;
        let repeat = false;
        if (forcedTarget !== null && s === 0) {
          target = forcedTarget;
          forcedTarget = null;
        } else {
          target = moveTarget(top, extent, s === 0 ? contentH : contentH - headerH);
          repeat = target !== null && s > 0 && headerGroup;
        }
        if (target !== null && target - top > 0.5) {
          const gap = target - top;
          spacers.push({ kind: 'row', pos: rows[s].pos, h: gap, ...(repeat ? { repeatHeader: true } : {}) });
          shift += gap + (repeat ? headerH : 0);
        }
      });
      cursor = natTop + (block.naturalHeight ?? block.h) + shift;
      prevMb = block.mb;
      contentEnd = cursor;
      return;
    }

    // A text block that crosses a page edge is cut between lines (Word style), not moved as a whole.
    let pieces: PieceInput[] | null = null;
    if (block.getPieces) {
      const crosses = forcedTarget !== null || block.h > contentH || moveTarget(natTop, block.h, contentH) !== null;
      if (crosses) pieces = block.getPieces();
    }

    if (pieces && pieces.length) {
      const linesSincePageStart = new Map<number, number>(); // paragraph -> first line of it on the current page
      let shift = 0;
      let idx = 0;
      while (idx < pieces.length) {
        const piece = pieces[idx];
        const top = natTop + piece.top + shift;
        let target: number | null = null;
        if (forcedTarget !== null && idx === 0) {
          target = forcedTarget;
          forcedTarget = null;
        } else {
          target = moveTarget(top, piece.h, contentH);
        }
        if (target === null) {
          idx++;
          continue;
        }

        // Cut before piece `cut`. Lines follow the "2 lines at the bottom, 2 lines at the top" rule as far as
        // it can be met; a paragraph with fewer than two lines at the bottom moves as a whole.
        let cut = idx;
        if (piece.line) {
          const { index, count, first } = piece.line;
          const startedAt = linesSincePageStart.get(first) ?? 0; // first line of this paragraph on this page
          let at = index;
          // widows: leave two lines for the next page. A paragraph of three lines cannot have two at the bottom
          // and two at the top, so (like Chromium) it keeps the two at the bottom.
          if (at > 0 && count - at < 2 && count - 2 >= 2) at = count - 2;
          if (at < startedAt + 2 && startedAt === 0 && at > 0) at = 0; // orphans: move the paragraph
          if (at < startedAt) at = index; // cannot reach back before this page
          cut = first + at;
        }
        const cutPiece = pieces[cut];
        const cutTop = natTop + cutPiece.top + shift;
        const gapTarget = cut === idx ? target : contentTop(Math.floor(cutTop / pitch) + 1);
        const moved = gapTarget - cutTop;
        if (moved > 0.5) {
          const before = i === 0 ? editorTop : cursor + prevMb;
          const h = cutPiece.topLevel ? gapTarget - before - block.mt : moved;
          spacers.push({ kind: cutPiece.kind, pos: cutPiece.pos, h });
          shift += moved;
          if (cutPiece.line) linesSincePageStart.set(cutPiece.line.first, cutPiece.line.index);
          idx = cut + 1;
        } else {
          idx = Math.max(idx, cut) + 1;
        }
      }
      cursor = natTop + (block.naturalHeight ?? block.h) + shift;
      prevMb = block.mb;
      contentEnd = cursor;
      return;
    }

    let needed = block.h;
    const next = blocks[i + 1];
    if (block.kind === 'heading' && next && next.kind !== 'pageBreak') {
      needed = block.h + Math.max(block.mb, next.mt) + next.leadingH;
    }

    let target: number | null = null;
    if (forcedTarget !== null) {
      target = forcedTarget;
      forcedTarget = null;
    } else {
      target = moveTarget(natTop, needed, contentH);
    }

    let top = natTop;
    if (target !== null) {
      const before = i === 0 ? editorTop : cursor + prevMb;
      const spacerH = target - before - block.mt;
      if (spacerH > 0.5) {
        spacers.push({ kind: 'block', pos: block.pos, h: spacerH });
        top = target;
      }
    }
    cursor = top + block.h;
    prevMb = block.mb;
    contentEnd = cursor;
  });

  let bottom = cursor;
  let signoffPush = 0;
  if (input.signoff) {
    const natTop = cursor + prevMb + input.signoff.margin;
    const h = input.signoff.h;
    let target: number | null = null;
    if (forcedTarget !== null) {
      target = forcedTarget;
      forcedTarget = null;
    } else {
      target = moveTarget(natTop, h, contentH);
    }
    signoffPush = target !== null ? Math.max(0, target - natTop) : 0;
    bottom = natTop + signoffPush + h;
  } else if (forcedTarget !== null) {
    bottom = forcedTarget + 1;
  }

  return { spacers, signoffPush, pages: Math.max(1, pageOf(bottom - 0.01) + 1) };
}
