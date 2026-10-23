import nspell from 'nspell';

/*
 * Spelling data for the autocorrect. The Hunspell English dictionaries (US or British, chosen from the system
 * language) are loaded on demand in their own files, so they do not slow down the start of the app.
 * Until they are loaded, nothing is reported as misspelled, so nothing is changed by mistake.
 */

type Spell = ReturnType<typeof nspell>;

const USER_WORDS_KEY = 'husk_user_words_v1';

let spell: Spell | null = null;
let loading: Promise<void> | null = null;
const ignored = new Set<string>(); // words the user undid an autocorrect for, until the app closes

function readUserWords(): string[] {
  try {
    const words = JSON.parse(localStorage.getItem(USER_WORDS_KEY) || '[]');
    return Array.isArray(words) ? words.filter((w) => typeof w === 'string') : [];
  } catch {
    return [];
  }
}

export function loadSpellChecker(): Promise<void> {
  return (loading ??= (async () => {
    const british = /^en-(GB|AU|NZ|IE|ZA|IN)/i.test(navigator.language);
    const [aff, dic] = british
      ? await Promise.all([
          import('../../node_modules/dictionary-en-gb/index.aff?raw'),
          import('../../node_modules/dictionary-en-gb/index.dic?raw'),
        ])
      : await Promise.all([
          import('../../node_modules/dictionary-en/index.aff?raw'),
          import('../../node_modules/dictionary-en/index.dic?raw'),
        ]);
    const checker = nspell({ aff: aff.default, dic: dic.default });
    readUserWords().forEach((word) => checker.add(word));
    spell = checker;
  })().catch((err) => {
    console.error('Could not load the spelling dictionary', err);
  }));
}

export function isSpellCheckerReady(): boolean {
  return spell !== null;
}

export function isCorrect(word: string): boolean {
  return spell ? spell.correct(word) : true;
}

export function suggest(word: string): string[] {
  return spell ? spell.suggest(word) : [];
}

/** Teach the dictionary a word for good ("Add to Dictionary"). */
export function addUserWord(word: string): void {
  spell?.add(word);
  try {
    const words = new Set(readUserWords());
    words.add(word);
    localStorage.setItem(USER_WORDS_KEY, JSON.stringify([...words]));
  } catch {
    // storage may be unavailable; the word is still known until the app closes
  }
}

export function ignoreWord(word: string): void {
  ignored.add(word.toLowerCase());
}

export function isIgnored(word: string): boolean {
  return ignored.has(word.toLowerCase());
}
