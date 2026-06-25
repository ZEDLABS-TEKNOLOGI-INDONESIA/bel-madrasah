#!/bin/bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO_URL="https://github.com/ZEDLABS-TEKNOLOGI-INDONESIA/bel-madrasah.git"
REPO_BRANCH="main"
BUILD_DIR="/tmp/bel-madrasah-build"
PROJECT_DIR="/opt/bel-madrasah"
SERVICE_NAME="bel-madrasah"
SERVICE_USER="${SUDO_USER:-$(logname 2>/dev/null || echo root)}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
GO_VERSION="1.24.4"

REQUIRED_ICON_SIZES=(72 96 128 144 152 192 384 512)
REQUIRED_MASKABLE_SIZES=(192 512)

ENABLE_TLS=0
DOMAIN=""
EMAIL=""
IS_UPDATE=0
ALSA_DEVICE="hw:1,0"
AUDIO_FORMAT="alsa"

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
cmd_exists() { command -v "$1" >/dev/null 2>&1; }

require_root() {
    [ "$EUID" -eq 0 ] || error "Jalankan sebagai root: sudo $0"
}

detect_pkg_manager() {
    if cmd_exists apt-get; then echo "apt"
    elif cmd_exists dnf; then echo "dnf"
    elif cmd_exists yum; then echo "yum"
    elif cmd_exists pacman; then echo "pacman"
    else error "Package manager tidak dikenali."
    fi
}

install_package() {
    local pkg="$1"
    local pm
    pm=$(detect_pkg_manager)
    info "Menginstall ${pkg}..."
    case "$pm" in
        apt)    apt-get update -qq && apt-get install -y "$pkg" ;;
        dnf)    dnf install -y "$pkg" ;;
        yum)    yum install -y "$pkg" ;;
        pacman) pacman -S --noconfirm "$pkg" ;;
    esac
}

install_go() {
    local arch
    case "$(uname -m)" in
        x86_64)        arch="amd64" ;;
        aarch64)       arch="arm64" ;;
        armv7l|armv6l) arch="armv6l" ;;
        riscv64)       arch="riscv64" ;;
        *) error "Arsitektur tidak didukung: $(uname -m)" ;;
    esac
    local tar_file="go${GO_VERSION}.linux-${arch}.tar.gz"
    local url="https://go.dev/dl/${tar_file}"
    info "Mengunduh Go ${GO_VERSION} (${arch})..."
    curl -fL --progress-bar -o "/tmp/${tar_file}" "$url" || error "Gagal mengunduh Go."
    rm -rf /usr/local/go
    tar -C /usr/local -xzf "/tmp/${tar_file}"
    rm -f "/tmp/${tar_file}"
    export PATH="$PATH:/usr/local/go/bin"
    mkdir -p /etc/profile.d
    echo 'export PATH=$PATH:/usr/local/go/bin' > /etc/profile.d/go.sh
    chmod 644 /etc/profile.d/go.sh
    cmd_exists go || error "Gagal menginstall Go."
    success "Go $(go version)"
}

node_ok() {
    cmd_exists node && node -e "process.exit(parseInt(process.versions.node) >= 18 ? 0 : 1)" 2>/dev/null
}

install_node() {
    # Jika node sudah ada tapi npm tidak ada, hapus node terlebih dahulu
    if cmd_exists node && ! cmd_exists npm; then
        warning "Node.js ditemukan tanpa npm, menginstall ulang via NodeSource..."
        local pm
        pm=$(detect_pkg_manager)
        case "$pm" in
            apt)
                apt-get remove -y nodejs 2>/dev/null || true
                apt-get autoremove -y 2>/dev/null || true
                ;;
            dnf|yum)
                "$pm" remove -y nodejs 2>/dev/null || true
                ;;
            pacman)
                pacman -R --noconfirm nodejs 2>/dev/null || true
                ;;
        esac
    fi

    if node_ok && cmd_exists npm; then
        success "Node.js: $(node -v) | npm: $(npm -v)"
        return
    fi

    info "Menginstall Node.js LTS via NodeSource..."
    local pm
    pm=$(detect_pkg_manager)

    case "$pm" in
        apt)
            curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
            apt-get install -y nodejs
            ;;
        dnf)
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | bash -
            dnf install -y nodejs npm
            ;;
        yum)
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | bash -
            yum install -y nodejs npm
            ;;
        pacman)
            pacman -S --noconfirm nodejs npm
            ;;
        *)
            error "Tidak bisa menginstall Node.js secara otomatis."
            ;;
    esac

    cmd_exists node || error "Gagal menginstall Node.js."
    cmd_exists npm  || error "npm tidak tersedia setelah instalasi Node.js."
    node_ok         || error "Versi Node.js terlalu lama (butuh >= 18)."
    success "Node.js: $(node -v) | npm: $(npm -v)"
}

install_pnpm() {
    info "Membersihkan instalasi pnpm lama..."

    # Hapus semua wrapper/symlink pnpm yang mungkin rusak
    rm -f /usr/local/bin/pnpm /usr/local/bin/pnpx
    rm -rf /usr/local/share/pnpm

    # Install pnpm via npm --force agar mendarat di NVM_BIN (node aktif)
    if cmd_exists npm; then
        info "Menginstall pnpm via npm..."
        npm install -g pnpm --force 2>&1 | grep -v "^npm notice" || true

        # Cari binary hasil install npm (biasanya di NVM_BIN atau prefix npm)
        local npm_prefix
        npm_prefix=$(npm config get prefix 2>/dev/null || true)
        local candidates=(
            "${NVM_BIN:-}/pnpm"
            "${npm_prefix}/bin/pnpm"
        )
        for c in "${candidates[@]}"; do
            [ -z "$c" ] && continue
            [ -x "$c" ] || continue
            if "$c" --version >/dev/null 2>&1; then
                # Buat symlink ke /usr/local/bin
                ln -sf "$c" /usr/local/bin/pnpm
                # Verifikasi symlink benar-benar bisa dipanggil
                if /usr/local/bin/pnpm --version >/dev/null 2>&1; then
                    success "pnpm: $(/usr/local/bin/pnpm --version) (via ${c})"
                    return
                fi
                # Jika symlink masih gagal, panggil langsung tanpa symlink
                rm -f /usr/local/bin/pnpm
                # Buat wrapper script sederhana
                printf '#!/bin/bash\nexec "%s" "$@"\n' "$c" > /usr/local/bin/pnpm
                chmod +x /usr/local/bin/pnpm
                if /usr/local/bin/pnpm --version >/dev/null 2>&1; then
                    success "pnpm: $(/usr/local/bin/pnpm --version) (wrapper ke ${c})"
                    return
                fi
            fi
        done
    fi

    error "Gagal menginstall pnpm. Coba manual:\n  npm install -g pnpm --force\n  pnpm --version"
}

build_frontend() {
    info "Membangun frontend..."
    [ -f "${BUILD_DIR}/package.json" ] || {
        warning "package.json tidak ditemukan, lewati build frontend."
        return
    }

    # Resolve path pnpm yang benar-benar berfungsi
    local pnpm_bin="/usr/local/bin/pnpm"
    if ! "$pnpm_bin" --version >/dev/null 2>&1; then
        # Fallback: cari langsung di npm prefix / NVM_BIN
        local npm_prefix
        npm_prefix=$(npm config get prefix 2>/dev/null || true)
        for c in "${NVM_BIN:-}/pnpm" "${npm_prefix}/bin/pnpm"; do
            [ -x "$c" ] && "$c" --version >/dev/null 2>&1 && pnpm_bin="$c" && break
        done
    fi
    "$pnpm_bin" --version >/dev/null 2>&1 || error "pnpm tidak berfungsi: ${pnpm_bin}"
    info "Menggunakan pnpm: ${pnpm_bin} (v$("$pnpm_bin" --version))"

    (
        cd "$BUILD_DIR"
        export PATH="/usr/local/bin:${NVM_BIN:-}:$PATH:/usr/local/go/bin"
        "$pnpm_bin" install --frozen-lockfile
        "$pnpm_bin" build
    ) || error "Gagal build frontend."

    [ -d "${BUILD_DIR}/dist" ] || error "Output dist/ tidak ditemukan setelah build."
    success "Frontend berhasil dibangun."
}

check_requirements() {
    info "Memeriksa persyaratan sistem..."
    require_root
    export PATH="$PATH:/usr/local/go/bin"
    if ! cmd_exists go; then
        warning "Go tidak ditemukan, menginstall otomatis..."
        install_go
    else
        success "Go: $(go version)"
    fi
    if ! cmd_exists git; then
        install_package git
    fi
    success "git: $(git --version)"
    cmd_exists systemctl || error "systemd tidak ditemukan."
    success "systemd tersedia."
}

install_tools() {
    for tool in ffmpeg curl; do
        if ! cmd_exists "$tool"; then
            install_package "$tool"
            cmd_exists "$tool" || error "Gagal menginstall ${tool}."
        fi
        success "${tool} tersedia."
    done
    if ! cmd_exists aplay; then
        install_package alsa-utils
        success "alsa-utils terinstall."
    else
        success "alsa-utils tersedia."
    fi
}

detect_alsa_device() {
    info "Mendeteksi audio device..."
    if ! aplay -l 2>/dev/null | grep -q "card"; then
        warning "Tidak ada audio device ditemukan, menggunakan default."
        ALSA_DEVICE="default"
        return
    fi
    local card=""
    while IFS= read -r line; do
        if echo "$line" | grep -q "^card" && ! echo "$line" | grep -qi "hdmi\|displayport"; then
            card=$(echo "$line" | grep -o "^card [0-9]*" | awk '{print $2}')
            break
        fi
    done < <(aplay -l 2>/dev/null)

    if [ -n "$card" ]; then
        ALSA_DEVICE="hw:${card},0"
        success "Audio device dipilih: ${ALSA_DEVICE}"
    else
        card=$(aplay -l 2>/dev/null | grep "^card" | head -1 | grep -o "^card [0-9]*" | awk '{print $2}')
        ALSA_DEVICE="hw:${card},0"
        warning "Hanya ditemukan HDMI, menggunakan: ${ALSA_DEVICE}"
    fi
}

clone_repo() {
    info "Mengunduh source code..."
    rm -rf "$BUILD_DIR"
    git clone --depth=1 --branch "$REPO_BRANCH" "$REPO_URL" "$BUILD_DIR" \
        || error "Gagal clone repository."
    success "Source code diunduh ke ${BUILD_DIR}."
}

prepare_dirs() {
    info "Menyiapkan direktori proyek..."
    if [ -d "$PROJECT_DIR" ]; then
        IS_UPDATE=1
        warning "Instalasi sebelumnya ditemukan, melakukan update..."
        backup_data
    fi
    mkdir -p "${PROJECT_DIR}/tone" "${PROJECT_DIR}/data" "${PROJECT_DIR}/static/icons"
    success "Direktori siap: ${PROJECT_DIR}"
}

backup_data() {
    local ts
    ts=$(date +%Y%m%d-%H%M%S)
    local backup="/tmp/bel-madrasah-backup-${ts}"
    mkdir -p "$backup"
    [ -d "${PROJECT_DIR}/data" ] && cp -r "${PROJECT_DIR}/data" "${backup}/"
    [ -d "${PROJECT_DIR}/tone" ] && cp -r "${PROJECT_DIR}/tone" "${backup}/"
    success "Data di-backup ke: ${backup}"
}

detect_audio_backend() {
    info "Mendeteksi audio backend..."
    if cmd_exists pipewire && pactl info 2>/dev/null | grep -qi "pipewire"; then
        AUDIO_FORMAT="pipewire"
        ALSA_DEVICE="default"
        success "Backend: PipeWire"
        return
    fi
    if cmd_exists pulseaudio || cmd_exists pactl; then
        if pactl info &>/dev/null; then
            AUDIO_FORMAT="pulse"
            ALSA_DEVICE="default"
            success "Backend: PulseAudio"
            return
        fi
    fi
    AUDIO_FORMAT="alsa"
    success "Backend: ALSA (${ALSA_DEVICE})"
}

patch_alsa_device() {
    info "Menyesuaikan audio output di main.go (${AUDIO_FORMAT}:${ALSA_DEVICE})..."
    sed -i "s|\"-f\", \"alsa\", \"default\"|\"-f\", \"${AUDIO_FORMAT}\", \"${ALSA_DEVICE}\"|g" "${BUILD_DIR}/main.go"
    success "Audio output diset ke: -f ${AUDIO_FORMAT} ${ALSA_DEVICE}"
}

build_binary() {
    info "Membangun binary..."
    local required_files=("main.go" "auth.go" "handler.go" "storage.go" "pwa.go" "go.mod")
    for f in "${required_files[@]}"; do
        [ -f "${BUILD_DIR}/${f}" ] || error "${f} tidak ditemukan di ${BUILD_DIR}."
    done
    (
        cd "$BUILD_DIR"
        export PATH="$PATH:/usr/local/go/bin"
        go mod tidy
        CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o "${PROJECT_DIR}/bel-madrasah" .
        if cmd_exists upx; then
            upx --best --lzma "${PROJECT_DIR}/bel-madrasah" && success "Binary dikompres dengan UPX."
        else
            warning "UPX tidak tersedia, binary tidak dikompres."
        fi
    ) || error "Gagal build binary."
    chmod +x "${PROJECT_DIR}/bel-madrasah"
    success "Binary: ${PROJECT_DIR}/bel-madrasah"
}

copy_static() {
    info "Menyalin file static..."
    if [ -d "${BUILD_DIR}/dist" ]; then
        cp -r "${BUILD_DIR}/dist/." "${PROJECT_DIR}/static/"
        success "Static files (dist) disalin."
    elif [ -d "${BUILD_DIR}/static" ]; then
        cp -r "${BUILD_DIR}/static/." "${PROJECT_DIR}/static/"
        success "Static files disalin."
    else
        warning "Tidak ada direktori dist/ maupun static/."
    fi
    mkdir -p "${PROJECT_DIR}/static/icons"
}

generate_pwa_icons() {
    info "Memeriksa ikon PWA..."
    local missing=0
    for s in "${REQUIRED_ICON_SIZES[@]}"; do
        [ ! -f "${PROJECT_DIR}/static/icons/icon-${s}.png" ] && missing=1 && break
    done
    for s in "${REQUIRED_MASKABLE_SIZES[@]}"; do
        [ ! -f "${PROJECT_DIR}/static/icons/icon-maskable-${s}.png" ] && missing=1 && break
    done
    [ "$missing" -eq 0 ] && success "Ikon PWA lengkap." && return
    local src=""
    for c in "${BUILD_DIR}/static/icons/source.png" "${BUILD_DIR}/icon-source.png"; do
        [ -f "$c" ] && src="$c" && break
    done
    if [ -z "$src" ]; then
        warning "Ikon sumber tidak ditemukan, lewati pembuatan ikon PWA."
        return
    fi
    if ! cmd_exists convert; then
        install_package imagemagick || true
    fi
    if ! cmd_exists convert; then
        warning "ImageMagick tidak tersedia, ikon PWA tidak dibuat."
        return
    fi
    info "Membuat ikon PWA dari ${src}..."
    for s in "${REQUIRED_ICON_SIZES[@]}"; do
        convert "$src" -resize "${s}x${s}" "${PROJECT_DIR}/static/icons/icon-${s}.png"
    done
    for s in "${REQUIRED_MASKABLE_SIZES[@]}"; do
        convert "$src" -resize "${s}x${s}" -gravity center -extent "${s}x${s}" \
            "${PROJECT_DIR}/static/icons/icon-maskable-${s}.png"
    done
    success "Ikon PWA dibuat."
}

prompt_tls() {
    echo
    read -rp "Aktifkan HTTPS dengan certbot? [y/N]: " -n 1; echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && return
    read -rp "Domain (contoh: bel.sekolah.sch.id): " DOMAIN
    DOMAIN="${DOMAIN// /}"
    [ -z "$DOMAIN" ] && warning "Domain kosong, HTTPS dilewati." && return
    read -rp "Email untuk Let's Encrypt (boleh kosong): " EMAIL
    EMAIL="${EMAIL// /}"
    warning "Pastikan DNS ${DOMAIN} sudah mengarah ke server ini."
    ENABLE_TLS=1
}

setup_nginx() {
    info "Mengkonfigurasi nginx..."
    cmd_exists nginx || install_package nginx
    local server_name="_"
    [ -n "$DOMAIN" ] && server_name="$DOMAIN"
    local conf="/etc/nginx/sites-available/bel-madrasah"
    local enabled="/etc/nginx/sites-enabled/bel-madrasah"
    cat > "$conf" <<EOF
server {
    listen 80;
    server_name ${server_name};
    client_max_body_size 32M;
    location /static/ {
        proxy_pass         http://127.0.0.1:8082;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        expires            7d;
        add_header         Cache-Control "public, immutable";
    }
    location /sw.js {
        proxy_pass         http://127.0.0.1:8082;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        add_header         Cache-Control "no-cache";
    }
    location / {
        proxy_pass         http://127.0.0.1:8082;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
EOF
    ln -sf "$conf" "$enabled"
    rm -f /etc/nginx/sites-enabled/default
    nginx -t 2>&1 || { nginx -t; error "Konfigurasi nginx tidak valid."; }
    systemctl enable --now nginx
    systemctl reload nginx
    success "nginx dikonfigurasi."
}

setup_tls() {
    [ "$ENABLE_TLS" -ne 1 ] && return
    info "Mengaktifkan HTTPS untuk ${DOMAIN}..."
    if ! cmd_exists certbot; then
        local pm
        pm=$(detect_pkg_manager)
        case "$pm" in
            apt) apt-get install -y certbot python3-certbot-nginx ;;
            dnf|yum) "${pm}" install -y certbot python3-certbot-nginx ;;
            *) warning "Install certbot manual lalu jalankan: certbot --nginx -d ${DOMAIN}"; ENABLE_TLS=0; return ;;
        esac
    fi
    cmd_exists certbot || { warning "certbot tidak tersedia, HTTPS dilewati."; ENABLE_TLS=0; return; }
    local args=(--nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect)
    [ -n "$EMAIL" ] && args+=(-m "$EMAIL") || args+=(--register-unsafely-without-email)
    if certbot "${args[@]}"; then
        success "HTTPS aktif: https://${DOMAIN}"
        systemctl enable --now certbot.timer 2>/dev/null || true
    else
        warning "Gagal mengaktifkan HTTPS, aplikasi tetap berjalan via HTTP."
        ENABLE_TLS=0
    fi
}

create_service_user() {
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd -r -s /sbin/nologin -G audio "$SERVICE_USER"
        success "User ${SERVICE_USER} dibuat."
    else
        usermod -aG audio "$SERVICE_USER" 2>/dev/null || true
        success "User ${SERVICE_USER} sudah ada."
    fi
}

create_service() {
    info "Membuat systemd service..."
    local tls_env=""
    [ "$ENABLE_TLS" -eq 1 ] && tls_env="Environment=BEL_TLS=1"
    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Bel Madrasah Otomatis
After=sound.target network.target
Wants=sound.target

[Service]
Type=simple
ExecStart=${PROJECT_DIR}/bel-madrasah
Restart=on-failure
RestartSec=10
User=${SERVICE_USER}
Group=audio
${tls_env}
StandardOutput=journal
StandardError=journal
WorkingDirectory=${PROJECT_DIR}
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${PROJECT_DIR}/data ${PROJECT_DIR}/tone
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    success "Service terdaftar dan diaktifkan."
}

copy_audio() {
    info "Menyalin file audio..."
    mkdir -p "${PROJECT_DIR}/tone"
    local count=0
    if [ -d "${BUILD_DIR}/tone" ]; then
        for f in "${BUILD_DIR}/tone/"*.mp3 "${BUILD_DIR}/tone/"*.wav "${BUILD_DIR}/tone/"*.ogg; do
            [ -f "$f" ] || continue
            cp "$f" "${PROJECT_DIR}/tone/"
            success "$(basename "$f")"
            ((count++)) || true
        done
    fi
    if [ "$count" -eq 0 ]; then
        warning "Tidak ada file audio. Unduh manual dari:"
        warning "https://github.com/ZEDLABS-TEKNOLOGI-INDONESIA/bel-madrasah/tree/${REPO_BRANCH}/tone"
    else
        info "${count} file audio disalin."
    fi
}

copy_uninstaller() {
    if [ -f "${BUILD_DIR}/uninstall.sh" ]; then
        cp "${BUILD_DIR}/uninstall.sh" "${PROJECT_DIR}/uninstall.sh"
        chmod +x "${PROJECT_DIR}/uninstall.sh"
        success "Uninstaller disalin."
    fi
}

set_permissions() {
    info "Mengatur izin file..."
    chown -R "${SERVICE_USER}:audio" "$PROJECT_DIR"
    chmod 755 "$PROJECT_DIR"
    chmod 750 "${PROJECT_DIR}/data"
    chmod 755 "${PROJECT_DIR}/tone" "${PROJECT_DIR}/static" "${PROJECT_DIR}/static/icons"
    chmod 755 "${PROJECT_DIR}/bel-madrasah"
    find "${PROJECT_DIR}/tone" -type f \( -name "*.mp3" -o -name "*.wav" -o -name "*.ogg" \) -exec chmod 644 {} +
    find "${PROJECT_DIR}/static" -type f -exec chmod 644 {} +
    [ -f "${PROJECT_DIR}/uninstall.sh" ] && chmod 755 "${PROJECT_DIR}/uninstall.sh"
    success "Izin file diatur."
}

verify_installation() {
    info "Memverifikasi instalasi..."
    [ -f "${PROJECT_DIR}/bel-madrasah" ]      && success "Binary ditemukan."      || error "Binary tidak ditemukan."
    [ -f "${PROJECT_DIR}/static/index.html" ] && success "index.html ditemukan." || warning "index.html tidak ditemukan."
    systemctl is-enabled "${SERVICE_NAME}" >/dev/null 2>&1 \
        && success "Service terdaftar di systemd." || error "Service belum diaktifkan."
}

start_service() {
    info "Menjalankan service..."
    if [ "$IS_UPDATE" -eq 1 ] && systemctl is-active --quiet "$SERVICE_NAME"; then
        systemctl restart "$SERVICE_NAME"
    else
        systemctl start "$SERVICE_NAME"
    fi
    sleep 2
    systemctl is-active --quiet "$SERVICE_NAME" && success "Service berjalan." || {
        error "Service gagal berjalan. Cek log: journalctl -u ${SERVICE_NAME} -n 50"
    }
}

cleanup() {
    rm -rf "$BUILD_DIR"
    success "Build directory dihapus."
}

show_summary() {
    local local_ip
    local_ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    local action="INSTALASI"
    [ "$IS_UPDATE" -eq 1 ] && action="UPDATE"
    echo
    echo "========================================="
    success "${action} SELESAI"
    echo "========================================="
    echo
    info "Direktori  : ${PROJECT_DIR}"
    info "Service    : ${SERVICE_NAME}"
    info "User       : ${SERVICE_USER}"
    info "Audio      : -f ${AUDIO_FORMAT} ${ALSA_DEVICE}"
    if [ "$ENABLE_TLS" -eq 1 ]; then
        info "Akses      : https://${DOMAIN}"
    elif [ -n "$local_ip" ]; then
        info "Akses      : http://${local_ip}"
    fi
    if [ "$IS_UPDATE" -eq 0 ]; then
        info "Login      : administrator / P@ssw0rd"
        warning "Segera ganti password setelah login pertama!"
    fi
    echo
    echo "Perintah pengelolaan:"
    echo "  sudo systemctl status  ${SERVICE_NAME}"
    echo "  sudo systemctl stop    ${SERVICE_NAME}"
    echo "  sudo systemctl start   ${SERVICE_NAME}"
    echo "  sudo systemctl restart ${SERVICE_NAME}"
    echo "  sudo journalctl -u ${SERVICE_NAME} -f"
    echo
    [ -f "${PROJECT_DIR}/uninstall.sh" ] && echo "Untuk menghapus: sudo ${PROJECT_DIR}/uninstall.sh"
    echo
}

main() {
    echo "========================================="
    echo " Bel Madrasah - Installer"
    echo " ZEDLABS Teknologi Indonesia"
    echo "========================================="
    echo
    read -rp "Lanjutkan instalasi? [y/N]: " -n 1; echo
    [[ $REPLY =~ ^[Yy]$ ]] || { info "Instalasi dibatalkan."; exit 0; }
    echo
    check_requirements
    install_tools
    detect_alsa_device
    detect_audio_backend
    clone_repo
    install_node
    install_pnpm
    build_frontend
    prepare_dirs
    patch_alsa_device
    build_binary
    copy_static
    generate_pwa_icons
    prompt_tls
    setup_nginx
    setup_tls
    create_service_user
    create_service
    copy_audio
    copy_uninstaller
    set_permissions
    verify_installation
    start_service
    cleanup
    show_summary
}

main "$@"
