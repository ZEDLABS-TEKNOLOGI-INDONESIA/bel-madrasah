# Changelog

Format: satu bagian `## vX.Y.Z` per release. Workflow release mengambil isi bagian yang sesuai dengan tag sebagai catatan rilis, dan gagal bila bagian itu tidak ada.

## v2.0.0

Bel Madrasah ditulis ulang dari skrip Python menjadi aplikasi web: backend Go dan panel admin Astro + React, dikelola sepenuhnya dari browser.

### Fitur

- Panel admin dengan dashboard, jadwal per mode (reguler, Ramadhan, PTS, PAS, pesantren, lainnya), hari libur lokal dan impor libur nasional, log aktivitas, serta pengaturan
- Manajemen audio: upload (dikompres otomatis ke MP3), putar di speaker dan browser, ganti nama, dan hapus. Ganti nama memperbarui jadwal yang memakai file; hapus ikut membersihkan jadwalnya, dan daftar audio menampilkan jumlah pemakaiannya
- Equalizer 5 band dengan preset, diterapkan lewat ffmpeg. Pratinjau di browser memakai filter yang identik dengan speaker
- Volume 0 sampai 200 persen
- Tampilan untuk smartphone: tidak ada elemen yang meluap pada lebar 360px, area sentuh minimal 28px, input tidak memicu zoom di iOS
- PWA yang dapat dipasang, tema terang dan gelap
- Backup dan restore jadwal; backup dapat dipulihkan di instalasi lain
- Halaman landing publik

### Operasional

- Update otomatis: server memeriksa GitHub Release setiap jam, memverifikasi checksum, memasang versi baru, lalu kembali ke versi lama bila health check gagal
- Paket release untuk `linux-amd64`, `linux-arm64`, dan `linux-armv7`
- Sesi login bertahan setelah restart
- Restart tidak lagi membunyikan ulang bel yang sudah berbunyi pada menit yang sama
- Versi aplikasi tampil di Pengaturan dan lewat `bel-madrasah --version`

### Perubahan yang perlu diperhatikan

- Installer pindah ke `scripts/install.sh`. Server yang dipasang sebelum versi ini perlu menjalankan installer sekali lagi agar updater otomatis terpasang; data dan audio dicadangkan oleh installer
- Kode backend pindah ke `server/` (`go build ./server`)
