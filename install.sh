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

create_main_py() {
    info "Membuat main.py..."

    cat > "$PROJECT_DIR/main.py" << 'PYEOF'
import time
import subprocess
import os
import sys
from datetime import datetime
from jadwal import JADWAL

VOLUME = "0.85"
FFMPEG_BIN = "/usr/bin/ffmpeg"

active_processes = []


def expand_path(path):
    return os.path.expanduser(path)


def cleanup_processes():
    global active_processes
    active_processes = [p for p in active_processes if p.poll() is None]


def play_sound(file_path):
    full_path = expand_path(file_path)

    if not os.path.isfile(full_path):
        log(f"File tidak ditemukan: {full_path}")
        return

    cleanup_processes()

    proc = subprocess.Popen(
        [
            FFMPEG_BIN,
            "-hide_banner",
            "-loglevel", "error",
            "-i", full_path,
            "-filter:a", f"volume={VOLUME}",
            "-f", "alsa",
            "default"
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    active_processes.append(proc)


def get_hari():
    hari_map = {
        0: "Senin",
        1: "Selasa",
        2: "Rabu",
        3: "Kamis",
        4: "Jumat"
    }
    return hari_map.get(datetime.today().weekday(), None)


def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}", flush=True)


def main():
    if not os.path.isfile(FFMPEG_BIN):
        log(f"ffmpeg tidak ditemukan di {FFMPEG_BIN}. Pastikan ffmpeg terinstall.")
        sys.exit(1)

    log("Sistem bel madrasah dimulai.")

    sudah_diputar = set()
    hari_sekarang = None

    while True:
        now = datetime.now()
        hari = get_hari()

        if hari != hari_sekarang:
            if hari_sekarang is not None:
                sudah_diputar.clear()
                log("Cache jadwal direset untuk hari baru.")
            hari_sekarang = hari

        if hari and hari in JADWAL:
            waktu_sekarang = now.strftime("%H:%M")

            for jadwal_waktu, file_audio in JADWAL[hari]:
                key = f"{hari}-{jadwal_waktu}"

                if waktu_sekarang == jadwal_waktu and key not in sudah_diputar:
                    log(f"Memutar: {os.path.basename(file_audio)} [{jadwal_waktu}]")
                    play_sound(file_audio)
                    sudah_diputar.add(key)

        time.sleep(20)


if __name__ == "__main__":
    main()
PYEOF

    chmod +x "$PROJECT_DIR/main.py"
    success "main.py dibuat."
}

create_jadwal_py() {
    info "Membuat jadwal.py..."

    cat > "$PROJECT_DIR/jadwal.py" << 'PYEOF'
BASE = "/opt/bel-madrasah/tone"

JADWAL = {
    "Senin": [
        ("06:50", f"{BASE}/mars-madrasah.mp3"),
        ("07:00", f"{BASE}/upacara.mp3"),
        ("08:10", f"{BASE}/pelajaran-2.mp3"),
        ("08:50", f"{BASE}/pelajaran-3.mp3"),
        ("09:30", f"{BASE}/pelajaran-4.mp3"),
        ("10:00", f"{BASE}/indonesia-raya.mp3"),
        ("10:10", f"{BASE}/istirahat-1.mp3"),
        ("10:20", f"{BASE}/kebersihan.mp3"),
        ("10:30", f"{BASE}/pelajaran-5.mp3"),
        ("11:10", f"{BASE}/pelajaran-6.mp3"),
        ("11:50", f"{BASE}/istirahat-2.mp3"),
        ("12:30", f"{BASE}/kebersihan.mp3"),
        ("12:40", f"{BASE}/pelajaran-7.mp3"),
        ("13:20", f"{BASE}/pelajaran-8.mp3"),
        ("14:00", f"{BASE}/pelajaran-9.mp3"),
        ("14:40", f"{BASE}/pelajaran-10.mp3"),
        ("15:20", f"{BASE}/pelajaran-selesai.mp3"),
        ("15:21", f"{BASE}/tanah-airku.mp3"),
        ("16:30", f"{BASE}/hymne-madrasah.mp3"),
    ],
    "Selasa": [
        ("06:50", f"{BASE}/mars-madrasah.mp3"),
        ("07:30", f"{BASE}/pelajaran-1.mp3"),
        ("08:10", f"{BASE}/pelajaran-2.mp3"),
        ("08:50", f"{BASE}/pelajaran-3.mp3"),
        ("09:30", f"{BASE}/pelajaran-4.mp3"),
        ("10:10", f"{BASE}/istirahat-1.mp3"),
        ("10:20", f"{BASE}/kebersihan.mp3"),
        ("10:30", f"{BASE}/pelajaran-5.mp3"),
        ("11:10", f"{BASE}/pelajaran-6.mp3"),
        ("11:50", f"{BASE}/istirahat-2.mp3"),
        ("12:30", f"{BASE}/kebersihan.mp3"),
        ("12:40", f"{BASE}/pelajaran-7.mp3"),
        ("13:20", f"{BASE}/pelajaran-8.mp3"),
        ("14:00", f"{BASE}/pelajaran-9.mp3"),
        ("14:40", f"{BASE}/pelajaran-10.mp3"),
        ("15:20", f"{BASE}/pelajaran-selesai.mp3"),
        ("15:21", f"{BASE}/tanah-airku.mp3"),
        ("16:30", f"{BASE}/hymne-madrasah.mp3"),
    ],
    "Rabu": [
        ("06:50", f"{BASE}/mars-madrasah.mp3"),
        ("07:30", f"{BASE}/pelajaran-1.mp3"),
        ("08:10", f"{BASE}/pelajaran-2.mp3"),
        ("08:50", f"{BASE}/pelajaran-3.mp3"),
        ("09:30", f"{BASE}/pelajaran-4.mp3"),
        ("10:10", f"{BASE}/istirahat-1.mp3"),
        ("10:20", f"{BASE}/kebersihan.mp3"),
        ("10:30", f"{BASE}/pelajaran-5.mp3"),
        ("11:10", f"{BASE}/pelajaran-6.mp3"),
        ("11:50", f"{BASE}/istirahat-2.mp3"),
        ("12:30", f"{BASE}/kebersihan.mp3"),
        ("12:40", f"{BASE}/pelajaran-7.mp3"),
        ("13:20", f"{BASE}/pelajaran-8.mp3"),
        ("14:00", f"{BASE}/pelajaran-9.mp3"),
        ("14:40", f"{BASE}/pelajaran-10.mp3"),
        ("15:20", f"{BASE}/pelajaran-selesai.mp3"),
        ("15:21", f"{BASE}/tanah-airku.mp3"),
        ("16:30", f"{BASE}/hymne-madrasah.mp3"),
    ],
    "Kamis": [
        ("06:50", f"{BASE}/mars-madrasah.mp3"),
        ("07:00", f"{BASE}/literasi.mp3"),
        ("08:10", f"{BASE}/pelajaran-2.mp3"),
        ("08:50", f"{BASE}/pelajaran-3.mp3"),
        ("09:30", f"{BASE}/pelajaran-4.mp3"),
        ("10:00", f"{BASE}/indonesia-raya.mp3"),
        ("10:10", f"{BASE}/istirahat-1.mp3"),
        ("10:20", f"{BASE}/kebersihan.mp3"),
        ("10:30", f"{BASE}/pelajaran-5.mp3"),
        ("11:10", f"{BASE}/pelajaran-6.mp3"),
        ("11:50", f"{BASE}/istirahat-2.mp3"),
        ("12:30", f"{BASE}/kebersihan.mp3"),
        ("12:40", f"{BASE}/pelajaran-7.mp3"),
        ("13:20", f"{BASE}/pelajaran-8.mp3"),
        ("14:00", f"{BASE}/pelajaran-9.mp3"),
        ("14:40", f"{BASE}/pelajaran-10.mp3"),
        ("15:20", f"{BASE}/pelajaran-selesai.mp3"),
        ("15:21", f"{BASE}/tanah-airku.mp3"),
        ("16:30", f"{BASE}/hymne-madrasah.mp3"),
    ],
    "Jumat": [
        ("06:50", f"{BASE}/mars-madrasah.mp3"),
        ("07:00", f"{BASE}/rohani.mp3"),
        ("08:10", f"{BASE}/pelajaran-3.mp3"),
        ("08:50", f"{BASE}/pelajaran-4.mp3"),
        ("09:30", f"{BASE}/istirahat-1.mp3"),
        ("09:40", f"{BASE}/kebersihan.mp3"),
        ("10:10", f"{BASE}/pelajaran-5.mp3"),
        ("10:40", f"{BASE}/pelajaran-6.mp3"),
        ("11:20", f"{BASE}/istirahat-2.mp3"),
        ("12:50", f"{BASE}/pelajaran-7.mp3"),
        ("13:30", f"{BASE}/pelajaran-8.mp3"),
        ("14:10", f"{BASE}/akhir-pekan.mp3"),
        ("14:11", f"{BASE}/tanah-airku.mp3"),
        ("14:12", f"{BASE}/pramuka.mp3"),
        ("16:00", f"{BASE}/hymne-madrasah.mp3"),
    ],
}
PYEOF

    success "jadwal.py dibuat."
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
    chmod -R 755 "$PROJECT_DIR"
    chmod 644 "$PROJECT_DIR"/*.py
    chmod -R 644 "$PROJECT_DIR/tone/"
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
    create_main_py
    create_jadwal_py
    create_systemd_service
    setup_service
    download_tone
    set_permissions
    test_installation
    start_service
    show_completion
}

main "$@"
