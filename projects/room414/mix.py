"""Room 414 soundtrack: voiceover + ambience + effects, timed from timings.json.

Usage: python3 projects/room414/mix.py   ->  public/room414/soundtrack.wav
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
from sfx import SR, db, place  # noqa: E402

T = json.loads((HERE / "timings.json").read_text())
LINES, WORDS = T["lines"], T["words"]


def line(i):
    return LINES[i]


def word(li, text, nth=0):
    """Start time of the nth word in line li whose text starts with `text`."""
    hits = [w for w in WORDS if w["line"] == li and w["text"].lower().strip('"“”.,!?…—').startswith(text)]
    return hits[nth]["start"]


def load_voice():
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(HERE / "voice.mp3"), "-ac", "1", "-ar", str(SR), f"{d}/v.wav"], check=True)
        v, _ = sf.read(f"{d}/v.wav", dtype="float32")
    return v


def env(points, n):
    """Piecewise-linear envelope from (time, value) points over n samples."""
    ts, vs = zip(*points)
    return np.interp(np.arange(n) / SR, ts, vs)


voice = load_voice()
tail = 2.0  # let the last hit ring after "What would you do?"
N = len(voice) + int(tail * SR)
dur = N / SR
voice = np.pad(voice, (0, N - len(voice)))
voice = voice / np.max(np.abs(voice)) * db(-3)

# voice envelope for ducking the beds under speech
venv = np.abs(voice)
venv = np.convolve(venv, np.ones(SR // 20) / (SR // 20), "same")
duck = 1 - 0.45 * np.clip(venv / (np.percentile(venv, 95) + 1e-9), 0, 1)

L = {k: line(k)["start"] for k in range(len(LINES))}
END = {k: line(k)["end"] for k in range(len(LINES))}

beds = np.zeros(N)
fx = np.zeros(N)

# --- beds ---------------------------------------------------------------
rain = sfx.rain(dur) * env([(0, 0.0), (0.4, 1.0), (L[1], 0.8), (L[2] - 0.3, 0.25), (L[2] + 1.0, 0.0)], N)
beds += rain * db(-25)

room = sfx.room_tone(dur) * env([(0, 0.4), (L[2], 1.0), (L[13] - 0.1, 1.0), (L[13] + 0.15, 0.08), (L[14], 0.1), (L[14] + 1.5, 1.0), (dur, 1.0)], N)
beds += room * db(-27)

drone_env = [
    (0, 0.15), (L[2], 0.3), (L[4], 0.45), (L[6], 0.35), (L[9], 0.55), (L[9] + 6, 0.85),
    (L[12], 0.7), (L[13] - 0.1, 0.7), (L[13] + 0.2, 0.0), (L[14] + 0.5, 0.1), (L[15], 0.9),
    (L[16], 1.0), (L[18], 0.85), (L[21] - 0.05, 1.0), (L[21] + 0.15, 0.0), (dur, 0.0),
]
beds += sfx.drone(dur, base=55) * env(drone_env, N) * db(-15)

beds *= duck

# --- effects ------------------------------------------------------------
place(fx, sfx.key_slide(), word(1, "slides") + 0.15, -14)

# the three knocks on your door, landing with the spoken words
for k in range(3):
    place(fx, sfx.knock(k), word(6, "knock", k) - 0.04, -3)

# knocks on the next door: further away
for k in range(3):
    place(fx, sfx.far(sfx.knock(k)), word(10, "knock", k) - 0.04, -9)

place(fx, sfx.creak(1.5), word(11, "opens") - 0.25, -13)

# guests shuffling down the hallway
steps = [L[12] + 1.4 + i * 0.55 + (0.12 if i % 3 == 0 else 0) for i in range(12)]
place(fx, sfx.far(sfx.footsteps([s - steps[0] for s in steps], 8.0), 0.9), steps[0], -12)

place(fx, sfx.flicker_buzz(1.3), L[13] + 0.6, -24)
place(fx, sfx.riser(L[15] - L[14]), L[14], -17)

place(fx, sfx.hit(3.5), word(16, "alone") - 0.02, -5)

# two slow steps before the shadows appear, then the impact on "back"
place(fx, sfx.footsteps([0, 0.7], 1.5), word(17, "two") - 1.6, -17)
place(fx, sfx.hit(3.0, 70, 36), word(17, "back") - 0.02, -6)

place(fx, sfx.hit(2.5, 50, 30), L[21] - 0.03, -9)

# --- master -------------------------------------------------------------
mix = voice + beds + fx
# gentle stereo: beds slightly wider than the centred voice
delay = int(0.012 * SR)
right_beds = np.concatenate([np.zeros(delay), beds[:-delay]])
left = voice + beds + fx
right = voice + right_beds + fx
stereo = np.stack([left, right], axis=1)

# loudness: bring speech-active RMS to about -14 dBFS, then soft-limit at -1 dBFS
active = np.abs(voice) > db(-40)
rms = np.sqrt(np.mean(stereo[active] ** 2))
stereo *= db(-14) / rms
ceiling = db(-1)
stereo = np.tanh(stereo / ceiling) * ceiling

out = ROOT / "public" / "room414" / "soundtrack.wav"
out.parent.mkdir(parents=True, exist_ok=True)
sf.write(out, stereo.astype(np.float32), SR, subtype="PCM_16")
print(f"wrote {out.relative_to(ROOT)}  {dur:.2f}s  peak {20*np.log10(np.max(np.abs(stereo))):.1f} dBFS")
