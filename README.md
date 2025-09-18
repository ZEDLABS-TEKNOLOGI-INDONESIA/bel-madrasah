# Bel Madrasah Tsanawiyah Negeri 1 Pandeglang

## **Komponen Sistem:**

### 1. **Script Utama** (`school-bell.sh`)
- Menjalankan ffplay dengan parameter: `-nodisp -volume 100 -autoexit`
- Mendukung semua jenis bel sesuai jadwal
- Logging otomatis ke `/var/log/school-bell.log`
- Error handling untuk file audio yang tidak ditemukan

### 2. **Jadwal Crontab**
- Jadwal lengkap untuk 5 hari (Senin-Jumat)
- Waktu yang tepat sesuai WIB yang Anda tentukan
- Setiap hari memiliki jadwal yang berbeda sesuai kebutuhan

### 3. **Script Installer**
- Otomatis menginstall semua komponen
- Setup crontab
- Membuat direktori audio
- Validasi ffplay

## **Cara Install:**

1. **Simpan script installer sebagai `install-bell.sh`**
2. **Jalankan installer:**
   ```bash
   chmod +x install-bell.sh
   sudo ./install-bell.sh
   ```

3. **Copy file audio ke direktori:**
   ```bash
   ~/bel-sekolah/tone/
   ```

## **File Audio yang Diperlukan:**
- `sholawat.mp3`, `hymne.mp3`, `upacara.mp3`, `literasi.mp3`
- `rohani.mp3`, `p1.mp3` sampai `p10.mp3`
- `indonesia-raya.mp3`, `i1.mp3`, `i2.mp3`, `kebersihan.mp3`
- `s.mp3` (bel pulang), `ap.mp3` (bel pulang jumat), `pramuka.mp3`

## **Cara Test:**
```bash
# Test manual
/usr/local/bin/school-bell.sh sholawat

# Monitor log
tail -f /var/log/school-bell.log

# Cek crontab
crontab -l
```

## **Fitur Utama:**
- ✅ Jadwal otomatis sesuai hari dan waktu
- ✅ Logging lengkap semua aktivitas
- ✅ Error handling file audio
- ✅ Support semua jenis bel sekolah
- ✅ Easy installation dan maintenance

Service ini akan berjalan otomatis sesuai jadwal yang telah ditentukan!