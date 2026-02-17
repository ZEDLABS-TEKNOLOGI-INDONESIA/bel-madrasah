# Bell System Madrasah Tsanawiyah Negeri 1 Pandeglang

![Python](https://img.shields.io/badge/Python-3.6+-3776ab?style=flat-square&logo=python&logoColor=white)
![Linux](https://img.shields.io/badge/Platform-Linux-FCC624?style=flat-square&logo=linux&logoColor=black)
![Systemd](https://img.shields.io/badge/Service-Systemd-A4A6A8?style=flat-square)
![Headless](https://img.shields.io/badge/Mode-Headless-0056b3?style=flat-square)

Sistem manajemen bel sekolah otomatis berbasis Python dan Systemd. Dirancang untuk berjalan di lingkungan Linux **tanpa monitor (headless)**, menggunakan `ffmpeg` dengan output langsung ke ALSA sehingga tidak memerlukan X display.

---

## Daftar Isi

- [Persyaratan Sistem](#persyaratan-sistem)
- [Instalasi](#instalasi)
- [Struktur Proyek](#struktur-proyek)
- [Jadwal Operasional](#jadwal-operasional)
- [Pengelolaan Service](#pengelolaan-service)
- [Konfigurasi](#konfigurasi)
- [Troubleshooting](#troubleshooting)

---

## Persyaratan Sistem

| Komponen | Persyaratan |
| :--- | :--- |
| OS | Linux (Ubuntu / Debian / CentOS / Arch) |
| Python | 3.6 atau lebih baru |
| Audio | ffmpeg (auto-install) |
| ALSA | alsa-utils (auto-install) |
| Service Manager | Systemd |
| Akses | sudo / root |

Sistem ini **tidak memerlukan monitor, X server, atau desktop environment** dalam kondisi apapun.

---

## Instalasi

### Instalasi Otomatis

```bash
wget https://raw.githubusercontent.com/zulfikriyahya/bel-madrasah/main/install.sh
chmod +x install.sh
sudo ./install.sh
```

Installer akan melakukan:

1. Verifikasi persyaratan sistem
2. Instalasi `ffmpeg`, `curl`, dan `alsa-utils`
3. Pembuatan direktori proyek di `/opt/bel-madrasah`
4. Pembuatan `main.py` dan `jadwal.py`
5. Registrasi dan aktivasi system service di `/etc/systemd/system/`
6. Pengunduhan aset audio dari repositori
7. Pengaturan izin file
8. Verifikasi dan menjalankan service

> Installer harus dijalankan dengan `sudo`. Installer secara otomatis mendeteksi user yang akan menjalankan service.

### Instalasi Manual

```bash
git clone https://github.com/zulfikriyahya/bel-madrasah.git
cd bel-madrasah
chmod +x install.sh
sudo ./install.sh
```

### Uninstalasi

```bash
wget https://raw.githubusercontent.com/zulfikriyahya/bel-madrasah/main/uninstall.sh
chmod +x uninstall.sh
sudo ./uninstall.sh
```

> Proses uninstalasi akan menghapus seluruh direktori `/opt/bel-madrasah` dan konfigurasi service tanpa backup.

---

## Struktur Proyek

```
/opt/bel-madrasah/
├── main.py                 # Logika utama penjadwalan dan pemutaran audio
├── jadwal.py               # Konfigurasi jadwal harian
├── audio-list.txt          # Daftar file audio yang terinstall
└── tone/                   # Direktori aset audio
    ├── mars-madrasah.mp3
    ├── hymne-madrasah.mp3
    ├── indonesia-raya.mp3
    ├── tanah-airku.mp3
    ├── upacara.mp3
    ├── literasi.mp3
    ├── rohani.mp3
    ├── pramuka.mp3
    ├── akhir-pekan.mp3
    ├── istirahat-1.mp3
    ├── istirahat-2.mp3
    ├── kebersihan.mp3
    ├── pelajaran-selesai.mp3
    └── pelajaran-[1-10].mp3
```

Service systemd terdaftar di:

```
/etc/systemd/system/bel-madrasah.service
```

---

## Jadwal Operasional

Sistem secara otomatis menonaktifkan pemutaran pada hari Sabtu dan Minggu.

### Senin — Upacara Bendera

| Waktu | Kegiatan | Audio |
| :--- | :--- | :--- |
| 06:50 | Persiapan | mars-madrasah |
| 07:00 | Upacara Bendera | upacara |
| 08:10 | Pelajaran 2 | pelajaran-2 |
| 08:50 | Pelajaran 3 | pelajaran-3 |
| 09:30 | Pelajaran 4 | pelajaran-4 |
| 10:00 | Lagu Kebangsaan | indonesia-raya |
| 10:10 | Istirahat / Shalat Dhuha | istirahat-1 |
| 10:20 | Kebersihan | kebersihan |
| 10:30 | Pelajaran 5 | pelajaran-5 |
| 11:10 | Pelajaran 6 | pelajaran-6 |
| 11:50 | Istirahat / Shalat Dhuhur | istirahat-2 |
| 12:30 | Kebersihan | kebersihan |
| 12:40 | Pelajaran 7 | pelajaran-7 |
| 13:20 | Pelajaran 8 | pelajaran-8 |
| 14:00 | Pelajaran 9 | pelajaran-9 |
| 14:40 | Pelajaran 10 | pelajaran-10 |
| 15:20 | Pelajaran Selesai | pelajaran-selesai |
| 15:21 | Lagu Penutup | tanah-airku |
| 16:30 | Penutup | hymne-madrasah |

### Selasa — Hari Biasa

| Waktu | Kegiatan | Audio |
| :--- | :--- | :--- |
| 06:50 | Persiapan | mars-madrasah |
| 07:30 | Pelajaran 1 | pelajaran-1 |
| 08:10 | Pelajaran 2 | pelajaran-2 |
| 08:50 | Pelajaran 3 | pelajaran-3 |
| 09:30 | Pelajaran 4 | pelajaran-4 |
| 10:10 | Istirahat / Shalat Dhuha | istirahat-1 |
| 10:20 | Kebersihan | kebersihan |
| 10:30 | Pelajaran 5 | pelajaran-5 |
| 11:10 | Pelajaran 6 | pelajaran-6 |
| 11:50 | Istirahat / Shalat Dhuhur | istirahat-2 |
| 12:30 | Kebersihan | kebersihan |
| 12:40 | Pelajaran 7 | pelajaran-7 |
| 13:20 | Pelajaran 8 | pelajaran-8 |
| 14:00 | Pelajaran 9 | pelajaran-9 |
| 14:40 | Pelajaran 10 | pelajaran-10 |
| 15:20 | Pelajaran Selesai | pelajaran-selesai |
| 15:21 | Lagu Penutup | tanah-airku |
| 16:30 | Penutup | hymne-madrasah |

### Rabu — Hari Biasa

| Waktu | Kegiatan | Audio |
| :--- | :--- | :--- |
| 06:50 | Persiapan | mars-madrasah |
| 07:30 | Pelajaran 1 | pelajaran-1 |
| 08:10 | Pelajaran 2 | pelajaran-2 |
| 08:50 | Pelajaran 3 | pelajaran-3 |
| 09:30 | Pelajaran 4 | pelajaran-4 |
| 10:10 | Istirahat / Shalat Dhuha | istirahat-1 |
| 10:20 | Kebersihan | kebersihan |
| 10:30 | Pelajaran 5 | pelajaran-5 |
| 11:10 | Pelajaran 6 | pelajaran-6 |
| 11:50 | Istirahat / Shalat Dhuhur | istirahat-2 |
| 12:30 | Kebersihan | kebersihan |
| 12:40 | Pelajaran 7 | pelajaran-7 |
| 13:20 | Pelajaran 8 | pelajaran-8 |
| 14:00 | Pelajaran 9 | pelajaran-9 |
| 14:40 | Pelajaran 10 | pelajaran-10 |
| 15:20 | Pelajaran Selesai | pelajaran-selesai |
| 15:21 | Lagu Penutup | tanah-airku |
| 16:30 | Penutup | hymne-madrasah |

### Kamis — Literasi

| Waktu | Kegiatan | Audio |
| :--- | :--- | :--- |
| 06:50 | Persiapan | mars-madrasah |
| 07:00 | Literasi | literasi |
| 08:10 | Pelajaran 2 | pelajaran-2 |
| 08:50 | Pelajaran 3 | pelajaran-3 |
| 09:30 | Pelajaran 4 | pelajaran-4 |
| 10:00 | Lagu Kebangsaan | indonesia-raya |
| 10:10 | Istirahat / Shalat Dhuha | istirahat-1 |
| 10:20 | Kebersihan | kebersihan |
| 10:30 | Pelajaran 5 | pelajaran-5 |
| 11:10 | Pelajaran 6 | pelajaran-6 |
| 11:50 | Istirahat / Shalat Dhuhur | istirahat-2 |
| 12:30 | Kebersihan | kebersihan |
| 12:40 | Pelajaran 7 | pelajaran-7 |
| 13:20 | Pelajaran 8 | pelajaran-8 |
| 14:00 | Pelajaran 9 | pelajaran-9 |
| 14:40 | Pelajaran 10 | pelajaran-10 |
| 15:20 | Pelajaran Selesai | pelajaran-selesai |
| 15:21 | Lagu Penutup | tanah-airku |
| 16:30 | Penutup | hymne-madrasah |

### Jumat — Rohani & Pramuka

| Waktu | Kegiatan | Audio |
| :--- | :--- | :--- |
| 06:50 | Persiapan | mars-madrasah |
| 07:00 | Rohani / Dzikir Jum'at | rohani |
| 08:10 | Pelajaran 3 | pelajaran-3 |
| 08:50 | Pelajaran 4 | pelajaran-4 |
| 09:30 | Istirahat / Shalat Dhuha | istirahat-1 |
| 09:40 | Kebersihan | kebersihan |
| 10:10 | Pelajaran 5 | pelajaran-5 |
| 10:40 | Pelajaran 6 | pelajaran-6 |
| 11:20 | Ibadah Jum'at | istirahat-2 |
| 12:50 | Pelajaran 7 | pelajaran-7 |
| 13:30 | Pelajaran 8 | pelajaran-8 |
| 14:10 | Akhir Pekan | akhir-pekan |
| 14:11 | Lagu Penutup | tanah-airku |
| 14:12 | Pramuka | pramuka |
| 16:00 | Penutup | hymne-madrasah |

---

## Pengelolaan Service

Service berjalan sebagai **system service** (bukan user service), sehingga otomatis aktif saat boot tanpa memerlukan login.

```bash
sudo systemctl status  bel-madrasah
sudo systemctl start   bel-madrasah
sudo systemctl stop    bel-madrasah
sudo systemctl restart bel-madrasah
```

Memantau log secara real-time:

```bash
sudo journalctl -u bel-madrasah -f
```

Melihat log hari ini:

```bash
sudo journalctl -u bel-madrasah --since today
```

---

## Konfigurasi

### Mengubah Jadwal

Edit file `jadwal.py`, kemudian restart service:

```bash
sudo nano /opt/bel-madrasah/jadwal.py
sudo systemctl restart bel-madrasah
```

Setiap entri jadwal mengikuti format berikut:

```python
("HH:MM", f"{BASE}/nama-file.mp3"),
```

### Mengubah Volume

Edit variabel `VOLUME` di `main.py`. Nilai berupa desimal antara `0.0` hingga `1.0`:

```bash
sudo nano /opt/bel-madrasah/main.py
sudo systemctl restart bel-madrasah
```

### Menambah File Audio

Salin file audio ke direktori tone, kemudian tambahkan entri ke `jadwal.py`:

```bash
sudo cp nama-file.mp3 /opt/bel-madrasah/tone/
sudo systemctl restart bel-madrasah
```

---

## Troubleshooting

### Audio Tidak Berbunyi

Pastikan ALSA dapat mendeteksi perangkat audio:

```bash
aplay -l
```

Uji pemutaran manual langsung via ffmpeg:

```bash
ffmpeg -hide_banner -loglevel error \
  -i /opt/bel-madrasah/tone/mars-madrasah.mp3 \
  -f alsa default
```

Jika perangkat audio bukan `default`, sesuaikan nama device di `main.py`:

```python
"-f", "alsa", "hw:0,0"
```

### Service Gagal Start

Periksa detail error:

```bash
sudo journalctl -u bel-madrasah -n 50
```

Validasi sintaks Python secara manual:

```bash
cd /opt/bel-madrasah
python3 -c "from jadwal import JADWAL; print('OK')"
```

Jalankan `main.py` langsung untuk melihat output error:

```bash
sudo python3 /opt/bel-madrasah/main.py
```

### File Audio Hilang atau Rusak

Jalankan ulang installer untuk mengunduh kembali semua aset:

```bash
sudo ./install.sh
```

Atau unduh file tertentu secara manual:

```bash
BASE_URL="https://raw.githubusercontent.com/zulfikriyahya/bel-madrasah/main/tone"
sudo curl -L -o /opt/bel-madrasah/tone/nama-file.mp3 "$BASE_URL/nama-file.mp3"
```

### Waktu Bel Tidak Tepat

Pastikan timezone sistem sudah benar:

```bash
timedatectl
sudo timedatectl set-timezone Asia/Jakarta
```

---

## Lisensi

Didistribusikan untuk keperluan pendidikan. Kode sumber terbuka untuk dimodifikasi sesuai kebutuhan instansi.

Dikembangkan oleh [zulfikriyahya](https://github.com/zulfikriyahya) untuk MTsN 1 Pandeglang.
