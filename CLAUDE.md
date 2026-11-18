# bel-madrasah

**Status**: Aktif (Production)
**Kategori**: Core Product

## Deskripsi
Sistem bel sekolah/madrasah otomatis berbasis web. Memainkan audio terjadwal melalui ALSA langsung dari server mini di sekolah, dengan panel admin untuk kelola jadwal, nada, hari libur, dan mode (reguler, ramadan, PTS, PAS).

## Tech Stack
- Backend: Go — `net/http`, auth session, penyimpanan JSON flat-file
- Frontend: Astro 7 + React 19 (hybrid MPA/SPA)
- CSS: Tailwind CSS v4
- State: TanStack React Query 5
- Build: Vite
- Audio: ffmpeg + ALSA
- PWA: Service worker + manifest

## Posisi dalam Ekosistem
Produk standalone — dijual sebagai bagian "Server Mini ZEDLABS". Setiap sekolah deploy instance terpisah (raspi/PC mini). Tidak terintegrasi dengan super-app untuk sementara, namun ke depan bisa menerima jadwal dari super-app via API.

## Catatan
- File konsep.md lama sudah digantikan oleh CLAUDE.md ini
- Penyeragaman: design system perlu distandarkan ke GitHub Primer, font ganti ke Lexend
- Repo: github.com/ZEDLABS-TEKNOLOGI-INDONESIA/bel-madrasah
- Versi baremetal (bel-madrasah-baremetal): clone dari repo yang sama, deploy manual tanpa Docker
