package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

func handleTones(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}

	page, perPage := 1, 20
	if p := r.URL.Query().Get("page"); p != "" {
		if n, err := strconv.Atoi(p); err == nil && n > 0 {
			page = n
		}
	}
	if pp := r.URL.Query().Get("per_page"); pp != "" {
		if n, err := strconv.Atoi(pp); err == nil && n > 0 && n <= 500 {
			perPage = n
		}
	}

	files, err := listTones()
	if err != nil {
		jsonError(w, "gagal membaca direktori tone", http.StatusInternalServerError)
		return
	}

	total := len(files)
	start := (page - 1) * perPage
	end := start + perPage
	if start > total {
		start = total
	}
	if end > total {
		end = total
	}
	pageFiles := append([]string{}, files[start:end]...)

	usage := map[string]int{}
	if j, err := loadJadwal(); err == nil {
		all := toneUsage(j)
		for _, f := range pageFiles {
			if n := all[f]; n > 0 {
				usage[f] = n
			}
		}
	}

	jsonOK(w, map[string]any{
		"tones":    pageFiles,
		"usage":    usage,
		"total":    total,
		"page":     page,
		"per_page": perPage,
		"pages":    max1((total + perPage - 1) / perPage),
	})
}

func max1(a int) int {
	if a < 1 {
		return 1
	}
	return a
}

func handleTonesFile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}

	rawPath := r.URL.RawPath
	if rawPath == "" {
		rawPath = r.URL.Path
	}
	raw := strings.TrimPrefix(rawPath, "/api/tones/")
	decoded, err := url.PathUnescape(raw)
	if err != nil {
		jsonError(w, "nama file tidak valid", http.StatusBadRequest)
		return
	}
	filename, ok := safeFilename(decoded)
	if !ok {
		jsonError(w, "nama file tidak valid", http.StatusBadRequest)
		return
	}

	ext := strings.ToLower(filepath.Ext(filename))
	if ext != ".mp3" && ext != ".wav" && ext != ".ogg" {
		jsonError(w, "format tidak didukung", http.StatusBadRequest)
		return
	}

	full := filepath.Join(toneDir, filename)
	if _, err := os.Stat(full); os.IsNotExist(err) {
		jsonError(w, "file tidak ditemukan", http.StatusNotFound)
		return
	}

	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	w.Header().Set("Content-Type", mimeType)
	w.Header().Set("Cache-Control", "private, max-age=3600")
	http.ServeFile(w, r, full)
}

func handleTonesUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}

	rc := http.NewResponseController(w)
	_ = rc.SetReadDeadline(time.Now().Add(10 * time.Minute))
	_ = rc.SetWriteDeadline(time.Now().Add(10 * time.Minute))

	if err := r.ParseMultipartForm(8 << 20); err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			jsonError(w, "file terlalu besar (maks 32MB)", http.StatusRequestEntityTooLarge)
			return
		}
		logMsg("upload gagal dibaca: " + err.Error())
		jsonError(w, "upload terputus atau tidak valid, coba lagi", http.StatusBadRequest)
		return
	}
	defer r.MultipartForm.RemoveAll()

	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "gagal membaca file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	raw, ok := safeFilename(header.Filename)
	if !ok {
		jsonError(w, "nama file tidak valid", http.StatusBadRequest)
		return
	}
	filename := sanitizeFilename(raw)
	ext := strings.ToLower(filepath.Ext(filename))
	if ext != ".mp3" && ext != ".wav" && ext != ".ogg" {
		jsonError(w, "format tidak didukung (mp3, wav, ogg)", http.StatusBadRequest)
		return
	}
	base := strings.TrimSuffix(filename, ext)

	rawPath := filepath.Join(toneDir, fmt.Sprintf(".upload-%d%s", time.Now().UnixNano(), ext))
	dst, err := os.Create(rawPath)
	if err != nil {
		jsonError(w, "gagal menyimpan file", http.StatusInternalServerError)
		return
	}
	if _, err := io.Copy(dst, file); err != nil {
		dst.Close()
		os.Remove(rawPath)
		jsonError(w, "gagal menulis file", http.StatusInternalServerError)
		return
	}
	dst.Close()
	defer os.Remove(rawPath)

	finalName, finalPath := uniqueToneName(base, ".mp3")
	tmpOut := finalPath + ".tmp"

	if err := compressAudio(rawPath, tmpOut); err != nil {
		os.Remove(tmpOut)
		if ext != ".mp3" {
			logMsg("gagal konversi audio: " + err.Error())
			jsonError(w, "gagal memproses audio", http.StatusInternalServerError)
			return
		}
		logMsg("gagal compress audio (pakai file asli): " + err.Error())
		if err := os.Rename(rawPath, finalPath); err != nil {
			jsonError(w, "gagal menyimpan file", http.StatusInternalServerError)
			return
		}
	} else if err := os.Rename(tmpOut, finalPath); err != nil {
		os.Remove(tmpOut)
		jsonError(w, "gagal menyimpan file", http.StatusInternalServerError)
		return
	} else {
		logMsg("audio dikompres: " + finalName)
	}

	logMsg("audio diupload: " + finalName)
	jsonOK(w, map[string]string{"message": "upload berhasil", "filename": finalName})
}

func handleTonesRename(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		Filename string `json:"filename"`
		NewName  string `json:"new_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	oldName, ok := safeFilename(body.Filename)
	if !ok || oldName != body.Filename || !audioExts[strings.ToLower(filepath.Ext(oldName))] {
		jsonError(w, "nama file tidak valid", http.StatusBadRequest)
		return
	}
	newName, err := renameTarget(oldName, body.NewName)
	if err != nil {
		jsonError(w, err.Error(), http.StatusBadRequest)
		return
	}

	oldPath := filepath.Join(toneDir, oldName)
	newPath := filepath.Join(toneDir, newName)
	if _, err := os.Stat(oldPath); os.IsNotExist(err) {
		jsonError(w, "file tidak ditemukan", http.StatusNotFound)
		return
	}
	if newName == oldName {
		jsonOK(w, map[string]any{"message": "nama file tidak berubah", "filename": newName, "updated": 0})
		return
	}
	if _, err := os.Stat(newPath); err == nil {
		jsonError(w, "file "+newName+" sudah ada", http.StatusConflict)
		return
	}
	if getNowPlaying() == oldName {
		stopAllProcs()
	}
	if err := os.Rename(oldPath, newPath); err != nil {
		jsonError(w, "gagal mengganti nama file", http.StatusInternalServerError)
		return
	}

	updated := 0
	err = updateJadwal(func(j ModeJadwal) bool {
		updated = replaceAudioPath(j, oldPath, newPath)
		return updated > 0
	})
	if err != nil {
		_ = os.Rename(newPath, oldPath)
		jsonError(w, "gagal memperbarui jadwal, nama file dikembalikan", http.StatusInternalServerError)
		return
	}

	logMsg(fmt.Sprintf("audio diganti nama: %s -> %s (%d jadwal)", oldName, newName, updated))
	jsonOK(w, map[string]any{
		"message":  "nama file berhasil diganti",
		"filename": newName,
		"updated":  updated,
	})
}

func handleTonesDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		Filename string `json:"filename"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	filename, ok := safeFilename(body.Filename)
	if !ok || filename != body.Filename {
		jsonError(w, "nama file tidak valid", http.StatusBadRequest)
		return
	}

	full := filepath.Join(toneDir, filename)
	if _, err := os.Stat(full); os.IsNotExist(err) {
		jsonError(w, "file tidak ditemukan", http.StatusNotFound)
		return
	}
	if getNowPlaying() == filename {
		stopAllProcs()
	}
	if err := os.Remove(full); err != nil {
		jsonError(w, "gagal menghapus file", http.StatusInternalServerError)
		return
	}

	removed := 0
	err := updateJadwal(func(j ModeJadwal) bool {
		removed = removeAudioEntries(j, full)
		return removed > 0
	})
	if err != nil {
		logMsg("audio dihapus tetapi jadwal gagal dibersihkan: " + err.Error())
		jsonError(w, "file dihapus, tetapi jadwal yang memakainya gagal dibersihkan", http.StatusInternalServerError)
		return
	}
	logMsg(fmt.Sprintf("audio dihapus: %s (%d jadwal ikut dihapus)", filename, removed))
	jsonOK(w, map[string]any{"message": "file berhasil dihapus", "removed": removed})
}

func handleTonesPreview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		Filename string `json:"filename"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	filename, ok := safeFilename(body.Filename)
	if !ok {
		jsonError(w, "nama file tidak valid", http.StatusBadRequest)
		return
	}

	full := filepath.Join(toneDir, filename)
	if _, err := os.Stat(full); os.IsNotExist(err) {
		jsonError(w, "file tidak ditemukan", http.StatusNotFound)
		return
	}
	go playSound(full)
	logMsg("preview: " + filename)
	jsonOK(w, map[string]string{
		"message":  "memutar " + filename,
		"filename": filename,
		"url":      "/api/tones/" + url.PathEscape(filename),
	})
}

func handleTonesStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	stopAllProcs()
	logMsg("audio dihentikan via web")
	jsonOK(w, map[string]string{"message": "audio dihentikan"})
}
