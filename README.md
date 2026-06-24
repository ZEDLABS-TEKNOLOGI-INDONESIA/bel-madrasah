# bel-madrasah

Sistem bel sekolah otomatis berbasis web. Backend ditulis dalam Go, frontend dibangun dengan Astro + React + Tailwind CSS. Audio diputar langsung oleh server melalui ALSA menggunakan ffmpeg.

---

## Stack

| Layer | Teknologi |
|---|---|
| Backend | Go 1.21+, net/http, bcrypt, ALSA via ffmpeg |
| Frontend | Astro 7, React 19, TanStack Query 5, Tailwind CSS 4, Framer Motion |
| Package manager | pnpm |
| Audio | ffmpeg `-filter:a volume=X -f alsa` |
| Auth | Session cookie (HttpOnly, SameSite=Lax), bcrypt cost 10 |
| Storage | JSON flat-file (`/opt/bel-madrasah/data/`) |

---

## Struktur Direktori

```
bel-madrasah/
├── main.go            # Entry point, scheduler, audio playback
├── handler.go         # HTTP handlers semua endpoint API
├── auth.go            # Session management, login throttling, bcrypt
├── storage.go         # Read/write JSON (jadwal, config, log)
├── middleware.go      # CORS, max body size
├── pwa.go             # Service worker route
├── go.mod
├── go.sum
├── install.sh
├── uninstall.sh
├── src/
│   ├── components/    # React components per fitur
│   ├── hooks/         # TanStack Query hooks
│   ├── lib/           # api.ts, queryClient.ts, theme.ts, router.ts
│   ├── pages/         # Astro pages (index, jadwal, audio, libur, log, settings, login)
│   └── styles/
│       └── global.css
├── tone/              # File audio (.mp3 .wav .ogg)
└── static/            # Output build Astro (dist → static)
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
sudo ./install.sh
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
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /opt/bel-madrasah/bel-madrasah .

# Buat direktori data
mkdir -p /opt/bel-madrasah/{data,tone}
```

### Cross-compile untuk ARM

```bash
# arm64 (Raspberry Pi 4+)
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bel-madrasah .

# armv7 (Raspberry Pi 3 dan sebelumnya)
GOOS=linux GOARCH=arm GOARM=7 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bel-madrasah .
```

---

## Environment Variables

| Variable | Default | Keterangan |
|---|---|---|
| `BEL_TLS` | `0` | Set `1` untuk enforce Secure cookie dan HTTPS |
| `BEL_TRUST_PROXY` | `0` | Set `1` untuk baca `X-Forwarded-For` / `X-Real-IP` |
| `BEL_ORIGINS` | localhost | Comma-separated list origin yang diizinkan CORS |
| `BEL_ALSA_DEVICE` | `hw:1,0` | ALSA device untuk output audio |

Variabel dibaca dari environment, bukan dari file `.env` di production. File `.env` hanya digunakan saat development Astro (Vite proxy).

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

### Jadwal

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/jadwal?mode=<mode>` | Ambil jadwal untuk mode tertentu |
| POST | `/api/jadwal/entry` | Add/edit/delete/preview/stop entry. Body: `{action, mode, hari, index, entry}` |
| POST | `/api/jadwal/day-toggle` | Aktifkan atau nonaktifkan hari. Body: `{mode, hari, disable}` |

### Audio

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/tones` | List file audio. Query: `page`, `per_page` (max 500) |
| GET | `/api/tones/<filename>` | Stream file audio |
| POST | `/api/tones/upload` | Upload file. Multipart, field `file`, max 32MB |
| POST | `/api/tones/delete` | Hapus file. Body: `{"filename": "..."}` |
| POST | `/api/tones/preview` | Putar file di server. Body: `{"filename": "..."}` |
| POST | `/api/tones/stop` | Stop semua audio yang sedang diputar |

### Libur

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/libur` | List tanggal libur lokal |
| POST | `/api/libur` | Add/delete libur. Body: `{action, date, keterangan}` |
| GET | `/api/libur/nasional?year=<year>` | Proxy ke `libur.deno.dev/api` |

### Service & Misc

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/service/status` | Status scheduler, mode aktif, volume, now playing |
| POST | `/api/service/toggle` | Toggle scheduler on/off |
| GET | `/api/log` | Ambil log aktivitas (max 500, urutan terbaru di atas) |
| POST | `/api/log/reset` | Kosongkan log |
| GET | `/api/backup` | Download jadwal sebagai JSON |
| POST | `/api/restore` | Restore jadwal dari file JSON. Multipart, field `file`, max 4MB |
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
# Terminal 1 — backend
go run .

# Terminal 2 — frontend (Vite dev server dengan proxy ke backend)
pnpm dev
```

Vite dikonfigurasi untuk proxy `/api`, `/login`, `/logout`, `/healthz` ke `http://localhost:8082`. Frontend dev server berjalan di port 4321.

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
