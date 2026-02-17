import time
import subprocess
import os
import sys
from datetime import datetime
from jadwal import JADWAL

VOLUME = "0.85"
FFMPEG_BIN = "/usr/bin/ffmpeg"

active_processes = []


def expand_path(path):
    return os.path.expanduser(path)


def cleanup_processes():
    global active_processes
    active_processes = [p for p in active_processes if p.poll() is None]


def play_sound(file_path):
    full_path = expand_path(file_path)

    if not os.path.isfile(full_path):
        log(f"File tidak ditemukan: {full_path}")
        return

    cleanup_processes()

    proc = subprocess.Popen(
        [
            FFMPEG_BIN,
            "-hide_banner",
            "-loglevel", "error",
            "-i", full_path,
            "-filter:a", f"volume={VOLUME}",
            "-f", "alsa",
            "default"
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    active_processes.append(proc)


def get_hari():
    hari_map = {
        0: "Senin",
        1: "Selasa",
        2: "Rabu",
        3: "Kamis",
        4: "Jumat"
    }
    return hari_map.get(datetime.today().weekday(), None)


def log(message):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}", flush=True)


def main():
    if not os.path.isfile(FFMPEG_BIN):
        log(f"ffmpeg tidak ditemukan di {FFMPEG_BIN}. Pastikan ffmpeg terinstall.")
        sys.exit(1)

    log("Sistem bel madrasah dimulai.")

    sudah_diputar = set()
    hari_sekarang = None

    while True:
        now = datetime.now()
        hari = get_hari()

        if hari != hari_sekarang:
            if hari_sekarang is not None:
                sudah_diputar.clear()
                log("Cache jadwal direset untuk hari baru.")
            hari_sekarang = hari

        if hari and hari in JADWAL:
            waktu_sekarang = now.strftime("%H:%M")

            for jadwal_waktu, file_audio in JADWAL[hari]:
                key = f"{hari}-{jadwal_waktu}"

                if waktu_sekarang == jadwal_waktu and key not in sudah_diputar:
                    log(f"Memutar: {os.path.basename(file_audio)} [{jadwal_waktu}]")
                    play_sound(file_audio)
                    sudah_diputar.add(key)

        time.sleep(20)


if __name__ == "__main__":
    main()
