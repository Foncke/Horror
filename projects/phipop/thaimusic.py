"""Scary Thai-style score for Phi Pop, synthesised (numpy/scipy only).

Instruments, all in Thai 7-tone equal tuning (each step 1/7 octave, which sounds strange to Western ears):
  khaen  - the bamboo mouth organ of Isan: a breathing, reedy drone chord
  ranat  - wooden xylophone: dry mallet notes
  khim   - hammered dulcimer: shimmering, beating metal strings
  ching  - small hand cymbals: the open "ching" and the damped "chap" that keep time
  klong  - a deep drum
"""
import numpy as np

from sfx import SR, bandpass, fade, lowpass, norm, place, rng, t_axis


def tet7(step, base=220.0):
    return base * 2 ** (step / 7)


# Thai pentatonic subset of the 7-tone scale (degrees 1 2 3 5 6)
SCALE = [0, 1, 2, 4, 5]


def deg(i, base):
    """Scale degree i (may run past the octave) to a frequency."""
    octave, k = divmod(i, len(SCALE))
    return tet7(SCALE[k] + 7 * octave, base)


def ranat(f, dur=1.4):
    t = t_axis(dur)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 4.5)
    x += 0.35 * np.sin(2 * np.pi * 3.93 * f * t) * np.exp(-t * 10)
    x += 0.12 * np.sin(2 * np.pi * 10.2 * f * t) * np.exp(-t * 22)
    x += 0.25 * bandpass(rng.standard_normal(len(t)), 1500, 6000) * np.exp(-t * 120)
    return fade(norm(x), 0.001, 0.1)


def khim(f, dur=2.6, detune=0.004):
    t = t_axis(dur)
    x = np.zeros(len(t))
    for k in range(1, 7):
        a = 1.0 / k
        for d in (1 - detune, 1 + detune):  # paired strings beat against each other
            x += a * np.sin(2 * np.pi * f * k * d * t) * np.exp(-t * (1.6 + 0.9 * k))
    x += 0.2 * bandpass(rng.standard_normal(len(t)), 2000, 8000) * np.exp(-t * 80)
    return fade(norm(x), 0.001, 0.2)


def khaen(freqs, dur, breath=4.2):
    """Reedy drone chord that swells and fades like breathing in and out."""
    t = t_axis(dur)
    x = np.zeros(len(t))
    for f in freqs:
        vib = 1 + 0.003 * np.sin(2 * np.pi * 4.6 * t + rng.uniform(0, 6))
        ph = 2 * np.pi * f * np.cumsum(vib) / SR
        for k in range(1, 11):
            x += (1.0 / k) * np.sin(k * ph) * (0.6 if k % 2 == 0 else 1.0)
    x = bandpass(x, 180, 3200)
    swell = 0.55 + 0.45 * np.sin(2 * np.pi * t / breath - np.pi / 2) ** 2
    return fade(norm(x * swell), 0.8, 1.2)


def ching(open_=True):
    dur = 1.6 if open_ else 0.25
    t = t_axis(dur)
    decay = 2.2 if open_ else 30
    x = sum(a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) for f, a in [(2840, 1.0), (4170, 0.7), (5310, 0.5), (7250, 0.3)])
    x = x * np.exp(-t * decay) + 0.4 * bandpass(rng.standard_normal(len(t)), 4000, 10000) * np.exp(-t * 150)
    return fade(norm(x), 0.0005, 0.05)


def klong():
    t = t_axis(1.2)
    f = 55 + 40 * np.exp(-t * 18)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.5) + 0.3 * lowpass(rng.standard_normal(len(t)), 300) * np.exp(-t * 25)
    return fade(norm(x), 0.001, 0.2)


def echo(x, taps=((0.37, 0.45), (0.74, 0.25), (1.11, 0.13))):
    out = np.concatenate([x, np.zeros(int(1.3 * SR))])
    for d, g in taps:
        i = int(d * SR)
        out[i : i + len(x)] += lowpass(x, 2500) * g
    return out


def melody(track, start, end, notes, step, inst, base, gain=1.0, detune_double=False):
    """Lay a looping phrase of scale degrees (None = rest) between start and end."""
    tt = start
    i = 0
    while tt < end - 0.3:
        d = notes[i % len(notes)]
        if d is not None:
            f = deg(d, base)
            note = echo(inst(f))
            place(track, note * gain, tt)
            if detune_double:  # a second, slightly sour voice for unease
                place(track, echo(inst(f * 2 ** (14 / 1200))) * gain * 0.5, tt + 0.015)
        tt += step
        i += 1


def score(n, sections):
    """Build the whole score; `sections` holds the times (s) where the story changes mood."""
    s = sections
    music = np.zeros(n)
    dur = n / SR

    # --- night, opening: khaen drone, slow falling ranat, ching on the phrase ---
    a, b = 0.6, s["day_a"]
    drone = khaen([deg(0, 110), deg(2, 110), deg(5, 110)], b - a + 1.0)
    place(music, drone * np.interp(np.arange(len(drone)) / SR, [0, b - a - 0.5, b - a + 1], [1, 1, 0]), a, -2)
    melody(music, 1.2, b - 0.8, [7, None, 5, 4, None, 2, 4, None, 2, 1, 0, None, None], 0.85, ranat, 220, 0.7, detune_double=True)
    for tt in np.arange(1.2, b - 1.0, 0.85 * 13 / 2):
        place(music, ching(True), tt, -4)
    for tt in np.arange(1.2, b - 1.0, 0.85 * 13):
        place(music, klong(), tt, -2)
    # the title lands on a drum and an open ching
    place(music, klong(), s["title"], 0)
    place(music, ching(True), s["title"] + 0.02, -1)

    # --- day: a lighter khim tune, still in the strange tuning ---
    a, b = s["day_a"], s["day_b"]
    melody(music, a + 0.3, b - 0.4, [0, 2, 4, 5, 4, 2, 1, 2, 4, None, 2, None], 0.55, khim, 330, 0.55)
    for tt in np.arange(a + 0.3, b - 0.5, 0.55 * 2):
        place(music, ching(False), tt, -10)

    # --- night again: lower, slower, sour; thinning to only the drone under the chewing ---
    a, b = s["day_b"], s["cut"]
    drone = khaen([deg(0, 82.5), deg(1, 82.5), deg(4, 82.5)], b - a + 0.5, breath=5.5)
    env_t = [0, 1.5, b - a - 0.05, b - a, b - a + 0.5]
    place(music, drone * np.interp(np.arange(len(drone)) / SR, env_t, [0, 1, 1, 0, 0]), a, 0)
    melody(music, a + 1.0, s["tonight"] - 0.5, [5, None, 4, None, 2, 1, None, 0, None, None, -1, None, None, None], 1.1, ranat, 165, 0.8, detune_double=True)
    melody(music, s["signs"], s["tonight"] - 0.5, [7, None, None, 5, None, None, 4, None, None, None], 1.1, khim, 330, 0.35)
    for tt in np.arange(a + 1.0, s["tonight"] - 1.0, 1.1 * 7):
        place(music, ching(True), tt, -5)
        place(music, klong(), tt, -3)
    # everything stops dead at the cut
    music[int(b * SR):] = 0
    return music
