# Notes for Claude

## Owner's preferences (always follow)
- Videos are vertical **1080×1920 at 60 fps**, video bitrate **22–25 Mbps** (set in `remotion.config.ts`:
  24 Mbps target, 25 Mbps max). Check it after every render with
  `ffprobe -v error -select_streams v:0 -show_entries stream=bit_rate -of csv=p=0 out/<file>.mp4`.
- **Never lose quality**: keep the full-quality render; don't compress the deliverable to save size.
- **No film grain** (the `grain` setting in `src/three/Post.tsx` stays 0).
- Don't start building or rendering a *new* video until the owner says so.
- Keep the voiceover exactly as delivered (no trimming or speeding up) unless asked.

## Current state: "Room 414" is finished and ready to render
Everything needed is committed: script, ElevenLabs voiceover (`projects/room414/voice.mp3`),
word timings (`timings.json`), mixed soundtrack (`public/room414/soundtrack.wav`), fonts, all 3D code.
The cloud container has no GPU, so the owner renders on their own faster PC.

**When a session starts on the owner's PC — check first, then wait for the go-ahead:**
0. Before rendering anything, identify the graphics card and estimate the render time, then tell the
   owner and **wait for them to say "render"**:
   - Windows: `wmic path win32_VideoController get name,AdapterRAM` (or PowerShell
     `Get-CimInstance Win32_VideoController | Select Name,AdapterRAM`); macOS:
     `system_profiler SPDisplaysDataType`; Linux: `nvidia-smi` or `lspci | grep -i vga`. Also note CPU cores.
   - Measure, don't guess: `npm ci`, then render one 3-second test clip
     (`npx remotion render Room414 out/test.mp4 --frames=1800-1980`) and time it.
     Full render time ≈ test time × 5360 / 181 (plus ~1 min for audio and muxing).
   - Report: the GPU name, whether Chrome is using it (if the test is as slow as ~0.85 s/frame it is
     falling back to the CPU — try `REMOTION_GL=egl` / `vulkan`), and the estimated total time.
Then, once the owner says render:
1. `npm ci` (needs Node 18+; Remotion downloads its own Chrome Headless Shell on first render).
2. `npm run room414:render` → `out/Room414.mp4` (H.264 at 24 Mbps, max 25 Mbps, AAC 256k, 89 s, 5,360 frames).
   `remotion.config.ts` picks the GPU (`angle`) automatically outside the cloud container.
   If the GPU path fails, try `REMOTION_GL=egl` or `REMOTION_GL=vulkan`; last resort `swangle` (CPU, slow).
3. Check it: `ffprobe out/Room414.mp4` (1080×1920, 60 fps, ~89.3 s, audio present, video bitrate 22–25 Mbps) and look at a few frames.
4. Upload the full-quality file to GitHub **unchanged** (no re-encode, no compression), whatever its size:
   - Plain Git rejects files over 100 MB, so use **Git LFS**: `git lfs install`,
     `git lfs track "renders/*.mp4"`, copy the file to `renders/Room414.mp4`, commit `.gitattributes`
     and the file, push to the working branch. (`*.mp4` is ignored at the top level; `renders/` is allowed.)
   - LFS takes files up to 2 GB each (Free/Pro plans). If the file is bigger, split it losslessly:
     `split -b 1900M -d renders/Room414.mp4 renders/Room414.mp4.part` and commit the parts plus a note
     that `cat renders/Room414.mp4.part* > Room414.mp4` (Windows: `copy /b`) restores the exact file.
   - Tell the owner the file size and that it is the untouched render.

Only if the soundtrack or timings must be rebuilt (Python + FFmpeg needed):
`npm run room414:align` then `npm run room414:mix`.
