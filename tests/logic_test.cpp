#include "../bell_logic.h"
#include <cstdio>
#include <cstdlib>

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

int main()
{
    testDays();
    testTime();
    testSleep();
    testPickSlot();
    testTimeGuard();
    testSignature();
    if (failures)
    {
        std::printf("%d pemeriksaan gagal\n", failures);
        return EXIT_FAILURE;
    }
    std::printf("semua uji logika lulus\n");
    return EXIT_SUCCESS;
}
