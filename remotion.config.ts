import fs from 'node:fs';
import {Config} from '@remotion/cli/config';

// Remotion's own browser download is blocked in the cloud container, so use the
// Chrome Headless Shell that ships with it (same version Remotion expects).
const bundled = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = process.env.REMOTION_BROWSER ?? (fs.existsSync(bundled) ? bundled : null);
if (browser) Config.setBrowserExecutable(browser);

// No GPU here: SwiftShader draws WebGL on the CPU. Set REMOTION_GL=angle on a machine with a GPU.
Config.setChromiumOpenGlRenderer((process.env.REMOTION_GL as 'swangle' | 'angle' | undefined) ?? 'swangle');

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setAudioCodec('aac');
Config.setAudioBitrate('256k');
