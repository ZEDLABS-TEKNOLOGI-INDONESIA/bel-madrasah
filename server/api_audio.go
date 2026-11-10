package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

func audioDeviceLabel(id string, devices []AudioDevice) string {
	for _, d := range devices {
		if d.ID == id {
			return d.Label
		}
	}
	if id == fallbackALSA {
		return "ALSA default"
	}
	return id
}

func handleAudioDevices(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		cfg, err := loadConfig()
		if err != nil {
			jsonError(w, "gagal memuat config", http.StatusInternalServerError)
			return
		}
		devices := listAudioDevices()
		if devices == nil {
			devices = []AudioDevice{}
		}
		active := resolveAudioDevice(cfg, devices)
		auto := autoAudioDevice(devices)
		jsonOK(w, map[string]any{
			"devices":      devices,
			"selected":     cfg.AudioDevice,
			"active":       active.Device,
			"active_label": audioDeviceLabel(active.Device, devices),
			"source":       active.Source,
			"auto":         auto,
			"auto_label":   audioDeviceLabel(auto, devices),
		})

	case http.MethodPost:
		var body struct {
			Device string `json:"device"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonError(w, "request tidak valid", http.StatusBadRequest)
			return
		}
		body.Device = strings.TrimSpace(body.Device)
		devices := listAudioDevices()
		if !validAudioDeviceChoice(body.Device, devices) {
			jsonError(w, "perangkat audio tidak ditemukan", http.StatusBadRequest)
			return
		}
		cfg, err := loadConfig()
		if err != nil {
			jsonError(w, "gagal memuat config", http.StatusInternalServerError)
			return
		}
		cfg.AudioDevice = body.Device
		if err := saveConfig(cfg); err != nil {
			jsonError(w, "gagal menyimpan perangkat audio", http.StatusInternalServerError)
			return
		}
		active := resolveAudioDevice(cfg, devices)
		logMsg("perangkat audio: " + active.Device + " (" + active.Source + ")")
		jsonOK(w, map[string]string{"message": "perangkat audio disimpan", "active": active.Device})

	default:
		methodNotAllowed(w)
	}
}

func handleAudioTest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		Device string `json:"device"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	devices := listAudioDevices()
	choice := strings.TrimSpace(body.Device)
	if !validAudioDeviceChoice(choice, devices) {
		jsonError(w, "perangkat audio tidak ditemukan", http.StatusBadRequest)
		return
	}
	cfg, err := loadConfig()
	if err != nil {
		jsonError(w, "gagal memuat config", http.StatusInternalServerError)
		return
	}
	cfg.AudioDevice = choice
	device := resolveAudioDevice(cfg, devices).Device
	if err := playTestTone(device, cfg); err != nil {
		logMsg("tes speaker gagal pada " + device + ": " + err.Error())
		jsonError(w, "speaker tidak dapat dipakai: "+err.Error(), http.StatusBadGateway)
		return
	}
	logMsg("tes speaker: " + device)
	jsonOK(w, map[string]string{"message": "bunyi tes diputar", "device": device})
}
