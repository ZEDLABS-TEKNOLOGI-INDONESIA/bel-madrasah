package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	procCards    = "/proc/asound/cards"
	procPCM      = "/proc/asound/pcm"
	fallbackALSA = "default"
)

type AudioDevice struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	HDMI  bool   `json:"hdmi"`
	USB   bool   `json:"usb"`
	card  int
}

type alsaCard struct {
	index  int
	id     string
	driver string
	name   string
}

var (
	cardLine = regexp.MustCompile(`^\s*(\d+)\s+\[([^\]]+)\]:\s*(.*?)\s+-\s+(.*)$`)
	pcmLine  = regexp.MustCompile(`^(\d+)-(\d+):\s*([^:]*?)\s*:`)
	hdmiWord = regexp.MustCompile(`(?i)hdmi|displayport`)
)

func parseALSA(cards, pcm string) []AudioDevice {
	byIndex := map[int]alsaCard{}
	for _, line := range strings.Split(cards, "\n") {
		m := cardLine.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		idx, _ := strconv.Atoi(m[1])
		byIndex[idx] = alsaCard{
			index:  idx,
			id:     strings.TrimSpace(m[2]),
			driver: strings.TrimSpace(m[3]),
			name:   strings.TrimSpace(m[4]),
		}
	}

	var devices []AudioDevice
	for _, line := range strings.Split(pcm, "\n") {
		if !strings.Contains(line, "playback") {
			continue
		}
		m := pcmLine.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		cardIdx, _ := strconv.Atoi(m[1])
		devIdx, _ := strconv.Atoi(m[2])
		card, ok := byIndex[cardIdx]
		if !ok {
			continue
		}
		pcmName := strings.TrimSpace(m[3])
		hdmi := hdmiWord.MatchString(card.id + " " + card.name + " " + pcmName)
		label := card.name
		if pcmName != "" && !strings.EqualFold(pcmName, card.name) && !hdmi {
			label = card.name + ": " + pcmName
		}
		if hdmi {
			label += " (HDMI)"
		}
		devices = append(devices, AudioDevice{
			ID:    fmt.Sprintf("plughw:CARD=%s,DEV=%d", card.id, devIdx),
			Label: label,
			HDMI:  hdmi,
			USB:   strings.EqualFold(card.driver, "USB-Audio"),
			card:  cardIdx,
		})
	}
	sort.SliceStable(devices, func(i, j int) bool { return devices[i].card < devices[j].card })
	return devices
}

func listAudioDevices() []AudioDevice {
	cards, err := os.ReadFile(procCards)
	if err != nil {
		return nil
	}
	pcm, err := os.ReadFile(procPCM)
	if err != nil {
		return nil
	}
	return parseALSA(string(cards), string(pcm))
}

func autoAudioDevice(devices []AudioDevice) string {
	for _, wantUSB := range []bool{true, false} {
		for _, d := range devices {
			if !d.HDMI && d.USB == wantUSB {
				return d.ID
			}
		}
	}
	if len(devices) > 0 {
		return devices[0].ID
	}
	return fallbackALSA
}

func normalizeALSA(device string) string {
	device = strings.TrimSpace(device)
	if strings.HasPrefix(device, "hw:") {
		return "plug" + device
	}
	return device
}

type audioSelection struct {
	Device string
	Source string
}

func resolveAudioDevice(cfg Config, devices []AudioDevice) audioSelection {
	if cfg.AudioDevice != "" {
		return audioSelection{normalizeALSA(cfg.AudioDevice), "pengaturan"}
	}
	if env := os.Getenv("BEL_ALSA_DEVICE"); env != "" {
		return audioSelection{normalizeALSA(env), "env"}
	}
	return audioSelection{autoAudioDevice(devices), "otomatis"}
}

func alsaDevice() string {
	cfg, err := loadConfig()
	if err != nil {
		cfg = defaultConfig()
	}
	return resolveAudioDevice(cfg, listAudioDevices()).Device
}

func validAudioDeviceChoice(choice string, devices []AudioDevice) bool {
	if choice == "" || choice == fallbackALSA {
		return true
	}
	for _, d := range devices {
		if d.ID == choice {
			return true
		}
	}
	return false
}

const testChime = "aevalsrc=exprs='0.5*sin(2*PI*if(lt(t\\,0.35)\\,880\\,660)*t)':d=0.8:s=44100," +
	"afade=t=in:d=0.02,afade=t=out:st=0.65:d=0.15"

func playTestTone(device string, cfg Config) error {
	stopAllProcs()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, ffmpegPath,
		"-hide_banner", "-loglevel", "error",
		"-f", "lavfi", "-i", testChime,
		"-filter:a", audioFilterChain(cfg),
		"-ac", "2",
		"-f", "alsa", device,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s", ffmpegALSAError(string(out), err))
	}
	return nil
}

var alsaErrLine = regexp.MustCompile(`\[alsa @ [^\]]*\]\s*(.+)`)

func ffmpegALSAError(out string, err error) string {
	if m := alsaErrLine.FindStringSubmatch(out); m != nil {
		return strings.TrimSpace(m[1])
	}
	lines := strings.Split(strings.TrimSpace(out), "\n")
	if last := strings.TrimSpace(lines[len(lines)-1]); last != "" {
		return last
	}
	return err.Error()
}
