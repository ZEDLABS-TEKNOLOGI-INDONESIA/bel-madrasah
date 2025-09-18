# Bell System Madrasah Tsanawiyah Negeri 1 Pandeglang

<div align="center">

![Bell System](https://img.shields.io/badge/Bell%20System-Madrasah-blue?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.6+-green?style=for-the-badge&logo=python)
![Linux](https://img.shields.io/badge/Platform-Linux-orange?style=for-the-badge&logo=linux)
![Systemd](https://img.shields.io/badge/Service-Systemd-red?style=for-the-badge)

**Sistem bel otomatis untuk Madrasah Tsanawiyah Negeri 1 Pandeglang**

[📥 Quick Install](#-quick-install) • [📋 Features](#-fitur) • [📖 Documentation](#-dokumentasi) • [🛠️ Manual Setup](#️-manual-setup)

</div>

---

## 🚀 Quick Install

**One-command installation:**

```bash
# Clone repository
git clone https://github.com/zulfikriyahya/bel-madrasah.git
cd bel-madrasah

# Run installer
chmod +x install.sh
./install.sh
```

**One-command uninstall:**
```bash
./uninstall.sh
```

> ⚠️ **Penting:** Pastikan file audio sudah tersedia sebelum menjalankan sistem!

---

## 📋 Fitur

### 🔧 **Otomatisasi Lengkap**
- ✅ **Instalasi one-click** dengan script installer
- ✅ **Auto-detection** system requirements  
- ✅ **Systemd integration** untuk auto-start
- ✅ **Safe uninstallation** dengan backup option

### 🎵 **Audio Management**
- ✅ **Multi-format support** (MP3, WAV, dll)
- ✅ **Volume control** otomatis (85%)
- ✅ **Anti-duplicate playback** dalam satu waktu
- ✅ **Background audio processing**

### 📅 **Smart Scheduling**  
- ✅ **Jadwal harian** Senin-Jumat
- ✅ **Multi-activity support** (upacara, literasi, rohani, dll)
- ✅ **Flexible timing** mudah dimodifikasi
- ✅ **Holiday detection** (weekend otomatis off)

### 🛡️ **Reliability & Monitoring**
- ✅ **Service auto-restart** jika crash
- ✅ **Systemd logging** untuk monitoring
- ✅ **Error handling** yang robust
- ✅ **Cache management** anti-duplikasi

---

## 📁 Struktur Project

```
bel-madrasah/
├── install.sh           # 🚀 Auto installer script
├── uninstall.sh         # 🗑️ Safe uninstaller script
├── main.py              # 🎯 Core application
├── jadwal.py            # 📅 Schedule configuration
├── tone/                # 🎵 Audio files directory
│   ├── sholawat.mp3
│   ├── hymne.mp3
│   ├── indonesia-raya.mp3
│   ├── upacara.mp3
│   ├── literasi.mp3
│   ├── rohani.mp3
│   ├── pramuka.mp3
│   ├── kebersihan.mp3
│   ├── p1.mp3 - p10.mp3    # Periode pembelajaran
│   ├── i1.mp3, i2.mp3      # Istirahat
│   ├── s.mp3               # Selesai
│   └── ap.mp3              # Akhir pembelajaran
├── audio-list.txt       # 📝 Audio files checklist
└── README.md           # 📖 Documentation
```

---

## ⏰ Jadwal Kegiatan

<details>
<summary><b>📅 Senin - Upacara Bendera</b></summary>

| Waktu | Kegiatan | Audio |
|-------|----------|-------|
| 06:40 | Pembukaan | Sholawat |
| 07:00 | Hymne Sekolah | Hymne |
| 07:15 | **Upacara Bendera** | Upacara |
| 08:10-15:20 | Pembelajaran (P2-P10) | Periode |
| 10:00 | **Lagu Kebangsaan** | Indonesia Raya |
| 10:10, 11:50 | Istirahat | I1, I2 |
| 10:20 | Kegiatan Kebersihan | Kebersihan |
| 16:30 | Penutup | Hymne |

</details>

<details>
<summary><b>📅 Selasa & Rabu - Hari Biasa</b></summary>

| Waktu | Kegiatan | Audio |
|-------|----------|-------|
| 06:40 | Pembukaan | Sholawat |
| 07:00 | Hymne Sekolah | Hymne |
| 07:30-15:20 | Pembelajaran (P1-P10) | Periode |
| 10:10, 11:50 | Istirahat | I1, I2 |
| 10:20 | Kegiatan Kebersihan | Kebersihan |
| 16:30 | Penutup | Hymne |

</details>

<details>
<summary><b>📅 Kamis - Literasi</b></summary>

| Waktu | Kegiatan | Audio |
|-------|----------|-------|
| 06:40 | Pembukaan | Sholawat |
| 07:00 | Hymne Sekolah | Hymne |
| 07:15 | **Kegiatan Literasi** | Literasi |
| 08:10-15:20 | Pembelajaran (P2-P10) | Periode |
| 10:00 | **Lagu Kebangsaan** | Indonesia Raya |
| 10:10, 11:50 | Istirahat | I1, I2 |
| 10:20 | Kegiatan Kebersihan | Kebersihan |
| 16:30 | Penutup | Hymne |

</details>

<details>
<summary><b>📅 Jumat - Rohani & Pramuka</b></summary>

| Waktu | Kegiatan | Audio |
|-------|----------|-------|
| 06:40 | Pembukaan | Sholawat |
| 07:00 | Hymne Sekolah | Hymne |
| 07:15 | **Kegiatan Rohani** | Rohani |
| 07:50-14:50 | Pembelajaran (P2-P9) | Periode |
| 09:50, 11:30 | Istirahat | I1, I2 |
| 10:00 | Kegiatan Kebersihan | Kebersihan |
| 14:50 | Akhir Pembelajaran | AP |
| 14:51 | **Kegiatan Pramuka** | Pramuka |
| 16:30 | Penutup | Hymne |

</details>

---

## 🛠️ System Requirements

| Component | Requirement | Auto-Install |
|-----------|-------------|--------------|
| **OS** | Linux with systemd | ✅ Checked |
| **Python** | 3.6 or higher | ✅ Checked |
| **Audio Player** | ffmpeg/ffplay | ✅ Auto-install |
| **Service Manager** | systemd | ✅ Configured |
| **Permissions** | Regular user (non-root) | ✅ Validated |

---

## 📖 Dokumentasi

### 🎛️ **Service Management**

```bash
# Status service
systemctl --user status bel-madrasah

# Start/Stop service
systemctl --user start bel-madrasah
systemctl --user stop bel-madrasah
systemctl --user restart bel-madrasah

# Enable/Disable auto-start
systemctl --user enable bel-madrasah
systemctl --user disable bel-madrasah
```

### 📊 **Monitoring & Logs**

```bash
# Real-time logs
journalctl --user -u bel-madrasah -f

# Today's logs
journalctl --user -u bel-madrasah --since today

# Logs with date range
journalctl --user -u bel-madrasah --since "2024-01-01" --until "2024-01-02"

# Service status check
systemctl --user is-active bel-madrasah
```

### ⚙️ **Configuration**

**Edit Schedule:**
```bash
nano ~/bel-madrasah/jadwal.py
systemctl --user restart bel-madrasah
```

**Adjust Volume:**
```python
# Edit main.py, line ~15
subprocess.Popen([
    "/usr/bin/ffplay", "-nodisp", "-volume", "85",  # Change this value
    "-autoexit", full_path
])
```

**Change Check Interval:**
```python
# Edit main.py, bottom of main() function
time.sleep(30)  # Change interval (seconds)
```

---

## 🎵 Audio Files Setup

### 📝 **Required Files** 

Semua file audio harus ditempatkan di: `~/bel-madrasah/tone/`

**Core Files:**
- `sholawat.mp3` - Audio pembukaan sholawat
- `hymne.mp3` - Hymne sekolah  
- `indonesia-raya.mp3` - Lagu kebangsaan

**Activity Files:**
- `upacara.mp3` - Audio upacara bendera
- `literasi.mp3` - Audio kegiatan literasi
- `rohani.mp3` - Audio kegiatan rohani
- `pramuka.mp3` - Audio kegiatan pramuka
- `kebersihan.mp3` - Audio kegiatan kebersihan

**Period Files:**
- `p1.mp3` to `p10.mp3` - Audio periode pembelajaran
- `i1.mp3`, `i2.mp3` - Audio istirahat
- `s.mp3` - Audio selesai
- `ap.mp3` - Audio akhir pembelajaran

> 📋 **Tip:** Cek file `~/bel-madrasah/audio-list.txt` untuk daftar lengkap setelah instalasi!

### 🔊 **Audio Format Support**
- **Recommended:** MP3 (best compatibility)
- **Supported:** WAV, OGG, M4A, FLAC
- **Quality:** Any bitrate (128kbps recommended for file size)

---

## 🛠️ Manual Setup

Jika tidak ingin menggunakan installer otomatis:

<details>
<summary><b>🔧 Manual Installation Steps</b></summary>

### 1. **Install Dependencies**
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg python3

# RHEL/CentOS
sudo yum install ffmpeg python3

# Fedora
sudo dnf install ffmpeg python3

# Arch Linux
sudo pacman -S ffmpeg python
```

### 2. **Setup Project**
```bash
# Clone repository
git clone https://github.com/zulfikriyahya/bel-madrasah.git
cd bel-madrasah

# Copy audio files
mkdir -p ~/bel-madrasah/tone/
# Copy all your audio files here

# Copy Python files
cp main.py jadwal.py ~/bel-madrasah/
```

### 3. **Create Systemd Service**
```bash
mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/bel-madrasah.service << EOF
[Unit]
Description=Bel Madrasah Otomatis
After=default.target

[Service]
ExecStart=/usr/bin/python3 $HOME/bel-madrasah/main.py
Restart=always
RestartSec=10
Environment=XDG_RUNTIME_DIR=/run/user/$UID
Environment=DISPLAY=:0
StandardOutput=journal
StandardError=journal
WorkingDirectory=$HOME/bel-madrasah

[Install]
WantedBy=default.target
EOF
```

### 4. **Enable Service**
```bash
systemctl --user daemon-reload
systemctl --user enable --now bel-madrasah.service
sudo loginctl enable-linger $USER
```

</details>

---

## 🚨 Troubleshooting

<details>
<summary><b>🔍 Common Issues & Solutions</b></summary>

### **Audio Not Playing**
```bash
# Check audio files exist
ls -la ~/bel-madrasah/tone/

# Test audio manually  
ffplay ~/bel-madrasah/tone/hymne.mp3

# Check file permissions
chmod 644 ~/bel-madrasah/tone/*.mp3

# Verify ffplay installation
which ffplay
```

### **Service Not Starting**
```bash
# Check service status
systemctl --user status bel-madrasah

# Check logs for errors
journalctl --user -u bel-madrasah --lines=50

# Restart service
systemctl --user restart bel-madrasah

# Check user lingering
loginctl show-user $USER | grep Linger
```

### **Service Not Auto-Starting**
```bash
# Enable user lingering
sudo loginctl enable-linger $USER

# Verify service is enabled
systemctl --user is-enabled bel-madrasah

# Check service file
cat ~/.config/systemd/user/bel-madrasah.service
```

### **Permission Issues**
```bash
# Fix ownership
chown -R $USER:$USER ~/bel-madrasah/

# Fix permissions
chmod +x ~/bel-madrasah/main.py
chmod 644 ~/bel-madrasah/jadwal.py
chmod 644 ~/bel-madrasah/tone/*.mp3
```

### **Python Import Errors**
```bash
# Test imports manually
cd ~/bel-madrasah/
python3 -c "from jadwal import JADWAL; print('OK')"

# Check Python path
which python3
python3 --version
```

</details>

---

## 🔄 Updates & Maintenance

### 📥 **Update System**
```bash
# Pull latest changes
cd bel-madrasah/
git pull origin main

# Restart service to apply changes
systemctl --user restart bel-madrasah
```

### 🧹 **Maintenance Tasks**
```bash
# Clean old logs (older than 7 days)
journalctl --user --vacuum-time=7d

# Check disk usage
du -sh ~/bel-madrasah/

# Test all audio files
for file in ~/bel-madrasah/tone/*.mp3; do
    echo "Testing: $file"
    ffprobe "$file" &>/dev/null && echo "✅ OK" || echo "❌ ERROR"
done
```

---

## 🤝 Contributing

Kontribusi sangat diterima! Silakan:

1. **Fork** repository ini
2. **Create** feature branch (`git checkout -b feature/AmazingFeature`)
3. **Commit** perubahan (`git commit -m 'Add some AmazingFeature'`)  
4. **Push** ke branch (`git push origin feature/AmazingFeature`)
5. **Open** Pull Request

### 📋 **Development Guidelines**
- Gunakan Python 3.6+ compatibility
- Test di multiple Linux distributions
- Update documentation untuk fitur baru
- Maintain backward compatibility

---

## 📜 License

Project ini dibuat untuk keperluan pendidikan di **Madrasah Tsanawiyah Negeri 1 Pandeglang**.

---

## 👨‍💻 Author & Support

**Developed by:** [zulfikriyahya](https://github.com/zulfikriyahya)  
**Institution:** Madrasah Tsanawiyah Negeri 1 Pandeglang  
**Repository:** https://github.com/zulfikriyahya/bel-madrasah.git

### 💬 **Need Help?**
- 🐛 **Bug Reports:** [Open an Issue](https://github.com/zulfikriyahya/bel-madrasah/issues)
- 💡 **Feature Requests:** [Start a Discussion](https://github.com/zulfikriyahya/bel-madrasah/discussions)
- 📧 **Direct Contact:** Contact repository owner

---

<div align="center">

**⭐ Star this repository if it helps you!**

![GitHub stars](https://img.shields.io/github/stars/zulfikriyahya/bel-madrasah?style=social)
![GitHub forks](https://img.shields.io/github/forks/zulfikriyahya/bel-madrasah?style=social)

*Made with ❤️ for Indonesian Education*

</div>
