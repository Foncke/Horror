# Horror video studio

Vertical (1080×1920, 60 fps) narrated 3D horror shorts, built with Remotion + Three.js.

## Setup
`bash scripts/setup.sh` installs everything: Node packages (Remotion 4.0.545, @remotion/three,
React 19, TypeScript, Three.js, React Three Fiber, GSAP, Lucide), Python packages (numpy, scipy,
soundfile, Pillow, sherpa-onnx), FFmpeg, the speech model and the fonts.

## Making a video (example: `projects/room414`)
1. Put the narration in `projects/<name>/voice.mp3` and the script in `script.txt`
   (one paragraph per line of narration, blank line between them).
2. `npm run room414:align` → word-by-word timings (`timings.json`) from the voice.
3. `npm run room414:mix` → soundtrack with ambience and effects timed to words (`public/<name>/soundtrack.wav`).
4. `npm run studio` to preview, `npm run stills -- Room414 out/stills 12.5 40` for test frames,
   `npm run room414:render` for the final MP4.

## Layout
- `src/videos/<name>/` – the film: `cues.ts` (shot list + cameras tied to words), sets, composition
- `src/three/` – reusable 3D: characters, doors/walls/lamps, bloom + grain + lens finish
- `src/components/` – fluid word-by-word captions, choice callouts
- `tools/` – alignment, sound synthesis, still rendering
