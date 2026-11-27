"""Found You soundtrack: voiceover + forest ambience + effects, timed from timings.json.

Usage: python projects/foundyou/mix.py   ->  public/foundyou/soundtrack.wav

The narration is used as delivered, except the two lines the mimic speaks, which are
treated so they sound uncanny (owner's note):
  "Are you lost?"  slightly lower pitch, quieter, distant echo from behind
  "Found you."     slightly lower pitch, close breathy whisper at the left ear
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import sfx  # noqa: E402
from ffmpeg_path import ffmpeg  # noqa: E402
from sfx import SR, bandpass, db, fade, highpass, lowpass, norm, place, rng, t_axis  # noqa: E402

T = json.loads((HERE / "timings.json").read_text(encoding="utf-8"))
LINES, WORDS = T["lines"], T["words"]


def word(li, text, nth=0, key="start"):
    hits = [w for w in WORDS if w["line"] == li and w["text"].lower().strip('"“”.,!?…—').startswith(text)]
    return hits[nth][key]


def env(points, n):
    ts, vs = zip(*points)
    return np.interp(np.arange(n) / SR, ts, vs)


# --- forest sounds ------------------------------------------------------
def wind(dur):
    b = lowpass(sfx.brown(dur), 900)
    gust = 0.6 + 0.4 * lowpass(rng.standard_normal(int(dur * SR)), 0.3)
    return norm(b * gust)


def crickets(dur):
    t = t_axis(dur)
    out = np.zeros(len(t))
    for f, rate, ph in [(4300, 14.0, 0.0), (4650, 11.5, 1.3), (3950, 17.0, 2.1)]:
        pulse = (np.sin(2 * np.pi * rate * t + ph) > 0.6).astype(float)
        group = (np.sin(2 * np.pi * 0.55 * t + ph * 2) > -0.2).astype(float)
        out += np.sin(2 * np.pi * f * t) * lowpass(pulse * group, 300)
    return norm(out)


def bird(dur=0.5):
    t = t_axis(dur)
    f = 2600 + 1400 * np.sin(np.pi * t / dur) ** 2
    return fade(norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dur) ** 2), 0.01, 0.05)


def leaf_step():
    t = t_axis(0.3)
    crackle = bandpass(rng.standard_normal(len(t)), 1500, 7000) * (rng.random(len(t)) > 0.75)
    body = lowpass(rng.standard_normal(len(t)), 400)
    return fade(norm((norm(crackle) * 0.8 + norm(body) * 0.5) * np.exp(-t * 14)), 0.002, 0.05)


def click():
    t = t_axis(0.05)
    return fade(norm(highpass(rng.standard_normal(len(t)), 2000) * np.exp(-t * 300)), 0.0005, 0.01)


def whoosh(dur=0.45):
    t = t_axis(dur)
    x = bandpass(rng.standard_normal(len(t)), 400, 5000) * np.sin(np.pi * t / dur) ** 2
    return fade(norm(x), 0.01, 0.05)


def bone_crack():
    t = t_axis(0.12)
    return fade(norm(highpass(rng.standard_normal(len(t)), 900) * np.exp(-t * 90) + 0.5 * np.sin(2 * np.pi * 180 * t) * np.exp(-t * 60)), 0.001, 0.02)


def heartbeat(times, dur):
    out = np.zeros(int(dur * SR))
    for k, at in enumerate(times):
        for dt, g in [(0, 1.0), (0.28, 0.7)]:
            place(out, lowpass(sfx.knock(k % 3), 140) * g, at + dt)
    return out


# --- voice --------------------------------------------------------------
with tempfile.TemporaryDirectory() as d:
    subprocess.run([ffmpeg(), "-v", "error", "-y", "-i", str(HERE / "voice.mp3"), "-ac", "1", "-ar", str(SR), f"{d}/v.wav"], check=True)
    voice, _ = sf.read(f"{d}/v.wav", dtype="float32")
voice = voice / np.max(np.abs(voice)) * db(-3)

CUT = WORDS[-1]["end"] + 0.06  # hard cut to black right after "Found you."
TAIL = 2.6
N = max(int((CUT + TAIL) * SR), len(voice))
dur = N / SR
voice = np.pad(voice, (0, N - len(voice)))


def lift(a, b):
    """Take a segment out of the dry voice (short fades) and return it."""
    i, j = int(a * SR), int(b * SR)
    seg = voice[i:j].copy()
    ramp = np.ones(j - i)
    k = int(0.02 * SR)
    ramp[:k] = np.linspace(0, 1, k)
    ramp[-k:] = np.linspace(1, 0, k)
    voice[i:j] *= 1 - ramp
    return seg * ramp


def pitch_down(x, amount=0.04):
    """Lower the pitch a little by slowing playback (the phrase gets ~4% longer)."""
    return signal.resample(x, int(len(x) * (1 + amount))).astype(np.float32)


# "Are you lost?" from deep in the woods behind
lost_a, lost_b = word(6, "are") - 0.04, LINES[6]["end"] + 0.12
lost = pitch_down(lift(lost_a, lost_b), 0.05)
lost = bandpass(lost, 220, 3000) * db(-6)
echo = np.zeros(len(lost) + int(1.6 * SR))
for dt, g in [(0, 1.0), (0.13, 0.45), (0.27, 0.32), (0.44, 0.22), (0.66, 0.14), (0.95, 0.08)]:
    i = int(dt * SR)
    echo[i : i + len(lost)] += lowpass(lost, 2400 if dt else 3000) * g
lost_l, lost_r = echo * 0.75, np.concatenate([np.zeros(int(0.018 * SR)), echo])[: len(echo)]

# "Found you." whispered right into your (left) ear
found_a, found_b = word(8, "found") - 0.05, LINES[8]["end"] + 0.15
found = pitch_down(lift(found_a, found_b), 0.03)
found = highpass(found, 260)
fenv = np.convolve(np.abs(found), np.ones(SR // 60) / (SR // 60), "same")
breathy = bandpass(rng.standard_normal(len(found)), 900, 7000) * fenv / (fenv.max() + 1e-9)
found = norm(found * 0.8 + norm(breathy) * 0.35, 1.0) * db(-4)
found_l, found_r = found, np.concatenate([np.zeros(int(0.0007 * SR)), found])[: len(found)] * db(-9)

# --- beds ---------------------------------------------------------------
L = {k: LINES[k]["start"] for k in range(len(LINES))}
SILENT = word(2, "silent")  # the forest goes dead silent on this word
venv = np.convolve(np.abs(voice), np.ones(SR // 20) / (SR // 20), "same")
duck = 1 - 0.45 * np.clip(venv / (np.percentile(venv, 95) + 1e-9), 0, 1)

beds = np.zeros(N)
alive = env([(0, 0.0), (0.6, 1.0), (SILENT - 0.02, 1.0), (SILENT + 0.03, 0.0), (dur, 0.0)], N)
beds += wind(dur) * alive * db(-24)
beds += crickets(dur) * alive * env([(0, 0.4), (L[1], 0.5), (word(1, "sun"), 1.0), (dur, 1.0)], N) * db(-30)
for at in [1.2, 3.9, 6.6, 13.5, 16.8, 19.0]:
    place(beds, bird(0.35 + (at % 1) * 0.3), at, -30)

WHISPER = word(8, "whispered")
drone_env = [
    (0, 0.0), (L[1], 0.15), (SILENT, 0.0), (SILENT + 1.5, 0.25), (L[3], 0.4), (word(3, "froze"), 0.6),
    (L[4], 0.75), (L[5], 0.8), (word(5, "head"), 0.95), (L[6], 0.7), (word(6, "are") - 0.1, 0.0),
    (LINES[6]["end"] + 0.4, 0.0), (L[7], 0.8), (word(7, "gone"), 0.9), (L[8], 0.85), (WHISPER - 0.6, 1.0),
    (WHISPER + 0.3, 0.0), (dur, 0.0),
]
beds += sfx.drone(dur, base=44) * env(drone_env, N) * db(-15)
beds *= duck

# --- effects ------------------------------------------------------------
fx = np.zeros(N)
# footsteps on leaves while walking in the hook and the setup
for k, at in enumerate(np.arange(0.5, L[1] - 0.4, 0.62)):
    place(fx, leaf_step(), at + (0.05 if k % 2 else 0), -21 + (k % 2) * 2)
place(fx, click(), word(1, "flashlight"), -12)
# one wrong-sounding step on "crunch"
place(fx, lowpass(leaf_step(), 500), word(2, "crunch") + 0.05, -16)
place(fx, sfx.riser(word(3, "froze") - L[3]), L[3], -19)
place(fx, sfx.hit(3.0, 60, 32), word(3, "froze") - 0.02, -6)
place(fx, sfx.hit(3.5, 52, 30), L[4] + 0.4, -10)
# the neck bends: small cracks while the head tilts
tilt_a, tilt_b = word(5, "head"), word(5, "shoulder")
for i, at in enumerate(np.linspace(tilt_a + 0.3, tilt_b, 7)):
    place(fx, bone_crack(), at + (i % 2) * 0.07, -15 + (i % 3))
place(fx, sfx.hit(2.5, 70, 38), tilt_b + 0.15, -9)
# spin round, heart pounding, whip back
place(fx, whoosh(0.45), word(7, "spun") - 0.15, -10)
place(fx, heartbeat(list(np.arange(word(7, "heart"), word(7, "whipped") - 0.2, 0.62)), 8.0), word(7, "heart"), -8)
place(fx, whoosh(0.35), word(7, "whipped") - 0.1, -9)
place(fx, sfx.hit(3.0, 66, 34), word(7, "gone") - 0.02, -8)
# warm breath on your neck
place(fx, sfx.riser(WHISPER - L[8]) * 0.6, L[8], -22)
breath = fade(norm(bandpass(rng.standard_normal(int(1.1 * SR)), 400, 3500) * np.sin(np.pi * t_axis(1.1) / 1.1) ** 1.5), 0.05, 0.1)
place(fx, breath, word(8, "breath") - 0.3, -16)

# --- master -------------------------------------------------------------
delay = int(0.012 * SR)
right_beds = np.concatenate([np.zeros(delay), beds[:-delay]])
left = voice + beds + fx
right = voice + right_beds + fx
for track_l, track_r, at in [(lost_l, lost_r, lost_a), (found_l, found_r, found_a)]:
    i = int(at * SR)
    n = min(len(track_l), N - i)
    left[i : i + n] += track_l[:n]
    right[i : i + n] += track_r[:n]
# the hard cut: everything stops dead, one sharp hit rings out over black
stop = np.ones(N)
c = int(CUT * SR)
stop[c:] = 0
stop[c - int(0.01 * SR) : c] = np.linspace(1, 0, int(0.01 * SR))
hit_only = np.zeros(N)
place(hit_only, sfx.hit(2.4, 90, 40), CUT - 0.01, -3)
left = left * stop + hit_only * (1 - stop)
right = right * stop + hit_only * (1 - stop)
stereo = np.stack([left, right], axis=1)

active = np.abs(voice) > db(-40)
stereo *= db(-14) / np.sqrt(np.mean(stereo[active] ** 2))
ceiling = db(-1)
stereo = np.tanh(stereo / ceiling) * ceiling

out = ROOT / "public" / "foundyou" / "soundtrack.wav"
out.parent.mkdir(parents=True, exist_ok=True)
sf.write(out, stereo.astype(np.float32), SR, subtype="PCM_16")
print(f"wrote {out.relative_to(ROOT)}  {dur:.2f}s  cut at {CUT:.2f}s  peak {20*np.log10(np.max(np.abs(stereo))):.1f} dBFS")
