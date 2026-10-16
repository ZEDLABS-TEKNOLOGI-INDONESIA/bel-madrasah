# Bel Madrasah (ESP32-C3 Super Mini)
- Nama AP    : BELL MADRASAH V0.1.0
- PASSWORD   : P@ssw0rd
- IP ADDRESS : 192.168.4.1

## Catatan
- Koneksikan ke wifi (hanya untuk sinkronisasi waktu secara berkala (jika ada internet))
- Pengaturan jadwal bell dan Nada bell diatur pada web.
- Jadwal Bell (Senin - Sabtu  (dapat diatur aktif atau nonaktif))

## Kebutuhan
- **ESP32-C3 Super Mini**
- **Modul DFPlayer Mini**
- **OLED 0.91"** (SSD1306, 128x32, I2C, alamat 0x3C)
- **RTC DS1307**
- Amplifier External
- Kartu microSD (FAT32) berisi file MP3

## Wiring

### DFPlayer Mini (UART)
| DFPlayer | ESP32-C3 | Keterangan |
|---|---|---|
| VCC | 3.3V | Jika tidak stabil/reset saat suara keras, pindah ke 5V |
| GND | GND | |
| TX | GPIO 20 | RX pada ESP |
| RX | GPIO 21 | TX pada ESP, disarankan lewat resistor 1 kΩ |
| SPK1 / SPK2 atau DAC_R / DAC_L | Input Amplifier External | Keluaran audio |

### RTC DS1307 (I2C)
| DS1307 | ESP32-C3 | Keterangan |
|---|---|---|
| VCC | 5V | Modul DS1307 membutuhkan 5V |
| GND | GND | |
| SDA | GPIO 8 | |
| SCL | GPIO 9 | |

### OLED 0.91" SSD1306 (I2C)
| OLED | ESP32-C3 | Keterangan |
|---|---|---|
| VCC | 3.3V | |
| GND | GND | |
| SDA | GPIO 8 | Satu bus I2C dengan RTC |
| SCL | GPIO 9 | Satu bus I2C dengan RTC |

Catatan wiring:
- Semua modul harus berbagi **GND** yang sama.
- Alamat I2C: OLED `0x3C`, RTC `0x68`, keduanya tidak bentrok.
- Pull-up I2C pada modul DS1307 yang tersambung ke 5V dapat menaikkan level SDA/SCL. Jika ragu, lepas pull-up pada modul atau gunakan level shifter karena GPIO ESP32-C3 hanya toleran 3.3V.
- GPIO 8 dan 9 adalah pin strapping ESP32-C3; pastikan tidak ada beban yang menarik GPIO 9 ke LOW saat boot.

## Kartu SD DFPlayer
- Format **FAT32**.
- Buat folder **`mp3`** di root kartu SD, isi file bernama 4 digit: `0001.mp3`, `0002.mp3`, dst.
- Nomor file = nomor track yang dipilih pada jadwal di web.
- Track bawaan:

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

## Fitur
- **Bel otomatis** berdasarkan jadwal, memutar track MP3 dari DFPlayer sesuai jam dan hari.
- **4 mode jadwal**: Reguler, Ramadhan, PTS, dan PAS. Mode aktif dapat diganti dari web.
- **Pengaturan hari fleksibel**: setiap hari, Senin-Sabtu, Senin-Jumat, Senin-Kamis, atau per hari.
- **Aktif/nonaktif per bel**, serta tambah, ubah, dan hapus jadwal (maksimal 300 bel).
- **Mode Libur**: menonaktifkan seluruh jadwal dengan satu tombol.
- **Kontrol volume** (0-30), **Stop Bel**, dan **tombol Putar** untuk menguji tiap track.
- **Daftar track**: beri nama pada nomor track agar mudah dipilih (maksimal 60 track).
- **Web dashboard**: status waktu, jaringan, IP, track yang sedang diputar, dan kondisi DFPlayer.
- **WiFi Manager**: konfigurasi WiFi lewat portal AP, otomatis sambung ulang, dan fallback ke mode AP bila WiFi tidak tersedia.
- **IP statis** opsional dan **reset WiFi** dari web. Alamat mDNS: `bel-madrasah.local`.
- **Sinkronisasi waktu NTP** (UTC+7) ke RTC setiap 1 jam bila ada internet. Tanpa internet, waktu tetap berjalan dari RTC DS1307.
- **Tampilan OLED** bergantian setiap 3 detik: Waktu, IP Address, dan Nama WiFi (rata tengah).
- **Penyimpanan permanen** (LittleFS): konfigurasi, jadwal, dan nama track tidak hilang saat mati listrik.
- **Auto-retry DFPlayer** setiap 5 detik jika modul atau kartu SD belum terdeteksi.

## Library
Pasang lewat Arduino IDE (Library Manager):

| Library | Pembuat |
|---|---|
| WiFiManager | tzapu |
| ESP Async WebServer | ESP32Async |
| Async TCP | ESP32Async |
| ArduinoJson | Benoit Blanchon |
| RTClib | Adafruit |
| Adafruit GFX Library | Adafruit |
| Adafruit SSD1306 | Adafruit |
| Adafruit BusIO | Adafruit |
| DFRobotDFPlayerMini | DFRobot |

Library bawaan core ESP32 (tidak perlu dipasang): `WiFi`, `ESPmDNS`, `Wire`, `LittleFS`, `HardwareSerial`.

Catatan: gunakan **ESP Async WebServer** dan **Async TCP** dari **ESP32Async**. Versi lama dari me-no-dev tidak kompatibel dengan core ESP32 terbaru. Jangan pasang dua versi AsyncTCP sekaligus.

## Pengaturan Arduino IDE
- Board: **ESP32C3 Dev Module** (paket **esp32 by Espressif** dari Boards Manager)
- USB CDC On Boot: **Enabled** (agar Serial Monitor tampil)
- Baud Serial Monitor: **115200**
- Partition Scheme: bawaan (memuat LittleFS/SPIFFS)

## Cara Pakai Singkat
1. Upload sketch, lalu nyalakan perangkat.
2. Sambungkan HP/laptop ke WiFi **BELL MADRASAH V0.1.0** (password `P@ssw0rd`).
3. Buka `http://192.168.4.1`. Jika ingin sinkron waktu otomatis, atur WiFi lewat portal.
4. Atur mode jadwal, volume, dan jadwal bel di halaman web.