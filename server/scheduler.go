package main

import (
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const sleepSec = 20 * time.Second

var (
	schedulerRunning = true
	schedulerMu      sync.Mutex
)

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

func sleepOrStop(stop <-chan struct{}, d time.Duration) bool {
	select {
	case <-stop:
		return false
	case <-time.After(d):
		return true
	}
}

func playedKey(mode, hari, waktu string) string {
	return mode + "|" + hari + "|" + waktu
}

func playedToday(logs []ActivityLog, now time.Time) map[string]bool {
	today := now.Format("2006-01-02")
	played := map[string]bool{}
	for _, l := range logs {
		if strings.HasPrefix(l.Time, today) {
			played[playedKey(l.Mode, l.Hari, l.Waktu)] = true
		}
	}
	return played
}

func runScheduler(stop <-chan struct{}) {
	logMsg("scheduler dimulai")
	played := map[string]bool{}
	if logs, err := readLog(); err == nil {
		played = playedToday(logs, time.Now())
		if len(played) > 0 {
			logMsg(fmt.Sprintf("%d bel hari ini sudah berbunyi, tidak diulang", len(played)))
		}
	}
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
			key := playedKey(mode, hari, e.Waktu)
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
