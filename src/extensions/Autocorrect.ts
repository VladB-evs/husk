import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { correctWord, TRIGGER_CHARACTERS } from '../utils/autocorrect';
import { ignoreWord } from '../utils/spell';

/*
 * iPhone-style autocorrect: type a word and a space (or . , ; : ! ?) and an obvious typo is fixed.
 * Press Backspace right after a correction to get your original word back; it is then left alone for the rest
 * of the session. Cmd+Z also undoes it. Code blocks are never touched.
 */

interface LastCorrection {
  start: number; // where the corrected word starts
  end: number; // where the typed space or punctuation ends
  original: string;
}

const key = new PluginKey<LastCorrection | null>('huskAutocorrect');

export const Autocorrect = Extension.create<{ isEnabled: () => boolean }>({
  name: 'autocorrect',

  addOptions() {
    return { isEnabled: () => true };
  },

  addProseMirrorPlugins() {
    const { isEnabled } = this.options;

    return [
      new Plugin<LastCorrection | null>({
        key,
        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(key) as LastCorrection | null | undefined;
            if (meta !== undefined) return meta;
            // any other typing or cursor move ends the chance to undo with Backspace
            return tr.docChanged || tr.selectionSet ? null : value;
          },
        },
        props: {
          handleTextInput(view, from, to, text) {
            if (!isEnabled() || from !== to || !TRIGGER_CHARACTERS.includes(text)) return false;

            const $pos = view.state.doc.resolve(from);
            const block = $pos.parent;
            if (!block.isTextblock || block.type.spec.code) return false;

            const before = block.textBetween(0, $pos.parentOffset, undefined, '￼');
            const match = /([A-Za-z']+)$/.exec(before);
            if (!match) return false;

            // a quote mark in front of the word is not part of it
            const word = match[1].replace(/^'+/, '');
            if (!word || word.endsWith("'")) return false;
            const wordStart = before.length - word.length;
            const prev = wordStart > 0 ? before[wordStart - 1] : '';
            if (prev && !/[\s("“[{']/.test(prev)) return false; // part of an address, a path, a hyphenated word...

            const atSentenceStart = /(^|[.!?]\s+)$/.test(before.slice(0, wordStart));
            const fixed = correctWord(word, atSentenceStart);
            if (!fixed || fixed === word) return false;

            const start = from - word.length;
            const tr = view.state.tr.insertText(fixed + text, start, from);
            tr.setMeta(key, { start, end: start + fixed.length + text.length, original: word });
            view.dispatch(tr);
            return true;
          },

          handleKeyDown(view, event) {
            if (event.key !== 'Backspace' || event.metaKey || event.altKey || event.ctrlKey) return false;
            const last = key.getState(view.state);
            const { selection } = view.state;
            if (!last || !selection.empty || selection.from !== last.end) return false;

            // give the user the word they typed, without the space
            const tr = view.state.tr.insertText(last.original, last.start, last.end);
            tr.setMeta(key, null);
            view.dispatch(tr);
            ignoreWord(last.original);
            return true;
          },
        },
      }),
    ];
  },
});
