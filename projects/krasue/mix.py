"""Krasue soundtrack: voiceover + night ambience, the Thai-style score, and the owner's sound effects.

Usage: python projects/krasue/mix.py   ->  public/krasue/soundtrack.wav
The voice is used exactly as delivered. Everything but the voice goes dead silent on "don't open the
curtains"; a soft tap on the glass follows the last word, and the picture cuts to black on it.
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
sys.path.insert(0, str(ROOT / "projects" / "phipop"))
import sfx  # noqa: E402
import thaimusic  # noqa: E402
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


# --- sound effects -----------------------------------------------------------------
def crickets(dur):
    t = t_axis(dur)
    out = np.zeros(len(t))
    for f, rate, ph in [(4200, 15.0, 0.0), (4700, 12.0, 1.3), (3900, 17.5, 2.2), (5200, 9.0, 0.7)]:
        pulse = (np.sin(2 * np.pi * rate * t + ph) > 0.55).astype(float)
        group = (np.sin(2 * np.pi * 0.4 * t + ph * 2) > -0.3).astype(float)
        out += np.sin(2 * np.pi * f * t) * lowpass(pulse * group, 300)
    return norm(out)


def heartbeat(times, dur):
    out = np.zeros(int(dur * SR))
    for at in times:
        for dt, g in [(0, 1.0), (0.26, 0.7)]:
            place(out, lowpass(sfx.knock(1), 140) * g, at + dt)
    return out


def wet_tear(dur=0.9):
    t = t_axis(dur)
    crackle = bandpass(rng.standard_normal(len(t)), 500, 4000) * (rng.random(len(t)) > 0.55)
    squelch = lowpass(rng.standard_normal(len(t)), 600) * (0.5 + 0.5 * np.sin(2 * np.pi * 7 * t) ** 2)
    return fade(norm((norm(crackle) * 0.7 + norm(squelch) * 0.6) * np.sin(np.pi * t / dur) ** 0.5), 0.01, 0.15)


def wind_whistle(dur=4.5):
    t = t_axis(dur)
    f = 900 + 500 * np.sin(np.pi * t / dur) + 80 * np.sin(2 * np.pi * 0.7 * t)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR)
    air = bandpass(rng.standard_normal(len(t)), 600, 2500)
    return fade(norm((tone * 0.5 + norm(air) * 0.5) * np.sin(np.pi * t / dur) ** 1.5), 0.3, 0.6)


def raspy_breath(dur, period=2.4):
    t = t_axis(dur)
    breath = bandpass(rng.standard_normal(len(t)), 250, 2200) * (0.6 + 0.4 * (rng.random(len(t)) > 0.5))
    shape = np.maximum(0, np.sin(2 * np.pi * t / period)) ** 2
    return fade(norm(breath * shape), 0.2, 0.3)


def drip():
    t = t_axis(0.35)
    f = 1100 + 700 * np.exp(-t * 40)
    return fade(norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14)), 0.001, 0.05)


def violin_screech(dur=1.4):
    """A low bowed screech: a rough sawtooth with wide, nervous vibrato."""
    t = t_axis(dur)
    f = 196 * (1 + 0.02 * np.sin(2 * np.pi * 6.5 * t)) * (1 + 0.04 * t)
    saw = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR)
    rough = 1 + 0.4 * lowpass(rng.standard_normal(len(t)), 40)
    x = bandpass(saw * rough, 300, 4500)
    return fade(norm(x * np.minimum(1, t / 0.06) * np.exp(-np.maximum(0, t - 0.5) * 2)), 0.005, 0.2)


def glass_vibration(dur=1.6):
    t = t_axis(dur)
    x = sum(a * np.sin(2 * np.pi * f * t) for f, a in [(3150, 1.0), (4420, 0.5), (6100, 0.25)])
    trem = 0.5 + 0.5 * np.sin(2 * np.pi * 23 * t)
    return fade(norm(x * trem * np.exp(-t * 2.2)), 0.003, 0.2)


def rooster():
    """A distant cock-a-doodle-doo: four bright, gliding syllables."""
    out = np.zeros(int(1.8 * SR))
    for at, f0, f1, dur in [(0.0, 700, 900, 0.18), (0.22, 820, 1000, 0.18), (0.45, 950, 1250, 0.25), (0.75, 1150, 700, 0.7)]:
        t = t_axis(dur)
        f = np.linspace(f0, f1, len(t))
        saw = signal.sawtooth(2 * np.pi * np.cumsum(f) / SR)
        place(out, bandpass(saw, 600, 3500) * np.sin(np.pi * t / dur) ** 0.7, at)
    return norm(lowpass(out, 2200))


def glass_tap():
    t = t_axis(0.25)
    knock = highpass(rng.standard_normal(len(t)), 1500) * np.exp(-t * 160)
    ring = sum(a * np.sin(2 * np.pi * f * t) for f, a in [(2650, 1.0), (3900, 0.5)]) * np.exp(-t * 18)
    return fade(norm(knock * 0.8 + ring * 0.35), 0.0005, 0.05)


# --- voice ---------------------------------------------------------------------------
with tempfile.TemporaryDirectory() as d:
    subprocess.run([ffmpeg(), "-v", "error", "-y", "-i", str(HERE / "voice.mp3"), "-ac", "1", "-ar", str(SR), f"{d}/v.wav"], check=True)
    voice, _ = sf.read(f"{d}/v.wav", dtype="float32")
voice = voice / np.max(np.abs(voice)) * db(-3)

TAP = WORDS[-1]["end"] + 0.42  # matches cue.tap in src/videos/krasue/cues.ts
CUT = TAP + 0.08
N = max(int((CUT + 2.2) * SR), len(voice))
dur = N / SR
voice = np.pad(voice, (0, N - len(voice)))
L = {k: LINES[k]["start"] for k in range(len(LINES))}
SILENCE = word(10, "don")  # everything but the voice stops here

venv = np.convolve(np.abs(voice), np.ones(SR // 20) / (SR // 20), "same")
duck = 1 - 0.5 * np.clip(venv / (np.percentile(venv, 95) + 1e-9), 0, 1)

# --- beds ----------------------------------------------------------------------------
beds = np.zeros(N)
night = env([(0, 0), (0.6, 1), (L[1] - 0.3, 1), (L[1] + 0.5, 0.4), (L[3] - 0.2, 0.4), (L[3], 0.0), (word(3, "but"), 0.0), (word(3, "but") + 0.6, 1), (dur, 1)], N)
beds += crickets(dur) * night * db(-32)
beds += lowpass(sfx.brown(dur), 120) * env([(0, 0), (0.5, 1), (8, 1), (9, 0.5), (dur, 0.5)], N) * db(-24)  # sub rumble
beds += sfx.drone(dur, base=42) * env([(0, 0.4), (L[2], 0.7), (L[4], 0.9), (L[6], 0.8), (word(6, "turns"), 1), (L[7], 0.7), (word(7, "because"), 0.9), (L[8], 0.6), (L[10], 0.9), (dur, 0.9)], N) * db(-19)
music = thaimusic.score(N, {"day_a": L[3] - 0.1, "day_b": word(3, "but") - 0.1, "title": word(2, "krasue") - 0.05, "signs": L[8], "tonight": L[10], "cut": SILENCE})
beds += norm(music) * db(-22)
beds *= duck

# --- effects -------------------------------------------------------------------------
fx = np.zeros(N)
place(fx, heartbeat(list(np.arange(L[1] + 0.2, L[2] - 0.3, 0.9)), 10), 0, -14)
place(fx, sfx.hit(3.2, 60, 32), word(2, "krasue") - 0.05, -9)
place(fx, sfx.riser(2.0), word(3, "midnight") - 1.0, -20)
place(fx, wet_tear(1.0), word(3, "splits") - 0.05, -10)
place(fx, wet_tear(1.2), word(4, "detaches") - 0.1, -12)
place(fx, wind_whistle(5.0), word(4, "rising") - 0.3, -20)
place(fx, raspy_breath(8.5), L[5] + 0.3, -18)
for at in np.arange(word(5, "search") - 0.3, L[6] - 0.5, 0.85):
    place(fx, drip(), at + rng.uniform(-0.1, 0.1), -21)
place(fx, violin_screech(1.5), word(6, "turns") - 0.06, -14)
place(fx, glass_vibration(1.8), word(6, "turns") + 0.05, -20)
place(fx, sfx.hit(2.8, 70, 36), word(6, "severed") - 0.02, -10)
place(fx, rooster(), word(7, "because") + 0.3, -24)
place(fx, sfx.riser(5.0), word(7, "because"), -21)
# silence from "don't open the curtains" on, then the tap on the glass
quiet = np.ones(N)
s0 = int(SILENCE * SR)
quiet[s0:] = 0
quiet[s0 - int(0.05 * SR) : s0] = np.linspace(1, 0, int(0.05 * SR))
beds *= quiet
fx *= quiet
place(fx, glass_tap(), TAP, -10)

# --- master --------------------------------------------------------------------------
delay = int(0.012 * SR)
right_beds = np.concatenate([np.zeros(delay), beds[:-delay]])
stereo = np.stack([voice + beds + fx, voice + right_beds + fx], axis=1)
active = np.abs(voice) > db(-40)
stereo *= db(-14) / np.sqrt(np.mean(stereo[active] ** 2))
ceiling = db(-1)
stereo = np.tanh(stereo / ceiling) * ceiling
stereo[int(CUT * SR) + int(0.3 * SR):] *= 0  # nothing after the tap has rung out

out = ROOT / "public" / "krasue" / "soundtrack.wav"
out.parent.mkdir(parents=True, exist_ok=True)
sf.write(out, stereo.astype(np.float32), SR, subtype="PCM_16")
print(f"wrote {out.relative_to(ROOT)}  {dur:.2f}s  silence {SILENCE:.2f}s  tap {TAP:.2f}s  peak {20*np.log10(np.max(np.abs(stereo))):.1f} dBFS")
