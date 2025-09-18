import pygame
import datetime
import time
import os
import threading
from typing import Dict, List, Tuple

class SchoolBellSystem:
    def __init__(self):
        # Inisialisasi pygame mixer untuk audio
        pygame.mixer.init()
        
        # Jadwal bel untuk setiap hari
        self.schedules = {
            0: [  # Senin (Monday = 0)
                ("06:40", "~/bel-sekolah/tone/sholawat.mp3", "Bel Sholawat"),
                ("07:00", "~/bel-sekolah/tone/hymne.mp3", "Bel Masuk"),
                ("07:15", "~/bel-sekolah/tone/upacara.mp3", "Bel Upacara"),
                ("08:10", "~/bel-sekolah/tone/p2.mp3", "Bel Jam Pelajaran Ke 2"),
                ("08:50", "~/bel-sekolah/tone/p3.mp3", "Bel Jam Pelajaran Ke 3"),
                ("09:30", "~/bel-sekolah/tone/p4.mp3", "Bel Jam Pelajaran Ke 4"),
                ("10:00", "~/bel-sekolah/tone/indonesia-raya.mp3", "Bel Indonesia Raya"),
                ("10:10", "~/bel-sekolah/tone/i1.mp3", "Bel Jam Istirahat Ke 1"),
                ("10:20", "~/bel-sekolah/tone/kebersihan.mp3", "Bel Kebersihan"),
                ("10:30", "~/bel-sekolah/tone/p5.mp3", "Bel Jam Pelajaran Ke 5"),
                ("11:10", "~/bel-sekolah/tone/p6.mp3", "Bel Jam Pelajaran Ke 6"),
                ("11:50", "~/bel-sekolah/tone/i2.mp3", "Bel Jam Istirahat Ke 2"),
                ("12:40", "~/bel-sekolah/tone/p7.mp3", "Bel Jam Pelajaran Ke 7"),
                ("13:20", "~/bel-sekolah/tone/p8.mp3", "Bel Jam Pelajaran Ke 8"),
                ("14:00", "~/bel-sekolah/tone/p9.mp3", "Bel Jam Pelajaran Ke 9"),
                ("14:40", "~/bel-sekolah/tone/p10.mp3", "Bel Jam Pelajaran Ke 10"),
                ("15:20", "~/bel-sekolah/tone/s.mp3", "Bel Terakhir / Bel Pulang"),
                ("16:30", "~/bel-sekolah/tone/hymne.mp3", "Bel Hymne")
            ],
            1: [  # Selasa (Tuesday = 1)
                ("06:40", "~/bel-sekolah/tone/sholawat.mp3", "Bel Sholawat"),
                ("07:00", "~/bel-sekolah/tone/hymne.mp3", "Bel Masuk"),
                ("07:30", "~/bel-sekolah/tone/p1.mp3", "Bel Jam Pelajaran Ke 1"),
                ("08:10", "~/bel-sekolah/tone/p2.mp3", "Bel Jam Pelajaran Ke 2"),
                ("08:50", "~/bel-sekolah/tone/p3.mp3", "Bel Jam Pelajaran Ke 3"),
                ("09:30", "~/bel-sekolah/tone/p4.mp3", "Bel Jam Pelajaran Ke 4"),
                ("10:10", "~/bel-sekolah/tone/i1.mp3", "Bel Jam Istirahat Ke 1"),
                ("10:20", "~/bel-sekolah/tone/kebersihan.mp3", "Bel Kebersihan"),
                ("10:30", "~/bel-sekolah/tone/p5.mp3", "Bel Jam Pelajaran Ke 5"),
                ("11:10", "~/bel-sekolah/tone/p6.mp3", "Bel Jam Pelajaran Ke 6"),
                ("11:50", "~/bel-sekolah/tone/i2.mp3", "Bel Jam Istirahat Ke 2"),
                ("12:40", "~/bel-sekolah/tone/p7.mp3", "Bel Jam Pelajaran Ke 7"),
                ("13:20", "~/bel-sekolah/tone/p8.mp3", "Bel Jam Pelajaran Ke 8"),
                ("14:00", "~/bel-sekolah/tone/p9.mp3", "Bel Jam Pelajaran Ke 9"),
                ("14:40", "~/bel-sekolah/tone/p10.mp3", "Bel Jam Pelajaran Ke 10"),
                ("15:20", "~/bel-sekolah/tone/s.mp3", "Bel Terakhir / Bel Pulang"),
                ("16:30", "~/bel-sekolah/tone/hymne.mp3", "Bel Hymne")
            ],
            2: [  # Rabu (Wednesday = 2)
                ("06:40", "~/bel-sekolah/tone/sholawat.mp3", "Bel Sholawat"),
                ("07:00", "~/bel-sekolah/tone/hymne.mp3", "Bel Masuk"),
                ("07:30", "~/bel-sekolah/tone/p1.mp3", "Bel Jam Pelajaran Ke 1"),
                ("08:10", "~/bel-sekolah/tone/p2.mp3", "Bel Jam Pelajaran Ke 2"),
                ("08:50", "~/bel-sekolah/tone/p3.mp3", "Bel Jam Pelajaran Ke 3"),
                ("09:30", "~/bel-sekolah/tone/p4.mp3", "Bel Jam Pelajaran Ke 4"),
                ("10:10", "~/bel-sekolah/tone/i1.mp3", "Bel Jam Istirahat Ke 1"),
                ("10:20", "~/bel-sekolah/tone/kebersihan.mp3", "Bel Kebersihan"),
                ("10:30", "~/bel-sekolah/tone/p5.mp3", "Bel Jam Pelajaran Ke 5"),
                ("11:10", "~/bel-sekolah/tone/p6.mp3", "Bel Jam Pelajaran Ke 6"),
                ("11:50", "~/bel-sekolah/tone/i2.mp3", "Bel Jam Istirahat Ke 2"),
                ("12:40", "~/bel-sekolah/tone/p7.mp3", "Bel Jam Pelajaran Ke 7"),
                ("13:20", "~/bel-sekolah/tone/p8.mp3", "Bel Jam Pelajaran Ke 8"),
                ("14:00", "~/bel-sekolah/tone/p9.mp3", "Bel Jam Pelajaran Ke 9"),
                ("14:40", "~/bel-sekolah/tone/p10.mp3", "Bel Jam Pelajaran Ke 10"),
                ("15:20", "~/bel-sekolah/tone/s.mp3", "Bel Terakhir / Bel Pulang"),
                ("16:30", "~/bel-sekolah/tone/hymne.mp3", "Bel Hymne")
            ],
            3: [  # Kamis (Thursday = 3)
                ("06:40", "~/bel-sekolah/tone/sholawat.mp3", "Bel Sholawat"),
                ("07:00", "~/bel-sekolah/tone/hymne.mp3", "Bel Masuk"),
                ("07:15", "~/bel-sekolah/tone/literasi.mp3", "Bel Literasi"),
                ("08:10", "~/bel-sekolah/tone/p2.mp3", "Bel Jam Pelajaran Ke 2"),
                ("08:50", "~/bel-sekolah/tone/p3.mp3", "Bel Jam Pelajaran Ke 3"),
                ("09:30", "~/bel-sekolah/tone/p4.mp3", "Bel Jam Pelajaran Ke 4"),
                ("10:00", "~/bel-sekolah/tone/indonesia-raya.mp3", "Bel Indonesia Raya"),
                ("10:10", "~/bel-sekolah/tone/i1.mp3", "Bel Jam Istirahat Ke 1"),
                ("10:20", "~/bel-sekolah/tone/kebersihan.mp3", "Bel Kebersihan"),
                ("10:30", "~/bel-sekolah/tone/p5.mp3", "Bel Jam Pelajaran Ke 5"),
                ("11:10", "~/bel-sekolah/tone/p6.mp3", "Bel Jam Pelajaran Ke 6"),
                ("11:50", "~/bel-sekolah/tone/i2.mp3", "Bel Jam Istirahat Ke 2"),
                ("12:40", "~/bel-sekolah/tone/p7.mp3", "Bel Jam Pelajaran Ke 7"),
                ("13:20", "~/bel-sekolah/tone/p8.mp3", "Bel Jam Pelajaran Ke 8"),
                ("14:00", "~/bel-sekolah/tone/p9.mp3", "Bel Jam Pelajaran Ke 9"),
                ("14:40", "~/bel-sekolah/tone/p10.mp3", "Bel Jam Pelajaran Ke 10"),
                ("15:20", "~/bel-sekolah/tone/s.mp3", "Bel Terakhir / Bel Pulang"),
                ("16:30", "~/bel-sekolah/tone/hymne.mp3", "Bel Hymne")
            ],
            4: [  # Jumat (Friday = 4)
                ("02:14", "~/bel-sekolah/tone/sholawat.mp3", "Bel Sholawat"),
                ("06:40", "~/bel-sekolah/tone/sholawat.mp3", "Bel Sholawat"),
                ("07:00", "~/bel-sekolah/tone/hymne.mp3", "Bel Masuk"),
                ("07:15", "~/bel-sekolah/tone/rohani.mp3", "Bel Jam Pelajaran Ke 1"),
                ("07:50", "~/bel-sekolah/tone/p2.mp3", "Bel Jam Pelajaran Ke 2"),
                ("08:30", "~/bel-sekolah/tone/p3.mp3", "Bel Jam Pelajaran Ke 3"),
                ("09:10", "~/bel-sekolah/tone/p4.mp3", "Bel Jam Pelajaran Ke 4"),
                ("09:50", "~/bel-sekolah/tone/i1.mp3", "Bel Jam Istirahat Ke 1"),
                ("10:00", "~/bel-sekolah/tone/kebersihan.mp3", "Bel Kebersihan"),
                ("10:10", "~/bel-sekolah/tone/p5.mp3", "Bel Jam Pelajaran Ke 5"),
                ("10:50", "~/bel-sekolah/tone/p6.mp3", "Bel Jam Pelajaran Ke 6"),
                ("11:30", "~/bel-sekolah/tone/i2.mp3", "Bel Jam Istirahat Ke 2"),
                ("12:50", "~/bel-sekolah/tone/p7.mp3", "Bel Jam Pelajaran Ke 7"),
                ("13:30", "~/bel-sekolah/tone/p8.mp3", "Bel Jam Pelajaran Ke 8"),
                ("14:10", "~/bel-sekolah/tone/p9.mp3", "Bel Jam Pelajaran Ke 9"),
                ("14:50", "~/bel-sekolah/tone/ap.mp3", "Bel Terakhir / Bel Pulang"),
                ("14:51", "~/bel-sekolah/tone/pramuka.mp3", "Bel Pramuka"),
                ("16:30", "~/bel-sekolah/tone/hymne.mp3", "Bel Hymne")
            ]
        }
        
        self.is_running = False
        self.played_today = set()  # Track yang sudah diputar hari ini
        
    def expand_path(self, path: str) -> str:
        """Expand path dengan tilde (~) menjadi path absolut"""
        return os.path.expanduser(path)
    
    def play_audio(self, file_path: str, description: str):
        """Memutar file audio"""
        try:
            expanded_path = self.expand_path(file_path)
            
            # Cek apakah file ada
            if not os.path.exists(expanded_path):
                print(f"❌ File tidak ditemukan: {expanded_path}")
                return False
                
            print(f"🔔 {datetime.datetime.now().strftime('%H:%M:%S')} - {description}")
            print(f"   📁 Memutar: {expanded_path}")
            
            # Load dan play audio
            pygame.mixer.music.load(expanded_path)
            pygame.mixer.music.play()
            
            # Tunggu sampai audio selesai diputar
            while pygame.mixer.music.get_busy():
                time.sleep(0.1)
                
            print(f"   ✅ Selesai memutar: {description}\n")
            return True
            
        except Exception as e:
            print(f"❌ Error memutar audio {file_path}: {str(e)}")
            return False
    
    def get_current_time_string(self) -> str:
        """Mendapatkan waktu saat ini dalam format HH:MM"""
        return datetime.datetime.now().strftime("%H:%M")
    
    def get_today_schedule(self) -> List[Tuple[str, str, str]]:
        """Mendapatkan jadwal hari ini"""
        today = datetime.datetime.now().weekday()
        return self.schedules.get(today, [])
    
    def reset_daily_tracking(self):
        """Reset tracking harian pada tengah malam"""
        current_date = datetime.datetime.now().date()
        if not hasattr(self, '_last_date'):
            self._last_date = current_date
        elif self._last_date != current_date:
            self.played_today.clear()
            self._last_date = current_date
            print(f"🌅 Hari baru: {current_date.strftime('%A, %d %B %Y')}")
            print("🔄 Reset daftar bel yang sudah diputar\n")
    
    def check_and_play_scheduled_audio(self):
        """Cek dan putar audio sesuai jadwal"""
        current_time = self.get_current_time_string()
        today_schedule = self.get_today_schedule()
        
        for time_str, audio_file, description in today_schedule:
            # Buat unique key untuk tracking
            schedule_key = f"{time_str}_{audio_file}"
            
            if (current_time == time_str and 
                schedule_key not in self.played_today):
                
                # Putar audio di thread terpisah agar tidak blocking
                audio_thread = threading.Thread(
                    target=self.play_audio,
                    args=(audio_file, description)
                )
                audio_thread.daemon = True
                audio_thread.start()
                
                # Tandai sudah diputar
                self.played_today.add(schedule_key)
    
    def display_today_schedule(self):
        """Menampilkan jadwal hari ini"""
        today = datetime.datetime.now()
        day_names = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
        today_name = day_names[today.weekday()]
        
        print(f"📅 Jadwal Bel Hari Ini ({today_name}, {today.strftime('%d %B %Y')}):")
        print("=" * 60)
        
        today_schedule = self.get_today_schedule()
        if not today_schedule:
            print("   Tidak ada jadwal untuk hari ini (Sabtu/Minggu)")
            return
            
        for i, (time_str, audio_file, description) in enumerate(today_schedule, 1):
            status = "✅" if f"{time_str}_{audio_file}" in self.played_today else "⏳"
            print(f"{status} {time_str} - {description}")
        
        print("=" * 60)
        print(f"⏰ Waktu sekarang: {self.get_current_time_string()}")
        print()
    
    def start(self):
        """Memulai sistem bel sekolah"""
        self.is_running = True
        print("🎵 Sistem Bel Sekolah Otomatis Dimulai")
        print("=" * 50)
        print("⏹️  Tekan Ctrl+C untuk menghentikan sistem\n")
        
        # Tampilkan jadwal hari ini
        self.display_today_schedule()
        
        try:
            while self.is_running:
                # Reset tracking harian jika perlu
                self.reset_daily_tracking()
                
                # Cek dan putar audio sesuai jadwal
                self.check_and_play_scheduled_audio()
                
                # Tunggu 1 detik sebelum cek lagi
                time.sleep(1)
                
        except KeyboardInterrupt:
            self.stop()
    
    def stop(self):
        """Menghentikan sistem bel sekolah"""
        self.is_running = False
        pygame.mixer.quit()
        print("\n🛑 Sistem Bel Sekolah Dihentikan")
        print("👋 Terima kasih telah menggunakan sistem ini!")

def main():
    """Fungsi utama untuk menjalankan program"""
    print("🏫 SISTEM BEL SEKOLAH OTOMATIS")
    print("=" * 50)
    
    # Cek apakah pygame tersedia
    try:
        import pygame
    except ImportError:
        print("❌ Pygame tidak terinstall!")
        print("💡 Install dengan: pip install pygame")
        return
    
    # Buat dan jalankan sistem bel
    bell_system = SchoolBellSystem()
    
    # Menu pilihan
    while True:
        print("\n📋 MENU:")
        print("1. Mulai sistem bel otomatis")
        print("2. Lihat jadwal hari ini")
        print("3. Test putar audio")
        print("4. Keluar")
        
        choice = input("\n🔢 Pilih menu (1-4): ").strip()
        
        if choice == "1":
            bell_system.start()
        elif choice == "2":
            bell_system.display_today_schedule()
        elif choice == "3":
            test_file = input("📁 Masukkan path file audio untuk test: ").strip()
            if test_file:
                bell_system.play_audio(test_file, "Test Audio")
        elif choice == "4":
            print("👋 Sampai jumpa!")
            break
        else:
            print("❌ Pilihan tidak valid!")

if __name__ == "__main__":
    main()