package main

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

const (
	jadwalFile  = dataDir + "/jadwal.json"
	logFile     = dataDir + "/activity.log"
	configFile  = dataDir + "/config.json"
	maxLogLines = 500
	logRotateAt = maxLogLines * 2
)

type Entry struct {
	Waktu string `json:"waktu"`
	Audio string `json:"audio"`
}

type ModeJadwal map[string]map[string][]Entry

type Config struct {
	Mode           string              `json:"mode"`
	ManualOverride bool                `json:"manual_override"`
	RamadhanStart  string              `json:"ramadhan_start"`
	RamadhanEnd    string              `json:"ramadhan_end"`
	PTSStart       string              `json:"pts_start"`
	PTSEnd         string              `json:"pts_end"`
	PASStart       string              `json:"pas_start"`
	PASEnd         string              `json:"pas_end"`
	PesantrenStart string              `json:"pesantren_start"`
	PesantrenEnd   string              `json:"pesantren_end"`
	LiburDates     []LiburDate         `json:"libur_dates"`
	Volume         float64             `json:"volume"`
	DisabledDays   map[string][]string `json:"disabled_days"`
}

type LiburDate struct {
	Date       string `json:"date"`
	Keterangan string `json:"keterangan"`
}

type ActivityLog struct {
	Time  string `json:"time"`
	Mode  string `json:"mode"`
	Hari  string `json:"hari"`
	Waktu string `json:"waktu"`
	Audio string `json:"audio"`
}

var (
	jadwalMu sync.RWMutex
	configMu sync.RWMutex
	logMu    sync.Mutex
	logCount int
)

var AllHari = []string{"Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"}
var AllModes = []string{"reguler", "ramadhan", "pts", "pas", "pesantren", "lainnya"}

func defaultConfig() Config {
	return Config{
		Mode:         "reguler",
		Volume:       0.85,
		LiburDates:   []LiburDate{},
		DisabledDays: map[string][]string{},
	}
}

func loadConfig() (Config, error) {
	configMu.RLock()
	defer configMu.RUnlock()

	data, err := os.ReadFile(configFile)
	if err != nil {
		return defaultConfig(), nil
	}
	var c Config
	if err := json.Unmarshal(data, &c); err != nil {
		return defaultConfig(), nil
	}
	if c.LiburDates == nil {
		c.LiburDates = []LiburDate{}
	}
	if c.DisabledDays == nil {
		c.DisabledDays = map[string][]string{}
	}
	if c.Volume == 0 {
		c.Volume = 0.85
	}
	return c, nil
}

func saveConfig(c Config) error {
	configMu.Lock()
	defer configMu.Unlock()
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return atomicWrite(configFile, data, 0644)
}

func resolveMode(c Config) string {
	if c.ManualOverride {
		return c.Mode
	}
	today := time.Now().Format("2006-01-02")
	if c.PTSStart != "" && c.PTSEnd != "" && today >= c.PTSStart && today <= c.PTSEnd {
		return "pts"
	}
	if c.PASStart != "" && c.PASEnd != "" && today >= c.PASStart && today <= c.PASEnd {
		return "pas"
	}
	if c.PesantrenStart != "" && c.PesantrenEnd != "" && today >= c.PesantrenStart && today <= c.PesantrenEnd {
		return "pesantren"
	}
	if c.RamadhanStart != "" && c.RamadhanEnd != "" && today >= c.RamadhanStart && today <= c.RamadhanEnd {
		return "ramadhan"
	}
	return "reguler"
}

func isLibur(c Config) bool {
	today := time.Now().Format("2006-01-02")
	for _, d := range c.LiburDates {
		if d.Date == today {
			return true
		}
	}
	return false
}

func isDayDisabled(c Config, mode, hari string) bool {
	days, ok := c.DisabledDays[mode]
	if !ok {
		return false
	}
	for _, d := range days {
		if d == hari {
			return true
		}
	}
	return false
}

func loadJadwal() (ModeJadwal, error) {
	jadwalMu.RLock()
	defer jadwalMu.RUnlock()

	data, err := os.ReadFile(jadwalFile)
	if err != nil {
		return nil, err
	}
	var j ModeJadwal
	if err := json.Unmarshal(data, &j); err != nil {
		return nil, err
	}
	if j == nil {
		j = make(ModeJadwal)
	}
	for _, m := range AllModes {
		if j[m] == nil {
			j[m] = map[string][]Entry{}
		}
		for _, h := range AllHari {
			if j[m][h] == nil {
				j[m][h] = []Entry{}
			}
		}
	}
	return j, nil
}

func saveJadwal(j ModeJadwal) error {
	jadwalMu.Lock()
	defer jadwalMu.Unlock()
	data, err := json.MarshalIndent(j, "", "  ")
	if err != nil {
		return err
	}
	return atomicWrite(jadwalFile, data, 0644)
}

func atomicWrite(path string, data []byte, perm os.FileMode) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, perm); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

func copyEntries(src []Entry) []Entry {
	dst := make([]Entry, len(src))
	copy(dst, src)
	return dst
}

func initStorage() error {
	if _, err := os.Stat(configFile); os.IsNotExist(err) {
		if err := saveConfig(defaultConfig()); err != nil {
			return err
		}
	}
	initLogCount()

	dj := defaultJadwal()
	data, err := os.ReadFile(jadwalFile)
	if err != nil {
		logMsg("jadwal.json tidak ditemukan, membuat default")
		return saveJadwal(dj)
	}
	var j ModeJadwal
	if err := json.Unmarshal(data, &j); err != nil || j == nil {
		logMsg("jadwal.json tidak valid, menulis ulang")
		return saveJadwal(dj)
	}

	changed := false
	for _, m := range AllModes {
		if j[m] == nil {
			j[m] = dj[m]
			changed = true
		}
		for _, h := range AllHari {
			if j[m][h] == nil {
				j[m][h] = []Entry{}
				changed = true
			}
		}
	}
	if changed {
		return saveJadwal(j)
	}
	return nil
}

func listTones() ([]string, error) {
	entries, err := os.ReadDir(toneDir)
	if err != nil {
		return nil, err
	}
	var files []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		ext := filepath.Ext(e.Name())
		if ext == ".mp3" || ext == ".wav" || ext == ".ogg" {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)
	return files, nil
}

func splitLogLines(data []byte) [][]byte {
	var lines [][]byte
	start := 0
	for i, b := range data {
		if b == '\n' {
			if line := data[start:i]; len(line) > 0 {
				lines = append(lines, line)
			}
			start = i + 1
		}
	}
	if start < len(data) {
		if line := data[start:]; len(line) > 0 {
			lines = append(lines, line)
		}
	}
	return lines
}

func initLogCount() {
	logMu.Lock()
	defer logMu.Unlock()
	data, err := os.ReadFile(logFile)
	if err != nil {
		logCount = 0
		return
	}
	lines := splitLogLines(data)
	logCount = len(lines)
	if logCount > logRotateAt {
		rotateLogLocked(lines)
	}
}

func rotateLogLocked(lines [][]byte) {
	if len(lines) <= maxLogLines {
		logCount = len(lines)
		return
	}
	trimmed := lines[len(lines)-maxLogLines:]
	var buf bytes.Buffer
	for _, l := range trimmed {
		buf.Write(l)
		buf.WriteByte('\n')
	}
	if err := atomicWrite(logFile, buf.Bytes(), 0644); err != nil {
		logMsg("gagal rotasi log: " + err.Error())
		return
	}
	logCount = maxLogLines
}

func writeLog(entry ActivityLog) {
	logMu.Lock()
	defer logMu.Unlock()

	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	line, _ := json.Marshal(entry)
	_, _ = f.Write(append(line, '\n'))
	_ = f.Close()

	logCount++
	if logCount > logRotateAt {
		data, err := os.ReadFile(logFile)
		if err != nil {
			return
		}
		rotateLogLocked(splitLogLines(data))
	}
}

func resetLog() error {
	logMu.Lock()
	defer logMu.Unlock()
	if err := os.WriteFile(logFile, []byte{}, 0644); err != nil {
		return err
	}
	logCount = 0
	return nil
}

func readLog() ([]ActivityLog, error) {
	logMu.Lock()
	defer logMu.Unlock()

	data, err := os.ReadFile(logFile)
	if err != nil {
		if os.IsNotExist(err) {
			return []ActivityLog{}, nil
		}
		return nil, err
	}

	lines := splitLogLines(data)
	var logs []ActivityLog
	for _, line := range lines {
		var l ActivityLog
		if json.Unmarshal(line, &l) == nil {
			logs = append(logs, l)
		}
	}

	if len(logs) > maxLogLines {
		logs = logs[len(logs)-maxLogLines:]
	}
	for i, j := 0, len(logs)-1; i < j; i, j = i+1, j-1 {
		logs[i], logs[j] = logs[j], logs[i]
	}
	return logs, nil
}

func defaultJadwal() ModeJadwal {
	b := toneDir
	j := make(ModeJadwal)
	for _, m := range AllModes {
		j[m] = map[string][]Entry{}
		for _, h := range AllHari {
			j[m][h] = []Entry{}
		}
	}
	j["reguler"]["Senin"] = []Entry{
		{Waktu: "06:44", Audio: b + "/sholawat.mp3"},
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/upacara.mp3"},
		{Waktu: "08:10", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "08:50", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:30", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "10:00", Audio: b + "/indonesia-raya.mp3"},
		{Waktu: "10:10", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "10:20", Audio: b + "/kebersihan.mp3"},
		{Waktu: "10:30", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "11:10", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:50", Audio: b + "/istirahat-2.mp3"},
		{Waktu: "12:30", Audio: b + "/kebersihan.mp3"},
		{Waktu: "12:40", Audio: b + "/pelajaran-7.mp3"},
		{Waktu: "13:20", Audio: b + "/pelajaran-8.mp3"},
		{Waktu: "14:00", Audio: b + "/pelajaran-9.mp3"},
		{Waktu: "14:40", Audio: b + "/pelajaran-10.mp3"},
		{Waktu: "15:20", Audio: b + "/pelajaran-selesai.mp3"},
		{Waktu: "15:21", Audio: b + "/tanah-airku.mp3"},
		{Waktu: "16:30", Audio: b + "/hymne-madrasah.mp3"},
	}
	j["reguler"]["Selasa"] = []Entry{
		{Waktu: "06:44", Audio: b + "/sholawat.mp3"},
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
		{Waktu: "08:10", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "08:50", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:30", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "10:10", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "10:20", Audio: b + "/kebersihan.mp3"},
		{Waktu: "10:30", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "11:10", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:50", Audio: b + "/istirahat-2.mp3"},
		{Waktu: "12:30", Audio: b + "/kebersihan.mp3"},
		{Waktu: "12:40", Audio: b + "/pelajaran-7.mp3"},
		{Waktu: "13:20", Audio: b + "/pelajaran-8.mp3"},
		{Waktu: "14:00", Audio: b + "/pelajaran-9.mp3"},
		{Waktu: "14:40", Audio: b + "/pelajaran-10.mp3"},
		{Waktu: "15:20", Audio: b + "/pelajaran-selesai.mp3"},
		{Waktu: "15:21", Audio: b + "/tanah-airku.mp3"},
		{Waktu: "16:30", Audio: b + "/hymne-madrasah.mp3"},
	}
	j["reguler"]["Rabu"] = copyEntries(j["reguler"]["Selasa"])
	j["reguler"]["Kamis"] = []Entry{
		{Waktu: "06:44", Audio: b + "/sholawat.mp3"},
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/literasi.mp3"},
		{Waktu: "08:10", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "08:50", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:30", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "10:00", Audio: b + "/indonesia-raya.mp3"},
		{Waktu: "10:10", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "10:20", Audio: b + "/kebersihan.mp3"},
		{Waktu: "10:30", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "11:10", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:50", Audio: b + "/istirahat-2.mp3"},
		{Waktu: "12:30", Audio: b + "/kebersihan.mp3"},
		{Waktu: "12:40", Audio: b + "/pelajaran-7.mp3"},
		{Waktu: "13:20", Audio: b + "/pelajaran-8.mp3"},
		{Waktu: "14:00", Audio: b + "/pelajaran-9.mp3"},
		{Waktu: "14:40", Audio: b + "/pelajaran-10.mp3"},
		{Waktu: "15:20", Audio: b + "/pelajaran-selesai.mp3"},
		{Waktu: "15:21", Audio: b + "/tanah-airku.mp3"},
		{Waktu: "16:30", Audio: b + "/hymne-madrasah.mp3"},
	}
	j["reguler"]["Jumat"] = []Entry{
		{Waktu: "06:44", Audio: b + "/sholawat.mp3"},
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/rohani.mp3"},
		{Waktu: "08:10", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "08:50", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "09:30", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "09:40", Audio: b + "/kebersihan.mp3"},
		{Waktu: "10:10", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "10:40", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:20", Audio: b + "/istirahat-2.mp3"},
		{Waktu: "12:50", Audio: b + "/pelajaran-7.mp3"},
		{Waktu: "13:30", Audio: b + "/pelajaran-8.mp3"},
		{Waktu: "14:10", Audio: b + "/akhir-pekan.mp3"},
		{Waktu: "14:11", Audio: b + "/tanah-airku.mp3"},
		{Waktu: "14:12", Audio: b + "/pramuka.mp3"},
		{Waktu: "16:00", Audio: b + "/hymne-madrasah.mp3"},
	}
	j["ramadhan"]["Senin"] = []Entry{
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/upacara.mp3"},
		{Waktu: "07:40", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "08:20", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:00", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "09:30", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "09:40", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "10:20", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:00", Audio: b + "/pelajaran-selesai.mp3"},
		{Waktu: "11:01", Audio: b + "/tanah-airku.mp3"},
	}
	j["ramadhan"]["Selasa"] = []Entry{
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:10", Audio: b + "/pelajaran-1.mp3"},
		{Waktu: "07:50", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "08:30", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:10", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "09:40", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "09:50", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "10:30", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:00", Audio: b + "/pelajaran-selesai.mp3"},
		{Waktu: "11:01", Audio: b + "/tanah-airku.mp3"},
	}
	j["ramadhan"]["Rabu"] = copyEntries(j["ramadhan"]["Selasa"])
	j["ramadhan"]["Kamis"] = []Entry{
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/literasi.mp3"},
		{Waktu: "07:40", Audio: b + "/pelajaran-2.mp3"},
		{Waktu: "08:20", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "09:00", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "09:30", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "09:40", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "10:20", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "11:00", Audio: b + "/pelajaran-selesai.mp3"},
		{Waktu: "11:01", Audio: b + "/tanah-airku.mp3"},
	}
	j["ramadhan"]["Jumat"] = []Entry{
		{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
		{Waktu: "07:00", Audio: b + "/rohani.mp3"},
		{Waktu: "07:40", Audio: b + "/pelajaran-3.mp3"},
		{Waktu: "08:20", Audio: b + "/pelajaran-4.mp3"},
		{Waktu: "09:00", Audio: b + "/istirahat-1.mp3"},
		{Waktu: "09:10", Audio: b + "/pelajaran-5.mp3"},
		{Waktu: "09:50", Audio: b + "/pelajaran-6.mp3"},
		{Waktu: "10:20", Audio: b + "/akhir-pekan.mp3"},
		{Waktu: "10:21", Audio: b + "/tanah-airku.mp3"},
	}

	ptsEntry := func(hari string) []Entry {
		if hari == "Jumat" {
			return []Entry{
				{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
				{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
				{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
				{Waktu: "09:30", Audio: b + "/pelajaran-selesai.mp3"},
				{Waktu: "09:31", Audio: b + "/tanah-airku.mp3"},
			}
		}
		return []Entry{
			{Waktu: "06:50", Audio: b + "/mars-madrasah.mp3"},
			{Waktu: "07:30", Audio: b + "/pelajaran-1.mp3"},
			{Waktu: "08:30", Audio: b + "/pelajaran-2.mp3"},
			{Waktu: "09:30", Audio: b + "/pelajaran-3.mp3"},
			{Waktu: "10:30", Audio: b + "/pelajaran-selesai.mp3"},
			{Waktu: "10:31", Audio: b + "/tanah-airku.mp3"},
		}
	}
	for _, h := range []string{"Senin", "Selasa", "Rabu", "Kamis", "Jumat"} {
		j["pts"][h] = ptsEntry(h)
		j["pas"][h] = ptsEntry(h)
	}
	return j
}
