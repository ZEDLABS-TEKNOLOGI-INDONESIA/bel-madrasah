# Bell System Madrasah Tsanawiyah Negeri 1 Pandeglang

Sistem bel otomatis untuk Madrasah Tsanawiyah Negeri 1 Pandeglang yang berjalan berdasarkan jadwal harian dan memutar audio sesuai dengan kegiatan sekolah.

## 🔧 Fitur

- **Jadwal Otomatis**: Memutar bel sesuai jadwal hari Senin-Jumat
- **Audio Beragam**: Mendukung berbagai jenis audio untuk kegiatan yang berbeda
- **Systemd Integration**: Berjalan sebagai service sistem yang dapat dimulai otomatis
- **Anti-Duplikasi**: Mencegah pemutaran audio yang sama dalam waktu bersamaan
- **Logging**: Terintegrasi dengan systemd journal untuk monitoring

## 📁 Struktur File

```
bel-madrasah/
├── main.py          # File utama aplikasi
├── jadwal.py        # Konfigurasi jadwal harian
├── tone/            # Folder berisi file audio
│   ├── sholawat.mp3
│   ├── hymne.mp3
│   ├── indonesia-raya.mp3
│   ├── upacara.mp3
│   ├── literasi.mp3
│   ├── rohani.mp3
│   ├── kebersihan.mp3
│   ├── pramuka.mp3
│   ├── p1.mp3 - p10.mp3  # Audio periode belajar
│   ├── i1.mp3 - i2.mp3   # Audio istirahat
│   ├── s.mp3             # Audio selesai
│   └── ap.mp3            # Audio akhir pembelajaran
└── README.md
```

## 📅 Jadwal Kegiatan

### Senin
- **06:40** - Sholawat
- **07:00** - Hymne
- **07:15** - Upacara
- **08:10-15:20** - Periode pembelajaran (P2-P10)
- **10:00** - Indonesia Raya
- **10:10, 11:50** - Istirahat (I1, I2)
- **10:20** - Kebersihan
- **16:30** - Penutup (Hymne)

### Selasa & Rabu
- **06:40** - Sholawat
- **07:00** - Hymne
- **07:30-15:20** - Periode pembelajaran (P1-P10)
- **10:10, 11:50** - Istirahat (I1, I2)
- **10:20** - Kebersihan
- **16:30** - Penutup (Hymne)

### Kamis
- **06:40** - Sholawat
- **07:00** - Hymne
- **07:15** - Literasi
- **08:10-15:20** - Periode pembelajaran (P2-P10)
- **10:00** - Indonesia Raya
- **10:10, 11:50** - Istirahat (I1, I2)
- **10:20** - Kebersihan
- **16:30** - Penutup (Hymne)

### Jumat
- **06:40** - Sholawat
- **07:00** - Hymne
- **07:15** - Rohani
- **07:50-14:50** - Periode pembelajaran (P2-P9)
- **09:50, 11:30** - Istirahat (I1, I2)
- **10:00** - Kebersihan
- **14:50-14:51** - Akhir pembelajaran & Pramuka
- **16:30** - Penutup (Hymne)

## 🛠️ Persyaratan Sistem

- **OS**: Linux dengan systemd
- **Python**: 3.6+
- **Audio Player**: ffplay (dari paket ffmpeg)
- **Audio Files**: File MP3 di direktori `~/bel-sekolah/tone/`

## 📦 Instalasi

### 1. Persiapan File Audio
Pastikan semua file audio tersedia di direktori:
```bash
mkdir -p ~/bel-sekolah/tone/
# Copy semua file audio ke direktori tersebut
```

### 2. Download/Copy Kode
```bash
cd ~/bel-sekolah/
# Copy main.py dan jadwal.py ke direktori ini
```

### 3. Install Dependencies
```bash
# Install ffmpeg untuk ffplay
sudo apt update
sudo apt install ffmpeg
```

### 4. Setup Systemd Service
```bash
mkdir -p ~/.config/systemd/user
nano ~/.config/systemd/user/bel-madrasah.service
```

Isi file service:
```ini
[Unit]
Description=Bel Madrasah Otomatis
After=default.target

[Service]
ExecStart=/usr/bin/python3 /home/zulfikriyahya/bel-madrasah/main.py
Restart=always
Environment=XDG_RUNTIME_DIR=/run/user/1000
Environment=DISPLAY=:0
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

### 5. Aktifkan Service
```bash
# Reload systemd
systemctl --user daemon-reload

# Enable dan start service
systemctl --user enable --now bel-madrasah.service

# Restart service (jika perlu)
systemctl --user restart bel-madrasah.service

# Enable user linger (agar service berjalan tanpa login)
sudo loginctl enable-linger zulfikriyahya
```

## 🔍 Monitoring & Troubleshooting

### Cek Status Service
```bash
systemctl --user status bel-madrasah.service
```

### Lihat Log
```bash
# Log real-time
journalctl --user -u bel-madrasah.service -f

# Log hari ini
journalctl --user -u bel-madrasah.service --since today

# Log dengan filter
journalctl --user -u bel-madrasah.service --since "2024-01-01" --until "2024-01-02"
```

### Stop/Start Service
```bash
# Stop
systemctl --user stop bel-madrasah.service

# Start
systemctl --user start bel-madrasah.service

# Restart
systemctl --user restart bel-madrasah.service
```

### Testing Manual
```bash
# Test langsung tanpa service
cd ~/bel-madrasah/
python3 main.py
```

## ⚙️ Konfigurasi

### Mengubah Jadwal
Edit file `jadwal.py` untuk menyesuaikan waktu dan audio:

```python
JADWAL = {
    "Senin": [
        ("07:00", "~/bel-sekolah/tone/hymne.mp3"),
        # Tambah/edit jadwal lain
    ],
    # Hari lainnya...
}
```

### Mengubah Volume Audio
Edit fungsi `play_sound()` di `main.py`:
```python
def play_sound(file_path):
    full_path = expand_path(file_path)
    subprocess.Popen([
        "/usr/bin/ffplay", "-nodisp", "-volume", "85",  # Ubah nilai 85
        "-autoexit", full_path
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
```

### Mengubah Interval Pengecekan
Edit nilai `time.sleep(30)` di fungsi `main()` untuk mengubah interval pengecekan (default: 30 detik).

## 🚨 Troubleshooting Umum

### Audio Tidak Diputar
- Cek apakah file audio ada di path yang benar
- Pastikan ffplay terinstall: `which ffplay`
- Cek permission file audio
- Periksa environment variable DISPLAY dan XDG_RUNTIME_DIR

### Service Tidak Start Otomatis
- Pastikan user linger enabled: `sudo loginctl enable-linger username`
- Cek status service: `systemctl --user status bel-madrasah.service`
- Periksa file service di `~/.config/systemd/user/`

### Path File Tidak Ditemukan
- Pastikan menggunakan path absolute atau `~` untuk home directory
- Cek apakah fungsi `expand_path()` bekerja dengan benar

## 📝 Catatan

- Service berjalan setiap 30 detik untuk mengecek jadwal
- Audio hanya diputar sekali untuk setiap waktu yang sama
- System reset setiap hari untuk mencegah duplikasi
- Hanya berjalan di hari Senin-Jumat (weekday 0-4)

## 👨‍💻 Developer

Dikembangkan untuk Madrasah Tsanawiyah Negeri 1 Pandeglang  
User: zulfikriyahya

---

*Untuk pertanyaan atau dukungan teknis, silakan hubungi administrator sistem.*
