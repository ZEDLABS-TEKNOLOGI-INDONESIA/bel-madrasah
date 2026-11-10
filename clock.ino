const uint8_t TRUST_ADDR = 0;
const uint8_t TRUST_MAGIC = 0xA5;
const uint8_t LAST_MINUTE_ADDR = 1;

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

bool readTrustedClock(DateTime &now)
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
    return r == bell::TimeGuard::OK;
}

void persistLastMinute(uint32_t minuteKey)
{
    if (!rtcPresent)
        return;
    uint8_t b[4] = {(uint8_t)(minuteKey >> 24), (uint8_t)(minuteKey >> 16), (uint8_t)(minuteKey >> 8), (uint8_t)minuteKey};
    Lock l(i2cMutex);
    rtc.writenvram(LAST_MINUTE_ADDR, b, sizeof(b));
}

uint32_t storedLastMinute()
{
    uint8_t b[4];
    Lock l(i2cMutex);
    rtc.readnvram(b, sizeof(b), LAST_MINUTE_ADDR);
    return ((uint32_t)b[0] << 24) | ((uint32_t)b[1] << 16) | ((uint32_t)b[2] << 8) | b[3];
}

void clockBegin()
{
    rtcPresent = rtc.begin();
    if (!rtcPresent)
    {
        Serial.println("RTC DS1307 tidak terdeteksi. Bel menunggu waktu dari NTP");
        timeTrusted = false;
        return;
    }
    if (!rtc.isrunning())
    {
        Serial.println("RTC belum berjalan. Waktu sementara, bel dikunci sampai NTP/manual");
        rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
        rtc.writenvram(TRUST_ADDR, 0x00);
        timeTrusted = false;
        return;
    }
    DateTime n = rtc.now();
    bool yearOk = n.year() >= bell::MIN_VALID_YEAR && n.year() <= bell::MAX_VALID_YEAR;
    timeTrusted = yearOk && rtc.readnvram(TRUST_ADDR) == TRUST_MAGIC;
    if (!timeTrusted)
    {
        Serial.println("Waktu RTC belum pernah diverifikasi, bel dikunci");
        return;
    }
    uint32_t last = storedLastMinute();
    if (last == n.unixtime() / 60)
    {
        lastTriggeredMinute = last;
        Serial.println("Bel menit ini sudah berbunyi sebelum restart, tidak diulang");
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
