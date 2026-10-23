import type { EditorView } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { PieceInput } from './planner';

/*
 * Measurement for text blocks that have to be cut at a page edge (paragraph, list, quote).
 * It finds every place where such a block may be cut, in document order:
 *   - the lines of each paragraph (the position of the first character of each line)
 *   - the start of each list item and of each paragraph inside a quote or list item
 * Spacers that an earlier plan put inside the block are subtracted, so all sizes are "natural" sizes.
 * Inside lists and quotes the CSS uses padding, not margins, so a spacer there adds exactly its own height.
 */

const LIST_TYPES = new Set(['bulletList', 'orderedList']);

/** True for blocks that can be cut between lines. Headings stay in one piece. */
export function isSplittable(node: PMNode): boolean {
  return (node.isTextblock && node.type.name !== 'heading') || LIST_TYPES.has(node.type.name) || node.type.name === 'blockquote';
}

/** Total height of the spacers an earlier plan put inside a block. */
export function generatedHeight(el: HTMLElement, scale: number): number {
  let total = 0;
  el.querySelectorAll('.husk-pg-spacer').forEach((s) => {
    total += s.getBoundingClientRect().height / scale;
  });
  return total;
}

/** Height of the first two lines of a block: how much of it must stay with a heading above it. */
export function leadingTextHeight(el: HTMLElement, scale: number, naturalH: number): number {
  const lh = parseFloat(getComputedStyle(el).lineHeight) || 0;
  return lh ? Math.min(naturalH, 2 * lh) : naturalH;
}

/** Cut points of a text block, or null when the block cannot be cut. */
export function collectPieces(
  view: EditorView,
  node: PMNode,
  offset: number,
  el: HTMLElement,
  scale: number
): PieceInput[] | null {
  // Measure the natural layout: hide the spacers of the current plan for a moment. A cut in the middle of a
  // line would otherwise change how the rest of the paragraph wraps.
  const hidden = Array.from(el.querySelectorAll<HTMLElement>('.husk-pg-spacer')).map((s) => {
    const shown = s.style.display;
    s.style.display = 'none';
    return { s, shown };
  });
  try {
    return measure();
  } finally {
    hidden.forEach(({ s, shown }) => (s.style.display = shown));
  }

  function measure(): PieceInput[] | null {
  const blockRect = el.getBoundingClientRect();
  const genBefore = (_y: number) => 0;
  const naturalTop = (e: Element) => (e.getBoundingClientRect().top - blockRect.top) / scale;
  const naturalHeight = (e: Element) => e.getBoundingClientRect().height / scale;

  const out: PieceInput[] = [];
  let ok = true;

  // `kind`/`at` say where a spacer goes when the block is cut right before this leaf.
  interface Where {
    kind: PieceInput['kind'];
    at: number;
    topLevel?: boolean;
  }

  const at = (w: Where) => ({ kind: w.kind, pos: w.at, ...(w.topLevel ? { topLevel: true } : {}) });

  const lines = (tb: PMNode, tbPos: number, where: Where) => {
    const tbEl = view.nodeDOM(tbPos) as HTMLElement | null;
    if (!tbEl) return void (ok = false);
    const lh = parseFloat(getComputedStyle(tbEl).lineHeight) || 0;
    const top0 = where.topLevel ? 0 : naturalTop(tbEl);

    // One entry per visual line: its top and the left edge of its first fragment
    const found: { top: number; left: number }[] = [];
    const walker = document.createTreeWalker(tbEl, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if ((t.parentElement as Element).closest('.husk-pg-spacer')) continue;
      range.selectNodeContents(t);
      Array.from(range.getClientRects()).forEach((r) => {
        if (r.height <= 0) return;
        const line = found.find((f) => Math.abs(f.top - r.top) < 2);
        if (line) line.left = Math.min(line.left, r.left);
        else found.push({ top: r.top, left: r.left });
      });
    }
    found.sort((a, b) => a.top - b.top);

    if (found.length < 2 || !lh) {
      out.push({ ...at(where), top: top0, h: naturalHeight(tbEl), line: { index: 0, count: 1, first: out.length } });
      return;
    }

    const first = out.length;
    found.forEach((line, i) => {
      const base = { top: top0 + (line.top - found[0].top) / scale - (genBefore(line.top) - genBefore(found[0].top)), h: lh };
      const info = { index: i, count: found.length, first };
      if (i === 0) {
        out.push({ ...at(where), ...base, top: top0, line: info });
        return;
      }
      const hit = view.posAtCoords({ left: line.left + 1, top: line.top + (lh * scale) / 2 });
      // the point must land in this same paragraph, otherwise the block is left uncut
      if (!hit || view.state.doc.resolve(hit.pos).parent !== tb) return void (ok = false);
      out.push({ kind: 'inline', pos: hit.pos, ...base, line: info });
    });
  };

  const leaf = (n: PMNode, pos: number, where: Where) => {
    if (n.isTextblock) return lines(n, pos, where);
    if (LIST_TYPES.has(n.type.name) || n.type.name === 'blockquote') return walk(n, pos, where);
    const e = view.nodeDOM(pos) as HTMLElement | null;
    if (!e) return void (ok = false);
    out.push({ ...at(where), top: where.topLevel ? 0 : naturalTop(e), h: naturalHeight(e) });
  };

  const walk = (n: PMNode, pos: number, where: Where) => {
    if (LIST_TYPES.has(n.type.name)) {
      n.forEach((li, rel, index) => {
        const liPos = pos + 1 + rel;
        li.forEach((c, cRel, i) => {
          const cPos = liPos + 1 + cRel;
          // the first leaf of the first item stands for the whole list; later items are cut at the item
          const w: Where =
            index === 0 && i === 0 ? where : i === 0 ? { kind: 'li', at: liPos } : { kind: 'block', at: cPos };
          leaf(c, cPos, w);
        });
      });
    } else if (n.type.name === 'blockquote') {
      n.forEach((c, rel, i) => {
        const cPos = pos + 1 + rel;
        leaf(c, cPos, i === 0 ? where : { kind: 'block', at: cPos });
      });
    } else {
      leaf(n, pos, where);
    }
  };

  walk(node, offset, { kind: 'block', at: offset, topLevel: true });
  return ok && out.length > 0 ? out : null;
  }
}
