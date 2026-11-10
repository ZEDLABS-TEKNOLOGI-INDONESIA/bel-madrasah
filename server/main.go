package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"syscall"
	"time"
)

func logMsg(msg string) {
	fmt.Printf("[%s] %s\n", time.Now().Format("2006-01-02 15:04:05"), msg)
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
	port := os.Getenv("BEL_PORT")
	if port == "" {
		port = ":8083"
	} else if port[0] != ':' {
		port = ":" + port
	}
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
