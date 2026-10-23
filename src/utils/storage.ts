import { DocumentTemplate, HuskDocument, UserSignatureProfile } from '../types';
import { INITIAL_TEMPLATES, BLANK_COMPANY_TEMPLATE } from '../constants/defaultTemplates';

/*
 * In the desktop app the files in ~/Documents/HUSK are the only store (written by the main process).
 * In a plain browser (dev mode) the same API falls back to localStorage.
 * Edits are saved after a short pause. Pending edits are written synchronously when the window closes.
 */

const TEMPLATES_KEY = 'husk_templates_v2';
const DOCUMENTS_KEY = 'husk_documents_v2';
const PROFILE_KEY = 'husk_user_profile_v2';
const CURRENT_DOC_ID_KEY = 'husk_current_doc_id_v2';
const MIGRATED_KEY = 'husk_disk_migrated_v1';
const SAVE_DELAY_MS = 1500; // write after this much quiet time
const SAVE_MAX_WAIT_MS = 5000; // but never wait longer than this while the user keeps typing

const EMPTY_PROFILE: UserSignatureProfile = { savedSignatureUrl: '', defaultName: '', defaultRole: '' };

export interface AppData {
  templates: DocumentTemplate[];
  documents: HuskDocument[];
  /** Messages for the user, for example files that were moved to the Recovered folder. */
  notices: string[];
}

let profileCache: UserSignatureProfile = { ...EMPTY_PROFILE };
let saveErrorHandler: (message: string) => void = () => {};

export function setSaveErrorHandler(handler: (message: string) => void) {
  saveErrorHandler = handler;
}

const api = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    saveErrorHandler('Could not save to browser storage.');
  }
}

// ───────────────────────── loading ─────────────────────────

/** Fill in fields that older files may not have, so the rest of the app can rely on them. */
export function normalizeDocument(raw: any): HuskDocument {
  const base = BLANK_COMPANY_TEMPLATE;
  return {
    id: String(raw.id),
    title: raw.title ?? '',
    subtitle: raw.subtitle ?? '',
    templateId: raw.templateId ?? base.id,
    branding: { ...base.branding, ...(raw.branding || {}) },
    metadataFields: Array.isArray(raw.metadataFields) ? raw.metadataFields : [],
    contentHtml: raw.contentHtml ?? '',
    signOff: { ...base.signOffConfig, ...(raw.signOff || {}) },
    footerConfig: { ...base.footerConfig, ...(raw.footerConfig || {}) },
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

export function normalizeTemplate(raw: any): DocumentTemplate {
  const base = BLANK_COMPANY_TEMPLATE;
  return {
    ...base,
    ...raw,
    id: String(raw.id),
    branding: { ...base.branding, ...(raw.branding || {}) },
    metadataFields: Array.isArray(raw.metadataFields) ? raw.metadataFields : base.metadataFields,
    signOffConfig: { ...base.signOffConfig, ...(raw.signOffConfig || {}) },
    footerConfig: { ...base.footerConfig, ...(raw.footerConfig || {}) },
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
  };
}

function recoveredNotice(count: number): string[] {
  return count > 0
    ? [`${count} file${count === 1 ? ' was' : 's were'} moved to ~/Documents/HUSK/Recovered (unreadable or duplicate).`]
    : [];
}

let loading: Promise<AppData> | null = null;

/** Load everything once. Calling it again returns the same result. */
export function loadAppData(): Promise<AppData> {
  return (loading ??= doLoad());
}

async function doLoad(): Promise<AppData> {
  const electron = api();
  const notices: string[] = [];

  if (!electron) {
    // Browser fallback
    let templates = readLocal<DocumentTemplate[]>(TEMPLATES_KEY, []).map(normalizeTemplate);
    let documents = readLocal<HuskDocument[]>(DOCUMENTS_KEY, []).map(normalizeDocument);
    profileCache = readLocal(PROFILE_KEY, { ...EMPTY_PROFILE });
    if (!templates.length) {
      templates = INITIAL_TEMPLATES;
      writeLocal(TEMPLATES_KEY, templates);
    }
    if (localStorage.getItem(MIGRATED_KEY) === null) {
      documents = [createDocumentFromTemplate(templates[0])];
      writeLocal(DOCUMENTS_KEY, documents);
      localStorage.setItem(MIGRATED_KEY, '1');
    }
    return { templates, documents, notices };
  }

  // One-time import of data that older versions kept in the browser storage
  const firstRunOfDiskStore = localStorage.getItem(MIGRATED_KEY) === null;
  const legacyDocs = readLocal<any[]>(DOCUMENTS_KEY, []).filter((d) => d && d.id);
  const legacyTemplates = readLocal<any[]>(TEMPLATES_KEY, []).filter((t) => t && t.id);
  let loaded: { documents: any[]; templates: any[]; recovered: string[] };

  if (firstRunOfDiskStore && (legacyDocs.length || legacyTemplates.length)) {
    loaded = await electron.storageMigrate({ documents: legacyDocs, templates: legacyTemplates });
    if (!(await electron.loadProfile())) {
      const legacyProfile = readLocal<UserSignatureProfile | null>(PROFILE_KEY, null);
      if (legacyProfile) await electron.saveProfile(legacyProfile);
    }
  } else {
    loaded = await electron.storageLoadAll();
  }
  notices.push(...recoveredNotice(loaded.recovered.length));

  let templates = loaded.templates.map(normalizeTemplate);
  let documents = loaded.documents.map(normalizeDocument);
  profileCache = { ...EMPTY_PROFILE, ...((await electron.loadProfile()) || {}) };

  if (!templates.length) {
    templates = INITIAL_TEMPLATES;
    templates.forEach((t) => electron.saveTemplate(t));
  }
  // The very first launch starts with one blank document. After that an empty list stays empty.
  if (firstRunOfDiskStore && !documents.length) {
    const first = createDocumentFromTemplate(templates[0]);
    documents = [first];
    await electron.saveDocument(first);
  }
  localStorage.setItem(MIGRATED_KEY, '1');
  return { templates, documents, notices };
}

// ───────────────────────── saving ─────────────────────────

const pendingDocs = new Map<string, HuskDocument>();
const pendingTemplates = new Map<string, DocumentTemplate>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function writeDocument(doc: HuskDocument) {
  const electron = api();
  if (!electron) {
    const all = readLocal<HuskDocument[]>(DOCUMENTS_KEY, []);
    writeLocal(DOCUMENTS_KEY, all.some((d) => d.id === doc.id) ? all.map((d) => (d.id === doc.id ? doc : d)) : [doc, ...all]);
    return;
  }
  const res = await electron.saveDocument(doc);
  if (!res.success) saveErrorHandler(`Could not save "${doc.title || 'document'}": ${res.error}`);
}

async function writeTemplate(template: DocumentTemplate) {
  const electron = api();
  if (!electron) {
    const all = readLocal<DocumentTemplate[]>(TEMPLATES_KEY, []);
    writeLocal(TEMPLATES_KEY, all.some((t) => t.id === template.id) ? all.map((t) => (t.id === template.id ? template : t)) : [...all, template]);
    return;
  }
  const res = await electron.saveTemplate(template);
  if (!res.success) saveErrorHandler(`Could not save template "${template.name}": ${res.error}`);
}

export type SaveStatus = 'saved' | 'pending' | 'saving';

let status: SaveStatus = 'saved';
const listeners = new Set<(s: SaveStatus) => void>();

function setStatus(next: SaveStatus) {
  if (next === status) return;
  status = next;
  listeners.forEach((l) => l(next));
}

/** Tells the UI whether edits are waiting to be written. It only fires when the state changes, not per keystroke. */
export function subscribeSaveStatus(listener: (s: SaveStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let firstPendingAt = 0;

function schedule() {
  const now = Date.now();
  if (!firstPendingAt) firstPendingAt = now;
  if (timer) clearTimeout(timer);
  const wait = Math.max(0, Math.min(SAVE_DELAY_MS, SAVE_MAX_WAIT_MS - (now - firstPendingAt)));
  timer = setTimeout(flushPendingAsync, wait);
  setStatus('pending');
}

async function flushPendingAsync() {
  timer = null;
  firstPendingAt = 0;
  const docs = Array.from(pendingDocs.values());
  const templates = Array.from(pendingTemplates.values());
  pendingDocs.clear();
  pendingTemplates.clear();
  setStatus('saving');
  await Promise.all([...docs.map(writeDocument), ...templates.map(writeTemplate)]);
  // Another edit may have come in while writing
  if (!timer) setStatus('saved');
}

/** Write all pending edits now. Used when the window closes. */
export function flushPendingSync() {
  if (timer) clearTimeout(timer);
  timer = null;
  const electron = api();
  pendingDocs.forEach((doc) => {
    if (electron) electron.saveDocumentSync(doc);
    else void writeDocument(doc);
  });
  pendingTemplates.forEach((t) => void writeTemplate(t));
  pendingDocs.clear();
  pendingTemplates.clear();
  firstPendingAt = 0;
  setStatus('saved');
}

export function persistDocument(doc: HuskDocument) {
  pendingDocs.set(doc.id, doc);
  schedule();
}

export function persistTemplate(template: DocumentTemplate) {
  pendingTemplates.set(template.id, template);
  schedule();
}

export async function removeDocument(id: string) {
  pendingDocs.delete(id);
  const electron = api();
  if (!electron) {
    writeLocal(DOCUMENTS_KEY, readLocal<HuskDocument[]>(DOCUMENTS_KEY, []).filter((d) => d.id !== id));
    return;
  }
  const res = await electron.deleteDocument(id);
  if (!res.success) saveErrorHandler(`Could not delete the document file: ${res.error}`);
}

export async function removeTemplate(id: string) {
  pendingTemplates.delete(id);
  const electron = api();
  if (!electron) {
    writeLocal(TEMPLATES_KEY, readLocal<DocumentTemplate[]>(TEMPLATES_KEY, []).filter((t) => t.id !== id));
    return;
  }
  const res = await electron.deleteTemplate(id);
  if (!res.success) saveErrorHandler(`Could not delete the template file: ${res.error}`);
}

// ───────────────────────── profile and small settings ─────────────────────────

export function getStoredUserProfile(): UserSignatureProfile {
  return profileCache;
}

export function saveUserProfile(profile: UserSignatureProfile): void {
  profileCache = profile;
  const electron = api();
  if (electron) {
    electron.saveProfile(profile).then((res) => {
      if (!res.success) saveErrorHandler(`Could not save your signature profile: ${res.error}`);
    });
  } else {
    writeLocal(PROFILE_KEY, profile);
  }
}

export function getCurrentDocId(): string | null {
  return localStorage.getItem(CURRENT_DOC_ID_KEY);
}

export function setCurrentDocId(id: string): void {
  localStorage.setItem(CURRENT_DOC_ID_KEY, id);
}

// ───────────────────────── factories ─────────────────────────

export function createDocumentFromTemplate(template: DocumentTemplate, title = 'Document title'): HuskDocument {
  const profile = getStoredUserProfile();
  return {
    id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    title: title || template.titlePlaceholder || 'Document title',
    subtitle: template.subtitlePlaceholder || '',
    templateId: template.id,
    branding: { ...template.branding },
    metadataFields: template.metadataFields.map((f) => ({ ...f, value: '' })),
    contentHtml: template.contentHtml || '',
    signOff: {
      ...template.signOffConfig,
      name: profile.defaultName || template.signOffConfig.name || '',
      role: profile.defaultRole || template.signOffConfig.role || '',
      signatureUrl: profile.savedSignatureUrl || template.signOffConfig.signatureUrl || '',
      date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    },
    footerConfig: { ...template.footerConfig },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
