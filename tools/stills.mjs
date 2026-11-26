// Render still frames for review: node tools/stills.mjs <compositionId> <outDir> <seconds...>
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';

const [id, outDir, ...secs] = process.argv.slice(2);
const browserExecutable = process.env.REMOTION_BROWSER ?? '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const chromiumOptions = {gl: process.env.REMOTION_GL ?? 'swangle'};
fs.mkdirSync(outDir, {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts')});
const composition = await selectComposition({serveUrl, id, browserExecutable, chromiumOptions});
for (const s of secs) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(Number(s) * composition.fps));
  const t0 = Date.now();
  const output = path.join(outDir, `${id}-${String(s).replace('.', '_')}s.jpg`);
  await renderStill({serveUrl, composition, frame, output, imageFormat: 'jpeg', jpegQuality: 90, browserExecutable, chromiumOptions, timeoutInMilliseconds: 120000});
  console.log(`${output}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
