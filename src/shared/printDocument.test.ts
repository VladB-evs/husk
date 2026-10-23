import { describe, expect, it } from 'vitest';
import { buildFooterTemplate, buildPrintHtml, escapeHtml, markRowGroups, promoteHeaderRows } from './printDocument';

const doc = (over: Record<string, unknown> = {}) => ({
  title: 'Quarterly <report>',
  subtitle: 'Sub "title"',
  branding: { companyName: 'Acme', legalEntity: 'Acme & Sons', contactInfo: 'a@b.c', logoUrl: '', logoWidth: 120, primaryColor: '#123456', accentColor: '#eeeeee', borderColor: '#dddddd' },
  metadataFields: [
    { id: '1', label: 'Status', value: '<b>Draft</b>' },
    { id: '2', label: 'Version', value: '' },
    { id: '3', label: 'Author', value: 'Jane' },
  ],
  contentHtml: '<p>Body</p>',
  signOff: { enabled: true, title: 'Sign-off', name: 'Jane', role: 'CEO', date: '1 Jan 2026', signatureUrl: '' },
  footerConfig: { enabled: true, leftText: 'Acme | Confidential', rightText: 'Page 1' },
  ...over,
});

describe('escapeHtml', () => {
  it('escapes the characters that can break out of markup', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#039;&lt;/a&gt;');
  });
  it('turns null and undefined into an empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('buildPrintHtml', () => {
  it('escapes text fields so they cannot add markup', () => {
    const html = buildPrintHtml(doc());
    expect(html).toContain('Quarterly &lt;report&gt;');
    expect(html).toContain('&lt;b&gt;Draft&lt;/b&gt;');
    expect(html).not.toContain('<b>Draft</b>');
  });

  it('forbids scripts and network access in the printed page', () => {
    const html = buildPrintHtml(doc());
    expect(html).toContain("default-src 'none'");
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain('fonts.googleapis.com');
  });

  it('pairs metadata fields into four-column rows, with an empty pair for an odd count', () => {
    const html = buildPrintHtml(doc());
    expect(html.match(/<tr>/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('class="lbl"></td><td class="val"></td>');
  });

  it('shows a dash for an empty metadata value', () => {
    expect(buildPrintHtml(doc())).toContain('<td class="val">—</td>');
  });

  it('leaves out the sign-off block when it is switched off', () => {
    expect(buildPrintHtml(doc({ signOff: { enabled: false } }))).not.toContain('<table class="hd-signoff-table"');
  });

  it('adds the page rule only for browser printing, where the browser sets the margins', () => {
    expect(buildPrintHtml(doc())).not.toMatch(/@page \{[^}]*margin/);
    expect(buildPrintHtml(doc(), { browserPrint: true })).toMatch(/@page \{[^}]*margin/);
  });

  it('embeds the font CSS it is given', () => {
    expect(buildPrintHtml(doc(), { fontCss: '@font-face{font-family:"Test"}' })).toContain('font-family:"Test"');
  });
});

describe('promoteHeaderRows', () => {
  it('moves a first row of header cells into thead', () => {
    const out = promoteHeaderRows('<table><tbody><tr><th><p>A</p></th><th><p>B</p></th></tr><tr><td><p>1</p></td></tr></tbody></table>');
    expect(out).toBe('<table><thead><tr><th><p>A</p></th><th><p>B</p></th></tr></thead><tbody><tr><td><p>1</p></td></tr></tbody></table>');
  });

  it('does not touch a table whose first row has body cells', () => {
    const html = '<table><tbody><tr><td><p>1</p></td></tr></tbody></table>';
    expect(promoteHeaderRows(html)).toBe(html);
  });

  it('does not touch a row that mixes header and body cells', () => {
    const html = '<table><tbody><tr><th><p>Row title</p></th><td><p>x</p></td></tr><tr><th><p>Other</p></th></tr></tbody></table>';
    expect(promoteHeaderRows(html)).toBe(html);
  });

  it('handles several tables', () => {
    const one = '<table><tbody><tr><th>A</th></tr></tbody></table>';
    expect(promoteHeaderRows(one + one).match(/<thead>/g)).toHaveLength(2);
  });
});

describe('markRowGroups', () => {
  const row = (cells: string) => `<tr>${cells}</tr>`;
  const table = (...rows: string[]) => `<table><tbody>${rows.join('')}</tbody></table>`;

  it('marks every row of a merged group except the last', () => {
    const out = markRowGroups(table(row('<td rowspan="3">A</td><td>1</td>'), row('<td>2</td>'), row('<td>3</td>'), row('<td>4</td>')));
    expect(out.match(/data-keep/g)).toHaveLength(2); // rows 1 and 2; row 3 ends the group, row 4 is free
    expect(out).toContain('<tr data-keep="1"><td rowspan="3">');
  });

  it('leaves a table without merged cells alone', () => {
    const html = table(row('<td>1</td>'), row('<td>2</td>'));
    expect(markRowGroups(html)).toBe(html);
  });

  it('handles overlapping merges as one group and counts each table on its own', () => {
    const one = table(row('<td rowspan="2">A</td><td rowspan="3">B</td>'), row('<td>x</td>'), row('<td>y</td>'), row('<td>z</td>'));
    expect(markRowGroups(one).match(/data-keep/g)).toHaveLength(2);
    expect(markRowGroups(one + one).match(/data-keep/g)).toHaveLength(4);
  });

  it('keeps the attributes of the row', () => {
    const out = markRowGroups(table(row('<td rowspan="2">A</td>').replace('<tr>', '<tr style="height:40px">'), row('<td>b</td>')));
    expect(out).toContain('<tr style="height:40px" data-keep="1">');
  });
});

describe('empty paragraphs', () => {
  it('prints an empty paragraph as one empty line, like the editor shows it', () => {
    const html = buildPrintHtml(doc({ contentHtml: '<p>a</p><p></p><p style="text-align: center"></p>' }));
    expect(html).toContain('<p>a</p><p><br></p><p style="text-align: center"><br></p>');
  });
});

describe('buildFooterTemplate', () => {
  it('shows the footer text and lets Chromium fill in the page numbers', () => {
    const html = buildFooterTemplate(doc());
    expect(html).toContain('Acme | Confidential');
    expect(html).toContain('class="pageNumber"');
    expect(html).toContain('class="totalPages"');
  });

  it('escapes the footer text', () => {
    expect(buildFooterTemplate(doc({ footerConfig: { enabled: true, leftText: '<img src=x>' } }))).not.toContain('<img');
  });
});
