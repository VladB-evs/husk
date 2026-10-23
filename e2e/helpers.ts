import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electronBinary: string = require('electron');
const root = path.resolve(__dirname, '..');

export interface Sandbox {
  dir: string;
  data: string; // HUSK_DATA_DIR
  profile: string; // HUSK_USER_DATA
  cleanup: () => void;
}

export function makeSandbox(): Sandbox {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'husk-e2e-'));
  const data = path.join(dir, 'HUSK');
  const profile = path.join(dir, 'profile');
  fs.mkdirSync(data, { recursive: true });
  return { dir, data, profile, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

export interface SessionOutput<T> {
  result?: T;
  error?: string;
  consoleErrors: string[];
}

/** Start the built app once on the sandbox, run a scenario from e2e/scenarios, and return its result. */
export function runSession<T = any>(box: Sandbox, scenario: string, args: object = {}): SessionOutput<T> {
  const proc = spawnSync(electronBinary, [path.join(root, 'e2e/session.js'), scenario, JSON.stringify(args)], {
    cwd: root,
    encoding: 'utf-8',
    timeout: 120_000,
    env: {
      ...process.env,
      HUSK_DATA_DIR: box.data,
      HUSK_USER_DATA: box.profile,
      HUSK_E2E_SHOTS: process.env.HUSK_E2E_SHOTS || '',
      ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
    },
  });
  const line = (proc.stdout || '').split('\n').find((l) => l.startsWith('RESULT:'));
  if (!line) throw new Error(`Session "${scenario}" printed no result.\n${proc.stdout}\n${proc.stderr}`);
  const out = JSON.parse(line.slice('RESULT:'.length));
  if (out.error) throw new Error(`Session "${scenario}" failed: ${out.error}`);
  return { result: out.result, consoleErrors: out.consoleErrors || [] };
}

export function sampleDoc(overrides: Record<string, any> = {}) {
  const now = new Date().toISOString();
  return {
    id: 'doc_sample_1',
    title: 'Sample document',
    subtitle: 'A document for tests',
    templateId: 'custom-company-template',
    branding: {
      companyName: 'Test Co',
      legalEntity: 'Test Co Ltd',
      contactInfo: 'test.example',
      logoUrl: '',
      logoWidth: 140,
      primaryColor: '#9353d3',
      accentColor: '#f6f3ff',
      borderColor: '#ede9fe',
      textColor: '#1e293b',
      fontFamily: 'Inter',
    },
    metadataFields: [
      { id: '1', label: 'Document type', value: '' },
      { id: '2', label: 'Version', value: '' },
    ],
    contentHtml: '<p>Hello</p>',
    signOff: { enabled: true, title: 'Sign-off', name: '', role: '', date: '', signatureUrl: '' },
    footerConfig: { enabled: true, leftText: 'Sample | Confidential', rightText: 'Page 1' },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Write a document file the way the app does. */
export function writeDocFile(box: Sandbox, doc: any, fileName = `${doc.id}.husk`) {
  fs.mkdirSync(path.join(box.data, 'Documents'), { recursive: true });
  fs.writeFileSync(path.join(box.data, 'Documents', fileName), JSON.stringify(doc, null, 2));
}

export function listDir(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
}

/** Number of pages in a PDF file (counts page objects). */
export function pdfPageCount(file: string): number {
  const text = fs.readFileSync(file, 'latin1');
  return (text.match(/\/Type\s*\/Page(?![a-zA-Z])/g) || []).length;
}

/** Text of every page of a PDF, one string per page. */
export async function pdfPageTexts(file: string): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((item: any) => item.str).join(' ').replace(/\s+/g, ' '));
  }
  return pages;
}
