import { Extension } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { Image } from '@tiptap/extension-image';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/*
 * Pictures in the document body. An image is a block of its own. It is stored in the document HTML as a
 * data: URL, so the document file and the PDF export need no other file. Big pictures are made smaller
 * first, so the document file stays small.
 */

// The text column is 674 px wide. 1600 px is still sharp on paper and keeps the file small.
const MAX_SIDE = 1600;
const RESIZABLE = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const HuskImage = Image.configure({ inline: false, allowBase64: true });

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
  const nodes = read.flatMap((r) => (r.status === 'fulfilled' ? [{ type: 'image', attrs: r.value }] : []));
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
