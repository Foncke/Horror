"""3 A.M. soundtrack: voiceover + ambience + effects, timed from timings.json.

Usage: python projects/3am/mix.py   ->  public/3am/soundtrack.wav
Without voice.mp3 it builds the music and effects alone (for test renders).
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import sfx  # noqa: E402
from ffmpeg_path import ffmpeg  # noqa: E402
from sfx import SR, bandpass, db, fade, lowpass, norm, place, rng, t_axis  # noqa: E402

T = json.loads((HERE / "timings.json").read_text(encoding="utf-8"))
LINES, WORDS = T["lines"], T["words"]


def word(li, text, nth=0):
    """Start time of the nth word in line li whose text starts with `text`."""
    hits = [w for w in WORDS if w["line"] == li and w["text"].lower().strip('"“”.,!?…—').startswith(text)]
    return hits[nth]["start"]


def env(points, n):
    """Piecewise-linear envelope from (time, value) points over n samples."""
    ts, vs = zip(*points)
    return np.interp(np.arange(n) / SR, ts, vs)


def blip(freq=1150, dur=0.06):
    """Quiet digital tick of the bedside clock."""
    t = t_axis(dur)
    return fade(norm(np.sin(2 * np.pi * freq * t) * np.exp(-t * 40)), 0.002, 0.02)


def breath(dur=1.2):
    """A slow, close exhale: filtered noise with a soft swell."""
    t = t_axis(dur)
    x = bandpass(rng.standard_normal(len(t)), 500, 4500) * np.sin(np.pi * t / dur) ** 1.5
    return fade(norm(x), 0.05, 0.1)


def bed_creak(dur=0.9):
    """Low groan of a mattress taking weight."""
    return norm(lowpass(sfx.creak(dur), 700))


voice_path = HERE / "voice.mp3"
final_end = LINES[10]["end"]
total = final_end + 8.0  # matches cue.end in src/videos/3am/cues.ts
N = int(total * SR)
if voice_path.exists():
    with tempfile.TemporaryDirectory() as d:
        subprocess.run([ffmpeg(), "-v", "error", "-y", "-i", str(voice_path), "-ac", "1", "-ar", str(SR), f"{d}/v.wav"], check=True)
        voice, _ = sf.read(f"{d}/v.wav", dtype="float32")
    N = max(N, len(voice))  # never cut the voice
    voice = voice /np.max(np.abs(voice)) * db(-3)
else:
    print("no voice.mp3 yet: building music and effects only")
    voice = np.zeros(0, dtype=np.float32)
voice = np.pad(voice, (0, N - len(voice)))
dur = N / SR

venv = np.convolve(np.abs(voice), np.ones(SR // 20) / (SR // 20), "same")
duck = 1 - 0.45 * np.clip(venv / (np.percentile(venv, 95) + 1e-9), 0, 1)

L = {k: LINES[k]["start"] for k in range(len(LINES))}
beds = np.zeros(N)
fx = np.zeros(N)

# --- beds ---------------------------------------------------------------
room = sfx.room_tone(dur) * env([(0, 0.0), (0.8, 0.8), (L[9] - 0.1, 0.8), (L[9] + 0.1, 0.35), (L[10], 0.8), (dur, 0.6)], N)
beds += room * db(-30)

drone_env = [
    (0, 0.0), (1.5, 0.25), (L[2], 0.4), (L[3], 0.55), (L[4], 0.7), (word(4, "foot") - 0.05, 0.85),
    (word(4, "foot") + 0.2, 0.15), (L[5] + 1.0, 0.3), (L[6], 0.9), (L[7], 0.8), (L[8], 0.9),
    (L[9] - 0.05, 0.9), (L[9] + 0.1, 0.0), (LINES[9]["end"] + 0.1, 0.0), (L[10], 0.6),
    (final_end, 1.0), (final_end + 4.5, 0.8), (total - 1.0, 0.0), (total, 0.0),
]
beds += sfx.drone(dur, base=49) * env(drone_env, N) * db(-15)
beds *= duck

# --- effects ------------------------------------------------------------
place(fx, blip(), word(0, "three") - 0.05, -22)

# a breath from the closet as the voice speaks again, then a whisper under "whispered"
place(fx, breath(1.4), L[3] - 0.9, -26)
place(fx, breath(1.0), word(4, "whispered") - 0.2, -24)
place(fx, sfx.riser(word(4, "foot") - L[4]), L[4], -20)
place(fx, sfx.hit(2.5, 60, 34), word(4, "foot") - 0.02, -8)

# heartbeat on "My heart stopped."
for k, dt in enumerate([0.0, 0.32]):
    place(fx, lowpass(sfx.knock(k), 160), L[5] + dt, -6)

# the reveal
place(fx, sfx.riser(L[6] - word(5, "shifted")), word(5, "shifted"), -18)
place(fx, sfx.hit(3.5), L[6] - 0.02, -5)

# the smile stretches
place(fx, sfx.riser(word(7, "wide") - word(7, "except")), word(7, "except"), -19)
place(fx, sfx.hit(3.0, 70, 36), word(7, "wide") - 0.02, -7)

# it leans on the bed
place(fx, bed_creak(1.1), word(8, "leaned"), -14)

# the closet door, then the final hit
place(fx, sfx.creak(3.0), word(10, "creaked") - 0.3, -9)
place(fx, sfx.hit(3.5, 55, 30), final_end + 0.2, -6)

# --- master -------------------------------------------------------------
delay = int(0.012 * SR)
right_beds = np.concatenate([np.zeros(delay), beds[:-delay]])
stereo = np.stack([voice + beds + fx, voice + right_beds + fx], axis=1)

active = np.abs(voice) > db(-40)
if active.sum() > SR:  # loudness: bring speech to about -14 dBFS RMS
    stereo *= db(-14) / np.sqrt(np.mean(stereo[active] ** 2))
else:
    stereo *= db(-6) / (np.max(np.abs(stereo)) + 1e-9)
ceiling = db(-1)
stereo = np.tanh(stereo / ceiling) * ceiling

out = ROOT / "public" / "3am" / "soundtrack.wav"
out.parent.mkdir(parents=True, exist_ok=True)
sf.write(out, stereo.astype(np.float32), SR, subtype="PCM_16")
print(f"wrote {out.relative_to(ROOT)}  {dur:.2f}s  peak {20*np.log10(np.max(np.abs(stereo))):.1f} dBFS")
