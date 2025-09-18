#!/bin/bash

# Audio Fix Installer untuk School Bell Service
echo "======================================"
echo "School Bell Audio Fix"
echo "======================================"

# Install audio tools yang diperlukan
echo "Installing audio tools..."
sudo apt update
sudo apt install -y alsa-utils pulseaudio-utils mpg123 vlc-nox

# Buat script audio yang lebih robust
SCRIPT_FILE="/usr/local/bin/school-bell-audio.sh"

sudo tee "$SCRIPT_FILE" > /dev/null << 'EOF'
#!/bin/bash

# School Bell Audio Script dengan Multiple Fallbacks
AUDIO_DIR="$HOME/bel-sekolah/tone"
LOG_FILE="/var/log/school-bell.log"

play_audio() {
    local bell_type="$1"
    local audio_file="$AUDIO_DIR/${bell_type}.mp3"
    
    # Mapping nama bel
    case "$bell_type" in
        "sholawat") desc="Bel Sholawat" ;;
        "masuk") desc="Bel Masuk"; audio_file="$AUDIO_DIR/hymne.mp3" ;;
        "upacara") desc="Bel Upacara" ;;
        "literasi") desc="Bel Literasi" ;;
        "rohani") desc="Bel Rohani" ;;
        "p"[1-9]|"p10") desc="Bel Jam Pelajaran Ke ${bell_type#p}" ;;
        "indonesia-raya") desc="Bel Indonesia Raya" ;;
        "i1") desc="Bel Istirahat Ke 1" ;;
        "i2") desc="Bel Istirahat Ke 2" ;;
        "kebersihan") desc="Bel Kebersihan" ;;
        "pulang") desc="Bel Pulang"; audio_file="$AUDIO_DIR/s.mp3" ;;
        "ap") desc="Bel Pulang (Jumat)" ;;
        "pramuka") desc="Bel Pramuka" ;;
        "hymne") desc="Bel Hymne" ;;
        *) desc="Unknown Bell" ;;
    esac
    
    echo "$(date): Attempting to play $desc - $audio_file" >> "$LOG_FILE"
    
    if [ ! -f "$audio_file" ]; then
        echo "$(date): ERROR - Audio file not found: $audio_file" >> "$LOG_FILE"
        return 1
    fi
    
    # Method 1: paplay (PulseAudio)
    if command -v paplay &> /dev/null && pgrep pulseaudio > /dev/null; then
        local temp_wav="/tmp/bell_temp.wav"
        if ffmpeg -i "$audio_file" -y "$temp_wav" &> /dev/null; then
            # Coba sebagai user yang menjalankan pulseaudio
            local pulse_user=$(ps aux | grep pulseaudio | grep -v grep | head -1 | awk '{print $1}')
            if [ -n "$pulse_user" ]; then
                sudo -u "$pulse_user" PULSE_SERVER="unix:/run/user/$(id -u $pulse_user)/pulse/native" paplay "$temp_wav" &> /dev/null
                local exit_code=$?
                rm -f "$temp_wav"
                if [ $exit_code -eq 0 ]; then
                    echo "$(date): Successfully played $desc (paplay)" >> "$LOG_FILE"
                    return 0
                fi
            fi
            rm -f "$temp_wav"
        fi
    fi
    
    # Method 2: aplay (ALSA)
    if command -v aplay &> /dev/null; then
        if ffmpeg -i "$audio_file" -f wav - 2>/dev/null | aplay - &> /dev/null; then
            echo "$(date): Successfully played $desc (aplay)" >> "$LOG_FILE"
            return 0
        fi
    fi
    
    # Method 3: mpg123
    if command -v mpg123 &> /dev/null; then
        if mpg123 -q "$audio_file" &> /dev/null; then
            echo "$(date): Successfully played $desc (mpg123)" >> "$LOG_FILE"
            return 0
        fi
    fi
    
    # Method 4: cvlc
    if command -v cvlc &> /dev/null; then
        if timeout 10 cvlc --intf dummy --play-and-exit "$audio_file" &> /dev/null; then
            echo "$(date): Successfully played $desc (cvlc)" >> "$LOG_FILE"
            return 0
        fi
    fi
    
    echo "$(date): ERROR - All audio methods failed for $desc" >> "$LOG_FILE"
    return 1
}

# Execute
play_audio "$1"
EOF

sudo chmod +x "$SCRIPT_FILE"
echo "✓ Audio script installed"

# Update crontab untuk menggunakan script baru
echo "Updating crontab..."
TEMP_CRON="/tmp/bell-cron-fixed"

cat > "$TEMP_CRON" << 'EOF'
# School Bell - Fixed Audio Version
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# SENIN
40 6 * * 1 /usr/local/bin/school-bell-audio.sh sholawat
0 7 * * 1 /usr/local/bin/school-bell-audio.sh masuk
15 7 * * 1 /usr/local/bin/school-bell-audio.sh upacara
10 8 * * 1 /usr/local/bin/school-bell-audio.sh p2
50 8 * * 1 /usr/local/bin/school-bell-audio.sh p3
30 9 * * 1 /usr/local/bin/school-bell-audio.sh p4
0 10 * * 1 /usr/local/bin/school-bell-audio.sh indonesia-raya
10 10 * * 1 /usr/local/bin/school-bell-audio.sh i1
20 10 * * 1 /usr/local/bin/school-bell-audio.sh kebersihan
30 10 * * 1 /usr/local/bin/school-bell-audio.sh p5
10 11 * * 1 /usr/local/bin/school-bell-audio.sh p6
50 11 * * 1 /usr/local/bin/school-bell-audio.sh i2
40 12 * * 1 /usr/local/bin/school-bell-audio.sh p7
20 13 * * 1 /usr/local/bin/school-bell-audio.sh p8
0 14 * * 1 /usr/local/bin/school-bell-audio.sh p9
40 14 * * 1 /usr/local/bin/school-bell-audio.sh p10
20 15 * * 1 /usr/local/bin/school-bell-audio.sh pulang
30 16 * * 1 /usr/local/bin/school-bell-audio.sh hymne

# SELASA
40 6 * * 2 /usr/local/bin/school-bell-audio.sh sholawat
0 7 * * 2 /usr/local/bin/school-bell-audio.sh masuk
30 7 * * 2 /usr/local/bin/school-bell-audio.sh p1
10 8 * * 2 /usr/local/bin/school-bell-audio.sh p2
50 8 * * 2 /usr/local/bin/school-bell-audio.sh p3
30 9 * * 2 /usr/local/bin/school-bell-audio.sh p4
10 10 * * 2 /usr/local/bin/school-bell-audio.sh i1
20 10 * * 2 /usr/local/bin/school-bell-audio.sh kebersihan
30 10 * * 2 /usr/local/bin/school-bell-audio.sh p5
10 11 * * 2 /usr/local/bin/school-bell-audio.sh p6
50 11 * * 2 /usr/local/bin/school-bell-audio.sh i2
40 12 * * 2 /usr/local/bin/school-bell-audio.sh p7
20 13 * * 2 /usr/local/bin/school-bell-audio.sh p8
0 14 * * 2 /usr/local/bin/school-bell-audio.sh p9
40 14 * * 2 /usr/local/bin/school-bell-audio.sh p10
20 15 * * 2 /usr/local/bin/school-bell-audio.sh pulang
30 16 * * 2 /usr/local/bin/school-bell-audio.sh hymne

# RABU  
40 6 * * 3 /usr/local/bin/school-bell-audio.sh sholawat
0 7 * * 3 /usr/local/bin/school-bell-audio.sh masuk
30 7 * * 3 /usr/local/bin/school-bell-audio.sh p1
10 8 * * 3 /usr/local/bin/school-bell-audio.sh p2
50 8 * * 3 /usr/local/bin/school-bell-audio.sh p3
30 9 * * 3 /usr/local/bin/school-bell-audio.sh p4
10 10 * * 3 /usr/local/bin/school-bell-audio.sh i1
20 10 * * 3 /usr/local/bin/school-bell-audio.sh kebersihan
30 10 * * 3 /usr/local/bin/school-bell-audio.sh p5
10 11 * * 3 /usr/local/bin/school-bell-audio.sh p6
50 11 * * 3 /usr/local/bin/school-bell-audio.sh i2
40 12 * * 3 /usr/local/bin/school-bell-audio.sh p7
20 13 * * 3 /usr/local/bin/school-bell-audio.sh p8
0 14 * * 3 /usr/local/bin/school-bell-audio.sh p9
40 14 * * 3 /usr/local/bin/school-bell-audio.sh p10
20 15 * * 3 /usr/local/bin/school-bell-audio.sh pulang
30 16 * * 3 /usr/local/bin/school-bell-audio.sh hymne

# KAMIS
40 6 * * 4 /usr/local/bin/school-bell-audio.sh sholawat
0 7 * * 4 /usr/local/bin/school-bell-audio.sh masuk
15 7 * * 4 /usr/local/bin/school-bell-audio.sh literasi
10 8 * * 4 /usr/local/bin/school-bell-audio.sh p2
50 8 * * 4 /usr/local/bin/school-bell-audio.sh p3
30 9 * * 4 /usr/local/bin/school-bell-audio.sh p4
0 10 * * 4 /usr/local/bin/school-bell-audio.sh indonesia-raya
10 10 * * 4 /usr/local/bin/school-bell-audio.sh i1
20 10 * * 4 /usr/local/bin/school-bell-audio.sh kebersihan
30 10 * * 4 /usr/local/bin/school-bell-audio.sh p5
10 11 * * 4 /usr/local/bin/school-bell-audio.sh p6
50 11 * * 4 /usr/local/bin/school-bell-audio.sh i2
40 12 * * 4 /usr/local/bin/school-bell-audio.sh p7
20 13 * * 4 /usr/local/bin/school-bell-audio.sh p8
0 14 * * 4 /usr/local/bin/school-bell-audio.sh p9
40 14 * * 4 /usr/local/bin/school-bell-audio.sh p10
20 15 * * 4 /usr/local/bin/school-bell-audio.sh pulang
30 16 * * 4 /usr/local/bin/school-bell-audio.sh hymne

# JUMAT
40 6 * * 5 /usr/local/bin/school-bell-audio.sh sholawat
0 7 * * 5 /usr/local/bin/school-bell-audio.sh masuk
15 7 * * 5 /usr/local/bin/school-bell-audio.sh rohani
50 7 * * 5 /usr/local/bin/school-bell-audio.sh p2
30 8 * * 5 /usr/local/bin/school-bell-audio.sh p3
10 9 * * 5 /usr/local/bin/school-bell-audio.sh p4
50 9 * * 5 /usr/local/bin/school-bell-audio.sh i1
0 10 * * 5 /usr/local/bin/school-bell-audio.sh kebersihan
10 10 * * 5 /usr/local/bin/school-bell-audio.sh p5
50 10 * * 5 /usr/local/bin/school-bell-audio.sh p6
30 11 * * 5 /usr/local/bin/school-bell-audio.sh i2
50 12 * * 5 /usr/local/bin/school-bell-audio.sh p7
30 13 * * 5 /usr/local/bin/school-bell-audio.sh p8
10 14 * * 5 /usr/local/bin/school-bell-audio.sh p9
50 14 * * 5 /usr/local/bin/school-bell-audio.sh ap
51 14 * * 5 /usr/local/bin/school-bell-audio.sh pramuka
30 16 * * 5 /usr/local/bin/school-bell-audio.sh hymne
EOF

crontab "$TEMP_CRON"
rm "$TEMP_CRON"

echo "✓ Fixed crontab installed"

echo
echo "======================================"
echo "Audio Fix Applied!"
echo "======================================"
echo
echo "Langkah troubleshooting:"
echo "1. Test manual: sudo /usr/local/bin/school-bell-audio.sh sholawat"
echo "2. Cek audio device: cat /proc/asound/cards"
echo "3. Cek PulseAudio: ps aux | grep pulseaudio"
echo "4. Test aplay: aplay /usr/share/sounds/alsa/Front_Left.wav"
echo "5. Monitor log: tail -f /var/log/school-bell.log"
echo
echo "Jika masih tidak keluar suara, coba:"
echo "- Pastikan speaker/headphone terpasang"
echo "- Volume tidak mute: amixer set Master unmute"
echo "- Set volume: amixer set Master 100%"