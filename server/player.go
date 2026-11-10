package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"
)

var (
	ffmpegPath string

	activeProcs  []*exec.Cmd
	procMu       sync.Mutex
	nowPlaying   string
	nowPlayingMu sync.Mutex
)

func playSound(filePath string) {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		logMsg("file tidak ditemukan: " + filePath)
		return
	}
	stopAllProcs()

	nowPlayingMu.Lock()
	nowPlaying = filePath
	nowPlayingMu.Unlock()

	cfg, err := loadConfig()
	if err != nil {
		cfg = defaultConfig()
	}
	cmd := exec.Command(ffmpegPath,
		"-hide_banner", "-loglevel", "error",
		"-i", filePath,
		"-filter:a", audioFilterChain(cfg),
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
