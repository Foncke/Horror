# Video Studio

Run `bash scripts/setup.sh [project-dir]` (or `npm run setup`) to install:

- **Animation (npm):** Remotion 4.0.545, @remotion/cli, bundler, renderer, media, React 19, React-DOM 19, TypeScript 5.9, @types/react
- **Sound, textures, transcription (pip):** numpy, scipy, soundfile, Pillow, sherpa-onnx
- **Speech model:** sherpa-onnx zipformer English (2023-06-26) → `models/` (~300 MB, not committed)
- **Fonts:** Inter Bold/ExtraBold, Playfair Display Italic, Anton, Oswald Bold, Special Elite → `<project-dir>/public/fonts` (woff2, from @fontsource on npm)
