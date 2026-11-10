# bel-madrasah

Sistem bel sekolah otomatis berbasis web. Backend ditulis dalam Go, frontend dibangun dengan Astro + React + Tailwind CSS. Audio diputar langsung oleh server melalui ALSA menggunakan ffmpeg.

---

## Stack

| Layer | Teknologi |
|---|---|
| Backend | Go 1.21+, net/http, bcrypt, ALSA via ffmpeg |
| Frontend | Astro 7, React 19, TanStack Query 5, Tailwind CSS 4, Framer Motion |
| Package manager | pnpm |
| Audio | ffmpeg `-filter:a <equalizer>,volume=X -f alsa` |
| Auth | Session cookie (HttpOnly, SameSite=Lax), bcrypt cost 10, sesi disimpan ter-hash di `data/sessions.json` sehingga tetap berlaku setelah restart |
| Storage | JSON flat-file (`/opt/bel-madrasah/data/`) |

---

## Struktur Direktori

```
bel-madrasah/
├── server/                  # Backend Go (package main), satu berkas per domain
│   ├── main.go              # Entry point, wiring, graceful shutdown
│   ├── paths.go             # BEL_BASE_DIR dan semua path berkas
│   ├── routes.go            # Daftar seluruh route HTTP
│   ├── static.go            # Halaman panel (ditemukan dari static/), landing, PWA, aset precompressed
│   ├── middleware.go        # CORS, batas ukuran body
│   ├── respond.go           # jsonOK, jsonError
│   ├── auth.go              # User, sesi (persisten, ter-hash), throttling login
│   ├── config.go            # Config, mode aktif, hari libur
│   ├── jadwal.go            # Penyimpanan jadwal
│   ├── jadwal_default.go    # Jadwal bawaan
│   ├── activity.go          # Log aktivitas dan rotasi
│   ├── tones.go             # Berkas audio: sanitasi, resolusi path, pemakaian di jadwal
│   ├── equalizer.go         # Filter ffmpeg equalizer
│   ├── player.go            # Pemutaran ffmpeg ke ALSA
│   ├── scheduler.go         # Loop scheduler bel
│   ├── storage.go           # Inisialisasi data, atomicWrite
│   ├── api_*.go             # Handler HTTP per domain (auth, config, jadwal, tones, libur, system)
│   └── *_test.go            # Uji backend
├── src/                     # Frontend Astro + React (lihat konsep.md bagian 3)
│   ├── pages/               # [...page].astro (semua halaman panel dari routes.ts), landing, login, 404
│   ├── components/          # Komponen per fitur, ui/, layout/
│   ├── hooks/               # Satu hook TanStack Query per resource
│   ├── lib/                 # Konfigurasi, data layer, utilitas
│   └── styles/global.css
├── public/                  # Ikon, manifest, service worker
├── tests/                   # Uji unit frontend (*.test.mjs) dan tests/e2e/
├── scripts/                 # install, uninstall, update, deploy, package, precompress, release-notes
├── .github/workflows/       # ci.yml, release.yml
├── CHANGELOG.md             # Catatan per release, dipakai workflow Release
├── tone/                    # File audio bawaan
├── konsep.md                # Standar frontend dan kontrak backend
└── go.mod                   # Modul Go di root, build dengan ./server
```

---

## Instalasi

### Persyaratan

- Go 1.21+
- Node.js 22+
- pnpm
- ffmpeg
- alsa-utils
- Linux dengan systemd

### Otomatis

```bash
git clone https://github.com/ZEDLABS-TEKNOLOGI-INDONESIA/bel-madrasah.git
cd bel-madrasah
sudo ./scripts/install.sh
```

Script mendeteksi audio backend (PipeWire > PulseAudio > ALSA), memilih ALSA device, build frontend dan backend, mendaftarkan systemd service, dan mengkonfigurasi nginx sebagai reverse proxy.

### Manual

```bash
# Build frontend
pnpm install --frozen-lockfile
pnpm build

# Salin output ke static/
cp -r dist/. /opt/bel-madrasah/static/

# Build backend
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /opt/bel-madrasah/bel-madrasah ./server

# Buat direktori data
mkdir -p /opt/bel-madrasah/{data,tone}
```

### Cross-compile untuk ARM

```bash
# arm64 (Raspberry Pi 4+)
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bel-madrasah ./server

# armv7 (Raspberry Pi 3 dan sebelumnya)
GOOS=linux GOARCH=arm GOARM=7 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bel-madrasah ./server
```

---

## Environment Variables

| Variable | Default | Keterangan |
|---|---|---|
| `BEL_TLS` | `0` | Set `1` untuk enforce Secure cookie dan HTTPS |
| `BEL_TRUST_PROXY` | `0` | Set `1` untuk baca `X-Forwarded-For` / `X-Real-IP` |
| `BEL_ORIGINS` | localhost | Comma-separated list origin yang diizinkan CORS |
| `BEL_ALSA_DEVICE` | kosong | Opsional. Perangkat ALSA bila tidak dipilih di Pengaturan. `hw:` otomatis diubah menjadi `plughw:`. Kosongkan untuk deteksi otomatis |
| `BEL_BASE_DIR` | `/opt/bel-madrasah` | Direktori dasar `tone/`, `data/`, dan `static/`. Ubah hanya untuk pengembangan lokal atau pengujian |

Variabel dibaca dari environment, bukan dari file `.env` di production. File `.env` hanya digunakan saat development Astro (Vite proxy).

---

## Pengujian

```bash
pnpm check    # astro sync dan tsc
pnpm test     # unit test frontend (node:test) lalu go test ./...
pnpm e2e      # build, jalankan server sementara, uji tampilan 360px/1280px dan alur utama di Chromium headless
```

Uji backend dan e2e memakai direktori sementara (`setBaseDir` / `BEL_BASE_DIR`), sehingga tidak menyentuh `/opt/bel-madrasah`. Uji e2e membutuhkan Go dan Chromium atau Chrome (atur `CHROME_BIN` bila tidak di lokasi standar).

### Deploy manual

```bash
HOST=server-ssh ./scripts/deploy.sh
```

Jalur cadangan bila tidak memakai release: membangun frontend dan backend arm64 dari working tree, mengunggah lewat SSH, mengganti binary dengan cadangan, lalu mengecek `/healthz`. Jalur utama adalah release dan update otomatis.

---

## CI/CD dan Update Otomatis

```
push ke main ──► CI: format, lint skrip, tsc, go vet, unit test, e2e
tag vX.Y.Z   ──► CI ──► Release: paket linux-amd64/arm64/armv7 + checksums.txt
                                  │
server bel ◄── timer tiap jam ────┘  unduh, verifikasi, pasang, health check, rollback
```

### Membuat release

1. Tambahkan bagian `## vX.Y.Z` di `CHANGELOG.md` dan commit ke `main`.
2. Buat dan push tag:

```bash
git tag -a v2.1.0 -m "v2.1.0"
git push origin v2.1.0
```

Workflow `Release` menjalankan seluruh CI, membangun paket (`scripts/package.sh`), memverifikasi checksum dan versi binary, lalu menerbitkan GitHub Release dengan catatan dari `CHANGELOG.md`. Tag yang bukan commit di `main` atau tidak punya catatan di changelog ditolak.

### Update otomatis di server

Installer memasang `/usr/local/sbin/bel-madrasah-update` dan timer systemd `bel-madrasah-update.timer` (10 menit setelah boot, lalu setiap jam dengan jeda acak hingga 15 menit). Setiap kali berjalan, updater:

1. Membandingkan `bel-madrasah --version` dengan release terbaru di GitHub
2. Mengunduh paket sesuai arsitektur dan memverifikasi SHA-256 dari `checksums.txt`
3. Mencadangkan binary dan `static/`, mengganti keduanya, lalu menjalankan ulang service
4. Mengecek `/healthz`; bila gagal dalam 20 detik, versi lama dipulihkan

`data/` dan `tone/` tidak pernah disentuh. Restart aman kapan saja: bel yang sudah berbunyi hari ini dibaca ulang dari log aktivitas sehingga tidak berbunyi dua kali.

```bash
sudo bel-madrasah-update --check          # versi terpasang dan terbaru
sudo bel-madrasah-update --dry-run        # unduh dan verifikasi tanpa memasang
sudo bel-madrasah-update                  # pasang sekarang
sudo bel-madrasah-update --version v2.0.0 # pasang versi tertentu (rollback manual)
sudo journalctl -u bel-madrasah-update    # riwayat update
```

Konfigurasi ada di `/etc/default/bel-madrasah-update`. Set `BEL_UPDATE_DISABLED=1` untuk menghentikan update otomatis.

Server yang dipasang sebelum v2.0.0 belum memiliki updater; jalankan `sudo ./scripts/install.sh` sekali dari clone terbaru.

---

## Systemd Service

```ini
[Unit]
Description=Bel Madrasah Otomatis
After=sound.target network.target
Wants=sound.target

[Service]
Type=simple
ExecStart=/opt/bel-madrasah/bel-madrasah
Restart=on-failure
RestartSec=10
User=<user>
Group=audio
StandardOutput=journal
StandardError=journal
WorkingDirectory=/opt/bel-madrasah
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/bel-madrasah/data /opt/bel-madrasah/tone
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl status bel-madrasah
sudo journalctl -u bel-madrasah -f
```

---

## API Reference

Semua endpoint kecuali `/login`, `/logout`, dan `/healthz` memerlukan session cookie yang valid. Request tanpa session dikembalikan `401` untuk JSON request atau redirect ke `/login` untuk browser request.

### Config

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/config` | Ambil config lengkap beserta `active_mode` dan `is_libur` |
| POST | `/api/config` | Simpan config. Body: `Config` object |
| GET | `/api/volume` | Ambil volume saat ini |
| POST | `/api/volume` | Set volume. Body: `{"volume": 0.0–2.0}` |
| GET | `/api/audio/devices` | Daftar output ALSA (`devices`), pilihan tersimpan (`selected`, kosong berarti otomatis), perangkat yang dipakai (`active`), dan asalnya (`source`: pengaturan, env, otomatis) |
| POST | `/api/audio/devices` | Simpan pilihan. Body: `{"device": ""}` untuk otomatis, `"default"`, atau salah satu `id` dari daftar |
| POST | `/api/audio/test` | Putar bunyi tes pada perangkat di body (`{"device": ...}`, aturan sama). `502` berisi galat ALSA bila speaker tidak dapat dibuka |
| GET | `/api/equalizer` | Ambil equalizer: `enabled`, `gains` (dB), `frequencies` (Hz), `min_gain`, `max_gain` |
| POST | `/api/equalizer` | Simpan equalizer. Body: `{"enabled": bool, "gains": [5 angka, -12 sampai 12]}`. Berlaku mulai pemutaran berikutnya |

### Jadwal

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/jadwal?mode=<mode>` | Ambil jadwal untuk mode tertentu |
| POST | `/api/jadwal/entry` | Add/edit/delete/preview/stop entry. Body: `{action, mode, hari, index, entry}`. `entry.audio` boleh nama file saja, server melengkapinya dengan direktori tone |
| POST | `/api/jadwal/day-toggle` | Aktifkan atau nonaktifkan hari. Body: `{mode, hari, disable}` |

### Audio

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/tones` | List file audio. Query: `page`, `per_page` (max 500). `usage` memuat jumlah entri jadwal per file |
| GET | `/api/tones/<filename>` | Stream file audio |
| POST | `/api/tones/upload` | Upload file. Multipart, field `file`, max 32MB |
| POST | `/api/tones/delete` | Hapus file beserta entri jadwal yang memakainya. Body: `{"filename": "..."}`. Respons memuat `removed` |
| POST | `/api/tones/rename` | Ganti nama file. Body: `{"filename": "...", "new_name": "..."}`. Ekstensi dipertahankan, nama disanitasi, entri jadwal yang memakai file ikut diperbarui. `409` bila nama sudah dipakai |
| POST | `/api/tones/preview` | Putar file di server. Body: `{"filename": "..."}` |
| POST | `/api/tones/stop` | Stop semua audio yang sedang diputar |

### Libur

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/libur` | List tanggal libur lokal |
| POST | `/api/libur` | Add/delete libur. Body: `{action, date, keterangan}` |
| GET | `/api/libur/nasional?year=<year>` | Proxy ke `api.kemendesa.link/libur-nasional` |

### Service & Misc

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/service/status` | Status scheduler, mode aktif, volume, now playing |
| POST | `/api/service/toggle` | Toggle scheduler on/off |
| GET | `/api/log` | Ambil log aktivitas (max 500, urutan terbaru di atas) |
| POST | `/api/log/reset` | Kosongkan log |
| GET | `/api/backup` | Download jadwal sebagai JSON |
| POST | `/api/restore` | Restore jadwal dari file JSON. Multipart, field `file`, max 4MB. Path audio dipindahkan ke direktori tone server ini, sehingga backup dapat dipakai lintas instalasi |
| POST | `/api/change-password` | Ganti password. Body: `{old_password, new_password}` |
| GET | `/healthz` | Health check, response `200 ok` |

---

## Mode Jadwal

| Mode | Keterangan |
|---|---|
| `reguler` | Mode default |
| `ramadhan` | Aktif otomatis dalam rentang `ramadhan_start` – `ramadhan_end` |
| `pts` | Aktif otomatis, prioritas lebih tinggi dari ramadhan |
| `pas` | Aktif otomatis, prioritas sama dengan pts |
| `pesantren` | Tidak dijalankan scheduler, untuk keperluan khusus |
| `lainnya` | Tidak dijalankan scheduler |

Resolusi mode (tanpa manual override): PTS/PAS > Pesantren > Ramadhan > Reguler, berdasarkan tanggal hari ini dibandingkan rentang yang dikonfigurasi.

---

## Scheduler

Scheduler berjalan di goroutine terpisah dengan interval 20 detik. Setiap iterasi:

1. Cek apakah scheduler di-pause via toggle
2. Auto-cleanup log mingguan
3. Cek apakah hari ini libur
4. Resolve mode aktif
5. Skip jika mode `pesantren` atau `lainnya`
6. Skip jika hari ini di-disable untuk mode tersebut
7. Cocokkan waktu `HH:MM` dengan entry jadwal
8. Jika cocok dan belum diputar hari ini, jalankan `playSound` di goroutine baru dan tulis log

Entry yang sudah diputar di-track dengan key `mode|hari|waktu` dalam map per-hari. Map di-reset setiap pergantian hari.

---

## Audio Playback

```go
exec.Command(ffmpegPath,
    "-hide_banner", "-loglevel", "error",
    "-i", filePath,
    "-filter:a", "volume="+vol,
    "-f", "alsa", alsaDevice(),
)
```

Volume dibaca dari config saat `playSound` dipanggil (range `0.0`–`2.0`, nilai di atas `1.0` adalah amplifikasi software). Perubahan volume berlaku pada playback berikutnya.

Hanya satu proses ffmpeg yang berjalan pada satu waktu. `stopAllProcs` kill semua proses aktif sebelum memulai yang baru.

---

## Auth

- Single user, disimpan di `/opt/bel-madrasah/data/users.json`
- Password di-hash dengan bcrypt (cost 10)
- Session token 32-byte random hex, disimpan in-memory, TTL 8 jam
- Login throttling: 5 kali gagal → lockout 15 menit per IP
- Default credential saat pertama install: `administrator` / `P@ssw0rd`

---

## Storage

Semua data disimpan sebagai JSON di `/opt/bel-madrasah/data/`:

| File | Isi |
|---|---|
| `config.json` | Mode, date ranges, libur, volume, disabled days |
| `jadwal.json` | Map `mode → hari → []Entry{waktu, audio}` |
| `activity.log` | NDJSON, maks 500 baris, auto-rotate di 1000 |
| `users.json` | Single user object dengan password hash |

Write menggunakan atomic rename (`file.tmp` → `file`) untuk menghindari corruption.

---

## Development

```bash
# Terminal 1 - backend
go run .

# Terminal 2 - frontend (Vite dev server dengan proxy ke backend)
pnpm dev
```

Vite dikonfigurasi untuk proxy `/api`, `/login`, `/logout`, `/healthz` ke `http://localhost:8083`. Frontend dev server berjalan di port 4321.

```bash
# Rebuild setelah perubahan Go
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /opt/bel-madrasah/bel-madrasah .
sudo systemctl restart bel-madrasah

# Rebuild setelah perubahan frontend
pnpm build
sudo cp -r dist/. /opt/bel-madrasah/static/
sudo systemctl restart bel-madrasah
```

---

## Uninstall

```bash
sudo /opt/bel-madrasah/uninstall.sh
```
