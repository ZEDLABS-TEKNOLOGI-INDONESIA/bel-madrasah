#include <WiFi.h>
#include <esp_wifi.h>
#include <WiFiManager.h>
#include <ESPmDNS.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <RTClib.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <LittleFS.h>
#include <time.h>
#include <vector>
#include <algorithm>
#include <HardwareSerial.h>
#include <DFRobotDFPlayerMini.h>
#include "types.h"
#include "index_html.h"

#define I2C_SDA_PIN 8
#define I2C_SCL_PIN 9
#define OLED_ADDR 0x3C
#define OLED_WIDTH 128
#define OLED_HEIGHT 32
#define OLED_SCREEN_INTERVAL 10000UL
#define DFP_RX_PIN 20
#define DFP_TX_PIN 21

const char *AP_SSID = "BELL MADRASAH V0.1.0";
const char *AP_PASS = "P@ssw0rd";
const IPAddress AP_IP(192, 168, 4, 1);
const IPAddress AP_MASK(255, 255, 255, 0);

const char *SCHEDULE_FILE = "/schedule.json";
const char *CONFIG_FILE = "/config.json";
const char *TRACKS_FILE = "/tracks.json";

const size_t MAX_SLOTS = 300;
const size_t MAX_TRACKS = 60;
const size_t SCHED_DOC_SIZE = 49152;
const unsigned long NTP_SYNC_INTERVAL = 3600000UL;
const unsigned long DFP_RETRY_INTERVAL = 5000UL;

const char *modeCode(ScheduleMode m)
{
    static const char *c[] = {"reguler", "ramadhan", "pts", "pas"};
    return (m < MODE_COUNT) ? c[m] : "reguler";
}
ScheduleMode modeFromCode(const String &s)
{
    if (s == "ramadhan")
        return MODE_RAMADHAN;
    if (s == "pts")
        return MODE_PTS;
    if (s == "pas")
        return MODE_PAS;
    return MODE_REGULER;
}

RTC_DS1307 rtc;
Adafruit_SSD1306 oled(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
bool oledReady = false;
AsyncWebServer server(80);
HardwareSerial dfpSerial(1);
DFRobotDFPlayerMini dfPlayer;

std::vector<BellSlot> schedule;
std::vector<TrackInfo> trackList;
StaticCfg staticCfg;
int currentVolume = 20;
bool holidayMode = false;
ScheduleMode activeMode = MODE_REGULER;

// BARU: pengaturan mode tidur (jam disimpan sebagai menit sejak 00:00)
volatile bool sleepEnabled = false;
volatile int sleepStartMin = 22 * 60;
volatile int sleepEndMin = 5 * 60;
volatile bool sleepOledOff = true;
volatile bool sleeping = false; // status saat ini, diperbarui di bellTask

volatile bool dfpReady = false;
volatile bool wifiSetupDone = false;
bool apActive = false;
volatile bool restartPending = false;
volatile bool wifiResetPending = false;
unsigned long restartAt = 0;

unsigned long lastNtpAttempt = 0;
bool ntpLastOk = false;
uint32_t lastTriggeredMinute = 0;

// Penanda kepercayaan waktu
const int MIN_VALID_YEAR = 2025;
volatile bool timeTrusted = false;
volatile bool rtcPresent = false;
volatile uint32_t lastUnixSeen = 0;

volatile bool audioPlaying = false;
uint16_t playingTrack = 0;
unsigned long playStartedAt = 0;

SemaphoreHandle_t i2cMutex;
SemaphoreHandle_t dataMutex;
SemaphoreHandle_t dfpMutex;

struct Lock
{
    SemaphoreHandle_t m;
    Lock(SemaphoreHandle_t mm)
        : m(mm)
    {
        xSemaphoreTake(m, portMAX_DELAY);
    }
    ~Lock()
    {
        xSemaphoreGive(m);
    }
};

DateTime getNow()
{
    Lock l(i2cMutex);
    return rtc.now();
}

void setRtc(const DateTime &dt)
{
    {
        Lock l(i2cMutex);
        rtc.adjust(dt);
    }
    lastUnixSeen = 0; // reset baseline supaya lompatan sah tidak dianggap anomali
}

bool rtcRunning()
{
    Lock l(i2cMutex);
    return rtc.isrunning();
}

// Penanda "waktu pernah diverifikasi" disimpan di NVRAM DS1307.
// NVRAM ikut hilang saat listrik padam tanpa baterai, jadi penanda otomatis terhapus.
const uint8_t TRUST_ADDR = 0;
const uint8_t TRUST_MAGIC = 0xA5;

void markTrusted(bool t)
{
    Lock l(i2cMutex);
    rtc.writenvram(TRUST_ADDR, t ? TRUST_MAGIC : 0x00);
}

void setTrusted(bool t)
{
    if (timeTrusted == t)
        return;
    timeTrusted = t;
    if (rtcPresent)
        markTrusted(t);
}

void validateTime(const DateTime &now)
{
    if (now.year() < MIN_VALID_YEAR || now.year() > 2099)
    {
        if (timeTrusted)
            Serial.printf("Waktu tidak valid (tahun %d), bel dikunci\n", now.year());
        setTrusted(false);
        lastUnixSeen = 0;
        return;
    }

    uint32_t u = now.unixtime();
    if (lastUnixSeen != 0)
    {
        long d = (long)u - (long)lastUnixSeen;
        // Loop berjalan ~300 ms. Mundur atau lompat > 120 dtk = anomali
        if (d < 0 || d > 120)
        {
            if (timeTrusted)
                Serial.printf("Lompatan waktu terdeteksi (%ld dtk), bel dikunci\n", d);
            setTrusted(false);
        }
    }
    lastUnixSeen = u;
}

// BARU: apakah jam saat ini masuk rentang tidur (mendukung lewat tengah malam)
bool isSleepTime(const DateTime &now)
{
    if (!sleepEnabled)
        return false;
    int s = sleepStartMin, e = sleepEndMin;
    if (s == e)
        return false;
    int m = now.hour() * 60 + now.minute();
    if (s < e)
        return m >= s && m < e;
    return m >= s || m < e;
}

// BARU: matikan/nyalakan panel OLED
bool oledIsOff = false;
void oledPower(bool on)
{
    Lock l(i2cMutex);
    if (!oledReady)
        return;
    if (!on)
    {
        oled.clearDisplay();
        oled.display();
    }
    oled.ssd1306_command(on ? SSD1306_DISPLAYON : SSD1306_DISPLAYOFF);
}

void oledDrawCentered(const String &text, int y, uint8_t size)
{
    int16_t x1, y1;
    uint16_t w, h;
    oled.setTextSize(size);
    oled.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);
    oled.setCursor(((int)OLED_WIDTH - (int)w) / 2 - x1, y);
    oled.print(text);
}

void oledDrawValue(String text, bool big)
{
    if (big)
    {
        oledDrawCentered(text, 14, 2);
    }
    else
    {
        if (text.length() > 21)
            text = text.substring(0, 21);
        oledDrawCentered(text, 18, 1);
    }
}

void oledShow(const String &label, const String &value, bool big = false)
{
    Lock l(i2cMutex);
    if (!oledReady)
        return;
    oled.clearDisplay();
    oled.setTextColor(SSD1306_WHITE);
    oledDrawCentered(label, 0, 1);
    oledDrawValue(value, big);
    oled.display();
}

void oledTask(void *param)
{
    for (;;)
    {
        // BARU: matikan layar saat mode tidur (jika opsi aktif)
        bool wantOff = sleeping && sleepOledOff;
        if (wantOff != oledIsOff)
        {
            oledPower(!wantOff);
            oledIsOff = wantOff;
        }
        if (wantOff)
        {
            vTaskDelay(pdMS_TO_TICKS(1000));
            continue;
        }

        int screen = (millis() / OLED_SCREEN_INTERVAL) % 3;
        bool sta = WiFi.status() == WL_CONNECTED;

        if (screen == 0)
        {
            DateTime now = getNow();
            char tb[12];
            snprintf(tb, sizeof(tb), "%02d:%02d:%02d", now.hour(), now.minute(), now.second());
            if (!timeTrusted)
                oledShow("WAKTU BELUM VALID", tb, false);
            else if (sleeping) // BARU: layar tidur (jika OLED tidak dimatikan)
            {
                char eb[16];
                snprintf(eb, sizeof(eb), "s/d %02d:%02d", sleepEndMin / 60, sleepEndMin % 60);
                oledShow("MODE TIDUR", eb, false);
            }
            else
                oledShow("WAKTU", tb, true);
        }
        else if (screen == 1)
        {
            oledShow("IP ADDRESS", sta ? WiFi.localIP().toString() : WiFi.softAPIP().toString());
        }
        else
        {
            oledShow("NAMA WIFI", sta ? WiFi.SSID() : String(AP_SSID));
        }
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}

const char *dayCode(int dow)
{
    static const char *codes[] = {"sun", "mon", "tue", "wed", "thu", "fri", "sat"};
    return (dow >= 0 && dow <= 6) ? codes[dow] : "";
}
bool dayMatches(const String &d, int dow)
{
    if (d == "all")
        return true;
    if (d == "mon-sat")
        return dow >= 1 && dow <= 6;
    if (d == "mon-fri" || d == "weekday")
        return dow >= 1 && dow <= 5;
    if (d == "mon-thu")
        return dow >= 1 && dow <= 4;
    return d == dayCode(dow);
}
bool validDay(const String &d)
{
    static const char *ok[] = {"all", "mon-sat", "mon-fri", "mon-thu",
                               "mon", "tue", "wed", "thu", "fri", "sat", "sun"};
    for (auto s : ok)
        if (d == s)
            return true;
    return false;
}
bool validTime(const String &t)
{
    if (t.length() != 5 || t[2] != ':')
        return false;
    if (!isdigit(t[0]) || !isdigit(t[1]) || !isdigit(t[3]) || !isdigit(t[4]))
        return false;
    int h = t.substring(0, 2).toInt();
    int m = t.substring(3, 5).toInt();
    return h >= 0 && h < 24 && m >= 0 && m < 60;
}

// BARU: konversi "HH:MM" <-> menit
int strToMin(const String &t, int def)
{
    if (!validTime(t))
        return def;
    return t.substring(0, 2).toInt() * 60 + t.substring(3, 5).toInt();
}
String minToStr(int m)
{
    char b[8];
    snprintf(b, sizeof(b), "%02d:%02d", (m / 60) % 24, m % 60);
    return String(b);
}

String postParam(AsyncWebServerRequest *r, const char *n)
{
    return r->hasParam(n, true) ? r->getParam(n, true)->value() : String();
}
void sendResult(AsyncWebServerRequest *r, bool ok, const String &msg, int code = 0)
{
    StaticJsonDocument<256> d;
    d["ok"] = ok;
    d["msg"] = msg;
    String out;
    serializeJson(d, out);
    r->send(code ? code : (ok ? 200 : 400), "application/json", out);
}
uint32_t ip2u(const IPAddress &ip)
{
    return ((uint32_t)ip[0] << 24) | ((uint32_t)ip[1] << 16) | ((uint32_t)ip[2] << 8) | ip[3];
}
IPAddress u2ip(uint32_t v)
{
    return IPAddress((uint8_t)(v >> 24), (uint8_t)(v >> 16), (uint8_t)(v >> 8), (uint8_t)v);
}

String fsReadText(const char *path)
{
    String out;
    if (!LittleFS.exists(path))
        return out;
    File f = LittleFS.open(path, "r");
    if (!f)
        return out;
    out = f.readString();
    f.close();
    return out;
}
bool fsWriteText(const char *path, const String &txt)
{
    String tmp = String(path) + ".tmp";
    File f = LittleFS.open(tmp, "w");
    if (!f)
        return false;
    size_t w = f.print(txt);
    f.close();
    if (w != txt.length())
    {
        LittleFS.remove(tmp);
        return false;
    }
    LittleFS.remove(path);
    return LittleFS.rename(tmp, path);
}

bool saveConfig()
{
    StaticJsonDocument<1024> d; // UBAH: dari 768
    d["volume"] = currentVolume;
    d["holiday"] = holidayMode;
    d["mode"] = modeCode(activeMode);
    JsonObject s = d.createNestedObject("static");
    s["enabled"] = staticCfg.enabled;
    s["ssid"] = staticCfg.ssid;
    s["ip"] = staticCfg.ip;
    s["gw"] = staticCfg.gw;
    s["mask"] = staticCfg.mask;
    s["dns"] = staticCfg.dns;
    // BARU: pengaturan mode tidur
    JsonObject sl = d.createNestedObject("sleep");
    sl["enabled"] = (bool)sleepEnabled;
    sl["start"] = minToStr(sleepStartMin);
    sl["end"] = minToStr(sleepEndMin);
    sl["oled"] = (bool)sleepOledOff;
    String out;
    serializeJson(d, out);
    return fsWriteText(CONFIG_FILE, out);
}

void loadConfig()
{
    String txt = fsReadText(CONFIG_FILE);
    if (txt.length() == 0)
    {
        saveConfig();
        return;
    }
    StaticJsonDocument<1024> d; // UBAH: dari 768
    if (deserializeJson(d, txt))
        return;
    currentVolume = constrain((int)(d["volume"] | 20), 0, 30);
    holidayMode = d["holiday"] | false;
    activeMode = modeFromCode(d["mode"] | "reguler");
    JsonObject s = d["static"];
    staticCfg.enabled = s["enabled"] | false;
    staticCfg.ssid = s["ssid"] | "";
    staticCfg.ip = s["ip"] | "";
    staticCfg.gw = s["gw"] | "";
    staticCfg.mask = s["mask"] | "";
    staticCfg.dns = s["dns"] | "";
    // BARU: pengaturan mode tidur
    JsonObject sl = d["sleep"];
    sleepEnabled = sl["enabled"] | false;
    sleepStartMin = strToMin(String((const char *)(sl["start"] | "18:00")), 18 * 60);
    sleepEndMin = strToMin(String((const char *)(sl["end"] | "05:00")), 5 * 60);
    sleepOledOff = sl["oled"] | true;
}

int dayRank(const String &d)
{
    static const char *o[] = {"all", "mon-sat", "mon-fri", "mon-thu",
                              "mon", "tue", "wed", "thu", "fri", "sat", "sun"};
    for (int i = 0; i < 11; i++)
        if (d == o[i])
            return i;
    return 99;
}

void sortSchedule()
{
    std::stable_sort(schedule.begin(), schedule.end(), [](const BellSlot &a, const BellSlot &b)
                     {
    if (a.mode != b.mode) return a.mode < b.mode;
    int da = dayRank(a.day), db = dayRank(b.day);
    if (da != db) return da < db;
    return a.time < b.time; });
}

enum TrackId
{
    T_SHOLAWAT = 1,
    T_MARS = 2,
    T_UPACARA = 3,
    T_ISTIRAHAT1 = 4,
    T_ISTIRAHAT2 = 5,
    T_KEBERSIHAN = 6,
    T_LITERASI = 7,
    T_PEL1 = 8,
    T_PEL2 = 9,
    T_PEL3 = 10,
    T_PEL4 = 11,
    T_PEL5 = 12,
    T_PEL6 = 13,
    T_PEL7 = 14,
    T_PEL8 = 15,
    T_PEL9 = 16,
    T_PEL10 = 17,
    T_SELESAI = 18,
    T_INDONESIA_RAYA = 19,
    T_TANAH_AIRKU = 20,
    T_HYMNE = 21,
    T_ROHANI = 22,
    T_AKHIR_PEKAN = 23,
    T_PRAMUKA = 24
};

void addSlot(std::vector<BellSlot> &v, ScheduleMode m, const char *time, const char *day, uint16_t track)
{
    BellSlot s;
    s.mode = m;
    s.time = time;
    s.day = day;
    s.track = track;
    s.enabled = true;
    v.push_back(s);
}

std::vector<TrackInfo> defaultTracks()
{
    std::vector<TrackInfo> v;
    v.push_back({T_SHOLAWAT, "sholawat"});
    v.push_back({T_MARS, "mars-madrasah"});
    v.push_back({T_UPACARA, "upacara"});
    v.push_back({T_ISTIRAHAT1, "istirahat-1"});
    v.push_back({T_ISTIRAHAT2, "istirahat-2"});
    v.push_back({T_KEBERSIHAN, "kebersihan"});
    v.push_back({T_LITERASI, "literasi"});
    v.push_back({T_PEL1, "pelajaran-1"});
    v.push_back({T_PEL2, "pelajaran-2"});
    v.push_back({T_PEL3, "pelajaran-3"});
    v.push_back({T_PEL4, "pelajaran-4"});
    v.push_back({T_PEL5, "pelajaran-5"});
    v.push_back({T_PEL6, "pelajaran-6"});
    v.push_back({T_PEL7, "pelajaran-7"});
    v.push_back({T_PEL8, "pelajaran-8"});
    v.push_back({T_PEL9, "pelajaran-9"});
    v.push_back({T_PEL10, "pelajaran-10"});
    v.push_back({T_SELESAI, "pelajaran-selesai"});
    v.push_back({T_INDONESIA_RAYA, "indonesia-raya"});
    v.push_back({T_TANAH_AIRKU, "tanah-airku"});
    v.push_back({T_HYMNE, "hymne-madrasah"});
    v.push_back({T_ROHANI, "rohani"});
    v.push_back({T_AKHIR_PEKAN, "akhir-pekan"});
    v.push_back({T_PRAMUKA, "pramuka"});
    return v;
}

std::vector<BellSlot> defaultSchedule()
{
    std::vector<BellSlot> v;

    addSlot(v, MODE_REGULER, "06:30", "mon-fri", T_SHOLAWAT);
    addSlot(v, MODE_REGULER, "06:45", "mon-fri", T_MARS);
    addSlot(v, MODE_REGULER, "07:30", "mon-fri", T_PEL1);
    addSlot(v, MODE_REGULER, "07:50", "mon-fri", T_PEL1);
    addSlot(v, MODE_REGULER, "08:30", "mon-fri", T_PEL2);
    addSlot(v, MODE_REGULER, "09:10", "mon-fri", T_PEL3);
    addSlot(v, MODE_REGULER, "09:50", "mon-fri", T_ISTIRAHAT1);
    addSlot(v, MODE_REGULER, "10:05", "mon-fri", T_KEBERSIHAN);
    addSlot(v, MODE_REGULER, "10:10", "mon-fri", T_PEL4);
    addSlot(v, MODE_REGULER, "10:50", "mon-fri", T_PEL5);
    addSlot(v, MODE_REGULER, "11:30", "mon-fri", T_ISTIRAHAT2);
    addSlot(v, MODE_REGULER, "11:45", "mon-fri", T_KEBERSIHAN);
    addSlot(v, MODE_REGULER, "12:35", "mon-fri", T_KEBERSIHAN);
    addSlot(v, MODE_REGULER, "16:30", "mon-fri", T_TANAH_AIRKU);
    addSlot(v, MODE_REGULER, "12:40", "mon-thu", T_PEL6);
    addSlot(v, MODE_REGULER, "13:20", "mon-thu", T_PEL7);
    addSlot(v, MODE_REGULER, "14:00", "mon-thu", T_PEL8);
    addSlot(v, MODE_REGULER, "14:40", "mon-thu", T_PEL9);
    addSlot(v, MODE_REGULER, "15:20", "mon-thu", T_SELESAI);
    addSlot(v, MODE_REGULER, "15:21", "mon-thu", T_HYMNE);
    addSlot(v, MODE_REGULER, "07:00", "mon", T_UPACARA);
    addSlot(v, MODE_REGULER, "10:00", "mon", T_INDONESIA_RAYA);
    addSlot(v, MODE_REGULER, "07:00", "wed", T_LITERASI);
    addSlot(v, MODE_REGULER, "10:00", "thu", T_INDONESIA_RAYA);
    addSlot(v, MODE_REGULER, "07:00", "fri", T_ROHANI);
    addSlot(v, MODE_REGULER, "13:10", "fri", T_PEL6);
    addSlot(v, MODE_REGULER, "13:50", "fri", T_PEL7);
    addSlot(v, MODE_REGULER, "14:30", "fri", T_PEL8);
    addSlot(v, MODE_REGULER, "15:10", "fri", T_PRAMUKA);
    addSlot(v, MODE_REGULER, "16:00", "fri", T_AKHIR_PEKAN);

    return v;
}

bool saveScheduleLocked()
{
    DynamicJsonDocument d(SCHED_DOC_SIZE);
    JsonArray a = d.createNestedArray("slots");
    for (size_t i = 0; i < schedule.size(); i++)
    {
        BellSlot &s = schedule[i];
        JsonObject o = a.createNestedObject();
        o["mode"] = modeCode(s.mode);
        o["time"] = s.time;
        o["day"] = s.day;
        o["track"] = s.track;
        o["enabled"] = s.enabled;
    }
    String out;
    serializeJson(d, out);
    return fsWriteText(SCHEDULE_FILE, out);
}

void loadSchedule()
{
    String txt = fsReadText(SCHEDULE_FILE);
    Lock l(dataMutex);
    schedule.clear();
    if (txt.length() == 0)
    {
        schedule = defaultSchedule();
        sortSchedule();
        saveScheduleLocked();
        return;
    }
    DynamicJsonDocument d(SCHED_DOC_SIZE);
    if (deserializeJson(d, txt))
    {
        schedule = defaultSchedule();
        sortSchedule();
        saveScheduleLocked();
        return;
    }
    for (JsonObject o : d["slots"].as<JsonArray>())
    {
        BellSlot s;
        s.mode = modeFromCode(o["mode"] | "reguler");
        s.time = o["time"] | "";
        s.day = o["day"] | "";
        s.track = o["track"] | 0;
        s.enabled = o["enabled"] | true;
        if (validTime(s.time) && validDay(s.day) && s.track > 0 && schedule.size() < MAX_SLOTS)
            schedule.push_back(s);
    }
    sortSchedule();
}

bool saveTracksLocked()
{
    DynamicJsonDocument d(4096);
    JsonArray a = d.createNestedArray("tracks");
    for (size_t i = 0; i < trackList.size(); i++)
    {
        TrackInfo &t = trackList[i];
        JsonObject o = a.createNestedObject();
        o["track"] = t.track;
        o["label"] = t.label;
    }
    String out;
    serializeJson(d, out);
    return fsWriteText(TRACKS_FILE, out);
}

void loadTracks()
{
    String txt = fsReadText(TRACKS_FILE);
    Lock l(dataMutex);
    trackList.clear();
    if (txt.length() == 0)
    {
        trackList = defaultTracks();
        saveTracksLocked();
        return;
    }
    DynamicJsonDocument d(4096);
    if (deserializeJson(d, txt))
    {
        trackList = defaultTracks();
        saveTracksLocked();
        return;
    }
    for (JsonObject o : d["tracks"].as<JsonArray>())
    {
        TrackInfo t;
        t.track = o["track"] | 0;
        t.label = o["label"] | "";
        if (t.track > 0 && t.label.length() && trackList.size() < MAX_TRACKS)
            trackList.push_back(t);
    }
}

void dfpBegin()
{
    Lock l(dfpMutex);
    dfpSerial.end();
    dfpSerial.begin(9600, SERIAL_8N1, DFP_RX_PIN, DFP_TX_PIN);
    dfpReady = dfPlayer.begin(dfpSerial, true, true);
    if (dfpReady)
    {
        dfPlayer.volume(currentVolume);
        dfPlayer.EQ(DFPLAYER_EQ_NORMAL);
        dfPlayer.outputDevice(DFPLAYER_DEVICE_SD);
        Serial.println("DFPlayer siap");
    }
    else
    {
        Serial.println("DFPlayer tidak terdeteksi/kartu SD DFPlayer tidak ada");
    }
}

void dfpTick()
{
    Lock l(dfpMutex);
    if (!dfPlayer.available())
        return;
    uint8_t type = dfPlayer.readType();
    if (type == DFPlayerPlayFinished)
    {
        audioPlaying = false;
        playingTrack = 0;
    }
    else if (type == DFPlayerError)
    {
        audioPlaying = false;
        playingTrack = 0;
        Serial.println("DFPlayer error: " + String(dfPlayer.read()));
    }
}

void playTrack(uint16_t track)
{
    if (!dfpReady || track == 0)
        return;
    Lock l(dfpMutex);
    dfPlayer.playMp3Folder(track);
    audioPlaying = true;
    playingTrack = track;
    playStartedAt = millis();
    Serial.printf("Memutar track %d\n", track);
}

void stopTrack()
{
    if (dfpReady)
    {
        Lock l(dfpMutex);
        dfPlayer.stop();
    }
    audioPlaying = false;
    playingTrack = 0;
}

void setDfpVolume()
{
    if (!dfpReady)
        return;
    Lock l(dfpMutex);
    dfPlayer.volume(currentVolume);
}

void checkSchedule(const DateTime &now)
{
    if (holidayMode || !dfpReady)
        return;
    if (!timeTrusted) // jangan bunyi kalau waktu belum tepercaya
        return;
    if (sleeping) // BARU: jangan bunyi saat mode tidur
        return;

    uint32_t minuteKey = now.unixtime() / 60;
    if (minuteKey == lastTriggeredMinute)
        return;

    char timeBuf[6];
    snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d", now.hour(), now.minute());
    int dow = now.dayOfTheWeek();

    uint16_t track = 0;
    {
        Lock l(dataMutex);
        for (size_t i = 0; i < schedule.size(); i++)
        {
            BellSlot &s = schedule[i];
            if (s.mode != activeMode)
                continue;
            if (!s.enabled || s.time != timeBuf || !dayMatches(s.day, dow))
                continue;
            track = s.track;
            break;
        }
    }
    if (track)
    {
        lastTriggeredMinute = minuteKey;
        Serial.printf("Memicu bel %s: track %d (uptime %lus)\n", timeBuf, track, millis() / 1000UL);
        playTrack(track);
    }
}

void bellTask(void *param)
{
    unsigned long lastDfpTry = 0;
    unsigned long lastRtcCheck = 0;
    for (;;)
    {
        if (!dfpReady && millis() - lastDfpTry > DFP_RETRY_INTERVAL)
        {
            lastDfpTry = millis();
            dfpBegin();
        }

        // cek RTC masih berjalan, tiap 5 detik
        if (millis() - lastRtcCheck > 5000)
        {
            lastRtcCheck = millis();
            if (!rtcPresent || !rtcRunning())
            {
                if (timeTrusted)
                    Serial.println("RTC berhenti/tidak terbaca, bel dikunci");
                setTrusted(false);
            }
        }

        DateTime now = getNow();
        validateTime(now);

        // BARU: perbarui status tidur (hanya jika waktu tepercaya)
        bool nowSleep = timeTrusted && isSleepTime(now);
        if (nowSleep && !sleeping)
        {
            Serial.println("Masuk mode tidur");
            if (audioPlaying)
                stopTrack();
        }
        else if (!nowSleep && sleeping)
        {
            Serial.println("Keluar mode tidur");
        }
        sleeping = nowSleep;

        checkSchedule(now);

        if (dfpReady)
            dfpTick();
        vTaskDelay(pdMS_TO_TICKS(300));
    }
}

void syncTimeFromNTP()
{
    lastNtpAttempt = millis();
    configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
    struct tm ti;
    if (getLocalTime(&ti, 5000) && (ti.tm_year + 1900) >= MIN_VALID_YEAR)
    {
        DateTime ntp(ti.tm_year + 1900, ti.tm_mon + 1, ti.tm_mday, ti.tm_hour, ti.tm_min, ti.tm_sec);
        long diff = (long)ntp.unixtime() - (long)getNow().unixtime();
        if (diff > 2 || diff < -2)
        {
            setRtc(ntp);
            Serial.println("RTC disinkronkan via NTP");
        }
        else
        {
            Serial.println("NTP OK, RTC sudah akurat");
        }
        setTrusted(true);
        ntpLastOk = true;
    }
    else
    {
        ntpLastOk = false;
        Serial.println("Sinkronisasi NTP gagal, coba lagi 1 menit");
    }
}

String storedSsid()
{
    wifi_config_t c;
    if (esp_wifi_get_config(WIFI_IF_STA, &c) != ESP_OK)
        return "";
    return String((const char *)c.sta.ssid);
}
void startFallbackAP()
{
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAPConfig(AP_IP, AP_IP, AP_MASK);
    WiFi.softAP(AP_SSID, AP_PASS);
    apActive = true;
    Serial.println("Mode AP aktif: http://192.168.4.1");
}
void stopFallbackAP()
{
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);
    WiFi.setTxPower(WIFI_POWER_11dBm);
    apActive = false;
    Serial.println("AP dimatikan, WiFi tersambung");
}
void onWifiConnected()
{
    WiFi.setSleep(WIFI_PS_MIN_MODEM);
    if (apActive)
        stopFallbackAP();
    MDNS.end();
    if (MDNS.begin("bel-madrasah"))
        MDNS.addService("http", "tcp", 80);
    lastNtpAttempt = 0;
    Serial.println("WiFi terkoneksi: " + WiFi.localIP().toString());
}
void networkTick()
{
    if (!wifiSetupDone)
        return;
    static bool wasConnected = false;
    static unsigned long disconnectedSince = 0;
    static unsigned long lastReconnect = 0;
    bool connected = WiFi.status() == WL_CONNECTED;
    if (connected)
    {
        if (!wasConnected)
            onWifiConnected();
        wasConnected = true;
        disconnectedSince = 0;
        return;
    }
    wasConnected = false;
    if (disconnectedSince == 0)
        disconnectedSince = millis();
    if (!apActive && millis() - disconnectedSince > 20000)
        startFallbackAP();
    if (millis() - lastReconnect > (apActive ? 180000UL : 60000UL))
    {
        lastReconnect = millis();
        WiFi.reconnect();
    }
}

void connectWiFi()
{
    WiFi.mode(WIFI_STA);
    WiFi.setTxPower(WIFI_POWER_11dBm);
    WiFi.setAutoReconnect(true);

    bool hadSaved = storedSsid().length() > 0;

    WiFiManager wm;
    wm.setConnectTimeout(15);
    wm.setConfigPortalTimeout(120);
    wm.setEnableConfigPortal(!hadSaved);
    wm.setAPStaticIPConfig(AP_IP, AP_IP, AP_MASK);

    if (staticCfg.enabled)
    {
        IPAddress ip, gw, mask, dns;
        bool valid = ip.fromString(staticCfg.ip) && gw.fromString(staticCfg.gw) && mask.fromString(staticCfg.mask);
        if (!dns.fromString(staticCfg.dns))
            dns = gw;
        String saved = storedSsid();
        if (valid && saved.length() && saved == staticCfg.ssid)
        {
            wm.setSTAStaticIPConfig(ip, gw, mask, dns);
            Serial.println("Memakai IP statis: " + staticCfg.ip);
        }
        else
        {
            staticCfg.enabled = false;
            saveConfig();
            Serial.println("IP statis dinonaktifkan (jaringan berbeda)");
        }
    }

    bool ok = wm.autoConnect(AP_SSID, AP_PASS);
    if (!ok)
    {
        Serial.println("WiFi tidak terkoneksi, memakai AP + RTC");
        startFallbackAP();
    }
    else if (!hadSaved)
    {
        Serial.println("WiFi baru tersimpan, restart...");
        delay(1000);
        ESP.restart();
    }
}

bool parseSlot(AsyncWebServerRequest *r, BellSlot &s, String &err)
{
    s.mode = modeFromCode(postParam(r, "mode"));
    s.day = postParam(r, "day");
    s.time = postParam(r, "time");
    s.track = postParam(r, "track").toInt();
    s.enabled = postParam(r, "enabled") != "0";
    if (!validDay(s.day))
    {
        err = "Hari tidak valid";
        return false;
    }
    if (!validTime(s.time))
    {
        err = "Jam tidak valid";
        return false;
    }
    if (s.track == 0 || s.track > 2999)
    {
        err = "Nomor track tidak valid";
        return false;
    }
    return true;
}

const char *DFP_MISSING = "DFPlayer/kartu SD tidak terdeteksi";

void setupWebServer()
{
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *r)
              { r->send_P(200, "text/html", INDEX_HTML); });

    server.on("/api/status", HTTP_GET, [](AsyncWebServerRequest *r)
              {
    DateTime now = getNow();
    char tb[24];
    snprintf(tb, sizeof(tb), "%04d-%02d-%02d %02d:%02d:%02d",
             now.year(), now.month(), now.day(), now.hour(), now.minute(), now.second());
    bool sta = WiFi.status() == WL_CONNECTED;
    StaticJsonDocument<640> d; // UBAH: dari 448
    d["time"] = tb;
    d["dow"] = now.dayOfTheWeek();
    d["mode"] = sta ? "STA" : "AP";
    d["ip"] = sta ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
    d["rssi"] = sta ? WiFi.RSSI() : 0;
    d["volume"] = currentVolume;
    d["holiday"] = holidayMode;
    d["sched_mode"] = modeCode(activeMode);
    d["dfp"] = (bool)dfpReady;
    d["playing"] = (bool)audioPlaying;
    d["track"] = playingTrack;
    d["trusted"] = (bool)timeTrusted;
    d["sleeping"] = (bool)sleeping;               // BARU
    d["sleep_on"] = (bool)sleepEnabled;           // BARU
    d["sleep_start"] = minToStr(sleepStartMin);   // BARU
    d["sleep_end"] = minToStr(sleepEndMin);       // BARU
    String out;
    serializeJson(d, out);
    r->send(200, "application/json", out); });

    // BARU: baca pengaturan mode tidur
    server.on("/api/sleep", HTTP_GET, [](AsyncWebServerRequest *r)
              {
    StaticJsonDocument<256> d;
    d["enabled"] = (bool)sleepEnabled;
    d["start"] = minToStr(sleepStartMin);
    d["end"] = minToStr(sleepEndMin);
    d["oled"] = (bool)sleepOledOff;
    d["sleeping"] = (bool)sleeping;
    String out;
    serializeJson(d, out);
    r->send(200, "application/json", out); });

    // BARU: simpan pengaturan mode tidur
    server.on("/api/sleep", HTTP_POST, [](AsyncWebServerRequest *r)
              {
    bool en = postParam(r, "enabled") == "1";
    String st = postParam(r, "start");
    String ed = postParam(r, "end");
    bool oledOff = postParam(r, "oled") == "1";
    if (!validTime(st) || !validTime(ed))
      return sendResult(r, false, "Format jam tidak valid");
    int sm = strToMin(st, 0), em = strToMin(ed, 0);
    if (en && sm == em)
      return sendResult(r, false, "Jam mulai dan selesai tidak boleh sama");
    sleepStartMin = sm;
    sleepEndMin = em;
    sleepOledOff = oledOff;
    sleepEnabled = en;
    bool saved = saveConfig();
    sendResult(r, true, String(en ? "Mode tidur aktif " + st + " - " + ed : "Mode tidur nonaktif") + (saved ? "" : " (gagal disimpan)")); });

    server.on("/api/ring", HTTP_POST, [](AsyncWebServerRequest *r)
              {
    if (!dfpReady) return sendResult(r, false, DFP_MISSING);
    int track = postParam(r, "track").toInt();
    if (track <= 0) return sendResult(r, false, "Nomor track tidak valid");
    playTrack(track);
    sendResult(r, true, "Memutar track " + String(track)); });

    server.on("/api/stop", HTTP_POST, [](AsyncWebServerRequest *r)
              {
    stopTrack();
    sendResult(r, true, "Bel dihentikan"); });

    server.on("/api/time/set", HTTP_POST, [](AsyncWebServerRequest *r)
              {
    // format: date=YYYY-MM-DD, time=HH:MM
    String date = postParam(r, "date");
    String tm = postParam(r, "time");
    if (date.length() != 10 || date[4] != '-' || date[7] != '-' || !validTime(tm))
      return sendResult(r, false, "Format tanggal/jam tidak valid");
    int y = date.substring(0, 4).toInt();
    int mo = date.substring(5, 7).toInt();
    int d = date.substring(8, 10).toInt();
    if (y < MIN_VALID_YEAR || y > 2099 || mo < 1 || mo > 12 || d < 1 || d > 31)
      return sendResult(r, false, "Tanggal tidak valid");
    if (!rtcPresent) return sendResult(r, false, "RTC tidak terdeteksi");
    setRtc(DateTime(y, mo, d, tm.substring(0, 2).toInt(), tm.substring(3, 5).toInt(), 0));
    setTrusted(true);
    sendResult(r, true, "Waktu diatur"); });

    server.on("/api/volume", HTTP_POST, [](AsyncWebServerRequest *r)
              {
    currentVolume = constrain(postParam(r, "value").toInt(), 0, 30);
    setDfpVolume();
    bool saved = saveConfig();
    sendResult(r, true, "Volume " + String(currentVolume) + "/30" + (saved ? "" : " (gagal disimpan)")); });

    server.on("/api/holiday", HTTP_POST, [](AsyncWebServerRequest *r)
              {
    holidayMode = postParam(r, "value") == "1";
    bool saved = saveConfig();
    sendResult(r, true, String(holidayMode ? "Mode libur aktif" : "Mode libur nonaktif") + (saved ? "" : " (gagal disimpan)")); });

    server.on("/api/mode", HTTP_GET, [](AsyncWebServerRequest *r)
              {
    StaticJsonDocument<128> d;
    d["mode"] = modeCode(activeMode);
    String out;
    serializeJson(d, out);
    r->send(200, "application/json", out); });
    server.on("/api/mode", HTTP_POST, [](AsyncWebServerRequest *r)
              {
    activeMode = modeFromCode(postParam(r, "value"));
    bool saved = saveConfig();
    sendResult(r, true, String("Mode aktif: ") + modeCode(activeMode) + (saved ? "" : " (gagal disimpan)")); });

    server.on("/api/schedule", HTTP_GET, [](AsyncWebServerRequest *r)
              {
    ScheduleMode filter = MODE_REGULER;
    bool hasFilter = r->hasParam("mode");
    if (hasFilter) filter = modeFromCode(r->getParam("mode")->value());

    DynamicJsonDocument d(SCHED_DOC_SIZE);
    JsonArray a = d.createNestedArray("slots");
    {
      Lock l(dataMutex);
      int i = 0;
      for (size_t k = 0; k < schedule.size(); k++) {
        BellSlot &s = schedule[k];
        if (hasFilter && s.mode != filter) {
          i++;
          continue;
        }
        JsonObject o = a.createNestedObject();
        o["id"] = i++;
        o["mode"] = modeCode(s.mode);
        o["day"] = s.day;
        o["time"] = s.time;
        o["track"] = s.track;
        o["enabled"] = s.enabled;
      }
    }
    d["max"] = MAX_SLOTS;
    AsyncResponseStream *res = r->beginResponseStream("application/json");
    serializeJson(d, *res);
    r->send(res); });

    server.on("/api/schedule/add", HTTP_POST, [](AsyncWebServerRequest *r)
              {
    BellSlot s;
    String err;
    if (!parseSlot(r, s, err)) return sendResult(r, false, err);
    bool full = false, saved = true;
    {
      Lock l(dataMutex);
      if (schedule.size() >= MAX_SLOTS) full = true;
      else {
        schedule.push_back(s);
        sortSchedule();
        saved = saveScheduleLocked();
      }
    }
    if (full) return sendResult(r, false, "Jadwal penuh (maks " + String(MAX_SLOTS) + ")");
    if (!saved) return sendResult(r, false, "Gagal menyimpan jadwal");
    sendResult(r, true, "Jadwal ditambahkan"); });

    server.on("/api/schedule/update", HTTP_POST, [](AsyncWebServerRequest *r)
              {
    BellSlot s;
    String err;
    if (!parseSlot(r, s, err)) return sendResult(r, false, err);
    int id = postParam(r, "id").toInt();
    bool found = false, saved = true;
    {
      Lock l(dataMutex);
      if (id >= 0 && id < (int)schedule.size()) {
        schedule[id] = s;
        sortSchedule();
        saved = saveScheduleLocked();
        found = true;
      }
    }
    if (!found) return sendResult(r, false, "Jadwal tidak ditemukan");
    if (!saved) return sendResult(r, false, "Gagal menyimpan jadwal");
    sendResult(r, true, "Jadwal disimpan"); });

    server.on("/api/schedule/delete", HTTP_POST, [](AsyncWebServerRequest *r)
              {
    int id = postParam(r, "id").toInt();
    bool found = false, saved = true;
    {
      Lock l(dataMutex);
      if (id >= 0 && id < (int)schedule.size()) {
        schedule.erase(schedule.begin() + id);
        saved = saveScheduleLocked();
        found = true;
      }
    }
    if (!found) return sendResult(r, false, "Jadwal tidak ditemukan");
    if (!saved) return sendResult(r, false, "Gagal menyimpan jadwal");
    sendResult(r, true, "Jadwal dihapus"); });

    server.on("/api/tracks", HTTP_GET, [](AsyncWebServerRequest *r)
              {
    DynamicJsonDocument d(4096);
    JsonArray a = d.createNestedArray("tracks");
    {
      Lock l(dataMutex);
      for (size_t i = 0; i < trackList.size(); i++) {
        TrackInfo &t = trackList[i];
        JsonObject o = a.createNestedObject();
        o["track"] = t.track;
        o["label"] = t.label;
      }
    }
    AsyncResponseStream *res = r->beginResponseStream("application/json");
    serializeJson(d, *res);
    r->send(res); });

    server.on("/api/tracks/add", HTTP_POST, [](AsyncWebServerRequest *r)
              {
    int track = postParam(r, "track").toInt();
    String label = postParam(r, "label");
    label.trim();
    if (track <= 0 || track > 2999) return sendResult(r, false, "Nomor track tidak valid");
    if (label.length() == 0 || label.length() > 40) return sendResult(r, false, "Nama tidak valid");
    bool full = false, saved = true;
    {
      Lock l(dataMutex);
      bool replaced = false;
      for (size_t i = 0; i < trackList.size(); i++) {
        if (trackList[i].track == track) {
          trackList[i].label = label;
          replaced = true;
          break;
        }
      }
      if (!replaced) {
        if (trackList.size() >= MAX_TRACKS) full = true;
        else {
          TrackInfo t;
          t.track = (uint16_t)track;
          t.label = label;
          trackList.push_back(t);
        }
      }
      if (!full) saved = saveTracksLocked();
    }
    if (full) return sendResult(r, false, "Daftar track penuh (maks " + String(MAX_TRACKS) + ")");
    if (!saved) return sendResult(r, false, "Gagal menyimpan");
    sendResult(r, true, "Nama track disimpan"); });

    server.on("/api/tracks/delete", HTTP_POST, [](AsyncWebServerRequest *r)
              {
    int track = postParam(r, "track").toInt();
    bool used = false, saved = true;
    {
      Lock l(dataMutex);
      for (size_t i = 0; i < schedule.size(); i++) {
        if (schedule[i].track == track) {
          used = true;
          break;
        }
      }
      if (!used) {
        std::vector<TrackInfo> filtered;
        for (size_t i = 0; i < trackList.size(); i++)
          if (trackList[i].track != track) filtered.push_back(trackList[i]);
        trackList = filtered;
        saved = saveTracksLocked();
      }
    }
    if (used) return sendResult(r, false, "Track masih dipakai jadwal. Ubah/hapus jadwalnya dulu.");
    sendResult(r, saved, saved ? "Nama track dihapus" : "Gagal menyimpan"); });

    server.on("/api/network", HTTP_GET, [](AsyncWebServerRequest *r)
              {
    StaticJsonDocument<512> d;
    bool sta = WiFi.status() == WL_CONNECTED;
    d["mode"] = sta ? "STA" : "AP";
    d["ssid"] = sta ? WiFi.SSID() : String(AP_SSID);
    d["ip"] = sta ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
    if (sta) {
      uint32_t m = ip2u(WiFi.subnetMask());
      uint32_t n = ip2u(WiFi.localIP()) & m;
      uint32_t b = n | ~m;
      d["gateway"] = WiFi.gatewayIP().toString();
      d["mask"] = WiFi.subnetMask().toString();
      d["range_start"] = u2ip(n + 1).toString();
      d["range_end"] = u2ip(b - 1).toString();
    }
    d["static_enabled"] = staticCfg.enabled;
    d["static_ip"] = staticCfg.ip;
    String out;
    serializeJson(d, out);
    r->send(200, "application/json", out); });

    server.on("/api/network/static", HTTP_POST, [](AsyncWebServerRequest *r)
              {
    bool en = postParam(r, "enabled") == "1";
    String newIp = "";
    if (!en) {
      staticCfg.enabled = false;
    } else {
      if (WiFi.status() != WL_CONNECTED) return sendResult(r, false, "Harus terhubung ke WiFi untuk mengatur IP statis");
      IPAddress ip;
      if (!ip.fromString(postParam(r, "ip"))) return sendResult(r, false, "Format IP tidak valid");

      IPAddress cur = WiFi.localIP(), mask = WiFi.subnetMask(), gw = WiFi.gatewayIP();
      uint32_t m = ip2u(mask), n = ip2u(cur) & m, b = n | ~m, v = ip2u(ip);
      if ((v & m) != n) return sendResult(r, false, "IP di luar rentang jaringan (" + u2ip(n + 1).toString() + " - " + u2ip(b - 1).toString() + ")");
      if (v == n || v == b) return sendResult(r, false, "IP tidak boleh alamat network/broadcast");
      if (ip == gw) return sendResult(r, false, "IP sama dengan gateway");

      IPAddress dns = WiFi.dnsIP();
      if (ip2u(dns) == 0) dns = gw;
      staticCfg.enabled = true;
      staticCfg.ssid = WiFi.SSID();
      staticCfg.ip = ip.toString();
      staticCfg.gw = gw.toString();
      staticCfg.mask = mask.toString();
      staticCfg.dns = dns.toString();
      newIp = staticCfg.ip;
    }
    if (!saveConfig()) return sendResult(r, false, "Gagal menyimpan konfigurasi");
    restartPending = true;
    restartAt = millis() + 1500;

    StaticJsonDocument<256> d;
    d["ok"] = true;
    d["msg"] = en ? "Tersimpan. Restart, buka http://" + newIp : "IP statis dimatikan. Restart (IP dari DHCP).";
    d["new_ip"] = newIp;
    String out;
    serializeJson(d, out);
    r->send(200, "application/json", out); });

    server.on("/api/network/reset", HTTP_POST, [](AsyncWebServerRequest *r)
              {
    staticCfg.enabled = false;
    saveConfig();
    wifiResetPending = true;
    restartPending = true;
    restartAt = millis() + 1500;
    sendResult(r, true, "WiFi direset, restart... Sambung ke AP 192.168.4.1"); });

    server.onNotFound([](AsyncWebServerRequest *r)
                      { sendResult(r, false, "Tidak ditemukan", 404); });
}

void wifiTask(void *param)
{
    connectWiFi();
    setupWebServer();
    server.begin();
    wifiSetupDone = true;
    Serial.println("Web server aktif, IP: " + (WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString()));
    vTaskDelete(NULL);
}

void setup()
{
    setCpuFrequencyMhz(80);
    Serial.begin(115200);
    delay(1000);

    i2cMutex = xSemaphoreCreateMutex();
    dataMutex = xSemaphoreCreateMutex();
    dfpMutex = xSemaphoreCreateMutex();

    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

    oledReady = oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
    if (!oledReady)
        Serial.println("OLED SSD1306 tidak terdeteksi!");
    else
        oledShow("BEL MADRASAH", "Memulai...");

    // Inisialisasi RTC dengan penanda kepercayaan di NVRAM
    rtcPresent = rtc.begin();
    if (!rtcPresent)
    {
        Serial.println("RTC DS1307 tidak terdeteksi! Bel dikunci sampai waktu valid");
        timeTrusted = false;
    }
    else if (!rtc.isrunning())
    {
        Serial.println("RTC belum berjalan. Waktu sementara, bel dikunci sampai NTP/manual");
        rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
        rtc.writenvram(TRUST_ADDR, 0x00);
        timeTrusted = false;
    }
    else
    {
        DateTime n = rtc.now();
        bool yearOk = (n.year() >= MIN_VALID_YEAR && n.year() <= 2099);
        timeTrusted = yearOk && (rtc.readnvram(TRUST_ADDR) == TRUST_MAGIC);
        if (!timeTrusted)
            Serial.println("Waktu RTC belum pernah diverifikasi, bel dikunci");
    }

    if (!LittleFS.begin(true))
    {
        Serial.println("LittleFS gagal mount");
    }
    loadConfig();
    loadSchedule();
    loadTracks();

    dfpBegin();

    xTaskCreate(oledTask, "oledTask", 4096, NULL, 1, NULL);
    xTaskCreate(bellTask, "bellTask", 6144, NULL, 1, NULL);
    xTaskCreate(wifiTask, "wifiTask", 10240, NULL, 1, NULL);
}

void loop()
{
    networkTick();

    if (wifiSetupDone && WiFi.status() == WL_CONNECTED)
    {
        unsigned long interval = ntpLastOk ? NTP_SYNC_INTERVAL : 60000UL;
        if (lastNtpAttempt == 0 || millis() - lastNtpAttempt > interval)
            syncTimeFromNTP();
    }

    if (restartPending && millis() >= restartAt)
    {
        if (wifiResetPending)
        {
            WiFiManager wm;
            wm.resetSettings();
        }
        ESP.restart();
    }

    delay(500);
}