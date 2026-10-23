import { isCorrect, isIgnored, suggest } from './spell';

/*
 * The rules of the autocorrect, kept free of the editor so they are easy to read and to test.
 * The aim is the iPhone behavior: obvious typos are fixed when you type a space, and anything unsure is left alone.
 */

/** Typos and missing apostrophes that are fixed even before the dictionary is loaded. */
const COMMON_FIXES: Record<string, string> = {
  teh: 'the',
  adn: 'and',
  taht: 'that',
  thier: 'their',
  wihtout: 'without',
  dont: "don't",
  cant: "can't",
  wont: "won't",
  isnt: "isn't",
  arent: "aren't",
  wasnt: "wasn't",
  werent: "weren't",
  doesnt: "doesn't",
  didnt: "didn't",
  hasnt: "hasn't",
  havent: "haven't",
  hadnt: "hadn't",
  wouldnt: "wouldn't",
  couldnt: "couldn't",
  shouldnt: "shouldn't",
  im: "I'm",
  ive: "I've",
  youre: "you're",
  theyre: "they're",
  thats: "that's",
  whats: "what's",
};

/** Characters that finish a word, like the space on a phone keyboard. */
export const TRIGGER_CHARACTERS = [' ', '.', ',', ';', ':', '!', '?'];

/** True when `a` can be turned into `b` by one insertion, deletion, replacement or swap of two neighbors. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // one replaced letter
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // two swapped letters
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1); // one missing or extra letter
}

function matchCase(original: string, replacement: string): string {
  if (original.length > 1 && original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] !== original[0].toLowerCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

/**
 * The corrected form of a word that was just typed, or null to leave it alone.
 * `atSentenceStart` allows a capital first letter (names in the middle of a sentence are never changed).
 */
export function correctWord(word: string, atSentenceStart: boolean): string | null {
  if (!word) return null;
  const lower = word.toLowerCase();

  // "i" and "i'm" are always written with a capital I
  if (word === 'i') return 'I';
  if (/^i'(m|ll|ve|d)$/.test(word)) return `I${word.slice(1)}`;

  if (isIgnored(lower)) return null;

  const common = COMMON_FIXES[lower];
  if (common) return common.startsWith('I') ? common : matchCase(word, common);

  if (word.length < 4) return null;
  if (!/^[A-Za-z']+$/.test(word)) return null; // digits, symbols, other alphabets: not ours to fix

  // Only plain lowercase words, or a capital first letter at the start of a sentence.
  // This protects names, CamelCase and ALL CAPS.
  const plain = word === lower;
  const capitalized = word === word[0].toUpperCase() + word.slice(1).toLowerCase();
  if (!plain && !(capitalized && atSentenceStart)) return null;

  if (isCorrect(word) || isCorrect(lower)) return null;

  // Take the first suggestion that is one small edit away. Anything further away is a guess, so it is left alone.
  for (const suggestion of suggest(lower).slice(0, 4)) {
    const s = suggestion.toLowerCase();
    if (/^[a-z']+$/.test(s) && s.length >= 3 && withinOneEdit(lower, s)) return matchCase(word, s);
  }
  return null;
}
