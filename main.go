package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"
)

const (
	port      = ":8082"
	toneDir   = "/opt/bel-madrasah/tone"
	dataDir   = "/opt/bel-madrasah/data"
	staticDir = "/opt/bel-madrasah/static"
	sleepSec  = 20 * time.Second
)

var (
	ffmpegPath string

	activeProcs  []*exec.Cmd
	procMu       sync.Mutex
	nowPlaying   string
	nowPlayingMu sync.Mutex

	schedulerRunning = true
	schedulerMu      sync.Mutex
)

func logMsg(msg string) {
	fmt.Printf("[%s] %s\n", time.Now().Format("2006-01-02 15:04:05"), msg)
}

func getHari() string {
	days := map[time.Weekday]string{
		time.Monday:    "Senin",
		time.Tuesday:   "Selasa",
		time.Wednesday: "Rabu",
		time.Thursday:  "Kamis",
		time.Friday:    "Jumat",
		time.Saturday:  "Sabtu",
		time.Sunday:    "Minggu",
	}
	return days[time.Now().Weekday()]
}

func stopAllProcs() {
	procMu.Lock()
	procs := make([]*exec.Cmd, len(activeProcs))
	copy(procs, activeProcs)
	activeProcs = nil
	procMu.Unlock()

	nowPlayingMu.Lock()
	nowPlaying = ""
	nowPlayingMu.Unlock()

	for _, p := range procs {
		if p != nil && p.Process != nil && p.ProcessState == nil {
			_ = p.Process.Kill()
			_ = p.Wait()
		}
	}
	time.Sleep(150 * time.Millisecond)
}

func alsaDevice() string {
	if d := os.Getenv("BEL_ALSA_DEVICE"); d != "" {
		return d
	}
	return "hw:1,0"
}

func volumeString() string {
	cfg, err := loadConfig()
	if err != nil || cfg.Volume == 0 {
		return "0.85"
	}
	return fmt.Sprintf("%.2f", cfg.Volume)
}

func playSound(filePath string) {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		logMsg("file tidak ditemukan: " + filePath)
		return
	}
	stopAllProcs()

	nowPlayingMu.Lock()
	nowPlaying = filePath
	nowPlayingMu.Unlock()

	vol := volumeString()
	cmd := exec.Command(ffmpegPath,
		"-hide_banner", "-loglevel", "error",
		"-i", filePath,
		"-filter:a", "volume="+vol,
		"-f", "alsa", alsaDevice(),
	)
	if err := cmd.Start(); err != nil {
		logMsg("gagal memutar audio: " + err.Error())
		nowPlayingMu.Lock()
		nowPlaying = ""
		nowPlayingMu.Unlock()
		return
	}

	procMu.Lock()
	activeProcs = append(activeProcs, cmd)
	procMu.Unlock()

	go func() {
		_ = cmd.Wait()
		nowPlayingMu.Lock()
		if nowPlaying == filePath {
			nowPlaying = ""
		}
		nowPlayingMu.Unlock()

		procMu.Lock()
		alive := activeProcs[:0]
		for _, p := range activeProcs {
			if p != nil && p.ProcessState == nil {
				alive = append(alive, p)
			}
		}
		activeProcs = alive
		procMu.Unlock()
	}()
}

func isAudioPlaying() bool {
	procMu.Lock()
	defer procMu.Unlock()
	for _, p := range activeProcs {
		if p != nil && p.ProcessState == nil {
			return true
		}
	}
	return false
}

func getNowPlaying() string {
	nowPlayingMu.Lock()
	defer nowPlayingMu.Unlock()
	if nowPlaying == "" {
		return ""
	}
	return filepath.Base(nowPlaying)
}

func sleepOrStop(stop <-chan struct{}, d time.Duration) bool {
	select {
	case <-stop:
		return false
	case <-time.After(d):
		return true
	}
}

func runScheduler(stop <-chan struct{}) {
	logMsg("scheduler dimulai")
	played := make(map[string]bool)
	lastDay := ""
	lastWeeklyClean := time.Now()

	for {
		select {
		case <-stop:
			logMsg("scheduler dihentikan")
			return
		default:
		}

		if time.Since(lastWeeklyClean) >= 7*24*time.Hour {
			if err := resetLog(); err != nil {
				logMsg("gagal auto-cleanup log: " + err.Error())
			} else {
				logMsg("auto-cleanup log mingguan selesai")
			}
			lastWeeklyClean = time.Now()
		}

		schedulerMu.Lock()
		running := schedulerRunning
		schedulerMu.Unlock()

		if !running {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
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

		cfg, err := loadConfig()
		if err != nil {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}

		if isLibur(cfg) {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}

		mode := resolveMode(cfg)

		if mode == "lainnya" || mode == "pesantren" {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}

		if isDayDisabled(cfg, mode, hari) {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}

		jadwal, err := loadJadwal()
		if err != nil {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}

		mj, ok := jadwal[mode]
		if !ok {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}

		entries, ok := mj[hari]
		if !ok {
			if !sleepOrStop(stop, sleepSec) {
				return
			}
			continue
		}

		waktu := now.Format("15:04")
		for _, e := range entries {
			key := mode + "|" + hari + "|" + e.Waktu
			if waktu == e.Waktu && !played[key] {
				logMsg(fmt.Sprintf("[%s] %s [%s]", mode, filepath.Base(e.Audio), e.Waktu))
				go playSound(e.Audio)
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

		if !sleepOrStop(stop, sleepSec) {
			return
		}
	}
}

func resolveFfmpeg() string {
	for _, p := range []string{
		"/usr/bin/ffmpeg",
		"/usr/local/bin/ffmpeg",
		"/bin/ffmpeg",
	} {
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
	logMsg("alsa device: " + alsaDevice())

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

	stopScheduler := make(chan struct{})
	go runScheduler(stopScheduler)

	mux := http.NewServeMux()
	registerRoutes(mux)

	allowedOrigins := trustedOrigins()
	handler := corsMiddleware(allowedOrigins, maxBodyMiddleware(mux))

	srv := &http.Server{
		Addr:              port,
		Handler:           handler,
		ReadTimeout:       15 * time.Second,
		ReadHeaderTimeout: 10 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		logMsg("server berjalan di port " + port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErr <- err
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-serverErr:
		log.Fatalf("server error: %s", err)
	case sig := <-sigCh:
		logMsg("menerima sinyal " + sig.String() + ", memulai shutdown")
	}

	close(stopScheduler)
	stopAllProcs()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logMsg("gagal shutdown server: " + err.Error())
	}
	logMsg("server dihentikan")
}
