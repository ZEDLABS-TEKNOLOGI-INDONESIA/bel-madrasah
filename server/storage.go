package main

import (
	"encoding/json"
	"os"
)

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

func atomicWrite(path string, data []byte, perm os.FileMode) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, perm); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
