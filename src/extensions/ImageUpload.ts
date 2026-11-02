import { Extension } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { Image } from '@tiptap/extension-image';
import { Plugin, PluginKey, TextSelection, NodeSelection } from '@tiptap/pm/state';
import type { EditorView, NodeView, ViewMutationRecord } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';

/*
 * Pictures in the document body. An image is a block of its own. It is stored in the document HTML as a
 * data: URL, so the document file and the PDF export need no other file. Big pictures are made smaller
 * first, so the document file stays small.
 */

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

    this.dom.setAttribute('data-align', alignment);
    this.dom.style.maxWidth = '100%';
    this.dom.style.width = width || '100%';

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
    this.handleBr.style.display = 'block';
    this.handleBl.style.display = 'block';
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
    if (this.captionInput && this.captionInput.contains(event.target as Node)) {
      return true;
    }
    if (this.isResizing) {
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
