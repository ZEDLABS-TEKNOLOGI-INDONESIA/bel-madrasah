# Frontend Specification — Bel Madrasah
## Aturan
- Tanpa Komentar dan Emoticon
- Tema warna: GitHub Light & GitHub Dark
- Card Glossy
- Bento Grid
- Responsif (Smartphone First)
- Font Family: Lexend
- Tampilan proporsional, simetris, elegan
- PWA dengan popup permintaan install
- Caching data agar cepat ketika load
- Glassmorphism

---

## Struktur Project

```
src/
├── components/
│   ├── layout/
│   │   ├── Shell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── InstallPrompt.tsx
│   ├── ui/
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   ├── Toggle.tsx
│   │   ├── Slider.tsx
│   │   └── Skeleton.tsx
│   ├── dashboard/
│   │   ├── StatusCard.tsx
│   │   ├── ModeCard.tsx
│   │   ├── NowPlayingCard.tsx
│   │   └── QuickActions.tsx
│   ├── jadwal/
│   │   ├── JadwalPage.tsx
│   │   ├── ModeTabs.tsx
│   │   ├── HariSection.tsx
│   │   ├── EntryRow.tsx
│   │   └── EntryModal.tsx
│   ├── audio/
│   │   ├── AudioPage.tsx
│   │   ├── ToneList.tsx
│   │   ├── ToneRow.tsx
│   │   ├── UploadZone.tsx
│   │   └── VolumeSlider.tsx
│   ├── libur/
│   │   ├── LiburPage.tsx
│   │   ├── LiburList.tsx
│   │   └── LiburModal.tsx
│   ├── log/
│   │   └── LogPage.tsx
│   └── pengaturan/
│       └── PengaturanPage.tsx
├── hooks/
│   ├── useConfig.ts
│   ├── useJadwal.ts
│   ├── useTones.ts
│   ├── useLibur.ts
│   ├── useLog.ts
│   └── useAudio.ts
├── lib/
│   ├── api.ts
│   ├── queryClient.ts
│   └── theme.ts
├── pages/
│   ├── index.astro
│   ├── login.astro
│   └── 404.astro
├── styles/
│   └── global.css
└── public/
    ├── sw.js
    ├── manifest.json
    └── icons/
```

---

## Layout

### Shell.tsx — Bento Grid layout
```
Mobile  : TopBar + konten full width (bottom nav)
Tablet+ : Sidebar kiri (64px collapsed / 220px expanded) + konten kanan
```

### Sidebar nav items
```
Dashboard   /          (LayoutDashboard)
Jadwal      /jadwal    (CalendarDays)
Audio       /audio     (Music2)
Libur       /libur     (CalendarOff)
Log         /log       (ScrollText)
Pengaturan  /settings  (Settings2)
```

---

## Halaman

### Dashboard — Bento Grid
```
Mobile  : 1 kolom, scroll vertikal
Desktop : grid 12 kolom

┌─────────────────┬──────────────┐
│  StatusCard     │  ModeCard    │
│  (span 7)       │  (span 5)    │
├────────┬────────┴──────────────┤
│ Now    │  QuickActions         │
│ Playing│  (span 8)             │
│(span 4)│                       │
└────────┴───────────────────────┘
```

**StatusCard** — menampilkan:
- Scheduler running/stopped (badge + toggle)
- Mode aktif
- Status libur hari ini
- Volume saat ini

**ModeCard** — menampilkan mode aktif dengan tanggal range tiap mode, klik buka config modal

**NowPlayingCard** — animasi gelombang audio (CSS keyframe), nama file, tombol Stop

**QuickActions** — 4 tombol: Start/Stop Scheduler, Preview terakhir, Buka Jadwal, Upload Audio

---

### Jadwal `/jadwal`

**Layout:**
```
ModeTabs (horizontal scroll) → pilih mode
  └─ HariSection per hari (accordion di mobile, full di desktop)
       └─ EntryRow: waktu | nama audio | Edit | Play | Stop
```

**ModeTabs** — 6 tab dengan indikator mode aktif (dot biru)

**HariSection:**
- Header: nama hari + toggle aktif/nonaktif (per mode)
- Disabled hari → row redup, entry tidak bisa diputar
- Tambah Entry button di bawah setiap hari

**EntryRow:**
```
[06:44]  sholawat.mp3  [Edit] [Play] [Stop]
```
- Play → POST preview, lalu putar di browser via `<audio>`
- Stop → POST stop
- Edit → buka EntryModal prefilled

**EntryModal** — field:
- Waktu (input time HH:MM)
- Audio (dropdown list tones dari `/api/tones`)

---

### Audio `/audio`

**Layout Bento:**
```
┌────────────────┬───────────────┐
│  VolumeSlider  │  UploadZone   │
│  (span 5)      │  (span 7)     │
├────────────────┴───────────────┤
│  ToneList (full width)         │
│  pagination bawah              │
└────────────────────────────────┘
```

**VolumeSlider** — slider 0–200%, nilai tampil sebagai persen, debounce 300ms sebelum POST

**UploadZone** — drag & drop area, accept `.mp3 .wav .ogg`, progress bar

**ToneRow:**
```
[🎵] sholawat.mp3        [Play] [Stop] [Delete]
```
- Play → preview server + browser audio
- Now playing → row highlight + animasi pulse

---

### Libur `/libur`

**Layout:**
```
┌─────────────────┬──────────────┐
│  Libur List     │  Libur Nas.  │
│  (span 7)       │  (span 5)    │
└─────────────────┴──────────────┘
```

**Libur List:**
- Tabel: tanggal | keterangan | hapus
- Tombol Tambah Libur → modal (date picker + input keterangan)

**Libur Nasional:**
- Dropdown tahun
- List dari `/api/libur/nasional`
- Tombol Tambah per item (import ke libur lokal)

---

### Log `/log`

**Layout:**
```
Header: judul + tombol Reset Log
┌────────────────────────────────┐
│  LogTable                      │
│  time | mode | hari | waktu | audio │
└────────────────────────────────┘
```
- 500 entri terbaru, terbaru di atas
- Badge warna per mode
- Konfirmasi sebelum reset

---

### Pengaturan `/settings`

**Sections (Card tiap section):**

1. **Mode Bel** — pilih mode manual/otomatis, date range per mode
2. **Volume** — slider identik dengan halaman Audio
3. **Ganti Password** — form old/new/confirm
4. **Backup & Restore** — tombol download backup, upload restore
5. **Info** — versi app, status scheduler, health check

---
