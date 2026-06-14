#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/opt/bel-madrasah"
SERVICE_NAME="bel-madrasah"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
PYTHON_CMD="/usr/bin/python3"
RUN_USER=$(logname 2>/dev/null || echo "${SUDO_USER:-$(whoami)}")

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }

cmd_exists() {
    command -v "$1" >/dev/null 2>&1
}

check_requirements() {
    info "Memeriksa persyaratan sistem..."

    if [ "$EUID" -ne 0 ]; then
        error "Installer ini harus dijalankan sebagai root."
        error "Gunakan: sudo ./install.sh"
        exit 1
    fi

    if ! cmd_exists python3; then
        error "Python3 tidak ditemukan."
        exit 1
    fi
    success "Python3: $(python3 --version)"

    if ! cmd_exists systemctl; then
        error "systemctl tidak ditemukan. Sistem memerlukan systemd."
        exit 1
    fi
    success "systemctl ditemukan."

    success "Persyaratan sistem terpenuhi."
}

install_package() {
    local pkg="$1"
    info "Menginstall $pkg..."
    if cmd_exists apt; then
        apt update -qq && apt install -y "$pkg"
    elif cmd_exists dnf; then
        dnf install -y "$pkg"
    elif cmd_exists yum; then
        yum install -y "$pkg"
    elif cmd_exists pacman; then
        pacman -S --noconfirm "$pkg"
    else
        error "Package manager tidak dikenali. Install $pkg secara manual."
        exit 1
    fi
}

install_ffmpeg() {
    info "Memeriksa ffmpeg..."
    if cmd_exists ffmpeg; then
        success "ffmpeg sudah terinstall."
        return
    fi
    install_package ffmpeg
    if ! cmd_exists ffmpeg; then
        error "Gagal menginstall ffmpeg."
        exit 1
    fi
    success "ffmpeg berhasil diinstall."
}

install_curl() {
    info "Memeriksa curl..."
    if cmd_exists curl; then
        success "curl sudah terinstall."
        return
    fi
    install_package curl
    if ! cmd_exists curl; then
        error "Gagal menginstall curl."
        exit 1
    fi
    success "curl berhasil diinstall."
}

install_alsa() {
    info "Memeriksa ALSA utils..."
    if cmd_exists aplay; then
        success "ALSA utils sudah terinstall."
        return
    fi
    install_package alsa-utils
    success "ALSA utils berhasil diinstall."
}

create_project_dir() {
    info "Menyiapkan direktori proyek..."

    if [ -d "$PROJECT_DIR" ]; then
        warning "Direktori $PROJECT_DIR sudah ada."
        read -rp "Lanjutkan dan timpa file yang ada? [y/N]: " -n 1
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Instalasi dibatalkan."
            exit 1
        fi
    fi

    mkdir -p "$PROJECT_DIR/tone"
    success "Direktori proyek: $PROJECT_DIR"
}

copy_python_files() {
    info "Menyalin file Python..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [ ! -f "$SCRIPT_DIR/main.py" ]; then
        error "main.py tidak ditemukan di direktori installer ($SCRIPT_DIR)."
        exit 1
    fi

    if [ ! -f "$SCRIPT_DIR/jadwal.py" ]; then
        error "jadwal.py tidak ditemukan di direktori installer ($SCRIPT_DIR)."
        exit 1
    fi

    cp "$SCRIPT_DIR/main.py" "$PROJECT_DIR/main.py"
    cp "$SCRIPT_DIR/jadwal.py" "$PROJECT_DIR/jadwal.py"

    chmod +x "$PROJECT_DIR/main.py"
    success "main.py dan jadwal.py berhasil disalin."
}

create_systemd_service() {
    info "Membuat systemd system service..."

    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Bel Madrasah Otomatis
After=sound.target
Wants=sound.target

[Service]
Type=simple
ExecStart=$PYTHON_CMD $PROJECT_DIR/main.py
Restart=always
RestartSec=10
User=$RUN_USER
StandardOutput=journal
StandardError=journal
WorkingDirectory=$PROJECT_DIR

[Install]
WantedBy=multi-user.target
EOF

    success "Service file dibuat: $SERVICE_FILE"
}

setup_service() {
    info "Mengkonfigurasi systemd service..."

    systemctl daemon-reload

    if ! systemctl enable "$SERVICE_NAME.service"; then
        error "Gagal mengaktifkan service."
        exit 1
    fi
    success "Service diaktifkan (auto-start saat boot)."
}

download_tone() {
    info "Mengunduh file audio..."

    BASE_URL="https://raw.githubusercontent.com/zulfikriyahya/bel-madrasah/main/tone"

    AUDIO_FILES=(
        "mars-madrasah.mp3"
        "upacara.mp3"
        "pelajaran-1.mp3"
        "pelajaran-2.mp3"
        "pelajaran-3.mp3"
        "pelajaran-4.mp3"
        "pelajaran-5.mp3"
        "pelajaran-6.mp3"
        "pelajaran-7.mp3"
        "pelajaran-8.mp3"
        "pelajaran-9.mp3"
        "pelajaran-10.mp3"
        "pelajaran-selesai.mp3"
        "indonesia-raya.mp3"
        "istirahat-1.mp3"
        "istirahat-2.mp3"
        "kebersihan.mp3"
        "hymne-madrasah.mp3"
        "literasi.mp3"
        "rohani.mp3"
        "akhir-pekan.mp3"
        "pramuka.mp3"
        "tanah-airku.mp3"
    )

    mkdir -p "$PROJECT_DIR/tone"

    SUCCESS_COUNT=0
    FAIL_COUNT=0

    for file in "${AUDIO_FILES[@]}"; do
        if curl -f -L --silent --show-error -o "$PROJECT_DIR/tone/$file" "$BASE_URL/$file"; then
            success "$file"
            ((SUCCESS_COUNT++))
        else
            warning "Gagal: $file"
            ((FAIL_COUNT++))
        fi
    done

    echo
    info "Berhasil: $SUCCESS_COUNT | Gagal: $FAIL_COUNT"

    ls -lh "$PROJECT_DIR/tone/" > "$PROJECT_DIR/audio-list.txt"

    if [ "$FAIL_COUNT" -gt 0 ]; then
        warning "Beberapa file gagal diunduh. Unduh manual dari:"
        warning "https://github.com/zulfikriyahya/bel-madrasah/tree/main/tone"
    fi
}

set_permissions() {
    info "Mengatur izin file..."
    chown -R "$RUN_USER":"$RUN_USER" "$PROJECT_DIR"
    chmod 755 "$PROJECT_DIR"
    chmod 755 "$PROJECT_DIR/tone"
    chmod 644 "$PROJECT_DIR"/*.py
    chmod 644 "$PROJECT_DIR/tone/"*.mp3 2>/dev/null || true
    success "Izin file diatur."
}

test_installation() {
    info "Memverifikasi instalasi..."

    if ! cd "$PROJECT_DIR" && python3 -c "from jadwal import JADWAL" 2>/dev/null; then
        error "Import jadwal.py gagal. Periksa sintaks Python."
        exit 1
    fi
    success "Sintaks Python valid."

    if ! systemctl is-enabled "$SERVICE_NAME.service" >/dev/null 2>&1; then
        error "Service belum diaktifkan."
        exit 1
    fi
    success "Service terdaftar di systemd."
}

start_service() {
    info "Menjalankan service..."

    if ! systemctl start "$SERVICE_NAME.service"; then
        error "Gagal menjalankan service."
        exit 1
    fi

    sleep 2
    success "Service berjalan."
    systemctl status "$SERVICE_NAME.service" --no-pager -l
}

show_completion() {
    echo
    echo "========================================="
    success "INSTALASI SELESAI"
    echo "========================================="
    echo
    info "Direktori  : $PROJECT_DIR"
    info "Service    : $SERVICE_NAME"
    info "User       : $RUN_USER"
    echo
    echo "Perintah pengelolaan service:"
    echo "  sudo systemctl status  $SERVICE_NAME"
    echo "  sudo systemctl stop    $SERVICE_NAME"
    echo "  sudo systemctl start   $SERVICE_NAME"
    echo "  sudo systemctl restart $SERVICE_NAME"
    echo "  sudo journalctl -u $SERVICE_NAME -f"
    echo "  sudo nano $PROJECT_DIR/jadwal.py"
    echo
}

main() {
    echo "========================================="
    echo "Bell System Madrasah - Installer"
    echo "MTsN 1 Pandeglang"
    echo "========================================="
    echo

    read -rp "Lanjutkan instalasi? [y/N]: " -n 1
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Instalasi dibatalkan."
        exit 1
    fi

    echo
    check_requirements
    install_ffmpeg
    install_curl
    install_alsa
    create_project_dir
    copy_python_files
    create_systemd_service
    setup_service
    download_tone
    set_permissions
    test_installation
    start_service
    show_completion
}

main "$@"
