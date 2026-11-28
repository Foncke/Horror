"""17 Seconds soundtrack: voiceover + room tone, drones and effects, timed from timings.json.

Usage: python projects/seventeen/mix.py   ->  public/seventeen/soundtrack.wav
The voice is used exactly as delivered (only a level change). Dead silence under "Don't look behind you."
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


def word(li, text, nth=0, end=False):
    hits = [w for w in WORDS if w["line"] == li and w["text"].lower().strip('"“”.,!?…—:').startswith(text)]
    return hits[nth]["end" if end else "start"]


def env(points, n):
    ts, vs = zip(*points)
    return np.interp(np.arange(n) / SR, ts, vs)


def beep(freq=1760, dur=0.11):
    """Sharp digital timer beep."""
    t = t_axis(dur)
    x = np.sign(np.sin(2 * np.pi * freq * t)) * 0.4 + np.sin(2 * np.pi * freq * t)
    return fade(norm(lowpass(x, 6000)), 0.002, 0.015)


def click():
    """A lamp switch: a tight plastic snap."""
    t = t_axis(0.08)
    snap = highpass(rng.standard_normal(len(t)), 1800) * np.exp(-t * 260)
    body = np.sin(2 * np.pi * 420 * t) * np.exp(-t * 120) * 0.5
    return fade(norm(snap + body), 0.0005, 0.01)


def pulse_bed(dur, period=1.25):
    """Low sub-bass pulse, like a slow heartbeat felt more than heard."""
    out = np.zeros(int(dur * SR))
    t = t_axis(0.5)
    p = np.sin(2 * np.pi * 42 * t) * np.exp(-t * 9)
    p = fade(norm(p), 0.004, 0.05)
    k = 0.0
    while k < dur - 0.6:
        place(out, p, k)
        place(out, p * 0.55, k + 0.28)
        k += period
    return out


def rasp(dur=2.2):
    """Slow raspy breathing: a long wet inhale and a rattling exhale."""
    t = t_axis(dur)
    x = bandpass(rng.standard_normal(len(t)), 250, 2600)
    rattle = 1 + 0.6 * np.sign(np.sin(2 * np.pi * 23 * t + 2 * np.sin(2 * np.pi * 3 * t)))
    shape = np.where(t < dur * 0.45, np.sin(np.pi * t / (dur * 0.9)) ** 2, np.clip(np.sin(np.pi * (t - dur * 0.45) / (dur * 1.1)), 0, None) ** 1.5 * rattle * 0.8)
    return fade(norm(x * shape), 0.05, 0.2)


def high_drone(dur):
    """Thin rising high tension tone."""
    t = t_axis(dur)
    f = 1900 + 500 * (t / dur) ** 2
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.6 * np.sin(2 * np.pi * np.cumsum(f * 1.007) / SR)
    return fade(norm(x) * (t / dur) ** 1.5, 0.5, 0.05)


def whoosh(dur=0.45):
    """A fast turn: noise swept up and down."""
    t = t_axis(dur)
    x = rng.standard_normal(len(t))
    sos = signal.butter(2, [600, 3200], btype="band", fs=SR, output="sos")
    y = signal.sosfilt(sos, x) * np.sin(np.pi * t / dur) ** 2
    return fade(norm(y), 0.01, 0.05)


def static(dur=0.35):
    """Digital static burst for the phone cutting in."""
    t = t_axis(dur)
    gate = np.repeat((rng.random(int(dur * 60) + 1) > 0.3).astype(float), SR // 60 + 1)[: len(t)]
    x = highpass(rng.standard_normal(len(t)), 900) * gate + 0.3 * signal.square(2 * np.pi * 60 * t)
    return fade(norm(x) * np.exp(-t * 3), 0.002, 0.05)


def hum(dur):
    """The phone camera's electrical whine."""
    t = t_axis(dur)
    x = np.sin(2 * np.pi * 120 * t) * 0.4 + np.sin(2 * np.pi * 7800 * t) * 0.04 + lowpass(rng.standard_normal(len(t)), 300) * 0.2
    return fade(norm(x), 0.05, 0.05)


def tap():
    """A single soft fingertip tap close by."""
    t = t_axis(0.25)
    x = np.sin(2 * np.pi * 180 * t) * np.exp(-t * 55) + bandpass(rng.standard_normal(len(t)), 800, 3500) * np.exp(-t * 140) * 0.4
    return fade(norm(x), 0.001, 0.05)


voice_path = HERE / "voice.mp3"
with tempfile.TemporaryDirectory() as d:
    subprocess.run([ffmpeg(), "-v", "error", "-y", "-i", str(voice_path), "-ac", "1", "-ar", str(SR), f"{d}/v.wav"], check=True)
    voice, _ = sf.read(f"{d}/v.wav", dtype="float32")
total = 69.88  # matches cue.end in src/videos/seventeen/cues.ts
N = max(int(total * SR), len(voice))  # never cut the voice
voice = voice / np.max(np.abs(voice)) * db(-3)
voice = np.pad(voice, (0, N - len(voice)))
dur = N / SR

venv = np.convolve(np.abs(voice), np.ones(SR // 20) / (SR // 20), "same")
duck = 1 - 0.4 * np.clip(venv / (np.percentile(venv, 95) + 1e-9), 0, 1)

L = {k: LINES[k]["start"] for k in range(len(LINES))}
dont = word(9, "don")
lamp_off = word(3, "lamp", end=True) - 0.12
black = word(5, "black")
something = word(6, "something")
teeth = word(6, "teeth")
spun = word(7, "spun")
room = word(7, "the")
showing = word(8, "showing")
flickered = word(8, "flickered")
up = word(9, "your")

bedL = np.zeros(N)
bedR = np.zeros(N)
fxL = np.zeros(N)
fxR = np.zeros(N)


def fx(sound, at, gain, pan=0.0):
    """Place a sound, panned -1 (left) .. 1 (right)."""
    gl = np.sqrt((1 - pan) / 2) * np.sqrt(2)
    gr = np.sqrt((1 + pan) / 2) * np.sqrt(2)
    place(fxL, sound * gl, at, gain)
    place(fxR, sound * gr, at, gain)


# --- beds ---------------------------------------------------------------------
roomtone = sfx.room_tone(dur)
room_env = env([(0, 0.7), (dont - 0.05, 0.7), (dont + 0.05, 0.0), (dur, 0.0)], N)
bedL += roomtone * room_env * db(-31)
bedR += np.roll(roomtone, int(0.013 * SR)) * room_env * db(-31)

pulse = pulse_bed(dur)
pulse_env = env([(0, 1.0), (L[1], 1.0), (L[2], 0.0), (L[9], 0.0), (L[9] + 0.4, 0.8), (dont - 0.05, 0.8), (dont + 0.02, 0.0), (dur, 0.0)], N)
bedL += pulse * pulse_env * db(-17)
bedR += pulse * pulse_env * db(-17)

drone = sfx.drone(dur, base=46)
drone_env = env([
    (0, 0.35), (L[2], 0.3), (lamp_off, 0.35), (lamp_off + 0.5, 0.6), (L[5], 0.7), (black - 0.05, 0.85), (black + 0.4, 0.5),
    (L[6], 0.8), (teeth, 1.0), (spun + 0.3, 0.9), (room - 0.1, 0.0), (L[8] + 0.6, 0.0), (showing, 0.75), (L[9], 0.6),
    (dont - 0.05, 0.7), (dont + 0.02, 0.0), (dur, 0.0),
], N)
bedL += drone * drone_env * db(-22)
bedR += np.roll(drone, int(0.011 * SR)) * drone_env * db(-22)

beds = np.stack([bedL, bedR], axis=1) * duck[:, None]

# --- effects ------------------------------------------------------------------
fx(beep(), word(0, "timer") + 0.05, -20)
fx(beep(2093, 0.16), word(0, "now") + 0.05, -16)
# knock on wood, from the door behind and to the left
fx(sfx.knock(0), word(1, "knock") + 0.04, -9, -0.45)
fx(sfx.knock(1), word(1, "knock") + 0.33, -10, -0.35)
fx(sfx.far(sfx.knock(2), 0.4), word(1, "near") + 0.1, -16, 0.3)
# the lamp switch, then the room tone of a dark room
fx(click(), lamp_off - 0.01, -12, -0.3)
# the doorway in the reflection fills with black
fx(sfx.riser(black - word(5, "doorway")), word(5, "doorway"), -22)
fx(sfx.hit(3.0, 58, 30), black - 0.02, -8)
# something leans in: raspy breathing, close on the left, and a thin rising tone
for k, at in enumerate([something + 0.2, something + 2.5, something + 4.7]):
    fx(rasp(2.1 + 0.2 * k), at, -21 + k * 2, -0.6)
fx(high_drone(teeth - something), something, -30)
fx(sfx.hit(3.2, 64, 32), teeth - 0.02, -6)
# the spin, then nothing
fx(whoosh(), spun - 0.02, -13)
fx(sfx.hit(1.6, 70, 40), spun + 0.25, -15)
# the phone flickers on, the camera cuts in
for k in range(3):
    fx(sfx.flicker_buzz(0.12), flickered + k * 0.17, -30, 0.25)
fx(static(), showing - 0.1, -15)
fx(sfx.hit(2.6, 60, 30), showing - 0.1, -7)
fx(hum(L[9] - showing), showing, -34)
# "Your seventeen seconds are up." a final timer beep; then dead silence and one soft tap
fx(beep(1568, 0.22), up + 0.55, -18)
fx(tap(), LINES[9]["end"] + 0.03, -20, -0.5)

fxs = np.stack([fxL, fxR], axis=1)

# --- master -------------------------------------------------------------------
stereo = voice[:, None] + beds + fxs
active = np.abs(voice) > db(-40)
stereo *= db(-14) / np.sqrt(np.mean(stereo[active] ** 2))
ceiling = db(-1)
stereo = np.tanh(stereo / ceiling) * ceiling

out = ROOT / "public" / "seventeen" / "soundtrack.wav"
out.parent.mkdir(parents=True, exist_ok=True)
sf.write(out, stereo.astype(np.float32), SR, subtype="PCM_16")
print(f"wrote {out.relative_to(ROOT)}  {dur:.2f}s  peak {20*np.log10(np.max(np.abs(stereo))):.1f} dBFS")
