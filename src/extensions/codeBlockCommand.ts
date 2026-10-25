import type { Editor } from '@tiptap/react';

/**
 * Code block button. When several paragraphs (or one paragraph with line breaks) are selected, they become ONE
 * code block with a line for each paragraph. The built-in toggle would make one code block per paragraph.
 */
export function toggleCodeBlock(editor: Editor): boolean {
  const { state } = editor;
  const { $from, $to, empty } = state.selection;
  const range = !empty && !editor.isActive('codeBlock') ? $from.blockRange($to) : null;

  if (range) {
    const lines: string[] = [];
    let onlyText = true;
    for (let i = range.startIndex; i < range.endIndex && onlyText; i++) {
      const block = range.parent.child(i);
      if (!block.isTextblock || block.type.spec.code) onlyText = false;
      block.forEach((inline) => {
        if (!inline.isText && inline.type.name !== 'hardBreak') onlyText = false;
      });
      lines.push(block.textBetween(0, block.content.size, '', '\n'));
    }
    if (onlyText && lines.length) {
      const text = lines.join('\n');
      return editor
        .chain()
        .focus()
        .insertContentAt(
          { from: range.start, to: range.end },
          { type: 'codeBlock', content: text ? [{ type: 'text', text }] : [] }
        )
        .run();
    }
  }
  return editor.chain().focus().toggleCodeBlock().run();
}
