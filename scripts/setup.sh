#!/usr/bin/env bash
# Video studio setup: installs Node + Python deps, the speech model, and fonts.
# Usage: bash scripts/setup.sh [project-dir]   (fonts go to <project-dir>/public/fonts)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT="${1:-$ROOT}"
cd "$ROOT"

echo "==> Node packages (Remotion 4.0.545, React 19, TypeScript 5.9)"
npm install

echo "==> Python packages (numpy, scipy, soundfile, Pillow, sherpa-onnx)"
python3 -m pip install -r requirements.txt

echo "==> Speech model (sherpa-onnx zipformer en 2023-06-26)"
MODEL=sherpa-onnx-zipformer-en-2023-06-26
mkdir -p models
if [ ! -d "models/$MODEL" ]; then
  curl -fL --retry 4 -o "models/$MODEL.tar.bz2" \
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/$MODEL.tar.bz2"
  tar -xjf "models/$MODEL.tar.bz2" -C models
  rm "models/$MODEL.tar.bz2"
else
  echo "    already present"
fi

echo "==> Fonts -> $PROJECT/public/fonts"
FONTS="$PROJECT/public/fonts"
mkdir -p "$FONTS"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
# package | source file | saved name
while IFS='|' read -r pkg src dest; do
  [ -f "$FONTS/$dest" ] && continue
  [ -d "$TMP/$pkg" ] || { mkdir -p "$TMP/$pkg"; (cd "$TMP/$pkg" && npm pack "@fontsource/$pkg@5" --silent >/dev/null && tar -xzf ./*.tgz); }
  cp "$TMP/$pkg/package/files/$src" "$FONTS/$dest"
done <<'LIST'
inter|inter-latin-700-normal.woff2|Inter-Bold.woff2
inter|inter-latin-800-normal.woff2|Inter-ExtraBold.woff2
playfair-display|playfair-display-latin-400-italic.woff2|PlayfairDisplay-Italic.woff2
anton|anton-latin-400-normal.woff2|Anton-Regular.woff2
oswald|oswald-latin-700-normal.woff2|Oswald-Bold.woff2
special-elite|special-elite-latin-400-normal.woff2|SpecialElite-Regular.woff2
LIST
ls -1 "$FONTS"
echo "==> Done"
