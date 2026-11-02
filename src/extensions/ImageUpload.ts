import { Extension, Node, mergeAttributes } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { Image } from '@tiptap/extension-image';
import { Plugin, PluginKey, TextSelection, NodeSelection } from '@tiptap/pm/state';
import type { EditorView, NodeView, ViewMutationRecord } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

/*
 * Pictures in the document body. An image is a block of its own or in an imageRow.
 * It is stored in the document HTML as a data: URL, so the document file and the PDF export need no other file.
 * Big pictures are made smaller first, so the document file stays small.
 */

// Track dragged image position across view instances for side-by-side drops
let currentDraggedImagePos: number | null = null;
let currentDraggedImageNode: PMNode | null = null;

// The text column is 674 px wide. 1600 px is still sharp on paper and keeps the file small.
const MAX_SIDE = 1600;
const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class HuskImageView implements NodeView {
  node: PMNode;
  view: EditorView;
  getPos: () => number | undefined;

  dom: HTMLElement;
  wrapper: HTMLElement;
  img: HTMLImageElement;
  dragHandle: HTMLElement;
  handleBr: HTMLElement;
  handleBl: HTMLElement;
  badge: HTMLElement;
  captionInput: HTMLInputElement;

  isSelected = false;
  isResizing = false;
  startX = 0;
  startWidth = 0;
  maxColWidth = 674;
  sheetScale = 1;
  activeDirection: 'br' | 'bl' = 'br';

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;

    this.dom = document.createElement('figure');
    this.dom.className = 'husk-image-figure';
    this.dom.tabIndex = -1;
    this.dom.setAttribute('draggable', 'true');

    this.wrapper = document.createElement('div');
    this.wrapper.style.position = 'relative';
    this.wrapper.style.display = 'inline-block';
    this.wrapper.style.width = '100%';
    this.wrapper.style.lineHeight = '0';

    this.img = document.createElement('img');
    this.img.src = node.attrs.src || '';
    this.img.alt = node.attrs.alt || '';
    this.img.title = node.attrs.title || '';

    this.dragHandle = document.createElement('div');
    this.dragHandle.className = 'husk-image-drag-handle';
    this.dragHandle.title = 'Drag to move picture';
    this.dragHandle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>`;
    this.dragHandle.style.display = 'none';

    this.handleBr = document.createElement('div');
    this.handleBr.className = 'husk-image-resizer husk-image-resizer-br';
    this.handleBr.style.display = 'none';

    this.handleBl = document.createElement('div');
    this.handleBl.className = 'husk-image-resizer husk-image-resizer-bl';
    this.handleBl.style.display = 'none';

    this.badge = document.createElement('div');
    this.badge.className = 'husk-image-size-badge';
    this.badge.style.display = 'none';

    this.wrapper.appendChild(this.img);
    this.wrapper.appendChild(this.dragHandle);
    this.wrapper.appendChild(this.handleBr);
    this.wrapper.appendChild(this.handleBl);
    this.wrapper.appendChild(this.badge);

    this.captionInput = document.createElement('input');
    this.captionInput.type = 'text';
    this.captionInput.className = 'husk-image-caption-input';
    this.captionInput.placeholder = 'Add a caption or description...';
    this.captionInput.value = node.attrs.caption || '';
    this.captionInput.autocomplete = 'off';
    this.captionInput.spellcheck = true;
    this.captionInput.setAttribute('draggable', 'false');

    this.dom.appendChild(this.wrapper);
    this.dom.appendChild(this.captionInput);

    this.setupEvents();
    this.renderAttrs();
  }

  setupEvents() {
    this.dom.addEventListener('mouseenter', () => {
      this.dragHandle.style.display = 'flex';
    });

    this.dom.addEventListener('mouseleave', () => {
      if (!this.isSelected) this.dragHandle.style.display = 'none';
    });

    this.dragHandle.addEventListener('mousedown', () => {
      const pos = this.getPos();
      if (typeof pos === 'number') {
        const sel = NodeSelection.create(this.view.state.doc, pos);
        this.view.dispatch(this.view.state.tr.setSelection(sel));
      }
    });

    this.img.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const pos = this.getPos();
      if (typeof pos === 'number') {
        const sel = NodeSelection.create(this.view.state.doc, pos);
        this.view.dispatch(this.view.state.tr.setSelection(sel));
      }
    });

    this.captionInput.addEventListener('focus', () => {
      this.isSelected = true;
      this.dom.classList.add('is-selected');
      this.dragHandle.style.display = 'flex';
      this.handleBr.style.display = 'block';
      this.handleBl.style.display = 'block';
      this.captionInput.style.display = 'block';
      const pos = this.getPos();
      if (typeof pos === 'number') {
        if (!(this.view.state.selection instanceof NodeSelection && this.view.state.selection.from === pos)) {
          const sel = NodeSelection.create(this.view.state.doc, pos);
          this.view.dispatch(this.view.state.tr.setSelection(sel));
        }
      }
    });

    this.captionInput.addEventListener('blur', () => {
      setTimeout(() => {
        const pos = this.getPos();
        const isStillSelected =
          typeof pos === 'number' &&
          this.view.state.selection instanceof NodeSelection &&
          this.view.state.selection.from === pos;
        if (!isStillSelected) {
          this.deselectNode();
        }
      }, 100);
    });

    this.captionInput.addEventListener('input', () => {
      const pos = this.getPos();
      if (typeof pos === 'number') {
        const val = this.captionInput.value;
        if (val !== (this.node.attrs.caption || '')) {
          const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
            ...this.node.attrs,
            caption: val,
          });
          this.view.dispatch(tr);
        }
      }
    });

    this.captionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.captionInput.blur();
        const pos = this.getPos();
        if (typeof pos === 'number') {
          const afterPos = pos + this.node.nodeSize;
          const p = this.view.state.schema.nodes.paragraph?.createAndFill();
          if (p) {
            const tr = this.view.state.tr.insert(afterPos, p);
            this.view.dispatch(tr.setSelection(TextSelection.create(tr.doc, afterPos + 1)));
            this.view.focus();
          }
        }
      } else if (e.key === 'Escape') {
        this.captionInput.blur();
        this.view.focus();
      }
    });

    const startResize = (e: MouseEvent, dir: 'br' | 'bl') => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      this.isResizing = true;
      this.activeDirection = dir;
      this.startX = e.clientX;
      this.startWidth = this.img.offsetWidth;

      const parent = this.dom.parentElement;
      this.maxColWidth = parent && parent.clientWidth > 0 ? parent.clientWidth : 674;

      const sheet = this.dom.closest('.hd-edit') as HTMLElement | null;
      this.sheetScale = sheet && sheet.offsetWidth > 0 ? sheet.getBoundingClientRect().width / sheet.offsetWidth : 1;

      const currentPct = Math.round((this.startWidth / this.maxColWidth) * 100);
      this.badge.style.display = 'block';
      this.badge.textContent = `${currentPct}%`;

      window.addEventListener('mousemove', this.onMouseMove);
      window.addEventListener('mouseup', this.onMouseUp);
    };

    this.handleBr.addEventListener('mousedown', (e) => startResize(e, 'br'));
    this.handleBl.addEventListener('mousedown', (e) => startResize(e, 'bl'));

    this.dom.addEventListener('dragstart', (e: DragEvent) => {
      const pos = this.getPos();
      if (typeof pos === 'number') {
        currentDraggedImagePos = pos;
        currentDraggedImageNode = this.node;
        if (e.dataTransfer) {
          e.dataTransfer.setData('application/x-husk-image-pos', String(pos));
          e.dataTransfer.setData('text/plain', `[HUSK_IMAGE_POS:${pos}]`);
          e.dataTransfer.effectAllowed = 'copyMove';
        }
      }
    });

    this.dom.addEventListener('dragend', () => {
      currentDraggedImagePos = null;
      currentDraggedImageNode = null;
      this.clearDropIndicators();
    });

    this.dom.addEventListener('dragover', (e: DragEvent) => {
      const hasFiles = Array.from(e.dataTransfer?.types || []).includes('Files');
      const isImageDrag =
        currentDraggedImagePos !== null ||
        e.dataTransfer?.types.includes('application/x-husk-image-pos') ||
        hasFiles;

      if (!isImageDrag) return;

      const currentPos = this.getPos();
      if (typeof currentPos === 'number' && currentDraggedImagePos === currentPos) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }

      const rect = this.dom.getBoundingClientRect();
      const mouseX = e.clientX;
      const isLeft = mouseX < rect.left + rect.width / 2;

      if (isLeft) {
        this.dom.classList.add('drop-target-left');
        this.dom.classList.remove('drop-target-right');
      } else {
        this.dom.classList.add('drop-target-right');
        this.dom.classList.remove('drop-target-left');
      }
    });

    this.dom.addEventListener('dragleave', (e: DragEvent) => {
      const rect = this.dom.getBoundingClientRect();
      if (
        e.clientX <= rect.left ||
        e.clientX >= rect.right ||
        e.clientY <= rect.top ||
        e.clientY >= rect.bottom
      ) {
        this.clearDropIndicators();
      }
    });

    this.dom.addEventListener('drop', (e: DragEvent) => {
      const hadLeft = this.dom.classList.contains('drop-target-left');
      const hadRight = this.dom.classList.contains('drop-target-right');
      this.clearDropIndicators();

      if (!hadLeft && !hadRight) return;

      const side: 'left' | 'right' = hadLeft ? 'left' : 'right';
      const targetPos = this.getPos();
      if (typeof targetPos !== 'number') return;

      let srcPos: number | null = currentDraggedImagePos;
      if (srcPos === null && e.dataTransfer) {
        const rawPos = e.dataTransfer.getData('application/x-husk-image-pos');
        if (rawPos) {
          const parsed = parseInt(rawPos, 10);
          if (!isNaN(parsed)) srcPos = parsed;
        }
      }

      if (typeof srcPos === 'number') {
        if (srcPos === targetPos) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        (this.view as any).dragging = null;
        currentDraggedImagePos = null;
        currentDraggedImageNode = null;

        combineImagesSideBySide(this.view, srcPos, targetPos, side);
        return;
      }

      const files = Array.from(e.dataTransfer?.files || []).filter(isImageFile);
      if (files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        (this.view as any).dragging = null;

        void insertImageFilesNextTo(this.view, files, targetPos, side);
        return;
      }
    });
  }

  isInImageRow(): boolean {
    const pos = this.getPos();
    if (typeof pos !== 'number') return false;
    try {
      const $pos = this.view.state.doc.resolve(pos);
      return $pos.parent.type.name === 'imageRow';
    } catch {
      return false;
    }
  }

  clearDropIndicators() {
    this.dom.classList.remove('drop-target-left', 'drop-target-right');
  }

  onMouseMove = (e: MouseEvent) => {
    if (!this.isResizing) return;
    const deltaXScreen = e.clientX - this.startX;
    const deltaX = deltaXScreen / this.sheetScale;

    const align = this.node.attrs.alignment || 'center';
    let newWidthPx: number;

    if (align === 'center') {
      newWidthPx =
        this.activeDirection === 'br'
          ? this.startWidth + deltaX * 2
          : this.startWidth - deltaX * 2;
    } else if (align === 'right') {
      newWidthPx =
        this.activeDirection === 'br'
          ? this.startWidth + deltaX
          : this.startWidth - deltaX;
    } else {
      newWidthPx =
        this.activeDirection === 'br'
          ? this.startWidth + deltaX
          : this.startWidth - deltaX;
    }

    const minPx = Math.round(this.maxColWidth * 0.15);
    const maxPx = this.maxColWidth;
    newWidthPx = Math.max(minPx, Math.min(maxPx, newWidthPx));

    const percent = Math.round((newWidthPx / this.maxColWidth) * 100);
    this.dom.style.width = `${percent}%`;
    this.badge.textContent = `${percent}%`;
  };

  onMouseUp = (e: MouseEvent) => {
    if (!this.isResizing) return;
    this.isResizing = false;
    this.badge.style.display = 'none';

    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);

    const deltaXScreen = e.clientX - this.startX;
    const deltaX = deltaXScreen / this.sheetScale;

    const align = this.node.attrs.alignment || 'center';
    let newWidthPx: number;

    if (align === 'center') {
      newWidthPx =
        this.activeDirection === 'br'
          ? this.startWidth + deltaX * 2
          : this.startWidth - deltaX * 2;
    } else if (align === 'right') {
      newWidthPx =
        this.activeDirection === 'br'
          ? this.startWidth + deltaX
          : this.startWidth - deltaX;
    } else {
      newWidthPx =
        this.activeDirection === 'br'
          ? this.startWidth + deltaX
          : this.startWidth - deltaX;
    }

    const minPx = Math.round(this.maxColWidth * 0.15);
    const maxPx = this.maxColWidth;
    newWidthPx = Math.max(minPx, Math.min(maxPx, newWidthPx));
    const percent = Math.round((newWidthPx / this.maxColWidth) * 100);
    const finalWidth = `${percent}%`;

    const pos = this.getPos();
    if (typeof pos === 'number') {
      const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        width: finalWidth,
      });
      this.view.dispatch(tr);
    }
  };

  renderAttrs() {
    const { width = '100%', alignment = 'center', caption = '', src = '', alt = '', title = '' } = this.node.attrs;

    if (this.img.getAttribute('src') !== src) this.img.setAttribute('src', src || '');
    if (this.img.getAttribute('alt') !== alt) this.img.setAttribute('alt', alt || '');
    if (this.img.getAttribute('title') !== title) this.img.setAttribute('title', title || '');

    const inRow = this.isInImageRow();
    if (inRow) {
      this.dom.classList.add('in-image-row');
      this.dom.removeAttribute('data-align');
      this.dom.style.width = '100%';
      this.dom.style.maxWidth = '100%';
      this.handleBr.style.display = 'none';
      this.handleBl.style.display = 'none';
    } else {
      this.dom.classList.remove('in-image-row');
      this.dom.setAttribute('data-align', alignment);
      this.dom.style.maxWidth = '100%';
      this.dom.style.width = width || '100%';
      if (this.isSelected) {
        this.handleBr.style.display = 'block';
        this.handleBl.style.display = 'block';
      }
    }

    if (document.activeElement !== this.captionInput && this.captionInput.value !== caption) {
      this.captionInput.value = caption || '';
    }

    this.updateCaptionVisibility();
  }

  updateCaptionVisibility() {
    const hasCaption = Boolean(this.node.attrs.caption && this.node.attrs.caption.trim());
    if (hasCaption || this.isSelected) {
      this.captionInput.style.display = 'block';
    } else {
      this.captionInput.style.display = 'none';
    }
  }

  selectNode() {
    this.isSelected = true;
    this.dom.classList.add('is-selected');
    this.dragHandle.style.display = 'flex';
    if (!this.isInImageRow()) {
      this.handleBr.style.display = 'block';
      this.handleBl.style.display = 'block';
    }
    this.updateCaptionVisibility();
  }

  deselectNode() {
    this.isSelected = false;
    this.dom.classList.remove('is-selected');
    this.dragHandle.style.display = 'none';
    this.handleBr.style.display = 'none';
    this.handleBl.style.display = 'none';
    this.updateCaptionVisibility();
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.renderAttrs();
    return true;
  }

  stopEvent(event: Event): boolean {
    if (this.captionInput && event.target instanceof Element && this.captionInput.contains(event.target)) {
      return true;
    }
    if (this.isResizing) {
      return true;
    }
    if (
      event.type === 'dragover' ||
      event.type === 'dragleave' ||
      event.type === 'drop'
    ) {
      return true;
    }
    if (event.type === 'dragstart' || event.type === 'drag') {
      return false;
    }
    return false;
  }

  ignoreMutation(record: ViewMutationRecord) {
    if (record.type === 'selection') return false;
    return true;
  }

  destroy() {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.clearDropIndicators();
  }
}

export const HuskImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        parseHTML: (element) => element.getAttribute('width') || (element as HTMLElement).style?.width || '100%',
        renderHTML: (attributes) => ({
          width: attributes.width || '100%',
        }),
      },
      alignment: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') || 'center',
        renderHTML: (attributes) => ({
          'data-align': attributes.alignment || 'center',
        }),
      },
      caption: {
        default: '',
        parseHTML: (element) => {
          const figcaption = element.querySelector('figcaption');
          return figcaption?.textContent?.trim() || element.getAttribute('data-caption') || '';
        },
        renderHTML: (attributes) => {
          if (!attributes.caption) return {};
          return {
            'data-caption': attributes.caption,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure.husk-image-figure',
        getAttrs: (element: HTMLElement | string) => {
          if (typeof element === 'string') return false;
          const img = element.querySelector('img');
          const figcaption = element.querySelector('figcaption');
          return {
            src: img?.getAttribute('src') || null,
            alt: img?.getAttribute('alt') || null,
            title: img?.getAttribute('title') || null,
            width: element.style.width || img?.getAttribute('width') || img?.style.width || '100%',
            alignment: element.getAttribute('data-align') || 'center',
            caption: figcaption?.textContent?.trim() || element.getAttribute('data-caption') || '',
          };
        },
      },
      {
        tag: 'figure',
        getAttrs: (element: HTMLElement | string) => {
          if (typeof element === 'string') return false;
          const img = element.querySelector('img');
          if (!img) return false;
          const figcaption = element.querySelector('figcaption');
          return {
            src: img.getAttribute('src') || null,
            alt: img.getAttribute('alt') || null,
            title: img.getAttribute('title') || null,
            width: element.style.width || img.getAttribute('width') || img.style.width || '100%',
            alignment: element.getAttribute('data-align') || 'center',
            caption: figcaption?.textContent?.trim() || element.getAttribute('data-caption') || '',
          };
        },
      },
      {
        tag: 'img[src]',
        getAttrs: (element: HTMLElement | string) => {
          if (typeof element === 'string') return false;
          return {
            src: element.getAttribute('src') || null,
            alt: element.getAttribute('alt') || null,
            title: element.getAttribute('title') || null,
            width: element.getAttribute('width') || element.style.width || '100%',
            alignment: element.getAttribute('data-align') || 'center',
            caption: element.getAttribute('data-caption') || '',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const align = node.attrs.alignment || 'center';
    const width = node.attrs.width || '100%';
    const caption = (node.attrs.caption || '').trim();

    const figureAttrs: Record<string, string> = {
      class: 'husk-image-figure',
      'data-align': align,
      style: `max-width:100%;width:${width};`,
    };

    const imgAttrs: Record<string, string> = {
      src: node.attrs.src,
      alt: node.attrs.alt || '',
      title: node.attrs.title || '',
      style: 'width:100%;height:auto;display:block;',
    };

    if (caption) {
      figureAttrs['data-caption'] = caption;
      return ['figure', figureAttrs, ['img', imgAttrs], ['figcaption', { class: 'husk-image-caption' }, caption]];
    }

    return ['figure', figureAttrs, ['img', imgAttrs]];
  },

  addNodeView() {
    return ({ node, view, getPos }) => new HuskImageView(node, view, getPos);
  },
});

export const HuskImageRow = Node.create({
  name: 'imageRow',
  group: 'block',
  content: 'image{1,4}',
  defining: true,
  isolating: true,

  parseHTML() {
    return [
      {
        tag: 'div.husk-image-row',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'husk-image-row',
      }),
      0,
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('huskImageRowCleanup'),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;

          let tr = newState.tr;
          let modified = false;

          const rowsToFix: { pos: number; node: PMNode }[] = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name === 'imageRow') {
              if (node.childCount < 2) {
                rowsToFix.push({ pos, node });
              }
              return false;
            }
          });

          if (!rowsToFix.length) return null;

          rowsToFix.reverse().forEach(({ pos, node }) => {
            if (node.childCount === 0) {
              tr = tr.delete(pos, pos + node.nodeSize);
              modified = true;
            } else if (node.childCount === 1) {
              const child = node.child(0);
              const normChild = child.type.create({
                ...child.attrs,
                width: child.attrs.width || '100%',
                alignment: child.attrs.alignment || 'center',
              });
              tr = tr.replaceWith(pos, pos + node.nodeSize, normChild);
              modified = true;
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});

export function combineImagesSideBySide(
  view: EditorView,
  srcPos: number,
  targetPos: number,
  side: 'left' | 'right'
): boolean {
  const { state, dispatch } = view;
  const doc = state.doc;

  const srcNode = doc.nodeAt(srcPos);
  const targetNode = doc.nodeAt(targetPos);

  if (!srcNode || !targetNode || srcNode.type.name !== 'image' || targetNode.type.name !== 'image') {
    return false;
  }

  const $targetPos = doc.resolve(targetPos);
  const isTargetInRow = $targetPos.parent.type.name === 'imageRow';
  const $srcPos = doc.resolve(srcPos);
  const isSrcInRow = $srcPos.parent.type.name === 'imageRow';

  const normSrc = srcNode.type.create({
    ...srcNode.attrs,
    width: '100%',
    alignment: 'center',
  });
  const normTarget = targetNode.type.create({
    ...targetNode.attrs,
    width: '100%',
    alignment: 'center',
  });

  const imageRowType = state.schema.nodes.imageRow;
  if (!imageRowType) return false;

  // Case 1: Both in the same imageRow (reordering within the row)
  if (isTargetInRow && isSrcInRow && $targetPos.before() === $srcPos.before()) {
    const rowPos = $targetPos.before();
    const rowNode = $targetPos.parent;
    const images: PMNode[] = [];
    rowNode.forEach((child, offset) => {
      const childPos = rowPos + 1 + offset;
      if (childPos !== srcPos) {
        if (childPos === targetPos) {
          if (side === 'left') {
            images.push(normSrc);
            images.push(child);
          } else {
            images.push(child);
            images.push(normSrc);
          }
        } else {
          images.push(child);
        }
      }
    });
    const newRow = imageRowType.create(null, images);
    const tr = state.tr.replaceWith(rowPos, rowPos + rowNode.nodeSize, newRow);
    dispatch(tr);
    view.focus();
    return true;
  }

  // Case 2: Target is in an imageRow, src is from outside
  if (isTargetInRow) {
    const rowPos = $targetPos.before();
    const rowNode = $targetPos.parent;
    const images: PMNode[] = [];
    rowNode.forEach((child, offset) => {
      const childPos = rowPos + 1 + offset;
      if (childPos === targetPos) {
        if (side === 'left') {
          images.push(normSrc);
          images.push(child);
        } else {
          images.push(child);
          images.push(normSrc);
        }
      } else {
        images.push(child);
      }
    });

    const newRow = imageRowType.create(null, images);
    let tr = state.tr;
    tr = tr.delete(srcPos, srcPos + srcNode.nodeSize);
    const mappedRowPos = tr.mapping.map(rowPos);
    tr = tr.replaceWith(mappedRowPos, mappedRowPos + rowNode.nodeSize, newRow);
    dispatch(tr);
    view.focus();
    return true;
  }

  // Case 3: Target is standalone
  const images = side === 'left' ? [normSrc, normTarget] : [normTarget, normSrc];
  const newRow = imageRowType.create(null, images);

  let tr = state.tr;
  tr = tr.delete(srcPos, srcPos + srcNode.nodeSize);
  const mappedTargetPos = tr.mapping.map(targetPos);
  tr = tr.replaceWith(mappedTargetPos, mappedTargetPos + targetNode.nodeSize, newRow);
  dispatch(tr);
  view.focus();
  return true;
}

export async function insertImageFilesNextTo(
  view: EditorView,
  files: File[],
  targetPos: number,
  side: 'left' | 'right'
): Promise<boolean> {
  const validFiles = files.filter(isImageFile);
  if (!validFiles.length) return false;

  const read = await Promise.allSettled(validFiles.map(readImageFile));
  const newNodes = read.flatMap((r) =>
    r.status === 'fulfilled'
      ? [
          view.state.schema.nodes.image.create({
            ...r.value,
            width: '100%',
            alignment: 'center',
            caption: '',
          }),
        ]
      : []
  );

  if (!newNodes.length || view.isDestroyed) return false;

  const { state, dispatch } = view;
  const doc = state.doc;
  const targetNode = doc.nodeAt(targetPos);
  if (!targetNode || targetNode.type.name !== 'image') return false;

  const $targetPos = doc.resolve(targetPos);
  const isTargetInRow = $targetPos.parent.type.name === 'imageRow';
  const imageRowType = state.schema.nodes.imageRow;
  if (!imageRowType) return false;

  const normTarget = targetNode.type.create({
    ...targetNode.attrs,
    width: '100%',
    alignment: 'center',
  });

  if (isTargetInRow) {
    const rowPos = $targetPos.before();
    const rowNode = $targetPos.parent;
    const images: PMNode[] = [];
    rowNode.forEach((child, offset) => {
      const childPos = rowPos + 1 + offset;
      if (childPos === targetPos) {
        if (side === 'left') {
          images.push(...newNodes, child);
        } else {
          images.push(child, ...newNodes);
        }
      } else {
        images.push(child);
      }
    });
    const newRow = imageRowType.create(null, images);
    const tr = state.tr.replaceWith(rowPos, rowPos + rowNode.nodeSize, newRow);
    dispatch(tr);
    view.focus();
    return true;
  }

  // Standalone target
  const images = side === 'left' ? [...newNodes, normTarget] : [normTarget, ...newNodes];
  const newRow = imageRowType.create(null, images);
  const tr = state.tr.replaceWith(targetPos, targetPos + targetNode.nodeSize, newRow);
  dispatch(tr);
  view.focus();
  return true;
}

export function separateImageRow(view: EditorView, imagePos: number): boolean {
  const { state, dispatch } = view;
  const $pos = state.doc.resolve(imagePos);
  if ($pos.parent.type.name !== 'imageRow') return false;

  const rowPos = $pos.before();
  const rowNode = $pos.parent;

  const children: PMNode[] = [];
  rowNode.forEach((child) => {
    children.push(
      child.type.create({
        ...child.attrs,
        width: '100%',
        alignment: 'center',
      })
    );
  });

  const tr = state.tr.replaceWith(rowPos, rowPos + rowNode.nodeSize, children);
  dispatch(tr);
  view.focus();
  return true;
}

export const isImageFile = (file: File) => file.type.startsWith('image/');

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image cannot be read'));
    img.src = src;
  });
}

/** The data: URL for an image file. A picture larger than MAX_SIDE is scaled down. */
export async function readImageFile(file: File): Promise<{ src: string; alt: string }> {
  const alt = file.name.replace(/\.[^.]+$/, '');
  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const longSide = Math.max(img.naturalWidth, img.naturalHeight);
  if (!RESIZABLE.has(file.type) || longSide <= MAX_SIDE) return { src: original, alt };

  const k = MAX_SIDE / longSide;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * k);
  canvas.height = Math.round(img.naturalHeight * k);
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
  const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  return { src: canvas.toDataURL(type, 0.88), alt };
}

/** Insert image files at a document position, or at the cursor when no position is given. */
export async function insertImageFiles(editor: Editor, files: File[], pos?: number) {
  const read = await Promise.allSettled(files.filter(isImageFile).map(readImageFile));
  const nodes = read.flatMap((r) =>
    r.status === 'fulfilled'
      ? [
          {
            type: 'image',
            attrs: {
              ...r.value,
              width: '100%',
              alignment: 'center',
              caption: '',
            },
          },
        ]
      : []
  );
  if (!nodes.length || editor.isDestroyed) return;
  const chain = editor.chain().focus();
  (pos === undefined ? chain.insertContent(nodes) : chain.insertContentAt(pos, nodes)).run();
}

/** Drop an image file on the page, or paste one, to add it to the document. */
export const ImageUpload = Extension.create({
  name: 'imageUpload',

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key: new PluginKey('huskImageUpload'),
        props: {
          handleDrop(view, event) {
            const files = Array.from(event.dataTransfer?.files ?? []).filter(isImageFile);
            if (!files.length) return false;
            event.preventDefault();
            const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
            void insertImageFiles(editor, files, at?.pos);
            return true;
          },
          handlePaste(_view, event) {
            const data = event.clipboardData;
            const files = Array.from(data?.files ?? []).filter(isImageFile);
            // Text next to the picture means a copy from an app such as Excel: let the normal paste handle it.
            if (!files.length || data?.getData('text/plain')) return false;
            event.preventDefault();
            void insertImageFiles(editor, files);
            return true;
          },
        },
      }),
    ];
  },
});
