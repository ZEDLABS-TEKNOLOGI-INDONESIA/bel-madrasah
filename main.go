package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

const (
	ffmpegBin = "/usr/bin/ffmpeg"
	alsaDev   = "hw:1,0"
	volume    = "0.85"
	sleepSec  = 20 * time.Second
)

var (
	activeProcs []*exec.Cmd
	procMu      sync.Mutex
)

func logMsg(msg string) {
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	fmt.Printf("[%s] %s\n", timestamp, msg)
}

func getHari() string {
	hariMap := map[time.Weekday]string{
		time.Monday:    "Senin",
		time.Tuesday:   "Selasa",
		time.Wednesday: "Rabu",
		time.Thursday:  "Kamis",
		time.Friday:    "Jumat",
	}
	hari, ok := hariMap[time.Now().Weekday()]
	if !ok {
		return ""
	}
	return hari
}

func cleanupProcs() {
	procMu.Lock()
	defer procMu.Unlock()

	alive := activeProcs[:0]
	for _, p := range activeProcs {
		if p.ProcessState == nil {
			alive = append(alive, p)
		}
	}
	activeProcs = alive
}

func playSound(filePath string) {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		logMsg(fmt.Sprintf("File tidak ditemukan: %s", filePath))
		return
	}

	cleanupProcs()

	cmd := exec.Command(
		ffmpegBin,
		"-hide_banner",
		"-loglevel", "error",
		"-i", filePath,
		"-filter:a", fmt.Sprintf("volume=%s", volume),
		"-f", "alsa",
		alsaDev,
	)
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Start(); err != nil {
		logMsg(fmt.Sprintf("Gagal memutar audio: %s", err))
		return
	}

	procMu.Lock()
	activeProcs = append(activeProcs, cmd)
	procMu.Unlock()

	go func() {
		_ = cmd.Wait()
	}()
}

func main() {
	if _, err := os.Stat(ffmpegBin); os.IsNotExist(err) {
		log.Fatalf("ffmpeg tidak ditemukan di %s. Pastikan ffmpeg terinstall.", ffmpegBin)
	}

	logMsg("Sistem bel madrasah dimulai.")

	sudahDiputar := make(map[string]bool)
	hariSekarang := ""

	for {
		now := time.Now()
		hari := getHari()

		if hari != hariSekarang {
			if hariSekarang != "" {
				sudahDiputar = make(map[string]bool)
				logMsg("Cache jadwal direset untuk hari baru.")
			}
			hariSekarang = hari
		}

		if hari != "" {
			if jadwalHari, ok := Jadwal[hari]; ok {
				waktuSekarang := now.Format("15:04")

				for _, entry := range jadwalHari {
					key := fmt.Sprintf("%s-%s", hari, entry.Waktu)

					if waktuSekarang == entry.Waktu && !sudahDiputar[key] {
						logMsg(fmt.Sprintf("Memutar: %s [%s]", filepath.Base(entry.Audio), entry.Waktu))
						playSound(entry.Audio)
						sudahDiputar[key] = true
					}
				}
			}
		}

		time.Sleep(sleepSec)
	}
}
