# Bel Madrasah (ESP32-C3 Super Mini)

Bel sekolah otomatis berbasis ESP32-C3 yang memutar file MP3 dari modul DFPlayer Mini sesuai jadwal. Seluruh pengaturan (jadwal, nada bel, volume, mode, waktu, jaringan, mode tidur) dilakukan lewat halaman web.

## Informasi Perangkat

| Item | Nilai |
|---|---|
| Nama AP | BELL MADRASAH V0.1.0 |
| Password AP | P@ssw0rd |
| IP Address AP | 192.168.4.1 |
| Alamat mDNS | bel-madrasah.local |
| Versi firmware | lihat `FW_VERSION` di `bel-madrasah.ino`, footer halaman web, atau `/api/status` |

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
- Bel otomatis berdasarkan jam dan hari, memutar track MP3 dari DFPlayer.
- 4 mode jadwal: Reguler, Ramadhan, PTS, dan PAS. Mode aktif diganti dari web.
- Pengaturan hari fleksibel: setiap hari, Senin-Sabtu, Senin-Jumat, Senin-Kamis, atau per hari.
- Aktif atau nonaktif per bel, serta tambah, ubah, dan hapus jadwal (maksimal 300 bel).
- Bila beberapa bel jatuh pada menit yang sama, hari yang paling spesifik menang (misalnya "Senin" mengalahkan "Senin-Jumat").
- Mode Libur: menonaktifkan seluruh jadwal dengan satu tombol.
- Mode Tidur: bel dibungkam pada rentang jam tertentu (boleh melewati tengah malam) dan layar OLED dapat dimatikan.

**Audio**
- Kontrol volume (0-30), tombol Stop Bel, dan tombol Putar untuk menguji tiap track.
- Daftar track: beri nama pada nomor track agar mudah dipilih di jadwal (maksimal 60 track).
- Auto-retry DFPlayer setiap 5 detik jika modul atau kartu SD belum terdeteksi.
- Kartu SD yang dicabut terdeteksi, dan galat DFPlayer (misalnya file track tidak ada) tampil di web.

**Waktu**
- Sinkronisasi NTP (UTC+7) ke RTC setiap 1 jam bila ada internet.
- Tanpa internet, waktu tetap berjalan dari RTC DS1307. Tanpa modul RTC, bel memakai jam dari NTP selama perangkat terhubung internet.
- Pengamanan waktu: bel dikunci bila waktu belum tepercaya (lihat bagian Penjelasan Fitur Penting).
- Atur waktu manual dari web, termasuk tombol pengisian otomatis dari jam perangkat yang membuka halaman.

**Jaringan**
- WiFi Manager: konfigurasi WiFi lewat portal AP, sambung ulang otomatis, dan fallback ke mode AP bila WiFi tidak tersedia.
- IP statis opsional dan reset WiFi dari web.

**Antarmuka**
- Web dashboard: status waktu, jaringan, IP, track yang diputar, kondisi DFPlayer, mode libur, dan mode tidur.
- Peringatan di web bila DFPlayer atau kartu SD tidak terdeteksi, atau waktu belum tepercaya.
- Tampilan OLED bergantian setiap 10 detik: Waktu, IP Address, dan Nama WiFi (rata tengah).

**Penyimpanan**
- Penyimpanan permanen (LittleFS): konfigurasi, jadwal, dan nama track tidak hilang saat mati listrik.
- Backup dan pulihkan jadwal, nama track, dan pengaturan dari halaman web.

## 2. Kebutuhan Perangkat Keras

- ESP32-C3 Super Mini
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

Nama track di web hanya label. Untuk menambah track baru, salin file MP3 ke kartu SD dengan nomor berikutnya, lalu beri nama pada nomor tersebut di kartu "Daftar Track".

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

Core: esp32 by Espressif 3.3.12. Library bawaan core (tidak perlu dipasang): `WiFi`, `ESPmDNS`, `Wire`, `LittleFS`, `HardwareSerial`.

Catatan:
- Gunakan ESP Async WebServer dan Async TCP dari ESP32Async. Versi lama dari me-no-dev tidak kompatibel dengan core ESP32 terbaru.
- Jangan pasang dua versi AsyncTCP sekaligus.
- Kode memakai API ArduinoJson 7. ArduinoJson 6 tidak didukung.

## 6. Build dan Flashing

### Pilihan A: binary siap pakai (tanpa Arduino IDE)

Unduh `bel-madrasah-fw-<versi>-esp32c3-full.bin` dari halaman Releases (tag `fw-v...`), lalu flash ke offset `0x0`:

```bash
esptool.py --chip esp32c3 --port /dev/ttyACM0 write_flash 0x0 bel-madrasah-fw-1.1.0-esp32c3-full.bin
```

Atau lewat browser di https://espressif.github.io/esptool-js/ dengan alamat `0x0`. Cocokkan SHA-256 file dengan `checksums.txt` di release yang sama.

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

Firmware berukuran sekitar 1,4 MB dan tidak muat di partisi bawaan (1,2 MB).

### Memperbarui perangkat yang sudah terpasang

Mengganti skema partisi menghapus isi LittleFS (jadwal, nama track, pengaturan). Sebelum flashing:

1. Buka halaman web perangkat, kartu **Backup**, tekan **Unduh Backup**. Firmware sebelum 1.1.0 belum punya tombol ini; catat jadwal secara manual.
2. Flash firmware baru.
3. Atur WiFi lagi bila diminta, lalu di kartu **Backup** tekan **Pulihkan dari File**.

Pengaturan jaringan (IP statis) tidak ikut dipulihkan agar perangkat tidak terkunci dari jaringan baru.

## 7. Struktur Berkas

| Berkas | Fungsi |
|---|---|
| `bel-madrasah.ino` | Program utama: bel, RTC, WiFi, web server, OLED, DFPlayer |
| `bell_logic.h` | Logika murni tanpa ketergantungan Arduino: hari, jam, mode tidur, pemilihan bel, penjaga waktu |
| `index_html.h` | Halaman web (HTML, CSS, JavaScript) dalam bentuk string PROGMEM |
| `types.h` | Definisi tipe data bersama |
| `sketch.yaml` | Profil build `arduino-cli`: board, partisi, versi core dan library |
| `tests/logic_test.cpp` | Uji `bell_logic.h` yang berjalan di komputer biasa |
| `.github/workflows/firmware.yml` | CI: uji logika, kompilasi, dan rilis binary pada tag `fw-vX.Y.Z` |
| `CHANGELOG.md` | Catatan per versi firmware |

Berkas yang dibuat otomatis di LittleFS pada perangkat:

| Berkas | Isi |
|---|---|
| `/config.json` | Volume, mode libur, mode jadwal aktif, IP statis, mode tidur |
| `/schedule.json` | Seluruh jadwal bel |
| `/tracks.json` | Nama track |

### Pengujian

```bash
g++ -std=c++17 -Wall -Wextra -Werror -o logic_test tests/logic_test.cpp && ./logic_test
```

### Merilis firmware

1. Naikkan `FW_VERSION` di `bel-madrasah.ino`.
2. Tambahkan bagian `## fw-vX.Y.Z` di `CHANGELOG.md`.
3. Commit ke `baremetal`, lalu buat dan push tag `fw-vX.Y.Z`.

Workflow memverifikasi tag sama dengan `FW_VERSION`, lalu menerbitkan release berisi binary penuh, binary aplikasi, dan `checksums.txt`. Release firmware tidak ditandai "Latest" agar tidak tertukar dengan release aplikasi server di branch `main`.

## 8. Cara Pakai

1. Upload sketch lalu nyalakan perangkat.
2. Sambungkan HP atau laptop ke WiFi BELL MADRASAH V0.1.0 (password P@ssw0rd).
3. Buka `http://192.168.4.1`.
4. Jika ingin sinkronisasi waktu otomatis, atur WiFi lewat portal WiFi Manager. Setelah tersimpan, perangkat restart dan terhubung ke WiFi tersebut. Alamat web dapat dilihat di layar OLED atau dibuka lewat `http://bel-madrasah.local`.
5. Periksa waktu. Jika muncul peringatan "Waktu perangkat belum tepercaya", sambungkan ke internet atau gunakan kartu "Atur Waktu".
6. Pilih mode jadwal aktif, atur volume, lalu sesuaikan jadwal bel.
7. Uji tiap track dengan tombol "Putar" di kartu "Daftar Track".

### Panel di halaman web

| Kartu | Fungsi |
|---|---|
| Status | Waktu, sumber waktu, jaringan, IP, track diputar, bel terakhir, DFPlayer, mode libur, mode tidur |
| Kontrol | Volume, mode jadwal aktif, mode libur, tombol Stop Bel |
| Mode Tidur | Aktif/nonaktif, jam mulai, jam selesai, opsi matikan OLED |
| Atur Waktu | Set tanggal dan jam manual |
| Backup | Unduh dan pulihkan jadwal, nama track, dan pengaturan |
| Jaringan | Info WiFi, IP statis, reset WiFi |
| Jadwal Bel | Lihat, filter per hari, tambah, ubah, hapus, aktif/nonaktif per bel |
| Daftar Track | Beri nama, uji putar, dan hapus nama track |

## 9. Penjelasan Fitur Penting

### Pengamanan waktu

Bel hanya berbunyi bila waktu dinilai tepercaya. Hal ini mencegah bel berbunyi di jam yang salah (misalnya tengah malam) akibat RTC bermasalah.

Waktu dianggap tidak tepercaya bila:
- RTC berhenti berjalan (tiga pemeriksaan berturut-turut, sekitar 15 detik).
- Tahun di luar rentang 2025 sampai 2099, atau terjadi lompatan waktu (mundur, atau maju lebih dari 120 detik), dan kondisi itu berlangsung terus selama sekitar 1,5 detik. Satu pembacaan aneh akibat gangguan I2C hanya dilewati: bel pada pembacaan itu tidak diproses, tetapi waktu tetap tepercaya.
- RTC pernah kehilangan daya (baterai habis atau tidak ada) dan belum disinkronkan ulang.
- Modul RTC tidak terpasang dan NTP belum berhasil. Tanpa RTC, perangkat memakai jam dari NTP.

Waktu menjadi tepercaya kembali setelah sinkronisasi NTP berhasil atau waktu diatur manual lewat web.

Sinkronisasi NTP dan pengaturan manual dilakukan dalam satu kunci yang sama dengan pembacaan waktu oleh task bel, sehingga koreksi waktu yang sah tidak dianggap lompatan.

Penanda "waktu pernah diverifikasi" disimpan di NVRAM DS1307. NVRAM ikut hilang saat RTC kehilangan daya, sehingga penanda terhapus otomatis pada kondisi tersebut. Restart biasa (misalnya setelah menyimpan IP statis) tidak menghapus penanda.

Saat waktu tidak tepercaya:
- Bel tidak berbunyi.
- Web menampilkan peringatan merah.
- OLED menampilkan "WAKTU BELUM VALID".

Tombol "Putar" dan "Stop Bel" di web tetap berfungsi.

### Mode Tidur

Pada rentang jam yang diatur:
- Bel terjadwal tidak berbunyi.
- Layar OLED dimatikan (jika opsi aktif). Bila opsi tidak aktif, OLED menampilkan "MODE TIDUR" beserta jam selesai.
- Web server, WiFi, dan RTC tetap aktif sehingga perangkat tetap dapat diatur.
- Bel yang sedang diputar saat masuk jam tidur otomatis dihentikan.
- Tombol "Putar" dan "Stop Bel" di web tetap berfungsi.

Aturan rentang:
- Rentang boleh melewati tengah malam, misalnya 22:00 sampai 05:00.
- Jam mulai dan jam selesai tidak boleh sama.
- Batas mulai termasuk dalam rentang tidur, batas selesai tidak. Bel yang jatuh persis pada jam mulai tidak berbunyi, sedangkan bel pada jam selesai masih berbunyi.
- Mode tidur tidak dihitung bila waktu belum tepercaya.

Mode Libur dan Mode Tidur bekerja terpisah. Salah satu aktif sudah cukup untuk membungkam bel.

### Jaringan dan IP statis

- Perangkat mencoba tersambung ke WiFi tersimpan. Bila gagal lebih dari 20 detik, perangkat mengaktifkan AP cadangan (192.168.4.1) sambil terus mencoba tersambung kembali.
- IP statis harus berada dalam rentang jaringan yang sama. Pilih IP di luar rentang DHCP router agar tidak bentrok. Setelah disimpan, perangkat restart.
- IP statis otomatis dinonaktifkan bila perangkat terhubung ke jaringan (SSID) yang berbeda.
- Reset WiFi menghapus kredensial tersimpan dan membuka portal konfigurasi di 192.168.4.1 setelah restart.

### Penyimpanan

Semua pengaturan disimpan lewat penulisan berkas sementara lalu diganti (atomik), sehingga lebih aman dari kerusakan saat listrik padam. Berkas lama tanpa blok pengaturan baru (misalnya `config.json` tanpa blok `sleep`) tetap kompatibel dan memakai nilai bawaan.

## 10. Pemecahan Masalah

| Gejala | Kemungkinan penyebab | Solusi |
|---|---|---|
| Bel tidak berbunyi sama sekali | DFPlayer atau kartu SD tidak terdeteksi | Periksa kabel TX/RX dan kartu SD; perhatikan peringatan di web |
| Bel tidak berbunyi, ada peringatan waktu | Waktu belum tepercaya | Sambungkan internet atau atur waktu manual |
| Bel tidak berbunyi di jam tertentu | Mode libur aktif, mode tidur aktif, atau mode jadwal salah | Periksa kartu Kontrol dan Mode Tidur |
| Bel berbunyi di jam salah | RTC tanpa baterai, atau gangguan I2C | Pasang CR2032; periksa pull-up dan level tegangan I2C; cek log Serial |
| Waktu sering salah setelah listrik padam | Baterai RTC habis atau tidak ada | Ganti baterai, atau ganti modul ke DS3231 |
| DFPlayer reset saat suara keras | Catu daya kurang stabil | Pindahkan VCC DFPlayer ke 5V, tambahkan kapasitor |
| Suara tidak muncul, ada pesan "File track N tidak ada di kartu SD" | Nomor file tidak ada di kartu SD | Pastikan `mp3/0001.mp3` dan seterusnya sesuai nomor track |
| Pesan "Jadwal sudah berubah di perangkat" | Jadwal diubah dari perangkat lain sejak halaman dibuka | Muat ulang halaman, lalu ulangi perubahan |
| Upload gagal, "Sketch too big" | Partisi masih bawaan | Pilih partisi Minimal SPIFFS (lihat bagian 6) |
| Halaman web tidak terbuka setelah ganti IP | IP berubah | Lihat IP di layar OLED atau gunakan `bel-madrasah.local` |
| OLED kosong | Mode tidur dengan opsi matikan OLED aktif, atau modul tidak terdeteksi | Periksa pengaturan Mode Tidur dan alamat I2C 0x3C |

Log Serial (115200 baud) memuat jam saat bel dipicu beserta uptime, dan pesan saat bel dikunci karena waktu tidak valid. Log ini berguna untuk menelusuri kejadian bel yang berbunyi di jam tidak wajar.

## 11. Catatan Keamanan

- Ganti password AP bawaan (`P@ssw0rd`) pada `AP_PASS` di `bel-madrasah.ino` sebelum dipakai di lingkungan nyata.
- File backup berisi jadwal dan pengaturan, tanpa password WiFi.
- Halaman web tidak memakai login. Siapa pun yang terhubung ke jaringan yang sama dapat mengatur perangkat. Gunakan jaringan WiFi yang terpercaya.
- Mode Tidur dan pengamanan waktu mengurangi risiko bel berbunyi di jam tidak wajar, tetapi perbaikan paling mendasar tetap pada perangkat keras: baterai RTC yang sehat dan catu daya yang stabil.