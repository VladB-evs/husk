import { Node, mergeAttributes } from '@tiptap/react';
import type { Editor } from '@tiptap/react';

export function insertPageBreak(editor: Editor): boolean {
  return editor.chain().focus().insertContent({ type: 'pageBreak' }).createParagraphNear().run();
}

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML() {
    return [
      {
        tag: 'div[data-page-break]',
      },
      {
        tag: 'hr.page-break',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, any> }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-page-break': 'true',
        class: 'husk-page-break',
      }),
      ['span', { class: 'husk-page-break-tag' }, '📄 Page Break — Starts Next Page'],
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => insertPageBreak(this.editor),
      'Mod-Return': () => insertPageBreak(this.editor),
    };
  },
});
