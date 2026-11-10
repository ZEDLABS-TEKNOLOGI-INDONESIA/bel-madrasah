#!/usr/bin/env bash
set -euo pipefail

DIR="${1:-dist}"
[ -d "$DIR" ] || { echo "direktori $DIR tidak ada" >&2; exit 1; }

find "$DIR" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.svg' \
  -o -name '*.json' -o -name '*.ico' \) ! -name '*.br' ! -name '*.gz' -print0 |
while IFS= read -r -d '' f; do
  if command -v brotli >/dev/null 2>&1; then
    brotli -q 11 -w 24 -f -k "$f"
  fi
  if command -v zopfli >/dev/null 2>&1; then
    zopfli --i50 "$f"
  else
    gzip -9 -k -f "$f"
  fi
done
find "$DIR" -name '*.map' -delete
