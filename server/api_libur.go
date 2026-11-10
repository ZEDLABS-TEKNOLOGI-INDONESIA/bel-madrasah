package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

type kemendesaHoliday struct {
	Date          string `json:"date"`
	Name          string `json:"name"`
	IsCutiBersama bool   `json:"is_cuti_bersama"`
}

type liburNasionalItem struct {
	Date              string `json:"date"`
	Name              string `json:"name"`
	IsNationalHoliday bool   `json:"is_national_holiday"`
}

func handleLibur(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		cfg, err := loadConfig()
		if err != nil {
			jsonError(w, "gagal memuat config", http.StatusInternalServerError)
			return
		}
		dates := cfg.LiburDates
		if dates == nil {
			dates = []LiburDate{}
		}
		sort.Slice(dates, func(i, j int) bool {
			return dates[i].Date < dates[j].Date
		})
		jsonOK(w, map[string]any{"libur": dates})

	case http.MethodPost:
		var body struct {
			Action     string `json:"action"`
			Date       string `json:"date"`
			Keterangan string `json:"keterangan"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonError(w, "request tidak valid", http.StatusBadRequest)
			return
		}
		if _, err := time.Parse("2006-01-02", body.Date); err != nil {
			jsonError(w, "format tanggal tidak valid (YYYY-MM-DD)", http.StatusBadRequest)
			return
		}
		body.Keterangan = strings.TrimSpace(body.Keterangan)

		cfg, err := loadConfig()
		if err != nil {
			jsonError(w, "gagal memuat config", http.StatusInternalServerError)
			return
		}

		switch body.Action {
		case "add":
			for _, d := range cfg.LiburDates {
				if d.Date == body.Date {
					jsonError(w, "tanggal sudah ada", http.StatusBadRequest)
					return
				}
			}
			cfg.LiburDates = append(cfg.LiburDates, LiburDate{
				Date:       body.Date,
				Keterangan: body.Keterangan,
			})
			logMsg(fmt.Sprintf("libur ditambahkan: %s (%s)", body.Date, body.Keterangan))

		case "delete":
			n := cfg.LiburDates[:0]
			for _, d := range cfg.LiburDates {
				if d.Date != body.Date {
					n = append(n, d)
				}
			}
			cfg.LiburDates = n
			logMsg("libur dihapus: " + body.Date)

		default:
			jsonError(w, "action tidak valid", http.StatusBadRequest)
			return
		}

		if err := saveConfig(cfg); err != nil {
			jsonError(w, "gagal menyimpan config", http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]string{"message": "berhasil"})

	default:
		methodNotAllowed(w)
	}
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

func handleLiburNasional(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	year := r.URL.Query().Get("year")
	if year == "" {
		year = strconv.Itoa(time.Now().Year())
	}
	y, err := strconv.Atoi(year)
	if err != nil || y < 2000 || y > 2100 {
		jsonError(w, "tahun tidak valid", http.StatusBadRequest)
		return
	}

	apiURL := "https://api.kemendesa.link/libur-nasional/api/holidays/" + strconv.Itoa(y) + ".json"
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(apiURL)
	if err != nil {
		logMsg("gagal mengambil libur nasional: " + err.Error())
		jsonError(w, "gagal mengambil data libur nasional", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		jsonOK(w, []liburNasionalItem{})
		return
	}
	if resp.StatusCode != http.StatusOK {
		logMsg(fmt.Sprintf("libur nasional: status %d dari sumber", resp.StatusCode))
		jsonError(w, "sumber data libur nasional bermasalah", http.StatusBadGateway)
		return
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		jsonError(w, "gagal membaca response", http.StatusBadGateway)
		return
	}

	raw, err := parseKemendesaHolidays(body)
	if err != nil {
		logMsg("libur nasional: format respons tidak dikenali: " + err.Error())
		jsonError(w, "format data libur nasional tidak dikenali", http.StatusBadGateway)
		return
	}

	items := make([]liburNasionalItem, 0, len(raw))
	for _, h := range raw {
		if _, err := time.Parse("2006-01-02", h.Date); err != nil {
			continue
		}
		items = append(items, liburNasionalItem{
			Date:              h.Date,
			Name:              h.Name,
			IsNationalHoliday: !h.IsCutiBersama,
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].Date < items[j].Date })

	jsonOK(w, items)
}
