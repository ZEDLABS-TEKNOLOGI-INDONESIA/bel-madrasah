package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

const jadwalFile = dataDir + "/jadwal.json"

type Entry struct {
	Waktu string `json:"waktu"`
	Audio string `json:"audio"`
}

type Jadwal map[string][]Entry

var jadwalMu sync.RWMutex

func initStorage() error {
	if _, err := os.Stat(jadwalFile); os.IsNotExist(err) {
		return saveJadwal(defaultJadwal())
	}
	return nil
}

func loadJadwal() (Jadwal, error) {
	jadwalMu.RLock()
	defer jadwalMu.RUnlock()

	data, err := os.ReadFile(jadwalFile)
	if err != nil {
		return nil, err
	}
	var j Jadwal
	if err := json.Unmarshal(data, &j); err != nil {
		return nil, err
	}
	return j, nil
}

func saveJadwal(j Jadwal) error {
	jadwalMu.Lock()
	defer jadwalMu.Unlock()

	data, err := json.MarshalIndent(j, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(jadwalFile, data, 0644)
}

func listTones() ([]string, error) {
	entries, err := os.ReadDir(toneDir)
	if err != nil {
		return nil, err
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() {
			ext := filepath.Ext(e.Name())
			if ext == ".mp3" || ext == ".wav" || ext == ".ogg" {
				files = append(files, e.Name())
			}
		}
	}
	sort.Strings(files)
	return files, nil
}

func defaultJadwal() Jadwal {
	b := toneDir
	return Jadwal{
		"Senin": {
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
		},
		"Selasa": {
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
		},
		"Rabu": {
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
		},
		"Kamis": {
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
		},
		"Jumat": {
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
		},
	}
}
