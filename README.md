# Bell System Madrasah Tsanawiyah Negeri 1 Pandeglang

<div align="center">

![Bell System](https://img.shields.io/badge/Bell%20System-Madrasah-0056b3?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.6+-3776ab?style=flat-square&logo=python&logoColor=white)
![Linux](https://img.shields.io/badge/Platform-Linux-FCC624?style=flat-square&logo=linux&logoColor=black)
![Systemd](https://img.shields.io/badge/Service-Systemd-A4A6A8?style=flat-square&logo=systemd&logoColor=white)

**Sistem manajemen bel sekolah otomatis berbasis Python dan Systemd. Dirancang khusus untuk kebutuhan operasional Madrasah Tsanawiyah Negeri 1 Pandeglang.**

[Installation](#installation) • [Features](#key-features) • [Documentation](#administration--monitoring) • [Troubleshooting](#troubleshooting)

</div>

---

## Overview

Project ini adalah solusi otomasi bel sekolah yang berjalan di lingkungan Linux. Sistem memanfaatkan `systemd` untuk manajemen service yang reliabel dan `python` untuk logika penjadwalan. Sistem ini mendukung pemutaran audio multi-format, manajemen volume otomatis, dan penjadwalan fleksibel yang mencakup kegiatan rutin harian serta acara khusus (Upacara, Literasi, Rohani, Pramuka).

## Installation

### Automated Deployment (Recommended)

Metode ini akan secara otomatis mengunduh dependensi, file audio, dan mengonfigurasi service systemd.

```bash
wget https://raw.githubusercontent.com/zulfikriyahya/bel-madrasah/main/install.sh
chmod +x install.sh
./install.sh
```

**Installer melakukan tindakan berikut:**
1. Instalasi paket sistem (Python3, FFmpeg, Curl).
2. Mengunduh 25 aset audio dari repositori.
3. Konfigurasi dan aktivasi service systemd.
4. Verifikasi integritas instalasi.

### Manual Installation

Jika Anda memerlukan kontrol penuh atas proses instalasi:

```bash
git clone https://github.com/zulfikriyahya/bel-madrasah.git
cd bel-madrasah
chmod +x install.sh
./install.sh
```

### Uninstallation

Untuk menghapus seluruh sistem dan file konfigurasi:

```bash
wget https://raw.githubusercontent.com/zulfikriyahya/bel-madrasah/main/uninstall.sh
chmod +x uninstall.sh
./uninstall.sh
```

> **Perhatian:** Proses uninstall akan menghapus seluruh direktori project dan konfigurasi tanpa backup.

---

## Key Features

**Core Automation**
*   **Automated Setup:** Script instalasi dan uninstalasi terintegrasi.
*   **Systemd Integration:** Auto-start saat boot dan auto-restart saat crash.
*   **Resource Efficiency:** Penggunaan memori rendah dan manajemen cache audio.

**Audio Management**
*   **Multi-format Support:** Mendukung MP3, WAV, dan format umum lainnya via FFmpeg.
*   **Smart Volume:** Normalisasi volume otomatis (default: 85%).
*   **Concurrency Control:** Mencegah tumpang tindih pemutaran audio.

**Intelligent Scheduling**
*   **Dynamic Schedule:** Mendukung jadwal berbeda untuk Senin (Upacara), Jumat (Rohani/Pramuka), dan hari biasa.
*   **Activity Support:** Audio khusus untuk Literasi, Kebersihan, dan Istirahat.
*   **Holiday Logic:** Otomatis non-aktif pada akhir pekan (Sabtu-Minggu).

---

## Project Structure

```text
bel-madrasah/
├── install.sh              # Script instalasi otomatis
├── uninstall.sh            # Script pembersihan sistem
├── main.py                 # Core logic aplikasi
├── jadwal.py               # Konfigurasi jadwal waktu
├── tone/                   # Direktori aset audio
│   ├── sholawat-*.mp3      # Audio pembukaan
│   ├── pelajaran-*.mp3     # Audio pergantian jam
│   └── [lainnya].mp3       # Audio kegiatan khusus
├── audio-list.txt          # Manifest file audio
└── README.md               # Dokumentasi teknis
```

---

## Jadwal Operasional

<details>
<summary><strong>Senin (Upacara Bendera)</strong></summary>

| Waktu | Kegiatan | Audio Aset |
| :--- | :--- | :--- |
| 06:40 | Pembukaan | Sholawat Badariyah |
| 07:00 | Persiapan Upacara | Mars Madrasah |
| 07:15 | **Upacara Bendera** | Upacara |
| 08:10 | Pelajaran 2 | Pelajaran 2 |
| ... | ... | ... |
| 16:30 | Penutup | Hymne Madrasah |

*(Jadwal lengkap tersimpan di `jadwal.py`)*
</details>

<details>
<summary><strong>Selasa - Rabu (Hari Biasa)</strong></summary>

| Waktu | Kegiatan | Audio Aset |
| :--- | :--- | :--- |
| 06:40 | Pembukaan | Sholawat Jibril (Selasa) / Badariyah (Rabu) |
| 07:00 | Hymne | Mars Madrasah |
| 07:30 | Pelajaran 1 | Pelajaran 1 |
| ... | ... | ... |
| 16:30 | Penutup | Hymne Madrasah |
</details>

<details>
<summary><strong>Kamis (Literasi)</strong></summary>

| Waktu | Kegiatan | Audio Aset |
| :--- | :--- | :--- |
| 06:40 | Pembukaan | Sholawat Jibril |
| 07:15 | **Literasi** | Literasi |
| 08:10 | Pelajaran 2 | Pelajaran 2 |
| 10:00 | Lagu Kebangsaan | Indonesia Raya |
| ... | ... | ... |
</details>

<details>
<summary><strong>Jumat (Rohani & Pramuka)</strong></summary>

| Waktu | Kegiatan | Audio Aset |
| :--- | :--- | :--- |
| 06:40 | Pembukaan | Murotal Yasin |
| 07:15 | **Rohani** | Rohani |
| 14:50 | Akhir Pekan | Akhir Pekan |
| 14:51 | **Pramuka** | Pramuka |
</details>

---

## Administration & Monitoring

### Service Management

Perintah standar untuk mengelola service bel sekolah:

```bash
# Cek status service
systemctl --user status bel-madrasah

# Memulai/Menghentikan service
systemctl --user start bel-madrasah
systemctl --user stop bel-madrasah

# Restart service (diperlukan setelah edit jadwal)
systemctl --user restart bel-madrasah
```

### Logging & Debugging

Gunakan `journalctl` untuk memantau log aktivitas:

```bash
# Monitor log secara real-time
journalctl --user -u bel-madrasah -f

# Melihat log hari ini
journalctl --user -u bel-madrasah --since today
```

### Configuration

**Mengubah Jadwal:**
Edit file `jadwal.py` menggunakan text editor:
```bash
nano ~/bel-madrasah/jadwal.py
# Simpan, lalu restart service
systemctl --user restart bel-madrasah
```

**Mengatur Volume:**
Edit variabel volume pada `main.py`:
```bash
nano ~/bel-madrasah/main.py
# Cari baris: "-volume", "85"
```

---

## System Requirements

| Komponen | Persyaratan | Status |
| :--- | :--- | :--- |
| **OS** | Linux (Ubuntu/Debian/CentOS) | Wajib |
| **Python** | Versi 3.6 atau lebih baru | Wajib |
| **Audio** | FFmpeg / FFplay | Auto-Install |
| **Network** | cURL | Auto-Install |
| **Manager** | Systemd | Wajib |

---

## Troubleshooting

<details>
<summary><strong>Masalah Umum & Solusi</strong></summary>

### Audio Tidak Berbunyi
1. Pastikan file audio ada: `ls -l ~/bel-madrasah/tone/`
2. Test manual dengan FFplay: `ffplay ~/bel-madrasah/tone/mars-madrasah.mp3`
3. Cek volume sistem host (ALSA/PulseAudio).

### Service Gagal Start
1. Cek detail error: `journalctl --user -u bel-madrasah -n 50`
2. Pastikan user memiliki izin *lingering*: `loginctl show-user $USER | grep Linger`
3. Validasi sintaks Python: `python3 ~/bel-madrasah/main.py` (jalankan manual untuk debug).

### File Audio Hilang/Corrupt
Jalankan ulang installer untuk mengunduh kembali aset yang hilang:
```bash
./install.sh
```
</details>

---

## License & Attribution

**Bell System Madrasah Tsanawiyah Negeri 1 Pandeglang**

Developed by **[zulfikriyahya](https://github.com/zulfikriyahya)**.
Disatribusikan untuk penggunaan pendidikan. Kode sumber terbuka untuk dimodifikasi sesuai kebutuhan instansi.
