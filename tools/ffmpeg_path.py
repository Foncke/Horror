"""Find an FFmpeg binary: the one on PATH, or the copy that ships with Remotion."""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def ffmpeg() -> str:
    found = shutil.which("ffmpeg")
    if found:
        return found
    for p in sorted((ROOT / "node_modules" / "@remotion").glob("compositor-*/ffmpeg*")):
        if p.is_file():
            return str(p)
    raise FileNotFoundError("FFmpeg not found: install it or run `npm ci` (Remotion ships one)")
