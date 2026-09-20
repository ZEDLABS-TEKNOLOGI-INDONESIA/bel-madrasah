#pragma once
#include <Arduino.h>

enum ScheduleMode : uint8_t
{
    MODE_REGULER = 0,
    MODE_RAMADHAN,
    MODE_PTS,
    MODE_PAS,
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
