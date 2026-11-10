#include <WiFi.h>
#include <esp_wifi.h>
#include <esp_random.h>
#include <esp_ota_ops.h>
#include <WiFiManager.h>
#include <ESPmDNS.h>
#include <ESPAsyncWebServer.h>
#include <NetworkClientSecure.h>
#include <HTTPClient.h>
#include <Update.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <RTClib.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <LittleFS.h>
#include <HardwareSerial.h>
#include <DFRobotDFPlayerMini.h>
#include <mbedtls/sha256.h>
#include <mbedtls/pkcs5.h>
#include <time.h>
#include <vector>
#include <algorithm>
#include "types.h"
#include "bell_logic.h"
#include "index_html.h"

#define FW_VERSION "2.0.0"
#define FW_REPO "ZEDLABS-TEKNOLOGI-INDONESIA/bel-madrasah"

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
const char *DEFAULT_ADMIN_PASSWORD = "P@ssw0rd";
const IPAddress AP_IP(192, 168, 4, 1);
const IPAddress AP_MASK(255, 255, 255, 0);

const char *SCHEDULE_FILE = "/schedule.json";
const char *CONFIG_FILE = "/config.json";
const char *TRACKS_FILE = "/tracks.json";
const char *HOLIDAYS_FILE = "/holidays.json";
const char *LOG_FILE = "/log.jsonl";
const char *AUTH_FILE = "/auth.json";

const size_t MAX_SLOTS = 300;
const size_t MAX_TRACKS = 60;
const size_t MAX_HOLIDAYS = 120;
const size_t MAX_LOG_LINES = 150;
const uint16_t MAX_TRACK_NO = 2999;
const unsigned long NTP_SYNC_INTERVAL = 3600000UL;
const unsigned long NTP_RETRY_INTERVAL = 60000UL;
const unsigned long DFP_RETRY_INTERVAL = 5000UL;
const unsigned long RTC_CHECK_INTERVAL = 5000UL;
const int RTC_STOP_LIMIT = 3;
const unsigned long PLAY_TIMEOUT = 15UL * 60UL * 1000UL;
const unsigned long BELL_TICK_MS = 300;
const time_t SYSTEM_TIME_VALID_AFTER = 1735689600;

RTC_DS1307 rtc;
Adafruit_SSD1306 oled(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
bool oledReady = false;
AsyncWebServer server(80);
HardwareSerial dfpSerial(1);
DFRobotDFPlayerMini dfPlayer;

std::vector<BellSlot> schedule;
std::vector<TrackInfo> trackList;
std::vector<Holiday> holidays;
StaticCfg staticCfg;
ModeCfg modeCfg;

volatile int currentVolume = 20;
volatile int eqPreset = 0;
volatile bool holidayMode = false;
volatile bool autoUpdate = true;
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
volatile bool ntpLastOk = false;
uint32_t lastTriggeredMinute = 0;

volatile bool timeTrusted = false;
volatile bool rtcPresent = false;
bell::TimeGuard timeGuard;

volatile bool audioPlaying = false;
volatile uint16_t playingTrack = 0;
unsigned long playStartedAt = 0;
volatile uint16_t scheduledTrack = 0;
unsigned long scheduledAt = 0;
String lastDfpError;
String lastBell;
volatile unsigned long bellHeartbeat = 0;

SemaphoreHandle_t i2cMutex;
SemaphoreHandle_t dataMutex;
SemaphoreHandle_t timeMutex;
SemaphoreHandle_t cfgMutex;
SemaphoreHandle_t infoMutex;
SemaphoreHandle_t logMutex;
SemaphoreHandle_t authMutex;
SemaphoreHandle_t jobMutex;
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

void scheduleRestart(unsigned long delayMs)
{
    restartAt = millis() + delayMs;
    restartPending = true;
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
    logMutex = xSemaphoreCreateMutex();
    authMutex = xSemaphoreCreateMutex();
    jobMutex = xSemaphoreCreateMutex();
    audioQueue = xQueueCreate(8, sizeof(AudioCmd));

    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
    displayBegin();
    clockBegin();

    if (!LittleFS.begin(true))
        Serial.println("LittleFS gagal mount");
    loadConfig();
    loadSchedule();
    loadTracks();
    loadHolidays();
    logBegin();
    authBegin();
    otaBootReport();

    dfpBegin();

    xTaskCreate(oledTask, "oledTask", 4096, NULL, 1, NULL);
    xTaskCreate(bellTask, "bellTask", 6144, NULL, 2, NULL);
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

    serialCommandTick();
    otaTick();

    if (restartPending && (long)(millis() - restartAt) >= 0)
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
