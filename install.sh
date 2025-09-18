#!/bin/bash

# =======================================================
# Installer Bell System Madrasah Tsanawiyah Negeri 1 Pandeglang
# =======================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$HOME/bel-madrasah"
SERVICE_NAME="bel-madrasah"
SERVICE_FILE="$HOME/.config/systemd/user/$SERVICE_NAME.service"
PYTHON_CMD="/usr/bin/python3"
CURRENT_USER=$(whoami)

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check requirements
check_requirements() {
    print_status "Memeriksa persyaratan sistem..."
    
    # Check Python3
    if ! command_exists python3; then
        print_error "Python3 tidak ditemukan. Silakan install Python3 terlebih dahulu."
        exit 1
    fi
    print_success "Python3 ditemukan: $(python3 --version)"
    
    # Check systemctl
    if ! command_exists systemctl; then
        print_error "systemctl tidak ditemukan. Sistem ini memerlukan systemd."
        exit 1
    fi
    print_success "systemctl ditemukan"
    
    # Check if running as root
    if [ "$EUID" -eq 0 ]; then
        print_error "Jangan jalankan installer ini sebagai root!"
        print_warning "Gunakan user biasa, bukan sudo."
        exit 1
    fi
    
    print_success "Persyaratan sistem terpenuhi"
}

# Function to install ffmpeg
install_ffmpeg() {
    print_status "Memeriksa ffmpeg..."
    
    if command_exists ffplay; then
        print_success "ffmpeg sudah terinstall"
        return 0
    fi
    
    print_warning "ffmpeg belum terinstall. Mencoba menginstall..."
    
    # Detect package manager and install
    if command_exists apt; then
        print_status "Menggunakan apt untuk install ffmpeg..."
        sudo apt update && sudo apt install -y ffmpeg
    elif command_exists yum; then
        print_status "Menggunakan yum untuk install ffmpeg..."
        sudo yum install -y ffmpeg
    elif command_exists dnf; then
        print_status "Menggunakan dnf untuk install ffmpeg..."
        sudo dnf install -y ffmpeg
    elif command_exists pacman; then
        print_status "Menggunakan pacman untuk install ffmpeg..."
        sudo pacman -S --noconfirm ffmpeg
    else
        print_error "Package manager tidak dikenali. Silakan install ffmpeg secara manual."
        exit 1
    fi
    
    # Verify installation
    if command_exists ffplay; then
        print_success "ffmpeg berhasil diinstall"
    else
        print_error "Gagal menginstall ffmpeg"
        exit 1
    fi
}

# Function to create project directory
create_project_dir() {
    print_status "Membuat direktori proyek..."
    
    if [ -d "$PROJECT_DIR" ]; then
        print_warning "Direktori $PROJECT_DIR sudah ada"
        read -p "Apakah Anda ingin melanjutkan dan menimpa file yang ada? [y/N]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Instalasi dibatalkan oleh user"
            exit 1
        fi
    fi
    
    mkdir -p "$PROJECT_DIR"
    mkdir -p "$PROJECT_DIR/tone"
    print_success "Direktori proyek dibuat: $PROJECT_DIR"
}

# Function to create main.py
create_main_py() {
    print_status "Membuat file main.py..."
    
    cat > "$PROJECT_DIR/main.py" << 'EOF'
import time
import subprocess
import os
from datetime import datetime
from jadwal import JADWAL

def expand_path(path):
    return os.path.expanduser(path)

def play_sound(file_path):
    full_path = expand_path(file_path)
    subprocess.Popen([
        "/usr/bin/ffplay", "-nodisp", "-volume", "85", "-autoexit", full_path
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def get_hari():
    hari_map = {
        0: "Senin", 1: "Selasa", 2: "Rabu", 3: "Kamis", 4: "Jumat"
    }
    return hari_map.get(datetime.today().weekday(), None)

def main():
    sudah_diputar = set()
    
    while True:
        now = datetime.now()
        hari = get_hari()
        
        if hari in JADWAL:
            for jadwal_waktu, file_audio in JADWAL[hari]:
                jam, menit = map(int, jadwal_waktu.split(":"))
                
                if now.hour == jam and now.minute == menit:
                    key = f"{hari}-{jadwal_waktu}"
                    if key not in sudah_diputar:
                        print(f"Memutar: {file_audio} pada {now.strftime('%Y-%m-%d %H:%M:%S')}")
                        play_sound(file_audio)
                        sudah_diputar.add(key)
        
        # Reset cache setiap hari baru
        if now.hour == 0 and now.minute == 0:
            sudah_diputar.clear()
            print(f"Cache direset pada {now.strftime('%Y-%m-%d %H:%M:%S')}")
        
        time.sleep(30)

if __name__ == "__main__":
    main()
EOF
    
    chmod +x "$PROJECT_DIR/main.py"
    print_success "File main.py dibuat"
}

# Function to create jadwal.py
create_jadwal_py() {
    print_status "Membuat file jadwal.py..."
    
    cat > "$PROJECT_DIR/jadwal.py" << 'EOF'
JADWAL = {
    "Senin": [
        ("06:40", "~/bel-madrasah/tone/sholawat.mp3"),
        ("07:00", "~/bel-madrasah/tone/hymne.mp3"),
        ("07:15", "~/bel-madrasah/tone/upacara.mp3"),
        ("08:10", "~/bel-madrasah/tone/p2.mp3"),
        ("08:50", "~/bel-madrasah/tone/p3.mp3"),
        ("09:30", "~/bel-madrasah/tone/p4.mp3"),
        ("10:00", "~/bel-madrasah/tone/indonesia-raya.mp3"),
        ("10:10", "~/bel-madrasah/tone/i1.mp3"),
        ("10:20", "~/bel-madrasah/tone/kebersihan.mp3"),
        ("10:30", "~/bel-madrasah/tone/p5.mp3"),
        ("11:10", "~/bel-madrasah/tone/p6.mp3"),
        ("11:50", "~/bel-madrasah/tone/i2.mp3"),
        ("12:40", "~/bel-madrasah/tone/p7.mp3"),
        ("13:20", "~/bel-madrasah/tone/p8.mp3"),
        ("14:00", "~/bel-madrasah/tone/p9.mp3"),
        ("14:40", "~/bel-madrasah/tone/p10.mp3"),
        ("15:20", "~/bel-madrasah/tone/s.mp3"),
        ("16:30", "~/bel-madrasah/tone/hymne.mp3")
    ],
    "Selasa": [
        ("06:40", "~/bel-madrasah/tone/sholawat.mp3"),
        ("07:00", "~/bel-madrasah/tone/hymne.mp3"),
        ("07:30", "~/bel-madrasah/tone/p1.mp3"),
        ("08:10", "~/bel-madrasah/tone/p2.mp3"),
        ("08:50", "~/bel-madrasah/tone/p3.mp3"),
        ("09:30", "~/bel-madrasah/tone/p4.mp3"),
        ("10:10", "~/bel-madrasah/tone/i1.mp3"),
        ("10:20", "~/bel-madrasah/tone/kebersihan.mp3"),
        ("10:30", "~/bel-madrasah/tone/p5.mp3"),
        ("11:10", "~/bel-madrasah/tone/p6.mp3"),
        ("11:50", "~/bel-madrasah/tone/i2.mp3"),
        ("12:40", "~/bel-madrasah/tone/p7.mp3"),
        ("13:20", "~/bel-madrasah/tone/p8.mp3"),
        ("14:00", "~/bel-madrasah/tone/p9.mp3"),
        ("14:40", "~/bel-madrasah/tone/p10.mp3"),
        ("15:20", "~/bel-madrasah/tone/s.mp3"),
        ("16:30", "~/bel-madrasah/tone/hymne.mp3")
    ],
    "Rabu": [
        ("06:40", "~/bel-madrasah/tone/sholawat.mp3"),
        ("07:00", "~/bel-madrasah/tone/hymne.mp3"),
        ("07:30", "~/bel-madrasah/tone/p1.mp3"),
        ("08:10", "~/bel-madrasah/tone/p2.mp3"),
        ("08:50", "~/bel-madrasah/tone/p3.mp3"),
        ("09:30", "~/bel-madrasah/tone/p4.mp3"),
        ("10:10", "~/bel-madrasah/tone/i1.mp3"),
        ("10:20", "~/bel-madrasah/tone/kebersihan.mp3"),
        ("10:30", "~/bel-madrasah/tone/p5.mp3"),
        ("11:10", "~/bel-madrasah/tone/p6.mp3"),
        ("11:50", "~/bel-madrasah/tone/i2.mp3"),
        ("12:40", "~/bel-madrasah/tone/p7.mp3"),
        ("13:20", "~/bel-madrasah/tone/p8.mp3"),
        ("14:00", "~/bel-madrasah/tone/p9.mp3"),
        ("14:40", "~/bel-madrasah/tone/p10.mp3"),
        ("15:20", "~/bel-madrasah/tone/s.mp3"),
        ("16:30", "~/bel-madrasah/tone/hymne.mp3")
    ],
    "Kamis": [
        ("06:40", "~/bel-madrasah/tone/sholawat.mp3"),
        ("07:00", "~/bel-madrasah/tone/hymne.mp3"),
        ("07:15", "~/bel-madrasah/tone/literasi.mp3"),
        ("08:10", "~/bel-madrasah/tone/p2.mp3"),
        ("08:50", "~/bel-madrasah/tone/p3.mp3"),
        ("09:30", "~/bel-madrasah/tone/p4.mp3"),
        ("10:00", "~/bel-madrasah/tone/indonesia-raya.mp3"),
        ("10:10", "~/bel-madrasah/tone/i1.mp3"),
        ("10:20", "~/bel-madrasah/tone/kebersihan.mp3"),
        ("10:30", "~/bel-madrasah/tone/p5.mp3"),
        ("11:10", "~/bel-madrasah/tone/p6.mp3"),
        ("11:50", "~/bel-madrasah/tone/i2.mp3"),
        ("12:40", "~/bel-madrasah/tone/p7.mp3"),
        ("13:20", "~/bel-madrasah/tone/p8.mp3"),
        ("14:00", "~/bel-madrasah/tone/p9.mp3"),
        ("14:40", "~/bel-madrasah/tone/p10.mp3"),
        ("15:20", "~/bel-madrasah/tone/s.mp3"),
        ("16:30", "~/bel-madrasah/tone/hymne.mp3")
    ],
    "Jumat": [
        ("06:40", "~/bel-madrasah/tone/sholawat.mp3"),
        ("07:00", "~/bel-madrasah/tone/hymne.mp3"),
        ("07:15", "~/bel-madrasah/tone/rohani.mp3"),
        ("07:50", "~/bel-madrasah/tone/p2.mp3"),
        ("08:30", "~/bel-madrasah/tone/p3.mp3"),
        ("09:10", "~/bel-madrasah/tone/p4.mp3"),
        ("09:50", "~/bel-madrasah/tone/i1.mp3"),
        ("10:00", "~/bel-madrasah/tone/kebersihan.mp3"),
        ("10:10", "~/bel-madrasah/tone/p5.mp3"),
        ("10:50", "~/bel-madrasah/tone/p6.mp3"),
        ("11:30", "~/bel-madrasah/tone/i2.mp3"),
        ("12:50", "~/bel-madrasah/tone/p7.mp3"),
        ("13:30", "~/bel-madrasah/tone/p8.mp3"),
        ("14:10", "~/bel-madrasah/tone/p9.mp3"),
        ("14:50", "~/bel-madrasah/tone/ap.mp3"),
        ("14:51", "~/bel-madrasah/tone/pramuka.mp3"),
        ("16:30", "~/bel-madrasah/tone/hymne.mp3")
    ],
}
EOF
    
    print_success "File jadwal.py dibuat"
}

# Function to create systemd service
create_systemd_service() {
    print_status "Membuat systemd service..."
    
    # Create systemd user directory
    mkdir -p "$HOME/.config/systemd/user"
    
    # Create service file
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Bel Madrasah Otomatis
After=default.target

[Service]
ExecStart=$PYTHON_CMD $PROJECT_DIR/main.py
Restart=always
RestartSec=10
Environment=XDG_RUNTIME_DIR=/run/user/$UID
Environment=DISPLAY=:0
StandardOutput=journal
StandardError=journal
WorkingDirectory=$PROJECT_DIR

[Install]
WantedBy=default.target
EOF
    
    print_success "File service dibuat: $SERVICE_FILE"
}

# Function to setup service
setup_service() {
    print_status "Mengkonfigurasi systemd service..."
    
    # Reload systemd
    systemctl --user daemon-reload
    
    # Enable service
    if systemctl --user enable "$SERVICE_NAME.service"; then
        print_success "Service berhasil di-enable"
    else
        print_error "Gagal enable service"
        exit 1
    fi
    
    # Enable lingering for user
    print_status "Mengaktifkan user lingering..."
    if sudo loginctl enable-linger "$CURRENT_USER"; then
        print_success "User lingering diaktifkan"
    else
        print_warning "Gagal mengaktifkan user lingering (mungkin sudah aktif)"
    fi
}

# Function to create audio file list
create_audio_list() {
    print_status "Membuat daftar file audio yang diperlukan..."
    
    cat > "$PROJECT_DIR/audio-list.txt" << 'EOF'
Daftar file audio yang diperlukan di ~/bel-madrasah/tone/:

1. sholawat.mp3     - Audio sholawat pembuka
2. hymne.mp3        - Hymne madrasah
3. indonesia-raya.mp3 - Lagu Indonesia Raya
4. upacara.mp3      - Audio upacara bendera
5. literasi.mp3     - Audio literasi
6. rohani.mp3       - Audio kerohanian
7. kebersihan.mp3   - Audio kegiatan kebersihan
8. pramuka.mp3      - Audio pramuka
9. p1.mp3           - Periode 1
10. p2.mp3          - Periode 2
11. p3.mp3          - Periode 3
12. p4.mp3          - Periode 4
13. p5.mp3          - Periode 5
14. p6.mp3          - Periode 6
15. p7.mp3          - Periode 7
16. p8.mp3          - Periode 8
17. p9.mp3          - Periode 9
18. p10.mp3         - Periode 10
19. i1.mp3          - Istirahat 1
20. i2.mp3          - Istirahat 2
21. s.mp3           - Selesai
22. ap.mp3          - Akhir pembelajaran

Pastikan semua file audio ini ada sebelum menjalankan sistem!
EOF
    
    print_success "Daftar file audio dibuat: $PROJECT_DIR/audio-list.txt"
}

# Function to test installation
test_installation() {
    print_status "Melakukan test instalasi..."
    
    # Test Python import
    if cd "$PROJECT_DIR" && python3 -c "from jadwal import JADWAL; print('Import berhasil')"; then
        print_success "Import Python berhasil"
    else
        print_error "Import Python gagal"
        exit 1
    fi
    
    # Test service status
    if systemctl --user is-enabled "$SERVICE_NAME.service" >/dev/null 2>&1; then
        print_success "Service sudah di-enable"
    else
        print_error "Service belum di-enable"
        exit 1
    fi
    
    print_success "Test instalasi berhasil"
}

# Function to start service
start_service() {
    print_status "Memulai service..."
    
    if systemctl --user start "$SERVICE_NAME.service"; then
        print_success "Service berhasil dijalankan"
        
        # Show status
        sleep 2
        systemctl --user status "$SERVICE_NAME.service" --no-pager -l
    else
        print_error "Gagal menjalankan service"
        exit 1
    fi
}

# Function to show completion message
show_completion() {
    echo
    echo "========================================="
    print_success "INSTALASI BERHASIL DISELESAIKAN!"
    echo "========================================="
    echo
    print_status "Lokasi instalasi: $PROJECT_DIR"
    print_status "Service name: $SERVICE_NAME"
    print_status "Status service:"
    systemctl --user is-active "$SERVICE_NAME.service" --quiet && echo -e "  ${GREEN}● AKTIF${NC}" || echo -e "  ${RED}● TIDAK AKTIF${NC}"
    echo
    print_warning "PENTING: Pastikan file audio sudah ada di $PROJECT_DIR/tone/"
    print_status "Lihat daftar file audio di: $PROJECT_DIR/audio-list.txt"
    echo
    echo "Commands berguna:"
    echo "  - Cek status   : systemctl --user status $SERVICE_NAME"
    echo "  - Stop service : systemctl --user stop $SERVICE_NAME"
    echo "  - Start service: systemctl --user start $SERVICE_NAME"
    echo "  - Lihat log    : journalctl --user -u $SERVICE_NAME -f"
    echo "  - Edit jadwal  : nano $PROJECT_DIR/jadwal.py"
    echo
    print_success "Sistem bel madrasah siap digunakan!"
}

# Main installation process
main() {
    echo "========================================="
    echo "Bell System Madrasah Installer"
    echo "Madrasah Tsanawiyah Negeri 1 Pandeglang"
    echo "========================================="
    echo
    
    # Confirmation
    read -p "Apakah Anda ingin melanjutkan instalasi? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Instalasi dibatalkan"
        exit 1
    fi
    
    echo
    print_status "Memulai instalasi..."
    
    check_requirements
    install_ffmpeg
    create_project_dir
    create_main_py
    create_jadwal_py
    create_systemd_service
    setup_service
    create_audio_list
    test_installation
    start_service
    show_completion
}

# Run main function
main "$@"
