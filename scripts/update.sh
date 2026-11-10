#!/usr/bin/env bash
set -euo pipefail

DEFAULTS_FILE="${BEL_UPDATE_DEFAULTS:-/etc/default/bel-madrasah-update}"
if [ -r "$DEFAULTS_FILE" ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      BEL_[A-Z_]*)
        value="${value%\"}"; value="${value#\"}"
        value="${value%\'}"; value="${value#\'}"
        [ -z "${!key+x}" ] && export "$key=$value"
        ;;
    esac
  done < "$DEFAULTS_FILE"
fi

REPO="${BEL_UPDATE_REPO:-ZEDLABS-TEKNOLOGI-INDONESIA/bel-madrasah}"
PROJECT_DIR="${BEL_PROJECT_DIR:-/opt/bel-madrasah}"
SERVICE="${BEL_SERVICE:-bel-madrasah}"
HEALTH_URL="${BEL_HEALTH_URL:-http://127.0.0.1:8083/healthz}"
LOCK="${BEL_UPDATE_LOCK:-/run/bel-madrasah-update.lock}"

usage() {
  cat <<EOF
Pemakaian: bel-madrasah-update [--check] [--dry-run] [--force] [--version vX.Y.Z]

  --check     tampilkan versi terpasang dan versi terbaru, lalu keluar
  --dry-run   unduh dan verifikasi paket tanpa mengganti instalasi
  --force     pasang ulang walau versi sama
  --version   pasang versi tertentu, bukan yang terbaru
EOF
}

CHECK=0
DRY_RUN=0
FORCE=0
TARGET=""
while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --force) FORCE=1 ;;
    --version) TARGET="${2:?versi wajib diisi}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
  shift
done

log() { echo "[update] $*"; }
die() { echo "[update] GAGAL: $*" >&2; exit 1; }

if [ "${BEL_UPDATE_DISABLED:-0}" = "1" ] && [ "$CHECK" -eq 0 ] && [ "$FORCE" -eq 0 ]; then
  log "update otomatis dinonaktifkan (BEL_UPDATE_DISABLED=1)"
  exit 0
fi

arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo amd64 ;;
    aarch64|arm64) echo arm64 ;;
    armv7l|armv7|armhf) echo armv7 ;;
    *) die "arsitektur $(uname -m) tidak didukung" ;;
  esac
}

unprivileged() {
  if [ "$(id -u)" -eq 0 ] && command -v runuser >/dev/null 2>&1; then
    runuser -u nobody -- "$@"
  else
    "$@"
  fi
}

installed_version() {
  if [ -x "$PROJECT_DIR/bel-madrasah" ]; then
    unprivileged "$PROJECT_DIR/bel-madrasah" --version 2>/dev/null | head -1 || true
  fi
}

latest_version() {
  curl -fsSL --retry 3 --max-time 30 \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/releases/latest" |
    sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1
}

healthy() {
  for _ in $(seq 1 20); do
    if curl -fsS --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if [ "$CHECK" -eq 0 ] && [ "$DRY_RUN" -eq 0 ] && [ "$(id -u)" -ne 0 ]; then
  die "jalankan sebagai root (sudo bel-madrasah-update)"
fi

SELF="$(readlink -f "$0")"
ARCH="$(arch)"
CURRENT="$(installed_version)"
LATEST="${TARGET:-$(latest_version)}"
[ -n "$LATEST" ] || die "tidak dapat membaca release terbaru dari $REPO"

log "terpasang: ${CURRENT:-tidak diketahui}, tersedia: $LATEST, arsitektur: $ARCH"
if [ "$CHECK" -eq 1 ]; then
  [ "$CURRENT" = "$LATEST" ] && exit 0 || exit 10
fi
if [ "$CURRENT" = "$LATEST" ] && [ "$FORCE" -eq 0 ]; then
  log "sudah versi terbaru"
  exit 0
fi

exec 9>"$LOCK"
flock -n 9 || die "update lain sedang berjalan"

ASSET="bel-madrasah-linux-$ARCH.tar.gz"
BASE_URL="${BEL_UPDATE_BASE_URL:-https://github.com/$REPO/releases/download}/$LATEST"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

log "mengunduh $ASSET"
curl -fsSL --retry 3 --max-time 300 -o "$WORK/$ASSET" "$BASE_URL/$ASSET"
curl -fsSL --retry 3 --max-time 30 -o "$WORK/checksums.txt" "$BASE_URL/checksums.txt"
(cd "$WORK" && grep " $ASSET\$" checksums.txt | sha256sum -c --quiet -) ||
  die "checksum $ASSET tidak cocok"
log "checksum cocok"

mkdir -p "$WORK/pkg"
tar -xzf "$WORK/$ASSET" -C "$WORK/pkg"
[ -x "$WORK/pkg/bel-madrasah" ] && [ -f "$WORK/pkg/static/index.html" ] ||
  die "isi paket tidak lengkap"
PKG_VERSION="$("$WORK/pkg/bel-madrasah" --version 2>/dev/null || true)"
[ "$PKG_VERSION" = "$LATEST" ] || die "versi di paket ($PKG_VERSION) berbeda dari tag $LATEST"

if [ "$DRY_RUN" -eq 1 ]; then
  log "dry-run: paket $LATEST valid, instalasi tidak diubah"
  exit 0
fi

log "mencadangkan versi lama"
rm -rf "$PROJECT_DIR/static.bak"
[ -f "$PROJECT_DIR/bel-madrasah" ] && cp -p "$PROJECT_DIR/bel-madrasah" "$PROJECT_DIR/bel-madrasah.bak"
[ -d "$PROJECT_DIR/static" ] && cp -a "$PROJECT_DIR/static" "$PROJECT_DIR/static.bak"

rollback() {
  log "memulihkan versi lama"
  systemctl stop "$SERVICE" 9>&- || true
  [ -f "$PROJECT_DIR/bel-madrasah.bak" ] && cp -p "$PROJECT_DIR/bel-madrasah.bak" "$PROJECT_DIR/bel-madrasah"
  if [ -d "$PROJECT_DIR/static.bak" ]; then
    rm -rf "$PROJECT_DIR/static"
    cp -a "$PROJECT_DIR/static.bak" "$PROJECT_DIR/static"
  fi
  systemctl start "$SERVICE" 9>&- || true
}

log "memasang $LATEST"
systemctl stop "$SERVICE" 9>&-
install -m 755 "$WORK/pkg/bel-madrasah" "$PROJECT_DIR/bel-madrasah"
rm -rf "$PROJECT_DIR/static.new"
cp -a "$WORK/pkg/static" "$PROJECT_DIR/static.new"
for keep in icons; do
  if [ -d "$PROJECT_DIR/static/$keep" ] && [ ! -d "$PROJECT_DIR/static.new/$keep" ]; then
    cp -a "$PROJECT_DIR/static/$keep" "$PROJECT_DIR/static.new/$keep"
  fi
done
rm -rf "$PROJECT_DIR/static"
mv "$PROJECT_DIR/static.new" "$PROJECT_DIR/static"
chmod -R a+rX "$PROJECT_DIR/static"
systemctl start "$SERVICE" 9>&-

if ! healthy; then
  rollback
  die "$LATEST tidak lolos health check, versi ${CURRENT:-lama} dipulihkan"
fi
log "selesai: $LATEST berjalan"

if [ -f "$WORK/pkg/bel-madrasah-update" ] && [ "$SELF" = "/usr/local/sbin/bel-madrasah-update" ]; then
  if ! cmp -s "$WORK/pkg/bel-madrasah-update" "$SELF"; then
    install -o root -g root -m 755 "$WORK/pkg/bel-madrasah-update" "$SELF"
    log "updater ikut diperbarui"
  fi
fi
exit 0
