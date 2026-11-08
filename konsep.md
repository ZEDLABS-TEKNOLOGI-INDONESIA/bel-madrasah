# Konsep Frontend

Rujukan baku untuk membangun panel admin berbasis web yang cepat, ringan, dan seragam. Backend tidak termasuk cakupan. Implementasi acuan: Bel Madrasah.

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

## 2. Stack dan Perkakas

| Lapisan | Pilihan |
| --- | --- |
| Framework | Astro 7 (static, `client:only="react"`) |
| UI | React 19 |
| Data | TanStack Query 5 |
| Animasi | framer-motion (hanya Modal dan InstallPrompt) |
| Ikon | lucide-react |
| Notifikasi | react-hot-toast |
| CSS | Tailwind v4 (hanya grid) dan CSS variable |
| Font | @fontsource-variable/lexend (self-hosted) |
| Bahasa | TypeScript 6 (strict, lewat `astro/tsconfigs/strict`) |
| Format | Prettier, `printWidth` 100 |
| Paket | pnpm, Node 22.12 atau lebih baru |

Catatan perkakas:
- Pakai TypeScript 6. `astro check` belum mendukung TypeScript 7 dan membawa dependensi yang bentrok, jadi pemeriksaan tipe memakai `tsc`.
- `astro sync` harus jalan sebelum `tsc` agar tipe `import.meta.env` tersedia.
- Skrip `package.json`:

```json
"check": "astro sync && tsc --noEmit",
"format": "prettier --write \"src/**/*.{ts,tsx,css}\""
```

- `.prettierrc`:

```json
{
  "printWidth": 100
}
```

Gaya komponen ditulis sebagai inline style yang membaca CSS variable. Tailwind hanya untuk `grid grid-cols-12 gap-4`, `col-span-*`, dan variasi `md:` serta `lg:` pada keduanya.

## 3. Struktur Folder

```
public/
  icon.svg  favicon.ico  manifest.json  sw.js
  icons/icon-192.png  icons/icon-512.png
src/
  pages/              satu .astro per halaman, hanya membungkus <App page="..." />
  styles/global.css   token tema, reset, kelas utilitas, keyframe
  lib/
    app.config.ts     identitas aplikasi
    routes.ts         satu-satunya sumber daftar halaman, termasuk ikon
    constants.ts      konstanta domain bersama
    layout.ts         ukuran tetap layout
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
    layout/           Shell, Sidebar, TopBar, Footer, InstallPrompt
    ui/               Button, Card, Modal, Badge, Toggle, Slider, Skeleton,
                      PageHeader, EmptyState, ListRow, SettingRow, Field, ConfirmHost
    auth/             LoginPage
    <fitur>/          satu folder per halaman
```

Layanan non-React yang memegang state sendiri (contoh: `audioManager.ts`) berupa kelas dengan `subscribe`, dibungkus satu hook agar React ikut berlangganan.

## 4. Konfigurasi Terpusat

**`app.config.ts`**: `APP.name` dan `APP.logo`. Nama aplikasi tidak boleh ditulis langsung di komponen atau halaman.

**`routes.ts`**: `ROUTES` berisi `key`, `path`, `label`, `title`, dan `icon`. Menu sidebar, bottom nav, judul topbar, prefetch, dan pemetaan path ke halaman semuanya membaca berkas ini. Turunannya: `PATHS`, `PATH_TO_KEY`, `titleOf`.

**`constants.ts`**: label, varian badge, daftar nilai, dan kunci yang dipakai lebih dari satu berkas. Satu deklarasi untuk seluruh aplikasi. Fungsi kecil seperti `modeLabel` ikut di sini.

**`layout.ts`**: `BAR_H` 56, `FOOT_H` 44, `SIDEBAR_W` 220, `SIDEBAR_W_COLLAPSED` 64. Garis topbar sejajar dengan header sidebar, garis footer sejajar dengan footer sidebar, karena memakai konstanta yang sama.

**`types.ts`**: semua tipe respons dan body API. Kunci komputasi dibuat lewat tipe literal templat dan fungsi pembantu bertipe (contoh `rangeKey`).

**Identitas footer** diinjeksi saat build lewat `define: __FOOTER_CONFIG__` di `astro.config.mjs`, dibaca dari variabel env berawalan nama project (`BEL_`). Komponen memakai nilai bawaan jika konstanta tidak terdefinisi.

**`.env.example`** wajib ada dan memuat semua variabel: backend, dev server frontend, footer dan branding.

## 5. Routing SPA

- Setiap halaman Astro memuat komponen `App` yang sama dengan prop `page`.
- Komponen meminta navigasi lewat `go(path)` atau event `spa-do-navigate`. Router mengumumkan hasilnya lewat event `spa-navigate`.
- Router mengambil HTML halaman tujuan untuk dua keperluan: memastikan sesi masih sah (status 401 atau redirect ke `/login` mengarahkan ke halaman login) dan mengambil `<title>`. Karena itu `<title>` tiap berkas `.astro` harus sesuai dengan `title` di `routes.ts`.
- Cache HTML halaman berlaku 5 menit.
- Prefetch dilakukan saat hover pada desktop, saat `touchstart` pada mobile, dan saat idle untuk semua halaman.
- Tombol back dan forward ditangani lewat `popstate`. Jika navigasi sedang berjalan, tujuan terakhir ditahan lalu dijalankan setelahnya.
- Halaman di-lazy-load dengan `React.lazy` dan `Suspense`.
- Sidebar menandai item aktif lewat `startsWith`, kecuali `/` yang dicocokkan persis.

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

Tema disimpan di `localStorage` dengan kunci `theme`. `initTheme()` dipanggil di `Shell` dan `LoginPage`. Tidak ada warna yang ditulis langsung di komponen kecuali putih (`#fff`) pada teks di atas aksen.

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
- Tanpa blur latar. Bayangan hanya pada Modal dan InstallPrompt

### Lapisan z-index

| Elemen | z-index |
| --- | --- |
| Topbar | 50 |
| Sidebar dan bottom nav | 100 |
| InstallPrompt | 999 |
| Modal | 1000 |

### Kelas utilitas dan keyframe

Kelas: `btn` (efek tekan dan filter), `row-hover`, `card-hover`, `tabular`, `input-group` dan `addon`, `wave-bar`, `animate-fade-in`.
Keyframe: `spin`, `wave`, `fade-in`, `shimmer`, `pulse-ring`.

Elemen `input`, `select`, `textarea` bergaya global. Fokus ditandai garis dan cincin warna aksen (`--accent-soft`). Scrollbar tipis 6px dan seleksi teks berwarna aksen juga diatur global.

## 7. Tata Letak

### Breakpoint

Satu titik pemisah: 768px, dibaca lewat hook `useIsMobile(breakpoint = 768)`. Login memakai `useIsMobile(900)`. Dilarang memanggil `matchMedia` langsung di komponen.

### Desktop

- **Sidebar** tetap di kiri, lebar 220px, ciut menjadi 64px. Header berisi logo dan nama. Saat ciut hanya logo dan ikon yang tampil, teks tidak dirender. Footer sidebar berisi tombol Keluar dan Ciutkan. Status ciut disimpan di `localStorage` (`sidebar-expanded`), dibungkus `try/catch`.
- **Topbar** tinggi 56px, lengket di atas: jejak "Nama aplikasi / Judul halaman" di kiri; status, tautan sosial, dan tombol tema di kanan.
- **Konten** dapat discroll sendiri, lebar maksimal 1280px, padding 24x32.
- **Footer** tinggi 44px berisi hak cipta dan kredit.

### Mobile

- Sidebar dan footer tidak ditampilkan.
- Topbar menampilkan logo, judul halaman, status, tombol tema, dan tombol keluar.
- **Bottom nav** tetap di bawah dengan ikon dan label, memperhitungkan `safe-area-inset-bottom`.
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
- Jumlah kolom pada satu baris selalu 12 (8 + 4, 7 + 5, 6 + 6, 5 + 7)
- Di mobile semua kartu menjadi satu kolom
- Kartu statistik memakai `grid-cols-2 lg:grid-cols-4`
- Jarak antarkartu 16px

Setiap kartu memiliki tiga keadaan baku:
1. **Memuat**: `Skeleton` dengan tinggi mendekati isi akhir
2. **Kosong**: `EmptyState`
3. **Terisi**

Kartu berisi daftar memakai `bodyStyle={{ padding: 0 }}` dengan `ListRow`, baris terakhir diberi `last`.

## 9. Komponen UI

Semua komponen memakai named export. Pengecualian hanya `App` (default, dibutuhkan Astro).

| Komponen | Properti utama |
| --- | --- |
| `Button` | `variant`: primary, secondary (bawaan), danger, ghost. `size`: sm (28px), md (34px, bawaan), lg (42px). `loading`, `icon`, turunan atribut `button` |
| `Card` | `title`, `action`, `bodyStyle`, `hover`, `onClick`, `style`. Jika ada judul atau aksi, header 48px dengan garis bawah |
| `Modal` | `open`, `onClose`, `title`, `width` (480). Tutup dengan klik latar atau Escape. Konten panjang discroll |
| `Badge` | `variant`: default, success, danger, warning, accent. `dot` |
| `Toggle` | `checked`, `onChange(val)`, `disabled` |
| `Slider` | `value`, `min`, `max`, `step`, `onChange`, `disabled`, `formatLabel` |
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
| `holiday` (data eksternal yang hampir statis) | 24 jam | tidak ada |

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

`confirmAction` mengirim event ke `ConfirmHost`. Untuk aksi yang sangat berdampak (contoh reset log), pakai tombol dua langkah: klik pertama mengubah label menjadi "Konfirmasi ...", otomatis kembali setelah 3 detik lewat `useEffect` dengan pembersih.

## 11. Caching

Tiga lapis:

1. **Memori**: TanStack Query dengan `gcTime` 24 jam.
2. **Persisten**: cache query disimpan ke `localStorage` (kunci `app-query-cache-v1`, maksimal 24 jam) hanya untuk kunci pertama yang ada di daftar putih `PERSISTED`. Data yang dipulihkan divalidasi bentuknya sebelum `hydrate`. Dipulihkan saat aplikasi dibuka sehingga tampilan langsung terisi lalu menyegarkan diri. Cache dihapus saat logout lewat `clearPersistedCache()`.
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
- Kartu form: logo dan nama, judul, deskripsi, bidang username dan password (`input-group` dengan ikon di sisi, tombol tampil/sembunyi password), tombol Masuk.
- Panel dekoratif: titik-titik latar, logo besar transparan, judul pemasaran, tiga poin keunggulan, teks merek besar transparan di bawah.
- Layout dikunci `position: fixed; inset: 0` dan scroll `html` serta `body` dimatikan lewat `useEffect` dengan pembersih. Jika layar sangat pendek, hanya kolom form yang discroll.
- Input memakai ukuran font 16px agar iOS tidak memperbesar layar saat fokus.
- Pesan galat tampil sebagai kotak merah di atas tombol.
- Teks merek dan poin keunggulan dibaca dari `app.config.ts`, bukan ditulis di komponen.

## 14. Halaman Astro

Setiap berkas `.astro` hanya memuat: `<head>` (charset, favicon `.ico` dan `.svg`, viewport, `theme-color`, manifest, `<title>`), lalu satu komponen React dengan `client:only="react"` dan impor `global.css`. `lang` mengikuti bahasa antarmuka.

Halaman 404 memakai token CSS yang sama, bukan nilai literal.

## 15. Aksesibilitas dan Responsif

- Tombol ikon memiliki `title` atau `aria-label`
- Modal memiliki `role="dialog"`, `aria-modal`, dan `aria-label`
- Label form terhubung ke input lewat `htmlFor`
- Chip dan tombol pilihan memakai `aria-pressed`
- Fokus input terlihat jelas
- Target sentuh minimal sekitar 28px untuk aksi sekunder dan 34px untuk aksi utama
- Tabel lebar dibungkus kontainer `overflow-x: auto` dengan `min-width`
- Teks panjang dipotong dengan elipsis dan `minWidth: 0` pada kontainer fleksibel
- Input file tersembunyi tetap diberi `aria-label`

## 16. Konvensi Kode

- Satu komponen utama per berkas, nama berkas sama dengan nama komponen
- Tanpa komentar dan emoticon
- Tidak mengimpor `React` bawaan. Impor hanya tipe atau hook yang dipakai (`jsx: react-jsx`)
- Tidak menulis nama aplikasi, label menu, atau daftar halaman langsung di komponen
- Konstanta domain di `constants.ts`, tipe di `types.ts`, pemformat di `format.ts`. Tidak diduplikasi
- Gaya yang dipakai lebih dari dua kali dijadikan konstanta atau komponen
- Tidak ada warna atau ukuran layout yang ditulis langsung jika sudah ada token atau konstanta
- Tanpa `any`. Data tak bertipe masuk sebagai `unknown` lalu dipersempit
- Penulisan `localStorage` selalu dibungkus `try/catch`
- Listener, timer, dan debounce selalu dibersihkan pada fungsi pembersih `useEffect`
- Operasi berurutan atas banyak item memakai `for ... of` dengan `await`, bukan `Promise.all`, bila backend menulis ke berkas yang sama
- Format kode: Prettier, lebar 100

## 17. Pemeriksaan

Sebelum commit:

```bash
pnpm check
pnpm format
pnpm build
```

Setelah build, bandingkan ukuran `dist/_astro/*.br` dengan build sebelumnya. Kenaikan di chunk halaman atau chunk bersama perlu dijelaskan.

## 18. Build dan Rilis

`deploy.sh` menjalankan urutan berikut, dengan `HOST` dan `SERVICE` dapat diganti lewat variabel lingkungan:

1. `pnpm build` menghasilkan `dist/` dengan `format: "file"` (satu HTML per halaman)
2. Berkas HTML, JS, CSS, SVG, JSON, dan ICO dibuat versi Brotli (kualitas 11) dan gzip (zopfli bila tersedia). Server menyajikan versi terkecil sesuai `Accept-Encoding`
3. Peta sumber dihapus
4. Backend dibangun statis untuk target server
5. Unggah frontend memakai `rsync -az --delete`
6. Unggah backend ke berkas sementara, cadangkan versi lama, hentikan layanan, ganti, jalankan, lalu cek `/healthz`

Berkas `_astro/` diberi cache `immutable` satu tahun karena namanya berhash.

## 19. Memulai Proyek Baru

1. Salin struktur folder bagian 3, `package.json`, `tsconfig.json`, `.prettierrc`, `astro.config.mjs`, `deploy.sh`, `.env.example`.
2. Ubah `app.config.ts`: nama dan logo. Ubah awalan variabel env (`BEL_` menjadi awalan project).
3. Ubah `manifest.json`: nama, deskripsi, warna. Ganti `icon.svg`, `favicon.ico`, dan ikon PNG. Siapkan ikon maskable terpisah dengan area aman sekitar 80% dari kanvas.
4. Naikkan versi nama cache di `sw.js` ke nama project baru.
5. Ganti konstanta domain di `constants.ts` dan tipe di `types.ts`.
6. Daftarkan halaman: tambah entri (termasuk `icon`) di `routes.ts`, buat berkas `.astro`, tambahkan ke peta halaman di `App.tsx`, dan daftarkan path di backend.
7. Untuk setiap halaman: `PageHeader`, lalu grid 12 kolom berisi `Card`, dengan tiga keadaan baku.
8. Untuk setiap resource: satu hook lewat `createResource`, mutasi lewat `useApiMutation`. Tambahkan kunci yang boleh dipersist di `queryClient.ts`.
9. Isi `.env.example` dan atur identitas footer.
10. Jalankan `pnpm check`, `pnpm build`.

Daftar yang masih ditulis manual di lebih dari satu tempat saat menambah halaman: `routes.ts`, berkas `.astro`, peta halaman di `App.tsx`, dan daftar path di backend.

## 20. Daftar Periksa Sebelum Rilis

- `pnpm check` bersih, `pnpm format` tidak mengubah apa pun
- Tidak ada `any`, `confirm(`, `window.confirm`, atau `catch (e: any)` di `src`
- Tidak ada warna heksadesimal di komponen selain `#fff`
- Tidak ada nama aplikasi yang tertulis langsung di komponen
- Setiap tombol ikon punya `title` dan `aria-label`
- Tiga keadaan baku ada di setiap kartu data
- Kunci query baru sudah didaftarkan di `PERSISTED` bila perlu
- Versi cache `sw.js` naik bila logikanya berubah
- Ukuran aset dibandingkan dengan rilis sebelumnya
- Uji manual: tema terang dan gelap, lebar 360px dan 1280px, mode luring, instal PWA

## 21. Utang Teknis yang Diketahui

Penyimpangan kode acuan dari aturan di atas:

- Ikon maskable memakai gambar yang sama dengan ikon biasa
- `logout()` di `auth.ts` masih memakai `window.confirm`. Ganti dengan `confirmAction`
- `LoginPage` memakai `catch (err: any)` dan `as any` pada `WebkitOverflowScrolling`. Teks merek, judul pemasaran, tiga poin keunggulan, dan watermark masih tertulis di komponen, seharusnya di `app.config.ts`
- `Shell` dan `TopBar` masing-masing mendeklarasikan tipe `__FOOTER_CONFIG__`. Pusatkan di satu berkas `lib/footer.ts`
- `Shell` memanggil `matchMedia` sendiri. Ganti dengan `useIsMobile`
- `TopBar` terikat ke domain (indikator status layanan) dan memuat SVG sosial inline yang panjang. Jadikan slot dan komponen ikon terpisah
- Kepala HTML diulang di tiap berkas `.astro` dengan `theme-color` dan nama aplikasi tertulis langsung. Buat satu `Layout.astro` dengan prop judul
- `404.astro` memakai warna, ukuran, radius, dan nama font literal (`Lexend`, bukan `Lexend Variable`)
- Cincin fokus mode gelap di `global.css` memakai warna literal berbeda dari `--accent-soft`
- `Modal` belum menjebak fokus dan belum mengembalikan fokus ke pemicu saat ditutup
- `Card` memiliki properti `glossy` yang tidak dipakai
- `JadwalPage` terlalu panjang. Pecah menjadi komponen dan hook (pengelompokan, grup hari, kartu bel)
- Chunk `Modal` (framer-motion, sekitar 37 KB terkompresi) dimuat di semua halaman. Ukur dampaknya, lalu evaluasi `LazyMotion`
- Belum ada pengujian otomatis
