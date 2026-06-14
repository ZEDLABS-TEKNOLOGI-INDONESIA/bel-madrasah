# Bel Madrasah

Sistem bel otomatis berbasis web untuk MTsN 1 Pandeglang. Aplikasi ini berjalan di server lokal dan memungkinkan pengelolaan jadwal bel secara terpusat melalui antarmuka web yang dapat diakses dari perangkat apa pun dalam jaringan yang sama.

---

## Fitur

- Penjadwalan bel otomatis berdasarkan hari dan waktu
- Empat mode jadwal: Reguler, Ramadhan, PTS, dan PAS
- Pergantian mode otomatis berdasarkan rentang tanggal yang dikonfigurasi
- Override manual untuk memaksa mode tertentu
- Manajemen hari libur — bel tidak akan berbunyi pada tanggal yang terdaftar
- Unggah dan kelola file audio (MP3, WAV, OGG)
- Preview audio langsung dari antarmuka web
- Log aktivitas bel yang telah diputar
- Backup dan restore data jadwal dalam format JSON
- Ganti password akses
- Dukungan PWA — dapat dipasang sebagai aplikasi di layar utama perangkat

---

## Teknologi

- Backend: Go (Golang)
- Frontend: HTML, CSS, JavaScript (Vanilla)
- Font: Lexend (Google Fonts)
- Audio: diputar langsung oleh server melalui perangkat output yang terhubung

---

## Struktur Direktori

```
bel-madrasah/
├── main.go
├── handler.go
├── auth.go
├── storage.go
├── pwa.go
├── go.mod
├── go.sum
├── install.sh
├── uninstall.sh
├── generate.sh
├── tone/
│   └── (file audio .mp3 / .wav / .ogg)
└── static/
    ├── index.html
    ├── style.css
    ├── script.js
    ├── login.html
    ├── login.css
    ├── login.js
    ├── offline.html
    ├── manifest.json
    ├── sw.js
    └── icons/
        ├── favicon.ico
        ├── icon-192.png
        └── icon-512.png
```

---

## Instalasi

### Persyaratan

- Go 1.21 atau lebih baru
- Sistem operasi Linux (direkomendasikan Raspberry Pi OS atau Debian)
- Perangkat audio yang terhubung ke server

### Instalasi Otomatis

Proyek ini menyertakan script instalasi yang akan mengurus build, penempatan file, dan pendaftaran service secara otomatis.

```bash
wget -O install.sh https://raw.githubusercontent.com/ZEDLABS-TEKNOLOGI-INDONESIA/bel-madrasah/server/install.sh
chmod +x install.sh
sudo ./install.sh
```

### Instalasi Manual

1. Download dependensi.

```bash
go mod tidy
```

2. Build binary.

```bash
go build -o bel-madrasah .
```

3. Salin binary dan direktori static ke lokasi instalasi.

```bash
sudo mkdir -p /opt/bel-madrasah
sudo cp bel-madrasah /opt/bel-madrasah/
sudo cp -r static /opt/bel-madrasah/
sudo cp -r tone /opt/bel-madrasah/
```

4. Jalankan binary.

```bash
/opt/bel-madrasah/bel-madrasah
```

Aplikasi akan berjalan pada `http://0.0.0.0:8081` secara default.

### Jalankan Tanpa Build (mode development)

```bash
go run .
```

---

## Menjalankan sebagai Service (systemd)

Script `install.sh` sudah menangani pendaftaran service secara otomatis. Jika ingin mendaftarkan secara manual, buat file `/etc/systemd/system/bel-madrasah.service`:

```ini
[Unit]
Description=Bel Madrasah
After=network.target

[Service]
User=pi
WorkingDirectory=/opt/bel-madrasah
ExecStart=/opt/bel-madrasah/bel-madrasah
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Aktifkan dan jalankan service.

```bash
sudo systemctl daemon-reload
sudo systemctl enable bel-madrasah
sudo systemctl start bel-madrasah
```

---

## Uninstall

Untuk menghapus aplikasi beserta service-nya, jalankan script uninstall.

```bash
wget -O uninstall.sh https://raw.githubusercontent.com/ZEDLABS-TEKNOLOGI-INDONESIA/bel-madrasah/server/uninstall.sh
chmod +x uninstall.sh
sudo ./uninstall.sh
```

---

## Konfigurasi

Konfigurasi disimpan dalam format JSON dan dapat dikelola langsung melalui halaman Mode Bel di antarmuka web.

| Parameter | Keterangan |
|---|---|
| `mode` | Mode aktif saat ini (reguler / ramadhan / pts / pas) |
| `manual_override` | Jika `true`, mode dipaksakan secara manual |
| `ramadhan_start` | Tanggal mulai jadwal Ramadhan (format YYYY-MM-DD) |
| `ramadhan_end` | Tanggal akhir jadwal Ramadhan |
| `pts_start` | Tanggal mulai PTS |
| `pts_end` | Tanggal akhir PTS |
| `pas_start` | Tanggal mulai PAS |
| `pas_end` | Tanggal akhir PAS |

Prioritas mode otomatis dari tertinggi ke terendah: PTS / PAS > Ramadhan > Reguler.

---

## API Endpoint

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/service/status` | Status scheduler dan mode aktif |
| POST | `/api/service/toggle` | Aktifkan atau hentikan scheduler |
| GET | `/api/config` | Ambil konfigurasi |
| POST | `/api/config` | Simpan konfigurasi |
| GET | `/api/jadwal` | Ambil jadwal berdasarkan mode |
| POST | `/api/jadwal/hari` | Tambah atau hapus hari |
| POST | `/api/jadwal/entry` | Tambah, edit, atau hapus entri bel |
| GET | `/api/libur` | Ambil daftar hari libur |
| POST | `/api/libur` | Tambah atau hapus hari libur |
| GET | `/api/tones` | Daftar file audio |
| POST | `/api/tones/upload` | Unggah file audio |
| POST | `/api/tones/preview` | Putar file audio sebagai preview |
| POST | `/api/tones/delete` | Hapus file audio |
| GET | `/api/log` | Ambil log aktivitas bel |
| GET | `/api/backup` | Unduh backup data dalam format JSON |
| POST | `/api/restore` | Restore data dari file JSON |
| POST | `/api/change-password` | Ganti password akses |

---

## Penggunaan

### Menambah Jadwal Bel

1. Buka halaman Jadwal.
2. Pilih mode pembelajaran yang diinginkan.
3. Tambahkan nama hari jika belum ada.
4. Pilih hari, lalu klik Tambah Bel.
5. Isi waktu dan pilih file audio, kemudian simpan.

### Mengelola Hari Libur

1. Buka halaman Hari Libur.
2. Pilih tanggal dan klik Tambah.
3. Bel tidak akan berbunyi pada tanggal yang terdaftar, terlepas dari jadwal yang ada.

### Mengunggah Audio

1. Buka halaman Audio.
2. Klik area unggah atau seret file audio ke dalamnya.
3. File yang berhasil diunggah akan langsung tersedia untuk dipilih saat membuat entri bel.

### Backup dan Restore

1. Buka halaman Pengaturan.
2. Klik Unduh Backup untuk mengekspor seluruh data jadwal.
3. Untuk memulihkan, klik Restore dari File dan pilih file JSON hasil backup.

---

## Cross-Compile untuk Raspberry Pi

Jika build dilakukan dari mesin lain, gunakan cross-compilation.

```bash
GOOS=linux GOARCH=arm64 go build -o bel-madrasah .
```

Untuk Raspberry Pi generasi lama (32-bit):

```bash
GOOS=linux GOARCH=arm GOARM=7 go build -o bel-madrasah .
```

---

## Akses

Setelah server berjalan, antarmuka web dapat diakses melalui browser pada alamat:

```
http://<ip-server>:8081
```

Ganti `<ip-server>` dengan alamat IP server di jaringan lokal. Untuk akses dari perangkat yang sama dengan server, gunakan `http://localhost:8081`.

---

## Lisensi

Lihat file `LICENSE` untuk informasi lisensi.
