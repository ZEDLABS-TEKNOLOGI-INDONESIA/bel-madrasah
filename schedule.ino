static const char *const MODE_CODES[MODE_COUNT] = {"reguler", "ramadhan", "pts", "pas", "pesantren", "lainnya"};
static const char *const MODE_LABELS[MODE_COUNT] = {"Reguler", "Ramadhan", "PTS", "PAS", "Pesantren", "Lainnya"};

const char *modeCode(ScheduleMode m)
{
    return (m < MODE_COUNT) ? MODE_CODES[m] : MODE_CODES[0];
}

const char *modeLabel(ScheduleMode m)
{
    return (m < MODE_COUNT) ? MODE_LABELS[m] : MODE_LABELS[0];
}

bool validModeCode(const String &s)
{
    for (int m = 0; m < MODE_COUNT; m++)
        if (s == MODE_CODES[m])
            return true;
    return false;
}

ScheduleMode modeFromCode(const String &s)
{
    for (int m = 0; m < MODE_COUNT; m++)
        if (s == MODE_CODES[m])
            return (ScheduleMode)m;
    return MODE_REGULER;
}

bool modeHasRange(ScheduleMode m)
{
    return m == MODE_RAMADHAN || m == MODE_PTS || m == MODE_PAS || m == MODE_PESANTREN;
}

String dateString(const DateTime &now)
{
    char b[11];
    snprintf(b, sizeof(b), "%04d-%02d-%02d", now.year(), now.month(), now.day());
    return String(b);
}

ActiveModeInfo activeModeFor(const String &today)
{
    Lock c(cfgMutex);
    if (modeCfg.manualOverride)
        return {modeCfg.manualMode, "manual"};
    static const ScheduleMode priority[] = {MODE_PTS, MODE_PAS, MODE_PESANTREN, MODE_RAMADHAN};
    bell::DateRange ranges[4];
    for (int i = 0; i < 4; i++)
    {
        ScheduleMode m = priority[i];
        ranges[i] = {(int)m, modeCfg.ranges[m].start.c_str(), modeCfg.ranges[m].end.c_str()};
    }
    int m = bell::resolveMode(false, 0, ranges, 4, today.c_str(), MODE_REGULER);
    return {(ScheduleMode)m, m == MODE_REGULER ? "bawaan" : "tanggal"};
}

bool dayDisabled(ScheduleMode m, int dow)
{
    Lock c(cfgMutex);
    return modeCfg.disabledDays[m] & (1 << dow);
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
    v.push_back({m, time, day, track, true});
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

    addSlot(v, MODE_REGULER, "06:44", "mon-fri", T_SHOLAWAT);
    addSlot(v, MODE_REGULER, "06:50", "mon-fri", T_MARS);
    addSlot(v, MODE_REGULER, "07:50", "mon-fri", T_PEL1);
    addSlot(v, MODE_REGULER, "08:30", "mon-fri", T_PEL2);
    addSlot(v, MODE_REGULER, "09:10", "mon-fri", T_PEL3);
    addSlot(v, MODE_REGULER, "09:50", "mon-fri", T_ISTIRAHAT1);
    addSlot(v, MODE_REGULER, "10:10", "mon-fri", T_PEL4);
    addSlot(v, MODE_REGULER, "10:50", "mon-fri", T_PEL5);
    addSlot(v, MODE_REGULER, "11:30", "mon-fri", T_ISTIRAHAT2);
    addSlot(v, MODE_REGULER, "12:40", "mon-thu", T_PEL6);
    addSlot(v, MODE_REGULER, "13:20", "mon-thu", T_PEL7);
    addSlot(v, MODE_REGULER, "14:00", "mon-thu", T_PEL8);
    addSlot(v, MODE_REGULER, "14:40", "mon-thu", T_PEL9);
    addSlot(v, MODE_REGULER, "15:20", "mon-thu", T_SELESAI);
    addSlot(v, MODE_REGULER, "15:21", "mon-thu", T_TANAH_AIRKU);
    addSlot(v, MODE_REGULER, "07:00", "mon", T_UPACARA);
    addSlot(v, MODE_REGULER, "07:00", "wed", T_LITERASI);
    addSlot(v, MODE_REGULER, "07:00", "thu", T_ROHANI);
    addSlot(v, MODE_REGULER, "07:00", "fri", T_ROHANI);
    addSlot(v, MODE_REGULER, "13:10", "fri", T_PEL6);
    addSlot(v, MODE_REGULER, "13:50", "fri", T_PEL7);
    addSlot(v, MODE_REGULER, "14:30", "fri", T_PEL8);
    addSlot(v, MODE_REGULER, "15:10", "fri", T_AKHIR_PEKAN);
    addSlot(v, MODE_REGULER, "15:11", "fri", T_PRAMUKA);
    addSlot(v, MODE_REGULER, "15:12", "fri", T_TANAH_AIRKU);
    addSlot(v, MODE_REGULER, "16:00", "fri", T_HYMNE);

    addSlot(v, MODE_RAMADHAN, "06:50", "mon-fri", T_MARS);
    addSlot(v, MODE_RAMADHAN, "11:00", "mon-thu", T_SELESAI);
    addSlot(v, MODE_RAMADHAN, "11:01", "mon-thu", T_TANAH_AIRKU);
    addSlot(v, MODE_RAMADHAN, "07:00", "mon", T_UPACARA);
    addSlot(v, MODE_RAMADHAN, "07:40", "mon", T_PEL2);
    addSlot(v, MODE_RAMADHAN, "08:20", "mon", T_PEL3);
    addSlot(v, MODE_RAMADHAN, "09:00", "mon", T_PEL4);
    addSlot(v, MODE_RAMADHAN, "09:30", "mon", T_ISTIRAHAT1);
    addSlot(v, MODE_RAMADHAN, "09:40", "mon", T_PEL5);
    addSlot(v, MODE_RAMADHAN, "10:20", "mon", T_PEL6);
    addSlot(v, MODE_RAMADHAN, "07:10", "tue", T_PEL1);
    addSlot(v, MODE_RAMADHAN, "07:50", "tue", T_PEL2);
    addSlot(v, MODE_RAMADHAN, "08:30", "tue", T_PEL3);
    addSlot(v, MODE_RAMADHAN, "09:10", "tue", T_PEL4);
    addSlot(v, MODE_RAMADHAN, "09:40", "tue", T_ISTIRAHAT1);
    addSlot(v, MODE_RAMADHAN, "09:50", "tue", T_PEL5);
    addSlot(v, MODE_RAMADHAN, "10:30", "tue", T_PEL6);
    addSlot(v, MODE_RAMADHAN, "07:10", "wed", T_PEL1);
    addSlot(v, MODE_RAMADHAN, "07:50", "wed", T_PEL2);
    addSlot(v, MODE_RAMADHAN, "08:30", "wed", T_PEL3);
    addSlot(v, MODE_RAMADHAN, "09:10", "wed", T_PEL4);
    addSlot(v, MODE_RAMADHAN, "09:40", "wed", T_ISTIRAHAT1);
    addSlot(v, MODE_RAMADHAN, "09:50", "wed", T_PEL5);
    addSlot(v, MODE_RAMADHAN, "10:30", "wed", T_PEL6);
    addSlot(v, MODE_RAMADHAN, "07:00", "thu", T_LITERASI);
    addSlot(v, MODE_RAMADHAN, "07:40", "thu", T_PEL2);
    addSlot(v, MODE_RAMADHAN, "08:20", "thu", T_PEL3);
    addSlot(v, MODE_RAMADHAN, "09:00", "thu", T_PEL4);
    addSlot(v, MODE_RAMADHAN, "09:30", "thu", T_ISTIRAHAT1);
    addSlot(v, MODE_RAMADHAN, "09:40", "thu", T_PEL5);
    addSlot(v, MODE_RAMADHAN, "10:20", "thu", T_PEL6);
    addSlot(v, MODE_RAMADHAN, "07:00", "fri", T_ROHANI);
    addSlot(v, MODE_RAMADHAN, "07:40", "fri", T_PEL3);
    addSlot(v, MODE_RAMADHAN, "08:20", "fri", T_PEL4);
    addSlot(v, MODE_RAMADHAN, "09:00", "fri", T_ISTIRAHAT1);
    addSlot(v, MODE_RAMADHAN, "09:10", "fri", T_PEL5);
    addSlot(v, MODE_RAMADHAN, "09:50", "fri", T_PEL6);
    addSlot(v, MODE_RAMADHAN, "10:20", "fri", T_AKHIR_PEKAN);
    addSlot(v, MODE_RAMADHAN, "10:21", "fri", T_TANAH_AIRKU);

    addSlot(v, MODE_PTS, "06:50", "mon-fri", T_MARS);
    addSlot(v, MODE_PTS, "07:30", "mon-fri", T_PEL1);
    addSlot(v, MODE_PTS, "08:30", "mon-fri", T_PEL2);
    addSlot(v, MODE_PTS, "09:30", "mon-thu", T_PEL3);
    addSlot(v, MODE_PTS, "10:30", "mon-thu", T_SELESAI);
    addSlot(v, MODE_PTS, "10:31", "mon-thu", T_TANAH_AIRKU);
    addSlot(v, MODE_PTS, "09:30", "fri", T_SELESAI);
    addSlot(v, MODE_PTS, "09:31", "fri", T_TANAH_AIRKU);

    addSlot(v, MODE_PAS, "06:50", "mon-fri", T_MARS);
    addSlot(v, MODE_PAS, "07:30", "mon-fri", T_PEL1);
    addSlot(v, MODE_PAS, "08:30", "mon-fri", T_PEL2);
    addSlot(v, MODE_PAS, "09:30", "mon-thu", T_PEL3);
    addSlot(v, MODE_PAS, "10:30", "mon-thu", T_SELESAI);
    addSlot(v, MODE_PAS, "10:31", "mon-thu", T_TANAH_AIRKU);
    addSlot(v, MODE_PAS, "09:30", "fri", T_SELESAI);
    addSlot(v, MODE_PAS, "09:31", "fri", T_TANAH_AIRKU);

    return v;
}

void fillSlotJson(JsonObject o, const BellSlot &s)
{
    o["mode"] = modeCode(s.mode);
    o["time"] = s.time;
    o["day"] = s.day;
    o["track"] = s.track;
    o["enabled"] = s.enabled;
}

void fillScheduleJson(JsonArray a)
{
    for (const BellSlot &s : schedule)
        fillSlotJson(a.add<JsonObject>(), s);
}

bool parseScheduleJson(JsonArrayConst a, std::vector<BellSlot> &out, String &err)
{
    out.clear();
    for (JsonObjectConst o : a)
    {
        String mode = o["mode"] | "reguler";
        BellSlot s{modeFromCode(mode), o["time"] | "", o["day"] | "", (uint16_t)(o["track"] | 0), o["enabled"] | true};
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
    fillScheduleJson(d["slots"].to<JsonArray>());
    String out;
    serializeJson(d, out);
    return fsWriteText(SCHEDULE_FILE, out);
}

void loadSchedule()
{
    String txt = fsReadText(SCHEDULE_FILE);
    Lock l(dataMutex);
    JsonDocument d;
    std::vector<BellSlot> parsed;
    String err;
    if (txt.length() && !deserializeJson(d, txt) && parseScheduleJson(d["slots"].as<JsonArrayConst>(), parsed, err))
    {
        schedule = parsed;
        sortScheduleLocked();
        return;
    }
    if (txt.length())
        Serial.println("schedule.json rusak atau tidak valid (" + err + "), memakai jadwal bawaan");
    schedule = defaultSchedule();
    sortScheduleLocked();
    saveScheduleLocked();
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
        TrackInfo t{(uint16_t)(o["track"] | 0), o["label"] | ""};
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
    if (txt.length() && !deserializeJson(d, txt) && parseTracksJson(d["tracks"].as<JsonArrayConst>(), parsed, err))
    {
        trackList = parsed;
        return;
    }
    trackList = defaultTracks();
    saveTracksLocked();
}

String trackLabelLocked(uint16_t track)
{
    for (const TrackInfo &t : trackList)
        if (t.track == track)
            return t.label;
    return "";
}

String trackName(uint16_t track)
{
    Lock l(dataMutex);
    String label = trackLabelLocked(track);
    return label.length() ? "#" + String(track) + " " + label : "#" + String(track);
}

String todayBlocker(const DateTime &now, ScheduleMode mode, String *detail)
{
    if (holidayMode)
        return "libur";
    String name = holidayName(dateString(now));
    if (name.length())
    {
        if (detail)
            *detail = name;
        return "libur";
    }
    if (dayDisabled(mode, now.dayOfTheWeek()))
        return "hari_nonaktif";
    if (sleeping)
        return "tidur";
    return "";
}

void checkSchedule(const DateTime &now)
{
    if (!timeTrusted)
        return;
    uint32_t minuteKey = now.unixtime() / 60;
    if (minuteKey == lastTriggeredMinute)
        return;

    ActiveModeInfo active = activeModeFor(dateString(now));
    if (todayBlocker(now, active.mode, nullptr).length())
        return;

    char timeBuf[6];
    snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d", now.hour(), now.minute());
    uint16_t track = 0;
    {
        Lock l(dataMutex);
        std::vector<bell::SlotView> views;
        views.reserve(schedule.size());
        for (const BellSlot &s : schedule)
            views.push_back({(int)s.mode, s.day.c_str(), s.time.c_str(), s.track, s.enabled});
        int idx = bell::pickSlot(views.data(), views.size(), (int)active.mode, timeBuf, now.dayOfTheWeek());
        if (idx >= 0)
            track = schedule[idx].track;
    }
    if (!track)
        return;

    lastTriggeredMinute = minuteKey;
    persistLastMinute(minuteKey);
    String when = dateString(now) + " " + timeBuf;
    if (!audioReady())
    {
        Serial.printf("Bel %s gagal: DFPlayer/kartu SD tidak siap\n", timeBuf);
        logActivity(when, active.mode, track, "gagal", "DFPlayer atau kartu SD tidak siap");
        return;
    }
    Serial.printf("Memicu bel %s: track %d (uptime %lus)\n", timeBuf, track, millis() / 1000UL);
    setInfo(lastBell, String(timeBuf) + " " + trackName(track));
    scheduledTrack = track;
    scheduledAt = millis();
    playTrack(track);
    logActivity(when, active.mode, track, "ok", "");
}

int minutesToNextBell(const DateTime &now)
{
    ActiveModeInfo active = activeModeFor(dateString(now));
    int nowMin = now.hour() * 60 + now.minute();
    int dow = now.dayOfTheWeek();
    int best = 24 * 60;
    Lock l(dataMutex);
    for (const BellSlot &s : schedule)
    {
        if (!s.enabled || s.mode != active.mode || !bell::dayMatches(s.day.c_str(), dow))
            continue;
        int m = bell::timeToMin(s.time.c_str(), -1);
        if (m >= nowMin && m - nowMin < best)
            best = m - nowMin;
    }
    return best;
}

void fillTodayJson(JsonObject d, const DateTime &now)
{
    String today = dateString(now);
    ActiveModeInfo active = activeModeFor(today);
    String holiday;
    String blocker = todayBlocker(now, active.mode, &holiday);
    d["date"] = today;
    d["mode"] = modeCode(active.mode);
    d["mode_source"] = active.source;
    d["blocked"] = blocker;
    d["holiday"] = holiday;
    d["trusted"] = (bool)timeTrusted;
    char nowBuf[6];
    snprintf(nowBuf, sizeof(nowBuf), "%02d:%02d", now.hour(), now.minute());
    d["now"] = nowBuf;

    int dow = now.dayOfTheWeek();
    std::vector<std::pair<String, uint16_t>> bells;
    {
        Lock l(dataMutex);
        for (const BellSlot &s : schedule)
            if (s.enabled && s.mode == active.mode && bell::dayMatches(s.day.c_str(), dow))
                bells.push_back({s.time, s.track});
        std::stable_sort(bells.begin(), bells.end(), [](const std::pair<String, uint16_t> &a, const std::pair<String, uint16_t> &b)
                         { return a.first < b.first; });
        JsonArray a = d["bells"].to<JsonArray>();
        std::vector<bell::SlotView> views;
        views.reserve(schedule.size());
        for (const BellSlot &s : schedule)
            views.push_back({(int)s.mode, s.day.c_str(), s.time.c_str(), s.track, s.enabled});
        String lastTime;
        for (const auto &b : bells)
        {
            if (b.first == lastTime)
                continue;
            lastTime = b.first;
            int idx = bell::pickSlot(views.data(), views.size(), (int)active.mode, b.first.c_str(), dow);
            uint16_t track = idx >= 0 ? schedule[idx].track : b.second;
            JsonObject o = a.add<JsonObject>();
            o["time"] = b.first;
            o["track"] = track;
            o["label"] = trackLabelLocked(track);
        }
    }
}

void bellTask(void *param)
{
    unsigned long lastDfpTry = millis();
    unsigned long lastRtcCheck = 0;
    int rtcStopped = 0;
    for (;;)
    {
        bellHeartbeat = millis();
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
        bool usable = readTrustedClock(now);
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

        audioTick();

        AudioCmd cmd;
        if (xQueueReceive(audioQueue, &cmd, pdMS_TO_TICKS(BELL_TICK_MS)) == pdTRUE)
        {
            handleAudioCmd(cmd);
            while (xQueueReceive(audioQueue, &cmd, 0) == pdTRUE)
                handleAudioCmd(cmd);
        }
    }
}
