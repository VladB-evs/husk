import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { TableMap } from '@tiptap/pm/tables';
import { planPages } from './planner';
import { CODE_PAD_X, PAGE } from '../shared/documentLayout';
import { collectPieces, generatedHeight, isSplittable, leadingTextHeight } from './measure';
import type { BlockInput, PaginationPlan, Spacer } from './planner';

/*
 * Real pages for the editor. The page stack is drawn by DocumentEditor; this plugin works out where
 * content has to move so nothing crosses a page edge. It measures the rendered blocks and table rows,
 * then adds spacers in front of the ones that would be cut. The PDF exporter prints the same HTML with
 * the same CSS and "do not split" rules, so the pages in the PDF break at the same places.
 */

export type { Spacer, PaginationPlan } from './planner';

export interface PaginationEnv {
  /** Element whose top-left corner is the top-left corner of page 1. */
  sheet: HTMLElement;
  /** The sign-off block that follows the editor, if any. */
  signoff: HTMLElement | null;
}

export const SIGNOFF_MARGIN = 28; // must match .hd-signoff margin-top

const paginationKey = new PluginKey<Spacer[]>('huskPagination');

const px = (v: string) => parseFloat(v) || 0;

const isGeneratedRow = (el: Element) =>
  el.classList.contains('husk-pg-spacer') || el.classList.contains('husk-pg-repeat');

function tableRows(tableEl: HTMLElement, scale: number): { rows: { top: number; h: number }[]; naturalHeight: number } {
  const tableRect = tableEl.getBoundingClientRect();
  const body = tableEl.querySelector('tbody');
  const rows: { top: number; h: number }[] = [];
  let generated = 0; // height of spacer and repeated-header rows added by the plan
  Array.from(body?.children ?? []).forEach((child) => {
    const rect = child.getBoundingClientRect();
    if (isGeneratedRow(child)) {
      generated += rect.height / scale;
      return;
    }
    rows.push({ top: (rect.top - tableRect.top) / scale - generated, h: rect.height / scale });
  });
  return { rows, naturalHeight: tableRect.height / scale - generated };
}

/** keep[r] is true when row r shares a merged cell (rowspan) with row r + 1. */
export function keepWithNextRows(table: PMNode): boolean[] {
  const keep: boolean[] = [];
  let through = -1; // last row covered by any merged cell seen so far
  table.forEach((row, _offset, r) => {
    row.forEach((cell) => {
      through = Math.max(through, r + (cell.attrs.rowspan || 1) - 1);
    });
    keep.push(through > r);
  });
  return keep;
}

function isHeaderRow(row: PMNode) {
  let all = row.childCount > 0;
  row.forEach((cell) => {
    if (cell.type.name !== 'tableHeader') all = false;
  });
  return all;
}

/** Measure the rendered blocks and hand the sizes to the planner. */
export function computePlan(view: EditorView, env: PaginationEnv): PaginationPlan {
  const sheetRect = env.sheet.getBoundingClientRect();
  const scale = env.sheet.offsetWidth ? sheetRect.width / env.sheet.offsetWidth : 1;
  const yOf = (el: Element) => (el.getBoundingClientRect().top - sheetRect.top) / scale;

  const blocks: BlockInput[] = [];
  view.state.doc.forEach((node, offset) => {
    const el = view.nodeDOM(offset) as HTMLElement | null;
    if (!el || el.nodeType !== 1) return;
    const cs = getComputedStyle(el);
    const base = {
      pos: offset,
      h: el.getBoundingClientRect().height / scale,
      mt: px(cs.marginTop),
      mb: px(cs.marginBottom),
    };

    if (node.type.name === 'pageBreak') {
      blocks.push({ ...base, kind: 'pageBreak', leadingH: base.h });
    } else if (node.type.name === 'table') {
      const { rows, naturalHeight } = tableRows(el, scale);
      const rowPos: number[] = [];
      let rel = offset + 1;
      node.forEach((row) => {
        rowPos.push(rel);
        rel += row.nodeSize;
      });
      const headerRow = node.childCount > 1 && isHeaderRow(node.child(0));
      const keep = keepWithNextRows(node);
      const leadingH = !rows.length
        ? 0
        : headerRow && rows.length > 1
          ? rows[1].top + rows[1].h - rows[0].top
          : rows[0].h;
      blocks.push({
        ...base,
        kind: 'table',
        leadingH,
        naturalHeight,
        headerRow,
        rows: rows.map((r, i) => ({ ...r, pos: rowPos[i], keepWithNext: keep[i] })),
      });
    } else {
      // Natural size: without the spacers of an earlier plan
      const h = base.h - generatedHeight(el, scale);
      const splittable = isSplittable(node);
      blocks.push({
        ...base,
        h,
        kind: node.type.name === 'heading' ? 'heading' : 'block',
        leadingH: splittable ? leadingTextHeight(el, scale, h) : h,
        naturalHeight: h,
        ...(splittable ? { getPieces: () => collectPieces(view, node, offset, el, scale) } : {}),
      });
    }
  });

  return planPages({
    editorTop: yOf(view.dom),
    blocks,
    signoff: env.signoff ? { h: env.signoff.getBoundingClientRect().height / scale, margin: SIGNOFF_MARGIN } : null,
  });

}

function samePlan(a: Spacer[], b: Spacer[]) {
  return (
    a.length === b.length &&
    a.every(
      (s, i) =>
        s.kind === b[i].kind &&
        s.pos === b[i].pos &&
        !!s.repeatHeader === !!b[i].repeatHeader &&
        Math.abs(s.h - b[i].h) < 0.25
    )
  );
}

function spacerStillValid(doc: PMNode, s: Spacer): boolean {
  try {
    const $p = doc.resolve(s.pos);
    if (s.kind === 'block') {
      return !!$p.nodeAfter && ($p.depth === 0 || $p.parent.type.name === 'blockquote' || $p.parent.type.name === 'listItem');
    }
    if (s.kind === 'li') return !!$p.nodeAfter && $p.nodeAfter.type.name === 'listItem';
    if (s.kind === 'inline') return $p.parent.isTextblock;
    return $p.parent.type.spec.tableRole === 'table' && $p.nodeAfter?.type.spec.tableRole === 'row';
  } catch {
    return false;
  }
}

/**
 * A page cut inside a code block: the gray block would run on through the page margins and the dark gap between
 * the pages. The spacer paints the page there instead (white paper, dark gap, white paper), over the full width
 * of the block, so the code reads as two blocks, one on each page, like in the PDF.
 */
function codeGapMask(h: number): string {
  const end = Math.max(0, h - PAGE.marginTop); // where the gap ends and the next page starts
  const start = Math.max(0, end - PAGE.gap); // where the page ends
  const mid = (start + end) / 2;
  // The gap is the dark backdrop with the soft shadow of the pages on it: darker right below a page
  return (
    `margin:0 -${CODE_PAD_X}px;` +
    `background:linear-gradient(to bottom,#fff 0,#fff ${start}px,rgb(7,7,6) ${start}px,rgb(13,12,12) ${mid}px,` +
    `rgb(15,14,13) ${end}px,#fff ${end}px);`
  );
}

function widgetFor(doc: PMNode, s: Spacer): Decoration[] {
  const key = `${s.kind}-${s.pos}-${s.h.toFixed(1)}`;
  if (s.kind === 'block') {
    return [Decoration.widget(
      s.pos,
      () => {
        const d = document.createElement('div');
        d.className = 'husk-pg-spacer';
        d.contentEditable = 'false';
        d.style.height = `${s.h}px`;
        return d;
      },
      { side: -1, key, ignoreSelection: true }
    )];
  }
  if (s.kind === 'li' || s.kind === 'inline') {
    const tag = s.kind === 'li' ? 'li' : 'span';
    const inCode = s.kind === 'inline' && doc.resolve(s.pos).parent.type.name === 'codeBlock';
    return [Decoration.widget(
      s.pos,
      () => {
        const e = document.createElement(tag);
        e.className = 'husk-pg-spacer';
        e.contentEditable = 'false';
        e.style.cssText = `display:block;height:${s.h}px;list-style:none;`;
        if (inCode) e.style.cssText += codeGapMask(s.h);
        return e;
      },
      { side: -1, key: inCode ? `${key}-code` : key, ignoreSelection: true }
    )];
  }
  const table = doc.resolve(s.pos).parent;
  const cols = TableMap.get(table).width;
  const gap = Decoration.widget(
    s.pos,
    () => {
      const tr = document.createElement('tr');
      tr.className = 'husk-pg-spacer';
      tr.contentEditable = 'false';
      tr.style.height = `${s.h}px`;
      const td = tr.appendChild(document.createElement('td'));
      td.colSpan = cols;
      td.style.height = `${s.h}px`;
      return tr;
    },
    { side: -2, key: `${key}-${cols}`, ignoreSelection: true }
  );
  if (!s.repeatHeader || !table.firstChild) return [gap];

  const header = table.firstChild;
  const repeated = Decoration.widget(
    s.pos,
    () => {
      const tr = document.createElement('tr');
      tr.className = 'husk-pg-repeat';
      tr.contentEditable = 'false';
      header.forEach((cell) => {
        const th = tr.appendChild(document.createElement('th'));
        th.colSpan = cell.attrs.colspan || 1;
        th.textContent = cell.textContent;
      });
      return tr;
    },
    { side: -1, key: `${key}-repeat-${header.textContent}`, ignoreSelection: true }
  );
  return [gap, repeated];
}

export const Pagination = Extension.create<
  { getEnv: () => PaginationEnv | null; onPlan: (plan: PaginationPlan) => void },
  { schedule: () => void }
>({
  name: 'pagination',

  addOptions() {
    return { getEnv: () => null, onPlan: () => {} };
  },

  addStorage() {
    return { schedule: () => {} };
  },

  addProseMirrorPlugins() {
    const { getEnv, onPlan } = this.options;
    const storage = this.storage;

    return [
      new Plugin<Spacer[]>({
        key: paginationKey,
        state: {
          init: () => [],
          apply(tr, value) {
            const meta = tr.getMeta(paginationKey) as Spacer[] | undefined;
            if (meta) return meta;
            if (!tr.docChanged) return value;
            return value
              .map((s) => ({ ...s, pos: tr.mapping.map(s.pos) }))
              .filter((s) => spacerStillValid(tr.doc, s));
          },
        },
        props: {
          decorations(state) {
            const spacers = paginationKey.getState(state) ?? [];
            if (!spacers.length) return null;
            return DecorationSet.create(
              state.doc,
              spacers.flatMap((s) => widgetFor(state.doc, s))
            );
          },
        },
        view(view) {
          let queued = false;
          const run = () => {
            queued = false;
            if (view.isDestroyed) return;
            const env = getEnv();
            if (!env) return;
            const plan = computePlan(view, env);
            const current = paginationKey.getState(view.state) ?? [];
            if (!samePlan(current, plan.spacers)) {
              view.dispatch(view.state.tr.setMeta(paginationKey, plan.spacers).setMeta('addToHistory', false));
            }
            onPlan(plan);
          };
          const schedule = () => {
            if (queued) return;
            queued = true;
            queueMicrotask(run);
          };
          storage.schedule = schedule;
          schedule();
          return {
            update(v, prev) {
              if (v.state.doc !== prev.doc) schedule();
            },
            destroy() {
              storage.schedule = () => {};
            },
          };
        },
      }),
    ];
  },
});
