#pragma once
#include <stddef.h>
#include <stdint.h>
#include <string.h>

namespace bell
{

const int MIN_VALID_YEAR = 2025;
const int MAX_VALID_YEAR = 2099;
const long MAX_FORWARD_STEP_S = 120;
const int TIME_ANOMALY_LIMIT = 5;

static const char *const DAY_CODES[] = {"all", "mon-sat", "mon-fri", "mon-thu",
                                        "mon", "tue", "wed", "thu", "fri", "sat", "sun"};
const int DAY_CODE_COUNT = sizeof(DAY_CODES) / sizeof(DAY_CODES[0]);

inline int dayRank(const char *d)
{
    for (int i = 0; i < DAY_CODE_COUNT; i++)
        if (strcmp(d, DAY_CODES[i]) == 0)
            return i;
    return -1;
}

inline bool validDay(const char *d)
{
    return dayRank(d) >= 0;
}

inline const char *dayCodeOf(int dow)
{
    static const char *const codes[] = {"sun", "mon", "tue", "wed", "thu", "fri", "sat"};
    return (dow >= 0 && dow <= 6) ? codes[dow] : "";
}

inline bool dayMatches(const char *d, int dow)
{
    if (strcmp(d, "all") == 0)
        return dow >= 0 && dow <= 6;
    if (strcmp(d, "mon-sat") == 0)
        return dow >= 1 && dow <= 6;
    if (strcmp(d, "mon-fri") == 0)
        return dow >= 1 && dow <= 5;
    if (strcmp(d, "mon-thu") == 0)
        return dow >= 1 && dow <= 4;
    return strcmp(d, dayCodeOf(dow)) == 0;
}

inline bool isDigit(char c)
{
    return c >= '0' && c <= '9';
}

inline bool validTime(const char *t)
{
    if (strlen(t) != 5 || t[2] != ':')
        return false;
    if (!isDigit(t[0]) || !isDigit(t[1]) || !isDigit(t[3]) || !isDigit(t[4]))
        return false;
    int h = (t[0] - '0') * 10 + (t[1] - '0');
    int m = (t[3] - '0') * 10 + (t[4] - '0');
    return h < 24 && m < 60;
}

inline int timeToMin(const char *t, int fallback)
{
    if (!validTime(t))
        return fallback;
    return ((t[0] - '0') * 10 + (t[1] - '0')) * 60 + (t[3] - '0') * 10 + (t[4] - '0');
}

inline bool inSleepWindow(bool enabled, int startMin, int endMin, int nowMin)
{
    if (!enabled || startMin == endMin)
        return false;
    if (startMin < endMin)
        return nowMin >= startMin && nowMin < endMin;
    return nowMin >= startMin || nowMin < endMin;
}

struct SlotView
{
    int mode;
    const char *day;
    const char *time;
    uint16_t track;
    bool enabled;
};

// Pilih slot yang berbunyi pada menit ini. Bila beberapa slot cocok, hari yang
// paling spesifik menang (mis. "mon" mengalahkan "mon-fri"); bila sama
// spesifiknya, slot pertama menang.
inline int pickSlot(const SlotView *slots, size_t n, int mode, const char *hhmm, int dow)
{
    int best = -1;
    int bestRank = -1;
    for (size_t i = 0; i < n; i++)
    {
        const SlotView &s = slots[i];
        if (!s.enabled || s.mode != mode || s.track == 0)
            continue;
        if (strcmp(s.time, hhmm) != 0 || !dayMatches(s.day, dow))
            continue;
        int rank = dayRank(s.day);
        if (rank > bestRank)
        {
            best = (int)i;
            bestRank = rank;
        }
    }
    return best;
}

// Penjaga waktu RTC. Satu pembacaan aneh (gangguan I2C) hanya dilewati;
// waktu baru dianggap tidak tepercaya bila anomali berulang terus-menerus.
class TimeGuard
{
public:
    enum Result
    {
        OK,
        SKIP,
        DISTRUST
    };

    Result feed(uint32_t unix, int year)
    {
        bool anomaly = year < MIN_VALID_YEAR || year > MAX_VALID_YEAR;
        if (!anomaly && last_ != 0)
        {
            long d = (long)unix - (long)last_;
            anomaly = d < 0 || d > MAX_FORWARD_STEP_S;
        }
        if (!anomaly)
        {
            last_ = unix;
            bad_ = 0;
            return OK;
        }
        if (++bad_ < TIME_ANOMALY_LIMIT)
            return SKIP;
        bad_ = 0;
        bool validYear = year >= MIN_VALID_YEAR && year <= MAX_VALID_YEAR;
        last_ = validYear ? unix : 0;
        return DISTRUST;
    }

    void reset()
    {
        last_ = 0;
        bad_ = 0;
    }

    int pendingAnomalies() const { return bad_; }

private:
    uint32_t last_ = 0;
    int bad_ = 0;
};

inline uint32_t slotSignature(int mode, const char *day, const char *time, uint16_t track)
{
    uint32_t h = 2166136261u;
    auto mix = [&h](uint8_t b) {
        h ^= b;
        h *= 16777619u;
    };
    mix((uint8_t)mode);
    for (const char *p = day; *p; p++)
        mix((uint8_t)*p);
    mix('|');
    for (const char *p = time; *p; p++)
        mix((uint8_t)*p);
    mix((uint8_t)(track >> 8));
    mix((uint8_t)track);
    return h;
}

} // namespace bell
