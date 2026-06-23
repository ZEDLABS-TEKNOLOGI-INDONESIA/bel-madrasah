# API Documentation — Bel Madrasah

Base URL: `http://<host>:8082`
Auth: Cookie `bel_session` (didapat setelah login)

---

## Auth

### POST `/login`
```json
// Request
{ "username": "administrator", "password": "P@ssw0rd" }

// Response 200
{ "message": "login berhasil" }

// Response 401
{ "error": "username atau password salah" }

// Response 429
{ "error": "terlalu banyak percobaan gagal, coba lagi dalam 5 menit" }
```

### GET `/logout`
Redirect ke `/login`, cookie dihapus.

### POST `/api/change-password`
```json
// Request
{ "old_password": "P@ssw0rd", "new_password": "NewPass123" }

// Response 200
{ "message": "password berhasil diubah" }
```

---

## Config

### GET `/api/config`
```json
// Response 200
{
  "config": {
    "mode": "reguler",
    "manual_override": false,
    "ramadhan_start": "2025-03-01",
    "ramadhan_end": "2025-03-30",
    "pts_start": "", "pts_end": "",
    "pas_start": "", "pas_end": "",
    "pesantren_start": "", "pesantren_end": "",
    "libur_dates": [],
    "volume": 0.85,
    "disabled_days": { "reguler": ["Sabtu", "Minggu"] }
  },
  "active_mode": "reguler",
  "is_libur": false,
  "is_playing": false,
  "now_playing": "",
  "all_modes": ["reguler","ramadhan","pts","pas","pesantren","lainnya"],
  "all_hari": ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"]
}
```

### POST `/api/config`
```json
// Request — kirim seluruh object config
{
  "mode": "reguler",
  "manual_override": false,
  "ramadhan_start": "2025-03-01",
  "ramadhan_end": "2025-03-30",
  "pts_start": "", "pts_end": "",
  "pas_start": "", "pas_end": "",
  "pesantren_start": "", "pesantren_end": ""
}
// libur_dates & disabled_days diabaikan, gunakan endpoint masing-masing
// volume diabaikan, gunakan /api/volume

// Response 200
{ "message": "config berhasil disimpan" }
```

---

## Volume

### GET `/api/volume`
```json
{ "volume": 0.85 }
```

### POST `/api/volume`
```json
// Request — range 0.0 – 2.0
{ "volume": 1.0 }

// Response 200
{ "message": "volume berhasil disimpan" }
```

---

## Jadwal

### GET `/api/jadwal?mode=reguler`
Mode valid: `reguler` `ramadhan` `pts` `pas` `pesantren` `lainnya`
```json
// Response 200
{
  "mode": "reguler",
  "hari": ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"],
  "disabled_days": ["Sabtu","Minggu"],
  "jadwal": {
    "Senin": [
      { "waktu": "06:44", "audio": "/opt/bel-madrasah/tone/sholawat.mp3" },
      { "waktu": "07:00", "audio": "/opt/bel-madrasah/tone/upacara.mp3" }
    ],
    "Selasa": []
  }
}
```

### POST `/api/jadwal/entry`

**Action: `add`**
```json
{
  "action": "add",
  "mode": "reguler",
  "hari": "Senin",
  "entry": {
    "waktu": "07:00",
    "audio": "/opt/bel-madrasah/tone/sholawat.mp3"
  }
}
```

**Action: `edit`**
```json
{
  "action": "edit",
  "mode": "reguler",
  "hari": "Senin",
  "index": 0,
  "entry": {
    "waktu": "07:15",
    "audio": "/opt/bel-madrasah/tone/sholawat.mp3"
  }
}
```

**Action: `delete`**
```json
{ "action": "delete", "mode": "reguler", "hari": "Senin", "index": 0 }
```

**Action: `preview`** — mainkan di server + kembalikan URL untuk browser
```json
// Request
{ "action": "preview", "mode": "reguler", "hari": "Senin", "index": 0 }

// Response 200
{
  "message": "memutar sholawat.mp3",
  "filename": "sholawat.mp3",
  "url": "/api/tones/file/sholawat.mp3"
}
```

**Action: `stop`**
```json
// Request
{ "action": "stop", "mode": "reguler", "hari": "Senin" }

// Response 200
{ "message": "audio dihentikan" }
```

### POST `/api/jadwal/day-toggle`
```json
// Nonaktifkan hari
{ "mode": "reguler", "hari": "Sabtu", "disable": true }

// Aktifkan hari
{ "mode": "reguler", "hari": "Sabtu", "disable": false }

// Response 200
{ "message": "berhasil" }
```

---

## Audio / Tones

### GET `/api/tones?page=1&per_page=20`
```json
// Response 200
{
  "tones": ["hymne-madrasah.mp3", "sholawat.mp3"],
  "total": 25,
  "page": 1,
  "per_page": 20,
  "pages": 2
}
```

### GET `/api/tones/file/{filename}`
Serve file audio ke browser untuk diputar langsung.
```
GET /api/tones/file/sholawat.mp3
Content-Type: audio/mpeg
```
Gunakan URL ini sebagai `src` pada `<audio>` element di FE.

### POST `/api/tones/upload`
```
Content-Type: multipart/form-data
field: file — .mp3 / .wav / .ogg, maks 32MB

// Response 200
{ "message": "upload berhasil", "filename": "sholawat.mp3" }
```

### POST `/api/tones/delete`
```json
{ "filename": "sholawat.mp3" }

// Response 200
{ "message": "file berhasil dihapus" }
```

### POST `/api/tones/preview`
```json
// Request
{ "filename": "sholawat.mp3" }

// Response 200
{
  "message": "memutar sholawat.mp3",
  "filename": "sholawat.mp3",
  "url": "/api/tones/file/sholawat.mp3"
}
```

### POST `/api/tones/stop`
```json
// Response 200
{ "message": "audio dihentikan" }
```

---

## Hari Libur

### GET `/api/libur`
```json
{
  "libur": [
    { "date": "2025-08-17", "keterangan": "HUT RI" }
  ]
}
```

### POST `/api/libur`

**Tambah**
```json
{ "action": "add", "date": "2025-08-17", "keterangan": "HUT RI" }
```

**Hapus**
```json
{ "action": "delete", "date": "2025-08-17", "keterangan": "" }
```

```json
// Response 200
{ "message": "berhasil" }
```

### GET `/api/libur/nasional?year=2025`
Proxy ke `api-harilibur.vercel.app`. Format response mengikuti API tersebut:
```json
[
  {
    "holiday_date": "2025-01-01",
    "holiday_name": "Tahun Baru 2025",
    "is_national_holiday": true
  }
]
```

---

## Service / Scheduler

### GET `/api/service/status`
```json
{
  "running": true,
  "active_mode": "reguler",
  "is_libur": false,
  "is_playing": false,
  "now_playing": "",
  "volume": 0.85
}
```

### POST `/api/service/toggle`
Toggle start/stop scheduler.
```json
// Response 200
{ "running": false, "message": "scheduler dihentikan" }
```

---

## Log

### GET `/api/log`
```json
{
  "logs": [
    {
      "time": "2025-06-24 07:00:00",
      "mode": "reguler",
      "hari": "Selasa",
      "waktu": "07:00",
      "audio": "upacara.mp3"
    }
  ]
}
```
Diurutkan terbaru di atas, maks 500 entri.

### POST `/api/log/reset`
```json
// Response 200
{ "message": "log berhasil direset" }
```

---

## Backup & Restore

### GET `/api/backup`
Download file JSON jadwal.
```
Content-Disposition: attachment; filename=backup-jadwal-20250624-070000.json
```

### POST `/api/restore`
```
Content-Type: multipart/form-data
field: file — file JSON hasil backup, maks 4MB

// Response 200
{ "message": "jadwal berhasil direstore" }
```

---

## Health Check

### GET `/healthz`
```
200 OK
ok
```

---

## Error Format (semua endpoint)
```json
{ "error": "pesan error" }
```

| Code | Kondisi |
|---|---|
| 400 | Request tidak valid / format salah |
| 401 | Belum login / password salah |
| 404 | Data tidak ditemukan |
| 405 | Method tidak diizinkan |
| 429 | Rate limit login |
| 500 | Server error |
| 502 | Gagal fetch API eksternal |

---

## Catatan untuk FE Astro

**Cookie** — gunakan `credentials: 'include'` di semua fetch.

**Play audio di browser** — setelah dapat `url` dari response preview, buat `Audio` object:
```js
const res = await fetch('/api/tones/preview', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filename: 'sholawat.mp3' })
})
const { url } = await res.json()
const audio = new Audio(url)
audio.play()
```
