package main

import (
	"os"
	"path/filepath"
)

const defaultBaseDir = "/opt/bel-madrasah"

var (
	baseDir      string
	toneDir      string
	dataDir      string
	staticDir    string
	jadwalFile   string
	logFile      string
	configFile   string
	usersFile    string
	sessionsFile string
	holidaysFile string
)

func setBaseDir(dir string) {
	baseDir = filepath.Clean(dir)
	toneDir = filepath.Join(baseDir, "tone")
	dataDir = filepath.Join(baseDir, "data")
	staticDir = filepath.Join(baseDir, "static")
	jadwalFile = filepath.Join(dataDir, "jadwal.json")
	logFile = filepath.Join(dataDir, "activity.log")
	configFile = filepath.Join(dataDir, "config.json")
	usersFile = filepath.Join(dataDir, "users.json")
	sessionsFile = filepath.Join(dataDir, "sessions.json")
	holidaysFile = filepath.Join(dataDir, "holidays.json")
}

func init() {
	dir := os.Getenv("BEL_BASE_DIR")
	if dir == "" {
		dir = defaultBaseDir
	}
	setBaseDir(dir)
}
