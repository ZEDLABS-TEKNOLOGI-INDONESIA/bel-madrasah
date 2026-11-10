package main

import (
	"encoding/json"
	"os"
	"sync"
)

type Entry struct {
	Waktu string `json:"waktu"`
	Audio string `json:"audio"`
}

type ModeJadwal map[string]map[string][]Entry

var jadwalMu sync.RWMutex

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

func updateJadwal(fn func(ModeJadwal) bool) error {
	jadwalMu.Lock()
	defer jadwalMu.Unlock()
	data, err := os.ReadFile(jadwalFile)
	if err != nil {
		return err
	}
	var j ModeJadwal
	if err := json.Unmarshal(data, &j); err != nil {
		return err
	}
	if !fn(j) {
		return nil
	}
	out, err := json.MarshalIndent(j, "", "  ")
	if err != nil {
		return err
	}
	return atomicWrite(jadwalFile, out, 0644)
}

func replaceAudioPath(j ModeJadwal, from, to string) int {
	n := 0
	for _, days := range j {
		for _, entries := range days {
			for i := range entries {
				if entries[i].Audio == from {
					entries[i].Audio = to
					n++
				}
			}
		}
	}
	return n
}

func copyEntries(src []Entry) []Entry {
	dst := make([]Entry, len(src))
	copy(dst, src)
	return dst
}
