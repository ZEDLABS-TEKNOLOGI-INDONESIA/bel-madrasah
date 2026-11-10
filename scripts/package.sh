#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?pemakaian: scripts/package.sh <versi> [direktori-keluaran]}"
OUT="${2:-release}"
ARCHES="${ARCHES:-amd64 arm64 armv7}"

cd "$(dirname "$0")/.."
rm -rf "$OUT"
mkdir -p "$OUT"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "== frontend"
pnpm build
scripts/precompress.sh dist

for arch in $ARCHES; do
  echo "== backend linux/$arch"
  goarch="$arch"
  goarm=""
  if [ "$arch" = "armv7" ]; then
    goarch="arm"
    goarm="7"
  fi
  dir="$STAGE/$arch"
  mkdir -p "$dir"
  CGO_ENABLED=0 GOOS=linux GOARCH="$goarch" GOARM="$goarm" go build \
    -trimpath -tags "netgo,osusergo" \
    -ldflags "-s -w -buildid= -X main.version=$VERSION" \
    -o "$dir/bel-madrasah" ./server
  cp -a dist "$dir/static"
  install -m 755 scripts/update.sh "$dir/bel-madrasah-update"
  tar -C "$dir" --owner=0 --group=0 -czf "$OUT/bel-madrasah-linux-$arch.tar.gz" \
    bel-madrasah bel-madrasah-update static
done

(cd "$OUT" && sha256sum bel-madrasah-linux-*.tar.gz > checksums.txt)
echo "== hasil"
ls -l "$OUT"
