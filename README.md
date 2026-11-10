# Bel Madrasah (ESP32-C3 Super Mini)

Bel sekolah otomatis berbasis ESP32-C3 yang memutar file MP3 dari modul DFPlayer Mini sesuai jadwal. Seluruh pengaturan dilakukan lewat halaman web yang dilindungi login: jadwal per mode, mode otomatis per tanggal, hari libur, log, audio, waktu, jaringan, backup, dan pembaruan firmware.

## Informasi Perangkat

| Item | Nilai |
|---|---|
| Nama AP | BELL MADRASAH V0.1.0 |
| Password AP | P@ssw0rd |
| IP Address AP | 192.168.4.1 |
| Alamat mDNS | bel-madrasah.local |
| Password admin web bawaan | P@ssw0rd (wajib diganti saat login pertama) |
| Versi firmware | `FW_VERSION` di `bel-madrasah.ino`, footer halaman web, atau perintah `versi` di Serial Monitor |

## Daftar Isi

1. Fitur
2. Kebutuhan Perangkat Keras
3. Wiring
4. Kartu SD DFPlayer
5. Library
6. Build dan Flashing
7. Struktur Berkas
8. Cara Pakai
9. Penjelasan Fitur Penting
10. Pemecahan Masalah
11. Catatan Keamanan

## 1. Fitur

**Penjadwalan**
- Bel otomatis berdasarkan jam dan hari, memutar track MP3 dari DFPlayer (maksimal 300 bel).
- 6 mode jadwal: Reguler, Ramadhan, PTS, PAS, Pesantren, dan Lainnya.
- Mode otomatis berdasarkan rentang tanggal (Ramadhan, PTS, PAS, Pesantren), atau dipilih manual.
- Hari aktif per mode, misalnya Sabtu dan Minggu dinonaktifkan untuk mode Reguler.
- Pengaturan hari per bel: setiap hari, Senin-Sabtu, Senin-Jumat, Senin-Kamis, atau per hari. Bila beberapa bel jatuh pada menit yang sama, hari yang paling spesifik menang.
- Daftar tanggal libur dan impor libur nasional (termasuk cuti bersama) langsung dari perangkat.
- Libur manual untuk libur mendadak, dan mode tidur pada rentang jam tertentu.

**Audio**
- Volume 0-30, preset equalizer DFPlayer (Normal, Pop, Rock, Jazz, Classic, Bass), hentikan bel, dan putar track untuk uji.
- Nama track agar mudah dipilih di jadwal (maksimal 60 track).
- Kartu SD dicabut dan galat DFPlayer (misalnya file track tidak ada) terdeteksi dan tampil di web.

**Pemantauan**
- Dashboard: waktu, mode aktif beserta sumbernya, status hari, bel terakhir, dan jadwal hari ini dengan bel berikutnya.
- Log aktivitas: bel yang berbunyi dan bel yang gagal berbunyi beserta alasannya (150 entri terakhir).

**Waktu**
- Sinkronisasi NTP (UTC+7) ke RTC setiap 1 jam bila ada internet. Tanpa modul RTC, bel memakai jam NTP.
- Pengamanan waktu: bel dikunci bila waktu belum tepercaya.
- Restart di menit yang sama dengan bel yang sudah berbunyi tidak membunyikannya dua kali.

**Keamanan dan pemeliharaan**
- Login admin dengan password tersimpan ter-hash, sesi ber-cookie, dan pembatasan percobaan login.
- Pembaruan firmware lewat web: unggah file, atau unduh otomatis dari GitHub Releases dengan verifikasi TLS dan SHA-256. Firmware baru yang gagal berjalan dikembalikan otomatis ke versi sebelumnya.
- Backup dan pulihkan jadwal, nama track, mode, hari libur, dan pengaturan.

**Antarmuka**
- Halaman web responsif dengan tema terang dan gelap, sidebar di desktop dan navigasi bawah di ponsel. Berjalan tanpa internet (mode AP).
- OLED bergantian setiap 10 detik: Waktu, IP Address, dan Nama WiFi.

## 2. Kebutuhan Perangkat Keras

- ESP32-C3 Super Mini (flash 4 MB)
- Modul DFPlayer Mini
- OLED 0.91 inci (SSD1306, 128x32, I2C, alamat 0x3C)
- RTC DS1307 (disarankan dengan baterai CR2032 terpasang)
- Amplifier eksternal
- Kartu microSD (FAT32) berisi file MP3

## 3. Wiring

### DFPlayer Mini (UART)

| DFPlayer | ESP32-C3 | Keterangan |
|---|---|---|
| VCC | 3.3V | Jika tidak stabil atau reset saat suara keras, pindah ke 5V |
| GND | GND | |
| TX | GPIO 20 | RX pada ESP |
| RX | GPIO 21 | TX pada ESP, disarankan lewat resistor 1 kOhm |
| SPK1 / SPK2 atau DAC_R / DAC_L | Input amplifier eksternal | Keluaran audio |

### RTC DS1307 (I2C)

| DS1307 | ESP32-C3 | Keterangan |
|---|---|---|
| VCC | 5V | Modul DS1307 membutuhkan 5V |
| GND | GND | |
| SDA | GPIO 8 | |
| SCL | GPIO 9 | |

### OLED 0.91 inci SSD1306 (I2C)

| OLED | ESP32-C3 | Keterangan |
|---|---|---|
| VCC | 3.3V | |
| GND | GND | |
| SDA | GPIO 8 | Satu bus I2C dengan RTC |
| SCL | GPIO 9 | Satu bus I2C dengan RTC |

### Catatan wiring

- Semua modul harus berbagi GND yang sama.
- Alamat I2C: OLED 0x3C, RTC 0x68. Keduanya tidak bentrok.
- Pull-up I2C pada modul DS1307 yang tersambung ke 5V dapat menaikkan level SDA/SCL. Jika ragu, lepas pull-up pada modul atau gunakan level shifter, karena GPIO ESP32-C3 hanya toleran 3.3V.
- GPIO 8 dan 9 adalah pin strapping ESP32-C3. Pastikan tidak ada beban yang menarik GPIO 9 ke LOW saat boot.
- Pasang baterai CR2032 pada modul RTC. Tanpa baterai, waktu hilang setiap listrik padam dan bel akan terkunci sampai waktu diperbaiki.

## 4. Kartu SD DFPlayer

- Format FAT32.
- Buat folder `mp3` di root kartu SD, isi dengan file bernama 4 digit: `0001.mp3`, `0002.mp3`, dan seterusnya.
- Nomor file sama dengan nomor track yang dipilih pada jadwal di web.

Track bawaan:

| No | Nama | No | Nama |
|---|---|---|---|
| 1 | sholawat | 13 | pelajaran-6 |
| 2 | mars-madrasah | 14 | pelajaran-7 |
| 3 | upacara | 15 | pelajaran-8 |
| 4 | istirahat-1 | 16 | pelajaran-9 |
| 5 | istirahat-2 | 17 | pelajaran-10 |
| 6 | kebersihan | 18 | pelajaran-selesai |
| 7 | literasi | 19 | indonesia-raya |
| 8 | pelajaran-1 | 20 | tanah-airku |
| 9 | pelajaran-2 | 21 | hymne-madrasah |
| 10 | pelajaran-3 | 22 | rohani |
| 11 | pelajaran-4 | 23 | akhir-pekan |
| 12 | pelajaran-5 | 24 | pramuka |

Nama track di web hanya label. ESP32 tidak dapat membaca atau menulis kartu SD DFPlayer, jadi file audio dikelola dengan menyalinnya ke kartu SD dari komputer. Untuk menambah track baru, salin file MP3 dengan nomor berikutnya, lalu beri nama pada nomor tersebut di Jadwal, bagian Daftar track.

## 5. Library

Versi yang dipakai dan diuji dikunci di `sketch.yaml`:

| Library | Pembuat | Versi |
|---|---|---|
| WiFiManager | tzapu | 2.0.17 |
| ESP Async WebServer | ESP32Async | 3.12.1 |
| Async TCP | ESP32Async | 3.5.0 |
| ArduinoJson | Benoit Blanchon | 7.4.3 |
| RTClib | Adafruit | 2.1.4 |
| Adafruit GFX Library | Adafruit | 1.13.0 |
| Adafruit SSD1306 | Adafruit | 2.5.17 |
| Adafruit BusIO | Adafruit | 1.17.4 |
| DFRobotDFPlayerMini | DFRobot | 1.0.6 |

Core: esp32 by Espressif 3.3.12. Library bawaan core (tidak perlu dipasang): `WiFi`, `ESPmDNS`, `Wire`, `LittleFS`, `HardwareSerial`, `NetworkClientSecure`, `HTTPClient`, `Update`.

Catatan:
- Gunakan ESP Async WebServer dan Async TCP dari ESP32Async. Versi lama dari me-no-dev tidak kompatibel dengan core ESP32 terbaru.
- Jangan pasang dua versi AsyncTCP sekaligus.
- Kode memakai API ArduinoJson 7. ArduinoJson 6 tidak didukung.

## 6. Build dan Flashing

### Pilihan A: binary siap pakai (tanpa Arduino IDE)

Unduh `bel-madrasah-fw-<versi>-esp32c3-full.bin` dari halaman Releases (tag `fw-v...`), lalu flash ke offset `0x0`:

```bash
esptool.py --chip esp32c3 --port /dev/ttyACM0 write_flash 0x0 bel-madrasah-fw-2.0.0-esp32c3-full.bin
```

Atau lewat browser di https://espressif.github.io/esptool-js/ dengan alamat `0x0`. Cocokkan SHA-256 file dengan `checksums.txt` di release yang sama.

Setelah firmware 2.0.0 terpasang, pembaruan berikutnya tidak memerlukan kabel USB (lihat bagian 9, Pembaruan firmware).

### Pilihan B: arduino-cli

Folder repositori harus bernama `bel-madrasah` (sama dengan nama `bel-madrasah.ino`).

```bash
arduino-cli compile --profile bel-madrasah bel-madrasah
arduino-cli upload  --profile bel-madrasah -p /dev/ttyACM0 bel-madrasah
```

Profil di `sketch.yaml` memasang core dan library dengan versi yang tepat secara otomatis.

### Pilihan C: Arduino IDE

| Pengaturan | Nilai |
|---|---|
| Board | ESP32C3 Dev Module (paket esp32 by Espressif 3.3.12) |
| USB CDC On Boot | Enabled (agar Serial Monitor tampil) |
| Partition Scheme | **Minimal SPIFFS (1.9MB APP with OTA/128KB SPIFFS)** |
| Baud Serial Monitor | 115200 |

Firmware berukuran sekitar 1,7 MB dan tidak muat di partisi bawaan (1,2 MB). Partisi ini juga menyediakan dua slot aplikasi yang dibutuhkan pembaruan firmware lewat web.

### Memperbarui perangkat dengan firmware lama (sebelum 2.0.0)

Firmware lama memakai partisi bawaan. Mengganti skema partisi menghapus isi LittleFS (jadwal, nama track, pengaturan), dan firmware lama belum punya tombol backup. Sebelum flashing, catat jadwal secara manual. Setelah flashing, atur WiFi lagi, masuk dengan password bawaan, ganti password, lalu masukkan jadwal kembali.

## 7. Struktur Berkas

Sketch dipecah per bagian. Arduino menggabungkan semua tab `.ino` saat kompilasi; variabel global ada di berkas utama dan semua tipe di `types.h`.

| Berkas | Isi |
|---|---|
| `bel-madrasah.ino` | Include, konstanta, variabel global, `setup()`, `loop()` |
| `schedule.ino` | Mode, jadwal, nama track, pemilihan bel, task bel |
| `clock.ino` | RTC, jam NTP, penjaga waktu, NVRAM |
| `audio.ino` | DFPlayer, antrean perintah audio, equalizer |
| `holidays.ino` | Tanggal libur dan impor libur nasional |
| `activity.ino` | Log aktivitas |
| `auth.ino` | Password admin, sesi login, pembatasan percobaan, perintah Serial |
| `ota.ino` | Pembaruan firmware dari web dan GitHub, verifikasi dan rollback |
| `rollback.cpp` | Menunda penandaan firmware sehat sampai perangkat terbukti berjalan normal |
| `web.ino` | Seluruh endpoint HTTP |
| `network.ino` | WiFi, AP cadangan, IP statis |
| `display.ino` | Layar OLED |
| `storage.ino` | Penulisan berkas atomik dan konfigurasi |
| `bell_logic.h` | Logika murni tanpa ketergantungan Arduino: hari, jam, tanggal, mode, pemilihan bel, penjaga waktu, versi, pengurai kalender |
| `types.h` | Definisi tipe data bersama |
| `index_html.h` | Halaman web (HTML, CSS, JavaScript) |
| `sketch.yaml` | Profil build `arduino-cli`: board, partisi, versi core dan library |
| `tests/logic_test.cpp` | Uji `bell_logic.h` yang berjalan di komputer biasa |
| `.github/workflows/firmware.yml` | CI: uji logika, kompilasi, dan rilis binary pada tag `fw-vX.Y.Z` |
| `CHANGELOG.md` | Catatan per versi firmware |

Berkas di LittleFS pada perangkat:

| Berkas | Isi |
|---|---|
| `/config.json` | Volume, equalizer, libur manual, mode dan rentang tanggal, hari aktif per mode, mode tidur, IP statis, pembaruan otomatis |
| `/schedule.json` | Seluruh jadwal bel |
| `/tracks.json` | Nama track |
| `/holidays.json` | Tanggal libur |
| `/log.jsonl` | Log aktivitas |
| `/auth.json` | Hash password admin (tidak ikut backup) |

### Pengujian

```bash
g++ -std=c++17 -Wall -Wextra -Werror -o logic_test tests/logic_test.cpp && ./logic_test
```

### Merilis firmware

1. Naikkan `FW_VERSION` di `bel-madrasah.ino`.
2. Tambahkan bagian `## fw-vX.Y.Z` di `CHANGELOG.md`.
3. Commit ke `baremetal`, lalu buat dan push tag `fw-vX.Y.Z`.

Workflow memverifikasi tag sama dengan `FW_VERSION`, lalu menerbitkan release berisi binary penuh, binary aplikasi, dan `checksums.txt`. Perangkat dengan pembaruan otomatis aktif memasang release ini sendiri. Release firmware tidak ditandai "Latest" agar tidak tertukar dengan release aplikasi server di branch `main`.

## 8. Cara Pakai

1. Flash firmware lalu nyalakan perangkat.
2. Sambungkan HP atau laptop ke WiFi BELL MADRASAH V0.1.0 (password P@ssw0rd), lalu atur WiFi sekolah lewat portal yang muncul. Setelah tersimpan, perangkat restart dan terhubung ke WiFi tersebut.
3. Buka alamat yang tampil di layar OLED, atau `http://bel-madrasah.local`.
4. Masuk dengan password bawaan `P@ssw0rd`, lalu ganti password saat diminta.
5. Periksa Dashboard. Jika ada peringatan waktu belum tepercaya, tunggu sinkronisasi NTP atau atur waktu di Pengaturan.
6. Di halaman Jadwal: atur mode (manual atau rentang tanggal), hari aktif per mode, nama track, lalu bel.
7. Di halaman Libur: tambahkan tanggal libur atau impor libur nasional.
8. Uji tiap track dengan tombol Putar.

### Halaman web

| Halaman | Isi |
|---|---|
| Dashboard | Peringatan, waktu, mode aktif, status hari, bel terakhir, jadwal hari ini, aksi cepat, info perangkat |
| Jadwal | Mode jadwal dan rentang tanggal, hari aktif per mode, daftar bel, tambah dan ubah bel, daftar track |
| Libur | Libur manual, tanggal libur, impor libur nasional |
| Log | Riwayat bel berbunyi dan gagal |
| Pengaturan | Audio dan equalizer, mode tidur, waktu, akun, firmware, backup, jaringan |

## 9. Penjelasan Fitur Penting

### Login

- Semua pengaturan memerlukan login. Password disimpan sebagai hash PBKDF2-HMAC-SHA256 dengan salt acak.
- Sesi berlaku 7 hari, atau berakhir setelah 12 jam tidak aktif. Restart perangkat mengakhiri semua sesi.
- Lima kali salah password dari alamat yang sama mengunci login selama 15 menit.
- Mengganti password mengakhiri sesi di perangkat lain.
- Lupa password: sambungkan perangkat ke komputer lewat USB, buka Serial Monitor 115200, ketik `reset-password`. Password kembali ke `P@ssw0rd` dan wajib diganti saat login berikutnya. Cara ini memerlukan akses fisik sehingga tidak bisa dilakukan dari jaringan.

### Mode jadwal

- Mode manual: mode yang dipilih selalu dipakai.
- Mode otomatis: perangkat memilih mode dari rentang tanggal. Bila rentang tumpang tindih, prioritasnya PTS, PAS, Pesantren, lalu Ramadhan. Di luar semua rentang dipakai Reguler.
- Hari aktif per mode menonaktifkan hari tertentu, misalnya Sabtu untuk mode PTS, tanpa menghapus belnya.
- Mode Pesantren dan Lainnya tidak punya jadwal bawaan. Selama kosong, bel tidak berbunyi pada mode tersebut.

### Hari libur

Bel tidak berbunyi bila salah satu kondisi ini berlaku: tanggal hari ini ada di daftar libur, libur manual aktif, hari ini dinonaktifkan untuk mode aktif, atau mode tidur sedang berlangsung.

Impor libur nasional diambil perangkat dari kalender hari libur Indonesia milik Google lewat HTTPS dengan verifikasi sertifikat. Perayaan yang bukan hari libur (misalnya 1 Ramadan) tidak ikut, dan cuti bersama ditandai sehingga bisa disertakan atau tidak.

### Log aktivitas

Setiap bel terjadwal dicatat sebagai Berbunyi atau Gagal. Gagal berarti DFPlayer atau kartu SD tidak siap saat bel jatuh, atau DFPlayer melaporkan galat dalam 15 detik setelah bel dipicu (misalnya file tidak ada). Log menyimpan 150 entri terakhir.

### Pembaruan firmware

- **Dari file**: unggah `bel-madrasah-fw-<versi>-esp32c3-app.bin` di Pengaturan, bagian Firmware.
- **Dari GitHub**: tombol Periksa pembaruan mencari release `fw-v*` terbaru. Unduhan memakai HTTPS dengan verifikasi sertifikat, dan SHA-256 file dicocokkan dengan `checksums.txt` sebelum dipasang.
- **Otomatis** (bawaan aktif): perangkat memeriksa setiap 6 jam dan memasang versi baru hanya bila waktu tepercaya, tidak ada bel yang berbunyi, dan tidak ada bel dalam 5 menit ke depan. Bila belum aman, dicoba lagi 30 menit kemudian.
- **Rollback**: firmware baru dinyatakan sehat setelah berjalan normal sekitar 60 detik. Bila firmware baru macet atau restart sebelum itu, bootloader kembali ke versi sebelumnya dan Dashboard menampilkan peringatan.

### Pengamanan waktu

Bel hanya berbunyi bila waktu dinilai tepercaya. Hal ini mencegah bel berbunyi di jam yang salah akibat RTC bermasalah.

Waktu dianggap tidak tepercaya bila:
- RTC berhenti berjalan (tiga pemeriksaan berturut-turut, sekitar 15 detik).
- Tahun di luar rentang 2025 sampai 2099, atau terjadi lompatan waktu (mundur, atau maju lebih dari 120 detik), dan kondisi itu berlangsung terus selama sekitar 1,5 detik. Satu pembacaan aneh akibat gangguan I2C hanya dilewati.
- RTC pernah kehilangan daya dan belum disinkronkan ulang.
- Modul RTC tidak terpasang dan NTP belum berhasil.

Waktu menjadi tepercaya kembali setelah sinkronisasi NTP berhasil atau waktu diatur manual lewat web. Penanda "waktu pernah diverifikasi" dan menit bel terakhir disimpan di NVRAM DS1307, sehingga restart biasa tidak menghapus penanda dan tidak membunyikan ulang bel di menit yang sama.

### Mode tidur

Pada rentang jam yang diatur, bel terjadwal tidak berbunyi, bel yang sedang diputar dihentikan, dan OLED dapat dimatikan. Rentang boleh melewati tengah malam; jam mulai termasuk rentang, jam selesai tidak.

### Jaringan dan IP statis

- Bila WiFi tersimpan gagal tersambung lebih dari 20 detik, perangkat mengaktifkan AP cadangan (192.168.4.1) sambil terus mencoba tersambung kembali.
- IP statis harus berada dalam rentang jaringan yang sama dan di luar rentang DHCP router. IP statis otomatis dinonaktifkan bila perangkat terhubung ke SSID lain.
- Reset WiFi menghapus kredensial tersimpan dan membuka portal di 192.168.4.1 setelah restart.

### Penyimpanan

Semua berkas ditulis lewat berkas sementara lalu diganti (atomik). Konfigurasi dari firmware lama (mode tunggal tanpa rentang tanggal) tetap terbaca: mode selain Reguler dianggap pilihan manual. Backup dari firmware 1.1.0 juga dapat dipulihkan.

## 10. Pemecahan Masalah

| Gejala | Kemungkinan penyebab | Solusi |
|---|---|---|
| Bel tidak berbunyi sama sekali | DFPlayer atau kartu SD tidak terdeteksi | Periksa kabel TX/RX dan kartu SD; lihat peringatan di Dashboard dan Log |
| Bel tidak berbunyi, ada peringatan waktu | Waktu belum tepercaya | Sambungkan internet atau atur waktu manual |
| Bel tidak berbunyi di hari tertentu | Libur, libur manual, hari dinonaktifkan untuk mode aktif, atau mode tidur | Lihat Status hari di Dashboard |
| Mode aktif tidak sesuai | Mode manual masih aktif, atau rentang tanggal tumpang tindih | Periksa kartu Mode jadwal |
| Log menampilkan "File track N tidak ada di kartu SD" | Nomor file tidak ada di kartu SD | Pastikan `mp3/0001.mp3` dan seterusnya sesuai nomor track |
| Pesan "Jadwal sudah berubah di perangkat" | Jadwal diubah dari perangkat lain sejak halaman dibuka | Muat ulang halaman, lalu ulangi perubahan |
| Login terkunci 15 menit | Lima kali salah password | Tunggu, atau gunakan `reset-password` lewat Serial |
| Impor libur nasional gagal | Perangkat tidak terhubung internet atau DNS bermasalah | Periksa koneksi WiFi, coba lagi |
| Dashboard: firmware dikembalikan ke versi sebelumnya | Firmware baru gagal berjalan | Laporkan versi tersebut; perangkat tetap berjalan dengan versi lama |
| Upload firmware gagal, "Sketch too big" | Partisi masih bawaan | Pilih partisi Minimal SPIFFS (lihat bagian 6) |
| Halaman web tidak terbuka setelah ganti IP | IP berubah | Lihat IP di layar OLED atau gunakan `bel-madrasah.local` |
| OLED kosong | Mode tidur dengan opsi matikan OLED aktif, atau modul tidak terdeteksi | Periksa pengaturan Mode tidur dan alamat I2C 0x3C |

Log Serial (115200 baud) memuat jam saat bel dipicu, alasan bel dikunci, dan proses pembaruan firmware. Perintah Serial yang tersedia: `versi` dan `reset-password`.

## 11. Catatan Keamanan

- Ganti password admin saat login pertama (diwajibkan oleh halaman web).
- Ganti password AP bawaan (`P@ssw0rd`) pada `AP_PASS` di `bel-madrasah.ino` sebelum dipakai di lingkungan nyata.
- Halaman web memakai HTTP, bukan HTTPS. Password dan cookie dapat terbaca oleh pihak lain di jaringan yang sama, jadi gunakan WiFi sekolah yang terpercaya, bukan WiFi publik.
- Pembaruan firmware dari GitHub memverifikasi sertifikat TLS dan SHA-256. Firmware dari file tidak diverifikasi tanda tangannya; hanya unggah file dari release resmi.
- File backup berisi jadwal dan pengaturan, tanpa password admin dan password WiFi.
- Mode tidur dan pengamanan waktu mengurangi risiko bel berbunyi di jam tidak wajar, tetapi perbaikan paling mendasar tetap pada perangkat keras: baterai RTC yang sehat dan catu daya yang stabil.
