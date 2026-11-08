#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-dhnembol}"
SERVICE="${SERVICE:-bel-madrasah}"
REMOTE="/opt/bel-madrasah"
BIN="bel-madrasah-arm64"

cd "$(dirname "$0")"

size() { du -h "$1" | cut -f1; }

echo "== build frontend"
pnpm build

echo "== precompress frontend"
find dist -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.svg' \
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
find dist -name '*.map' -delete

echo "== build backend (linux/arm64)"
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build \
  -trimpath \
  -tags "netgo,osusergo" \
  -gcflags="all=-l -B" \
  -ldflags="-s -w -buildid= -extldflags=-static" \
  -o "$BIN" .
echo "ukuran setelah strip: $(size "$BIN")"

if command -v upx >/dev/null 2>&1; then
  echo "== kompres binary (upx ultra-brute)"
  upx --ultra-brute --lzma -q "$BIN" >/dev/null || upx --best --lzma -q "$BIN" >/dev/null
  echo "ukuran setelah upx: $(size "$BIN")"
else
  echo "upx tidak ditemukan (sudo apt install upx-ucl)"
fi

echo "== upload frontend"
rsync -az --delete --compress-level=9 dist/ "$HOST:$REMOTE/static/"

echo "== upload backend"
rsync -z --compress-level=9 "$BIN" "$HOST:$REMOTE/bel-madrasah.new"

echo "== restart service"
ssh -t "$HOST" "
  set -e
  cd $REMOTE
  chmod +x bel-madrasah.new
  [ -f bel-madrasah ] && cp bel-madrasah bel-madrasah.bak || true
  sudo systemctl stop $SERVICE
  mv bel-madrasah.new bel-madrasah
  sudo systemctl start $SERVICE
  sleep 2
  systemctl is-active $SERVICE
  journalctl -u $SERVICE -n 20 --no-pager
  curl -fsS http://localhost:8083/healthz && echo
"

rm -f "$BIN"
echo "== selesai"
