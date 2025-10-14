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

### ⚡ **Super Simple (Recommended)**

**Copy-paste baris ini:**

```bash
wget https://raw.githubusercontent.com/zulfikriyahya/bel-madrasah/main/install.sh
chmod +x install.sh
./install.sh
```

### 📦 **Alternative: Clone Repository**

```bash
git clone https://github.com/zulfikriyahya/bel-madrasah.git
cd bel-madrasah
chmod +x install.sh
./install.sh
```

**Installer akan otomatis:**

- ✅ Install dependencies (Python3, ffmpeg, curl)
- ✅ Download semua file audio dari repository
- ✅ Setup systemd service
- ✅ Enable auto-start service
- ✅ Verify installation

### 🗑️ **Quick Uninstall**

```bash
wget https://raw.githubusercontent.com/zulfikriyahya/bel-madrasah/main/uninstall.sh
chmod +x uninstall.sh
./uninstall.sh
```

> ⚠️ **Peringatan:** Uninstaller akan menghapus SEMUA file tanpa backup!

---

## 📋 Fitur

### 🔧 **Otomatisasi Lengkap**

- ✅ **Instalasi one-click** dengan script installer
- ✅ **Auto-download audio files** dari repository
- ✅ **Auto-detection** system requirements
- ✅ **Systemd integration** untuk auto-start
- ✅ **Clean uninstallation** tanpa sisa file

### 🎵 **Audio Management**

- ✅ **Multi-format support** (MP3, WAV, dll)
- ✅ **Volume control** otomatis (85%)
- ✅ **Anti-duplicate playback** dalam satu waktu
- ✅ **Background audio processing**
- ✅ **25 audio files** ter-download otomatis

### 📅 **Smart Scheduling**

- ✅ **Jadwal harian** Senin-Jumat
- ✅ **Multi-activity support** (upacara, literasi, rohani, pramuka, dll)
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
├── install.sh              # 🚀 Auto installer script
├── uninstall.sh            # 🗑️ Clean uninstaller script
├── main.py                 # 🎯 Core application (auto-generated)
├── jadwal.py               # 📅 Schedule configuration (auto-generated)
├── tone/                   # 🎵 Audio files directory (auto-downloaded)
│   ├── sholawat-badariyah.mp3
│   ├── sholawat-jibril.mp3
│   ├── murotal-yasin.mp3
│   ├── mars-madrasah.mp3
│   ├── hymne-madrasah.mp3
│   ├── indonesia-raya.mp3
│   ├── upacara.mp3
│   ├── literasi.mp3
│   ├── rohani.mp3
│   ├── pramuka.mp3
│   ├── kebersihan.mp3
│   ├── akhir-pekan.mp3
│   ├── pelajaran-1.mp3 - pelajaran-10.mp3
│   ├── pelajaran-selesai.mp3
│   ├── istirahat-1.mp3
│   └── istirahat-2.mp3
├── audio-list.txt          # 📝 Downloaded files checklist
└── README.md               # 📖 Documentation
```

---

## ⏰ Jadwal Kegiatan

<details>
<summary><b>📅 Senin - Upacara Bendera</b></summary>

| Waktu | Kegiatan            | Audio              |
| ----- | ------------------- | ------------------ |
| 06:40 | Pembukaan           | Sholawat Badariyah |
| 07:00 | Hymne               | Mars Madrasah      |
| 07:15 | **Upacara Bendera** | Upacara            |
| 08:10 | Periode 2           | Pelajaran 2        |
| 08:50 | Periode 3           | Pelajaran 3        |
| 09:30 | Periode 4           | Pelajaran 4        |
| 10:00 | **Lagu Kebangsaan** | Indonesia Raya     |
| 10:10 | Istirahat 1         | Istirahat 1        |
| 10:20 | Kebersihan          | Kebersihan         |
| 10:30 | Periode 5           | Pelajaran 5        |
| 11:10 | Periode 6           | Pelajaran 6        |
| 11:50 | Istirahat 2         | Istirahat 2        |
| 12:30 | Kebersihan          | Kebersihan         |
| 12:40 | Periode 7           | Pelajaran 7        |
| 13:20 | Periode 8           | Pelajaran 8        |
| 14:00 | Periode 9           | Pelajaran 9        |
| 14:40 | Periode 10          | Pelajaran 10       |
| 15:20 | Selesai             | Pelajaran Selesai  |
| 16:30 | Penutup             | Hymne Madrasah     |

</details>

<details>
<summary><b>📅 Selasa - Hari Biasa</b></summary>

| Waktu | Kegiatan    | Audio             |
| ----- | ----------- | ----------------- |
| 06:40 | Pembukaan   | Sholawat Jibril   |
| 07:00 | Hymne       | Mars Madrasah     |
| 07:30 | Periode 1   | Pelajaran 1       |
| 08:10 | Periode 2   | Pelajaran 2       |
| 08:50 | Periode 3   | Pelajaran 3       |
| 09:30 | Periode 4   | Pelajaran 4       |
| 10:10 | Istirahat 1 | Istirahat 1       |
| 10:20 | Kebersihan  | Kebersihan        |
| 10:30 | Periode 5   | Pelajaran 5       |
| 11:10 | Periode 6   | Pelajaran 6       |
| 11:50 | Istirahat 2 | Istirahat 2       |
| 12:30 | Kebersihan  | Kebersihan        |
| 12:40 | Periode 7   | Pelajaran 7       |
| 13:20 | Periode 8   | Pelajaran 8       |
| 14:00 | Periode 9   | Pelajaran 9       |
| 14:40 | Periode 10  | Pelajaran 10      |
| 15:20 | Selesai     | Pelajaran Selesai |
| 16:30 | Penutup     | Hymne Madrasah    |

</details>

<details>
<summary><b>📅 Rabu - Hari Biasa</b></summary>

| Waktu | Kegiatan    | Audio              |
| ----- | ----------- | ------------------ |
| 06:40 | Pembukaan   | Sholawat Badariyah |
| 07:00 | Hymne       | Mars Madrasah      |
| 07:30 | Periode 1   | Pelajaran 1        |
| 08:10 | Periode 2   | Pelajaran 2        |
| 08:50 | Periode 3   | Pelajaran 3        |
| 09:30 | Periode 4   | Pelajaran 4        |
| 10:10 | Istirahat 1 | Istirahat 1        |
| 10:20 | Kebersihan  | Kebersihan         |
| 10:30 | Periode 5   | Pelajaran 5        |
| 11:10 | Periode 6   | Pelajaran 6        |
| 11:50 | Istirahat 2 | Istirahat 2        |
| 12:30 | Kebersihan  | Kebersihan         |
| 12:40 | Periode 7   | Pelajaran 7        |
| 13:20 | Periode 8   | Pelajaran 8        |
| 14:00 | Periode 9   | Pelajaran 9        |
| 14:40 | Periode 10  | Pelajaran 10       |
| 15:20 | Selesai     | Pelajaran Selesai  |
| 16:30 | Penutup     | Hymne Madrasah     |

</details>

<details>
<summary><b>📅 Kamis - Literasi</b></summary>

| Waktu | Kegiatan              | Audio             |
| ----- | --------------------- | ----------------- |
| 06:40 | Pembukaan             | Sholawat Jibril   |
| 07:00 | Hymne                 | Mars Madrasah     |
| 07:15 | **Kegiatan Literasi** | Literasi          |
| 08:10 | Periode 2             | Pelajaran 2       |
| 08:50 | Periode 3             | Pelajaran 3       |
| 09:30 | Periode 4             | Pelajaran 4       |
| 10:00 | **Lagu Kebangsaan**   | Indonesia Raya    |
| 10:10 | Istirahat 1           | Istirahat 1       |
| 10:20 | Kebersihan            | Kebersihan        |
| 10:30 | Periode 5             | Pelajaran 5       |
| 11:10 | Periode 6             | Pelajaran 6       |
| 11:50 | Istirahat 2           | Istirahat 2       |
| 12:30 | Kebersihan            | Kebersihan        |
| 12:40 | Periode 7             | Pelajaran 7       |
| 13:20 | Periode 8             | Pelajaran 8       |
| 14:00 | Periode 9             | Pelajaran 9       |
| 14:40 | Periode 10            | Pelajaran 10      |
| 15:20 | Selesai               | Pelajaran Selesai |
| 16:30 | Penutup               | Hymne Madrasah    |

</details>

<details>
<summary><b>📅 Jumat - Rohani & Pramuka</b></summary>

| Waktu | Kegiatan             | Audio          |
| ----- | -------------------- | -------------- |
| 06:40 | Pembukaan            | Murotal Yasin  |
| 07:00 | Hymne                | Mars Madrasah  |
| 07:15 | **Kegiatan Rohani**  | Rohani         |
| 07:50 | Periode 2            | Pelajaran 2    |
| 08:30 | Periode 3            | Pelajaran 3    |
| 09:10 | Periode 4            | Pelajaran 4    |
| 09:50 | Istirahat 1          | Istirahat 1    |
| 10:00 | Kebersihan           | Kebersihan     |
| 10:10 | Periode 5            | Pelajaran 5    |
| 10:50 | Periode 6            | Pelajaran 6    |
| 11:30 | Istirahat 2          | Istirahat 2    |
| 12:50 | Periode 7            | Pelajaran 7    |
| 13:30 | Periode 8            | Pelajaran 8    |
| 14:10 | Periode 9            | Pelajaran 9    |
| 14:50 | Akhir Pekan          | Akhir Pekan    |
| 14:51 | **Kegiatan Pramuka** | Pramuka        |
| 16:30 | Penutup              | Hymne Madrasah |

</details>

---

## 🛠️ System Requirements

| Component           | Requirement             | Auto-Install    |
| ------------------- | ----------------------- | --------------- |
| **OS**              | Linux with systemd      | ✅ Checked      |
| **Python**          | 3.6 or higher           | ✅ Checked      |
| **Audio Player**    | ffmpeg/ffplay           | ✅ Auto-install |
| **Downloader**      | curl                    | ✅ Auto-install |
| **Service Manager** | systemd                 | ✅ Configured   |
| **Permissions**     | Regular user (non-root) | ✅ Validated    |

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

```bash
nano ~/bel-madrasah/main.py
# Find line with "-volume", "85" and change the value (0-100)
systemctl --user restart bel-madrasah
```

**Change Check Interval:**

```bash
nano ~/bel-madrasah/main.py
# Find line with time.sleep(30) and change value (seconds)
systemctl --user restart bel-madrasah
```

---

## 🎵 Audio Files

### 📥 **Auto-Download**

Installer akan otomatis mendownload **25 file audio** dari repository:

**Sholawat & Hymne:**

- `sholawat-badariyah.mp3` - Sholawat pembukaan Senin/Rabu
- `sholawat-jibril.mp3` - Sholawat pembukaan Selasa/Kamis
- `murotal-yasin.mp3` - Murotal pembukaan Jumat
- `mars-madrasah.mp3` - Mars madrasah harian
- `hymne-madrasah.mp3` - Hymne penutup
- `indonesia-raya.mp3` - Lagu kebangsaan

**Kegiatan Khusus:**

- `upacara.mp3` - Upacara bendera (Senin)
- `literasi.mp3` - Kegiatan literasi (Kamis)
- `rohani.mp3` - Kegiatan rohani (Jumat)
- `pramuka.mp3` - Kegiatan pramuka (Jumat)
- `kebersihan.mp3` - Waktu kebersihan
- `akhir-pekan.mp3` - Penutup akhir pekan

**Pembelajaran:**

- `pelajaran-1.mp3` s/d `pelajaran-10.mp3` - Periode pembelajaran
- `pelajaran-selesai.mp3` - Akhir pembelajaran
- `istirahat-1.mp3`, `istirahat-2.mp3` - Waktu istirahat

### 📝 **Verifikasi Download**

```bash
# Lihat daftar file yang berhasil didownload
cat ~/bel-madrasah/audio-list.txt

# Cek jumlah file
ls -1 ~/bel-madrasah/tone/*.mp3 | wc -l
# Should show: 25

# Test audio file
ffplay ~/bel-madrasah/tone/mars-madrasah.mp3
```

### 🔊 **Audio Format**

- **Format:** MP3
- **Source:** GitHub Repository
- **Auto-downloaded:** Yes
- **Total Files:** 25

---

## 🛠️ Manual Setup

Jika tidak ingin menggunakan installer otomatis:

<details>
<summary><b>🔧 Manual Installation Steps</b></summary>

### 1. **Install Dependencies**

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg python3 curl

# RHEL/CentOS
sudo yum install ffmpeg python3 curl

# Fedora
sudo dnf install ffmpeg python3 curl

# Arch Linux
sudo pacman -S ffmpeg python curl
```

### 2. **Setup Project**

```bash
# Clone repository
git clone https://github.com/zulfikriyahya/bel-madrasah.git
cd bel-madrasah

# Create directory
mkdir -p ~/bel-madrasah/tone/

# Download audio files manually
BASE_URL="https://raw.githubusercontent.com/zulfikriyahya/bel-madrasah/main/tone"
cd ~/bel-madrasah/tone/

# Download each file
curl -O $BASE_URL/sholawat-badariyah.mp3
curl -O $BASE_URL/sholawat-jibril.mp3
curl -O $BASE_URL/murotal-yasin.mp3
# ... (download all 25 files)

# Copy Python files from repository
cd ~/bel-madrasah/
# Create main.py and jadwal.py based on repository
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

# Count files (should be 25)
ls -1 ~/bel-madrasah/tone/*.mp3 | wc -l

# Test audio manually
ffplay ~/bel-madrasah/tone/mars-madrasah.mp3

# Check file permissions
chmod 644 ~/bel-madrasah/tone/*.mp3

# Verify ffplay installation
which ffplay
ffplay -version
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

### **Audio Files Missing**

```bash
# Re-download specific file
cd ~/bel-madrasah/tone/
curl -O https://raw.githubusercontent.com/zulfikriyahya/bel-madrasah/main/tone/mars-madrasah.mp3

# Re-run installer (will re-download all)
cd ~/bel-madrasah/
./install.sh
```

### **Service Not Auto-Starting**

```bash
# Enable user lingering
sudo loginctl enable-linger $USER

# Verify service is enabled
systemctl --user is-enabled bel-madrasah

# Check service file exists
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

### **Download Failed**

```bash
# Check internet connection
ping -c 3 github.com

# Check curl
curl --version

# Manually download from browser
# Visit: https://github.com/zulfikriyahya/bel-madrasah/tree/main/tone
```

</details>

---

## 🔄 Updates & Maintenance

### 📥 **Update System**

```bash
# Stop service
systemctl --user stop bel-madrasah

# Pull latest changes
cd ~/bel-madrasah-repo/
git pull origin main

# Re-run installer to update
./install.sh

# Service will auto-start after installation
```

### 🧹 **Maintenance Tasks**

```bash
# Clean old logs (older than 7 days)
journalctl --user --vacuum-time=7d

# Check disk usage
du -sh ~/bel-madrasah/

# Verify all audio files
for file in ~/bel-madrasah/tone/*.mp3; do
    echo "Testing: $file"
    ffprobe "$file" &>/dev/null && echo "✅ OK" || echo "❌ ERROR"
done

# Check service health
systemctl --user is-active bel-madrasah
```

### 🔄 **Reinstall System**

```bash
# Uninstall completely
./uninstall.sh

# Install fresh
./install.sh
```

---

## 🗑️ Uninstallation

### ⚠️ **Clean Uninstall**

Uninstaller akan menghapus **SEMUA** komponen tanpa backup:

```bash
cd bel-madrasah/
./uninstall.sh
```

**Yang akan dihapus:**

- ✅ Systemd service (stop & disable)
- ✅ File service (~/.config/systemd/user/)
- ✅ Project directory (~/bel-madrasah/)
- ✅ Semua 25 file audio
- ✅ Python files (main.py, jadwal.py)
- ✅ User lingering (optional)

**Yang TIDAK dihapus:**

- ❌ ffmpeg (mungkin digunakan aplikasi lain)
- ❌ Python3 (sistem dependency)
- ❌ curl (sistem dependency)

### 🔒 **Safety Features**

1. **Double Confirmation** - Harus konfirmasi 2x
2. **Type "HAPUS"** - Harus ketik kata kunci
3. **Status Display** - Menampilkan apa yang akan dihapus
4. **Verification** - Memverifikasi penghapusan di akhir

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
- Test installer dan uninstaller

---

## 📜 License

Project ini dibuat untuk keperluan pendidikan di **Madrasah Tsanawiyah Negeri 1 Pandeglang**.

Free to use and modify for educational purposes.

---

## 👨‍💻 Author & Support

**Developed by:** [zulfikriyahya](https://github.com/zulfikriyahya)  
**Institution:** Madrasah Tsanawiyah Negeri 1 Pandeglang  
**Repository:** https://github.com/zulfikriyahya/bel-madrasah

### 💬 **Need Help?**

- 🐛 **Bug Reports:** [Open an Issue](https://github.com/zulfikriyahya/bel-madrasah/issues)
- 💡 **Feature Requests:** [Start a Discussion](https://github.com/zulfikriyahya/bel-madrasah/discussions)
- 📧 **Direct Contact:** Contact repository owner

---

## 📊 Installation Statistics

**Installer Features:**

- ✅ Auto-detect package manager (apt/yum/dnf/pacman)
- ✅ Auto-install dependencies
- ✅ Auto-download 25 audio files
- ✅ Auto-configure systemd
- ✅ Auto-enable user lingering
- ✅ Verification tests
- ✅ Complete logging

**Average Installation Time:**

- Dependencies: ~2-5 minutes
- Audio download: ~1-3 minutes (depends on connection)
- Configuration: ~10 seconds
- **Total: ~5-10 minutes**

---

<div align="center">

**⭐ Star this repository if it helps you!**

![GitHub stars](https://img.shields.io/github/stars/zulfikriyahya/bel-madrasah?style=social)
![GitHub forks](https://img.shields.io/github/forks/zulfikriyahya/bel-madrasah?style=social)

_Made with ❤️ for Indonesian Education_

</div>
