#pragma once
#include <Arduino.h>

enum ScheduleMode : uint8_t
{
    MODE_REGULER = 0,
    MODE_RAMADHAN,
    MODE_PTS,
    MODE_PAS,
    MODE_PESANTREN,
    MODE_LAINNYA,
    MODE_COUNT
};

struct BellSlot
{
    ScheduleMode mode;
    String time;
    String day;
    uint16_t track;
    bool enabled;
};

struct TrackInfo
{
    uint16_t track;
    String label;
};

struct StaticCfg
{
    bool enabled = false;
    String ssid, ip, gw, mask, dns;
};

struct DateRangeCfg
{
    String start;
    String end;
};

struct ModeCfg
{
    bool manualOverride = false;
    ScheduleMode manualMode = MODE_REGULER;
    DateRangeCfg ranges[MODE_COUNT];
    uint8_t disabledDays[MODE_COUNT] = {0};
};

struct Holiday
{
    String date;
    String name;
};

struct ActiveModeInfo
{
    ScheduleMode mode;
    const char *source;
};

enum AudioCmdType : uint8_t
{
    AC_PLAY,
    AC_STOP,
    AC_VOLUME,
    AC_EQ
};

struct AudioCmd
{
    AudioCmdType type;
    uint16_t arg;
};

enum SlotLookup : uint8_t
{
    SLOT_OK,
    SLOT_MISSING,
    SLOT_CHANGED
};

enum JobState : uint8_t
{
    JOB_IDLE,
    JOB_RUNNING,
    JOB_DONE,
    JOB_ERROR
};

struct NationalHoliday
{
    String date;
    String name;
    bool cuti;
};

enum OtaAction : uint8_t
{
    OTA_CHECK,
    OTA_INSTALL,
    OTA_AUTO
};
