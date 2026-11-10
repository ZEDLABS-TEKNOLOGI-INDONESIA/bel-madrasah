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
#include "bell_logic.h"
#include "index_html.h"

#define FW_VERSION "1.1.0"

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
const uint16_t MAX_TRACK_NO = 2999;
const unsigned long NTP_SYNC_INTERVAL = 3600000UL;
const unsigned long NTP_RETRY_INTERVAL = 60000UL;
const unsigned long DFP_RETRY_INTERVAL = 5000UL;
const unsigned long RTC_CHECK_INTERVAL = 5000UL;
const int RTC_STOP_LIMIT = 3;
const unsigned long PLAY_TIMEOUT = 15UL * 60UL * 1000UL;
const unsigned long BELL_TICK_MS = 300;
const time_t SYSTEM_TIME_VALID_AFTER = 1735689600;

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
bool validModeCode(const String &s)
{
    return s == "reguler" || s == "ramadhan" || s == "pts" || s == "pas";
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
volatile int currentVolume = 20;
volatile bool holidayMode = false;
volatile ScheduleMode activeMode = MODE_REGULER;

volatile bool sleepEnabled = false;
volatile int sleepStartMin = 18 * 60;
volatile int sleepEndMin = 5 * 60;
volatile bool sleepOledOff = true;
volatile bool sleeping = false;

volatile bool dfpReady = false;
volatile bool sdPresent = true;
volatile bool wifiSetupDone = false;
bool apActive = false;
volatile bool restartPending = false;
volatile bool wifiResetPending = false;
unsigned long restartAt = 0;

unsigned long lastNtpAttempt = 0;
bool ntpLastOk = false;
uint32_t lastTriggeredMinute = 0;

volatile bool timeTrusted = false;
volatile bool rtcPresent = false;
bell::TimeGuard timeGuard;

volatile bool audioPlaying = false;
volatile uint16_t playingTrack = 0;
unsigned long playStartedAt = 0;
String lastDfpError;
String lastBell;

SemaphoreHandle_t i2cMutex;
SemaphoreHandle_t dataMutex;
SemaphoreHandle_t timeMutex;
SemaphoreHandle_t cfgMutex;
SemaphoreHandle_t infoMutex;

QueueHandle_t audioQueue;

struct Lock
{
    SemaphoreHandle_t m;
    explicit Lock(SemaphoreHandle_t mm) : m(mm) { xSemaphoreTake(m, portMAX_DELAY); }
    ~Lock() { xSemaphoreGive(m); }
};

void setInfo(String &field, const String &value)
{
    Lock l(infoMutex);
    field = value;
}
String getInfo(const String &field)
{
    Lock l(infoMutex);
    return field;
}

bool queueAudio(AudioCmdType type, uint16_t arg = 0)
{
    AudioCmd c{type, arg};
    return xQueueSend(audioQueue, &c, 0) == pdTRUE;
}

DateTime readRtc()
{
    Lock l(i2cMutex);
    return rtc.now();
}

DateTime readSystemClock()
{
    time_t t = time(nullptr);
    if (t < SYSTEM_TIME_VALID_AFTER)
        return DateTime((uint32_t)0);
    struct tm ti;
    localtime_r(&t, &ti);
    return DateTime(ti.tm_year + 1900, ti.tm_mon + 1, ti.tm_mday, ti.tm_hour, ti.tm_min, ti.tm_sec);
}

DateTime getNow()
{
    return rtcPresent ? readRtc() : readSystemClock();
}

bool rtcRunning()
{
    Lock l(i2cMutex);
    return rtc.isrunning();
}

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

void applyVerifiedTime(const DateTime *dt)
{
    Lock t(timeMutex);
    if (dt && rtcPresent)
    {
        Lock l(i2cMutex);
        rtc.adjust(*dt);
    }
    timeGuard.reset();
    setTrusted(true);
}

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

void oledShow(const String &label, String value, bool big = false)
{
    Lock l(i2cMutex);
    if (!oledReady)
        return;
    oled.clearDisplay();
    oled.setTextColor(SSD1306_WHITE);
    oledDrawCentered(label, 0, 1);
    if (big)
        oledDrawCentered(value, 14, 2);
    else
    {
        if (value.length() > 21)
            value = value.substring(0, 21);
        oledDrawCentered(value, 18, 1);
    }
    oled.display();
}

void oledTask(void *param)
{
    for (;;)
    {
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
            else if (sleeping)
            {
                char eb[16];
                snprintf(eb, sizeof(eb), "s/d %02d:%02d", sleepEndMin / 60, sleepEndMin % 60);
                oledShow("MODE TIDUR", eb, false);
            }
            else
                oledShow("WAKTU", tb, true);
        }
        else if (screen == 1)
            oledShow("IP ADDRESS", sta ? WiFi.localIP().toString() : WiFi.softAPIP().toString());
        else
            oledShow("NAMA WIFI", sta ? WiFi.SSID() : String(AP_SSID));
        vTaskDelay(pdMS_TO_TICKS(500));
    }
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
void sendJson(AsyncWebServerRequest *r, JsonDocument &d, int code = 200)
{
    String out;
    serializeJson(d, out);
    r->send(code, "application/json", out);
}
void sendResult(AsyncWebServerRequest *r, bool ok, const String &msg, int code = 0)
{
    JsonDocument d;
    d["ok"] = ok;
    d["msg"] = msg;
    sendJson(r, d, code ? code : (ok ? 200 : 400));
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

void fillConfigJson(JsonObject d, bool includeNetwork)
{
    d["volume"] = (int)currentVolume;
    d["holiday"] = (bool)holidayMode;
    d["mode"] = modeCode(activeMode);
    if (includeNetwork)
    {
        JsonObject s = d["static"].to<JsonObject>();
        s["enabled"] = staticCfg.enabled;
        s["ssid"] = staticCfg.ssid;
        s["ip"] = staticCfg.ip;
        s["gw"] = staticCfg.gw;
        s["mask"] = staticCfg.mask;
        s["dns"] = staticCfg.dns;
    }
    JsonObject sl = d["sleep"].to<JsonObject>();
    sl["enabled"] = (bool)sleepEnabled;
    sl["start"] = minToStr(sleepStartMin);
    sl["end"] = minToStr(sleepEndMin);
    sl["oled"] = (bool)sleepOledOff;
}

void applyConfigJson(JsonObjectConst d, bool includeNetwork)
{
    currentVolume = constrain((int)(d["volume"] | 20), 0, 30);
    holidayMode = d["holiday"] | false;
    activeMode = modeFromCode(d["mode"] | "reguler");
    if (includeNetwork)
    {
        JsonObjectConst s = d["static"];
        staticCfg.enabled = s["enabled"] | false;
        staticCfg.ssid = s["ssid"] | "";
        staticCfg.ip = s["ip"] | "";
        staticCfg.gw = s["gw"] | "";
        staticCfg.mask = s["mask"] | "";
        staticCfg.dns = s["dns"] | "";
    }
    JsonObjectConst sl = d["sleep"];
    sleepEnabled = sl["enabled"] | false;
    sleepStartMin = bell::timeToMin(sl["start"] | "18:00", 18 * 60);
    sleepEndMin = bell::timeToMin(sl["end"] | "05:00", 5 * 60);
    sleepOledOff = sl["oled"] | true;
}

bool saveConfig()
{
    Lock c(cfgMutex);
    JsonDocument d;
    fillConfigJson(d.to<JsonObject>(), true);
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
    JsonDocument d;
    if (deserializeJson(d, txt))
        return;
    Lock c(cfgMutex);
    applyConfigJson(d.as<JsonObjectConst>(), true);
}

void sortScheduleLocked()
{
    std::stable_sort(schedule.begin(), schedule.end(), [](const BellSlot &a, const BellSlot &b)
                     {
        if (a.mode != b.mode) return a.mode < b.mode;
        int da = bell::dayRank(a.day.c_str()), db = bell::dayRank(b.day.c_str());
        if (da != db) return da < db;
        return a.time < b.time; });
}

uint32_t slotSig(const BellSlot &s)
{
    return bell::slotSignature((int)s.mode, s.day.c_str(), s.time.c_str(), s.track);
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
    return {
        {T_SHOLAWAT, "sholawat"},
        {T_MARS, "mars-madrasah"},
        {T_UPACARA, "upacara"},
        {T_ISTIRAHAT1, "istirahat-1"},
        {T_ISTIRAHAT2, "istirahat-2"},
        {T_KEBERSIHAN, "kebersihan"},
        {T_LITERASI, "literasi"},
        {T_PEL1, "pelajaran-1"},
        {T_PEL2, "pelajaran-2"},
        {T_PEL3, "pelajaran-3"},
        {T_PEL4, "pelajaran-4"},
        {T_PEL5, "pelajaran-5"},
        {T_PEL6, "pelajaran-6"},
        {T_PEL7, "pelajaran-7"},
        {T_PEL8, "pelajaran-8"},
        {T_PEL9, "pelajaran-9"},
        {T_PEL10, "pelajaran-10"},
        {T_SELESAI, "pelajaran-selesai"},
        {T_INDONESIA_RAYA, "indonesia-raya"},
        {T_TANAH_AIRKU, "tanah-airku"},
        {T_HYMNE, "hymne-madrasah"},
        {T_ROHANI, "rohani"},
        {T_AKHIR_PEKAN, "akhir-pekan"},
        {T_PRAMUKA, "pramuka"},
    };
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

void fillScheduleJson(JsonArray a, bool withIds)
{
    for (size_t i = 0; i < schedule.size(); i++)
    {
        const BellSlot &s = schedule[i];
        JsonObject o = a.add<JsonObject>();
        if (withIds)
        {
            o["id"] = i;
            o["sig"] = slotSig(s);
        }
        o["mode"] = modeCode(s.mode);
        o["time"] = s.time;
        o["day"] = s.day;
        o["track"] = s.track;
        o["enabled"] = s.enabled;
    }
}

bool parseScheduleJson(JsonArrayConst a, std::vector<BellSlot> &out, String &err)
{
    out.clear();
    for (JsonObjectConst o : a)
    {
        BellSlot s;
        String mode = o["mode"] | "reguler";
        s.mode = modeFromCode(mode);
        s.time = o["time"] | "";
        s.day = o["day"] | "";
        s.track = o["track"] | 0;
        s.enabled = o["enabled"] | true;
        if (!validModeCode(mode) || !bell::validTime(s.time.c_str()) || !bell::validDay(s.day.c_str()) ||
            s.track == 0 || s.track > MAX_TRACK_NO)
        {
            err = "Jadwal ke-" + String(out.size() + 1) + " tidak valid";
            return false;
        }
        if (out.size() >= MAX_SLOTS)
        {
            err = "Jadwal melebihi " + String(MAX_SLOTS);
            return false;
        }
        out.push_back(s);
    }
    return true;
}

bool saveScheduleLocked()
{
    JsonDocument d;
    fillScheduleJson(d["slots"].to<JsonArray>(), false);
    String out;
    serializeJson(d, out);
    return fsWriteText(SCHEDULE_FILE, out);
}

void resetScheduleLocked()
{
    schedule = defaultSchedule();
    sortScheduleLocked();
    saveScheduleLocked();
}

void loadSchedule()
{
    String txt = fsReadText(SCHEDULE_FILE);
    Lock l(dataMutex);
    if (txt.length() == 0)
    {
        resetScheduleLocked();
        return;
    }
    JsonDocument d;
    if (deserializeJson(d, txt))
    {
        Serial.println("schedule.json rusak, memakai jadwal bawaan");
        resetScheduleLocked();
        return;
    }
    schedule.clear();
    for (JsonObjectConst o : d["slots"].as<JsonArrayConst>())
    {
        BellSlot s;
        s.mode = modeFromCode(o["mode"] | "reguler");
        s.time = o["time"] | "";
        s.day = o["day"] | "";
        s.track = o["track"] | 0;
        s.enabled = o["enabled"] | true;
        if (bell::validTime(s.time.c_str()) && bell::validDay(s.day.c_str()) && s.track > 0 && schedule.size() < MAX_SLOTS)
            schedule.push_back(s);
    }
    sortScheduleLocked();
}

void fillTracksJson(JsonArray a)
{
    for (const TrackInfo &t : trackList)
    {
        JsonObject o = a.add<JsonObject>();
        o["track"] = t.track;
        o["label"] = t.label;
    }
}

bool parseTracksJson(JsonArrayConst a, std::vector<TrackInfo> &out, String &err)
{
    out.clear();
    for (JsonObjectConst o : a)
    {
        TrackInfo t;
        t.track = o["track"] | 0;
        t.label = o["label"] | "";
        t.label.trim();
        if (t.track == 0 || t.track > MAX_TRACK_NO || t.label.length() == 0 || t.label.length() > 40)
        {
            err = "Track ke-" + String(out.size() + 1) + " tidak valid";
            return false;
        }
        if (out.size() >= MAX_TRACKS)
        {
            err = "Track melebihi " + String(MAX_TRACKS);
            return false;
        }
        out.push_back(t);
    }
    return true;
}

bool saveTracksLocked()
{
    JsonDocument d;
    fillTracksJson(d["tracks"].to<JsonArray>());
    String out;
    serializeJson(d, out);
    return fsWriteText(TRACKS_FILE, out);
}

void loadTracks()
{
    String txt = fsReadText(TRACKS_FILE);
    Lock l(dataMutex);
    JsonDocument d;
    std::vector<TrackInfo> parsed;
    String err;
    if (txt.length() == 0 || deserializeJson(d, txt) ||
        !parseTracksJson(d["tracks"].as<JsonArrayConst>(), parsed, err))
    {
        trackList = defaultTracks();
        saveTracksLocked();
        return;
    }
    trackList = parsed;
}

void dfpBegin()
{
    dfpSerial.end();
    dfpSerial.begin(9600, SERIAL_8N1, DFP_RX_PIN, DFP_TX_PIN);
    dfpReady = dfPlayer.begin(dfpSerial, true, true);
    if (dfpReady)
    {
        sdPresent = true;
        dfPlayer.volume(currentVolume);
        dfPlayer.EQ(DFPLAYER_EQ_NORMAL);
        dfPlayer.outputDevice(DFPLAYER_DEVICE_SD);
        setInfo(lastDfpError, "");
        Serial.println("DFPlayer siap");
    }
    else
        Serial.println("DFPlayer tidak terdeteksi/kartu SD DFPlayer tidak ada");
}

bool audioReady()
{
    return dfpReady && sdPresent;
}

String dfpErrorText(int code)
{
    switch (code)
    {
    case Busy:
        return "DFPlayer sibuk atau kartu SD belum siap";
    case Sleeping:
        return "DFPlayer dalam mode tidur";
    case SerialWrongStack:
    case CheckSumNotMatch:
        return "Komunikasi serial DFPlayer terganggu";
    case FileIndexOut:
    case FileMismatch:
        return "File track " + String(playingTrack) + " tidak ada di kartu SD (mp3/" +
               String(playingTrack < 10 ? "000" : playingTrack < 100 ? "00" : playingTrack < 1000 ? "0" : "") +
               String(playingTrack) + ".mp3)";
    default:
        return "DFPlayer error " + String(code);
    }
}

void dfpTick()
{
    if (!dfPlayer.available())
        return;
    uint8_t type = dfPlayer.readType();
    int value = dfPlayer.read();
    switch (type)
    {
    case DFPlayerPlayFinished:
        audioPlaying = false;
        playingTrack = 0;
        break;
    case DFPlayerError:
    {
        String e = dfpErrorText(value);
        setInfo(lastDfpError, e);
        Serial.println(e);
        audioPlaying = false;
        playingTrack = 0;
        break;
    }
    case DFPlayerCardRemoved:
        sdPresent = false;
        audioPlaying = false;
        playingTrack = 0;
        setInfo(lastDfpError, "Kartu SD DFPlayer dicabut");
        Serial.println("Kartu SD DFPlayer dicabut");
        break;
    case DFPlayerCardInserted:
    case DFPlayerCardOnline:
        sdPresent = true;
        setInfo(lastDfpError, "");
        Serial.println("Kartu SD DFPlayer terpasang");
        break;
    default:
        break;
    }
}

void playTrack(uint16_t track)
{
    if (!audioReady() || track == 0)
        return;
    setInfo(lastDfpError, "");
    dfPlayer.playMp3Folder(track);
    audioPlaying = true;
    playingTrack = track;
    playStartedAt = millis();
    Serial.printf("Memutar track %d\n", track);
}

void stopTrack()
{
    if (dfpReady)
        dfPlayer.stop();
    audioPlaying = false;
    playingTrack = 0;
}

void handleAudioCmd(const AudioCmd &c)
{
    switch (c.type)
    {
    case AC_PLAY:
        playTrack(c.arg);
        break;
    case AC_STOP:
        stopTrack();
        break;
    case AC_VOLUME:
        if (dfpReady)
            dfPlayer.volume(c.arg);
        break;
    }
}

void checkSchedule(const DateTime &now)
{
    if (holidayMode || !audioReady() || !timeTrusted || sleeping)
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
        std::vector<bell::SlotView> views;
        views.reserve(schedule.size());
        for (const BellSlot &s : schedule)
            views.push_back({(int)s.mode, s.day.c_str(), s.time.c_str(), s.track, s.enabled});
        int idx = bell::pickSlot(views.data(), views.size(), (int)activeMode, timeBuf, dow);
        if (idx >= 0)
            track = schedule[idx].track;
    }
    if (track)
    {
        lastTriggeredMinute = minuteKey;
        Serial.printf("Memicu bel %s: track %d (uptime %lus)\n", timeBuf, track, millis() / 1000UL);
        setInfo(lastBell, String(timeBuf) + " #" + String(track));
        playTrack(track);
    }
}

void bellTask(void *param)
{
    unsigned long lastDfpTry = millis();
    unsigned long lastRtcCheck = 0;
    int rtcStopped = 0;
    for (;;)
    {
        if (!dfpReady && millis() - lastDfpTry > DFP_RETRY_INTERVAL)
        {
            lastDfpTry = millis();
            dfpBegin();
        }

        if (rtcPresent && millis() - lastRtcCheck > RTC_CHECK_INTERVAL)
        {
            lastRtcCheck = millis();
            rtcStopped = rtcRunning() ? 0 : rtcStopped + 1;
            if (rtcStopped >= RTC_STOP_LIMIT)
            {
                if (timeTrusted)
                    Serial.println("RTC berhenti berjalan, bel dikunci");
                Lock t(timeMutex);
                setTrusted(false);
            }
        }

        DateTime now;
        bool usable = false;
        {
            Lock t(timeMutex);
            now = getNow();
            bell::TimeGuard::Result r = timeGuard.feed(now.unixtime(), now.year());
            if (r == bell::TimeGuard::DISTRUST)
            {
                if (timeTrusted)
                    Serial.printf("Waktu tidak konsisten (%04d-%02d-%02d %02d:%02d), bel dikunci\n",
                                  now.year(), now.month(), now.day(), now.hour(), now.minute());
                setTrusted(false);
            }
            usable = r == bell::TimeGuard::OK;
        }

        if (usable)
        {
            bool nowSleep = timeTrusted &&
                            bell::inSleepWindow(sleepEnabled, sleepStartMin, sleepEndMin, now.hour() * 60 + now.minute());
            if (nowSleep && !sleeping)
            {
                Serial.println("Masuk mode tidur");
                if (audioPlaying)
                    stopTrack();
            }
            else if (!nowSleep && sleeping)
                Serial.println("Keluar mode tidur");
            sleeping = nowSleep;
            checkSchedule(now);
        }

        if (dfpReady)
            dfpTick();
        if (audioPlaying && millis() - playStartedAt > PLAY_TIMEOUT)
        {
            audioPlaying = false;
            playingTrack = 0;
        }

        AudioCmd cmd;
        if (xQueueReceive(audioQueue, &cmd, pdMS_TO_TICKS(BELL_TICK_MS)) == pdTRUE)
        {
            handleAudioCmd(cmd);
            while (xQueueReceive(audioQueue, &cmd, 0) == pdTRUE)
                handleAudioCmd(cmd);
        }
    }
}

void syncTimeFromNTP()
{
    lastNtpAttempt = millis();
    configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
    struct tm ti;
    if (getLocalTime(&ti, 5000) && (ti.tm_year + 1900) >= bell::MIN_VALID_YEAR)
    {
        DateTime ntp(ti.tm_year + 1900, ti.tm_mon + 1, ti.tm_mday, ti.tm_hour, ti.tm_min, ti.tm_sec);
        if (rtcPresent)
        {
            long diff = (long)ntp.unixtime() - (long)readRtc().unixtime();
            bool adjust = diff > 2 || diff < -2;
            applyVerifiedTime(adjust ? &ntp : nullptr);
            Serial.println(adjust ? "RTC disinkronkan via NTP" : "NTP OK, RTC sudah akurat");
        }
        else
        {
            applyVerifiedTime(nullptr);
            Serial.println("NTP OK, memakai jam sistem (RTC tidak ada)");
        }
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

    bool disableStatic = false;
    {
        Lock c(cfgMutex);
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
                disableStatic = true;
            }
        }
    }
    if (disableStatic)
    {
        saveConfig();
        Serial.println("IP statis dinonaktifkan (jaringan berbeda)");
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
    String mode = postParam(r, "mode");
    s.mode = modeFromCode(mode);
    s.day = postParam(r, "day");
    s.time = postParam(r, "time");
    long track = postParam(r, "track").toInt();
    s.enabled = postParam(r, "enabled") != "0";
    if (!validModeCode(mode))
    {
        err = "Mode tidak valid";
        return false;
    }
    if (!bell::validDay(s.day.c_str()))
    {
        err = "Hari tidak valid";
        return false;
    }
    if (!bell::validTime(s.time.c_str()))
    {
        err = "Jam tidak valid";
        return false;
    }
    if (track <= 0 || track > MAX_TRACK_NO)
    {
        err = "Nomor track tidak valid";
        return false;
    }
    s.track = (uint16_t)track;
    return true;
}

SlotLookup findSlotLocked(AsyncWebServerRequest *r, int &id)
{
    id = postParam(r, "id").toInt();
    if (id < 0 || id >= (int)schedule.size())
        return SLOT_MISSING;
    String sig = postParam(r, "sig");
    if (sig.length() && strtoul(sig.c_str(), nullptr, 10) != slotSig(schedule[id]))
        return SLOT_CHANGED;
    return SLOT_OK;
}

void sendSlotLookupError(AsyncWebServerRequest *r, SlotLookup res)
{
    if (res == SLOT_CHANGED)
        sendResult(r, false, "Jadwal sudah berubah di perangkat. Muat ulang halaman lalu coba lagi.", 409);
    else
        sendResult(r, false, "Jadwal tidak ditemukan", 404);
}

const char *DFP_MISSING = "DFPlayer/kartu SD tidak terdeteksi";

void handleRestore(AsyncWebServerRequest *r)
{
    String data = postParam(r, "data");
    if (data.length() == 0)
        return sendResult(r, false, "File backup kosong");
    JsonDocument d;
    if (deserializeJson(d, data))
        return sendResult(r, false, "File backup bukan JSON yang valid");
    if (!d["schedule"].is<JsonArrayConst>() || !d["tracks"].is<JsonArrayConst>() || !d["config"].is<JsonObjectConst>())
        return sendResult(r, false, "Format backup tidak dikenali");

    std::vector<BellSlot> slots;
    std::vector<TrackInfo> tracks;
    String err;
    if (!parseScheduleJson(d["schedule"].as<JsonArrayConst>(), slots, err) ||
        !parseTracksJson(d["tracks"].as<JsonArrayConst>(), tracks, err))
        return sendResult(r, false, err);

    bool ok = true;
    {
        Lock l(dataMutex);
        schedule = slots;
        sortScheduleLocked();
        trackList = tracks;
        ok = saveScheduleLocked() && saveTracksLocked();
    }
    {
        Lock c(cfgMutex);
        applyConfigJson(d["config"].as<JsonObjectConst>(), false);
    }
    ok = saveConfig() && ok;
    queueAudio(AC_VOLUME, currentVolume);
    sendResult(r, ok, ok ? "Backup dipulihkan: " + String(slots.size()) + " jadwal, " + String(tracks.size()) + " track"
                         : "Backup dipulihkan sebagian, gagal menyimpan ke memori");
}

void setupWebServer()
{
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *r)
              { r->send(200, "text/html", (const uint8_t *)INDEX_HTML, strlen(INDEX_HTML)); });

    server.on("/api/status", HTTP_GET, [](AsyncWebServerRequest *r)
              {
        DateTime now = getNow();
        char tb[24];
        snprintf(tb, sizeof(tb), "%04d-%02d-%02d %02d:%02d:%02d",
                 now.year(), now.month(), now.day(), now.hour(), now.minute(), now.second());
        bool sta = WiFi.status() == WL_CONNECTED;
        JsonDocument d;
        d["version"] = FW_VERSION;
        d["time"] = tb;
        d["dow"] = now.dayOfTheWeek();
        d["clock"] = rtcPresent ? "rtc" : "ntp";
        d["mode"] = sta ? "STA" : "AP";
        d["ip"] = sta ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
        d["rssi"] = sta ? WiFi.RSSI() : 0;
        d["volume"] = (int)currentVolume;
        d["holiday"] = (bool)holidayMode;
        d["sched_mode"] = modeCode(activeMode);
        d["dfp"] = (bool)dfpReady;
        d["sd"] = (bool)sdPresent;
        d["dfp_error"] = getInfo(lastDfpError);
        d["playing"] = (bool)audioPlaying;
        d["track"] = (int)playingTrack;
        d["last_bell"] = getInfo(lastBell);
        d["trusted"] = (bool)timeTrusted;
        d["sleeping"] = (bool)sleeping;
        d["sleep_on"] = (bool)sleepEnabled;
        d["sleep_start"] = minToStr(sleepStartMin);
        d["sleep_end"] = minToStr(sleepEndMin);
        sendJson(r, d); });

    server.on("/api/sleep", HTTP_GET, [](AsyncWebServerRequest *r)
              {
        JsonDocument d;
        d["enabled"] = (bool)sleepEnabled;
        d["start"] = minToStr(sleepStartMin);
        d["end"] = minToStr(sleepEndMin);
        d["oled"] = (bool)sleepOledOff;
        d["sleeping"] = (bool)sleeping;
        sendJson(r, d); });

    server.on("/api/sleep", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        bool en = postParam(r, "enabled") == "1";
        String st = postParam(r, "start");
        String ed = postParam(r, "end");
        bool oledOff = postParam(r, "oled") == "1";
        if (!bell::validTime(st.c_str()) || !bell::validTime(ed.c_str()))
            return sendResult(r, false, "Format jam tidak valid");
        int sm = bell::timeToMin(st.c_str(), 0), em = bell::timeToMin(ed.c_str(), 0);
        if (en && sm == em)
            return sendResult(r, false, "Jam mulai dan selesai tidak boleh sama");
        {
            Lock c(cfgMutex);
            sleepStartMin = sm;
            sleepEndMin = em;
            sleepOledOff = oledOff;
            sleepEnabled = en;
        }
        bool saved = saveConfig();
        sendResult(r, true, String(en ? "Mode tidur aktif " + st + " - " + ed : "Mode tidur nonaktif") + (saved ? "" : " (gagal disimpan)")); });

    server.on("/api/ring", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        if (!audioReady()) return sendResult(r, false, DFP_MISSING);
        long track = postParam(r, "track").toInt();
        if (track <= 0 || track > MAX_TRACK_NO) return sendResult(r, false, "Nomor track tidak valid");
        if (!queueAudio(AC_PLAY, (uint16_t)track)) return sendResult(r, false, "Perangkat sibuk, coba lagi");
        sendResult(r, true, "Memutar track " + String(track)); });

    server.on("/api/stop", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        queueAudio(AC_STOP);
        sendResult(r, true, "Bel dihentikan"); });

    server.on("/api/time/set", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        String date = postParam(r, "date");
        String tm = postParam(r, "time");
        if (date.length() != 10 || date[4] != '-' || date[7] != '-' || !bell::validTime(tm.c_str()))
            return sendResult(r, false, "Format tanggal/jam tidak valid");
        int y = date.substring(0, 4).toInt();
        int mo = date.substring(5, 7).toInt();
        int d = date.substring(8, 10).toInt();
        static const uint8_t daysIn[] = {31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
        if (y < bell::MIN_VALID_YEAR || y > bell::MAX_VALID_YEAR || mo < 1 || mo > 12 || d < 1 || d > daysIn[mo - 1] ||
            (mo == 2 && d == 29 && !((y % 4 == 0 && y % 100 != 0) || y % 400 == 0)))
            return sendResult(r, false, "Tanggal tidak valid");
        if (!rtcPresent) return sendResult(r, false, "RTC tidak terdeteksi, waktu hanya dapat diatur lewat NTP");
        DateTime dt(y, mo, d, tm.substring(0, 2).toInt(), tm.substring(3, 5).toInt(), 0);
        applyVerifiedTime(&dt);
        sendResult(r, true, "Waktu diatur"); });

    server.on("/api/volume", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        currentVolume = constrain((int)postParam(r, "value").toInt(), 0, 30);
        queueAudio(AC_VOLUME, currentVolume);
        bool saved = saveConfig();
        sendResult(r, true, "Volume " + String(currentVolume) + "/30" + (saved ? "" : " (gagal disimpan)")); });

    server.on("/api/holiday", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        holidayMode = postParam(r, "value") == "1";
        bool saved = saveConfig();
        sendResult(r, true, String(holidayMode ? "Mode libur aktif" : "Mode libur nonaktif") + (saved ? "" : " (gagal disimpan)")); });

    server.on("/api/mode", HTTP_GET, [](AsyncWebServerRequest *r)
              {
        JsonDocument d;
        d["mode"] = modeCode(activeMode);
        sendJson(r, d); });
    server.on("/api/mode", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        String v = postParam(r, "value");
        if (!validModeCode(v)) return sendResult(r, false, "Mode tidak valid");
        activeMode = modeFromCode(v);
        bool saved = saveConfig();
        sendResult(r, true, String("Mode aktif: ") + modeCode(activeMode) + (saved ? "" : " (gagal disimpan)")); });

    server.on("/api/schedule", HTTP_GET, [](AsyncWebServerRequest *r)
              {
        bool hasFilter = r->hasParam("mode");
        ScheduleMode filter = hasFilter ? modeFromCode(r->getParam("mode")->value()) : MODE_REGULER;
        JsonDocument d;
        JsonArray a = d["slots"].to<JsonArray>();
        {
            Lock l(dataMutex);
            for (size_t i = 0; i < schedule.size(); i++) {
                const BellSlot &s = schedule[i];
                if (hasFilter && s.mode != filter) continue;
                JsonObject o = a.add<JsonObject>();
                o["id"] = i;
                o["sig"] = slotSig(s);
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
                sortScheduleLocked();
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
        SlotLookup res;
        bool saved = true;
        {
            Lock l(dataMutex);
            int id;
            res = findSlotLocked(r, id);
            if (res == SLOT_OK) {
                schedule[id] = s;
                sortScheduleLocked();
                saved = saveScheduleLocked();
            }
        }
        if (res != SLOT_OK) return sendSlotLookupError(r, res);
        if (!saved) return sendResult(r, false, "Gagal menyimpan jadwal");
        sendResult(r, true, "Jadwal disimpan"); });

    server.on("/api/schedule/delete", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        SlotLookup res;
        bool saved = true;
        {
            Lock l(dataMutex);
            int id;
            res = findSlotLocked(r, id);
            if (res == SLOT_OK) {
                schedule.erase(schedule.begin() + id);
                saved = saveScheduleLocked();
            }
        }
        if (res != SLOT_OK) return sendSlotLookupError(r, res);
        if (!saved) return sendResult(r, false, "Gagal menyimpan jadwal");
        sendResult(r, true, "Jadwal dihapus"); });

    server.on("/api/tracks", HTTP_GET, [](AsyncWebServerRequest *r)
              {
        JsonDocument d;
        {
            Lock l(dataMutex);
            fillTracksJson(d["tracks"].to<JsonArray>());
        }
        AsyncResponseStream *res = r->beginResponseStream("application/json");
        serializeJson(d, *res);
        r->send(res); });

    server.on("/api/tracks/add", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        long track = postParam(r, "track").toInt();
        String label = postParam(r, "label");
        label.trim();
        if (track <= 0 || track > MAX_TRACK_NO) return sendResult(r, false, "Nomor track tidak valid");
        if (label.length() == 0 || label.length() > 40) return sendResult(r, false, "Nama tidak valid");
        bool full = false, saved = true;
        {
            Lock l(dataMutex);
            bool replaced = false;
            for (TrackInfo &t : trackList) {
                if (t.track == track) {
                    t.label = label;
                    replaced = true;
                    break;
                }
            }
            if (!replaced) {
                if (trackList.size() >= MAX_TRACKS) full = true;
                else trackList.push_back({(uint16_t)track, label});
            }
            if (!full) saved = saveTracksLocked();
        }
        if (full) return sendResult(r, false, "Daftar track penuh (maks " + String(MAX_TRACKS) + ")");
        if (!saved) return sendResult(r, false, "Gagal menyimpan");
        sendResult(r, true, "Nama track disimpan"); });

    server.on("/api/tracks/delete", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        long track = postParam(r, "track").toInt();
        bool used = false, saved = true;
        {
            Lock l(dataMutex);
            for (const BellSlot &s : schedule) {
                if (s.track == track) {
                    used = true;
                    break;
                }
            }
            if (!used) {
                trackList.erase(std::remove_if(trackList.begin(), trackList.end(),
                                               [track](const TrackInfo &t) { return t.track == track; }),
                                trackList.end());
                saved = saveTracksLocked();
            }
        }
        if (used) return sendResult(r, false, "Track masih dipakai jadwal. Ubah/hapus jadwalnya dulu.");
        sendResult(r, saved, saved ? "Nama track dihapus" : "Gagal menyimpan"); });

    server.on("/api/backup", HTTP_GET, [](AsyncWebServerRequest *r)
              {
        JsonDocument d;
        d["app"] = "bel-madrasah-baremetal";
        d["version"] = FW_VERSION;
        {
            Lock c(cfgMutex);
            fillConfigJson(d["config"].to<JsonObject>(), false);
        }
        {
            Lock l(dataMutex);
            fillScheduleJson(d["schedule"].to<JsonArray>(), false);
            fillTracksJson(d["tracks"].to<JsonArray>());
        }
        AsyncResponseStream *res = r->beginResponseStream("application/json");
        res->addHeader("Content-Disposition", "attachment; filename=\"bel-madrasah-backup.json\"");
        serializeJsonPretty(d, *res);
        r->send(res); });

    server.on("/api/restore", HTTP_POST, handleRestore);

    server.on("/api/network", HTTP_GET, [](AsyncWebServerRequest *r)
              {
        JsonDocument d;
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
        {
            Lock c(cfgMutex);
            d["static_enabled"] = staticCfg.enabled;
            d["static_ip"] = staticCfg.ip;
        }
        sendJson(r, d); });

    server.on("/api/network/static", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        bool en = postParam(r, "enabled") == "1";
        String newIp = "";
        if (!en) {
            Lock c(cfgMutex);
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
            Lock c(cfgMutex);
            staticCfg.enabled = true;
            staticCfg.ssid = WiFi.SSID();
            staticCfg.ip = ip.toString();
            staticCfg.gw = gw.toString();
            staticCfg.mask = mask.toString();
            staticCfg.dns = dns.toString();
            newIp = staticCfg.ip;
        }
        if (!saveConfig()) return sendResult(r, false, "Gagal menyimpan konfigurasi");
        restartAt = millis() + 1500;
        restartPending = true;

        JsonDocument d;
        d["ok"] = true;
        d["msg"] = en ? "Tersimpan. Restart, buka http://" + newIp : "IP statis dimatikan. Restart (IP dari DHCP).";
        d["new_ip"] = newIp;
        sendJson(r, d); });

    server.on("/api/network/reset", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        {
            Lock c(cfgMutex);
            staticCfg.enabled = false;
        }
        saveConfig();
        wifiResetPending = true;
        restartAt = millis() + 1500;
        restartPending = true;
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
    Serial.println("Bel Madrasah firmware " FW_VERSION);

    i2cMutex = xSemaphoreCreateMutex();
    dataMutex = xSemaphoreCreateMutex();
    timeMutex = xSemaphoreCreateMutex();
    cfgMutex = xSemaphoreCreateMutex();
    infoMutex = xSemaphoreCreateMutex();
    audioQueue = xQueueCreate(8, sizeof(AudioCmd));

    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

    oledReady = oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
    if (!oledReady)
        Serial.println("OLED SSD1306 tidak terdeteksi!");
    else
        oledShow("BEL MADRASAH", "v" FW_VERSION);

    rtcPresent = rtc.begin();
    if (!rtcPresent)
    {
        Serial.println("RTC DS1307 tidak terdeteksi. Bel menunggu waktu dari NTP");
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
        bool yearOk = n.year() >= bell::MIN_VALID_YEAR && n.year() <= bell::MAX_VALID_YEAR;
        timeTrusted = yearOk && rtc.readnvram(TRUST_ADDR) == TRUST_MAGIC;
        if (!timeTrusted)
            Serial.println("Waktu RTC belum pernah diverifikasi, bel dikunci");
    }

    if (!LittleFS.begin(true))
        Serial.println("LittleFS gagal mount");
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
        unsigned long interval = ntpLastOk ? NTP_SYNC_INTERVAL : NTP_RETRY_INTERVAL;
        if (lastNtpAttempt == 0 || millis() - lastNtpAttempt > interval)
            syncTimeFromNTP();
    }

    if (restartPending && (long)(millis() - restartAt) >= 0)
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
