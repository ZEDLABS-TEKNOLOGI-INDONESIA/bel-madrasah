#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?pemakaian: scripts/release-notes.sh <versi>}"
cd "$(dirname "$0")/.."

notes="$(awk -v v="$VERSION" '
  /^## / { if (found) exit; if ($2 == v) { found = 1; next } }
  found { print }
' CHANGELOG.md)"

if [ -z "$(echo "$notes" | tr -d '[:space:]')" ]; then
  echo "CHANGELOG.md tidak punya bagian '## $VERSION'" >&2
  exit 1
fi
printf '%s\n' "$notes"
