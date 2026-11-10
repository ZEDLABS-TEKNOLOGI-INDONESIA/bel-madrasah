#pragma once
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
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

inline bool validDate(const char *d)
{
    if (strlen(d) != 10 || d[4] != '-' || d[7] != '-')
        return false;
    static const uint8_t digits[] = {0, 1, 2, 3, 5, 6, 8, 9};
    for (uint8_t i : digits)
        if (!isDigit(d[i]))
            return false;
    int y = (d[0] - '0') * 1000 + (d[1] - '0') * 100 + (d[2] - '0') * 10 + (d[3] - '0');
    int m = (d[5] - '0') * 10 + (d[6] - '0');
    int day = (d[8] - '0') * 10 + (d[9] - '0');
    if (y < 2000 || y > MAX_VALID_YEAR || m < 1 || m > 12 || day < 1)
        return false;
    static const uint8_t days[] = {31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
    if (day > days[m - 1])
        return false;
    bool leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    return !(m == 2 && day == 29 && !leap);
}

inline bool inDateRange(const char *today, const char *start, const char *end)
{
    if (!validDate(start) || !validDate(end))
        return false;
    return strcmp(today, start) >= 0 && strcmp(today, end) <= 0;
}

struct DateRange
{
    int mode;
    const char *start;
    const char *end;
};

// Mode aktif: override manual menang; selain itu rentang pertama yang memuat
// tanggal hari ini (urutan array = prioritas), atau fallback bila tidak ada.
inline int resolveMode(bool manualOverride, int manualMode, const DateRange *ranges, size_t n,
                       const char *today, int fallback)
{
    if (manualOverride)
        return manualMode;
    for (size_t i = 0; i < n; i++)
        if (inDateRange(today, ranges[i].start, ranges[i].end))
            return ranges[i].mode;
    return fallback;
}

// Membandingkan versi "X.Y.Z" (awalan "fw-v" atau "v" diabaikan).
// Hasil <0, 0, >0 seperti strcmp. Versi tidak valid dianggap paling rendah.
inline bool parseVersion(const char *v, int out[3])
{
    if (strncmp(v, "fw-", 3) == 0)
        v += 3;
    if (*v == 'v')
        v++;
    for (int i = 0; i < 3; i++)
    {
        if (!isDigit(*v))
            return false;
        int n = 0;
        while (isDigit(*v))
        {
            n = n * 10 + (*v - '0');
            if (n > 99999)
                return false;
            v++;
        }
        out[i] = n;
        if (i < 2)
        {
            if (*v != '.')
                return false;
            v++;
        }
    }
    return *v == '\0';
}

inline int compareVersion(const char *a, const char *b)
{
    int va[3], vb[3];
    bool oka = parseVersion(a, va), okb = parseVersion(b, vb);
    if (!oka || !okb)
        return (int)oka - (int)okb;
    for (int i = 0; i < 3; i++)
        if (va[i] != vb[i])
            return va[i] < vb[i] ? -1 : 1;
    return 0;
}

// Pengurai kalender hari libur (ICS) baris demi baris, hemat memori.
// Baris lanjutan (diawali spasi) harus sudah digabung oleh pemanggil.
class IcsHolidayParser
{
public:
    struct Holiday
    {
        char date[11];
        char name[64];
        bool cuti;
    };

    explicit IcsHolidayParser(int year) : year_(year) {}

    // Mengembalikan true bila baris ini menutup sebuah hari libur yang valid
    // untuk tahun target; hasilnya ada di `out`.
    bool feed(const char *line, Holiday &out)
    {
        if (strcmp(line, "BEGIN:VEVENT") == 0)
        {
            inEvent_ = true;
            start_[0] = summary_[0] = 0;
            observance_ = false;
            return false;
        }
        if (!inEvent_)
            return false;
        if (strcmp(line, "END:VEVENT") == 0)
        {
            inEvent_ = false;
            return emit(out);
        }
        const char *colon = strchr(line, ':');
        if (!colon)
            return false;
        const char *value = colon + 1;
        if (strncmp(line, "DTSTART", 7) == 0)
        {
            const char *p = value;
            while (*p && !isDigit(*p))
                p++;
            size_t i = 0;
            while (i < 8 && isDigit(p[i]))
                i++;
            if (i == 8)
            {
                memcpy(start_, p, 8);
                start_[8] = 0;
            }
        }
        else if (strncmp(line, "SUMMARY", 7) == 0)
            unescape(value, summary_, sizeof(summary_));
        else if (strncmp(line, "DESCRIPTION", 11) == 0)
            observance_ = startsWithCI(value, "perayaan") || startsWithCI(value, "observance");
        return false;
    }

private:
    int year_;
    bool inEvent_ = false;
    bool observance_ = false;
    char start_[9] = {0};
    char summary_[64] = {0};

    static char lower(char c) { return (c >= 'A' && c <= 'Z') ? (char)(c + 32) : c; }

    static bool startsWithCI(const char *s, const char *prefix)
    {
        for (; *prefix; s++, prefix++)
            if (lower(*s) != *prefix)
                return false;
        return true;
    }

    static bool containsCI(const char *s, const char *needle)
    {
        for (; *s; s++)
            if (startsWithCI(s, needle))
                return true;
        return false;
    }

    static void unescape(const char *in, char *out, size_t cap)
    {
        size_t o = 0;
        for (const char *p = in; *p && o + 1 < cap; p++)
        {
            if (*p == '\\' && p[1])
            {
                p++;
                out[o++] = (*p == 'n' || *p == 'N') ? ' ' : *p;
            }
            else
                out[o++] = *p;
        }
        out[o] = 0;
    }

    bool emit(Holiday &out)
    {
        if (observance_ || !start_[0] || !summary_[0])
            return false;
        int y = (start_[0] - '0') * 1000 + (start_[1] - '0') * 100 + (start_[2] - '0') * 10 + (start_[3] - '0');
        if (y != year_)
            return false;
        snprintf(out.date, sizeof(out.date), "%.4s-%.2s-%.2s", start_, start_ + 4, start_ + 6);
        if (!validDate(out.date))
            return false;
        strncpy(out.name, summary_, sizeof(out.name) - 1);
        out.name[sizeof(out.name) - 1] = 0;
        out.cuti = containsCI(summary_, "cuti bersama") || containsCI(summary_, "joint holiday");
        return true;
    }
};

inline bool constantTimeEqual(const uint8_t *a, const uint8_t *b, size_t n)
{
    uint8_t diff = 0;
    for (size_t i = 0; i < n; i++)
        diff |= a[i] ^ b[i];
    return diff == 0;
}

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
