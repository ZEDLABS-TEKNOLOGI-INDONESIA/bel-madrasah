#!/bin/bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/opt/bel-madrasah"
SERVICE_NAME="bel-madrasah"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SERVICE_USER=$(grep '^User=' "$SERVICE_FILE" 2>/dev/null | cut -d= -f2 || echo "bel-madrasah")
NGINX_CONF="/etc/nginx/sites-available/bel-madrasah"
NGINX_ENABLED="/etc/nginx/sites-enabled/bel-madrasah"

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
cmd_exists() { command -v "$1" >/dev/null 2>&1; }

[ "$EUID" -eq 0 ] || error "Jalankan sebagai root: sudo $0"

echo "========================================="
echo " Bel Madrasah - Uninstaller"
echo " ZEDLABS Teknologi Indonesia"
echo "========================================="
echo

read -rp "Lanjutkan penghapusan? [y/N]: " -n 1; echo
[[ $REPLY =~ ^[Yy]$ ]] || { info "Penghapusan dibatalkan."; exit 0; }

if systemctl list-unit-files 2>/dev/null | grep -q "^${SERVICE_NAME}.service"; then
    systemctl is-active --quiet "${SERVICE_NAME}" 2>/dev/null && {
        systemctl stop "${SERVICE_NAME}"
        success "Service dihentikan."
    }
    systemctl is-enabled --quiet "${SERVICE_NAME}" 2>/dev/null && {
        systemctl disable "${SERVICE_NAME}"
        success "Service dinonaktifkan dari autostart."
    }
else
    warning "Service ${SERVICE_NAME} tidak terdaftar di systemd."
fi

if [ -f "$SERVICE_FILE" ]; then
    rm -f "$SERVICE_FILE"
    systemctl daemon-reload
    success "Unit file systemd dihapus."
fi

[ -L "$NGINX_ENABLED" ] || [ -f "$NGINX_ENABLED" ] && {
    rm -f "$NGINX_ENABLED"
    success "Site nginx dinonaktifkan."
}

if [ -f "$NGINX_CONF" ]; then
    read -rp "Hapus konfigurasi nginx? [y/N]: " -n 1; echo
    [[ $REPLY =~ ^[Yy]$ ]] && { rm -f "$NGINX_CONF"; success "Konfigurasi nginx dihapus."; }
fi

if cmd_exists nginx && nginx -t 2>/dev/null; then
    systemctl reload nginx 2>/dev/null || true
    success "nginx direload."
fi

# Hapus system user
if id "$SERVICE_USER" &>/dev/null; then
    read -rp "Hapus system user '${SERVICE_USER}'? [y/N]: " -n 1; echo
    [[ $REPLY =~ ^[Yy]$ ]] && {
        userdel "$SERVICE_USER" 2>/dev/null || true
        success "User ${SERVICE_USER} dihapus."
    }
fi

if [ ! -d "$PROJECT_DIR" ]; then
    success "Direktori ${PROJECT_DIR} sudah tidak ada."
    echo; success "PENGHAPUSAN SELESAI"; exit 0
fi

echo
warning "Direktori: ${PROJECT_DIR}"
warning "Berisi binary, jadwal, log, audio, dan data login."
echo
read -rp "Hapus SELURUH direktori termasuk data? [y/N]: " -n 1; echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$PROJECT_DIR"
    success "Direktori ${PROJECT_DIR} dihapus sepenuhnya."
else
    read -rp "Hapus hanya binary dan static (data & audio tetap)? [y/N]: " -n 1; echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f "${PROJECT_DIR}/bel-madrasah"
        rm -rf "${PROJECT_DIR}/static"
        success "Binary dan file static dihapus."
        info "Data tersimpan di:"
        info "  ${PROJECT_DIR}/data"
        info "  ${PROJECT_DIR}/tone"
    else
        info "Tidak ada file yang dihapus."
    fi
fi

echo
echo "========================================="
success "PENGHAPUSAN SELESAI"
echo "========================================="
