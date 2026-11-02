import { describe, expect, it } from 'vitest';
import { HuskImage, HuskImageRow } from './ImageUpload';
import { buildDocumentCss, buildEditorChromeCss } from '../shared/documentLayout';

describe('HuskImageRow and 2-Column Side-by-Side Images', () => {
  it('defines HuskImageRow with correct schema configuration', () => {
    expect(HuskImageRow.name).toBe('imageRow');
    expect(HuskImageRow.config.group).toBe('block');
    expect(HuskImageRow.config.content).toBe('image{1,4}');
    expect(HuskImageRow.config.defining).toBe(true);
    expect(HuskImageRow.config.isolating).toBe(true);
  });

  it('defines HuskImage as a block image', () => {
    expect(HuskImage.name).toBe('image');
  });

  it('includes flex row CSS for side-by-side images in both editor and print modes', () => {
    const brand = { primaryColor: '#FF4C00', accentColor: '#FFF1EC', borderColor: '#E5E7EB' };
    const printCss = buildDocumentCss(brand, 'print');
    const editorCss = buildDocumentCss(brand, 'editor');

    expect(printCss).toContain('.hd-body .husk-image-row');
    expect(printCss).toContain('display:flex !important');
    expect(printCss).toContain('flex-direction:row !important');
    expect(printCss).toContain('gap:16px !important');
    expect(printCss).toContain('flex:1 1 0% !important');

    expect(editorCss).toContain('.hd-body .husk-image-row');
    expect(editorCss).toContain('display:flex !important');
    expect(editorCss).toContain('flex-direction:row !important');
    expect(editorCss).toContain('gap:16px !important');
    expect(editorCss).toContain('flex:1 1 0% !important');
  });

  it('does not float images or force clear:both on paragraphs', () => {
    const brand = { primaryColor: '#FF4C00', accentColor: '#FFF1EC', borderColor: '#E5E7EB' };
    const css = buildDocumentCss(brand, 'editor');

    expect(css).not.toContain('float:left');
    expect(css).not.toContain('float:right');
    expect(css).not.toContain('.hd-body > p { clear:both; }');
  });

  it('includes visual drop target indicators in editor chrome css', () => {
    const chromeCss = buildEditorChromeCss();
    expect(chromeCss).toContain('.drop-target-left');
    expect(chromeCss).toContain('.drop-target-right');
    expect(chromeCss).toContain('box-shadow:inset 5px 0 0 #FF4C00');
    expect(chromeCss).toContain('box-shadow:inset -5px 0 0 #FF4C00');
  });
});
