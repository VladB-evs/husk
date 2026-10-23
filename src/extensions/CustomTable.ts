import { Extension, mergeAttributes } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView, NodeView, ViewMutationRecord } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { TableMap } from '@tiptap/pm/tables';

/*
 * Tables in HUSK always fill the text column. Column widths are stored on the cells (`colwidth`)
 * but only used as ratios, so a table can never grow wider than the page. Dragging a column border
 * moves width between the two neighbouring columns. Dragging a row border sets the row height.
 */

const MIN_COL_PX = 40;
const MIN_ROW_PX = 22;
const EDGE_PX = 5;

export type TableDensity = 'compact' | 'normal' | 'spacious';

/** Column widths of a table as percentages that always sum to 100. */
export function columnPercents(table: PMNode): number[] {
  const row = table.firstChild;
  if (!row) return [];
  const widths: Array<number | null> = [];
  row.forEach((cell) => {
    const { colspan, colwidth } = cell.attrs as { colspan: number; colwidth: number[] | null };
    for (let j = 0; j < colspan; j++) widths.push(colwidth && colwidth[j] ? colwidth[j] : null);
  });
  const known = widths.filter((w): w is number => !!w);
  const fallback = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1;
  const filled = widths.map((w) => w ?? fallback);
  const total = filled.reduce((a, b) => a + b, 0) || 1;
  return filled.map((w) => (w / total) * 100);
}

function colgroupSpec(table: PMNode) {
  return ['colgroup', {}, ...columnPercents(table).map((p) => ['col', { style: `width:${p.toFixed(4)}%` }])] as const;
}

class HuskTableView implements NodeView {
  node: PMNode;
  dom: HTMLTableElement;
  colgroup: HTMLTableColElement;
  contentDOM: HTMLElement;

  constructor(node: PMNode, attrs: Record<string, unknown>) {
    this.node = node;
    this.dom = document.createElement('table');
    Object.entries(attrs).forEach(([k, v]) => v != null && this.dom.setAttribute(k, String(v)));
    this.colgroup = this.dom.appendChild(document.createElement('colgroup'));
    this.contentDOM = this.dom.appendChild(document.createElement('tbody'));
    this.sync();
  }

  sync() {
    this.dom.style.width = '100%';
    this.dom.setAttribute('data-density', this.node.attrs.density || 'normal');
    const percents = columnPercents(this.node);
    while (this.colgroup.children.length > percents.length) this.colgroup.lastElementChild?.remove();
    while (this.colgroup.children.length < percents.length) this.colgroup.appendChild(document.createElement('col'));
    percents.forEach((p, i) => {
      (this.colgroup.children[i] as HTMLElement).style.width = `${p.toFixed(4)}%`;
    });
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.sync();
    return true;
  }

  ignoreMutation(mutation: ViewMutationRecord) {
    if (mutation.type === 'selection') return false;
    return !this.contentDOM.contains(mutation.target);
  }
}

export const CustomTable = Table.extend({
  addAttributes() {
    return {
      density: {
        default: 'normal',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-density') || 'normal',
        renderHTML: (attrs: Record<string, any>) => ({ 'data-density': attrs.density || 'normal' }),
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'table',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { style: 'width:100%' }),
      colgroupSpec(node),
      ['tbody', 0],
    ];
  },

  addNodeView() {
    return ({ node, HTMLAttributes }) =>
      new HuskTableView(node, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes));
  },

  addProseMirrorPlugins() {
    return [tableResizePlugin(), ...(this.parent?.() ?? [])];
  },
});

export const CustomTableRow = TableRow.extend({
  addAttributes() {
    return {
      rowHeight: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const h = parseFloat(el.getAttribute('data-row-height') || el.style.height || '');
          return Number.isFinite(h) && h > 0 ? h : null;
        },
        renderHTML: (attrs: Record<string, any>) =>
          attrs.rowHeight ? { 'data-row-height': attrs.rowHeight, style: `height:${attrs.rowHeight}px` } : {},
      },
    };
  },
});

/**
 * Keys inside table cells:
 *  - Return adds a row below and moves the cursor into the same column of the new row.
 *  - Shift+Return starts a new line inside the cell (the hard break of the editor).
 *  - Backspace or Delete in a row that is completely empty removes the row.
 * Lists and code blocks inside a cell keep their own key behavior.
 */
function cellContext(editor: Editor) {
  const { selection } = editor.state;
  if (!(selection instanceof TextSelection)) return null;
  const $from = selection.$from;

  let cellDepth = -1;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    const role = node.type.spec.tableRole;
    if (role === 'cell' || role === 'header_cell') {
      cellDepth = d;
      break;
    }
    if (node.type.name === 'listItem' || node.type.name === 'codeBlock') return null;
  }
  if (cellDepth < 0) return null;
  return { selection, $from, cellDepth, rowDepth: cellDepth - 1, tableDepth: cellDepth - 2 };
}

function isEmptyCell(cell: PMNode): boolean {
  const first = cell.firstChild;
  return cell.childCount === 1 && !!first && first.isTextblock && first.content.size === 0;
}

/** Remove the row the cursor is in, if every cell of it is empty. `direction` says where the cursor goes next. */
function deleteEmptyRow(editor: Editor, direction: 'back' | 'forward'): boolean {
  const ctx = cellContext(editor);
  if (!ctx || !ctx.selection.empty) return false;
  const { $from, rowDepth, tableDepth } = ctx;

  const table = $from.node(tableDepth);
  const row = $from.node(rowDepth);
  if (table.type.spec.tableRole !== 'table' || row.type.spec.tableRole !== 'row') return false;
  if (table.childCount < 2) return false; // the only row of a table stays

  let allEmpty = true;
  row.forEach((cell) => {
    if (!isEmptyCell(cell)) allEmpty = false;
  });
  if (!allEmpty) return false;

  // merged cells make the row layout tricky: leave those tables to the table tools
  let merged = false;
  table.descendants((node) => {
    if (node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell') {
      if ((node.attrs.rowspan || 1) > 1 || (node.attrs.colspan || 1) > 1) merged = true;
      return false;
    }
    return !merged;
  });
  if (merged) return false;

  const tablePos = $from.before(tableDepth);
  const rowPos = $from.before(rowDepth);
  const rowIndex = $from.index(tableDepth);
  const columnIndex = $from.index(rowDepth);

  // Backspace goes to the row above (or below for the first row); Delete goes to the row below (or above for the last)
  const above = direction === 'back' ? rowIndex > 0 : rowIndex === table.childCount - 1;
  const targetIndex = above ? rowIndex - 1 : rowIndex; // after the removal the row below takes this index

  return editor
    .chain()
    .command(({ tr }) => {
      tr.delete(rowPos, rowPos + row.nodeSize);
      const newTable = tr.doc.nodeAt(tablePos);
      if (!newTable) return false;
      let pos = tablePos + 1;
      for (let i = 0; i < targetIndex; i++) pos += newTable.child(i).nodeSize;
      const targetRow = newTable.child(targetIndex);
      const column = Math.min(columnIndex, targetRow.childCount - 1);
      let cellPos = pos + 1;
      for (let c = 0; c < column; c++) cellPos += targetRow.child(c).nodeSize;
      const cell = targetRow.child(column);
      const inside = above ? cellPos + cell.nodeSize - 1 : cellPos + 1;
      tr.setSelection(TextSelection.near(tr.doc.resolve(inside), above ? -1 : 1));
      return true;
    })
    .run();
}

export const TableKeys = Extension.create({
  name: 'tableKeys',
  priority: 1000, // before the default "split the paragraph" and delete behavior

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const ctx = cellContext(editor);
        if (!ctx) return false;
        const cellPos = ctx.$from.before(ctx.cellDepth); // the new row comes after this cell, so this stays valid
        return editor
          .chain()
          .addRowAfter()
          .command(({ tr }) => {
            const $cell = tr.doc.resolve(cellPos);
            const table = $cell.node(-1);
            const tableStart = $cell.start(-1);
            const map = TableMap.get(table);
            const rect = map.findCell(cellPos - tableStart);
            if (rect.bottom >= map.height) return false;
            const target = map.map[rect.bottom * map.width + rect.left];
            tr.setSelection(TextSelection.near(tr.doc.resolve(tableStart + target + 1)));
            return true;
          })
          .run();
      },
      Backspace: ({ editor }) => deleteEmptyRow(editor, 'back'),
      Delete: ({ editor }) => deleteEmptyRow(editor, 'forward'),
    };
  },
});

export const CustomTableCell = TableCell;
export const CustomTableHeader = TableHeader;

// ───────────────────────── resize plugin ─────────────────────────

interface Hot {
  cellPos: number;
  r?: boolean;
  l?: boolean;
  b?: boolean;
  t?: boolean;
}

interface Hit extends Hot {
  tablePos: number;
  colBorder: number | null; // border sits between column colBorder and colBorder + 1
  rowBorder: number | null; // border sits below row rowBorder
}

const resizeKey = new PluginKey<Hot | null>('huskTableResize');

function viewScale(view: EditorView): number {
  const el = view.dom as HTMLElement;
  return el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1;
}

function hitTest(view: EditorView, e: MouseEvent): Hit | null {
  const target = e.target as HTMLElement | null;
  const cellEl = target?.closest?.('td, th') as HTMLElement | null;
  if (!cellEl || !view.dom.contains(cellEl) || cellEl.closest('.husk-pg-spacer, .husk-pg-repeat')) return null;

  let $cell;
  try {
    $cell = view.state.doc.resolve(view.posAtDOM(cellEl, 0));
  } catch {
    return null;
  }
  const cellNode = $cell.parent;
  const role = cellNode.type.spec.tableRole;
  if (role !== 'cell' && role !== 'header_cell') return null;

  const cellPos = $cell.before();
  const $at = view.state.doc.resolve(cellPos);
  const table = $at.node(-1);
  const tablePos = $at.before(-1);
  const map = TableMap.get(table);
  const rect = map.findCell(cellPos - $at.start(-1));

  const box = cellEl.getBoundingClientRect();
  const edge = EDGE_PX * viewScale(view);
  const r = box.right - e.clientX <= edge && rect.right < map.width;
  const l = e.clientX - box.left <= edge && rect.left > 0;
  const b = box.bottom - e.clientY <= edge;
  const t = e.clientY - box.top <= edge && rect.top > 0;

  const colBorder = r ? rect.right - 1 : l ? rect.left - 1 : null;
  const rowBorder = b ? rect.bottom - 1 : t ? rect.top - 1 : null;
  if (colBorder === null && rowBorder === null) return null;
  return { cellPos, tablePos, colBorder, rowBorder, r, l, b, t };
}

function setHot(view: EditorView, hot: Hot | null) {
  const prev = resizeKey.getState(view.state) ?? null;
  if (JSON.stringify(prev) === JSON.stringify(hot)) return;
  view.dispatch(view.state.tr.setMeta(resizeKey, { value: hot }).setMeta('addToHistory', false));
}

function applyColumnWidths(view: EditorView, tablePos: number, widths: number[], history: boolean) {
  const tr = view.state.tr;
  const table = tr.doc.nodeAt(tablePos);
  if (!table) return;
  const map = TableMap.get(table);
  const seen = new Set<number>();
  map.map.forEach((rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const cell = table.nodeAt(rel);
    if (!cell) return;
    const rect = map.findCell(rel);
    const colwidth: number[] = [];
    for (let c = rect.left; c < rect.right; c++) colwidth.push(Math.max(1, Math.round(widths[c])));
    tr.setNodeMarkup(tablePos + 1 + rel, null, { ...cell.attrs, colwidth });
  });
  if (!history) tr.setMeta('addToHistory', false);
  view.dispatch(tr);
}

function applyRowHeight(view: EditorView, tablePos: number, row: number, height: number, history: boolean) {
  const table = view.state.doc.nodeAt(tablePos);
  if (!table) return;
  let rel = 0;
  for (let i = 0; i < row; i++) rel += table.child(i).nodeSize;
  const rowNode = table.child(row);
  const tr = view.state.tr.setNodeMarkup(tablePos + 1 + rel, null, { ...rowNode.attrs, rowHeight: Math.round(height) });
  if (!history) tr.setMeta('addToHistory', false);
  view.dispatch(tr);
}

/** Put the table back to how it was before the drag (no history), so the final change is one undo step. */
function restoreTable(view: EditorView, tablePos: number, original: PMNode) {
  const current = view.state.doc.nodeAt(tablePos);
  if (!current) return;
  view.dispatch(
    view.state.tr.replaceWith(tablePos, tablePos + current.nodeSize, original).setMeta('addToHistory', false)
  );
}

function startDrag(view: EditorView, hit: Hit, startEvent: MouseEvent) {
  const scale = viewScale(view);
  const original = view.state.doc.nodeAt(hit.tablePos);
  const tableEl = view.nodeDOM(hit.tablePos) as HTMLElement | null;
  if (!original || !tableEl) return;

  const tip = document.createElement('div');
  tip.style.cssText =
    'position:fixed;z-index:100000;pointer-events:none;background:#22201d;color:#FF4C00;border:1px solid #FF4C00;' +
    'font:700 11px monospace;padding:2px 8px;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,.5)';
  document.body.appendChild(tip);

  const draggingCol = hit.colBorder !== null;
  const prevCursor = view.dom.style.cursor;
  document.body.style.cursor = draggingCol ? 'col-resize' : 'row-resize';
  document.body.style.userSelect = 'none';

  let changed = false;
  let move: (e: MouseEvent) => void;
  const tableWidth = tableEl.getBoundingClientRect().width / scale || 1;

  if (draggingCol) {
    const b = hit.colBorder as number;
    const start = columnPercents(original).map((p) => (p / 100) * tableWidth);
    move = (e) => {
      const dx = (e.clientX - startEvent.clientX) / scale;
      const clamped = Math.min(Math.max(dx, MIN_COL_PX - start[b]), start[b + 1] - MIN_COL_PX);
      const widths = start.slice();
      widths[b] = start[b] + clamped;
      widths[b + 1] = start[b + 1] - clamped;
      changed = true;
      applyColumnWidths(view, hit.tablePos, widths, false);
      tip.textContent = `Column ${Math.round((widths[b] / tableWidth) * 100)}% | ${Math.round((widths[b + 1] / tableWidth) * 100)}%`;
      tip.style.left = `${e.clientX + 14}px`;
      tip.style.top = `${e.clientY + 14}px`;
    };
  } else {
    const row = hit.rowBorder as number;
    let rel = 0;
    for (let i = 0; i < row; i++) rel += original.child(i).nodeSize;
    const rowEl = view.nodeDOM(hit.tablePos + 1 + rel) as HTMLElement | null;
    const startHeight = rowEl ? rowEl.getBoundingClientRect().height / scale : MIN_ROW_PX;
    move = (e) => {
      const dy = (e.clientY - startEvent.clientY) / scale;
      const height = Math.max(MIN_ROW_PX, startHeight + dy);
      changed = true;
      applyRowHeight(view, hit.tablePos, row, height, false);
      tip.textContent = `Row ${Math.round(height)}px`;
      tip.style.left = `${e.clientX + 14}px`;
      tip.style.top = `${e.clientY + 14}px`;
    };
  }

  tip.style.display = 'none';

  const onMove = (e: MouseEvent) => {
    move(e);
    tip.style.display = 'block';
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    tip.remove();
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    view.dom.style.cursor = prevCursor;
    if (changed) {
      const finalTable = view.state.doc.nodeAt(hit.tablePos);
      if (finalTable) {
        // Re-apply the final values as a single undoable step.
        const finalFirst = finalTable;
        restoreTable(view, hit.tablePos, original);
        if (draggingCol) {
          applyColumnWidths(
            view,
            hit.tablePos,
            columnPercents(finalFirst).map((p) => (p / 100) * tableWidth),
            true
          );
        } else {
          const row = hit.rowBorder as number;
          applyRowHeight(view, hit.tablePos, row, finalFirst.child(row).attrs.rowHeight, true);
        }
      }
    }
    setHot(view, null);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function tableResizePlugin() {
  return new Plugin<Hot | null>({
    key: resizeKey,
    state: {
      init: () => null,
      apply(tr, value) {
        const meta = tr.getMeta(resizeKey) as { value: Hot | null } | undefined;
        if (meta) return meta.value;
        if (value && tr.docChanged) return { ...value, cellPos: tr.mapping.map(value.cellPos) };
        return value;
      },
    },
    props: {
      decorations(state) {
        const hot = resizeKey.getState(state);
        const node = hot && state.doc.nodeAt(hot.cellPos);
        if (!hot || !node) return null;
        const style = [
          hot.r && '--hr:inset -3px 0 0 #FF4C00',
          hot.l && '--hl:inset 3px 0 0 #FF4C00',
          hot.b && '--hb:inset 0 -3px 0 #FF4C00',
          hot.t && '--ht:inset 0 3px 0 #FF4C00',
        ]
          .filter(Boolean)
          .join(';');
        return DecorationSet.create(state.doc, [Decoration.node(hot.cellPos, hot.cellPos + node.nodeSize, { style })]);
      },
      handleDOMEvents: {
        mousemove(view, event) {
          const hit = hitTest(view, event as MouseEvent);
          view.dom.style.cursor = hit ? (hit.colBorder !== null ? 'col-resize' : 'row-resize') : '';
          setHot(view, hit ? { cellPos: hit.cellPos, r: hit.r, l: hit.l, b: hit.b, t: hit.t } : null);
          return false;
        },
        mouseleave(view) {
          view.dom.style.cursor = '';
          setHot(view, null);
          return false;
        },
        mousedown(view, event) {
          const e = event as MouseEvent;
          if (e.button !== 0) return false;
          const hit = hitTest(view, e);
          if (!hit) return false;
          e.preventDefault();
          startDrag(view, hit, e);
          return true;
        },
      },
    },
  });
}
