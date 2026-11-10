package main

import (
	"errors"
	"net/http"
	"testing"
)

const piCards = ` 0 [vc4hdmi0       ]: vc4-hdmi - vc4-hdmi-0
                      vc4-hdmi-0
 1 [vc4hdmi1       ]: vc4-hdmi - vc4-hdmi-1
                      vc4-hdmi-1
 2 [Headphones     ]: bcm2835_headpho - bcm2835 Headphones
                      bcm2835 Headphones
 3 [Device         ]: USB-Audio - USB Audio Device
                      C-Media Electronics Inc. USB Audio Device at usb-0000:01:00.0-1.3, full speed
`

const piPCM = `00-00: MAI PCM i2s-hifi-0 : MAI PCM i2s-hifi-0 : playback 1
01-00: MAI PCM i2s-hifi-0 : MAI PCM i2s-hifi-0 : playback 1
02-00: bcm2835 Headphones : bcm2835 Headphones : playback 8
03-00: USB Audio : USB Audio : playback 1 : capture 1
`

const laptopCards = ` 0 [Generic        ]: HDA-Intel - HD-Audio Generic
                      HD-Audio Generic at 0xfccc8000 irq 61
 1 [Generic_1      ]: HDA-Intel - HD-Audio Generic
                      HD-Audio Generic at 0xfccc0000 irq 62
`

const laptopPCM = `00-03: HDMI 0 : HDMI 0 : playback 1
01-00: ALC256 Analog : ALC256 Analog : playback 1 : capture 1
01-01: Mic Only : Mic Only : capture 1
`

func TestParseALSARaspberryPi(t *testing.T) {
	devs := parseALSA(piCards, piPCM)
	if len(devs) != 4 {
		t.Fatalf("got %d devices: %+v", len(devs), devs)
	}
	want := []struct {
		id        string
		hdmi, usb bool
		labelEnds string
	}{
		{"plughw:CARD=vc4hdmi0,DEV=0", true, false, "(HDMI)"},
		{"plughw:CARD=vc4hdmi1,DEV=0", true, false, "(HDMI)"},
		{"plughw:CARD=Headphones,DEV=0", false, false, "bcm2835 Headphones"},
		{"plughw:CARD=Device,DEV=0", false, true, "USB Audio Device: USB Audio"},
	}
	for i, w := range want {
		d := devs[i]
		if d.ID != w.id || d.HDMI != w.hdmi || d.USB != w.usb || d.Label[len(d.Label)-len(w.labelEnds):] != w.labelEnds {
			t.Errorf("device %d = %+v, want %+v", i, d, w)
		}
	}
	if got := autoAudioDevice(devs); got != "plughw:CARD=Device,DEV=0" {
		t.Fatalf("auto pick %s, want USB card", got)
	}
	if got := autoAudioDevice(devs[:3]); got != "plughw:CARD=Headphones,DEV=0" {
		t.Fatalf("auto pick without USB %s, want headphone jack", got)
	}
	if got := autoAudioDevice(devs[:2]); got != "plughw:CARD=vc4hdmi0,DEV=0" {
		t.Fatalf("HDMI-only pick %s", got)
	}
}

func TestParseALSALaptopRealDeviceNumbers(t *testing.T) {
	devs := parseALSA(laptopCards, laptopPCM)
	if len(devs) != 2 {
		t.Fatalf("capture-only device must be skipped: %+v", devs)
	}
	if devs[0].ID != "plughw:CARD=Generic,DEV=3" || !devs[0].HDMI {
		t.Fatalf("HDMI device number not taken from pcm: %+v", devs[0])
	}
	if got := autoAudioDevice(devs); got != "plughw:CARD=Generic_1,DEV=0" {
		t.Fatalf("auto pick %s", got)
	}
	if autoAudioDevice(nil) != fallbackALSA || len(parseALSA("", "")) != 0 {
		t.Fatal("no devices must fall back to ALSA default")
	}
}

func TestResolveAudioDevicePriority(t *testing.T) {
	devs := parseALSA(piCards, piPCM)
	t.Setenv("BEL_ALSA_DEVICE", "hw:2,0")
	if got := resolveAudioDevice(Config{}, devs); got.Device != "plughw:2,0" || got.Source != "env" {
		t.Fatalf("legacy env not normalized: %+v", got)
	}
	cfg := Config{AudioDevice: "plughw:CARD=Headphones,DEV=0"}
	if got := resolveAudioDevice(cfg, devs); got.Device != cfg.AudioDevice || got.Source != "pengaturan" {
		t.Fatalf("settings must win over env: %+v", got)
	}
	t.Setenv("BEL_ALSA_DEVICE", "")
	if got := resolveAudioDevice(Config{}, devs); got.Source != "otomatis" || got.Device != "plughw:CARD=Device,DEV=0" {
		t.Fatalf("auto: %+v", got)
	}
}

func TestValidAudioDeviceChoice(t *testing.T) {
	devs := parseALSA(piCards, piPCM)
	for choice, ok := range map[string]bool{
		"":                             true,
		"default":                      true,
		"plughw:CARD=Headphones,DEV=0": true,
		"plughw:CARD=Lain,DEV=0":       false,
		"hw:0,0; rm -rf /":             false,
	} {
		if validAudioDeviceChoice(choice, devs) != ok {
			t.Errorf("validAudioDeviceChoice(%q) != %v", choice, ok)
		}
	}
}

func TestFfmpegALSAError(t *testing.T) {
	out := "ALSA lib confmisc.c:165:(snd_config_get_card) Cannot get card index for X\n" +
		"[alsa @ 0x55] cannot open audio device plughw:CARD=X,DEV=0 (No such device)\n" +
		"[out#0/alsa @ 0x56] Could not write header"
	if got := ffmpegALSAError(out, errors.New("exit 1")); got != "cannot open audio device plughw:CARD=X,DEV=0 (No such device)" {
		t.Fatalf("got %q", got)
	}
	if got := ffmpegALSAError("", errors.New("exit 1")); got != "exit 1" {
		t.Fatalf("got %q", got)
	}
}

func TestAudioDeviceSettingPersistsAndSurvivesConfigSave(t *testing.T) {
	setupTestDir(t)
	if rec := postJSON(t, handleAudioDevices, map[string]string{"device": "plughw:CARD=TidakAda,DEV=0"}); rec.Code != http.StatusBadRequest {
		t.Fatalf("unknown device accepted: %d", rec.Code)
	}
	if rec := postJSON(t, handleAudioDevices, map[string]string{"device": "default"}); rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body.String())
	}
	if rec := postJSON(t, handleConfig, map[string]any{"mode": "reguler"}); rec.Code != http.StatusOK {
		t.Fatalf("config status %d", rec.Code)
	}
	cfg, _ := loadConfig()
	if cfg.AudioDevice != "default" {
		t.Fatalf("audio device lost after config save: %q", cfg.AudioDevice)
	}
}
