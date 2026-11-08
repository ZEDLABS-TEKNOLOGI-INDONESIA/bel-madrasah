# Konsep Frontend - Bel Madrasah

Dokumen ini membakukan konsep frontend agar dapat dipakai ulang pada project lain. Backend tidak termasuk cakupan.

## 1. Prinsip

- Tanpa komentar dan emoticon pada kode dan antarmuka
- Tema warna GitHub Light dan GitHub Dark, bergantian lewat atribut `data-theme`
- Tata letak dashboard bergaya Cloudflare: sidebar tetap, topbar, area konten, footer
- Bento grid: kartu berukuran proporsional pada grid 12 kolom
- Smartphone first: dirancang dari layar kecil, desktop adalah perluasan
- Font Lexend
- Tampilan proporsional, simetris, elegan: datar, tanpa blur, tanpa bayangan berat
- PWA dengan popup permintaan install
- Data di-cache agar cepat saat dimuat
- Ukuran aset sekecil mungkin

## 2. Stack

| Lapisan | Pilihan |
| --- | --- |
| Framework | Astro (static, `client:only="react"`) |
| UI | React 19 |
| Data | TanStack Query |
| Animasi | framer-motion (hanya Modal dan InstallPrompt) |
| Ikon | lucide-react |
| Notifikasi | react-hot-toast |
| CSS | Tailwind v4 (hanya untuk grid) dan CSS variable |
| Font | @fontsource-variable/lexend (self-hosted) |

Gaya komponen ditulis sebagai inline style yang membaca CSS variable. Tailwind hanya dipakai untuk `grid grid-cols-12 gap-4` dan `col-span-*`.

## 3. Struktur Folder

```
public/
  icon.svg  manifest.json  sw.js  icons/icon-192.png  icons/icon-512.png
src/
  pages/            satu file .astro per halaman, hanya membungkus <App page="..." />
  styles/global.css token tema, reset, kelas utilitas
  lib/
    app.config.ts   identitas aplikasi (nama, logo)
    routes.ts       satu-satunya sumber daftar halaman
    constants.ts    konstanta domain yang dipakai bersama
    layout.ts       ukuran tetap layout
    api.ts          pembungkus fetch
    router.ts       router SPA
    queryClient.ts  query client dengan cache persisten
    theme.ts        tema terang dan gelap
    auth.ts         logout
    nav.ts          perintah navigasi dari komponen
  hooks/            satu hook per resource
  components/
    App.tsx         pemetaan halaman dan inisialisasi
    layout/         Shell, Sidebar, TopBar, Footer, InstallPrompt
    ui/             Button, Card, Modal, Badge, Toggle, Slider, Skeleton, PageHeader
    auth/           LoginPage
    <fitur>/        satu folder per halaman
```

## 4. Konfigurasi Terpusat

**`app.config.ts`**: nama dan logo. Tidak ada nama aplikasi yang boleh ditulis langsung di komponen.

**`routes.ts`**: daftar halaman dengan `key`, `path`, `label`, dan `title`. Menu sidebar, bottom nav, judul topbar, prefetch, dan pemetaan path ke halaman semuanya membaca file ini.

**`constants.ts`**: label dan varian badge untuk entitas domain. Satu deklarasi untuk seluruh aplikasi.

**`layout.ts`**: `BAR_H` 56, `FOOT_H` 44, `SIDEBAR_W` 220, `SIDEBAR_W_COLLAPSED` 64. Garis topbar sejajar dengan header sidebar, garis footer sejajar dengan footer sidebar, karena memakai konstanta yang sama.

**Identitas footer** diinjeksi saat build lewat `define: __FOOTER_CONFIG__` di `astro.config.mjs`, dibaca dari variabel env berawalan nama project. Komponen memakai nilai bawaan jika konstanta tidak terdefinisi.

## 5. Routing SPA

- Setiap halaman Astro memuat komponen `App` yang sama dengan prop `page`.
- Perpindahan halaman dilakukan tanpa muat ulang. Komponen meminta navigasi lewat event `spa-do-navigate`, router mengumumkan hasilnya lewat event `spa-navigate`.
- Router mengambil HTML halaman tujuan untuk dua keperluan: memastikan sesi masih sah (status 401 atau redirect ke `/login` mengarahkan ke halaman login) dan mengambil `<title>`.
- Cache HTML halaman berlaku 5 menit.
- Prefetch dilakukan saat hover pada desktop, saat sentuhan pada mobile, dan saat idle untuk semua halaman.
- Tombol back dan forward browser ditangani lewat `popstate`. Jika navigasi sedang berjalan, tujuan terakhir ditahan lalu dijalankan setelahnya.
- Halaman di-lazy-load dengan `React.lazy` dan `Suspense`.

## 6. Sistem Desain

### Token warna

Didefinisikan di `:root` untuk terang dan `[data-theme="dark"]` untuk gelap.

| Token | Terang | Gelap |
| --- | --- | --- |
| `--bg` | #f6f8fa | #0d1117 |
| `--panel` dan `--card-bg` | #ffffff | #161b22 |
| `--bg-secondary` | #f6f8fa | #0d1117 |
| `--bg-tertiary` | #eaeef2 | #21262d |
| `--border` dan `--card-border` | #d0d7de | #30363d |
| `--text` | #1f2328 | #e6edf3 |
| `--text-muted` | #656d76 | #8b949e |
| `--accent` | #0969da | #2f81f7 |
| `--success` | #1a7f37 | #3fb950 |
| `--danger` | #cf222e | #f85149 |
| `--warning` | #9a6700 | #d29922 |

Setiap warna status memiliki varian `-soft` (latar transparan) dan `--danger-border`. `--overlay` dipakai sebagai latar modal.

Tema disimpan di `localStorage` dengan nilai bawaan gelap. Tidak ada warna yang ditulis langsung di komponen kecuali putih pada teks di atas aksen.

### Tipografi

- Font: Lexend Variable, bobot 300 sampai 700
- Judul halaman 20px bobot 600
- Judul kartu 13px bobot 600
- Teks isi 13px
- Label form 12px bobot 600 warna muted
- Teks bantu dan keterangan 11 sampai 12px warna muted
- Angka dan jam memakai kelas `tabular`

### Bentuk

- Radius: 6px (kontrol), 8px (kartu), 12px (elemen besar)
- Garis 1px dengan `--border`
- Tidak ada blur latar. Bayangan hanya pada Modal dan InstallPrompt

### Kelas utilitas

`btn` (efek tekan), `row-hover` (latar saat hover pada baris), `card-hover`, `tabular`, `input-group` dan `addon` (input dengan ikon di sisi), `wave-bar` (indikator audio), `animate-fade-in`. Keyframe tersedia: `spin`, `wave`, `fade-in`, `shimmer`, `pulse-ring`.

Elemen `input`, `select`, `textarea` sudah bergaya global. Fokus ditandai garis dan cincin warna aksen.

## 7. Tata Letak

### Breakpoint

Satu titik pemisah: 768px. Di atasnya desktop, di bawahnya mobile. Login page memakai 900px.

### Desktop

- **Sidebar** tetap di kiri, lebar 220px, ciut menjadi 64px. Header sidebar berisi logo dan nama. Saat ciut hanya logo dan ikon yang tampil, teks tidak dirender. Footer sidebar berisi tombol Keluar dan tombol Ciutkan. Status ciut disimpan di `localStorage`.
- **Topbar** tinggi 56px, lengket di atas: jejak halaman di kiri; status scheduler, tautan sosial, dan tombol tema di kanan.
- **Konten** dapat discroll sendiri, lebar maksimal 1280px, padding 24x32.
- **Footer** tinggi 44px berisi hak cipta dan kredit.

### Mobile

- Sidebar dan footer tidak ditampilkan.
- Topbar menampilkan logo, judul halaman, status, tombol tema, dan tombol keluar.
- **Bottom nav** tetap di bawah dengan ikon dan label, memperhitungkan `safe-area-inset-bottom`.
- Konten memiliki padding bawah 88px agar tidak tertutup bottom nav.
- Tinggi layar memakai `100dvh`. Area yang dapat discroll hanya konten, bukan halaman.

## 8. Pola Halaman

Setiap halaman mengikuti bentuk yang sama:

```
PageHeader (judul, deskripsi, aksi utama)
grid grid-cols-12 gap-4
  kartu dengan col-span-12 md:col-span-N
```

Aturan bento:
- Jumlah kolom pada satu baris selalu 12 (misalnya 8 + 4, 7 + 5, 6 + 6, 5 + 7)
- Di mobile semua kartu menjadi satu kolom
- Kartu statistik memakai `grid-cols-2 lg:grid-cols-4`
- Jarak antarkartu 16px

Setiap kartu memiliki tiga keadaan baku:
1. **Memuat**: `Skeleton` dengan tinggi mendekati isi akhir
2. **Kosong**: ikon dan teks di tengah, padding 32 sampai 40
3. **Terisi**

Kartu berisi daftar memakai `bodyStyle={{ padding: 0 }}` dengan baris `row-hover` dan garis pemisah, baris terakhir tanpa garis.

## 9. Komponen UI

| Komponen | Properti utama |
| --- | --- |
| `Button` | `variant`: primary, secondary, danger, ghost. `size`: sm (28px), md (34px), lg (42px). `loading`, `icon` |
| `Card` | `title`, `action`, `bodyStyle`, `hover`, `onClick`. Jika ada judul atau aksi, header 48px dengan garis bawah |
| `Modal` | `open`, `onClose`, `title`, `width`. Tutup dengan klik latar atau Escape. Konten panjang dapat discroll |
| `Badge` | `variant`: default, success, danger, warning, accent. `dot` |
| `Toggle` | `checked`, `onChange`, `disabled` |
| `Slider` | `value`, `min`, `max`, `step`, `onChange`, `formatLabel` |
| `Skeleton`, `SkeletonCard` | `width`, `height`, `radius` |
| `PageHeader` | `title`, `description`, `action` |

Konvensi tombol: aksi di baris memakai ukuran `sm` dengan ikon 12 sampai 13px. Aksi utama halaman memakai `primary`. Aksi merusak memakai `danger` atau ikon dengan warna `--danger`.

Form: label di atas input dengan `htmlFor`, jarak 6px antara label dan input, 12 sampai 16px antarbidang. Aksi form berada di kanan bawah: Batal (ghost) lalu Simpan (primary).

## 10. Lapisan Data

**`api.ts`** membungkus `fetch` dengan `credentials: "include"`. Respons 401 di luar halaman login mengarahkan ke `/login`. Respons gagal melempar `Error` dengan pesan dari field `error` pada JSON. Tersedia `get`, `post`, dan `upload` (FormData).

**Hook** satu per resource, tiap hook memakai `queryKey` berupa string yang stabil:
- Query membaca dengan `staleTime` sesuai sifat data
- Mutasi memanggil `invalidateQueries` pada kunci yang terpengaruh
- Data yang berubah cepat memakai `refetchInterval`

| Jenis data | `staleTime` | `refetchInterval` |
| --- | --- | --- |
| Status layanan | 4 detik | 5 detik |
| Konfigurasi | 30 detik | 15 detik |
| Log | 30 detik | 30 detik |
| Jadwal, libur, daftar audio | 60 detik | tidak ada |
| Libur nasional | 24 jam | tidak ada |

Satu data hanya boleh dipoll oleh satu hook. Komponen yang membutuhkan status memakai hook bersama, tidak membuat query sendiri dengan kunci yang sama.

**Penanganan galat**: komponen memanggil `toast.error(e.message)`. Keberhasilan aksi ditandai `toast.success`.

**Konfirmasi aksi merusak**: dialog `confirm()` bawaan browser, atau tombol dua langkah untuk aksi yang sangat berdampak (contoh: reset log).

## 11. Caching

Tiga lapis:

1. **Memori**: TanStack Query dengan `gcTime` 24 jam
2. **Persisten**: cache query disimpan ke `localStorage` (maksimal 24 jam) hanya untuk kunci pada daftar putih. Dipulihkan saat aplikasi dibuka sehingga tampilan langsung terisi lalu menyegarkan diri di latar belakang. Cache dihapus saat logout.
3. **Service worker**: lihat bagian PWA

Data hanya dipersist jika berstatus sukses. Kegagalan membaca atau menulis penyimpanan diabaikan.

## 12. PWA

**Manifest**: `display: standalone`, `scope` dan `start_url` `/`, ikon PNG 192 dan 512 (`any` dan `maskable` terpisah), `theme_color` mengikuti aksen, `background_color` mengikuti tema gelap.

**Service worker** (`sw.js`), tanpa precache halaman yang memerlukan login:
- Aset berhash di `/_astro/`: cache-first dengan batas 100 entri
- Aset shell (ikon, manifest): stale-while-revalidate
- Halaman HTML: network-first, cache sebagai cadangan saat luring (respons redirect tidak disimpan)
- `/api/`, `/login`, `/logout`, `/healthz`, `/sw.js`: tidak dicegat
- Versi cache dinaikkan setiap kali logika `sw.js` berubah

**Popup install** (`InstallPrompt`):
- Android dan desktop: memakai `beforeinstallprompt`, tombol Install dan Nanti
- iOS: panduan "Ketuk Bagikan lalu Tambah ke Layar Utama"
- Tidak muncul jika aplikasi sudah terpasang
- Setelah ditutup, tidak muncul lagi selama 7 hari
- Di mobile diposisikan di atas bottom nav, di desktop di pojok kanan bawah

## 13. Login Page

- Dua panel pada layar lebar (lebih dari 900px): form 544px di kiri, panel dekoratif di kanan. Satu kolom pada layar sempit.
- Kartu form: logo dan nama, judul "Masuk ke panel", deskripsi, bidang username dan password (dengan ikon di sisi), tombol Masuk.
- Panel dekoratif: titik-titik latar, logo besar transparan, judul pemasaran, tiga poin keunggulan, dan teks merek besar transparan di bagian bawah.
- Layout dikunci `position: fixed; inset: 0` dan scroll `html` serta `body` dimatikan, sehingga halaman tidak dapat digulir di smartphone. Jika layar sangat pendek, hanya kolom form yang dapat discroll.
- Input memakai ukuran font 16px agar iOS tidak memperbesar layar saat fokus.
- Pesan galat tampil sebagai kotak merah di atas tombol.

## 14. Aksesibilitas dan Responsif

- Tombol ikon memiliki `title` atau `aria-label`
- Modal memiliki `role="dialog"`, `aria-modal`, dan label
- Label form terhubung ke input
- Fokus input terlihat jelas
- Target sentuh minimal sekitar 28px untuk aksi sekunder dan 34px untuk aksi utama
- Tabel lebar dibungkus kontainer `overflow-x: auto` dengan `min-width`
- Teks panjang dipotong dengan elipsis dan `minWidth: 0` pada kontainer fleksibel

## 15. Konvensi Kode

- Satu komponen utama per file, nama file sama dengan nama komponen
- Tidak ada komentar dan emoticon
- Tidak menulis nama aplikasi, label menu, atau daftar halaman langsung di komponen
- Konstanta domain di `constants.ts`, tidak diduplikasi
- Gaya yang dipakai lebih dari dua kali dijadikan konstanta atau komponen
- Tidak ada warna atau ukuran layout yang ditulis langsung jika sudah ada token atau konstanta
- Hindari `any`; jika terpaksa, batasi pada respons API yang belum bertipe
- Listener global selalu dibersihkan pada fungsi pembersih `useEffect`

## 16. Build dan Rilis Frontend

- `pnpm build` menghasilkan `dist/` dengan `format: "file"` (satu HTML per halaman)
- Sebelum diunggah, HTML, JS, CSS, SVG, dan JSON dibuat versi Brotli (level 11) dan gzip. Server menyajikan versi terkecil sesuai `Accept-Encoding`
- Berkas `_astro/` diberi cache `immutable` satu tahun karena namanya berhash
- Peta sumber dihapus sebelum diunggah
- Unggah memakai `rsync -az --delete` agar berkas lama terhapus

## 17. Memulai Project Baru dari Konsep Ini

1. Salin struktur folder pada bagian 3
2. Ubah `app.config.ts`: nama dan logo
3. Ubah `manifest.json`: nama, deskripsi, warna
4. Ganti berkas `icon.svg` dan ikon PNG
5. Daftarkan halaman di `routes.ts`, tambahkan ikon di `Sidebar.tsx`, buat berkas `.astro`, dan tambahkan ke peta di `App.tsx`
6. Ganti konstanta domain di `constants.ts`
7. Untuk setiap halaman: gunakan `PageHeader` lalu grid 12 kolom berisi `Card`, dengan tiga keadaan baku
8. Untuk setiap resource: satu hook dengan `queryKey` stabil dan `invalidateQueries` pada mutasi
9. Daftarkan kunci yang boleh dipersist di `queryClient.ts`
10. Atur variabel env untuk identitas footer

Daftar yang masih ditulis manual di lebih dari satu tempat saat menambah halaman: `routes.ts`, peta ikon di `Sidebar.tsx`, peta halaman di `App.tsx`, berkas `.astro`, dan `pageRoutes` di backend.

## 18. Utang Teknis yang Diketahui

- Peta ikon menu masih berada di `Sidebar.tsx`, belum di `routes.ts`
- Hook belum memakai pembuat generik (`createResource`), sehingga setiap hook masih ditulis ulang
- Banyak tipe `any` pada respons API
- Panel header, baris daftar, dan baris pengaturan ditulis berulang di beberapa halaman dan layak dijadikan komponen (`ListRow`, `SettingRow`, `EmptyState`)
- Konfirmasi memakai `confirm()` bawaan browser, belum memakai dialog sendiri
- Ikon maskable memakai gambar yang sama dengan ikon biasa
