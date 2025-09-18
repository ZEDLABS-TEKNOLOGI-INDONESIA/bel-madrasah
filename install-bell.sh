#!/bin/bash

# School Bell Service Installer
# Script untuk menginstall sistem bel sekolah otomatis

echo "======================================"
echo "School Bell Service Installer"
echo "======================================"
echo

# Cek apakah script dijalankan sebagai root atau dengan sudo
if [[ $EUID -ne 0 ]]; then
   echo "Script ini harus dijalankan sebagai root atau dengan sudo"
   echo "Gunakan: sudo $0"
   exit 1
fi

# Cek apakah ffplay tersedia
if ! command -v ffplay &> /dev/null; then
    echo "ERROR: ffplay tidak ditemukan!"
    echo "Install terlebih dahulu dengan:"
    echo "sudo apt update && sudo apt install ffmpeg"
    exit 1
fi

echo "✓ ffplay ditemukan di $(which ffplay)"

# Buat direktori untuk script
SCRIPT_DIR="/usr/local/bin"
SCRIPT_FILE="$SCRIPT_DIR/school-bell.sh"
LOG_DIR="/var/log"
LOG_FILE="$LOG_DIR/school-bell.log"

echo "Installing school bell script..."

# Buat script utama
cat > "$SCRIPT_FILE" << 'EOF'
#!/bin/bash

# School Bell Service Script
# Sistem Bel Sekolah Otomatis

# Base directory untuk file audio
AUDIO_DIR="$HOME/bel-sekolah/tone"
FFPLAY="/usr/bin/ffplay"

# Function untuk memainkan audio
play_audio() {
    local audio_file="$1"
    local description="$2"
    
    # Log aktivitas
    echo "$(date): Playing $description - $audio_file" >> /var/log/school-bell.log
    
    # Cek apakah file audio ada
    if [ -f "$audio_file" ]; then
        # Jalankan ffplay dengan parameter yang diminta
        $FFPLAY -nodisp -volume 100 -autoexit "$audio_file" 2>/dev/null
        echo "$(date): Successfully played $description" >> /var/log/school-bell.log
    else
        echo "$(date): ERROR - Audio file not found: $audio_file" >> /var/log/school-bell.log
    fi
}

# Function untuk mendapatkan hari dalam bahasa Indonesia
get_day() {
    case $(date +%u) in
        1) echo "senin" ;;
        2) echo "selasa" ;;
        3) echo "rabu" ;;
        4) echo "kamis" ;;
        5) echo "jumat" ;;
        6) echo "sabtu" ;;
        7) echo "minggu" ;;
    esac
}

# Main function
main() {
    local bell_type="$1"
    local day=$(get_day)
    
    case "$bell_type" in
        "sholawat")
            play_audio "$AUDIO_DIR/sholawat.mp3" "Bel Sholawat"
            ;;
        "masuk")
            play_audio "$AUDIO_DIR/hymne.mp3" "Bel Masuk"
            ;;
        "upacara")
            play_audio "$AUDIO_DIR/upacara.mp3" "Bel Upacara"
            ;;
        "literasi")
            play_audio "$AUDIO_DIR/literasi.mp3" "Bel Literasi"
            ;;
        "rohani")
            play_audio "$AUDIO_DIR/rohani.mp3" "Bel Rohani"
            ;;
        "p1")
            play_audio "$AUDIO_DIR/p1.mp3" "Bel Jam Pelajaran Ke 1"
            ;;
        "p2")
            play_audio "$AUDIO_DIR/p2.mp3" "Bel Jam Pelajaran Ke 2"
            ;;
        "p3")
            play_audio "$AUDIO_DIR/p3.mp3" "Bel Jam Pelajaran Ke 3"
            ;;
        "p4")
            play_audio "$AUDIO_DIR/p4.mp3" "Bel Jam Pelajaran Ke 4"
            ;;
        "p5")
            play_audio "$AUDIO_DIR/p5.mp3" "Bel Jam Pelajaran Ke 5"
            ;;
        "p6")
            play_audio "$AUDIO_DIR/p6.mp3" "Bel Jam Pelajaran Ke 6"
            ;;
        "p7")
            play_audio "$AUDIO_DIR/p7.mp3" "Bel Jam Pelajaran Ke 7"
            ;;
        "p8")
            play_audio "$AUDIO_DIR/p8.mp3" "Bel Jam Pelajaran Ke 8"
            ;;
        "p9")
            play_audio "$AUDIO_DIR/p9.mp3" "Bel Jam Pelajaran Ke 9"
            ;;
        "p10")
            play_audio "$AUDIO_DIR/p10.mp3" "Bel Jam Pelajaran Ke 10"
            ;;
        "indonesia-raya")
            play_audio "$AUDIO_DIR/indonesia-raya.mp3" "Bel Indonesia Raya"
            ;;
        "i1")
            play_audio "$AUDIO_DIR/i1.mp3" "Bel Jam Istirahat Ke 1"
            ;;
        "i2")
            play_audio "$AUDIO_DIR/i2.mp3" "Bel Jam Istirahat Ke 2"
            ;;
        "kebersihan")
            play_audio "$AUDIO_DIR/kebersihan.mp3" "Bel Kebersihan"
            ;;
        "pulang")
            play_audio "$AUDIO_DIR/s.mp3" "Bel Terakhir/Pulang"
            ;;
        "ap")
            play_audio "$AUDIO_DIR/ap.mp3" "Bel Terakhir/Pulang (Jumat)"
            ;;
        "pramuka")
            play_audio "$AUDIO_DIR/pramuka.mp3" "Bel Pramuka"
            ;;
        "hymne")
            play_audio "$AUDIO_DIR/hymne.mp3" "Bel Hymne"
            ;;
        *)
            echo "$(date): ERROR - Unknown bell type: $bell_type" >> /var/log/school-bell.log
            ;;
    esac
}

# Jalankan function main dengan parameter yang diberikan
main "$1"
EOF

# Buat script executable
chmod +x "$SCRIPT_FILE"
echo "✓ Script installed to $SCRIPT_FILE"

# Buat file log
touch "$LOG_FILE"
chmod 666 "$LOG_FILE"
echo "✓ Log file created at $LOG_FILE"

# Buat direktori audio jika belum ada
AUDIO_USER=$(logname 2>/dev/null || echo $SUDO_USER)
if [ -n "$AUDIO_USER" ]; then
    AUDIO_HOME=$(eval echo ~$AUDIO_USER)
    AUDIO_PATH="$AUDIO_HOME/bel-sekolah/tone"
    
    sudo -u $AUDIO_USER mkdir -p "$AUDIO_PATH"
    echo "✓ Audio directory created at $AUDIO_PATH"
    echo "  Silakan copy file audio ke direktori tersebut"
else
    echo "⚠ Buat direktori ~/bel-sekolah/tone/ dan copy file audio ke sana"
fi

echo
echo "======================================"
echo "Setup Crontab"
echo "======================================"

# Buat temporary crontab file
TEMP_CRON="/tmp/school-bell-cron"

cat > "$TEMP_CRON" << 'EOF'
# School Bell Crontab Schedule
# Format: minute hour day-of-month month day-of-week command
# day-of-week: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday

# ==================== HARI SENIN (Monday = 1) ====================
40 6 * * 1 /usr/local/bin/school-bell.sh sholawat
0 7 * * 1 /usr/local/bin/school-bell.sh masuk
15 7 * * 1 /usr/local/bin/school-bell.sh upacara
10 8 * * 1 /usr/local/bin/school-bell.sh p2
50 8 * * 1 /usr/local/bin/school-bell.sh p3
30 9 * * 1 /usr/local/bin/school-bell.sh p4
0 10 * * 1 /usr/local/bin/school-bell.sh indonesia-raya
10 10 * * 1 /usr/local/bin/school-bell.sh i1
20 10 * * 1 /usr/local/bin/school-bell.sh kebersihan
30 10 * * 1 /usr/local/bin/school-bell.sh p5
10 11 * * 1 /usr/local/bin/school-bell.sh p6
50 11 * * 1 /usr/local/bin/school-bell.sh i2
40 12 * * 1 /usr/local/bin/school-bell.sh p7
20 13 * * 1 /usr/local/bin/school-bell.sh p8
0 14 * * 1 /usr/local/bin/school-bell.sh p9
40 14 * * 1 /usr/local/bin/school-bell.sh p10
20 15 * * 1 /usr/local/bin/school-bell.sh pulang
30 16 * * 1 /usr/local/bin/school-bell.sh hymne

# ==================== HARI SELASA (Tuesday = 2) ====================
40 6 * * 2 /usr/local/bin/school-bell.sh sholawat
0 7 * * 2 /usr/local/bin/school-bell.sh masuk
30 7 * * 2 /usr/local/bin/school-bell.sh p1
10 8 * * 2 /usr/local/bin/school-bell.sh p2
50 8 * * 2 /usr/local/bin/school-bell.sh p3
30 9 * * 2 /usr/local/bin/school-bell.sh p4
10 10 * * 2 /usr/local/bin/school-bell.sh i1
20 10 * * 2 /usr/local/bin/school-bell.sh kebersihan
30 10 * * 2 /usr/local/bin/school-bell.sh p5
10 11 * * 2 /usr/local/bin/school-bell.sh p6
50 11 * * 2 /usr/local/bin/school-bell.sh i2
40 12 * * 2 /usr/local/bin/school-bell.sh p7
20 13 * * 2 /usr/local/bin/school-bell.sh p8
0 14 * * 2 /usr/local/bin/school-bell.sh p9
40 14 * * 2 /usr/local/bin/school-bell.sh p10
20 15 * * 2 /usr/local/bin/school-bell.sh pulang
30 16 * * 2 /usr/local/bin/school-bell.sh hymne

# ==================== HARI RABU (Wednesday = 3) ====================
40 6 * * 3 /usr/local/bin/school-bell.sh sholawat
0 7 * * 3 /usr/local/bin/school-bell.sh masuk
30 7 * * 3 /usr/local/bin/school-bell.sh p1
10 8 * * 3 /usr/local/bin/school-bell.sh p2
50 8 * * 3 /usr/local/bin/school-bell.sh p3
30 9 * * 3 /usr/local/bin/school-bell.sh p4
10 10 * * 3 /usr/local/bin/school-bell.sh i1
20 10 * * 3 /usr/local/bin/school-bell.sh kebersihan
30 10 * * 3 /usr/local/bin/school-bell.sh p5
10 11 * * 3 /usr/local/bin/school-bell.sh p6
50 11 * * 3 /usr/local/bin/school-bell.sh i2
40 12 * * 3 /usr/local/bin/school-bell.sh p7
20 13 * * 3 /usr/local/bin/school-bell.sh p8
0 14 * * 3 /usr/local/bin/school-bell.sh p9
40 14 * * 3 /usr/local/bin/school-bell.sh p10
20 15 * * 3 /usr/local/bin/school-bell.sh pulang
30 16 * * 3 /usr/local/bin/school-bell.sh hymne

# ==================== HARI KAMIS (Thursday = 4) ====================
40 6 * * 4 /usr/local/bin/school-bell.sh sholawat
0 7 * * 4 /usr/local/bin/school-bell.sh masuk
15 7 * * 4 /usr/local/bin/school-bell.sh literasi
10 8 * * 4 /usr/local/bin/school-bell.sh p2
50 8 * * 4 /usr/local/bin/school-bell.sh p3
30 9 * * 4 /usr/local/bin/school-bell.sh p4
0 10 * * 4 /usr/local/bin/school-bell.sh indonesia-raya
10 10 * * 4 /usr/local/bin/school-bell.sh i1
20 10 * * 4 /usr/local/bin/school-bell.sh kebersihan
30 10 * * 4 /usr/local/bin/school-bell.sh p5
10 11 * * 4 /usr/local/bin/school-bell.sh p6
50 11 * * 4 /usr/local/bin/school-bell.sh i2
40 12 * * 4 /usr/local/bin/school-bell.sh p7
20 13 * * 4 /usr/local/bin/school-bell.sh p8
0 14 * * 4 /usr/local/bin/school-bell.sh p9
40 14 * * 4 /usr/local/bin/school-bell.sh p10
20 15 * * 4 /usr/local/bin/school-bell.sh pulang
30 16 * * 4 /usr/local/bin/school-bell.sh hymne

# ==================== HARI JUMAT (Friday = 5) ====================
40 6 * * 5 /usr/local/bin/school-bell.sh sholawat
0 7 * * 5 /usr/local/bin/school-bell.sh masuk
15 7 * * 5 /usr/local/bin/school-bell.sh rohani
50 7 * * 5 /usr/local/bin/school-bell.sh p2
30 8 * * 5 /usr/local/bin/school-bell.sh p3
10 9 * * 5 /usr/local/bin/school-bell.sh p4
50 9 * * 5 /usr/local/bin/school-bell.sh i1
0 10 * * 5 /usr/local/bin/school-bell.sh kebersihan
10 10 * * 5 /usr/local/bin/school-bell.sh p5
50 10 * * 5 /usr/local/bin/school-bell.sh p6
30 11 * * 5 /usr/local/bin/school-bell.sh i2
50 12 * * 5 /usr/local/bin/school-bell.sh p7
30 13 * * 5 /usr/local/bin/school-bell.sh p8
10 14 * * 5 /usr/local/bin/school-bell.sh p9
50 14 * * 5 /usr/local/bin/school-bell.sh ap
51 14 * * 5 /usr/local/bin/school-bell.sh pramuka
30 16 * * 5 /usr/local/bin/school-bell.sh hymne
EOF

echo "Apakah Anda ingin menginstall crontab sekarang? (y/n)"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    # Install crontab untuk user root
    crontab "$TEMP_CRON"
    echo "✓ Crontab installed untuk root user"
    
    # Juga install untuk user biasa jika ada
    if [ -n "$AUDIO_USER" ]; then
        sudo -u "$AUDIO_USER" crontab "$TEMP_CRON"
        echo "✓ Crontab installed untuk user $AUDIO_USER"
    fi
else
    echo "Crontab tidak diinstall. File tersimpan di $TEMP_CRON"
    echo "Untuk install manual, jalankan: crontab $TEMP_CRON"
fi

# Cleanup temporary file
rm -f "$TEMP_CRON"

echo
echo "======================================"
echo "Installation Complete!"
echo "======================================"
echo
echo "File yang dibutuhkan:"
echo "- Script utama: $SCRIPT_FILE"
echo "- Log file: $LOG_FILE"
echo "- Audio directory: ~/bel-sekolah/tone/"
echo
echo "File audio yang diperlukan di ~/bel-sekolah/tone/:"
echo "- sholawat.mp3    - hymne.mp3        - upacara.mp3"
echo "- literasi.mp3    - rohani.mp3       - p1.mp3 s/d p10.mp3"
echo "- indonesia-raya.mp3  - i1.mp3, i2.mp3   - kebersihan.mp3"
echo "- s.mp3 (bel pulang)  - ap.mp3 (bel pulang jumat)"
echo "- pramuka.mp3"
echo
echo "Cara penggunaan:"
echo "- Test manual: /usr/local/bin/school-bell.sh sholawat"
echo "- Monitor log: tail -f /var/log/school-bell.log"
echo "- Edit jadwal: crontab -e"
echo
echo "Service akan berjalan otomatis sesuai jadwal!"
echo