#!/usr/bin/env bash
set -euo pipefail

HOST="${HOST:-zedlabs}"
SERVICE="${SERVICE:-bel-madrasah}"
REMOTE="/opt/bel-madrasah"
BIN="bel-madrasah-arm64"

cd "$(dirname "$0")/.."

size() { du -h "$1" | cut -f1; }

VERSION="$(git describe --tags --always --dirty 2>/dev/null || echo dev)"
echo "== versi $VERSION"

echo "== build frontend"
pnpm build

echo "== precompress frontend"
scripts/precompress.sh dist

echo "== build backend (linux/arm64)"
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build \
  -trimpath \
  -tags "netgo,osusergo" \
  -gcflags="all=-l -B" \
  -ldflags="-s -w -buildid= -extldflags=-static -X main.version=$VERSION" \
  -o "$BIN" ./server
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
