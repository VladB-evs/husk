// @font-face rules for the bundled Inter font. Callers pass the font files as data URLs, so the CSS works
// in the app, in the print window and in preview frames without network or file access.

const LATIN_RANGE =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT_RANGE =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

export function buildInterFaceCss(files: { latin: string; latinExt: string }): string {
  const face = (url: string, range: string) =>
    `@font-face{font-family:"Inter Variable";font-style:normal;font-display:block;font-weight:100 900;src:url(${url}) format("woff2-variations");unicode-range:${range};}`;
  return face(files.latinExt, LATIN_EXT_RANGE) + face(files.latin, LATIN_RANGE);
}
