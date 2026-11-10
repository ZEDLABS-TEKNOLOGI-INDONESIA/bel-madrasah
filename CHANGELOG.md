# Changelog

Format: satu bagian `## vX.Y.Z` per release. Workflow release mengambil isi bagian yang sesuai dengan tag sebagai catatan rilis, dan gagal bila bagian itu tidak ada.

## v2.1.2

### Perbaikan

- `bel-madrasah-update`: variabel yang di-set saat perintah dijalankan kini menang atas `/etc/default/bel-madrasah-update`, dan file tersebut dibaca sebagai pasangan `KEY=VALUE`, tidak dieksekusi

## v2.1.1

### Perbaikan

- Libur nasional kembali terisi. Sumber lama (`api.kemendesa.link`) dihentikan penyedianya (`503 DEPLOYMENT_PAUSED`); sumber utama kini kalender hari libur Indonesia milik Google, lengkap dengan hari besar Islam dan cuti bersama, dengan sumber lama sebagai cadangan
- Data libur disimpan 12 jam di server dan tetap ditampilkan, dengan peringatan, saat semua sumber tidak dapat dihubungi
- Panel libur nasional menampilkan pesan galat dan tombol "Coba lagi", tidak lagi "Tidak ada data" yang menyesatkan, serta menyebut sumber data yang sebenarnya
- Permintaan libur nasional tidak diulang otomatis oleh browser, sehingga galat tampil seketika

## v2.1.0

### Fitur

- Pilihan perangkat audio di Pengaturan: dropdown berisi semua output yang terdeteksi (jack analog, USB sound card, HDMI) dan tombol "Tes speaker" yang memutar bunyi pendek lalu melaporkan galat bila speaker tidak dapat dibuka. Perangkat dapat diganti tanpa SSH
- Deteksi otomatis memilih USB sound card, lalu jack analog, dan HDMI paling akhir. Perangkat dirujuk berdasarkan nama (`plughw:CARD=Headphones,DEV=0`), sehingga tetap benar walau nomor card berubah saat boot atau USB dicolok ulang

### Perbaikan

- Output memakai `plughw` sehingga file mono atau sample rate yang tidak didukung kartu suara tetap berbunyi; sebelumnya `hw:` menolaknya
- Nomor device diambil dari sistem, tidak lagi diasumsikan 0 (HDMI sering berada di device 3 atau lebih)
- Nilai lama `BEL_ALSA_DEVICE=hw:N,0` di service otomatis dibaca sebagai `plughw:N,0`; pilihan di Pengaturan menimpanya
- Volume 0% kini tersimpan; sebelumnya dikembalikan ke 85%
- Installer tidak lagi menulis perangkat audio ke service dan tidak lagi menawarkan opsi Bluetooth/PipeWire yang tidak pernah dipakai backend

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
