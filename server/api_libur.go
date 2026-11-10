package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

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

func handleLiburNasional(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}
	year := time.Now().Year()
	if q := r.URL.Query().Get("year"); q != "" {
		y, err := strconv.Atoi(q)
		if err != nil || y < 2000 || y > 2100 {
			jsonError(w, "tahun tidak valid", http.StatusBadRequest)
			return
		}
		year = y
	}

	set, stale, err := nationalHolidays(r.Context(), year)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadGateway)
		return
	}
	items := set.Items
	if items == nil {
		items = []liburNasionalItem{}
	}
	resp := map[string]any{
		"year":     year,
		"holidays": items,
		"source":   set.Source,
		"stale":    stale,
	}
	if !set.FetchedAt.IsZero() {
		resp["fetched_at"] = set.FetchedAt.Format(time.RFC3339)
	}
	jsonOK(w, resp)
}
