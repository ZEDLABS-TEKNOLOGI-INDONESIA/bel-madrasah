package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"
)

const sampleICS = "BEGIN:VCALENDAR\r\n" +
	"BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260321\r\nDTEND;VALUE=DATE:20260323\r\n" +
	"SUMMARY:Hari Idul Fitri\r\nDESCRIPTION:Hari libur nasional\\nUntuk menyembunyikan\r\nEND:VEVENT\r\n" +
	"BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260320\r\nDTEND;VALUE=DATE:20260321\r\n" +
	"SUMMARY:Cuti Bersama Idul\r\n  Fitri\r\nDESCRIPTION:Hari libur nasional\r\nEND:VEVENT\r\n" +
	"BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260219\r\nDTEND;VALUE=DATE:20260220\r\n" +
	"SUMMARY:1 Ramadan\r\nDESCRIPTION:Perayaan\\nUntuk menyembunyikan perayaan\r\nEND:VEVENT\r\n" +
	"BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20270101\r\nDTEND;VALUE=DATE:20270102\r\n" +
	"SUMMARY:Hari Tahun Baru\\, Masehi\r\nDESCRIPTION:Hari libur nasional\r\nEND:VEVENT\r\n" +
	"END:VCALENDAR\r\n"

func TestParseHolidayICS(t *testing.T) {
	byYear := parseHolidayICS(sampleICS)
	got := byYear[2026]
	want := []liburNasionalItem{
		{"2026-03-20", "Cuti Bersama Idul Fitri", false},
		{"2026-03-21", "Hari Idul Fitri", true},
		{"2026-03-22", "Hari Idul Fitri", true},
	}
	if len(got) != len(want) {
		t.Fatalf("2026: %+v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("item %d = %+v, want %+v", i, got[i], want[i])
		}
	}
	if y := byYear[2027]; len(y) != 1 || y[0].Name != "Hari Tahun Baru, Masehi" {
		t.Fatalf("2027: %+v", y)
	}
}

func withProviders(t *testing.T, providers ...holidayProvider) {
	t.Helper()
	saved := holidayProviders
	holidayProviders = providers
	holidayCache.Lock()
	holidayCache.loaded = false
	holidayCache.years = map[int]holidaySet{}
	holidayCache.Unlock()
	t.Cleanup(func() { holidayProviders = saved })
}

func staticProvider(name string, data map[int][]liburNasionalItem, err error, calls *int) holidayProvider {
	return holidayProvider{name, func(context.Context, int) (map[int][]liburNasionalItem, error) {
		*calls++
		return data, err
	}}
}

func TestNationalHolidaysFallbackCacheAndStale(t *testing.T) {
	setupTestDir(t)
	down, backup := 0, 0
	items := []liburNasionalItem{{"2026-08-17", "Hari Proklamasi", true}}
	withProviders(t,
		staticProvider("utama", nil, errors.New("status 503"), &down),
		staticProvider("cadangan", map[int][]liburNasionalItem{2026: items}, nil, &backup),
	)

	set, stale, err := nationalHolidays(context.Background(), 2026)
	if err != nil || stale || set.Source != "cadangan" || len(set.Items) != 1 {
		t.Fatalf("fallback: %+v stale=%v err=%v", set, stale, err)
	}
	if _, _, _ = nationalHolidays(context.Background(), 2026); down != 1 || backup != 1 {
		t.Fatalf("cache segar tidak dipakai: utama=%d cadangan=%d", down, backup)
	}

	withProviders(t, staticProvider("utama", nil, errors.New("status 503"), &down))
	var onDisk map[int]holidaySet
	data, _ := os.ReadFile(holidaysFile)
	if err := json.Unmarshal(data, &onDisk); err != nil || len(onDisk[2026].Items) != 1 {
		t.Fatalf("cache tidak tersimpan ke disk: %s", data)
	}
	expired := onDisk[2026]
	expired.FetchedAt = time.Now().Add(-2 * holidayTTL)
	onDisk[2026] = expired
	data, _ = json.Marshal(onDisk)
	_ = os.WriteFile(holidaysFile, data, 0644)
	set, stale, err = nationalHolidays(context.Background(), 2026)
	if err != nil || !stale || len(set.Items) != 1 {
		t.Fatalf("data lama dari disk harus dipakai saat semua sumber mati: %+v stale=%v err=%v", set, stale, err)
	}
}

func TestNationalHolidaysAllDownAndUnknownYear(t *testing.T) {
	setupTestDir(t)
	n := 0
	withProviders(t, staticProvider("utama", nil, errors.New("status 503"), &n))
	if _, _, err := nationalHolidays(context.Background(), 2026); err == nil {
		t.Fatal("semua sumber mati tanpa cache harus galat")
	}

	withProviders(t, staticProvider("utama", map[int][]liburNasionalItem{2026: {{"2026-01-01", "Tahun Baru", true}}}, nil, &n))
	set, stale, err := nationalHolidays(context.Background(), 2099)
	if err != nil || stale || len(set.Items) != 0 {
		t.Fatalf("tahun yang tidak ada di sumber harus kosong tanpa galat: %+v %v %v", set, stale, err)
	}
}

func TestLiburNasionalHandlerShape(t *testing.T) {
	setupTestDir(t)
	n := 0
	withProviders(t, staticProvider("Google Kalender", parseHolidayICS(sampleICS), nil, &n))
	rec := httptest.NewRecorder()
	handleLiburNasional(rec, httptest.NewRequest(http.MethodGet, "/api/libur/nasional?year=2026", nil))
	var res struct {
		Holidays []liburNasionalItem `json:"holidays"`
		Source   string              `json:"source"`
		Stale    bool                `json:"stale"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil || rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if res.Source != "Google Kalender" || len(res.Holidays) != 3 || res.Stale {
		t.Fatalf("respons %+v", res)
	}

	withProviders(t, staticProvider("utama", nil, errors.New("status 503"), &n))
	rec = httptest.NewRecorder()
	handleLiburNasional(rec, httptest.NewRequest(http.MethodGet, "/api/libur/nasional?year=2030", nil))
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("semua sumber mati harus 502, dapat %d", rec.Code)
	}
}
