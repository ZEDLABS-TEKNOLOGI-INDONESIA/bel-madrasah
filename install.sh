#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/opt/bel-madrasah"
SERVICE_NAME="bel-madrasah"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"
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

    if ! cmd_exists go; then
        error "Go tidak ditemukan. Install dari https://go.dev/dl/"
        exit 1
    fi
    success "Go: $(go version)"

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
    mkdir -p "$PROJECT_DIR/data"
    mkdir -p "$PROJECT_DIR/static"
    success "Direktori proyek: $PROJECT_DIR"
}

build_binary() {
    info "Membangun binary Go..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    # Validasi file Go yang diperlukan (jadwal.go sudah dihapus/digabung ke storage.go)
    for f in main.go auth.go handler.go storage.go go.mod; do
        if [ ! -f "$SCRIPT_DIR/$f" ]; then
            error "$f tidak ditemukan di direktori installer ($SCRIPT_DIR)."
            exit 1
        fi
    done

    # Hapus jadwal.go jika masih ada (menyebabkan compile error)
    if [ -f "$SCRIPT_DIR/jadwal.go" ]; then
        warning "jadwal.go ditemukan dan akan dihapus (sudah digabung ke storage.go)."
        rm -f "$SCRIPT_DIR/jadwal.go"
    fi

    if ! (cd "$SCRIPT_DIR" && go build -o "$PROJECT_DIR/bel-madrasah" .); then
        error "Gagal membangun binary Go."
        exit 1
    fi

    chmod +x "$PROJECT_DIR/bel-madrasah"
    success "Binary berhasil dibangun: $PROJECT_DIR/bel-madrasah"
}

setup_nginx() {
    info "Mengkonfigurasi nginx reverse proxy..."

    if ! cmd_exists nginx; then
        install_package nginx
    fi

    local NGINX_CONF="/etc/nginx/sites-available/bel-madrasah"
    local NGINX_ENABLED="/etc/nginx/sites-enabled/bel-madrasah"

    cat > "$NGINX_CONF" << 'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 32M;

    location / {
        proxy_pass         http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
EOF

    # Aktifkan site
    ln -sf "$NGINX_CONF" "$NGINX_ENABLED"

    # Nonaktifkan default nginx jika ada
    if [ -f /etc/nginx/sites-enabled/default ]; then
        rm -f /etc/nginx/sites-enabled/default
        warning "Site default nginx dinonaktifkan."
    fi

    if nginx -t 2>/dev/null; then
        systemctl enable nginx
        systemctl reload nginx
        success "nginx dikonfigurasi dan direload."
    else
        error "Konfigurasi nginx tidak valid. Cek manual: nginx -t"
        exit 1
    fi
}

copy_static() {
    info "Menyalin file static..."
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [ -d "$SCRIPT_DIR/static" ]; then
        cp -r "$SCRIPT_DIR/static/." "$PROJECT_DIR/static/"
        success "File static disalin ke $PROJECT_DIR/static/"
    else
        warning "Direktori static tidak ditemukan, dilewati."
    fi
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
ExecStart=$PROJECT_DIR/bel-madrasah
Restart=always
RestartSec=10
User=root
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
        # Lewati jika sudah ada di direktori lokal
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        if [ -f "$SCRIPT_DIR/tone/$file" ]; then
            cp "$SCRIPT_DIR/tone/$file" "$PROJECT_DIR/tone/$file"
            success "$file (lokal)"
            ((SUCCESS_COUNT++))
            continue
        fi

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

    if [ "$FAIL_COUNT" -gt 0 ]; then
        warning "Beberapa file gagal diunduh. Unduh manual dari:"
        warning "https://github.com/zulfikriyahya/bel-madrasah/tree/main/tone"
    fi
}

detect_audio_device() {
    info "Mendeteksi perangkat audio ALSA..."
    if cmd_exists aplay; then
        echo
        aplay -l 2>/dev/null || warning "Tidak dapat mendeteksi perangkat audio."
        echo
        warning "Pastikan nilai alsaDev di main.go sesuai dengan perangkat audio Anda."
        warning "Default saat ini: hw:1,0"
    fi
}

set_permissions() {
    info "Mengatur izin file..."
    chown -R root:root "$PROJECT_DIR"
    chmod 755 "$PROJECT_DIR"
    chmod 755 "$PROJECT_DIR/tone"
    chmod 755 "$PROJECT_DIR/data"
    chmod 755 "$PROJECT_DIR/static"
    chmod 755 "$PROJECT_DIR/bel-madrasah"
    chmod 644 "$PROJECT_DIR/tone/"*.mp3 2>/dev/null || true
    success "Izin file diatur."
}

test_installation() {
    info "Memverifikasi instalasi..."

    if [ ! -f "$PROJECT_DIR/bel-madrasah" ]; then
        error "Binary tidak ditemukan di $PROJECT_DIR/bel-madrasah."
        exit 1
    fi
    success "Binary ditemukan."

    if [ ! -f "$PROJECT_DIR/static/index.html" ]; then
        warning "index.html tidak ditemukan di $PROJECT_DIR/static/."
    else
        success "File static ditemukan."
    fi

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
        error "Cek log: journalctl -u $SERVICE_NAME -n 50"
        exit 1
    fi

    sleep 2
    success "Service berjalan."
    systemctl status "$SERVICE_NAME.service" --no-pager -l
}

show_completion() {
    # Dapatkan IP lokal
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

    echo
    echo "========================================="
    success "INSTALASI SELESAI"
    echo "========================================="
    echo
    info "Direktori  : $PROJECT_DIR"
    info "Binary     : $PROJECT_DIR/bel-madrasah"
    info "Service    : $SERVICE_NAME"
    echo
    if [ -n "$LOCAL_IP" ]; then
        info "Akses web  : http://$LOCAL_IP"
    fi
    info "Login      : admin / admin123"
    warning "Segera ganti password setelah login pertama!"
    echo
    echo "Perintah pengelolaan service:"
    echo "  sudo systemctl status  $SERVICE_NAME"
    echo "  sudo systemctl stop    $SERVICE_NAME"
    echo "  sudo systemctl start   $SERVICE_NAME"
    echo "  sudo systemctl restart $SERVICE_NAME"
    echo "  sudo journalctl -u $SERVICE_NAME -f"
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
    detect_audio_device
    create_project_dir
    build_binary
    copy_static
    setup_nginx
    create_systemd_service
    setup_service
    download_tone
    set_permissions
    test_installation
    start_service
    show_completion
}

main "$@"
