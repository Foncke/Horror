"""Small synthesizer for horror sound design (numpy/scipy only).

Every function returns a mono float32 array at SR. Use `place()` to drop a
sound into a longer track at a time in seconds.
"""
import numpy as np
from scipy import signal

SR = 48000
rng = np.random.default_rng(414)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def db(x):
    return 10 ** (x / 20)


def lowpass(x, hz, order=4):
    return signal.sosfilt(signal.butter(order, hz, "low", fs=SR, output="sos"), x)


def highpass(x, hz, order=4):
    return signal.sosfilt(signal.butter(order, hz, "high", fs=SR, output="sos"), x)


def bandpass(x, lo, hi, order=4):
    return signal.sosfilt(signal.butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) or 1.0
    return (x / m * peak).astype(np.float32)


def fade(x, fin=0.01, fout=0.01):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def place(track, sound, at, gain_db=0.0):
    i = int(at * SR)
    if i >= len(track):
        return
    n = min(len(sound), len(track) - i)
    track[i : i + n] += sound[:n] * db(gain_db)


def brown(dur):
    w = rng.standard_normal(int(dur * SR))
    b = np.cumsum(w)
    b = highpass(b, 15, 2)
    return norm(b)


def room_tone(dur):
    """Low air-conditioning rumble plus a faint electrical hum."""
    t = t_axis(dur)
    air = lowpass(brown(dur), 220)
    hum = 0.25 * np.sin(2 * np.pi * 50 * t) + 0.12 * np.sin(2 * np.pi * 100 * t) + 0.05 * np.sin(2 * np.pi * 150 * t)
    wobble = 1 + 0.15 * np.sin(2 * np.pi * 0.11 * t)
    return norm(air * wobble + 0.35 * hum)


def rain(dur):
    """Steady rain on glass: filtered noise bed plus random droplets."""
    bed = bandpass(rng.standard_normal(int(dur * SR)), 400, 6000)
    bed *= 1 + 0.3 * lowpass(rng.standard_normal(int(dur * SR)), 2)
    drops = np.zeros(int(dur * SR))
    for _ in range(int(dur * 60)):
        i = rng.integers(0, len(drops) - 2000)
        n = rng.integers(200, 1200)
        drops[i : i + n] += rng.standard_normal(n) * np.exp(-np.arange(n) / (n / 5)) * rng.uniform(0.2, 1)
    drops = highpass(drops, 1500)
    return norm(norm(bed) * 0.6 + norm(drops) * 0.5)


def drone(dur, base=55.0, swell=None):
    """Dark detuned pad. `swell` is an optional envelope array (0..1) over dur."""
    t = t_axis(dur)
    x = np.zeros_like(t)
    for f, a in [(base, 1.0), (base * 1.003, 0.8), (base * 1.5, 0.35), (base * 2.01, 0.25), (base * 0.5, 0.6)]:
        x += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28))
    x *= 1 + 0.2 * np.sin(2 * np.pi * 0.07 * t)
    x = lowpass(x, 400)
    if swell is not None:
        x *= np.interp(np.linspace(0, 1, len(x)), np.linspace(0, 1, len(swell)), swell)
    return norm(x)


def knock(variant=0):
    """A knuckle on a heavy wooden door: low body thump plus a short woody click."""
    dur = 0.35
    t = t_axis(dur)
    f = 95 + variant * 7
    body = np.sin(2 * np.pi * f * t * (1 - 0.25 * t)) * np.exp(-t * 28)
    wood = bandpass(rng.standard_normal(len(t)), 250, 1400) * np.exp(-t * 70)
    click = highpass(rng.standard_normal(len(t)), 2500) * np.exp(-t * 400) * 0.3
    x = body * 1.0 + norm(wood) * 0.7 + click
    return fade(norm(lowpass(x, 3500)), 0.001, 0.05)


def far(x, amount=0.7):
    """Make a sound feel further away: darker, quieter, with a short room echo."""
    y = lowpass(x, 900)
    out = np.zeros(len(y) + int(0.4 * SR))
    for d, g in [(0, 1.0), (0.045, 0.35), (0.11, 0.22), (0.19, 0.12)]:
        i = int(d * SR)
        out[i : i + len(y)] += y * g
    return norm(out, 1 - amount * 0.6)


def key_slide():
    dur = 0.7
    t = t_axis(dur)
    scrape = bandpass(rng.standard_normal(len(t)), 1800, 7000) * np.sin(np.pi * t / dur) ** 2
    jingle = sum(np.sin(2 * np.pi * f * t) * np.exp(-((t - 0.62) * 25) ** 2) for f in (3100, 4270, 5900))
    return fade(norm(scrape * 0.7 + 0.25 * jingle), 0.01, 0.05)


def creak(dur=1.4):
    """Slow door hinge creak: a stick-slip sawtooth through resonant bands."""
    t = t_axis(dur)
    pitch = 180 + 90 * np.sin(np.pi * t / dur) + 25 * lowpass(rng.standard_normal(len(t)), 8) * 40
    phase = 2 * np.pi * np.cumsum(pitch) / SR
    saw = signal.sawtooth(phase) * (0.6 + 0.4 * np.sin(phase * 0.5))
    x = bandpass(saw, 500, 1800) + 0.5 * bandpass(saw, 2200, 3600)
    env = np.sin(np.pi * t / dur) ** 0.6
    return fade(norm(x * env), 0.05, 0.2)


def hit(dur=3.0, f0=62, f1=32):
    """Deep cinematic impact with a long tail."""
    t = t_axis(dur)
    f = f1 + (f0 - f1) * np.exp(-t * 3)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    crack = lowpass(rng.standard_normal(len(t)), 1200) * np.exp(-t * 18)
    return fade(norm(sub + 0.35 * norm(crack)), 0.002, 0.3)


def riser(dur=4.0):
    t = t_axis(dur)
    tone = sum(np.sin(2 * np.pi * (f + f * 0.6 * (t / dur) ** 2) * t) for f in (220, 223, 331))
    air = bandpass(rng.standard_normal(len(t)), 2000, 9000) * (t / dur) ** 2
    env = (t / dur) ** 2.2
    return fade(norm((norm(tone) * 0.5 + norm(air) * 0.4) * env), 0.3, 0.02)


def flicker_buzz(dur=1.2):
    t = t_axis(dur)
    gate = (rng.random(int(dur * 30)) > 0.45).astype(float)
    gate = np.repeat(gate, SR // 30)[: len(t)]
    gate = np.pad(gate, (0, len(t) - len(gate)))
    buzz = signal.sawtooth(2 * np.pi * 100 * t) * 0.6 + bandpass(rng.standard_normal(len(t)), 3000, 8000) * 0.3
    return fade(norm(buzz * gate), 0.01, 0.1)


def footsteps(times, dur):
    out = np.zeros(int(dur * SR))
    for k, at in enumerate(times):
        t = t_axis(0.25)
        step = lowpass(rng.standard_normal(len(t)), 500) * np.exp(-t * 30) + 0.4 * np.sin(2 * np.pi * 70 * t) * np.exp(-t * 40)
        place(out, norm(step) * (0.8 + 0.2 * (k % 2)), at)
    return out
