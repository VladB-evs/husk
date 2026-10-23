import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as store from './store';

let base: string;
let dirs: store.StoreDirs;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'husk-store-'));
  dirs = store.storeDirs(base);
  store.ensureDirs(dirs);
});
afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

const doc = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: id,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

describe('save and delete', () => {
  it('writes documents and templates under their id', () => {
    store.saveDocument(dirs, doc('doc_1'));
    store.saveTemplate(dirs, doc('tpl_1'));
    expect(fs.readdirSync(dirs.documents)).toEqual(['doc_1.husk']);
    expect(fs.readdirSync(dirs.templates)).toEqual(['tpl_1.json']);
  });

  it('leaves no temp file behind and replaces an existing file in one step', () => {
    store.saveDocument(dirs, doc('doc_1', { title: 'first' }));
    store.saveDocument(dirs, doc('doc_1', { title: 'second' }));
    expect(fs.readdirSync(dirs.documents)).toEqual(['doc_1.husk']);
    expect(JSON.parse(fs.readFileSync(path.join(dirs.documents, 'doc_1.husk'), 'utf-8')).title).toBe('second');
  });

  it('refuses an item without an id', () => {
    expect(() => store.saveDocument(dirs, { title: 'no id' })).toThrow('no id');
  });

  it('cannot write outside its folder through a hostile id', () => {
    const file = store.saveDocument(dirs, doc('../../evil'));
    expect(path.dirname(file)).toBe(dirs.documents);
  });

  it('deletes a document file and ignores a missing one', () => {
    store.saveDocument(dirs, doc('doc_1'));
    store.deleteDocument(dirs, 'doc_1');
    store.deleteDocument(dirs, 'doc_1');
    expect(fs.readdirSync(dirs.documents)).toEqual([]);
  });
});

describe('loadAll', () => {
  it('returns documents newest first and templates oldest first', () => {
    store.saveDocument(dirs, doc('a', { createdAt: '2026-01-01T00:00:00.000Z' }));
    store.saveDocument(dirs, doc('b', { createdAt: '2026-03-01T00:00:00.000Z' }));
    store.saveTemplate(dirs, doc('t2', { createdAt: '2026-02-01T00:00:00.000Z' }));
    store.saveTemplate(dirs, doc('t1', { createdAt: '2026-01-01T00:00:00.000Z' }));
    const loaded = store.loadAll(dirs);
    expect(loaded.documents.map((d) => d.id)).toEqual(['b', 'a']);
    expect(loaded.templates.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(loaded.recovered).toEqual([]);
  });

  it('moves unreadable files to Recovered instead of deleting them', () => {
    fs.writeFileSync(path.join(dirs.documents, 'broken.husk'), '{ nope');
    fs.writeFileSync(path.join(dirs.documents, 'no-id.husk'), JSON.stringify({ title: 'x' }));
    const loaded = store.loadAll(dirs);
    expect(loaded.documents).toEqual([]);
    expect(loaded.recovered).toHaveLength(2);
    expect(fs.readdirSync(dirs.recovered)).toHaveLength(2);
    expect(fs.readdirSync(dirs.documents)).toEqual([]);
  });

  it('keeps the newest of two files with the same id and sets the other aside', () => {
    fs.writeFileSync(path.join(dirs.documents, 'Old-name.husk'), JSON.stringify(doc('same', { title: 'old', updatedAt: '2020-01-01T00:00:00.000Z' })));
    store.saveDocument(dirs, doc('same', { title: 'new', updatedAt: '2026-06-01T00:00:00.000Z' }));
    const loaded = store.loadAll(dirs);
    expect(loaded.documents.map((d) => d.title)).toEqual(['new']);
    expect(fs.readdirSync(dirs.documents)).toEqual(['same.husk']);
    expect(loaded.recovered).toHaveLength(1);
  });

  it('renames a file that was saved under an old name to its id', () => {
    fs.writeFileSync(path.join(dirs.templates, 'Company_Official_Template.json'), JSON.stringify(doc('tpl_1')));
    const loaded = store.loadAll(dirs);
    expect(loaded.templates).toHaveLength(1);
    expect(fs.readdirSync(dirs.templates)).toEqual(['tpl_1.json']);
    expect(loaded.recovered).toEqual([]);
  });

  it('ignores files that are not documents', () => {
    fs.writeFileSync(path.join(dirs.documents, '.DS_Store'), 'x');
    fs.writeFileSync(path.join(dirs.documents, 'doc.husk.123.tmp'), '{}');
    const loaded = store.loadAll(dirs);
    expect(loaded.documents).toEqual([]);
    expect(loaded.recovered).toEqual([]);
  });
});

describe('migrate', () => {
  it('writes the imported items and sets files that are not part of the import aside', () => {
    store.saveDocument(dirs, doc('ghost'));
    fs.writeFileSync(path.join(dirs.templates, 'Old_Name.json'), JSON.stringify(doc('tpl_1')));
    const loaded = store.migrate(dirs, { documents: [doc('kept')], templates: [doc('tpl_1')] });
    expect(loaded.documents.map((d) => d.id)).toEqual(['kept']);
    expect(fs.readdirSync(dirs.documents)).toEqual(['kept.husk']);
    expect(fs.readdirSync(dirs.templates)).toEqual(['tpl_1.json']);
    expect(fs.readdirSync(dirs.recovered).some((f) => f.includes('ghost'))).toBe(true);
    expect(fs.readdirSync(dirs.recovered).some((f) => f.includes('Old_Name'))).toBe(true);
  });
});

describe('profile', () => {
  it('returns null before the first save, then the saved profile', () => {
    expect(store.loadProfile(dirs)).toBeNull();
    store.saveProfile(dirs, { defaultName: 'Jane' });
    expect(store.loadProfile(dirs)).toEqual({ defaultName: 'Jane' });
  });
});
