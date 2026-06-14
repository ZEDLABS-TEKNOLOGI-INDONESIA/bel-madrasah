#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_URL="https://github.com/ZEDLABS-TEKNOLOGI-INDONESIA/bel-madrasah.git"
REPO_BRANCH="server"
BUILD_DIR="/tmp/bel-madrasah-build"
PROJECT_DIR="/opt/bel-madrasah"
SERVICE_NAME="bel-madrasah"
SERVICE_FILE="/etc/systemd/system/$SERVICE_NAME.service"

REQUIRED_ICON_SIZES=(72 96 128 144 152 192 384 512)
REQUIRED_MASKABLE_SIZES=(192 512)

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; }

cmd_exists() { command -v "$1" >/dev/null 2>&1; }

check_requirements() {
    info "Memeriksa persyaratan sistem..."

    if [ "$EUID" -ne 0 ]; then
        error "Installer ini harus dijalankan sebagai root."
        error "Gunakan: sudo ./install.sh"
        exit 1
    fi

    if ! cmd_exists go; then
        warning "Go tidak ditemukan. Menginstall otomatis..."
        install_go
    fi
    success "Go: $(go version)"

    if ! cmd_exists git; then
        error "git tidak ditemukan."
        install_package git
    fi
    success "git: $(git --version)"

    if ! cmd_exists systemctl; then
        error "systemctl tidak ditemukan. Sistem memerlukan systemd."
        exit 1
    fi
    success "systemctl ditemukan."
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

install_go() {
    local GO_VERSION="1.24.4"
    local GO_ARCH="amd64"
    local GO_TAR="go${GO_VERSION}.linux-${GO_ARCH}.tar.gz"
    local GO_URL="https://go.dev/dl/${GO_TAR}"

    info "Mengunduh Go ${GO_VERSION}..."
    curl -fL --progress-bar -o "/tmp/${GO_TAR}" "${GO_URL}"
    if [ $? -ne 0 ]; then
        error "Gagal mengunduh Go."
        exit 1
    fi

    info "Menginstall Go ke /usr/local/go..."
    rm -rf /usr/local/go
    tar -C /usr/local -xzf "/tmp/${GO_TAR}"
    rm -f "/tmp/${GO_TAR}"

    export PATH=$PATH:/usr/local/go/bin

    if ! cmd_exists go; then
        error "Gagal menginstall Go."
        exit 1
    fi
    success "Go berhasil diinstall: $(go version)"
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

clone_repo() {
    info "Mengunduh source code dari GitHub..."

    rm -rf "$BUILD_DIR"
    if ! git clone --depth=1 --branch "$REPO_BRANCH" "$REPO_URL" "$BUILD_DIR"; then
        error "Gagal clone repository."
        exit 1
    fi
    success "Source code berhasil diunduh ke $BUILD_DIR"
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
    mkdir -p "$PROJECT_DIR/static/icons"
    success "Direktori proyek: $PROJECT_DIR"
}

build_binary() {
    info "Membangun binary Go..."

    for f in main.go auth.go handler.go storage.go pwa.go go.mod; do
        if [ ! -f "$BUILD_DIR/$f" ]; then
            error "$f tidak ditemukan di $BUILD_DIR."
            exit 1
        fi
    done

    if ! (cd "$BUILD_DIR" && go build -o "$PROJECT_DIR/bel-madrasah" .); then
        error "Gagal membangun binary Go."
        exit 1
    fi

    chmod +x "$PROJECT_DIR/bel-madrasah"
    success "Binary berhasil dibangun: $PROJECT_DIR/bel-madrasah"
}

copy_static() {
    info "Menyalin file static..."

    if [ -d "$BUILD_DIR/static" ]; then
        cp -r "$BUILD_DIR/static/." "$PROJECT_DIR/static/"
        success "File static disalin ke $PROJECT_DIR/static/"
    else
        warning "Direktori static tidak ditemukan, dilewati."
    fi

    mkdir -p "$PROJECT_DIR/static/icons"
}

generate_pwa_icons() {
    info "Memeriksa ikon PWA..."

    local missing=0
    for size in "${REQUIRED_ICON_SIZES[@]}"; do
        [ ! -f "$PROJECT_DIR/static/icons/icon-$size.png" ] && missing=1
    done
    for size in "${REQUIRED_MASKABLE_SIZES[@]}"; do
        [ ! -f "$PROJECT_DIR/static/icons/icon-maskable-$size.png" ] && missing=1
    done

    if [ "$missing" -eq 0 ]; then
        success "Seluruh ikon PWA sudah tersedia."
        return
    fi

    local SOURCE_ICON=""
    for candidate in "$BUILD_DIR/static/icons/source.png" "$BUILD_DIR/icon-source.png"; do
        if [ -f "$candidate" ]; then
            SOURCE_ICON="$candidate"
            break
        fi
    done

    if [ -z "$SOURCE_ICON" ]; then
        warning "Ikon PWA belum lengkap dan tidak ditemukan gambar sumber (source.png)."
        warning "Salin manual berkas ikon ke $PROJECT_DIR/static/icons/."
        return
    fi

    if ! cmd_exists convert; then
        install_package imagemagick || true
    fi

    if ! cmd_exists convert; then
        warning "ImageMagick tidak tersedia. Ikon PWA tidak dibuat otomatis."
        return
    fi

    info "Membuat ikon PWA dari $SOURCE_ICON..."
    for size in "${REQUIRED_ICON_SIZES[@]}"; do
        convert "$SOURCE_ICON" -resize "${size}x${size}" "$PROJECT_DIR/static/icons/icon-$size.png"
    done
    for size in "${REQUIRED_MASKABLE_SIZES[@]}"; do
        convert "$SOURCE_ICON" -resize "${size}x${size}" -gravity center -extent "${size}x${size}" \
            "$PROJECT_DIR/static/icons/icon-maskable-$size.png"
    done
    success "Ikon PWA berhasil dibuat."
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

    location /static/ {
        proxy_pass         http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        expires            7d;
        add_header         Cache-Control "public, immutable";
    }

    location /sw.js {
        proxy_pass         http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        add_header         Cache-Control "no-cache";
    }

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

    ln -sf "$NGINX_CONF" "$NGINX_ENABLED"

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

create_systemd_service() {
    info "Membuat systemd service..."

    local LOGIN_USER
    LOGIN_USER=$(logname 2>/dev/null || echo "${SUDO_USER:-}")
    local USER_UID
    USER_UID=$(id -u "$LOGIN_USER" 2>/dev/null || echo "1000")

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
Environment=PULSE_SERVER=unix:/run/user/${USER_UID}/pulse/native
StandardOutput=journal
StandardError=journal
WorkingDirectory=$PROJECT_DIR

[Install]
WantedBy=multi-user.target
EOF

    success "Service file dibuat: $SERVICE_FILE (PULSE_SERVER uid=${USER_UID})"
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
    info "Menyalin file audio..."

    mkdir -p "$PROJECT_DIR/tone"

    if [ -d "$BUILD_DIR/tone" ]; then
        local count=0
        for f in "$BUILD_DIR/tone/"*.mp3 "$BUILD_DIR/tone/"*.wav "$BUILD_DIR/tone/"*.ogg; do
            [ -f "$f" ] || continue
            cp "$f" "$PROJECT_DIR/tone/"
            success "$(basename "$f")"
            ((count++))
        done
        if [ "$count" -gt 0 ]; then
            info "Berhasil menyalin $count file audio."
            return
        fi
    fi

    warning "Tidak ada file audio di repository. Unduh manual dari:"
    warning "https://github.com/ZEDLABS-TEKNOLOGI-INDONESIA/bel-madrasah/tree/$REPO_BRANCH/tone"
}

set_permissions() {
    info "Mengatur izin file..."
    chown -R root:root "$PROJECT_DIR"
    chmod 755 "$PROJECT_DIR"
    chmod 755 "$PROJECT_DIR/tone"
    chmod 755 "$PROJECT_DIR/data"
    chmod 755 "$PROJECT_DIR/static"
    chmod 755 "$PROJECT_DIR/static/icons"
    chmod 755 "$PROJECT_DIR/bel-madrasah"
    chmod 644 "$PROJECT_DIR/tone/"*.mp3 2>/dev/null || true
    chmod 644 "$PROJECT_DIR/static/icons/"*.png 2>/dev/null || true
    success "Izin file diatur."
}

cleanup_build() {
    info "Membersihkan direktori build..."
    rm -rf "$BUILD_DIR"
    success "Build directory dihapus."
}

test_installation() {
    info "Memverifikasi instalasi..."

    [ ! -f "$PROJECT_DIR/bel-madrasah" ] && error "Binary tidak ditemukan." && exit 1
    success "Binary ditemukan."

    [ ! -f "$PROJECT_DIR/static/index.html" ] && warning "index.html tidak ditemukan."
    [ -f "$PROJECT_DIR/static/index.html" ] && success "File static ditemukan."

    if [ ! -f "$PROJECT_DIR/static/manifest.json" ] || [ ! -f "$PROJECT_DIR/static/sw.js" ]; then
        warning "Berkas PWA (manifest.json/sw.js) tidak lengkap."
    else
        success "Berkas PWA ditemukan."
    fi

    systemctl is-enabled "$SERVICE_NAME.service" >/dev/null 2>&1 || { error "Service belum diaktifkan."; exit 1; }
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
    local LOCAL_IP
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
    [ -n "$LOCAL_IP" ] && info "Akses web  : http://$LOCAL_IP"
    info "Login      : admin / admin123"
    warning "Segera ganti password setelah login pertama!"
    echo
    info "Aplikasi mendukung PWA. Buka di Chrome/Edge lalu pilih 'Pasang Aplikasi'."
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
    echo "ZEDLABS Teknologi Indonesia"
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
    clone_repo
    create_project_dir
    build_binary
    copy_static
    generate_pwa_icons
    setup_nginx
    create_systemd_service
    setup_service
    download_tone
    set_permissions
    cleanup_build
    test_installation
    start_service
    show_completion
}

main "$@"
