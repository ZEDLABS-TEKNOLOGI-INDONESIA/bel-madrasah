#include <WiFi.h>
#include <esp_wifi.h>
#include <WiFiManager.h>
#include <ESPmDNS.h>
#include <ESPAsyncWebServer.h>
#include <SPI.h>
#include <SdFat.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <RTClib.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>
#include <vector>
#include <algorithm>
#include <AudioFileSource.h>
#include <AudioGeneratorMP3.h>
#include <AudioGeneratorWAV.h>
#include <AudioOutputI2S.h>

// ================== PIN CONFIG (ESP32-C3 Super Mini) ==================
#define I2S_BCK_PIN 0
#define I2S_LRC_PIN 1
#define I2S_DIN_PIN 3
#define I2C_SDA_PIN 4
#define I2C_SCL_PIN 5
#define SD_SCK_PIN 6
#define SD_MISO_PIN 7
#define SD_MOSI_PIN 10
#define SD_CS_PIN 20

// ================== KONSTANTA ==================
const char *AP_SSID = "BELL MADRASAH V0.1.0";
const char *AP_PASS = "P@ssw0rd";
const IPAddress AP_IP(192, 168, 4, 1);
const IPAddress AP_MASK(255, 255, 255, 0);

const char *BELL_DIR = "/tone";
const char *SCHEDULE_FILE = "/schedule.json";
const char *CONFIG_FILE = "/config.json";

const size_t MAX_SLOTS = 120; // dinaikkan: 4 mode x ~20 slot/hari
const size_t MAX_FILES = 60;
const size_t SCHED_DOC_SIZE = 24576;
const uint32_t MAX_UPLOAD_BYTES = 10UL * 1024UL * 1024UL;
const unsigned long NTP_SYNC_INTERVAL = 3600000;

// ================== MODE JADWAL ==================
enum ScheduleMode : uint8_t
{
    MODE_REGULER = 0,
    MODE_RAMADHAN,
    MODE_PTS,
    MODE_PAS,
    MODE_COUNT
};

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

// ================== OBJEK GLOBAL ==================
RTC_DS3231 rtc;
LiquidCrystal_I2C lcd(0x27, 16, 2);
AsyncWebServer server(80);
SdFs sd;
SPIClass sdSpi(FSPI);

// ================== STATE ==================
struct BellSlot
{
    ScheduleMode mode;
    String time; // "HH:MM"
    String day;  // all, mon-sat, mon-fri, mon-thu, mon..sun
    String file;
    bool enabled;
};

struct StaticCfg
{
    bool enabled = false;
    String ssid, ip, gw, mask, dns;
};

std::vector<BellSlot> schedule;
StaticCfg staticCfg;
int currentVolume = 60;
bool holidayMode = false;
ScheduleMode activeMode = MODE_REGULER;

volatile bool sdReady = false;
bool apActive = false;
volatile bool restartPending = false;
volatile bool wifiResetPending = false;
unsigned long restartAt = 0;

unsigned long lastNtpAttempt = 0;
bool ntpLastOk = false;
uint32_t lastTriggeredMinute = 0;

SemaphoreHandle_t i2cMutex;
SemaphoreHandle_t dataMutex;
SemaphoreHandle_t sdMutex;

struct Lock
{
    SemaphoreHandle_t m;
    Lock(SemaphoreHandle_t mm) : m(mm) { xSemaphoreTake(m, portMAX_DELAY); }
    ~Lock() { xSemaphoreGive(m); }
};

bool saveConfig();
void loadConfig();
void loadSchedule();
bool audioPlayingFlag();

// ================== RTC ==================
DateTime getNow()
{
    Lock l(i2cMutex);
    return rtc.now();
}
void setRtc(const DateTime &dt)
{
    Lock l(i2cMutex);
    rtc.adjust(dt);
}

// ================== LCD ==================
void printLcdLine(int row, const char *text)
{
    char buf[17];
    snprintf(buf, sizeof(buf), "%-16.16s", text);
    lcd.setCursor(0, row);
    lcd.print(buf);
}

void lcdTask(void *param)
{
    char line[17];
    for (;;)
    {
        DateTime now = getNow();
        snprintf(line, sizeof(line), "    %02d:%02d:%02d    ", now.hour(), now.minute(), now.second());
        {
            Lock l(i2cMutex);
            printLcdLine(0, line);
        }
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}

// ================== HELPER ==================
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

String sanitizeName(String name)
{
    int slash = max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
    if (slash >= 0)
        name = name.substring(slash + 1);
    name.trim();
    String out;
    for (size_t i = 0; i < name.length(); i++)
    {
        char c = name[i];
        if (isalnum((unsigned char)c) || c == '.' || c == '-' || c == '_')
            out += c;
        else if (c == ' ')
            out += '-';
    }
    out.toLowerCase();
    if (out.length() < 5 || out.length() > 40 || out[0] == '.')
        return "";
    if (!(out.endsWith(".mp3") || out.endsWith(".wav")))
        return "";
    return out;
}

String bellPath(const String &name) { return String(BELL_DIR) + "/" + name; }

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

// ================== SD CARD ==================
void sdCheckErrorLocked()
{
    if (sd.card() && sd.card()->errorCode())
        sdReady = false;
}

bool sdMount()
{
    Lock l(sdMutex);
    if (!sd.begin(SdSpiConfig(SD_CS_PIN, SHARED_SPI, SD_SCK_MHZ(10), &sdSpi)))
    {
        sdReady = false;
        return false;
    }
    if (!sd.exists(BELL_DIR))
        sd.mkdir(BELL_DIR);
    sdReady = true;
    return true;
}

bool sdFileExists(const String &path)
{
    Lock l(sdMutex);
    return sdReady && sd.exists(path.c_str());
}

String sdReadText(const char *path)
{
    Lock l(sdMutex);
    String out;
    if (!sdReady)
        return out;
    String tmp = String(path) + ".tmp";
    if (!sd.exists(path) && sd.exists(tmp.c_str()))
        sd.rename(tmp.c_str(), path);
    FsFile f = sd.open(path, O_RDONLY);
    if (!f.isOpen())
        return out;
    size_t sz = f.fileSize();
    if (sz == 0 || sz > 24576)
    {
        f.close();
        return out;
    }
    out.reserve(sz);
    char buf[256];
    int n;
    while ((n = f.read(buf, sizeof(buf))) > 0)
        out.concat(buf, n);
    f.close();
    return out;
}

bool sdWriteText(const char *path, const String &txt)
{
    Lock l(sdMutex);
    if (!sdReady)
        return false;
    String tmp = String(path) + ".tmp";
    FsFile f = sd.open(tmp.c_str(), O_WRONLY | O_CREAT | O_TRUNC);
    if (!f.isOpen())
    {
        sdCheckErrorLocked();
        return false;
    }
    size_t w = f.write((const uint8_t *)txt.c_str(), txt.length());
    bool ok = (w == txt.length());
    ok = f.close() && ok;
    if (!ok)
    {
        sd.remove(tmp.c_str());
        sdCheckErrorLocked();
        return false;
    }
    sd.remove(path);
    ok = sd.rename(tmp.c_str(), path);
    if (!ok)
        sdCheckErrorLocked();
    return ok;
}

void sdTick()
{
    static unsigned long last = 0;
    static uint8_t sector[512];
    if (millis() - last < (sdReady ? 10000UL : 5000UL))
        return;
    last = millis();
    if (sdReady)
    {
        if (audioPlayingFlag())
            return;
        Lock l(sdMutex);
        if (!sd.card() || !sd.card()->readSector(0, sector))
        {
            sdReady = false;
            Serial.println("Kartu SD tidak terbaca");
        }
        return;
    }
    if (sdMount())
    {
        Serial.println("Kartu SD terdeteksi, memuat config & jadwal");
        loadConfig();
        loadSchedule();
    }
}

// ================== KONFIGURASI ==================
bool saveConfig()
{
    StaticJsonDocument<768> d;
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
    String out;
    serializeJson(d, out);
    return sdWriteText(CONFIG_FILE, out);
}

void loadConfig()
{
    if (!sdReady)
        return;
    String txt = sdReadText(CONFIG_FILE);
    if (txt.length() == 0)
    {
        saveConfig();
        return;
    }
    StaticJsonDocument<768> d;
    if (deserializeJson(d, txt))
        return;
    currentVolume = constrain((int)(d["volume"] | 60), 0, 100);
    holidayMode = d["holiday"] | false;
    activeMode = modeFromCode(d["mode"] | "reguler");
    JsonObject s = d["static"];
    staticCfg.enabled = s["enabled"] | false;
    staticCfg.ssid = s["ssid"] | "";
    staticCfg.ip = s["ip"] | "";
    staticCfg.gw = s["gw"] | "";
    staticCfg.mask = s["mask"] | "";
    staticCfg.dns = s["dns"] | "";
}

void sortSchedule()
{
    std::stable_sort(schedule.begin(), schedule.end(), [](const BellSlot &a, const BellSlot &b)
                     {
        if (a.mode != b.mode) return a.mode < b.mode;
        return a.time < b.time; });
}

// ---- Default schedule (diambil dari spesifikasi) ----
void addSlot(std::vector<BellSlot> &v, ScheduleMode m, const char *time, const char *day, const char *file)
{
    v.push_back({m, time, day, file, true});
}

std::vector<BellSlot> defaultSchedule()
{
    std::vector<BellSlot> v;

    // ---- REGULER ----
    addSlot(v, MODE_REGULER, "06:44", "mon", "sholawat.mp3");
    addSlot(v, MODE_REGULER, "06:50", "mon", "mars-madrasah.mp3");
    addSlot(v, MODE_REGULER, "07:00", "mon", "upacara.mp3");
    addSlot(v, MODE_REGULER, "08:10", "mon", "pelajaran-2.mp3");
    addSlot(v, MODE_REGULER, "08:50", "mon", "pelajaran-3.mp3");
    addSlot(v, MODE_REGULER, "09:30", "mon", "pelajaran-4.mp3");
    addSlot(v, MODE_REGULER, "10:00", "mon", "indonesia-raya.mp3");
    addSlot(v, MODE_REGULER, "10:10", "mon", "istirahat-1.mp3");
    addSlot(v, MODE_REGULER, "10:20", "mon", "kebersihan.mp3");
    addSlot(v, MODE_REGULER, "10:30", "mon", "pelajaran-5.mp3");
    addSlot(v, MODE_REGULER, "11:10", "mon", "pelajaran-6.mp3");
    addSlot(v, MODE_REGULER, "11:50", "mon", "istirahat-2.mp3");
    addSlot(v, MODE_REGULER, "12:30", "mon", "kebersihan.mp3");
    addSlot(v, MODE_REGULER, "12:40", "mon", "pelajaran-7.mp3");
    addSlot(v, MODE_REGULER, "13:20", "mon", "pelajaran-8.mp3");
    addSlot(v, MODE_REGULER, "14:00", "mon", "pelajaran-9.mp3");
    addSlot(v, MODE_REGULER, "14:40", "mon", "pelajaran-10.mp3");
    addSlot(v, MODE_REGULER, "15:20", "mon", "pelajaran-selesai.mp3");
    addSlot(v, MODE_REGULER, "15:21", "mon", "tanah-airku.mp3");
    addSlot(v, MODE_REGULER, "16:30", "mon", "hymne-madrasah.mp3");

    for (const char *d : {"tue", "wed"})
    {
        addSlot(v, MODE_REGULER, "06:44", d, "sholawat.mp3");
        addSlot(v, MODE_REGULER, "06:50", d, "mars-madrasah.mp3");
        addSlot(v, MODE_REGULER, "07:30", d, "pelajaran-1.mp3");
        addSlot(v, MODE_REGULER, "08:10", d, "pelajaran-2.mp3");
        addSlot(v, MODE_REGULER, "08:50", d, "pelajaran-3.mp3");
        addSlot(v, MODE_REGULER, "09:30", d, "pelajaran-4.mp3");
        addSlot(v, MODE_REGULER, "10:10", d, "istirahat-1.mp3");
        addSlot(v, MODE_REGULER, "10:20", d, "kebersihan.mp3");
        addSlot(v, MODE_REGULER, "10:30", d, "pelajaran-5.mp3");
        addSlot(v, MODE_REGULER, "11:10", d, "pelajaran-6.mp3");
        addSlot(v, MODE_REGULER, "11:50", d, "istirahat-2.mp3");
        addSlot(v, MODE_REGULER, "12:30", d, "kebersihan.mp3");
        addSlot(v, MODE_REGULER, "12:40", d, "pelajaran-7.mp3");
        addSlot(v, MODE_REGULER, "13:20", d, "pelajaran-8.mp3");
        addSlot(v, MODE_REGULER, "14:00", d, "pelajaran-9.mp3");
        addSlot(v, MODE_REGULER, "14:40", d, "pelajaran-10.mp3");
        addSlot(v, MODE_REGULER, "15:20", d, "pelajaran-selesai.mp3");
        addSlot(v, MODE_REGULER, "15:21", d, "tanah-airku.mp3");
        addSlot(v, MODE_REGULER, "16:30", d, "hymne-madrasah.mp3");
    }

    addSlot(v, MODE_REGULER, "06:44", "thu", "sholawat.mp3");
    addSlot(v, MODE_REGULER, "06:50", "thu", "mars-madrasah.mp3");
    addSlot(v, MODE_REGULER, "07:00", "thu", "literasi.mp3");
    addSlot(v, MODE_REGULER, "08:10", "thu", "pelajaran-2.mp3");
    addSlot(v, MODE_REGULER, "08:50", "thu", "pelajaran-3.mp3");
    addSlot(v, MODE_REGULER, "09:30", "thu", "pelajaran-4.mp3");
    addSlot(v, MODE_REGULER, "10:00", "thu", "indonesia-raya.mp3");
    addSlot(v, MODE_REGULER, "10:10", "thu", "istirahat-1.mp3");
    addSlot(v, MODE_REGULER, "10:20", "thu", "kebersihan.mp3");
    addSlot(v, MODE_REGULER, "10:30", "thu", "pelajaran-5.mp3");
    addSlot(v, MODE_REGULER, "11:10", "thu", "pelajaran-6.mp3");
    addSlot(v, MODE_REGULER, "11:50", "thu", "istirahat-2.mp3");
    addSlot(v, MODE_REGULER, "12:30", "thu", "kebersihan.mp3");
    addSlot(v, MODE_REGULER, "12:40", "thu", "pelajaran-7.mp3");
    addSlot(v, MODE_REGULER, "13:20", "thu", "pelajaran-8.mp3");
    addSlot(v, MODE_REGULER, "14:00", "thu", "pelajaran-9.mp3");
    addSlot(v, MODE_REGULER, "14:40", "thu", "pelajaran-10.mp3");
    addSlot(v, MODE_REGULER, "15:20", "thu", "pelajaran-selesai.mp3");
    addSlot(v, MODE_REGULER, "15:21", "thu", "tanah-airku.mp3");
    addSlot(v, MODE_REGULER, "16:30", "thu", "hymne-madrasah.mp3");

    addSlot(v, MODE_REGULER, "06:44", "fri", "sholawat.mp3");
    addSlot(v, MODE_REGULER, "06:50", "fri", "mars-madrasah.mp3");
    addSlot(v, MODE_REGULER, "07:00", "fri", "rohani.mp3");
    addSlot(v, MODE_REGULER, "08:10", "fri", "pelajaran-3.mp3");
    addSlot(v, MODE_REGULER, "08:50", "fri", "pelajaran-4.mp3");
    addSlot(v, MODE_REGULER, "09:30", "fri", "istirahat-1.mp3");
    addSlot(v, MODE_REGULER, "09:40", "fri", "kebersihan.mp3");
    addSlot(v, MODE_REGULER, "10:10", "fri", "pelajaran-5.mp3");
    addSlot(v, MODE_REGULER, "10:40", "fri", "pelajaran-6.mp3");
    addSlot(v, MODE_REGULER, "11:20", "fri", "istirahat-2.mp3");
    addSlot(v, MODE_REGULER, "12:50", "fri", "pelajaran-7.mp3");
    addSlot(v, MODE_REGULER, "13:30", "fri", "pelajaran-8.mp3");
    addSlot(v, MODE_REGULER, "14:10", "fri", "akhir-pekan.mp3");
    addSlot(v, MODE_REGULER, "14:11", "fri", "tanah-airku.mp3");
    addSlot(v, MODE_REGULER, "14:12", "fri", "pramuka.mp3");
    addSlot(v, MODE_REGULER, "16:00", "fri", "hymne-madrasah.mp3");

    // ---- RAMADHAN ----
    addSlot(v, MODE_RAMADHAN, "06:50", "mon", "mars-madrasah.mp3");
    addSlot(v, MODE_RAMADHAN, "07:00", "mon", "upacara.mp3");
    addSlot(v, MODE_RAMADHAN, "07:40", "mon", "pelajaran-2.mp3");
    addSlot(v, MODE_RAMADHAN, "08:20", "mon", "pelajaran-3.mp3");
    addSlot(v, MODE_RAMADHAN, "09:00", "mon", "pelajaran-4.mp3");
    addSlot(v, MODE_RAMADHAN, "09:30", "mon", "istirahat-1.mp3");
    addSlot(v, MODE_RAMADHAN, "09:40", "mon", "pelajaran-5.mp3");
    addSlot(v, MODE_RAMADHAN, "10:20", "mon", "pelajaran-6.mp3");
    addSlot(v, MODE_RAMADHAN, "11:00", "mon", "pelajaran-selesai.mp3");
    addSlot(v, MODE_RAMADHAN, "11:01", "mon", "tanah-airku.mp3");

    for (const char *d : {"tue", "wed"})
    {
        addSlot(v, MODE_RAMADHAN, "06:50", d, "mars-madrasah.mp3");
        addSlot(v, MODE_RAMADHAN, "07:10", d, "pelajaran-1.mp3");
        addSlot(v, MODE_RAMADHAN, "07:50", d, "pelajaran-2.mp3");
        addSlot(v, MODE_RAMADHAN, "08:30", d, "pelajaran-3.mp3");
        addSlot(v, MODE_RAMADHAN, "09:10", d, "pelajaran-4.mp3");
        addSlot(v, MODE_RAMADHAN, "09:40", d, "istirahat-1.mp3");
        addSlot(v, MODE_RAMADHAN, "09:50", d, "pelajaran-5.mp3");
        addSlot(v, MODE_RAMADHAN, "10:30", d, "pelajaran-6.mp3");
        addSlot(v, MODE_RAMADHAN, "11:00", d, "pelajaran-selesai.mp3");
        addSlot(v, MODE_RAMADHAN, "11:01", d, "tanah-airku.mp3");
    }

    addSlot(v, MODE_RAMADHAN, "06:50", "thu", "mars-madrasah.mp3");
    addSlot(v, MODE_RAMADHAN, "07:00", "thu", "literasi.mp3");
    addSlot(v, MODE_RAMADHAN, "07:40", "thu", "pelajaran-2.mp3");
    addSlot(v, MODE_RAMADHAN, "08:20", "thu", "pelajaran-3.mp3");
    addSlot(v, MODE_RAMADHAN, "09:00", "thu", "pelajaran-4.mp3");
    addSlot(v, MODE_RAMADHAN, "09:30", "thu", "istirahat-1.mp3");
    addSlot(v, MODE_RAMADHAN, "09:40", "thu", "pelajaran-5.mp3");
    addSlot(v, MODE_RAMADHAN, "10:20", "thu", "pelajaran-6.mp3");
    addSlot(v, MODE_RAMADHAN, "11:00", "thu", "pelajaran-selesai.mp3");
    addSlot(v, MODE_RAMADHAN, "11:01", "thu", "tanah-airku.mp3");

    addSlot(v, MODE_RAMADHAN, "06:50", "fri", "mars-madrasah.mp3");
    addSlot(v, MODE_RAMADHAN, "07:00", "fri", "rohani.mp3");
    addSlot(v, MODE_RAMADHAN, "07:40", "fri", "pelajaran-3.mp3");
    addSlot(v, MODE_RAMADHAN, "08:20", "fri", "pelajaran-4.mp3");
    addSlot(v, MODE_RAMADHAN, "09:00", "fri", "istirahat-1.mp3");
    addSlot(v, MODE_RAMADHAN, "09:10", "fri", "pelajaran-5.mp3");
    addSlot(v, MODE_RAMADHAN, "09:50", "fri", "pelajaran-6.mp3");
    addSlot(v, MODE_RAMADHAN, "10:20", "fri", "akhir-pekan.mp3");
    addSlot(v, MODE_RAMADHAN, "10:21", "fri", "tanah-airku.mp3");

    // ---- PTS & PAS (identik) ----
    for (ScheduleMode m : {MODE_PTS, MODE_PAS})
    {
        for (const char *d : {"mon", "tue", "wed", "thu"})
        {
            addSlot(v, m, "06:50", d, "mars-madrasah.mp3");
            addSlot(v, m, "07:30", d, "pelajaran-1.mp3");
            addSlot(v, m, "08:30", d, "pelajaran-2.mp3");
            addSlot(v, m, "09:30", d, "pelajaran-3.mp3");
            addSlot(v, m, "10:30", d, "pelajaran-selesai.mp3");
            addSlot(v, m, "10:31", d, "tanah-airku.mp3");
        }
        addSlot(v, m, "06:50", "fri", "mars-madrasah.mp3");
        addSlot(v, m, "07:30", "fri", "pelajaran-1.mp3");
        addSlot(v, m, "08:30", "fri", "pelajaran-2.mp3");
        addSlot(v, m, "09:30", "fri", "pelajaran-selesai.mp3");
        addSlot(v, m, "09:31", "fri", "tanah-airku.mp3");
    }

    return v;
}

bool saveScheduleLocked()
{
    DynamicJsonDocument d(SCHED_DOC_SIZE);
    JsonArray a = d.createNestedArray("slots");
    for (auto &s : schedule)
    {
        JsonObject o = a.createNestedObject();
        o["mode"] = modeCode(s.mode);
        o["time"] = s.time;
        o["day"] = s.day;
        o["file"] = s.file;
        o["enabled"] = s.enabled;
    }
    String out;
    serializeJson(d, out);
    return sdWriteText(SCHEDULE_FILE, out);
}

void loadSchedule()
{
    String txt = sdReadText(SCHEDULE_FILE);
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
        return;
    for (JsonObject o : d["slots"].as<JsonArray>())
    {
        BellSlot s;
        s.mode = modeFromCode(o["mode"] | "reguler");
        s.time = o["time"] | "";
        s.day = o["day"] | "";
        s.file = o["file"] | "";
        s.enabled = o["enabled"] | true;
        if (validTime(s.time) && validDay(s.day) && s.file.length() && schedule.size() < MAX_SLOTS)
            schedule.push_back(s);
    }
    sortSchedule();
}

// ================== AUDIO (SD -> I2S PCM5102A) ==================
class AudioFileSourceSdFat : public AudioFileSource
{
public:
    AudioFileSourceSdFat() {}
    ~AudioFileSourceSdFat() override { close(); }
    bool open(const char *path) override
    {
        Lock l(sdMutex);
        if (!sdReady)
            return false;
        f = sd.open(path, O_RDONLY);
        return f.isOpen();
    }
    uint32_t read(void *data, uint32_t len) override
    {
        Lock l(sdMutex);
        if (!f.isOpen())
            return 0;
        int n = f.read(data, len);
        if (n < 0)
        {
            sdCheckErrorLocked();
            return 0;
        }
        return (uint32_t)n;
    }
    bool seek(int32_t pos, int dir) override
    {
        Lock l(sdMutex);
        if (!f.isOpen())
            return false;
        if (dir == SEEK_SET)
            return f.seekSet(pos);
        if (dir == SEEK_CUR)
            return f.seekCur(pos);
        if (dir == SEEK_END)
            return f.seekEnd(pos);
        return false;
    }
    bool close() override
    {
        Lock l(sdMutex);
        if (f.isOpen())
            f.close();
        return true;
    }
    bool isOpen() override { return f.isOpen(); }
    uint32_t getSize() override { return f.isOpen() ? (uint32_t)f.fileSize() : 0; }
    uint32_t getPos() override { return f.isOpen() ? (uint32_t)f.curPosition() : 0; }

private:
    FsFile f;
};

enum AudioCmdType : uint8_t
{
    CMD_PLAY,
    CMD_STOP,
    CMD_VOLUME
};
struct AudioCmd
{
    AudioCmdType type;
    char file[48];
};

QueueHandle_t audioQueue;
volatile bool audioPlaying = false;
char playingFile[48] = "";

AudioOutputI2S *audioOut = nullptr;
AudioGenerator *audioGen = nullptr;
AudioFileSourceSdFat *audioSrc = nullptr;

bool audioPlayingFlag() { return audioPlaying; }

void audioSend(AudioCmdType t, const char *file = "")
{
    AudioCmd c;
    c.type = t;
    strlcpy(c.file, file, sizeof(c.file));
    xQueueSend(audioQueue, &c, 0);
}

float gainFromVolume() { return currentVolume / 100.0f; }

void stopPlayback()
{
    if (audioGen)
    {
        if (audioGen->isRunning())
            audioGen->stop();
        delete audioGen;
        audioGen = nullptr;
    }
    if (audioSrc)
    {
        audioSrc->close();
        delete audioSrc;
        audioSrc = nullptr;
    }
    audioPlaying = false;
    playingFile[0] = 0;
}

void startPlayback(const char *name)
{
    stopPlayback();
    String path = bellPath(name);
    audioSrc = new AudioFileSourceSdFat();
    if (!audioSrc->open(path.c_str()))
    {
        Serial.println("File bel tidak bisa dibuka: " + path);
        stopPlayback();
        return;
    }
    String n = String(name);
    n.toLowerCase();
    if (n.endsWith(".wav"))
        audioGen = new AudioGeneratorWAV();
    else
        audioGen = new AudioGeneratorMP3();
    if (!audioGen->begin(audioSrc, audioOut))
    {
        Serial.println("Gagal memutar: " + path);
        stopPlayback();
        return;
    }
    strlcpy(playingFile, name, sizeof(playingFile));
    audioPlaying = true;
    Serial.println("Memutar: " + path);
}

void audioTask(void *param)
{
    audioOut = new AudioOutputI2S(0, AudioOutputI2S::EXTERNAL_I2S, 24);
    audioOut->SetPinout(I2S_BCK_PIN, I2S_LRC_PIN, I2S_DIN_PIN);
    audioOut->SetOutputModeMono(true);
    audioOut->SetGain(gainFromVolume());

    AudioCmd cmd;
    for (;;)
    {
        TickType_t wait = audioPlaying ? 0 : pdMS_TO_TICKS(50);
        while (xQueueReceive(audioQueue, &cmd, wait) == pdTRUE)
        {
            wait = 0;
            switch (cmd.type)
            {
            case CMD_PLAY:
                startPlayback(cmd.file);
                break;
            case CMD_STOP:
                stopPlayback();
                break;
            case CMD_VOLUME:
                audioOut->SetGain(gainFromVolume());
                break;
            }
        }
        if (audioPlaying && audioGen)
        {
            if (!audioGen->isRunning() || !audioGen->loop())
                stopPlayback();
            else
                vTaskDelay(1);
        }
    }
}

// ================== JADWAL BEL ==================
void checkSchedule(const DateTime &now)
{
    if (holidayMode || !sdReady)
        return;
    uint32_t minuteKey = now.unixtime() / 60;
    if (minuteKey == lastTriggeredMinute)
        return;

    char timeBuf[6];
    snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d", now.hour(), now.minute());
    int dow = now.dayOfTheWeek();

    char file[48] = "";
    {
        Lock l(dataMutex);
        for (auto &s : schedule)
        {
            if (s.mode != activeMode)
                continue;
            if (!s.enabled || s.time != timeBuf || !dayMatches(s.day, dow))
                continue;
            strlcpy(file, s.file.c_str(), sizeof(file));
            break;
        }
    }
    if (file[0])
    {
        lastTriggeredMinute = minuteKey;
        Serial.printf("Memicu bel %s: %s\n", timeBuf, file);
        audioSend(CMD_PLAY, file);
    }
}

void bellTask(void *param)
{
    for (;;)
    {
        checkSchedule(getNow());
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}

// ================== NTP ==================
void syncTimeFromNTP()
{
    lastNtpAttempt = millis();
    configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
    struct tm ti;
    if (getLocalTime(&ti, 5000))
    {
        setRtc(DateTime(ti.tm_year + 1900, ti.tm_mon + 1, ti.tm_mday, ti.tm_hour, ti.tm_min, ti.tm_sec));
        ntpLastOk = true;
        Serial.println("RTC disinkronkan via NTP");
    }
    else
    {
        ntpLastOk = false;
        Serial.println("Sinkronisasi NTP gagal, coba lagi 1 menit");
    }
}

// ================== JARINGAN ==================
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
    apActive = false;
    Serial.println("AP dimatikan, WiFi tersambung");
}

void onWifiConnected()
{
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
    if (millis() - lastReconnect > 60000)
    {
        lastReconnect = millis();
        WiFi.reconnect();
    }
}

void connectWiFi()
{
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);

    WiFiManager wm;
    wm.setConfigPortalTimeout(180);
    wm.setConnectTimeout(20);
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
}

// ================== WEB: HALAMAN ==================
const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bel Madrasah</title>
<style>
*{box-sizing:border-box}
body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;background:#f2f4f7;margin:0;padding:16px;color:#1a1a1a}
.c{max-width:520px;margin:0 auto}
h1{font-size:20px;text-align:center;margin:8px 0 16px}
.card{background:#fff;border-radius:12px;padding:16px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.card h2{font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#666;margin:0 0 12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.it{background:#f8f9fb;border-radius:8px;padding:10px 12px}
.l{font-size:11px;color:#888;margin-bottom:2px}
.v{font-size:14px;font-weight:600;word-break:break-all}
.mut{color:#777;font-size:12px}
.warn{display:none;background:#fee2e2;color:#991b1b;border-radius:10px;padding:12px;margin-bottom:14px;font-size:13px;font-weight:600}
input[type=text],input[type=time],select{width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;background:#fff}
button{padding:10px 16px;border:none;border-radius:8px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;cursor:pointer}
button.sec{background:#6b7280}button.danger{background:#dc2626}
button.sm{padding:6px 10px;font-size:12px}button.full{width:100%;margin-top:10px}
.row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:10px 0}
.slot{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #eee}
.slot.off .sinfo{opacity:.45}
.sinfo{flex:1;font-size:14px;word-break:break-all}
.sw{position:relative;width:44px;height:24px;flex:none}
.sw input{opacity:0;width:0;height:0}
.sl{position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#ccc;border-radius:24px;transition:.2s}
.sl:before{content:"";position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s}
input:checked+.sl{background:#2563eb}
input:checked+.sl:before{transform:translateX(20px)}
.f2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px}
.f3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px}
progress{width:100%;margin-top:8px}
#msg{display:none;position:fixed;top:10px;left:50%;transform:translateX(-50%);padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;z-index:9;max-width:90%}
#msg.ok{background:#dcfce7;color:#166534}#msg.err{background:#fee2e2;color:#991b1b}
</style></head><body><div class="c">
<div id="msg"></div>
<h1>Bel Madrasah</h1>
<div class="warn" id="sdWarn">Kartu SD tidak terdeteksi. Bel tidak akan berbunyi dan pengaturan tidak bisa disimpan. Pasang kartu, otomatis terdeteksi dalam beberapa detik.</div>

<div class="card"><h2>Status</h2><div class="grid">
<div class="it"><div class="l">Waktu</div><div class="v" id="sTime">-</div></div>
<div class="it"><div class="l">Jaringan</div><div class="v" id="sNet">-</div></div>
<div class="it"><div class="l">IP Address</div><div class="v" id="sIp">-</div></div>
<div class="it"><div class="l">Sedang Diputar</div><div class="v" id="sPlay">-</div></div>
<div class="it"><div class="l">Kartu SD</div><div class="v" id="sSd">-</div></div>
<div class="it"><div class="l">Mode Libur</div><div class="v" id="sHol">-</div></div>
</div></div>

<div class="card"><h2>Kontrol</h2>
<div class="row"><label>Volume: <b id="volVal">0</b>%</label></div>
<input type="range" id="vol" min="0" max="100" style="width:100%"
 oninput="$('volVal').textContent=this.value" onchange="setVol(this.value)">
<div class="row"><label>Mode Jadwal Aktif</label></div>
<select id="modeSel" onchange="setMode(this.value)">
<option value="reguler">Reguler</option>
<option value="ramadhan">Ramadhan</option>
<option value="pts">PTS</option>
<option value="pas">PAS</option>
</select>
<div class="row"><label>Mode Libur (nonaktifkan semua jadwal)</label>
<label class="sw"><input type="checkbox" id="hol" onchange="setHol(this.checked)"><span class="sl"></span></label></div>
<button class="danger full" onclick="act('/api/stop')">Stop Bel</button>
</div>

<div class="card"><h2>Jadwal Bel</h2>
<div class="row"><label>Tampilkan mode</label>
<select id="viewMode" onchange="loadSched()">
<option value="reguler">Reguler</option>
<option value="ramadhan">Ramadhan</option>
<option value="pts">PTS</option>
<option value="pas">PAS</option>
</select></div>
<div id="sched"></div>
<h2 id="fTitle" style="margin-top:16px">Tambah Jadwal</h2>
<form onsubmit="saveSlot(event)">
<div class="f3"><select id="fMode"></select><select id="fDay"></select><input type="time" id="fTime" value="07:00" required></div>
<select id="fFile" style="margin-bottom:8px"></select>
<div class="row"><label>Aktif</label>
<label class="sw"><input type="checkbox" id="fEn" checked><span class="sl"></span></label></div>
<div class="f2"><button type="submit" id="fSave">Tambah</button>
<button type="button" class="sec" id="fCancel" onclick="resetForm()" style="display:none">Batal</button></div>
</form></div>

<div class="card"><h2>File Bel (Kartu SD)</h2>
<div id="flist"></div>
<div class="mut" id="fs" style="margin-top:10px"></div>
<form onsubmit="upload(event)" style="margin-top:12px">
<input type="file" id="upFile" accept=".mp3,.wav" style="width:100%;margin-bottom:8px">
<button type="submit" class="full" style="margin-top:0">Unggah File</button>
<progress id="prog" value="0" max="100" style="display:none"></progress>
</form>
<p class="mut">Format .mp3 / .wav, nama maks 40 karakter (huruf, angka, - _ .), ukuran maks 10 MB. Nama yang sama akan ditimpa. Disarankan MP3 mono 64-128 kbps. File juga bisa disalin langsung ke folder <b>tone</b> di kartu SD.</p>
</div>

<div class="card"><h2>Jaringan</h2>
<div class="grid">
<div class="it"><div class="l">Mode</div><div class="v" id="nMode">-</div></div>
<div class="it"><div class="l">SSID</div><div class="v" id="nSsid">-</div></div>
<div class="it"><div class="l">Gateway</div><div class="v" id="nGw">-</div></div>
<div class="it"><div class="l">Rentang IP</div><div class="v" id="nRange">-</div></div>
</div>
<form onsubmit="saveStatic(event)" style="margin-top:12px">
<div class="row"><label>Pakai IP Statis</label>
<label class="sw"><input type="checkbox" id="stEn"><span class="sl"></span></label></div>
<input type="text" id="stIp" placeholder="192.168.1.50">
<p class="mut" id="stHint"></p>
<button type="submit" class="full" style="margin-top:0">Simpan &amp; Restart</button>
</form>
<button class="sec full" onclick="resetWifi()">Reset WiFi</button>
</div>
</div>

<script>
const $=id=>document.getElementById(id);
const DAYS={"all":"Setiap hari","mon-sat":"Senin-Sabtu","mon-fri":"Senin-Jumat","mon-thu":"Senin-Kamis","mon":"Senin","tue":"Selasa","wed":"Rabu","thu":"Kamis","fri":"Jumat","sat":"Sabtu","sun":"Minggu"};
const MODES={"reguler":"Reguler","ramadhan":"Ramadhan","pts":"PTS","pas":"PAS"};
const DOW=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
let slots=[],files=[],editId=-1,sdOk,cardBytes=0,bellBytes=0,maxUp=10485760,skipped=0;
const kb=n=>n>=1073741824?(n/1073741824).toFixed(1)+' GB':n>=1048576?(n/1048576).toFixed(2)+' MB':(n/1024).toFixed(1)+' KB';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function msg(t,ok){const m=$('msg');m.textContent=t;m.className=ok?'ok':'err';m.style.display='block';clearTimeout(msg.t);msg.t=setTimeout(()=>m.style.display='none',4500);}
async function post(url,data){
  try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data||{})});
  return await r.json();}catch(e){return {ok:false,msg:'Koneksi gagal'};}
}
async function act(url,data){const j=await post(url,data);msg(j.msg||'',j.ok);loadStatus();return j;}
async function getj(url){return await(await fetch(url)).json();}

$('fDay').innerHTML=Object.keys(DAYS).map(k=>`<option value="${k}">${DAYS[k]}</option>`).join('');
$('fMode').innerHTML=Object.keys(MODES).map(k=>`<option value="${k}">${MODES[k]}</option>`).join('');

async function loadStatus(){try{const s=await getj('/api/status');
 $('sTime').textContent=DOW[s.dow]+', '+s.time.substr(11);
 $('sNet').textContent=s.mode=='STA'?'WiFi ('+s.rssi+' dBm)':'Mode AP';
 $('sIp').textContent=s.ip;
 $('sPlay').textContent=s.playing?s.file:'-';
 $('sSd').textContent=s.sd?'Terpasang':'Tidak ada';
 $('sHol').textContent=s.holiday?'Aktif':'Nonaktif';
 $('sdWarn').style.display=s.sd?'none':'block';
 if(document.activeElement!==$('vol')){$('vol').value=s.volume;$('volVal').textContent=s.volume;}
 $('hol').checked=s.holiday;
 if(document.activeElement!==$('modeSel'))$('modeSel').value=s.sched_mode||'reguler';
 if(sdOk!==undefined&&s.sd!==sdOk){await loadFiles();await loadSched();}
}catch(e){}}
function setVol(v){act('/api/volume',{value:v});}
function setHol(c){act('/api/holiday',{value:c?1:0});}
function setMode(v){$('viewMode').value=v;act('/api/mode',{value:v}).then(loadSched);}

async function loadSched(){const m=$('viewMode').value;const j=await getj('/api/schedule?mode='+m);slots=j.slots;renderSched();}
function renderSched(){
 const el=$('sched');
 if(!slots.length){el.innerHTML='<p class="mut">Belum ada jadwal untuk mode ini.</p>';return;}
 el.innerHTML=slots.map(s=>`<div class="slot${s.enabled?'':' off'}">
 <div class="sinfo"><b>${s.time}</b> &middot; ${DAYS[s.day]||s.day}<br><span class="mut">${esc(s.file)}${files.some(f=>f.name==s.file)?'':' (file hilang)'}</span></div>
 <label class="sw"><input type="checkbox" ${s.enabled?'checked':''} onchange="toggleSlot(${s.id},this.checked)"><span class="sl"></span></label>
 <button class="sm sec" onclick="editSlot(${s.id})">Edit</button>
 <button class="sm danger" onclick="delSlot(${s.id})">Hapus</button></div>`).join('');
}
async function toggleSlot(id,en){const s=slots.find(x=>x.id==id);
 const j=await post('/api/schedule/update',{id:id,mode:s.mode,day:s.day,time:s.time,file:s.file,enabled:en?1:0});
 msg(j.msg,j.ok);loadSched();}
async function delSlot(id){if(!confirm('Hapus jadwal ini?'))return;
 const j=await post('/api/schedule/delete',{id:id});msg(j.msg,j.ok);loadSched();}
function editSlot(id){const s=slots.find(x=>x.id==id);editId=id;
 $('fMode').value=s.mode;$('fDay').value=s.day;$('fTime').value=s.time;$('fFile').value=s.file;$('fEn').checked=s.enabled;
 $('fTitle').textContent='Edit Jadwal';$('fSave').textContent='Simpan';$('fCancel').style.display='block';
 $('fTitle').scrollIntoView({behavior:'smooth'});}
function resetForm(){editId=-1;$('fTitle').textContent='Tambah Jadwal';$('fSave').textContent='Tambah';$('fCancel').style.display='none';$('fEn').checked=true;$('fMode').value=$('viewMode').value;}
async function saveSlot(e){e.preventDefault();
 const d={mode:$('fMode').value,day:$('fDay').value,time:$('fTime').value,file:$('fFile').value,enabled:$('fEn').checked?1:0};
 let j;
 if(editId>=0){d.id=editId;j=await post('/api/schedule/update',d);}else j=await post('/api/schedule/add',d);
 msg(j.msg,j.ok);if(j.ok){resetForm();loadSched();}}

async function loadFiles(){const j=await getj('/api/files');
 files=j.files;sdOk=j.sd;cardBytes=(j.card_kb||0)*1024;bellBytes=j.bell_bytes||0;maxUp=j.max_upload||maxUp;skipped=j.skipped||0;renderFiles();}
function renderFiles(){
 $('fs').textContent=sdOk?('Kartu SD '+kb(cardBytes)+' \u00b7 file bel '+kb(bellBytes)+' ('+files.length+' file)'+(skipped?' \u00b7 '+skipped+' file diabaikan (nama tidak valid)':'')):'Kartu SD tidak terdeteksi';
 $('flist').innerHTML=files.length?files.map(f=>`<div class="slot"><div class="sinfo">${esc(f.name)}<br><span class="mut">${kb(f.size)}</span></div>
 <button class="sm" onclick="playFile('${f.name}')">Putar</button>
 <button class="sm danger" onclick="delFile('${f.name}')">Hapus</button></div>`).join(''):'<p class="mut">Belum ada file. Unggah file .mp3 atau .wav.</p>';
 const sel=$('fFile'),cur=sel.value;
 sel.innerHTML=files.length?files.map(f=>`<option value="${f.name}">${esc(f.name)}</option>`).join(''):'<option value="">(belum ada file)</option>';
 if(cur)sel.value=cur;
}
function playFile(n){act('/api/ring',{file:n});}
async function delFile(n){if(!confirm('Hapus file '+n+'?'))return;
 const j=await post('/api/files/delete',{name:n});msg(j.msg,j.ok);loadFiles().then(renderSched);}
function upload(e){e.preventDefault();
 const f=$('upFile').files[0];if(!f){msg('Pilih file terlebih dahulu',false);return;}
 if(f.size>maxUp){msg('File terlalu besar (maks '+kb(maxUp)+')',false);return;}
 const fd=new FormData();fd.append('file',f,f.name);
 const x=new XMLHttpRequest();x.open('POST','/api/upload');
 const p=$('prog');p.style.display='block';p.value=0;
 x.upload.onprogress=ev=>{if(ev.lengthComputable)p.value=ev.loaded/ev.total*100;};
 x.onload=()=>{p.style.display='none';let j={};try{j=JSON.parse(x.responseText)}catch(_){}
  msg(j.msg||'Unggah gagal',!!j.ok);$('upFile').value='';loadFiles().then(renderSched);};
 x.onerror=()=>{p.style.display='none';msg('Koneksi terputus saat unggah',false);};
 x.send(fd);}

async function loadNet(){const n=await getj('/api/network');
 $('nMode').textContent=n.mode=='STA'?'Terhubung WiFi':'AP (192.168.4.1)';
 $('nSsid').textContent=n.ssid||'-';
 $('nGw').textContent=n.gateway||'-';
 $('nRange').textContent=n.range_start?n.range_start+' - '+n.range_end:'-';
 $('stEn').checked=n.static_enabled;
 $('stIp').value=n.static_enabled?n.static_ip:(n.range_start?n.ip:'');
 $('stHint').textContent=n.range_start?
  'IP harus dalam rentang '+n.range_start+' - '+n.range_end+'. Pilih IP di luar rentang DHCP router agar tidak bentrok.':
  'Sambungkan perangkat ke WiFi dulu untuk mengatur IP statis.';}
async function saveStatic(e){e.preventDefault();
 const en=$('stEn').checked;
 if(!confirm('Perangkat akan restart. Lanjutkan?'))return;
 const j=await post('/api/network/static',{enabled:en?1:0,ip:$('stIp').value});
 msg(j.msg,j.ok);
 if(j.ok&&j.new_ip)setTimeout(()=>{location.href='http://'+j.new_ip+'/';},9000);}
async function resetWifi(){if(!confirm('Reset koneksi WiFi? Perangkat akan restart dan membuka portal di 192.168.4.1'))return;
 const j=await post('/api/network/reset');msg(j.msg,j.ok);}

(async()=>{await loadFiles();await loadSched();await loadNet();await loadStatus();setInterval(loadStatus,3000);})();
</script></body></html>
)rawliteral";

// ================== WEB: UPLOAD ==================
FsFile upFile;
AsyncWebServerRequest *upOwner = nullptr;
String upPath;
unsigned long upLast = 0;

void handleUpload(AsyncWebServerRequest *request, const String &filename,
                  size_t index, uint8_t *data, size_t len, bool final)
{
    if (index == 0)
    {
        request->_tempObject = calloc(1, 1);
        uint8_t *st = (uint8_t *)request->_tempObject;
        String name = sanitizeName(filename);
        if (!sdReady)
        {
            *st = 5;
        }
        else if (name.length() == 0)
        {
            *st = 2;
        }
        else if (request->contentLength() > MAX_UPLOAD_BYTES)
        {
            *st = 6;
        }
        else
        {
            if (strcmp(playingFile, name.c_str()) == 0)
            {
                audioSend(CMD_STOP);
                vTaskDelay(pdMS_TO_TICKS(150));
            }
            Lock l(sdMutex);
            if (upOwner)
            {
                *st = 4;
            }
            else
            {
                String path = bellPath(name);
                upFile = sd.open(path.c_str(), O_WRONLY | O_CREAT | O_TRUNC);
                if (!upFile.isOpen())
                {
                    *st = 3;
                    sdCheckErrorLocked();
                }
                else
                {
                    upOwner = request;
                    upPath = path;
                    upLast = millis();
                }
            }
        }
    }

    uint8_t *st = (uint8_t *)request->_tempObject;
    if (!st)
        return;

    Lock l(sdMutex);
    if (upOwner != request)
        return;
    if (*st == 0 && len && upFile.write(data, len) != len)
    {
        *st = 3;
        sdCheckErrorLocked();
    }
    upLast = millis();
    if (final)
    {
        bool closed = upFile.close();
        if (!closed && *st == 0)
            *st = 3;
        if (*st != 0)
            sd.remove(upPath.c_str());
        upOwner = nullptr;
        upPath = "";
    }
}

void uploadWatchdog()
{
    if (!upOwner || millis() - upLast < 15000)
        return;
    Lock l(sdMutex);
    if (!upOwner)
        return;
    if (upFile.isOpen())
        upFile.close();
    if (upPath.length())
        sd.remove(upPath.c_str());
    upOwner = nullptr;
    upPath = "";
    Serial.println("Unggahan terputus, file sementara dihapus");
}

// ================== WEB: ROUTES ==================
bool parseSlot(AsyncWebServerRequest *r, BellSlot &s, String &err)
{
    s.mode = modeFromCode(postParam(r, "mode"));
    s.day = postParam(r, "day");
    s.time = postParam(r, "time");
    s.file = sanitizeName(postParam(r, "file"));
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
    if (s.file.length() == 0 || !sdFileExists(bellPath(s.file)))
    {
        err = "File bel tidak ditemukan. Unggah dulu.";
        return false;
    }
    return true;
}

const char *SD_MISSING = "Kartu SD tidak terdeteksi";

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
        StaticJsonDocument<384> d;
        d["time"] = tb;
        d["dow"] = now.dayOfTheWeek();
        d["mode"] = sta ? "STA" : "AP";
        d["ip"] = sta ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
        d["rssi"] = sta ? WiFi.RSSI() : 0;
        d["volume"] = currentVolume;
        d["holiday"] = holidayMode;
        d["sched_mode"] = modeCode(activeMode);
        d["sd"] = (bool)sdReady;
        d["playing"] = (bool)audioPlaying;
        d["file"] = (const char *)playingFile;
        String out;
        serializeJson(d, out);
        r->send(200, "application/json", out); });

    server.on("/api/ring", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        if (!sdReady) return sendResult(r, false, SD_MISSING);
        String name = sanitizeName(postParam(r, "file"));
        if (!name.length() || !sdFileExists(bellPath(name))) return sendResult(r, false, "File tidak ditemukan");
        audioSend(CMD_PLAY, name.c_str());
        sendResult(r, true, "Memutar " + name); });

    server.on("/api/stop", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        audioSend(CMD_STOP);
        sendResult(r, true, "Bel dihentikan"); });

    server.on("/api/volume", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        currentVolume = constrain(postParam(r, "value").toInt(), 0, 100);
        audioSend(CMD_VOLUME);
        bool saved = saveConfig();
        sendResult(r, true, "Volume " + String(currentVolume) + "%" + (saved ? "" : " (belum tersimpan: kartu SD tidak ada)")); });

    server.on("/api/holiday", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        holidayMode = postParam(r, "value") == "1";
        bool saved = saveConfig();
        sendResult(r, true, String(holidayMode ? "Mode libur aktif" : "Mode libur nonaktif") + (saved ? "" : " (belum tersimpan: kartu SD tidak ada)")); });

    // Mode jadwal aktif (reguler/ramadhan/pts/pas)
    server.on("/api/mode", HTTP_GET, [](AsyncWebServerRequest *r)
              {
        StaticJsonDocument<128> d;
        d["mode"] = modeCode(activeMode);
        String out; serializeJson(d, out);
        r->send(200, "application/json", out); });
    server.on("/api/mode", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        activeMode = modeFromCode(postParam(r, "value"));
        bool saved = saveConfig();
        sendResult(r, true, String("Mode aktif: ") + modeCode(activeMode) +
            (saved ? "" : " (belum tersimpan: kartu SD tidak ada)")); });

    // ---------- Jadwal ----------
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
            for (auto &s : schedule) {
                if (hasFilter && s.mode != filter) { i++; continue; }
                JsonObject o = a.createNestedObject();
                o["id"] = i++;
                o["mode"] = modeCode(s.mode);
                o["day"] = s.day;
                o["time"] = s.time;
                o["file"] = s.file;
                o["enabled"] = s.enabled;
            }
        }
        d["max"] = MAX_SLOTS;
        AsyncResponseStream *res = r->beginResponseStream("application/json");
        serializeJson(d, *res);
        r->send(res); });

    server.on("/api/schedule/add", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        if (!sdReady) return sendResult(r, false, SD_MISSING);
        BellSlot s;
        String err;
        if (!parseSlot(r, s, err)) return sendResult(r, false, err);
        bool full = false, saved = true;
        {
            Lock l(dataMutex);
            if (schedule.size() >= MAX_SLOTS) full = true;
            else { schedule.push_back(s); sortSchedule(); saved = saveScheduleLocked(); }
        }
        if (full) return sendResult(r, false, "Jadwal penuh (maks " + String(MAX_SLOTS) + ")");
        if (!saved) return sendResult(r, false, "Gagal menyimpan ke kartu SD");
        sendResult(r, true, "Jadwal ditambahkan"); });

    server.on("/api/schedule/update", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        if (!sdReady) return sendResult(r, false, SD_MISSING);
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
        if (!saved) return sendResult(r, false, "Gagal menyimpan ke kartu SD");
        sendResult(r, true, "Jadwal disimpan"); });

    server.on("/api/schedule/delete", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        if (!sdReady) return sendResult(r, false, SD_MISSING);
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
        if (!saved) return sendResult(r, false, "Gagal menyimpan ke kartu SD");
        sendResult(r, true, "Jadwal dihapus"); });

    // ---------- File bel ----------
    server.on("/api/files", HTTP_GET, [](AsyncWebServerRequest *r)
              {
        DynamicJsonDocument d(8192);
        JsonArray a = d.createNestedArray("files");
        uint32_t bellBytes = 0, skipped = 0, cardKb = 0;
        bool ok = sdReady;
        {
            Lock l(sdMutex);
            if (sdReady) {
                FsFile dir = sd.open(BELL_DIR);
                if (dir && dir.isDir()) {
                    FsFile f;
                    char nm[64];
                    while (a.size() < MAX_FILES && f.openNext(&dir, O_RDONLY)) {
                        if (!f.isDir() && !f.isHidden()) {
                            f.getName(nm, sizeof(nm));
                            String raw = String(nm);
                            String clean = sanitizeName(raw);
                            if (raw[0] != '.') {
                                if (clean.length() && clean.equalsIgnoreCase(raw)) {
                                    JsonObject o = a.createNestedObject();
                                    o["name"] = clean;
                                    o["size"] = (uint32_t)f.fileSize();
                                    bellBytes += (uint32_t)f.fileSize();
                                } else {
                                    String low = raw;
                                    low.toLowerCase();
                                    if (low.endsWith(".mp3") || low.endsWith(".wav")) skipped++;
                                }
                            }
                        }
                        f.close();
                    }
                    dir.close();
                }
                if (sd.card()) cardKb = sd.card()->sectorCount() / 2;
            }
        }
        d["sd"] = ok;
        d["card_kb"] = cardKb;
        d["bell_bytes"] = bellBytes;
        d["skipped"] = skipped;
        d["max_upload"] = MAX_UPLOAD_BYTES;
        AsyncResponseStream *res = r->beginResponseStream("application/json");
        serializeJson(d, *res);
        r->send(res); });

    server.on(
        "/api/upload", HTTP_POST,
        [](AsyncWebServerRequest *r)
        {
            uint8_t code = r->_tempObject ? *(uint8_t *)r->_tempObject : 255;
            switch (code)
            {
            case 0:
                sendResult(r, true, "File berhasil diunggah");
                break;
            case 2:
                sendResult(r, false, "Nama/format tidak valid (.mp3/.wav, maks 40 karakter)");
                break;
            case 3:
                sendResult(r, false, "Gagal menulis ke kartu SD (penuh atau bermasalah)");
                break;
            case 4:
                sendResult(r, false, "Unggahan lain sedang berjalan, coba lagi sebentar");
                break;
            case 5:
                sendResult(r, false, SD_MISSING);
                break;
            case 6:
                sendResult(r, false, "File terlalu besar (maks 10 MB)");
                break;
            default:
                sendResult(r, false, "Tidak ada file diterima");
            }
        },
        handleUpload);

    server.on("/api/files/delete", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        if (!sdReady) return sendResult(r, false, SD_MISSING);
        String name = sanitizeName(postParam(r, "name"));
        if (!name.length() || !sdFileExists(bellPath(name))) return sendResult(r, false, "File tidak ditemukan", 404);
        bool used = false;
        {
            Lock l(dataMutex);
            for (auto &s : schedule) if (s.file == name) { used = true; break; }
        }
        if (used) return sendResult(r, false, "File masih dipakai jadwal. Ubah/hapus jadwalnya dulu.");
        if (strcmp(playingFile, name.c_str()) == 0) {
            audioSend(CMD_STOP);
            vTaskDelay(pdMS_TO_TICKS(150));
        }
        bool ok;
        {
            Lock l(sdMutex);
            ok = sd.remove(bellPath(name).c_str());
            if (!ok) sdCheckErrorLocked();
        }
        sendResult(r, ok, ok ? "File dihapus" : "Gagal menghapus file"); });

    // ---------- Jaringan ----------
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
        if (!sdReady) return sendResult(r, false, "Kartu SD tidak terdeteksi, pengaturan tidak bisa disimpan");
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
        if (!saveConfig()) return sendResult(r, false, "Gagal menyimpan ke kartu SD");
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

// ================== SETUP ==================
void setup()
{
    Serial.begin(115200);
    delay(1000);

    i2cMutex = xSemaphoreCreateMutex();
    dataMutex = xSemaphoreCreateMutex();
    sdMutex = xSemaphoreCreateMutex();
    audioQueue = xQueueCreate(6, sizeof(AudioCmd));

    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    lcd.init();
    lcd.backlight();
    lcd.clear();

    if (!rtc.begin())
        Serial.println("RTC tidak terdeteksi!");
    if (rtc.lostPower())
    {
        Serial.println("RTC kehilangan daya, set waktu sementara ke compile time");
        rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    }

    xTaskCreate(lcdTask, "lcdTask", 4096, NULL, 1, NULL);

    sdSpi.begin(SD_SCK_PIN, SD_MISO_PIN, SD_MOSI_PIN, SD_CS_PIN);
    if (sdMount())
    {
        Serial.println("Kartu SD siap");
        loadConfig();
        loadSchedule();
    }
    else
    {
        Serial.println("Kartu SD tidak terdeteksi! Bel tidak aktif sampai kartu dipasang.");
    }

    xTaskCreate(audioTask, "audioTask", 12288, NULL, 2, NULL);
    xTaskCreate(bellTask, "bellTask", 4096, NULL, 1, NULL);

    connectWiFi();
    setupWebServer();
    server.begin();
}

// ================== LOOP ==================
void loop()
{
    networkTick();
    sdTick();
    uploadWatchdog();

    if (WiFi.status() == WL_CONNECTED)
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

    delay(200);
}
