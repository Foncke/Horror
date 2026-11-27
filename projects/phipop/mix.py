"""Phi Pop soundtrack: voiceover + night ambience, a breathy flute, drones and effects, timed from timings.json.

Usage: python projects/phipop/mix.py   ->  public/phipop/soundtrack.wav
The voice is used exactly as delivered.
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
from sfx import SR, bandpass, db, fade, highpass, lowpass, norm, place, rng, t_axis  # noqa: E402

T = json.loads((HERE / "timings.json").read_text(encoding="utf-8"))
LINES, WORDS = T["lines"], T["words"]


def word(li, text, nth=0):
    hits = [w for w in WORDS if w["line"] == li and w["text"].lower().strip('"“”.,!?…—').startswith(text)]
    return hits[nth]["start"]


def env(points, n):
    ts, vs = zip(*points)
    return np.interp(np.arange(n) / SR, ts, vs)


# --- sounds ---------------------------------------------------------------------
def crickets(dur):
    t = t_axis(dur)
    out = np.zeros(len(t))
    for f, rate, ph in [(4200, 15.0, 0.0), (4700, 12.0, 1.3), (3900, 17.5, 2.2), (5200, 9.0, 0.7)]:
        pulse = (np.sin(2 * np.pi * rate * t + ph) > 0.55).astype(float)
        group = (np.sin(2 * np.pi * 0.4 * t + ph * 2) > -0.3).astype(float)
        out += np.sin(2 * np.pi * f * t) * lowpass(pulse * group, 300)
    return norm(out)


def bird(dur=0.45):
    t = t_axis(dur)
    f = 2800 + 1200 * np.sin(np.pi * t / dur * 2) ** 2
    return fade(norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / dur) ** 2), 0.01, 0.05)


def flute(notes, step=0.9, dur_note=1.1):
    """Breathy bamboo-flute line (pentatonic), each note with vibrato and air."""
    out = np.zeros(int((len(notes) * step + dur_note + 0.5) * SR))
    for i, f in enumerate(notes):
        if f is None:
            continue
        t = t_axis(dur_note)
        vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t * 2, 0, 1)
        tone = np.sin(2 * np.pi * f * np.cumsum(vib) / SR) + 0.25 * np.sin(2 * np.pi * 2 * f * np.cumsum(vib) / SR)
        air = bandpass(rng.standard_normal(len(t)), f * 0.9, f * 3) * 0.25
        e = np.clip(t / 0.12, 0, 1) * np.exp(-np.maximum(t - 0.6, 0) * 3)
        place(out, fade((tone + air) * e, 0.02, 0.1), i * step)
    return norm(out)


def whoosh(dur=0.6):
    t = t_axis(dur)
    return fade(norm(bandpass(rng.standard_normal(len(t)), 300, 6000) * np.sin(np.pi * t / dur) ** 2), 0.01, 0.05)


def slither(dur=2.0):
    t = t_axis(dur)
    x = bandpass(rng.standard_normal(len(t)), 200, 1800) * (0.5 + 0.5 * np.sin(2 * np.pi * 3.3 * t) ** 2)
    return fade(norm(lowpass(x, 1500) * np.sin(np.pi * t / dur)), 0.1, 0.2)


def plink():
    t = t_axis(0.5)
    f = 1400 + 900 * np.exp(-t * 30)
    return fade(norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 12)), 0.001, 0.05)


def tick():
    t = t_axis(0.04)
    return fade(norm(highpass(rng.standard_normal(len(t)), 2500) * np.exp(-t * 200)), 0.0005, 0.01)


def creak_step():
    return norm(lowpass(sfx.creak(0.35), 900) * 0.7 + lowpass(sfx.knock(1), 200) * 0.5)


def chew(n_bites, dur):
    """Wet, slow chewing: soft squelches on a jaw rhythm."""
    out = np.zeros(int(dur * SR))
    for k in range(n_bites):
        at = k * 0.42 + rng.uniform(-0.03, 0.03)
        t = t_axis(0.22)
        sq = bandpass(rng.standard_normal(len(t)), 500, 3500) * np.exp(-t * 18) * (rng.random(len(t)) > 0.4)
        thud = lowpass(rng.standard_normal(len(t)), 220) * np.exp(-t * 30)
        place(out, norm(sq * 0.8 + thud * 0.6) * (0.7 + 0.3 * (k % 2)), at)
    return out


def tear():
    t = t_axis(0.5)
    x = bandpass(rng.standard_normal(len(t)), 600, 4000) * (rng.random(len(t)) > 0.6) * np.exp(-t * 5)
    return fade(norm(x), 0.005, 0.05)


# --- voice ----------------------------------------------------------------------
with tempfile.TemporaryDirectory() as d:
    subprocess.run([ffmpeg(), "-v", "error", "-y", "-i", str(HERE / "voice.mp3"), "-ac", "1", "-ar", str(SR), f"{d}/v.wav"], check=True)
    voice, _ = sf.read(f"{d}/v.wav", dtype="float32")
voice = voice / np.max(np.abs(voice)) * db(-3)

CUT = WORDS[-1]["end"] + 0.06  # hard cut to black after "light."
N = max(int((CUT + 2.4) * SR), len(voice))
dur = N / SR
voice = np.pad(voice, (0, N - len(voice)))

L = {k: LINES[k]["start"] for k in range(len(LINES))}
DAY_A, DAY_B = L[4] - 0.1, L[5] - 0.1  # "By day..." up to "Until the house goes quiet"
venv = np.convolve(np.abs(voice), np.ones(SR // 20) / (SR // 20), "same")
duck = 1 - 0.5 * np.clip(venv / (np.percentile(venv, 95) + 1e-9), 0, 1)

beds = np.zeros(N)
night = env([(0, 0.0), (0.8, 1.0), (DAY_A - 0.2, 1.0), (DAY_A + 0.2, 0.0), (DAY_B, 0.0), (DAY_B + 1.0, 0.7), (CUT, 0.5), (dur, 0.5)], N)
beds += crickets(dur) * night * db(-31)
beds += lowpass(sfx.brown(dur), 400) * night * db(-30)
day = env([(0, 0), (DAY_A, 0), (DAY_A + 0.4, 1), (DAY_B - 0.3, 1), (DAY_B, 0), (dur, 0)], N)
for at in np.arange(DAY_A + 0.3, DAY_B - 0.5, 1.3):
    place(beds, bird(0.3 + rng.uniform(0, 0.3)), at, -26)
beds += lowpass(sfx.brown(dur), 1200) * day * db(-36)

drone_env = [
    (0, 0.2), (L[2], 0.35), (L[3], 0.6), (word(3, "backfires"), 0.9), (L[4] - 0.3, 0.6), (DAY_A + 0.3, 0.05),
    (DAY_B, 0.05), (L[5] + 0.5, 0.6), (L[6], 0.85), (word(6, "and", 1), 1.0), (L[7], 0.8), (L[8], 0.6),
    (L[10], 0.9), (CUT, 1.0), (CUT + 0.01, 0.0), (dur, 0.0),
]
beds += sfx.drone(dur, base=46) * env(drone_env, N) * db(-15)
# a breathy flute: over the opening, the title, and (gently) by day
penta = [392.0, 440.0, 523.3, 587.3, 659.3, 784.0]
line1 = flute([None if i is None else penta[i] for i in [2, 1, 0, None, 1, 2, 4, 3]], step=0.85)
place(beds, line1 * env([(0, 0.0), (0.4, 1.0), (7.0, 1.0), (7.5, 0.0)], len(line1)), 1.0, -27)
line2 = flute([None if i is None else penta[i] for i in [4, 3, 2, 1, 2, None, 0, 1]], step=0.9)
place(beds, line2, L[2] + 0.3, -26)
line3 = flute([None if i is None else penta[i] for i in [2, 3, 4, 3, 2, 1]], step=1.0)
place(beds, line3, DAY_A + 0.4, -31)
beds *= duck

# --- effects --------------------------------------------------------------------
fx = np.zeros(N)
place(fx, sfx.hit(3.5, 58, 32), word(2, "phi") - 0.05, -8)
place(fx, whoosh(0.8), word(3, "backfires") - 0.4, -12)
place(fx, sfx.hit(3.0, 66, 34), word(3, "backfires") + 0.1, -7)
place(fx, slither(2.4), word(3, "crawls") - 0.3, -16)
place(fx, sfx.riser(1.6), word(6, "wakes") - 1.6, -18)
place(fx, sfx.hit(2.8, 72, 36), word(6, "wakes") - 0.02, -6)
for k, at in enumerate(np.arange(word(6, "creep") - 0.4, word(6, "creep") + 3.5, 0.9)):
    place(fx, lowpass(sfx.knock(k % 3), 300), at, -20)  # slow bare footsteps
place(fx, lowpass(sfx.drone(1.5, base=110), 600) * 0.5, word(6, "hunt") - 0.2, -28)  # fridge hum
# heartbeat while she is trapped inside her own mind
for at in np.arange(word(6, "and", 1), word(6, "flesh") + 1.0, 0.75):
    for dt, g in [(0, 1.0), (0.26, 0.7)]:
        place(fx, lowpass(sfx.knock(1), 140) * g, at + dt, -9)
for at in [word(6, "tear"), word(6, "tear") + 0.55, word(6, "flesh")]:
    place(fx, tear(), at, -20)
place(fx, slither(3.0), word(7, "hollowing") - 0.5, -20)
place(fx, plink(), word(7, "drop") + 0.25, -9)
place(fx, sfx.hit(2.5, 60, 32), word(7, "drop") + 0.27, -14)
for at in np.arange(word(9, "and") - 0.1, word(9, "three") - 0.2, 0.5):
    place(fx, tick(), at, -22)
place(fx, sfx.hit(2.8, 70, 34), word(9, "three") - 0.02, -8)
for k, at in enumerate(np.arange(L[10] - 0.1, word(10, "don"), 0.8)):
    place(fx, creak_step(), at, -21)
chew_start = word(10, "chewing") - 0.2
place(fx, chew(int((CUT - chew_start) / 0.42) + 1, CUT - chew_start + 0.5), chew_start, -12)

# --- master ---------------------------------------------------------------------
delay = int(0.012 * SR)
right_beds = np.concatenate([np.zeros(delay), beds[:-delay]])
left = voice + beds + fx
right = voice + right_beds + fx
# the hard cut: everything stops dead, one low hit rings out over black
stop = np.ones(N)
c = int(CUT * SR)
stop[c:] = 0
stop[c - int(0.01 * SR) : c] = np.linspace(1, 0, int(0.01 * SR))
hit_only = np.zeros(N)
place(hit_only, sfx.hit(2.2, 80, 38), CUT - 0.01, -4)
left = left * stop + hit_only * (1 - stop)
right = right * stop + hit_only * (1 - stop)
stereo = np.stack([left, right], axis=1)

active = np.abs(voice) > db(-40)
stereo *= db(-14) / np.sqrt(np.mean(stereo[active] ** 2))
ceiling = db(-1)
stereo = np.tanh(stereo / ceiling) * ceiling

out = ROOT / "public" / "phipop" / "soundtrack.wav"
out.parent.mkdir(parents=True, exist_ok=True)
sf.write(out, stereo.astype(np.float32), SR, subtype="PCM_16")
print(f"wrote {out.relative_to(ROOT)}  {dur:.2f}s  cut at {CUT:.2f}s  peak {20*np.log10(np.max(np.abs(stereo))):.1f} dBFS")
