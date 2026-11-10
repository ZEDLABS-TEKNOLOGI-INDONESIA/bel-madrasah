package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

var audioExts = map[string]bool{".mp3": true, ".wav": true, ".ogg": true}

func resolveAudioPath(audio string) (string, bool) {
	audio = strings.TrimSpace(audio)
	if audio == "" {
		return "", false
	}
	if !filepath.IsAbs(audio) {
		name, ok := safeFilename(audio)
		if !ok || name != audio {
			return "", false
		}
		audio = filepath.Join(toneDir, name)
	}
	clean := filepath.Clean(audio)
	if !isValidAudioPath(clean) || clean == toneDir {
		return "", false
	}
	return clean, true
}

func toneUsage(j ModeJadwal) map[string]int {
	usage := map[string]int{}
	for _, days := range j {
		for _, entries := range days {
			for _, e := range entries {
				if filepath.Dir(e.Audio) == toneDir {
					usage[filepath.Base(e.Audio)]++
				}
			}
		}
	}
	return usage
}

func removeAudioEntries(j ModeJadwal, audio string) int {
	n := 0
	for mode, days := range j {
		for hari, entries := range days {
			kept := entries[:0]
			for _, e := range entries {
				if e.Audio == audio {
					n++
					continue
				}
				kept = append(kept, e)
			}
			j[mode][hari] = kept
		}
	}
	return n
}

func isValidAudioPath(p string) bool {
	clean := filepath.Clean(p)
	sep := string(filepath.Separator)
	return clean == toneDir || strings.HasPrefix(clean, toneDir+sep)
}

func listTones() ([]string, error) {
	entries, err := os.ReadDir(toneDir)
	if err != nil {
		return nil, err
	}
	var files []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		ext := filepath.Ext(e.Name())
		if ext == ".mp3" || ext == ".wav" || ext == ".ogg" {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)
	return files, nil
}

func safeFilename(name string) (string, bool) {
	base := filepath.Base(name)
	if base == "." || base == ".." || strings.ContainsAny(base, "/\\") {
		return "", false
	}
	return base, true
}

func sanitizeFilename(name string) string {
	ext := strings.ToLower(filepath.Ext(name))
	base := strings.TrimSuffix(name, filepath.Ext(name))

	base = strings.ToLower(base)

	base = strings.ReplaceAll(base, " ", "-")
	base = strings.ReplaceAll(base, "_", "-")

	reg := regexp.MustCompile(`[^a-z0-9\-]`)
	base = reg.ReplaceAllString(base, "")

	regDash := regexp.MustCompile(`-+`)
	base = regDash.ReplaceAllString(base, "-")

	base = strings.Trim(base, "-")

	if base == "" {
		base = "audio"
	}
	return base + ext
}

func renameTarget(oldName, newName string) (string, error) {
	newName = strings.TrimSpace(newName)
	if strings.ContainsAny(newName, "/\\") {
		return "", errors.New("nama file tidak boleh mengandung garis miring")
	}
	ext := strings.ToLower(filepath.Ext(oldName))
	if audioExts[strings.ToLower(filepath.Ext(newName))] {
		newName = strings.TrimSuffix(newName, filepath.Ext(newName))
	}
	if newName == "" {
		return "", errors.New("nama file tidak boleh kosong")
	}
	return sanitizeFilename(newName + ext), nil
}

func uniqueToneName(base, ext string) (string, string) {
	name := base + ext
	full := filepath.Join(toneDir, name)
	if _, err := os.Stat(full); os.IsNotExist(err) {
		return name, full
	}
	for i := 1; ; i++ {
		name = fmt.Sprintf("%s-%d%s", base, i, ext)
		full = filepath.Join(toneDir, name)
		if _, err := os.Stat(full); os.IsNotExist(err) {
			return name, full
		}
	}
}

func compressAudio(src, dst string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	cmd := exec.CommandContext(ctx, ffmpegPath,
		"-hide_banner", "-loglevel", "error",
		"-i", src,
		"-vn", "-map_metadata", "-1",
		"-c:a", "libmp3lame", "-b:a", "128k",
		"-f", "mp3",
		"-y", dst,
	)
	return cmd.Run()
}
