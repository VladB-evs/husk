import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Sandbox, makeSandbox, runSession, sampleDoc, writeDocFile } from './helpers';

let box: Sandbox;
beforeEach(() => {
  box = makeSandbox();
});
afterEach(() => box.cleanup());

describe('a window of half a screen', () => {
  it('can be made narrow, and every screen still fits without sideways scrolling', () => {
    writeDocFile(box, sampleDoc({ id: 'doc_a' }));
    const { result } = runSession(box, 'narrow');

    expect(result.minWidth).toBeLessThanOrEqual(600);
    for (const width of [result.minWidth, 640, 760]) {
      const r = result[width];
      expect(r.pageScrollsSideways, `app at ${width}px`).toBe(false);
      expect(r.exportRight, `export button at ${width}px`).toBeLessThanOrEqual(r.vw);
      // the page is scaled down to fit the window width
      expect(r.scrollerScrollsSideways, `page at ${width}px`).toBe(false);
      expect(r.pageRight).toBeLessThanOrEqual(r.scrollerRight);
    }
    expect(result[result.minWidth].zoomLabel).not.toBe('100%');
    expect(result.gallerySideways).toBe(false);
    expect(result.studioSideways).toBe(false);
  });
});

describe('saving while typing', () => {
  it('does not write or flash a status for every letter, and ends as saved', () => {
    writeDocFile(box, sampleDoc({ id: 'doc_a' }));
    const { result } = runSession(box, 'typing');

    expect(result.letters).toBeGreaterThan(30);
    expect(result.writesWhileTyping).toBeLessThanOrEqual(1); // at most the 5 second safety save
    expect(result.statusChanges).toBeLessThanOrEqual(3);
    expect(result.finalStatus).toBe('Saved');
    const saved = JSON.parse(fs.readFileSync(path.join(box.data, 'Documents', 'doc_a.husk'), 'utf-8'));
    expect(saved.title).toBe('Typing a long title letter by letter');
  });
});

describe('shipped defaults', () => {
  it('starts with a neutral template and no personal or company details', () => {
    runSession(box, 'snapshot');
    const files = fs.readdirSync(path.join(box.data, 'Templates'));
    const all = [
      ...files.map((f) => fs.readFileSync(path.join(box.data, 'Templates', f), 'utf-8')),
      ...fs.readdirSync(path.join(box.data, 'Documents')).map((f) => fs.readFileSync(path.join(box.data, 'Documents', f), 'utf-8')),
    ].join('\n');
    expect(all).not.toMatch(/romi|neuro|bacila|vlad|@/i);
    expect(all).not.toContain('data:image'); // no logo is shipped
    expect(all).toContain('Starter Template');
  });
});
