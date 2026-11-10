package main

import (
	"testing"
	"time"
)

func TestPlayedTodaySurvivesRestart(t *testing.T) {
	now := time.Date(2026, 11, 10, 7, 0, 30, 0, time.Local)
	logs := []ActivityLog{
		{Time: "2026-11-10 07:00:05", Mode: "reguler", Hari: "Selasa", Waktu: "07:00"},
		{Time: "2026-11-09 07:00:05", Mode: "reguler", Hari: "Senin", Waktu: "07:00"},
	}
	played := playedToday(logs, now)
	if !played[playedKey("reguler", "Selasa", "07:00")] {
		t.Fatal("bel hari ini tidak dianggap sudah berbunyi")
	}
	if played[playedKey("reguler", "Senin", "07:00")] || len(played) != 1 {
		t.Fatalf("bel hari lain ikut terhitung: %v", played)
	}
}
