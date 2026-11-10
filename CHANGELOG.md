# Changelog Firmware

Format: satu bagian `## fw-vX.Y.Z` per release. Workflow `Firmware` mengambil isi bagian yang sesuai dengan tag sebagai catatan rilis, dan menolak tag yang tidak sama dengan `FW_VERSION` di `bel-madrasah.ino`.

## fw-v1.1.0

### Penting sebelum memperbarui

- Skema partisi berubah menjadi **Minimal SPIFFS (1.9MB APP with OTA/128KB SPIFFS)**. Firmware tidak lagi muat di partisi bawaan 1.2MB. Mengganti partisi menghapus isi LittleFS, jadi **unduh backup lebih dulu** (dari firmware ini, atau catat jadwal secara manual bila masih memakai versi lama), lalu pulihkan setelah flashing

### Perbaikan logika

- Satu pembacaan RTC yang terganggu (gangguan I2C) tidak lagi mengunci bel secara permanen. Waktu baru dianggap tidak tepercaya bila anomali berlangsung terus selama sekitar 1,5 detik, dan pemeriksaan "RTC berhenti" butuh tiga kegagalan berturut-turut
- Sinkronisasi NTP atau pengaturan waktu manual tidak lagi bisa langsung dianggap lompatan waktu oleh task bel (race condition saat RTC disetel)
- Bila beberapa bel jatuh pada menit yang sama, hari yang paling spesifik menang. Contoh: bel "Senin 10:00" mengalahkan "Senin-Jumat 10:00"; sebelumnya justru sebaliknya
- Tanpa modul RTC, bel tetap bekerja memakai jam dari NTP
- Perintah putar, stop, dan volume dari web diantrekan ke task bel, sehingga server web tidak lagi tertahan menunggu balasan DFPlayer
- Kartu SD yang dicabut terdeteksi; galat DFPlayer seperti file track yang tidak ada ditampilkan di web
- Status "sedang diputar" tidak lagi bisa macet selamanya
- Edit, hapus, dan sakelar jadwal ditolak bila jadwal sudah berubah di perangkat sejak halaman dimuat, sehingga tidak mengubah bel yang salah
- Penulisan `config.json` dari beberapa task tidak lagi bisa bertabrakan
- Validasi tanggal manual memperhitungkan jumlah hari per bulan dan tahun kabisat

### Fitur

- Backup dan pulihkan jadwal, nama track, dan pengaturan lewat web (pengaturan jaringan tidak ikut dipulihkan)
- Status menampilkan bel terakhir, sumber waktu, dan versi firmware
- Build dapat direproduksi dengan profil `arduino-cli` di `sketch.yaml`; CI menguji logika dan mengompilasi setiap perubahan, dan tag `fw-vX.Y.Z` menerbitkan binary siap flash
- Migrasi ke ArduinoJson 7 dan API ESP Async WebServer terbaru, tanpa peringatan kompilasi
