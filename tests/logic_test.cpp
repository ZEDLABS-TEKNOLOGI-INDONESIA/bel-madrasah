#include "../bell_logic.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>

using namespace bell;

static int failures = 0;
#define CHECK(cond)                                                     \
    do                                                                  \
    {                                                                   \
        if (!(cond))                                                    \
        {                                                               \
            std::printf("GAGAL %s:%d  %s\n", __FILE__, __LINE__, #cond); \
            failures++;                                                 \
        }                                                               \
    } while (0)

static void testDays()
{
    CHECK(dayMatches("all", 0) && dayMatches("all", 6));
    CHECK(dayMatches("mon-fri", 1) && dayMatches("mon-fri", 5) && !dayMatches("mon-fri", 6) && !dayMatches("mon-fri", 0));
    CHECK(dayMatches("mon-sat", 6) && !dayMatches("mon-sat", 0));
    CHECK(dayMatches("mon-thu", 4) && !dayMatches("mon-thu", 5));
    CHECK(dayMatches("fri", 5) && !dayMatches("fri", 4));
    CHECK(dayMatches("sun", 0));
    CHECK(!dayMatches("xyz", 1) && !dayMatches("all", 7));
    CHECK(validDay("mon-thu") && !validDay("") && !validDay("Mon"));
    CHECK(dayRank("mon") > dayRank("mon-fri") && dayRank("mon-fri") > dayRank("all"));
}

static void testTime()
{
    CHECK(validTime("00:00") && validTime("23:59") && validTime("07:05"));
    CHECK(!validTime("24:00") && !validTime("12:60") && !validTime("7:05") && !validTime("07-05") && !validTime("07:05:00") && !validTime("ab:cd"));
    CHECK(timeToMin("18:30", -1) == 18 * 60 + 30);
    CHECK(timeToMin("99:99", 42) == 42);
}

static void testSleep()
{
    CHECK(!inSleepWindow(false, 0, 600, 100));
    CHECK(!inSleepWindow(true, 600, 600, 600));
    CHECK(inSleepWindow(true, 600, 900, 600) && !inSleepWindow(true, 600, 900, 900));
    int s = 18 * 60, e = 5 * 60;
    CHECK(inSleepWindow(true, s, e, 18 * 60) && inSleepWindow(true, s, e, 23 * 60 + 59));
    CHECK(inSleepWindow(true, s, e, 0) && inSleepWindow(true, s, e, 4 * 60 + 59));
    CHECK(!inSleepWindow(true, s, e, 5 * 60) && !inSleepWindow(true, s, e, 12 * 60));
}

static void testPickSlot()
{
    SlotView slots[] = {
        {0, "mon-fri", "10:00", 11, true},
        {0, "mon", "10:00", 19, true},
        {1, "mon", "10:00", 5, true},
        {0, "all", "07:00", 1, true},
        {0, "mon", "07:00", 3, false},
        {0, "tue", "08:00", 0, true},
    };
    size_t n = sizeof(slots) / sizeof(slots[0]);
    CHECK(pickSlot(slots, n, 0, "10:00", 1) == 1);
    CHECK(pickSlot(slots, n, 0, "10:00", 2) == 0);
    CHECK(pickSlot(slots, n, 1, "10:00", 1) == 2);
    CHECK(pickSlot(slots, n, 0, "07:00", 1) == 3);
    CHECK(pickSlot(slots, n, 0, "08:00", 2) == -1);
    CHECK(pickSlot(slots, n, 0, "10:00", 0) == -1);
}

static void testTimeGuard()
{
    const uint32_t t0 = 1767225600;
    TimeGuard g;
    CHECK(g.feed(t0, 2026) == TimeGuard::OK);
    CHECK(g.feed(t0 + 1, 2026) == TimeGuard::OK);

    CHECK(g.feed(4000000000u, 2096) == TimeGuard::SKIP);
    CHECK(g.feed(t0 + 2, 2026) == TimeGuard::OK);

    CHECK(g.feed(0, 2000) == TimeGuard::SKIP);
    CHECK(g.feed(t0 + 3, 2026) == TimeGuard::OK);

    TimeGuard j;
    j.feed(t0, 2026);
    TimeGuard::Result r = TimeGuard::OK;
    int skips = 0;
    for (int i = 0; i < TIME_ANOMALY_LIMIT; i++)
    {
        r = j.feed(t0 + 3600 + i, 2026);
        if (r == TimeGuard::SKIP)
            skips++;
    }
    CHECK(skips == TIME_ANOMALY_LIMIT - 1);
    CHECK(r == TimeGuard::DISTRUST);
    CHECK(j.feed(t0 + 3600 + TIME_ANOMALY_LIMIT, 2026) == TimeGuard::OK);

    TimeGuard b;
    b.feed(t0, 2026);
    for (int i = 0; i < TIME_ANOMALY_LIMIT - 1; i++)
        b.feed(t0 - 10, 2026);
    CHECK(b.feed(t0 - 10, 2026) == TimeGuard::DISTRUST);

    TimeGuard s;
    s.feed(t0, 2026);
    s.reset();
    CHECK(s.feed(t0 + 86400, 2026) == TimeGuard::OK);
}

static void testSignature()
{
    uint32_t a = slotSignature(0, "mon", "07:00", 3);
    CHECK(a == slotSignature(0, "mon", "07:00", 3));
    CHECK(a != slotSignature(0, "mon", "07:00", 4));
    CHECK(a != slotSignature(1, "mon", "07:00", 3));
    CHECK(slotSignature(0, "mon", "07:001", 3) != slotSignature(0, "mon0", "7:001", 3));
}

static void testDates()
{
    CHECK(validDate("2026-02-28") && validDate("2024-02-29") && validDate("2026-12-31"));
    CHECK(!validDate("2026-02-29") && !validDate("2100-02-29") && !validDate("2026-04-31"));
    CHECK(!validDate("2026-13-01") && !validDate("2026-1-01") && !validDate("26-01-01") && !validDate("2026/01/01"));
    CHECK(inDateRange("2026-03-01", "2026-02-18", "2026-03-19"));
    CHECK(!inDateRange("2026-03-20", "2026-02-18", "2026-03-19"));
    CHECK(inDateRange("2026-02-18", "2026-02-18", "2026-02-18"));
    CHECK(!inDateRange("2026-03-01", "", "2026-03-19"));
}

static void testResolveMode()
{
    DateRange ranges[] = {
        {2, "2026-03-09", "2026-03-14"},
        {3, "", ""},
        {4, "2026-07-01", "2026-07-10"},
        {1, "2026-02-18", "2026-03-19"},
    };
    size_t n = sizeof(ranges) / sizeof(ranges[0]);
    CHECK(resolveMode(false, 0, ranges, n, "2026-03-10", 0) == 2);
    CHECK(resolveMode(false, 0, ranges, n, "2026-03-01", 0) == 1);
    CHECK(resolveMode(false, 0, ranges, n, "2026-05-01", 0) == 0);
    CHECK(resolveMode(true, 5, ranges, n, "2026-03-10", 0) == 5);
}

static void testVersion()
{
    CHECK(compareVersion("1.2.0", "1.1.9") > 0);
    CHECK(compareVersion("fw-v2.0.0", "1.10.0") > 0);
    CHECK(compareVersion("1.10.0", "1.9.9") > 0);
    CHECK(compareVersion("v1.1.0", "1.1.0") == 0);
    CHECK(compareVersion("abc", "0.0.1") < 0);
    CHECK(compareVersion("1.2", "1.1.0") < 0);
    CHECK(compareVersion("1.2.0-rc1", "1.1.0") < 0);
}

static void testIcs()
{
    const char *lines[] = {
        "BEGIN:VCALENDAR",
        "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20260321", "SUMMARY:Hari Idul Fitri",
        "DESCRIPTION:Hari libur nasional\\nUntuk menyembunyikan", "END:VEVENT",
        "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20260320", "SUMMARY:Cuti Bersama Idul Fitri",
        "DESCRIPTION:Hari libur nasional", "END:VEVENT",
        "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20260219", "SUMMARY:1 Ramadan",
        "DESCRIPTION:Perayaan\\nUntuk menyembunyikan perayaan", "END:VEVENT",
        "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20270101", "SUMMARY:Hari Tahun Baru",
        "DESCRIPTION:Hari libur nasional", "END:VEVENT",
        "BEGIN:VEVENT", "DTSTART;VALUE=DATE:20260817", "SUMMARY:Hari Proklamasi\\, R.I.", "END:VEVENT",
        "END:VCALENDAR",
    };
    IcsHolidayParser parser(2026);
    IcsHolidayParser::Holiday h;
    int count = 0;
    bool sawCuti = false, sawFitri = false, sawProklamasi = false;
    for (const char *l : lines)
    {
        if (!parser.feed(l, h))
            continue;
        count++;
        if (strcmp(h.date, "2026-03-20") == 0 && h.cuti)
            sawCuti = true;
        if (strcmp(h.date, "2026-03-21") == 0 && !h.cuti && strcmp(h.name, "Hari Idul Fitri") == 0)
            sawFitri = true;
        if (strcmp(h.name, "Hari Proklamasi, R.I.") == 0)
            sawProklamasi = true;
    }
    CHECK(count == 3);
    CHECK(sawCuti && sawFitri && sawProklamasi);
}

static void testConstantTime()
{
    uint8_t a[4] = {1, 2, 3, 4}, b[4] = {1, 2, 3, 4}, c[4] = {1, 2, 3, 5};
    CHECK(constantTimeEqual(a, b, 4) && !constantTimeEqual(a, c, 4));
}

int main()
{
    testDays();
    testTime();
    testSleep();
    testPickSlot();
    testTimeGuard();
    testSignature();
    testDates();
    testResolveMode();
    testVersion();
    testIcs();
    testConstantTime();
    if (failures)
    {
        std::printf("%d pemeriksaan gagal\n", failures);
        return EXIT_FAILURE;
    }
    std::printf("semua uji logika lulus\n");
    return EXIT_SUCCESS;
}
