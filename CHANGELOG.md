# Changelog Firmware

Format: satu bagian `## fw-vX.Y.Z` per release. Workflow `Firmware` mengambil isi bagian yang sesuai dengan tag sebagai catatan rilis, dan menolak tag yang tidak sama dengan `FW_VERSION` di `bel-madrasah.ino`.

## fw-v2.0.0

Rilis pertama yang diterbitkan dari branch `baremetal`. Mencakup semua perbaikan yang sebelumnya disiapkan untuk 1.1.0.

### Penting sebelum memperbarui

- Skema partisi berubah menjadi **Minimal SPIFFS (1.9MB APP with OTA/128KB SPIFFS)**. Firmware tidak muat di partisi bawaan. Mengganti partisi menghapus isi LittleFS, jadi catat jadwal sebelum flashing. Setelah versi ini, pembaruan berikutnya bisa lewat web tanpa kabel USB
- Halaman web kini memerlukan login. Password bawaan `P@ssw0rd` wajib diganti saat login pertama

### Fitur

- Login admin: password ter-hash PBKDF2, sesi ber-cookie, pembatasan percobaan login, reset lewat Serial (`reset-password`)
- Halaman web baru: Dashboard, Jadwal, Libur, Log, dan Pengaturan, dengan tema terang dan gelap serta tampilan ponsel
- 6 mode jadwal (tambah Pesantren dan Lainnya), mode otomatis berdasarkan rentang tanggal, dan hari aktif per mode
- Daftar tanggal libur dan impor libur nasional dari kalender Google lewat HTTPS
- Log aktivitas bel berbunyi dan gagal berbunyi beserta alasannya
- Preset equalizer DFPlayer
- Pembaruan firmware dari file atau dari GitHub Releases (verifikasi TLS dan SHA-256), otomatis setiap 6 jam saat aman, dengan rollback bila firmware baru gagal berjalan
- Backup dan pulihkan jadwal, nama track, mode, hari libur, dan pengaturan
- Jadwal hari ini dengan bel berikutnya, bel terakhir, sumber waktu, dan versi firmware di Dashboard

### Perbaikan logika

- Satu pembacaan RTC yang terganggu (gangguan I2C) tidak lagi mengunci bel secara permanen
- Sinkronisasi NTP atau pengaturan waktu manual tidak lagi dianggap lompatan waktu oleh task bel
- Bila beberapa bel jatuh pada menit yang sama, hari yang paling spesifik menang
- Restart di menit yang sama dengan bel yang sudah berbunyi tidak membunyikannya dua kali
- Tanpa modul RTC, bel tetap bekerja memakai jam NTP
- Perintah audio dari web diantrekan ke task bel sehingga server web tidak tertahan
- Kartu SD yang dicabut terdeteksi; galat DFPlayer tampil di web dan tercatat di log
- Edit, hapus, dan sakelar jadwal ditolak bila jadwal sudah berubah di perangkat sejak halaman dimuat
- Penulisan konfigurasi dari beberapa task tidak lagi bisa bertabrakan
- Validasi tanggal memperhitungkan jumlah hari per bulan dan tahun kabisat

### Perkakas

- Kode dipecah per bagian (`schedule`, `clock`, `audio`, `auth`, `ota`, `web`, dan lainnya), logika murni di `bell_logic.h` dengan uji yang berjalan di komputer biasa
- Build dapat direproduksi dengan profil `arduino-cli` di `sketch.yaml`; CI menguji dan mengompilasi setiap perubahan, dan tag `fw-vX.Y.Z` menerbitkan binary siap flash
- Migrasi ke ArduinoJson 7 dan API ESP Async WebServer terbaru, tanpa peringatan kompilasi
