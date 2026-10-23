import * as fs from 'fs';
import * as path from 'path';

/*
 * On-disk store for documents, templates and the user profile. The files are the source of truth.
 * - Every write goes to a temp file first and is renamed into place, so a crash cannot leave half a file.
 * - Files that cannot be read, or that duplicate another file, are moved to Recovered/ and never deleted.
 */

export interface StoreDirs {
  base: string;
  documents: string;
  templates: string;
  signatures: string;
  exports: string;
  recovered: string;
}

export interface LoadResult {
  documents: any[];
  templates: any[];
  recovered: string[]; // files that were moved to Recovered/
}

export const safeFileId = (id: unknown) => String(id).replace(/[^a-zA-Z0-9_\-]/g, '_');

export function storeDirs(base: string): StoreDirs {
  return {
    base,
    documents: path.join(base, 'Documents'),
    templates: path.join(base, 'Templates'),
    signatures: path.join(base, 'Signatures'),
    exports: path.join(base, 'Exports'),
    recovered: path.join(base, 'Recovered'),
  };
}

export function ensureDirs(dirs: StoreDirs) {
  Object.values(dirs).forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
}

export function atomicWrite(file: string, data: string) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data, 'utf-8');
  fs.renameSync(tmp, file);
}

const docFile = (dirs: StoreDirs, id: string) => path.join(dirs.documents, `${safeFileId(id)}.husk`);
const templateFile = (dirs: StoreDirs, id: string) => path.join(dirs.templates, `${safeFileId(id)}.json`);

export function saveDocument(dirs: StoreDirs, doc: any): string {
  if (!doc || typeof doc.id !== 'string' || !doc.id) throw new Error('Document has no id');
  const file = docFile(dirs, doc.id);
  atomicWrite(file, JSON.stringify(doc, null, 2));
  return file;
}

export function saveTemplate(dirs: StoreDirs, template: any): string {
  if (!template || typeof template.id !== 'string' || !template.id) throw new Error('Template has no id');
  const file = templateFile(dirs, template.id);
  atomicWrite(file, JSON.stringify(template, null, 2));
  return file;
}

export function deleteDocument(dirs: StoreDirs, id: string) {
  fs.rmSync(docFile(dirs, id), { force: true });
}

export function deleteTemplate(dirs: StoreDirs, id: string) {
  fs.rmSync(templateFile(dirs, id), { force: true });
}

function moveToRecovered(dirs: StoreDirs, file: string): string {
  fs.mkdirSync(dirs.recovered, { recursive: true });
  const name = `${Date.now()}-${path.basename(file)}`;
  fs.renameSync(file, path.join(dirs.recovered, name));
  return name;
}

/** Read every item of one kind. Unreadable and duplicate files go to Recovered/. */
function loadKind(
  dirs: StoreDirs,
  dir: string,
  extensions: string[],
  canonical: (id: string) => string,
  recovered: string[]
): any[] {
  const winners = new Map<string, { item: any; file: string }>();
  const losers: string[] = [];

  for (const name of fs.readdirSync(dir)) {
    if (!extensions.some((ext) => name.endsWith(ext))) continue;
    const file = path.join(dir, name);
    let item: any;
    try {
      item = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      item = null;
    }
    if (!item || typeof item.id !== 'string' || !item.id) {
      losers.push(file);
      continue;
    }
    const current = winners.get(item.id);
    if (!current) {
      winners.set(item.id, { item, file });
    } else if (String(item.updatedAt || '') > String(current.item.updatedAt || '')) {
      losers.push(current.file);
      winners.set(item.id, { item, file });
    } else {
      losers.push(file);
    }
  }

  losers.forEach((file) => recovered.push(moveToRecovered(dirs, file)));

  // A file saved under an old name (for example the document title) gets its id-based name.
  winners.forEach(({ file }, id) => {
    const wanted = canonical(id);
    if (file !== wanted) {
      if (fs.existsSync(wanted)) recovered.push(moveToRecovered(dirs, file));
      else fs.renameSync(file, wanted);
    }
  });

  return Array.from(winners.values()).map((w) => w.item);
}

export function loadAll(dirs: StoreDirs): LoadResult {
  ensureDirs(dirs);
  const recovered: string[] = [];
  const documents = loadKind(dirs, dirs.documents, ['.husk', '.json'], (id) => docFile(dirs, id), recovered);
  const templates = loadKind(dirs, dirs.templates, ['.json'], (id) => templateFile(dirs, id), recovered);
  documents.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  templates.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  return { documents, templates, recovered };
}

/**
 * One-time import of data that older versions kept in the browser storage. Imported items are written
 * to disk; files on disk that are not part of the import (documents deleted in the old version) are
 * moved to Recovered/ so they do not come back.
 */
export function migrate(dirs: StoreDirs, data: { documents: any[]; templates: any[] }): LoadResult {
  ensureDirs(dirs);
  data.documents.forEach((d) => saveDocument(dirs, d));
  data.templates.forEach((t) => saveTemplate(dirs, t));

  const keepDocs = new Set(data.documents.map((d) => safeFileId(d.id)));
  const keepTemplates = new Set(data.templates.map((t) => safeFileId(t.id)));
  const recovered: string[] = [];
  const sweep = (dir: string, keep: Set<string>) => {
    for (const name of fs.readdirSync(dir)) {
      const match = name.match(/^(.*)\.(husk|json)$/);
      if (!match) continue;
      if (!keep.has(match[1])) recovered.push(moveToRecovered(dirs, path.join(dir, name)));
    }
  };
  sweep(dirs.documents, keepDocs);
  sweep(dirs.templates, keepTemplates);

  const result = loadAll(dirs);
  result.recovered.push(...recovered);
  return result;
}

const profileFile = (dirs: StoreDirs) => path.join(dirs.base, 'profile.json');

export function loadProfile(dirs: StoreDirs): any | null {
  try {
    return JSON.parse(fs.readFileSync(profileFile(dirs), 'utf-8'));
  } catch {
    return null;
  }
}

export function saveProfile(dirs: StoreDirs, profile: any) {
  ensureDirs(dirs);
  atomicWrite(profileFile(dirs), JSON.stringify(profile, null, 2));
}
