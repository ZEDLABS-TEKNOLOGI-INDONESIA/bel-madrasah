# Konsep Frontend

Rujukan baku untuk membangun panel admin berbasis web yang cepat, ringan, dan seragam, lengkap dengan halaman landing publik. Backend tidak termasuk cakupan, kecuali kontrak yang harus dipenuhi (bagian 19). Implementasi acuan: Bel Madrasah.

## 1. Prinsip

- Tanpa komentar dan emoticon pada kode dan antarmuka
- Tema GitHub Light dan GitHub Dark, bergantian lewat atribut `data-theme`, bawaan gelap
- Tata letak dashboard bergaya Cloudflare: sidebar tetap, topbar, area konten, footer
- Bento grid: kartu proporsional pada grid 12 kolom
- Smartphone first: dirancang dari layar kecil, desktop adalah perluasan
- Font Lexend
- Datar, tanpa blur, tanpa bayangan berat
- PWA dengan popup permintaan install
- Data di-cache agar tampilan langsung terisi
- Ukuran aset sekecil mungkin
- Tanpa `any`, tanpa `confirm()` bawaan browser, tanpa nilai yang ditulis dua kali
- Semua teks identitas, pemasaran, dan konten landing berada di berkas konfigurasi, bukan di komponen
- Halaman publik (landing, login) terpisah dari panel dan memakai sistem desain yang sama

## 2. Stack dan Perkakas

| Lapisan | Pilihan |
| --- | --- |
| Framework | Astro 7 (static, `client:only="react"`) |
| UI | React 19 |
| Data | TanStack Query 5 |
| Animasi | framer-motion lewat `LazyMotion` dan `m` (hanya Modal dan InstallPrompt) |
| Ikon | lucide-react |
| Notifikasi | react-hot-toast |
| CSS | Tailwind v4 (hanya grid) dan CSS variable |
| Font | @fontsource-variable/lexend (self-hosted) |
| Bahasa | TypeScript 6 (strict, lewat `astro/tsconfigs/strict`) |
| Format | Prettier, `printWidth` 100 |
| Paket | pnpm, Node 22.18 atau lebih baru (type stripping untuk `node:test`) |

Catatan perkakas:
- Pakai TypeScript 6. `astro check` belum mendukung TypeScript 7 dan membawa dependensi yang bentrok, jadi pemeriksaan tipe memakai `tsc`.
- `astro sync` harus jalan sebelum `tsc` agar tipe `import.meta.env` tersedia.
- Uji unit frontend memakai `node:test` bawaan Node dengan type stripping, tanpa dependensi tambahan. Berkas uji berupa `tests/*.test.mjs` yang mengimpor modul `.ts` secara langsung, sehingga hanya modul tanpa impor runtime (fungsi murni dengan `import type`) yang dapat diuji.
- Uji end-to-end (`tests/e2e/`) memakai Chromium lewat DevTools Protocol dengan `WebSocket` bawaan Node, juga tanpa dependensi. Runner membangun backend, menjalankannya pada direktori sementara (`BEL_BASE_DIR`) berisi salinan `dist/` dan `tone/`, lalu memeriksa tata letak dan alur utama.
- Skrip `package.json`:

```json
"check": "astro sync && tsc --noEmit",
"test": "node --test \"tests/*.test.mjs\" && go test ./...",
"e2e": "astro build && node tests/e2e/run.mjs",
"format": "prettier --write \"src/**/*.{ts,tsx,css}\""
```

- `.prettierrc`:

```json
{
  "printWidth": 100
}
```

Gaya komponen ditulis sebagai inline style yang membaca CSS variable. Tailwind hanya untuk `grid grid-cols-12 gap-4`, `col-span-*`, dan variasi `md:` serta `lg:` pada keduanya. Kelas `col-span-*` harus berupa string literal utuh di sumber agar terdeteksi Tailwind.

## 3. Struktur Folder

```
public/
  icon.svg  favicon.ico  manifest.json  sw.js
  icons/icon-192.png  icons/icon-512.png
src/
  layouts/Layout.astro  kepala HTML tunggal untuk semua halaman
  pages/              [...page].astro untuk semua halaman panel (dibangkitkan dari ROUTES),
                      landing.astro, login.astro, 404.astro
  styles/global.css   token tema, reset, kelas utilitas, keyframe
  lib/
    app.config.ts     identitas aplikasi, warna tema, konten halaman login
    routes.ts         satu-satunya sumber daftar halaman panel, termasuk ikon, dan GUEST_PATHS
    constants.ts      konstanta domain bersama
    layout.ts         ukuran tetap layout
    footer.ts         tipe dan nilai FOOTER dari konstanta build
    motion.ts         pemuat fitur framer-motion untuk LazyMotion
    motionFeatures.ts domAnimation, dimuat async
    landing.ts        seluruh konten landing (teks, daftar, ikon, contoh data)
    types.ts          tipe respons dan body API
    errors.ts         errorMessage
    format.ts         pemformat tanggal, nama berkas, URL
    api.ts            pembungkus fetch
    createResource.ts pembuat hook query dan mutasi, tabel POLICY
    confirm.ts        konfirmasi berbasis event
    router.ts         router SPA
    nav.ts            perintah navigasi dari komponen
    queryClient.ts    query client dengan cache persisten
    theme.ts          tema terang dan gelap
    auth.ts           logout
  hooks/              satu berkas per resource, ditambah useMediaQuery
  components/
    App.tsx           pemetaan halaman dan inisialisasi
    layout/           Shell, Sidebar, TopBar, Footer, InstallPrompt, StatusPill, SocialIcons
    ui/               Button, LinkButton, buttonStyle, Card, Modal, Badge, Chip, Toggle,
                      Slider, Skeleton, PageHeader, EmptyState, ListRow, SettingRow,
                      Field, ConfirmHost
    auth/             LoginPage
    landing/          LandingPage, LandingNav, Hero, bagian-bagian, landingStyle
    <fitur>/          satu folder per halaman panel
tests/                uji unit frontend (*.test.mjs)
  e2e/                run.mjs (skenario), cdp.mjs (pembungkus Chromium)
server/               backend Go, package main, satu berkas per domain (lihat bagian 19)
scripts/              install.sh, uninstall.sh, deploy.sh, generate.sh
tone/                 audio bawaan yang disalin saat instalasi
```

Root hanya berisi konfigurasi perkakas (`package.json`, `astro.config.mjs`, `tsconfig.json`, `go.mod`, `.env.example`) dan dokumen. Kode tidak diletakkan di root.

Layanan non-React yang memegang state sendiri (contoh: `audioManager.ts`) berupa kelas dengan `subscribe`, dibungkus satu hook agar React ikut berlangganan.

Halaman besar dipecah menjadi komponen kecil, fungsi murni (`grouping.ts`), dan hook aksi (`useJadwalActions.ts`) dalam folder fiturnya.

## 4. Konfigurasi Terpusat

**`app.config.ts`**: `APP.name`, `APP.logo`, `APP.themeColor` (satu-satunya tempat nilai heksadesimal tema selain `global.css`), `APP.watermark`, dan `APP.login` (judul, deskripsi, headline, lead, daftar keunggulan). Nama aplikasi tidak boleh ditulis langsung di komponen atau halaman.

**`routes.ts`**: `ROUTES` berisi `key`, `path`, `label`, `short` (opsional, label pendek untuk bottom nav bila `label` tidak muat di 1/6 lebar layar 360px), `title`, dan `icon`. Menu sidebar, bottom nav, judul topbar, prefetch, dan pemetaan path ke halaman semuanya membaca berkas ini. Turunannya: `PATHS`, `PATH_TO_KEY`, `titleOf`. `GUEST_PATHS` memuat path publik (`/login`, `/landing`) yang bukan bagian panel.

**`constants.ts`**: label, varian badge, daftar nilai, dan kunci yang dipakai lebih dari satu berkas. Satu deklarasi untuk seluruh aplikasi. Fungsi kecil seperti `modeLabel` ikut di sini.

**`layout.ts`**: `BAR_H` 56, `FOOT_H` 44, `SIDEBAR_W` 220, `SIDEBAR_W_COLLAPSED` 64. Garis topbar sejajar dengan header sidebar, garis footer sejajar dengan footer sidebar, karena memakai konstanta yang sama.

**`types.ts`**: semua tipe respons dan body API. Kunci komputasi dibuat lewat tipe literal templat dan fungsi pembantu bertipe (contoh `rangeKey`).

**`footer.ts`**: mendeklarasikan `FooterConfig` dan `__FOOTER_CONFIG__` satu kali, lalu mengekspor `FOOTER` dengan nilai bawaan bila konstanta tidak terdefinisi. Semua komponen membaca `FOOTER`, tidak ada yang mendeklarasikan ulang.

**`landing.ts`**: seluruh teks dan data landing. Komponen hanya merender. Detail di bagian 15.

**Identitas footer** diinjeksi saat build lewat `define: __FOOTER_CONFIG__` di `astro.config.mjs`, dibaca dari variabel env berawalan nama project (`BEL_`).

**`.env.example`** wajib ada dan memuat semua variabel: backend, dev server frontend, footer dan branding.

## 5. Routing SPA

- Setiap halaman panel memuat komponen `App` yang sama dengan prop `page`.
- Komponen meminta navigasi lewat `go(path)` atau event `spa-do-navigate`. Router mengumumkan hasilnya lewat event `spa-navigate`.
- Router mengambil HTML halaman tujuan untuk dua keperluan: memastikan sesi masih sah dan mengambil `<title>`. Sesi dianggap habis bila status 401 atau respons dialihkan ke salah satu `GUEST_PATHS`. Karena itu `<title>` tiap berkas `.astro` harus sesuai dengan `title` di `routes.ts`, dan itu terjamin bila halaman memanggil `titleOf(path)`.
- Cache HTML halaman berlaku 5 menit.
- Prefetch dilakukan saat hover pada desktop, saat `touchstart` pada mobile, dan saat idle untuk semua halaman panel.
- Tombol back dan forward ditangani lewat `popstate`. Jika navigasi sedang berjalan, tujuan terakhir ditahan lalu dijalankan setelahnya.
- Halaman di-lazy-load dengan `React.lazy` dan `Suspense`.
- Sidebar menandai item aktif lewat `startsWith`, kecuali `/` yang dicocokkan persis.
- Halaman publik tidak ikut router SPA. Tautan ke sana memakai `<a href>` biasa.

## 6. Sistem Desain

### Token warna

Didefinisikan di `:root` untuk terang dan `[data-theme="dark"]` untuk gelap.

| Token | Terang | Gelap |
| --- | --- | --- |
| `--bg`, `--bg-secondary` | #f6f8fa | #0d1117 |
| `--panel`, `--card-bg` | #ffffff | #161b22 |
| `--bg-tertiary` | #eaeef2 | #21262d |
| `--border`, `--card-border` | #d0d7de | #30363d |
| `--text` | #1f2328 | #e6edf3 |
| `--text-muted` | #656d76 | #8b949e |
| `--accent` | #0969da | #2f81f7 |
| `--accent-hover` | #0860ca | #388bfd |
| `--accent-soft` | rgba(9,105,218,0.10) | rgba(47,129,247,0.15) |
| `--success` | #1a7f37 | #3fb950 |
| `--success-soft` | rgba(26,127,55,0.12) | rgba(46,160,67,0.15) |
| `--danger` | #cf222e | #f85149 |
| `--danger-soft` | rgba(207,34,46,0.10) | rgba(248,81,73,0.12) |
| `--danger-border` | rgba(207,34,46,0.40) | rgba(248,81,73,0.40) |
| `--warning` | #9a6700 | #d29922 |
| `--warning-soft` | rgba(154,103,0,0.12) | rgba(210,153,34,0.15) |
| `--overlay` | rgba(31,35,40,0.40) | rgba(1,4,9,0.70) |

Token non-warna: `--font`, `--radius` 6px, `--radius-lg` 8px, `--radius-xl` 12px.

Tema disimpan di `localStorage` dengan kunci `theme`. `initTheme()` dipanggil di `Shell`, `LoginPage`, dan `LandingPage`. Tidak ada warna yang ditulis langsung di komponen kecuali putih (`#fff`) pada teks di atas aksen.

### Tipografi

- Font: Lexend Variable, bobot 300 sampai 700
- Judul halaman 20px bobot 600
- Judul kartu 13px bobot 600
- Teks isi 13px
- Label form 12px bobot 600 warna muted
- Teks bantu dan keterangan 11 sampai 12px warna muted
- Angka dan jam memakai kelas `tabular`
- Khusus landing: judul hero 40px (30px di mobile), judul bagian 24px, teks isi 13 sampai 15px

### Bentuk

- Radius: 6px (kontrol), 8px (kartu), 12px (elemen besar)
- Garis 1px dengan `--border`
- Tanpa blur latar. Bayangan hanya pada Modal dan InstallPrompt

### Lapisan z-index

| Elemen | z-index |
| --- | --- |
| Topbar dan nav landing | 50 |
| Sidebar dan bottom nav | 100 |
| InstallPrompt | 999 |
| Modal | 1000 |

### Kelas utilitas dan keyframe

Kelas: `btn` (efek tekan dan filter), `row-hover`, `card-hover`, `tabular`, `input-group` dan `addon`, `wave-bar`, `animate-fade-in`, `select-sm` (select ringkas, tinggi minimal 32px), `slider-input` dan `slider-thumb`.
Keyframe: `spin`, `wave`, `fade-in`, `shimmer`, `pulse-ring`.

Elemen `input`, `select`, `textarea` bergaya global. Fokus ditandai garis dan cincin warna aksen (`--accent-soft`), satu aturan untuk kedua tema. Scrollbar tipis 6px dan seleksi teks berwarna aksen juga diatur global.

## 7. Tata Letak

### Breakpoint

Satu titik pemisah: 768px, dibaca lewat hook `useIsMobile(breakpoint = 768)`. Login memakai `useIsMobile(900)`. Dilarang memanggil `matchMedia` langsung di komponen.

### Desktop

- **Sidebar** tetap di kiri, lebar 220px, ciut menjadi 64px. Header berisi logo dan nama. Saat ciut hanya logo dan ikon yang tampil, teks tidak dirender. Footer sidebar berisi tombol Keluar dan Ciutkan. Status ciut disimpan di `localStorage` (`sidebar-expanded`), dibungkus `try/catch`.
- **Topbar** tinggi 56px, lengket di atas: jejak "Nama aplikasi / Judul halaman" di kiri; slot status, tautan sosial, dan tombol tema di kanan. Status diberikan lewat prop `status` agar `TopBar` tidak terikat ke domain.
- **Konten** dapat discroll sendiri, lebar maksimal 1280px, padding 24x32.
- **Footer** tinggi 44px berisi hak cipta dan kredit.

### Mobile

- Sidebar dan footer tidak ditampilkan.
- Topbar menampilkan logo, judul halaman, status, tombol tema, dan tombol keluar.
- **Bottom nav** tetap di bawah dengan ikon dan `short ?? label`, memperhitungkan `safe-area-inset-bottom`. Label dipotong dengan elipsis sebagai pengaman.
- `StatusPill` memakai teks pendek ("Aktif"/"Berhenti") dan teks lengkap di `title`, tidak pernah membungkus baris.
- Input, select, dan textarea memakai font 16px (aturan global `max-width: 767px`) agar iOS tidak memperbesar layar saat fokus.
- Header `Card` dan `Footer` membungkus baris (`flexWrap: wrap`) alih-alih meluap. Kontrol yang lebih lebar dari satu tombol kecil ditaruh di badan kartu sebagai toolbar, bukan di header.
- Pada daftar dengan banyak aksi per baris, tombol berlabel menjadi ikon saja di mobile (prop `compact`), tetap dengan `aria-label`.
- Teks petunjuk mengikuti perangkat: "Ketuk" di mobile, "Drag dan drop atau klik" di desktop.
- Konten memiliki padding `16px 12px 88px` agar tidak tertutup bottom nav.
- Tinggi layar memakai `100dvh`. Yang discroll hanya `main`, bukan halaman.

## 8. Pola Halaman

```tsx
export function ItemPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader title="Item" description="Kelola daftar item" action={<Button variant="primary">Tambah</Button>} />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-7">
          <ItemList />
        </div>
        <div className="col-span-12 md:col-span-5">
          <ItemSummary />
        </div>
      </div>
    </div>
  );
}
```

Aturan bento:
- Jumlah kolom pada satu baris selalu 12 (8 + 4, 7 + 5, 6 + 6, 5 + 7, 4 + 4 + 4)
- Di mobile semua kartu menjadi satu kolom
- Kartu statistik memakai `grid-cols-2 lg:grid-cols-4`
- Jarak antarkartu 16px

Setiap kartu memiliki tiga keadaan baku:
1. **Memuat**: `Skeleton` dengan tinggi mendekati isi akhir
2. **Kosong**: `EmptyState`
3. **Terisi**

Kartu berisi daftar memakai `bodyStyle={{ padding: 0 }}` dengan `ListRow`, baris terakhir diberi `last`.

Halaman yang melebihi sekitar 250 baris dipecah: fungsi murni ke `grouping.ts` atau sejenisnya, aksi dan mutasi ke hook `use<Fitur>Actions`, bagian visual ke komponen kecil.

## 9. Komponen UI

Semua komponen memakai named export. Pengecualian hanya `App` (default, dibutuhkan Astro).

| Komponen | Properti utama |
| --- | --- |
| `Button` | `variant`: primary, secondary (bawaan), danger, ghost. `size`: sm (28px), md (34px, bawaan), lg (42px). `loading`, `icon`, turunan atribut `button` |
| `Card` | `title`, `action`, `bodyStyle`, `hover`, `onClick`, `style`. Jika ada judul atau aksi, header 48px dengan garis bawah |
| `Modal` | `open`, `onClose`, `title`, `width` (480). Tutup dengan klik latar atau Escape. Fokus terkunci di dalam dialog dan dikembalikan ke pemicu saat ditutup. Konten panjang discroll |
| `Badge` | `variant`: default, success, danger, warning, accent. `dot` |
| `LinkButton` | tautan `<a>` dengan `variant`, `size`, `icon` yang sama dengan `Button`. Gaya keduanya dari `buttonStyle(variant, size)` |
| `Chip` | `active`, `onClick`, `count`, `dot` (warna CSS), `disabled`, `title`. Pil dengan `aria-pressed`, tinggi minimal 30px. Satu-satunya gaya pil di aplikasi |
| `Toggle` | `checked`, `onChange(val)`, `label` (wajib, menjadi `aria-label`), `disabled`. Area sentuh 28px |
| `Slider` | `value`, `label` (wajib), `valueText`, `min`, `max`, `step`, `origin` (titik awal isian, contoh 0 dB), `onChange`, `disabled`, `formatLabel`. Fokus keyboard tampil sebagai cincin pada thumb |
| `Skeleton`, `SkeletonCard` | `width`, `height`, `radius`, `style` |
| `PageHeader` | `title`, `description`, `action` |
| `EmptyState` | `text`, `icon`, `padding` (32) |
| `ListRow` | `children`, `last`, `highlighted`, `dimmed`, `onClick`, `style` |
| `SettingRow` | `title`, `desc`, `children`, `last` |
| `Field` | `label`, `htmlFor`, `hint`, `error`, `children` |
| `ConfirmHost` | tanpa properti, dipasang sekali di `App` |

Tipe `Tone` di `constants.ts` identik dengan varian `Badge`, sehingga peta varian domain bertipe `Record<string, Tone>`.

Konvensi tombol: aksi di baris memakai `sm` dengan ikon 12 sampai 13px. Aksi utama halaman memakai `primary`. Aksi merusak memakai `danger` atau ikon dengan warna `--danger`. Tombol hanya ikon wajib punya `title` dan `aria-label`.

Form: label di atas input lewat `Field`, jarak 6px antara label dan input, 12 sampai 16px antarbidang. Aksi form di kanan bawah: Batal (ghost) lalu Simpan (primary).

## 10. Lapisan Data

### api.ts

Pembungkus `fetch` dengan `credentials: "include"`. Respons 401 di luar `/login` mengarahkan ke `/login` sekali saja. Respons gagal melempar `Error` dengan pesan dari field `error`. Ekspor `api.get<T>`, `api.post<T>`, `api.upload<T>` (FormData). Basis URL dari `PUBLIC_API_URL`.

### createResource

Satu pembuat hook untuk semua query, dan satu hook mutasi.

```ts
export const useItems = createResource<ItemsResponse>({
  key: "items",
  path: () => "/api/items",
  ...POLICY.schedule,
});

const useItemResource = createResource<ItemResponse, string>({
  key: "item",
  path: (id) => `/api/items/${id}`,
  ...POLICY.schedule,
});

export function useItem(id: string, enabled = true) {
  return useItemResource(id, { enabled });
}

export function useSaveItem() {
  return useApiMutation(
    (body: SaveItemBody) => api.post("/api/items", body),
    (body) => [["items"], ["item", body.id]]
  );
}
```

Aturan:
- `queryKey` berupa `[key]` atau `[key, parameter]`, kunci pertama string yang stabil.
- Opsi query: `enabled`, `keepPrevious` (untuk paginasi).
- Mutasi menyebut sendiri kunci yang harus diinvalidasi. Mutasi tanpa input dipanggil `mutateAsync(undefined)`.
- Satu data hanya dipoll oleh satu hook. Komponen yang membutuhkan data yang sama memanggil hook yang sama, tidak membuat `useQuery` sendiri dengan kunci yang sama atau kunci berbeda untuk data yang sama.

### POLICY

| Jenis data | `staleTime` | `refetchInterval` |
| --- | --- | --- |
| `status` | 4 detik | 5 detik |
| `config` | 30 detik | 15 detik |
| `log` | 30 detik | 30 detik |
| `schedule` (data daftar yang jarang berubah) | 60 detik | tidak ada |
| `holiday` (data eksternal yang hampir statis) | 24 jam | tidak ada, `retry: 0` karena backend sudah mencoba beberapa sumber |

Jenis baru ditambahkan ke `POLICY`, bukan ditulis di hook.

### Tipe dan galat

- Semua respons dan body dideklarasikan di `types.ts`. `any` tidak dipakai.
- Union terdiskriminasi untuk body dengan banyak aksi (contoh `{ action: "add" | "edit" | "delete" }`).
- Penanganan galat: `catch (e)` lalu `toast.error(errorMessage(e))`. Bentuk `catch (e: any)` dilarang. Keberhasilan aksi ditandai `toast.success`.

### Konfirmasi

```ts
const ok = await confirmAction({
  title: "Hapus item",
  message: "Item akan dihapus permanen.",
  confirmLabel: "Hapus",
  danger: true,
});
if (!ok) return;
```

`confirmAction` mengirim event ke `ConfirmHost`. `logout()` juga memakainya. Untuk aksi yang sangat berdampak (contoh reset log), pakai tombol dua langkah: klik pertama mengubah label menjadi "Konfirmasi ...", otomatis kembali setelah 3 detik lewat `useEffect` dengan pembersih.

## 11. Caching

Tiga lapis:

1. **Memori**: TanStack Query dengan `gcTime` 24 jam.
2. **Persisten**: cache query disimpan ke `localStorage` (kunci `app-query-cache-v2`, maksimal 24 jam) hanya untuk kunci pertama yang ada di daftar putih `PERSISTED`. Data yang dipulihkan divalidasi bentuknya sebelum `hydrate`. Dipulihkan saat aplikasi dibuka sehingga tampilan langsung terisi lalu menyegarkan diri. Cache dihapus saat logout lewat `clearPersistedCache()`.
3. **Service worker**: lihat bagian 12.

Aturan:
- Hanya data berstatus sukses yang dipersist.
- Kegagalan membaca atau menulis penyimpanan diabaikan.
- Setiap kunci query baru yang aman dipersist ditambahkan ke `PERSISTED`. Jika bentuk data berubah tidak kompatibel, naikkan versi pada nama kunci penyimpanan.

## 12. PWA

**Manifest**: `id` dan `scope` dan `start_url` `/`, `display: standalone`, `orientation: portrait-primary`, ikon PNG 192 dan 512 (`any` dan `maskable` sebagai entri terpisah), `theme_color` mengikuti aksen terang, `background_color` mengikuti tema gelap.

**Service worker** (`sw.js`), tanpa precache halaman yang memerlukan login:
- Aset berhash di `/_astro/`: cache-first, batas 100 entri
- Aset shell (ikon, manifest): stale-while-revalidate
- Halaman HTML: network-first, cache sebagai cadangan saat luring (respons redirect tidak disimpan)
- `/api/`, `/login`, `/logout`, `/healthz`, `/sw.js` dan semua permintaan non-GET atau lintas origin: tidak dicegat
- Tiga nama cache (`pages`, `assets`, `shell`) berakhiran versi. Naikkan ketiganya bersamaan setiap logika `sw.js` berubah. Cache yang tidak ada di daftar `KEEP` dihapus saat aktivasi.
- Registrasi hanya pada build produksi. Pada dev, registrasi lama dibatalkan.

**Popup install** (`InstallPrompt`):
- Android dan desktop: `beforeinstallprompt`, tombol Install dan Nanti
- iOS: panduan "Ketuk Bagikan lalu Tambah ke Layar Utama", tombol Tutup
- Tidak muncul jika aplikasi sudah terpasang (`display-mode: standalone`)
- Setelah ditutup, tidak muncul lagi selama 7 hari
- Mobile: di atas bottom nav. Desktop: pojok kanan bawah, lebar 380px

## 13. Halaman Login

- Dua panel pada layar lebih dari 900px: form 544px di kiri, panel dekoratif di kanan. Satu kolom pada layar sempit.
- Kartu form: logo dan nama, judul, deskripsi, bidang username dan password (`input-group` dengan ikon di sisi, tombol tampil/sembunyi password dengan `title` dan `aria-label`), tombol Masuk.
- Panel dekoratif: titik-titik latar, logo besar transparan, judul pemasaran, tiga poin keunggulan, teks merek besar transparan di bawah.
- Layout dikunci `position: fixed; inset: 0` dan scroll `html` serta `body` dimatikan lewat `useEffect` dengan pembersih. Jika layar sangat pendek, hanya kolom form yang discroll.
- Input memakai ukuran font 16px agar iOS tidak memperbesar layar saat fokus.
- Pesan galat tampil sebagai kotak merah di atas tombol, diambil dari `errorMessage(err)`.
- Semua teks dibaca dari `APP` di `app.config.ts`.

## 14. Halaman Astro

`src/layouts/Layout.astro` adalah satu-satunya tempat `<head>`: charset, favicon `.ico` dan `.svg`, viewport, `theme-color`, manifest, `<title>`, dan meta Open Graph. Props: `title` (wajib) dan `description` (opsional). Judul akhir `"{title} - {APP.name}"`. Impor `global.css` dilakukan di layout. `lang` mengikuti bahasa antarmuka.

Semua halaman panel dibangkitkan oleh satu berkas `src/pages/[...page].astro` dari `ROUTES`. Path `/` menjadi parameter `undefined` sehingga menghasilkan `index.html`; path lain menghasilkan `<nama>.html` karena `format: "file"`.

```astro
---
import type { GetStaticPaths } from "astro";
import App from "../components/App";
import Layout from "../layouts/Layout.astro";
import { ROUTES } from "../lib/routes";

export const getStaticPaths = (() =>
  ROUTES.map((route) => ({
    params: { page: route.path === "/" ? undefined : route.path.slice(1) },
    props: { route },
  }))) satisfies GetStaticPaths;

const { route } = Astro.props;
---

<Layout title={route.title}>
  <App page={route.key} client:only="react" />
</Layout>
```

Judul berasal dari `route.title`, sumber yang sama dengan `titleOf`. Halaman publik (`landing.astro`, `login.astro`) tetap berupa berkas sendiri, hanya memuat Layout dan satu komponen React dengan `client:only="react"`, dan memberi judul sendiri.

Halaman 404 memakai Layout dan token CSS yang sama, bukan nilai literal.

## 15. Landing Page

Halaman publik pemasaran di `/landing`, di luar `ROUTES`, tanpa sidebar.

### Konten

Semua teks, daftar, ikon, dan contoh data ada di `lib/landing.ts`: objek `LANDING` untuk teks, serta daftar bertipe (`NAV_LINKS`, `STEPS`, `SERVER_LAYERS`, `BENEFITS`, `ROLES`, `FAQ`, `PREVIEW`, objek `DEMO`). Komponen tidak berisi kalimat. Mengganti produk berarti mengganti satu berkas ini. Klaim hanya boleh memuat fitur yang benar-benar ada di aplikasi. Testimoni, harga, dan angka tanpa data asli tidak dibuat.

### Susunan bagian

1. **Nav**: logo dan nama, tautan jangkar (hanya desktop), tombol tema, tombol Masuk ke `/login`. Lengket, tinggi `BAR_H`.
2. **Hero**: label, judul, lead, dua tombol (utama ke `/login`, kedua ke jangkar demo), kredit pembuat dari `FOOTER`. Latar titik-titik seperti login. Di kanan, demo interaktif.
3. **Cara kerja**: langkah berurutan, kartu dengan ikon, waktu, judul, deskripsi.
4. **Pita penjelasan**: dua kolom pada latar `--panel`, daftar poin dengan garis kiri aksen.
5. **Keunggulan**: kartu 4 kolom (`lg:col-span-3`), ikon, judul, deskripsi.
6. **Untuk setiap peran**: artikel dua kolom yang bergantian kiri-kanan di desktop, satu kolom di mobile. Sisi teks berisi judul, lead, daftar centang. Sisi lain berisi cuplikan antarmuka yang dirakit dari komponen UI yang sama (`Card`, `ListRow`, `Badge`, `SettingRow`), bukan gambar.
7. **Pertanyaan**: `<details>` dan `<summary>` bawaan, tanpa JavaScript.
8. **Ajakan bertindak**: satu kartu dengan tombol Masuk.
9. **Footer**: komponen `Footer` yang sama dengan panel.

### Demo interaktif

Komponen `BellDemo` memperagakan fitur inti tanpa memanggil API: tombol memicu aksi contoh, sakelar mengubah hasilnya, status diumumkan lewat `role="status"` dan `aria-live="polite"`. Timer dibersihkan pada `useEffect`. Semua teks demo dari `DEMO`.

### Aturan

- Gaya berulang (container, section, tautan sebagai tombol, label) berada di `landingStyle.ts`.
- Tautan bergaya tombol memakai `LinkButton`, bukan `Button`, agar tetap tautan sungguhan dengan tampilan yang identik.
- Jangkar memakai `scrollMarginTop: BAR_H`. `scroll-behavior: smooth` sudah global.
- Dipasang tanpa framer-motion. Tidak ada animasi gulir.
- Footer landing tampil di mobile, jadi wajib diuji pada 360px tanpa sesi.
- Tema, font, token, dan komponen sama dengan panel. Tidak ada warna atau ukuran baru.
- `description` dikirim ke Layout untuk meta SEO dan Open Graph.

## 16. Aksesibilitas dan Responsif

- Tombol ikon memiliki `title` dan `aria-label`
- Modal memiliki `role="dialog"`, `aria-modal`, dan `aria-label`, menjebak fokus, dan mengembalikan fokus ke pemicu
- Label form terhubung ke input lewat `htmlFor`
- Chip dan tombol pilihan memakai `Chip` (sudah ber-`aria-pressed`)
- `Toggle` dan `Slider` wajib diberi `label`; tipe menolak pemanggilan tanpa label
- Elemen non-tombol yang dapat diklik (contoh zona upload) diberi `role="button"`, `tabIndex={0}`, dan menangani Enter serta Spasi
- Tautan navigasi aktif memakai `aria-current="page"`
- Fokus input terlihat jelas
- Target sentuh minimal sekitar 28px untuk aksi sekunder dan 34px untuk aksi utama
- Tabel lebar dibungkus kontainer `overflow-x: auto` dengan `min-width`
- Teks panjang dipotong dengan elipsis dan `minWidth: 0` pada kontainer fleksibel
- Input file tersembunyi tetap diberi `aria-label`
- Ikon dekoratif diberi `aria-hidden`
- Pembaruan status dinamis memakai `role="status"`

## 17. Konvensi Kode

- Satu komponen utama per berkas, nama berkas sama dengan nama komponen. Komponen pembantu kecil yang tidak diekspor boleh berada di berkas yang sama.
- Tanpa komentar dan emoticon
- Tidak mengimpor `React` bawaan. Impor hanya tipe atau hook yang dipakai (`jsx: react-jsx`), misalnya `type CSSProperties`, bukan `React.CSSProperties`
- Tidak menulis nama aplikasi, label menu, atau daftar halaman langsung di komponen
- Konstanta domain di `constants.ts`, tipe di `types.ts`, pemformat di `format.ts`, konten pemasaran di `landing.ts`. Tidak diduplikasi
- Gaya yang dipakai lebih dari dua kali dijadikan konstanta atau komponen
- Tidak ada warna atau ukuran layout yang ditulis langsung jika sudah ada token atau konstanta
- Tanpa `any`. Data tak bertipe masuk sebagai `unknown` lalu dipersempit
- Penulisan `localStorage` selalu dibungkus `try/catch`
- Listener, timer, dan debounce selalu dibersihkan pada fungsi pembersih `useEffect`
- Operasi berurutan atas banyak item memakai `for ... of` dengan `await`, bukan `Promise.all`, bila backend menulis ke berkas yang sama
- Salah ketik pada teks antarmuka (spasi hilang di tengah kalimat) diperiksa saat tinjauan
- Format kode: Prettier, lebar 100

## 18. Pemeriksaan

Sebelum commit:

```bash
pnpm format
pnpm check
pnpm test
pnpm e2e
grep -rnE "any\b|confirm\(|#[0-9a-fA-F]{3,6}" src --include=*.ts --include=*.tsx | grep -v "#fff"
```

Satu-satunya temuan yang sah adalah `themeColor` di `app.config.ts`.

Setelah build, bandingkan ukuran `dist/_astro/*.br` dengan build sebelumnya. Kenaikan di chunk halaman atau chunk bersama perlu dijelaskan. Berkas `.br` baru ada setelah `scripts/deploy.sh` (tahap precompress), bukan setelah `pnpm build`. Untuk perbandingan cepat tanpa deploy:

```bash
for f in dist/_astro/*.js dist/_astro/*.css; do echo "$(brotli -q 11 -c "$f" | wc -c) $(basename "$f")"; done | sort -rn
```

Acuan terakhir: total sekitar 150 KB brotli. `Modal` sekitar 6 KB, ditambah inti motion bersama sekitar 10 KB dan `motionFeatures` sekitar 13 KB yang dimuat async setelah render pertama.

## 19. Build dan Rilis

`scripts/deploy.sh` menjalankan urutan berikut dari root repositori, dengan `HOST` dan `SERVICE` dapat diganti lewat variabel lingkungan:

1. `pnpm build` menghasilkan `dist/` dengan `format: "file"` (satu HTML per halaman)
2. Berkas HTML, JS, CSS, SVG, JSON, dan ICO dibuat versi Brotli (kualitas 11) dan gzip (zopfli bila tersedia). Server menyajikan versi terkecil sesuai `Accept-Encoding`
3. Peta sumber dihapus
4. Backend dibangun statis untuk target server dari `./server`
5. Unggah frontend memakai `rsync -az --delete`
6. Unggah backend ke berkas sementara, cadangkan versi lama, hentikan layanan, ganti, jalankan, lalu cek `/healthz`

Berkas `_astro/` diberi cache `immutable` satu tahun karena namanya berhash.

### CI/CD

- `.github/workflows/ci.yml` berjalan pada push ke `main`, pull request, dan dipanggil oleh release. Urutannya: Prettier dan gofmt, `bash -n` dan shellcheck untuk `scripts/`, `pnpm check` dan `go vet`, `pnpm test`, `pnpm e2e`.
- `.github/workflows/release.yml` berjalan pada tag `vX.Y.Z`. Ia menjalankan CI, menolak tag di luar `main` atau tanpa bagian di `CHANGELOG.md`, lalu memanggil `scripts/package.sh` dan menerbitkan GitHub Release.
- Paket `bel-madrasah-linux-<arch>.tar.gz` berisi `bel-madrasah` (versi ditanam lewat `-X main.version`), `static/` yang sudah di-precompress, dan `bel-madrasah-update`. `checksums.txt` memuat SHA-256 semua paket.
- Server menarik release sendiri lewat `bel-madrasah-update` dan timer systemd, sehingga tidak perlu dapat dijangkau dari internet. Updater berjalan sebagai root dari `/usr/local/sbin`, bukan dari direktori proyek yang dimiliki user layanan, dan membaca versi binary terpasang sebagai `nobody`.
- Updater hanya mengganti binary dan `static/`, mengecek `/healthz`, dan memulihkan cadangan bila gagal. Ia memperbarui dirinya sendiri sebagai langkah terakhir setelah versi baru sehat.
- Scheduler memulihkan daftar bel yang sudah berbunyi hari ini dari log aktivitas saat start, sehingga restart kapan pun tidak membunyikan bel dua kali.
- Logika rilis berada di skrip (`package.sh`, `precompress.sh`, `release-notes.sh`), bukan di YAML, agar dapat dijalankan dan diuji di mesin lokal.

### Kontrak backend

Frontend mengandalkan perilaku berikut dari server:

- Halaman panel ditemukan dari hasil build: `/<nama>` menyajikan `static/<nama>.html` bila berkas itu ada, `/` menyajikan `index.html`. Nama harus cocok `^[a-z0-9-]+$`, dan `login`, `landing`, `404` dikecualikan. Semua halaman panel dilindungi sesi; tanpa sesi diarahkan (303) ke `/login`. Backend tidak menyimpan daftar halaman.
- `/landing` dan `/login` publik. Keduanya diarahkan (303) ke `/` bila diakses dengan sesi sah.
- Sesi bertahan setelah server dimulai ulang. Server hanya menyimpan hash SHA-256 token di `data/sessions.json` (izin 0600), tidak pernah token mentah.
- `/` tanpa sesi diarahkan (303) ke `/landing`. Dengan sesi, menyajikan dashboard.
- Endpoint `/api/*` mengembalikan `401` berbentuk JSON `{"error": ...}` untuk permintaan tanpa sesi yang menyertakan `Accept: application/json` atau `Content-Type: application/json`. Tanpa header itu, server mengarahkan ke `/login`.
- `/healthz` publik dan mengembalikan teks `ok`.
- `/logout` menghapus sesi lalu mengarahkan ke `/login`.
- Kegagalan membaca berkas dari disk pada halaman tidak ditemukan menghasilkan `404.html` dengan status 404.

Uji setelah rilis:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://HOST/
curl -s -o /dev/null -w "%{http_code}\n" https://HOST/landing
curl -s -o /dev/null -w "%{http_code}\n" -H "Accept: application/json" https://HOST/api/config
```

Hasil yang diharapkan: `303` ke `/landing`, `200`, dan `401`. Kontrak ini juga diuji otomatis oleh `TestPublicRoutingContract` di `server/routes_test.go`.

### Struktur backend

Satu `package main` di `server/`, dibangun dengan `go build ./server`. Satu berkas per domain, handler HTTP dipisah dari logika:

| Berkas | Isi |
| --- | --- |
| `main.go` | wiring, start dan shutdown |
| `paths.go` | `BEL_BASE_DIR` dan semua path berkas data |
| `routes.go` | satu-satunya daftar route |
| `static.go` | halaman panel, landing, PWA, aset precompressed |
| `respond.go`, `middleware.go` | helper respons JSON, CORS, batas body |
| `config.go`, `jadwal.go`, `activity.go`, `tones.go`, `equalizer.go`, `auth.go` | model dan penyimpanan per domain |
| `player.go`, `scheduler.go` | pemutaran ffmpeg dan loop bel |
| `api_<domain>.go` | handler HTTP, hanya memvalidasi input lalu memanggil logika domain |
| `<domain>_test.go` | uji per domain, memakai `setupTestDir` dari `helpers_test.go` |

Aturan backend:
- Daftar nilai ditulis sekali (`AllModes`, `AllHari`); turunan seperti `validModes` dibangun dari daftar itu.
- Path audio di jadwal disimpan absolut, tetapi API menerima nama file saja (`resolveAudioPath`), sehingga frontend tidak perlu tahu lokasi direktori tone.
- Perubahan jadwal yang membaca lalu menulis memakai `updateJadwal` agar terkunci dari awal sampai akhir.
- Nama file dari klien harus persis nama dasar (`safeFilename(x) == x`); input berisi path ditolak, tidak dirapikan diam-diam.

Direktori dasar backend dapat dipindah lewat `BEL_BASE_DIR` (bawaan `/opt/bel-madrasah`) untuk menjalankan server lokal pada salinan data, misalnya saat uji visual dengan peramban headless.

## 20. Memulai Proyek Baru

1. Salin struktur folder bagian 3, `package.json`, `tsconfig.json`, `.prettierrc`, `astro.config.mjs`, `scripts/`, `tests/e2e/cdp.mjs`, `.env.example`.
2. Ubah `app.config.ts`: nama, logo, warna tema, watermark, dan konten login. Ubah awalan variabel env (`BEL_` menjadi awalan project).
3. Ubah `manifest.json`: nama, deskripsi, warna. Ganti `icon.svg`, `favicon.ico`, dan ikon PNG. Siapkan ikon maskable terpisah dengan area aman sekitar 80% dari kanvas.
4. Naikkan versi nama cache di `sw.js` ke nama project baru.
5. Ganti konstanta domain di `constants.ts` dan tipe di `types.ts`.
6. Tulis ulang `landing.ts`: teks, langkah, keunggulan, peran, FAQ, contoh data, dan teks demo. Sesuaikan `BellDemo` dan cuplikan di `RoleSection` dengan domain baru.
7. Daftarkan halaman panel: tambah entri (termasuk `icon`) di `routes.ts`, lalu tambahkan komponennya ke `PAGES` di `App.tsx`. Berkas HTML dibangkitkan otomatis dan backend menemukannya sendiri.
8. Untuk setiap halaman: `PageHeader`, lalu grid 12 kolom berisi `Card`, dengan tiga keadaan baku.
9. Untuk setiap resource: satu hook lewat `createResource`, mutasi lewat `useApiMutation`. Tambahkan kunci yang boleh dipersist di `queryClient.ts`.
10. Isi `.env.example` dan atur identitas footer.
11. Penuhi kontrak backend bagian 19 (rute `/landing`, redirect `/`).
12. Jalankan `pnpm check`, `pnpm build`.

Menambah halaman panel hanya menyentuh dua tempat: `routes.ts` dan `PAGES` di `App.tsx`. Yang kedua bertipe `Record<PageKey, ReactNode>`, sehingga `tsc` gagal bila ada halaman yang lupa dipetakan.

## 21. Daftar Periksa Sebelum Rilis

- `pnpm check` bersih, `pnpm test` dan `pnpm e2e` lulus, `pnpm format` tidak mengubah apa pun (CI memeriksa semuanya)
- Bagian `## vX.Y.Z` ditambahkan ke `CHANGELOG.md` sebelum tag dibuat
- Tidak ada `any`, `confirm(`, `window.confirm`, atau `catch (e: any)` di `src`
- Tidak ada warna heksadesimal di komponen selain `#fff`
- Tidak ada nama aplikasi atau kalimat pemasaran yang tertulis langsung di komponen
- Setiap tombol ikon punya `title` dan `aria-label`
- Tiga keadaan baku ada di setiap kartu data
- Kunci query baru sudah didaftarkan di `PERSISTED` bila perlu
- Versi cache `sw.js` naik bila logikanya berubah
- `<title>` halaman panel berasal dari `titleOf`
- Kontrak backend lolos tiga uji `curl` di bagian 19
- Ukuran aset dibandingkan dengan rilis sebelumnya
- Halaman atau alur baru ditambahkan ke `tests/e2e/run.mjs` (daftar `PANEL`/`PUBLIC` dan skenario), karena e2e yang memeriksa luapan 360px dan area sentuh
- Uji manual untuk yang belum diotomasi: tema terang, mode luring, instal PWA, Tab di dalam Modal, tombol Keluar, dan demo landing

## 22. Fitur Audio Acuan

Dua fitur pada halaman Audio menjadi contoh pola baku untuk pengaturan dan aksi berkas.

**Ganti nama file** (`RenameModal`, `POST /api/tones/rename`):
- Input menampilkan nama tanpa ekstensi; ekstensi asli selalu dipertahankan dan ditampilkan sebagai `addon`.
- Server menyanitasi nama dengan aturan yang sama seperti upload, menolak nama yang sudah dipakai (`409`), lalu memperbarui setiap entri jadwal yang menunjuk file tersebut dalam satu kunci. Bila pembaruan jadwal gagal, nama file dikembalikan.
- Mutasi menginvalidasi `tones`, `jadwal`, dan `service-status`. Pesan sukses menyebut nama akhir dari server dan jumlah jadwal yang ikut berubah; frontend tidak menebak hasil sanitasi.

**Equalizer** (`EqualizerCard`, `GET`/`POST /api/equalizer`):
- Lima band tetap (60 Hz, 250 Hz, 1 kHz, 4 kHz, 12 kHz), rentang -12 sampai 12 dB, langkah 0,5 dB. Frekuensi dan rentang berasal dari server, preset (`EQ_PRESETS`) dari `constants.ts`.
- Pola draf: sakelar dan slider mengubah state lokal, tombol Simpan dan Batal aktif hanya bila ada perubahan. Tidak ada simpan otomatis per slider.
- Server menerapkan equalizer lewat ffmpeg (`lowshelf`, `equalizer`, `highshelf`, lalu `alimiter` bila ada band yang dinaikkan) sebelum `volume`, mulai pemutaran berikutnya.
- Pratinjau di browser melewati rantai Web Audio (`BiquadFilterNode` dan `DynamicsCompressorNode` sebagai limiter), sehingga perubahan slider langsung terdengar. Rantai hanya aktif selama halaman Audio terbuka.
- Respons filter browser identik dengan speaker: server memakai shelf dengan slope 1 (`t=s:w=1`) dan peaking dengan Q (`t=q`), yaitu rumus RBJ yang sama dengan spesifikasi Web Audio. Nilai Q (`peak_q`) dikirim server, tidak ditulis di frontend. Satu-satunya perbedaan adalah limiter (`alimiter` versus kompresor), yang hanya bekerja saat sinyal mendekati 0 dBFS.

**Perangkat audio** (`AudioDeviceCard` di Pengaturan, `/api/audio/devices`, `/api/audio/test`):
- Backend membaca `/proc/asound/cards` dan `/proc/asound/pcm`, tidak bergantung pada `aplay`. Setiap output playback menjadi `plughw:CARD=<id>,DEV=<n>`: nama card stabil walau nomornya berubah, nomor device diambil dari sistem, dan `plughw` mengonversi kanal serta sample rate.
- Urutan sumber: pilihan di Pengaturan, lalu `BEL_ALSA_DEVICE` (nilai `hw:` dinormalkan ke `plughw:`), lalu deteksi otomatis (USB, jack analog, HDMI terakhir, `default` bila tidak ada). Kartu menampilkan sumber yang sedang berlaku.
- "Tes speaker" menguji pilihan di dropdown sebelum disimpan dan menunggu ffmpeg selesai, sehingga galat ALSA tampil sebagai pesan, bukan bel yang diam.
- Pilihan yang perangkatnya tercabut tetap terlihat sebagai "(tidak terhubung)" disertai peringatan.

**Hapus file** (`ToneList`, `POST /api/tones/delete`):
- Daftar audio menampilkan jumlah jadwal pemakai tiap file (`usage` dari `GET /api/tones`) sebagai badge.
- Dialog konfirmasi menyebut jumlah itu. Server menghapus file lalu semua entri jadwal yang menunjuknya, dan mengembalikan `removed`. Jadwal tidak pernah menunjuk file yang sudah hilang.
- `POST /api/config` mempertahankan nilai equalizer yang tersimpan, karena form konfigurasi tidak mengirimnya.

## 23. Utang Teknis yang Diketahui

Tidak ada penyimpangan yang diketahui dari aturan di atas. Batasan yang disengaja:

- Update otomatis hanya mengganti binary dan frontend. Perubahan pada unit systemd, konfigurasi nginx, atau installer tetap memerlukan menjalankan `scripts/install.sh` ulang

- Unit test frontend hanya menjangkau modul tanpa impor runtime; komponen React diuji lewat e2e, bukan uji komponen terpisah
