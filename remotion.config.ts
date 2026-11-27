import fs from 'node:fs';
import {Config} from '@remotion/cli/config';

// Remotion's own browser download is blocked in the cloud container, so use the
// Chrome Headless Shell that ships with it (same version Remotion expects).
const bundled = '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const browser = process.env.REMOTION_BROWSER ?? (fs.existsSync(bundled) ? bundled : null);
if (browser) Config.setBrowserExecutable(browser);

// In the cloud container there is no GPU, so SwiftShader draws WebGL on the CPU (slow).
// On any other machine use the real graphics card through ANGLE (much faster).
// Override with REMOTION_GL=swangle|angle|egl|vulkan if needed.
type Gl = 'swangle' | 'angle' | 'egl' | 'vulkan' | 'angle-egl';
Config.setChromiumOpenGlRenderer((process.env.REMOTION_GL as Gl | undefined) ?? (fs.existsSync(bundled) ? 'swangle' : 'angle'));

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(100);
Config.setCodec('h264');
// Owner's standard: every video at 22-25 Mbps.
// Constant 24 Mbps: with only a target, x264 undershoots on dark, simple scenes (3 A.M. came out at
// ~21.9 Mbps), so x264's CBR mode pads every second up to the target. Never above 25 Mbps.
Config.setVideoBitrate('24M');
Config.setEncodingMaxRate('24M');
Config.setEncodingBufferSize('24M');
Config.overrideFfmpegCommand(({args}) => {
  if (!args.includes('libx264')) return args;
  const out = args[args.length - 1];
  return [...args.slice(0, -1), '-x264-params', 'nal-hrd=cbr', out];
});
Config.setPixelFormat('yuv420p');
Config.setAudioCodec('aac');
Config.setAudioBitrate('256k');
