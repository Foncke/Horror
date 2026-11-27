"""Align a voiceover with its script and write word + line timings as JSON.

Usage: python3 tools/align.py <voice audio> <script.txt> <out.json>

The script is split into lines by blank lines. Every script word gets a start
and end time taken from the speech model (sherpa-onnx zipformer), so captions
and scene cuts can follow the real voice.
"""
import difflib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import sherpa_onnx
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ffmpeg_path import ffmpeg  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "models" / "sherpa-onnx-zipformer-en-2023-06-26"
SR = 16000

NUM = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
       "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine"}


def spoken_tokens(word: str) -> list[str]:
    """How a written word is likely to come out of the speech model."""
    w = word.lower().replace("’", "'")
    if re.fullmatch(r"a\.?m\.?|p\.?m\.?", w.strip(".,!?;:")):
        return [w[0], "m"]
    w = re.sub(r"[^a-z0-9']", "", w)
    if not w:
        return []
    if w.isdigit():
        return [NUM[d] for d in w]
    return [w]


def load_audio(path: str) -> np.ndarray:
    with tempfile.TemporaryDirectory() as d:
        wav = f"{d}/a.wav"
        subprocess.run([ffmpeg(), "-v", "error", "-y", "-i", path, "-ac", "1", "-ar", str(SR), wav], check=True)
        audio, _ = sf.read(wav, dtype="float32")
    return audio


def silences(audio: np.ndarray, thresh_db=-40.0, min_dur=0.18):
    hop = SR // 100
    frames = len(audio) // hop
    rms = np.sqrt(np.mean(audio[: frames * hop].reshape(frames, hop) ** 2, axis=1) + 1e-12)
    quiet = 20 * np.log10(rms) < thresh_db
    out, start = [], None
    for i, q in enumerate(np.append(quiet, False)):
        if q and start is None:
            start = i
        elif not q and start is not None:
            if (i - start) / 100 >= min_dur:
                out.append((start / 100, i / 100))
            start = None
    return out


def recognize(audio: np.ndarray):
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=str(MODEL / "encoder-epoch-99-avg-1.int8.onnx"),
        decoder=str(MODEL / "decoder-epoch-99-avg-1.onnx"),
        joiner=str(MODEL / "joiner-epoch-99-avg-1.int8.onnx"),
        tokens=str(MODEL / "tokens.txt"),
    )
    words = []  # (text, start)
    i = 0
    while i < len(audio):
        j = min(len(audio), i + 15 * SR)
        if j < len(audio):  # cut in the quietest spot of the next 3 s
            win = audio[j : j + 3 * SR]
            j += int(np.argmin(np.convolve(win ** 2, np.ones(1600), "valid")))
        s = rec.create_stream()
        s.accept_waveform(SR, audio[i:j])
        rec.decode_stream(s)
        for tok, t in zip(s.result.tokens, s.result.timestamps):
            if tok.startswith(" ") or not words:
                words.append([tok.strip().lower(), i / SR + t])
            else:
                words[-1][0] += tok.lower()
        i = j
    return [(w, t) for w, t in words if w]


def main(audio_path, script_path, out_path):
    audio = load_audio(audio_path)
    duration = len(audio) / SR
    quiet = silences(audio)
    heard = recognize(audio)

    lines = [re.sub(r"\s+", " ", b).strip() for b in Path(script_path).read_text(encoding="utf-8").split("\n\n") if b.strip()]
    display = []  # (word, line index)
    for li, line in enumerate(lines):
        for w in line.split(" "):
            if re.search(r"[A-Za-z0-9]", w):
                display.append((w, li))

    # flatten spoken tokens of the script, remembering which display word they belong to
    flat, owner = [], []
    for di, (w, _) in enumerate(display):
        for t in spoken_tokens(w):
            flat.append(t)
            owner.append(di)

    starts = [None] * len(display)
    sm = difflib.SequenceMatcher(a=flat, b=[w for w, _ in heard], autojunk=False)
    for tag, a0, a1, b0, b1 in sm.get_opcodes():
        if tag == "equal" or (tag == "replace"):
            for k in range(a0, a1):
                bk = b0 + min(b1 - b0 - 1, int((k - a0) * (b1 - b0) / (a1 - a0)))
                di = owner[k]
                if starts[di] is None:
                    starts[di] = heard[bk][1]

    # fill words the model missed by interpolating between neighbours
    known = [i for i, s in enumerate(starts) if s is not None]
    for i in range(len(starts)):
        if starts[i] is None:
            prev = max([k for k in known if k < i], default=None)
            nxt = min([k for k in known if k > i], default=None)
            if prev is None:
                starts[i] = max(0.0, starts[nxt] - 0.25 * (nxt - i))
            elif nxt is None:
                starts[i] = starts[prev] + 0.25 * (i - prev)
            else:
                starts[i] = starts[prev] + (starts[nxt] - starts[prev]) * (i - prev) / (nxt - prev)
    for i in range(1, len(starts)):  # keep order
        starts[i] = max(starts[i], starts[i - 1] + 0.04)

    words = []
    for i, ((w, li), s) in enumerate(zip(display, starts)):
        nxt = starts[i + 1] if i + 1 < len(starts) else duration
        end = nxt
        for qs, qe in quiet:  # stop at the first pause after the word starts
            if qs > s + 0.08:
                end = min(end, qs)
                break
        words.append({"text": w, "line": li, "start": round(s, 3), "end": round(max(end, s + 0.12), 3)})

    out_lines = []
    for li, text in enumerate(lines):
        ws = [w for w in words if w["line"] == li]
        out_lines.append({"text": text, "start": ws[0]["start"], "end": ws[-1]["end"]})

    matched = sum(1 for tag, a0, a1, *_ in sm.get_opcodes() if tag == "equal" for _ in range(a0, a1))
    Path(out_path).write_text(encoding="utf-8", data=json.dumps({"duration": round(duration, 3), "lines": out_lines, "words": words}, indent=1))
    print(f"{len(words)} words, {len(lines)} lines, {duration:.2f}s, {matched}/{len(flat)} tokens matched exactly")


if __name__ == "__main__":
    main(*sys.argv[1:4])
