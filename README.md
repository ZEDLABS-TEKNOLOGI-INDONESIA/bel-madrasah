# Bel Madrasah Tsanawiyah Negeri 1 Pandeglang
## ✨ Fitur Utama:

1. **Pemutaran Audio Otomatis** - Sistem akan otomatis memutar audio sesuai jadwal yang telah ditentukan
2. **Jadwal Lengkap** - Mendukung jadwal Senin sampai Jumat dengan waktu dan audio yang berbeda
3. **Tracking Harian** - Mencegah audio yang sama diputar berulang di waktu yang sama
4. **Menu Interaktif** - Interface yang mudah digunakan
5. **Test Audio** - Fitur untuk mencoba memutar audio tertentu

## 🛠️ Cara Instalasi:

```bash
pip install pygame
```

## 📂 Struktur Folder Audio:

Pastikan Anda memiliki struktur folder seperti ini:
```
~/bel-sekolah/tone/
├── sholawat.mp3
├── hymne.mp3
├── upacara.mp3
├── p1.mp3, p2.mp3, ..., p10.mp3
├── i1.mp3, i2.mp3
├── indonesia-raya.mp3
├── kebersihan.mp3
├── s.mp3
├── literasi.mp3
├── rohani.mp3
├── ap.mp3
└── pramuka.mp3
```

## 🎯 Cara Penggunaan:

1. **Jalankan program**: 
```
python3 -m venv venv-bel
source venv-bel/bin/activate
pip install pygame
python3 school_bell_system.py

```
2. **Pilih menu 1** untuk memulai sistem otomatis
3. **Sistem akan berjalan** dan otomatis memutar audio sesuai jadwal
4. **Tekan Ctrl+C** untuk menghentikan sistem

## ⚙️ Fitur Khusus:

- **Auto Reset Harian**: Daftar audio yang sudah diputar akan reset setiap hari baru
- **Error Handling**: Sistem akan memberitahu jika file audio tidak ditemukan
- **Threading**: Audio diputar di thread terpisah agar sistem tetap responsif
- **Status Display**: Menampilkan jadwal hari ini dengan status sudah diputar/belum

Sistem ini akan bekerja 24/7 dan hanya memutar audio sesuai hari dan waktu yang telah dijadwalkan. Setiap audio hanya akan diputar sekali pada waktunya di hari tersebut.