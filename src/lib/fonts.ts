import {continueRender, delayRender, staticFile} from 'remotion';

const FONTS: [family: string, file: string, weight: string, style: string][] = [
  ['Inter', 'Inter-Bold.woff2', '700', 'normal'],
  ['Inter', 'Inter-ExtraBold.woff2', '800', 'normal'],
  ['Special Elite', 'SpecialElite-Regular.woff2', '400', 'normal'],
  ['Anton', 'Anton-Regular.woff2', '400', 'normal'],
  ['Oswald', 'Oswald-Bold.woff2', '700', 'normal'],
  ['Playfair Display', 'PlayfairDisplay-Italic.woff2', '400', 'italic'],
];

let ready: Promise<void> | null = null;

/** Load the project fonts once; resolves when they can be drawn (also on canvas textures). */
export const loadFonts = (): Promise<void> => {
  if (ready) return ready;
  const handle = delayRender('Loading fonts');
  ready = Promise.all(
    FONTS.map(async ([family, file, weight, style]) => {
      const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format('woff2')`, {weight, style});
      await face.load();
      (document.fonts as unknown as Set<FontFace>).add(face);
    }),
  ).then(() => continueRender(handle));
  return ready;
};
