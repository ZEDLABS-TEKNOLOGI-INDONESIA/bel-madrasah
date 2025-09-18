import time
import subprocess
import os
from datetime import datetime
from jadwal import JADWAL

def expand_path(path):
    return os.path.expanduser(path)

def play_sound(file_path):
    full_path = expand_path(file_path)
    subprocess.Popen([
        "/usr/bin/ffplay", "-nodisp", "-volume", "100", "-autoexit", full_path
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def get_hari():
    hari_map = {
        0: "Senin", 1: "Selasa", 2: "Rabu", 3: "Kamis", 4: "Jumat"
    }
    return hari_map.get(datetime.today().weekday(), None)

def main():
    sudah_diputar = set()
    while True:
        now = datetime.now()
        hari = get_hari()
        if hari in JADWAL:
            for jadwal_waktu, file_audio in JADWAL[hari]:
                jam, menit = map(int, jadwal_waktu.split(":"))
                if now.hour == jam and now.minute == menit:
                    key = f"{hari}-{jadwal_waktu}"
                    if key not in sudah_diputar:
                        play_sound(file_audio)
                        sudah_diputar.add(key)
        time.sleep(30)

if __name__ == "__main__":
    main()
