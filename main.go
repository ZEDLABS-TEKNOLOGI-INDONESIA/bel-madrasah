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
	port      = ":8081"
	toneDir   = "/opt/bel-madrasah/tone"
	dataDir   = "/opt/bel-madrasah/data"
	staticDir = "/opt/bel-madrasah/static"
	volume    = "0.85"
	sleepSec  = 20 * time.Second
)

var (
	ffmpegPath string

	activeProcs []*exec.Cmd
	procMu      sync.Mutex

	schedulerRunning = true
	schedulerMu      sync.Mutex
)

func logMsg(msg string) {
	fmt.Printf("[%s] %s\n", time.Now().Format("2006-01-02 15:04:05"), msg)
}

func getHari() string {
	m := map[time.Weekday]string{
		time.Monday:    "Senin",
		time.Tuesday:   "Selasa",
		time.Wednesday: "Rabu",
		time.Thursday:  "Kamis",
		time.Friday:    "Jumat",
	}
	return m[time.Now().Weekday()]
}

func stopAllProcs() {
	procMu.Lock()
	procs := activeProcs
	activeProcs = nil
	procMu.Unlock()
	for _, p := range procs {
		if p.ProcessState == nil {
			_ = p.Process.Kill()
			_ = p.Wait()
		}
	}
	time.Sleep(200 * time.Millisecond)
}

func playSound(filePath string) {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		logMsg("file tidak ditemukan: " + filePath)
		return
	}
	stopAllProcs()
	args := []string{
		"-hide_banner", "-loglevel", "error",
		"-i", filePath,
		"-filter:a", "volume=" + volume,
		"-f", "pulse", "default",
	}
	cmd := exec.Command(ffmpegPath, args...)
	if err := cmd.Start(); err != nil {
		logMsg("gagal memutar audio: " + err.Error())
		return
	}
	procMu.Lock()
	activeProcs = append(activeProcs, cmd)
	procMu.Unlock()
	go func() {
		_ = cmd.Wait()
		procMu.Lock()
		alive := activeProcs[:0]
		for _, p := range activeProcs {
			if p.ProcessState == nil {
				alive = append(alive, p)
			}
		}
		activeProcs = alive
		procMu.Unlock()
	}()
}

func runScheduler() {
	logMsg("scheduler dimulai")
	played := make(map[string]bool)
	lastDay := ""

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

		if hari != lastDay {
			if lastDay != "" {
				played = make(map[string]bool)
			}
			lastDay = hari
		}

		if hari == "" {
			time.Sleep(sleepSec)
			continue
		}

		cfg, err := loadConfig()
		if err != nil {
			time.Sleep(sleepSec)
			continue
		}

		if isLibur(cfg) {
			time.Sleep(sleepSec)
			continue
		}

		mode := resolveMode(cfg)
		jadwal, err := loadJadwal()
		if err != nil {
			time.Sleep(sleepSec)
			continue
		}

		mj, ok := jadwal[mode]
		if !ok {
			time.Sleep(sleepSec)
			continue
		}

		entries, ok := mj[hari]
		if !ok {
			time.Sleep(sleepSec)
			continue
		}

		waktu := now.Format("15:04")
		for _, e := range entries {
			key := mode + "|" + hari + "|" + e.Waktu
			if waktu == e.Waktu && !played[key] {
				logMsg(fmt.Sprintf("[%s] %s [%s]", mode, filepath.Base(e.Audio), e.Waktu))
				playSound(e.Audio)
				played[key] = true
				writeLog(ActivityLog{
					Time:  now.Format("2006-01-02 15:04:05"),
					Mode:  mode,
					Hari:  hari,
					Waktu: e.Waktu,
					Audio: filepath.Base(e.Audio),
				})
			}
		}

		time.Sleep(sleepSec)
	}
}

func resolveFfmpeg() string {
	candidates := []string{
		"/usr/bin/ffmpeg",
		"/usr/local/bin/ffmpeg",
		"/bin/ffmpeg",
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	if p, err := exec.LookPath("ffmpeg"); err == nil {
		return p
	}
	return ""
}

func main() {
	ffmpegPath = resolveFfmpeg()
	if ffmpegPath == "" {
		log.Fatal("ffmpeg tidak ditemukan di sistem")
	}
	logMsg("ffmpeg: " + ffmpegPath)

	for _, d := range []string{toneDir, dataDir, staticDir} {
		if err := os.MkdirAll(d, 0755); err != nil {
			log.Fatalf("gagal membuat direktori %s: %s", d, err)
		}
	}

	if err := initStorage(); err != nil {
		log.Fatalf("gagal inisialisasi storage: %s", err)
	}

	if err := initAuth(); err != nil {
		log.Fatalf("gagal inisialisasi auth: %s", err)
	}

	go runScheduler()

	mux := http.NewServeMux()
	registerRoutes(mux)

	logMsg("server berjalan di port " + port)
	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatalf("server error: %s", err)
	}
}
