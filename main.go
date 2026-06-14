package main

import (
	"fmt"
	"log"
	"net/http"
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
	port      = ":8081"
	toneDir   = "/opt/bel-madrasah/tone"
	dataDir   = "/opt/bel-madrasah/data"
	staticDir = "/opt/bel-madrasah/static"
)

var (
	activeProcs []*exec.Cmd
	procMu      sync.Mutex

	schedulerRunning = true
	schedulerMu      sync.Mutex
)

func logMsg(msg string) {
	fmt.Printf("[%s] %s\n", time.Now().Format("2006-01-02 15:04:05"), msg)
}

func getHari() string {
	hariMap := map[time.Weekday]string{
		time.Monday:    "Senin",
		time.Tuesday:   "Selasa",
		time.Wednesday: "Rabu",
		time.Thursday:  "Kamis",
		time.Friday:    "Jumat",
	}
	return hariMap[time.Now().Weekday()] // returns "" for weekend
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
		"-hide_banner", "-loglevel", "error",
		"-i", filePath,
		"-filter:a", fmt.Sprintf("volume=%s", volume),
		"-f", "alsa", alsaDev,
	)
	if err := cmd.Start(); err != nil {
		logMsg(fmt.Sprintf("Gagal memutar audio: %s", err))
		return
	}
	procMu.Lock()
	activeProcs = append(activeProcs, cmd)
	procMu.Unlock()
	go func() { _ = cmd.Wait() }()
}

func runScheduler() {
	logMsg("Scheduler bel madrasah dimulai.")
	sudahDiputar := make(map[string]bool)
	hariSekarang := ""

	for {
		schedulerMu.Lock()
		running := schedulerRunning
		schedulerMu.Unlock()

		if !running {
			time.Sleep(sleepSec)
			continue
		}

		now := time.Now()
		hari := getHari()

		// Reset cache saat hari berganti
		if hari != hariSekarang {
			if hariSekarang != "" {
				sudahDiputar = make(map[string]bool)
				logMsg("Cache jadwal direset untuk hari baru.")
			}
			hariSekarang = hari
		}

		if hari != "" {
			jadwal, err := loadJadwal()
			if err == nil {
				if jadwalHari, ok := jadwal[hari]; ok {
					waktuSekarang := now.Format("15:04")
					for _, entry := range jadwalHari {
						key := hari + "-" + entry.Waktu
						if waktuSekarang == entry.Waktu && !sudahDiputar[key] {
							logMsg(fmt.Sprintf("Memutar: %s [%s]", filepath.Base(entry.Audio), entry.Waktu))
							playSound(entry.Audio)
							sudahDiputar[key] = true
						}
					}
				}
			}
		}
		time.Sleep(sleepSec)
	}
}

func main() {
	if _, err := os.Stat(ffmpegBin); os.IsNotExist(err) {
		log.Fatalf("ffmpeg tidak ditemukan di %s.", ffmpegBin)
	}

	for _, d := range []string{toneDir, dataDir, staticDir} {
		if err := os.MkdirAll(d, 0755); err != nil {
			log.Fatalf("Gagal membuat direktori %s: %s", d, err)
		}
	}

	if err := initStorage(); err != nil {
		log.Fatalf("Gagal inisialisasi storage: %s", err)
	}

	if err := initAuth(); err != nil {
		log.Fatalf("Gagal inisialisasi auth: %s", err)
	}

	go runScheduler()

	mux := http.NewServeMux()
	registerRoutes(mux)

	logMsg(fmt.Sprintf("Web server berjalan di port %s", port))
	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatalf("Server error: %s", err)
	}
}
