import { describe, expect, it } from 'vitest';
import { normalizeDocument, normalizeTemplate } from './storage';

describe('normalizeDocument', () => {
  it('fills in fields that an old file does not have', () => {
    const doc = normalizeDocument({ id: 'doc_1', title: 'Old' });
    expect(doc.id).toBe('doc_1');
    expect(doc.subtitle).toBe('');
    expect(doc.contentHtml).toBe('');
    expect(doc.metadataFields).toEqual([]);
    expect(doc.branding.primaryColor).toBeTruthy();
    expect(doc.signOff.enabled).toBe(true);
    expect(doc.footerConfig.enabled).toBe(true);
    expect(doc.createdAt).toBeTruthy();
  });

  it('keeps what the file has', () => {
    const doc = normalizeDocument({
      id: 'doc_1',
      title: 'Kept',
      branding: { primaryColor: '#000000' },
      signOff: { enabled: false },
      footerConfig: { enabled: false, leftText: 'Left' },
    });
    expect(doc.branding.primaryColor).toBe('#000000');
    expect(doc.branding.companyName).toBeDefined(); // still filled in
    expect(doc.signOff.enabled).toBe(false);
    expect(doc.footerConfig.leftText).toBe('Left');
  });
});

describe('normalizeTemplate', () => {
  it('fills in missing fields and keeps the id', () => {
    const t = normalizeTemplate({ id: 'tpl_1', name: 'Mine' });
    expect(t.id).toBe('tpl_1');
    expect(t.name).toBe('Mine');
    expect(t.metadataFields.length).toBeGreaterThan(0);
    expect(t.branding.primaryColor).toBeTruthy();
  });
});
