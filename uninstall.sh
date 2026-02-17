#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/opt/bel-madrasah"
SERVICE_NAME="bel-madrasah"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }

service_exists() {
    systemctl list-unit-files 2>/dev/null | grep -q "$SERVICE_NAME.service"
}

service_is_running() {
    systemctl is-active --quiet "$SERVICE_NAME.service" 2>/dev/null
}

show_current_status() {
    info "Status instalasi saat ini:"
    echo

    if service_exists; then
        if service_is_running; then
            echo -e "  Service           : ${GREEN}AKTIF${NC}"
        else
            echo -e "  Service           : ${YELLOW}TERDAFTAR (tidak berjalan)${NC}"
        fi
    else
        echo -e "  Service           : ${RED}TIDAK ADA${NC}"
    fi

    if [ -d "$PROJECT_DIR" ]; then
        local file_count dir_size
        file_count=$(find "$PROJECT_DIR" -type f 2>/dev/null | wc -l)
        dir_size=$(du -sh "$PROJECT_DIR" 2>/dev/null | cut -f1)
        echo -e "  Direktori proyek  : ${GREEN}ADA${NC} ($file_count file, $dir_size)"
    else
        echo -e "  Direktori proyek  : ${RED}TIDAK ADA${NC}"
    fi

    echo
}

remove_service() {
    info "Menghentikan dan menghapus service..."

    if service_is_running; then
        if systemctl stop "$SERVICE_NAME.service"; then
            success "Service dihentikan."
        else
            warning "Gagal menghentikan service."
        fi
    fi

    if service_exists; then
        if systemctl disable "$SERVICE_NAME.service"; then
            success "Service di-disable."
        else
            warning "Gagal disable service."
        fi
    else
        info "Service tidak terdaftar di systemd."
    fi

    if [ -f "$SERVICE_FILE" ]; then
        if rm "$SERVICE_FILE"; then
            success "File service dihapus."
        else
            error "Gagal menghapus file service."
        fi
    fi

    systemctl daemon-reload
    success "Systemd daemon di-reload."
}

remove_project_dir() {
    info "Menghapus direktori proyek..."

    if [ -d "$PROJECT_DIR" ]; then
        if rm -rf "$PROJECT_DIR"; then
            success "Direktori $PROJECT_DIR dihapus."
        else
            error "Gagal menghapus direktori proyek."
            return 1
        fi
    else
        info "Direktori proyek tidak ditemukan."
    fi
}

check_remaining_files() {
    info "Memeriksa file tersisa..."

    local removed=0

    while IFS= read -r file; do
        [ -f "$file" ] && rm -f "$file" && ((removed++))
    done < <(find /etc/systemd/system -name "*$SERVICE_NAME*" 2>/dev/null)

    if [ "$removed" -gt 0 ]; then
        success "$removed file tersisa dihapus."
        systemctl daemon-reload
    else
        success "Tidak ada file tersisa."
    fi
}

show_summary() {
    echo
    echo "========================================="
    success "UNINSTALL SELESAI"
    echo "========================================="
    echo

    local all_clean=true

    if service_exists; then
        echo -e "  Systemd service  : ${RED}MASIH ADA${NC}"
        all_clean=false
    else
        echo -e "  Systemd service  : ${GREEN}DIHAPUS${NC}"
    fi

    if [ -f "$SERVICE_FILE" ]; then
        echo -e "  File service     : ${RED}MASIH ADA${NC}"
        all_clean=false
    else
        echo -e "  File service     : ${GREEN}DIHAPUS${NC}"
    fi

    if [ -d "$PROJECT_DIR" ]; then
        echo -e "  Direktori proyek : ${RED}MASIH ADA${NC}"
        all_clean=false
    else
        echo -e "  Direktori proyek : ${GREEN}DIHAPUS${NC}"
    fi

    echo

    if [ "$all_clean" = true ]; then
        success "Semua komponen berhasil dihapus."
    else
        warning "Beberapa komponen masih tersisa. Hapus secara manual jika diperlukan."
    fi

    echo
    info "ffmpeg dan alsa-utils tidak dihapus karena mungkin digunakan aplikasi lain."
    info "Untuk uninstall secara manual:"
    echo "  sudo apt remove ffmpeg alsa-utils"
    echo "  sudo dnf remove ffmpeg alsa-utils"
    echo "  sudo yum remove ffmpeg alsa-utils"
    echo "  sudo pacman -R ffmpeg alsa-utils"
    echo
}

main() {
    echo "========================================="
    echo "Bell System Madrasah - Uninstaller"
    echo "MTsN 1 Pandeglang"
    echo "========================================="
    echo

    if [ "$EUID" -ne 0 ]; then
        error "Uninstaller ini harus dijalankan sebagai root."
        error "Gunakan: sudo ./uninstall.sh"
        exit 1
    fi

    show_current_status

    warning "Proses ini akan menghapus permanen sistem bel madrasah."
    warning "Tidak ada backup yang akan dibuat."
    echo
    read -rp "Lanjutkan uninstall? [y/N]: " -n 1
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Uninstall dibatalkan."
        exit 1
    fi

    echo
    read -rp "Ketik 'HAPUS' untuk konfirmasi akhir: " confirm
    if [ "$confirm" != "HAPUS" ]; then
        error "Uninstall dibatalkan."
        exit 1
    fi

    echo
    info "Memulai proses uninstall..."
    echo

    remove_service
    echo
    remove_project_dir
    echo
    check_remaining_files

    show_summary
}

trap 'echo; error "Uninstall dibatalkan."; exit 1' INT TERM

main "$@"
