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

## "3 A.M." (second video) is finished and rendered
`projects/3am/` (script, ElevenLabs voice "Jessica", timings, mix.py), `src/videos/3am/`, composition `ThreeAM`.
`npm run 3am:render` → `out/3AM.mp4` (85.3 s, 5,118 frames, 24.0 Mbps, 258 MB); uploaded as `renders/3AM.mp4` via LFS.
Encoding is constant 24 Mbps (x264 `nal-hrd=cbr` in `remotion.config.ts`): with only a target, dark scenes came out at ~21.9 Mbps.
Voiceover take 2 (79.5 s) ends with "Where will you go? To the bed or in the closet?"; "A: THE BED" / "B: THE CLOSET"
pop up on those words, then the "A or B?" card. The girl (and her double) has long hair, a bow, lashes, blush, pink pajamas.
On this Windows PC: Python 3.12 is at `%LOCALAPPDATA%\Programs\Python\Python312\python.exe` (`python3` is the Store
alias, so run scripts with that path); FFmpeg isn't on PATH, `tools/ffmpeg_path.py` uses the copy Remotion ships.

## "Found You" (third video) is finished and rendered
`projects/foundyou/` (script, ElevenLabs voice "Sia", timings, mix.py), `src/videos/foundyou/`, composition `FoundYou`.
`npm run foundyou:render` → `out/FoundYou.mp4` (112.5 s, 6,749 frames, 24.0 Mbps, 341 MB); uploaded as `renders/FoundYou.mp4`.
Hard cut to black right after "Found you." (picture and sound stop; one hit rings out). The two mimic lines are
treated in mix.py per the owner's note ("Are you lost?" lower + distant echo, "Found you." close whisper); the rest
of the voice is untouched. The hiker is a girl (matches Sia). The mimic is a skinwalker (`Skinwalker.tsx`): tall,
gaunt and grey, ribs and claws, an animal pelt with ears and muzzle, pitch-black eyes with black streaks, head
twitches, grin once its neck has bent. The flashlight flickers in 5-frame steps (never single-frame blips).
Check new renders for stray dark frames: an earlier beam-shader NaN made single frames go black.

## "Phi Pop" (fourth video) is finished and rendered
`projects/phipop/` (script, ElevenLabs voice "Declan Sage", timings, mix.py), `src/videos/phipop/`, composition `PhiPop`.
`npm run phipop:render` → `out/PhiPop.mp4` (105.5 s, 6,331 frames, 24.0 Mbps, 320 MB); uploaded as `renders/PhiPop.mp4`.
**Only this video** uses the "3D painted look" from the owner's reference clip: realistic-proportioned villagers
(`Human.tsx`, not the toy `Character`), a Kuwahara brush filter + ink edges + teal/orange grade (`Post` props
`paint`/`grade`, off by default so the other videos are unchanged), slow push-ins and hard cuts every 2–6 s.
Three sets: village of stilt houses (`Village.tsx`), house + kitchen (`House.tsx`), black void (`Void.tsx`).
Villagers dress Thai (Isan): women in a woven pha sin + blouse (no sari, no bindi), men in an indigo mor hom shirt
with a checked pha khao ma, the elder with cropped grey hair and a white sabai. The possessed host: grey-green skin,
dark veins, solid black eyes with small glowing pupils (meshes), a dark stain from the mouth, head twitches
(`twitch()` in Human.tsx), and her head turning right round to look back (lane, fridge, kitchen).
She walks with a real stalking gait (`walk`/`stride` props), and long hair is a strand-textured curtain with a few
sparse loose locks (not capsules). The neighbour stands on the house's porch, clear of the door frame.
Hair: Phi Pop keeps its original hair (scalp sphere, `hairMatV1`/`lockMatV1`, elder '#cfcac2'), unchanged pixel for pixel.
The rebuilt hair is **Krasue only** (the owner's choice), switched on by `<NewHair.Provider value={true}>` inside
Krasue's canvas: `hairCap()` builds a cap that hugs the skull and thins to nothing at a ragged,
parted hairline (never a helmet); one cap shape per style (long/bun/short/crop). Strand textures are light grey and
tinted per hair colour (`strandMat`), cut out with alphaTest (not blended), matte (`specularIntensity` 0.25). The scalp
material has a stronger polygonOffset than the painted face so the face never draws over the hairline. Long hair
tucks under the cap; loose locks are rooted under the hairline and tilt forward to clear the face.
Music: a synthesised Thai-style score (`projects/phipop/thaimusic.py`): khaen drone, ranat and khim, ching and klong,
in Thai 7-tone tuning; dark and sparse at night, lighter by day, only the drone under the chewing, dead stop at the cut.
Thai title ผีปอบ uses Noto Sans Thai (`public/fonts/NotoSansThai-ExtraBold.woff2`). Captions show "Phi Pop"/"Isan"
though the voice says the phonetic "Pee Pop"/"Ee-sahn". Gore is only implied. Hard cut to black after "light."
Camera depth range is per-shot optional (`Cam.near/far`, default 0.02/80); Phi Pop uses 0.05/200 for its sky.

## "Krasue" (fifth video) is finished and rendered
`projects/krasue/` (script, voice "Declan Sage", timings, mix.py), `src/videos/krasue/`, composition `Krasue`.
`npm run krasue:render` → `out/Krasue.mp4` (95.6 s, 5,738 frames, 24.0 Mbps, 290 MB); uploaded as `renders/Krasue.mp4`.
Same 3D painted look and Thai villagers as Phi Pop (reuses `src/videos/phipop/Human.tsx`, `Village.tsx`), but a
different village: forest, bamboo, thorny branches on shuttered windows, red lanterns, a temple in the mist.
The Krasue (`Krasue.tsx`): floating head, red-glowing eyes, jaw hanging too low, long wet hair, organs as a pulsing
red glow beneath (never detailed, no babies shown), a lantern-like halo from afar. Ending: red glow through the
curtains, her shadow behind them, dead silence from "don't open the curtains", a soft tap on the glass, cut to black.
Mist sprites stay >6 m off the lane: a camera passing through a puff makes the haze pop. Music reuses
`projects/phipop/thaimusic.py`.

Only if the soundtrack or timings must be rebuilt (Python + FFmpeg needed):
`npm run room414:align` then `npm run room414:mix`.

## "17 Seconds" (sixth video) is finished and rendered
`projects/seventeen/` (script, ElevenLabs voice "Valko - Slow & Dark", timings, mix.py, the owner's scene guide),
`src/videos/seventeen/`, composition `Seventeen`. `npm run seventeen:render` → `out/Seventeen.mp4` (69.9 s, 4,193 frames,
24.0 Mbps, 212 MB); uploaded as `renders/Seventeen.mp4`. Toy look of 3 A.M. (the owner's choice): the narrator is
`Character` outfit `sleeper` (a man, short hair) with the new hi-res faces `stare`/`tired`/`smirk`/`fear` (`faceHi`).
The mirror is a real `Reflector` whose camera also sees **layer 1**: the thing (`Leaner.tsx`: black hooded body, long dark
neck, pale face, slanted black eyes, a slit of teeth that stretches into a huge grin) and the black doorway exist only on
layer 1, so they show in the mirror but not in the room; the phone feed and the last shot enable layer 1 (`Cam17.real`).
Present-day shots (lamp on, door shut) bracket the story; big 00:07 / 00:12 / red 00:17 stamps; title "17 SECONDS".
No fade in, hard cut after "Don't look behind you" so it loops into the first shot; dead silence there plus one tap.
