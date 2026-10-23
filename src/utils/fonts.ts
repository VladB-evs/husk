import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?inline';
import interLatinExt from '@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?inline';
import { buildInterFaceCss } from '../shared/fontFace';

/** Inter as @font-face CSS with the font files embedded, for preview frames and browser printing. */
export const INTER_FACE_CSS = buildInterFaceCss({ latin: interLatin, latinExt: interLatinExt });
