package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	googleHolidayICS = "https://calendar.google.com/calendar/ical/id.indonesian%23holiday%40group.v.calendar.google.com/public/basic.ics"
	kemendesaURL     = "https://api.kemendesa.link/libur-nasional/api/holidays/%d.json"
	holidayTTL       = 12 * time.Hour
)

type liburNasionalItem struct {
	Date              string `json:"date"`
	Name              string `json:"name"`
	IsNationalHoliday bool   `json:"is_national_holiday"`
}

type holidaySet struct {
	Source    string              `json:"source"`
	FetchedAt time.Time           `json:"fetched_at"`
	Items     []liburNasionalItem `json:"items"`
}

type holidayProvider struct {
	name  string
	fetch func(ctx context.Context, year int) (map[int][]liburNasionalItem, error)
}

var errNoHolidayData = errors.New("tahun tidak tersedia di sumber")

var holidayProviders = []holidayProvider{
	{"Google Kalender", fetchGoogleHolidays},
	{"api.kemendesa.link", fetchKemendesaHolidays},
}

var holidayHTTP = &http.Client{Timeout: 10 * time.Second}

var holidayCache = struct {
	sync.Mutex
	loaded bool
	years  map[int]holidaySet
}{years: map[int]holidaySet{}}

func httpGetBody(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := holidayHTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, errNoHolidayData
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 2<<20))
}

func fetchGoogleHolidays(ctx context.Context, _ int) (map[int][]liburNasionalItem, error) {
	body, err := httpGetBody(ctx, googleHolidayICS)
	if err != nil {
		return nil, err
	}
	byYear := parseHolidayICS(string(body))
	if len(byYear) == 0 {
		return nil, errors.New("kalender kosong atau format tidak dikenali")
	}
	return byYear, nil
}

type kemendesaHoliday struct {
	Date          string `json:"date"`
	Name          string `json:"name"`
	IsCutiBersama bool   `json:"is_cuti_bersama"`
}

func parseKemendesaHolidays(body []byte) ([]kemendesaHoliday, error) {
	var list []kemendesaHoliday
	if err := json.Unmarshal(body, &list); err == nil {
		return list, nil
	}
	var wrapped struct {
		Data []kemendesaHoliday `json:"data"`
	}
	if err := json.Unmarshal(body, &wrapped); err != nil {
		return nil, err
	}
	return wrapped.Data, nil
}

func fetchKemendesaHolidays(ctx context.Context, year int) (map[int][]liburNasionalItem, error) {
	body, err := httpGetBody(ctx, fmt.Sprintf(kemendesaURL, year))
	if err != nil {
		return nil, err
	}
	raw, err := parseKemendesaHolidays(body)
	if err != nil {
		return nil, fmt.Errorf("format tidak dikenali: %w", err)
	}
	items := make([]liburNasionalItem, 0, len(raw))
	for _, h := range raw {
		if _, err := time.Parse("2006-01-02", h.Date); err != nil {
			continue
		}
		items = append(items, liburNasionalItem{Date: h.Date, Name: h.Name, IsNationalHoliday: !h.IsCutiBersama})
	}
	sortHolidays(items)
	return map[int][]liburNasionalItem{year: items}, nil
}

var icsUnescape = strings.NewReplacer(`\n`, "\n", `\N`, "\n", `\,`, ",", `\;`, ";", `\\`, `\`)

var icsDate = regexp.MustCompile(`(\d{8})`)

func parseHolidayICS(data string) map[int][]liburNasionalItem {
	data = strings.ReplaceAll(data, "\r\n", "\n")
	data = strings.ReplaceAll(data, "\n ", "")
	data = strings.ReplaceAll(data, "\n\t", "")

	byYear := map[int][]liburNasionalItem{}
	seen := map[string]bool{}
	var start, end, summary, desc string
	inEvent := false

	for _, line := range strings.Split(data, "\n") {
		line = strings.TrimRight(line, "\r")
		switch {
		case line == "BEGIN:VEVENT":
			inEvent = true
			start, end, summary, desc = "", "", "", ""
		case line == "END:VEVENT":
			inEvent = false
			addICSEvent(byYear, seen, start, end, summary, desc)
		case !inEvent:
		case strings.HasPrefix(line, "DTSTART"):
			start = icsDate.FindString(line)
		case strings.HasPrefix(line, "DTEND"):
			end = icsDate.FindString(line)
		case strings.HasPrefix(line, "SUMMARY"):
			summary = icsUnescape.Replace(line[strings.Index(line, ":")+1:])
		case strings.HasPrefix(line, "DESCRIPTION"):
			desc = icsUnescape.Replace(line[strings.Index(line, ":")+1:])
		}
	}
	for y := range byYear {
		sortHolidays(byYear[y])
	}
	return byYear
}

func addICSEvent(byYear map[int][]liburNasionalItem, seen map[string]bool, start, end, summary, desc string) {
	first := strings.ToLower(strings.TrimSpace(strings.SplitN(desc, "\n", 2)[0]))
	if strings.HasPrefix(first, "perayaan") || strings.HasPrefix(first, "observance") {
		return
	}
	name := strings.TrimSpace(summary)
	from, err := time.Parse("20060102", start)
	if err != nil || name == "" {
		return
	}
	to := from.AddDate(0, 0, 1)
	if t, err := time.Parse("20060102", end); err == nil && t.After(from) {
		to = t
	}
	lower := strings.ToLower(name)
	cuti := strings.Contains(lower, "cuti bersama") || strings.Contains(lower, "joint holiday")
	for d := from; d.Before(to); d = d.AddDate(0, 0, 1) {
		date := d.Format("2006-01-02")
		key := date + "|" + name
		if seen[key] {
			continue
		}
		seen[key] = true
		byYear[d.Year()] = append(byYear[d.Year()], liburNasionalItem{
			Date: date, Name: name, IsNationalHoliday: !cuti,
		})
	}
}

func sortHolidays(items []liburNasionalItem) {
	sort.SliceStable(items, func(i, j int) bool { return items[i].Date < items[j].Date })
}

func loadHolidayCacheLocked() {
	if holidayCache.loaded {
		return
	}
	holidayCache.loaded = true
	data, err := os.ReadFile(holidaysFile)
	if err != nil {
		return
	}
	var stored map[int]holidaySet
	if json.Unmarshal(data, &stored) == nil {
		for y, s := range stored {
			holidayCache.years[y] = s
		}
	}
}

func saveHolidayCacheLocked() {
	data, err := json.Marshal(holidayCache.years)
	if err != nil {
		return
	}
	if err := atomicWrite(holidaysFile, data, 0644); err != nil {
		logMsg("gagal menyimpan cache libur nasional: " + err.Error())
	}
}

func nationalHolidays(ctx context.Context, year int) (holidaySet, bool, error) {
	holidayCache.Lock()
	defer holidayCache.Unlock()
	loadHolidayCacheLocked()

	cached, hasCache := holidayCache.years[year]
	if hasCache && time.Since(cached.FetchedAt) < holidayTTL {
		return cached, false, nil
	}

	var failures []string
	answered := false
	for _, p := range holidayProviders {
		byYear, err := p.fetch(ctx, year)
		if err != nil {
			failures = append(failures, p.name+": "+err.Error())
			answered = answered || errors.Is(err, errNoHolidayData)
			continue
		}
		answered = true
		items, ok := byYear[year]
		if !ok || len(items) == 0 {
			failures = append(failures, p.name+": "+errNoHolidayData.Error())
			continue
		}
		now := time.Now()
		for y, list := range byYear {
			holidayCache.years[y] = holidaySet{Source: p.name, FetchedAt: now, Items: list}
		}
		saveHolidayCacheLocked()
		return holidayCache.years[year], false, nil
	}

	logMsg(fmt.Sprintf("libur nasional %d: %s", year, strings.Join(failures, "; ")))
	if hasCache {
		return cached, true, nil
	}
	if answered {
		return holidaySet{Items: []liburNasionalItem{}}, false, nil
	}
	return holidaySet{}, false, errors.New("semua sumber data libur nasional tidak dapat dihubungi")
}
