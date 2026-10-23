import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Sandbox, listDir, makeSandbox, runSession, sampleDoc, writeDocFile } from './helpers';

let box: Sandbox;
beforeEach(() => {
  box = makeSandbox();
});
afterEach(() => box.cleanup());

const docsDir = () => path.join(box.data, 'Documents');
const readDoc = (id: string) => JSON.parse(fs.readFileSync(path.join(docsDir(), `${id}.husk`), 'utf-8'));

describe('disk store', () => {
  it('starts with one blank document on the very first launch and writes it to disk', () => {
    const { result } = runSession(box, 'snapshot');
    expect(result.documents).toEqual(['Document title']);
    expect(listDir(docsDir()).filter((f) => f.endsWith('.husk'))).toHaveLength(1);
    expect(listDir(path.join(box.data, 'Templates'))).toEqual(['custom-company-template.json']);
  });

  it('keeps edits, new documents and deletions after the app restarts', () => {
    writeDocFile(box, sampleDoc({ id: 'doc_a', title: 'Alpha', createdAt: '2026-01-02T00:00:00.000Z' }));
    writeDocFile(box, sampleDoc({ id: 'doc_b', title: 'Beta', createdAt: '2026-01-01T00:00:00.000Z' }));

    runSession(box, 'edit-and-delete', { retitle: 'Alpha renamed' });
    expect(readDoc('doc_a').title).toBe('Alpha renamed');

    runSession(box, 'edit-and-delete', { deleteTitle: 'Beta' });
    expect(fs.existsSync(path.join(docsDir(), 'doc_b.husk'))).toBe(false);

    const { result } = runSession(box, 'snapshot');
    expect(result.documents).toEqual(['Alpha renamed']);
  });

  it('does not bring a deleted last document back, and does not create a replacement', () => {
    writeDocFile(box, sampleDoc({ id: 'doc_only', title: 'Only one' }));
    runSession(box, 'snapshot'); // first launch marks the store as started
    runSession(box, 'edit-and-delete', { deleteTitle: 'Only one' });
    const { result } = runSession(box, 'snapshot');
    expect(result.documents).toEqual(['No documents found']);
    expect(listDir(docsDir()).filter((f) => f.endsWith('.husk'))).toEqual([]);
  });

  it('writes an edit that is still waiting when the window closes', () => {
    writeDocFile(box, sampleDoc({ id: 'doc_a', title: 'Alpha' }));
    runSession(box, 'snapshot');
    runSession(box, 'pending-edit-on-close', { title: 'Typed just before closing' });
    expect(readDoc('doc_a').title).toBe('Typed just before closing');
  });

  it('moves unreadable and duplicate files to Recovered and tells the user', () => {
    writeDocFile(box, sampleDoc({ id: 'doc_a', title: 'Alpha' }));
    fs.writeFileSync(path.join(docsDir(), 'broken.husk'), '{ this is not json');
    writeDocFile(box, sampleDoc({ id: 'doc_a', title: 'Alpha (older copy)', updatedAt: '2020-01-01T00:00:00.000Z' }), 'Alpha-title-copy.husk');

    const { result } = runSession(box, 'snapshot');
    expect(result.documents).toEqual(['Alpha']);
    expect(result.toasts).toContain('moved to ~/Documents/HUSK/Recovered');
    expect(listDir(path.join(box.data, 'Recovered'))).toHaveLength(2);
    expect(listDir(docsDir()).filter((f) => f.endsWith('.husk'))).toEqual(['doc_a.husk']);
  });

  it('imports data from the old browser storage once and sets stale files aside', () => {
    const legacyDoc = sampleDoc({ id: 'doc_legacy', title: 'From browser storage' });
    writeDocFile(box, sampleDoc({ id: 'doc_ghost', title: 'Deleted long ago' }));
    writeDocFile(box, legacyDoc, 'From_browser_storage.husk'); // an old version named files by title

    runSession(box, 'snapshot'); // creates the profile with the first-run state
    const legacyTemplate = JSON.parse(fs.readFileSync(path.join(box.data, 'Templates', 'custom-company-template.json'), 'utf-8'));
    runSession(box, 'legacy-import', { documents: [legacyDoc], templates: [{ ...legacyTemplate, name: 'Legacy template' }] });

    const { result } = runSession(box, 'snapshot');
    expect(result.documents).toEqual(['From browser storage']);
    expect(result.templates).toContain('Legacy template');
    expect(listDir(docsDir()).filter((f) => f.endsWith('.husk'))).toEqual(['doc_legacy.husk']);
    expect(listDir(path.join(box.data, 'Recovered')).some((f) => f.includes('doc_ghost'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(box.data, 'profile.json'), 'utf-8')).defaultName).toBe('Legacy Name');
  });
});

describe('app security', () => {
  it('gives the page no Node access, applies a CSP, and exposes only the storage and export API', () => {
    const { result, consoleErrors } = runSession(box, 'snapshot');
    expect(result.security.hasRequire).toBe(false);
    expect(result.security.hasProcess).toBe(false);
    expect(result.security.csp).toContain("script-src 'self'");
    expect(result.security.api).not.toContain('fsSaveDocument');
    expect(result.security.api).toContain('saveDocument');
    expect(consoleErrors.filter((m) => /Content Security Policy|Refused to/i.test(m))).toEqual([]);
  });
});

describe('templates and documents in the UI', () => {
  it('creates, renames, duplicates and deletes templates, and creates a document from one', () => {
    const { result } = runSession(box, 'ui-flows');
    const names = (list: string[]) => list.filter((t) => !/^\d/.test(t));
    expect(names(result.galleryStart)).toEqual(['Starter Template']);
    expect(names(result.galleryAfterNew)).toEqual(['Starter Template', 'Brand B']);
    expect(names(result.galleryAfterDuplicate)).toEqual(['Starter Template', 'Brand B', 'Brand B (Copy)']);
    expect(names(result.afterCancel)).toEqual(['Starter Template', 'Brand B', 'Brand B (Copy)']);
    expect(names(result.galleryAfterDelete)).toEqual(['Starter Template', 'Brand B']);
    expect(result.deleteDisabledWhenOne).toBe(1); // one template left, its delete button is disabled
    expect(result.documentsAfterCreate.length).toBe(2);

    // the files on disk match what the gallery shows
    expect(listDir(path.join(box.data, 'Templates'))).toHaveLength(1);
  });
});
