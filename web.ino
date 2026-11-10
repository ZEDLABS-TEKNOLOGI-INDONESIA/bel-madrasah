const char *DFP_MISSING = "DFPlayer/kartu SD tidak terdeteksi";

String postParam(AsyncWebServerRequest *r, const char *n)
{
    return r->hasParam(n, true) ? r->getParam(n, true)->value() : String();
}

void sendJson(AsyncWebServerRequest *r, JsonDocument &d, int code = 200)
{
    String out;
    serializeJson(d, out);
    r->send(code, "application/json", out);
}

void sendResult(AsyncWebServerRequest *r, bool ok, const String &msg, int code = 0)
{
    JsonDocument d;
    d["ok"] = ok;
    d["msg"] = msg;
    sendJson(r, d, code ? code : (ok ? 200 : 400));
}

void sendStream(AsyncWebServerRequest *r, JsonDocument &d, const char *disposition = nullptr)
{
    AsyncResponseStream *res = r->beginResponseStream("application/json");
    if (disposition)
        res->addHeader("Content-Disposition", disposition);
    serializeJson(d, *res);
    r->send(res);
}

void route(const char *path, WebRequestMethodComposite method, ArRequestHandlerFunction fn)
{
    server.on(path, method, [fn](AsyncWebServerRequest *r)
              {
        if (!isAuthorized(r))
            return sendResult(r, false, "Sesi berakhir, silakan login kembali", 401);
        fn(r); });
}

SlotLookup findSlotLocked(AsyncWebServerRequest *r, int &id)
{
    id = postParam(r, "id").toInt();
    if (id < 0 || id >= (int)schedule.size())
        return SLOT_MISSING;
    String sig = postParam(r, "sig");
    if (sig.length() && strtoul(sig.c_str(), nullptr, 10) != slotSig(schedule[id]))
        return SLOT_CHANGED;
    return SLOT_OK;
}

void sendSlotLookupError(AsyncWebServerRequest *r, SlotLookup res)
{
    if (res == SLOT_CHANGED)
        sendResult(r, false, "Jadwal sudah berubah di perangkat. Muat ulang halaman lalu coba lagi.", 409);
    else
        sendResult(r, false, "Jadwal tidak ditemukan", 404);
}

bool parseSlot(AsyncWebServerRequest *r, BellSlot &s, String &err)
{
    String mode = postParam(r, "mode");
    s.mode = modeFromCode(mode);
    s.day = postParam(r, "day");
    s.time = postParam(r, "time");
    long track = postParam(r, "track").toInt();
    s.enabled = postParam(r, "enabled") != "0";
    if (!validModeCode(mode))
        err = "Mode tidak valid";
    else if (!bell::validDay(s.day.c_str()))
        err = "Hari tidak valid";
    else if (!bell::validTime(s.time.c_str()))
        err = "Jam tidak valid";
    else if (track <= 0 || track > MAX_TRACK_NO)
        err = "Nomor track tidak valid";
    if (err.length())
        return false;
    s.track = (uint16_t)track;
    return true;
}

void handleLogin(AsyncWebServerRequest *r)
{
    uint32_t ip = clientIp(r);
    unsigned long locked = loginLockRemaining(ip);
    if (locked)
        return sendResult(r, false, "Terlalu banyak percobaan gagal, coba lagi dalam " + String(locked / 60000UL + 1) + " menit", 429);
    String password = postParam(r, "password");
    if (!passwordMatches(password))
    {
        recordLoginResult(ip, false);
        return sendResult(r, false, "Password salah", 401);
    }
    recordLoginResult(ip, true);
    String token = createSession();
    JsonDocument d;
    d["ok"] = true;
    d["must_change"] = passwordIsDefault();
    String out;
    serializeJson(d, out);
    AsyncWebServerResponse *res = r->beginResponse(200, "application/json", out);
    res->addHeader("Set-Cookie", sessionCookie(token, false));
    r->send(res);
}

void handleRestore(AsyncWebServerRequest *r)
{
    String data = postParam(r, "data");
    if (data.length() == 0)
        return sendResult(r, false, "File backup kosong");
    JsonDocument d;
    if (deserializeJson(d, data))
        return sendResult(r, false, "File backup bukan JSON yang valid");
    if (!d["schedule"].is<JsonArrayConst>() || !d["tracks"].is<JsonArrayConst>() || !d["config"].is<JsonObjectConst>())
        return sendResult(r, false, "Format backup tidak dikenali");

    std::vector<BellSlot> slots;
    std::vector<TrackInfo> tracks;
    std::vector<Holiday> hols;
    bool hasHolidays = d["holidays"].is<JsonArrayConst>();
    String err;
    if (!parseScheduleJson(d["schedule"].as<JsonArrayConst>(), slots, err) ||
        !parseTracksJson(d["tracks"].as<JsonArrayConst>(), tracks, err) ||
        (hasHolidays && !parseHolidaysJson(d["holidays"].as<JsonArrayConst>(), hols, err)))
        return sendResult(r, false, err);

    bool ok;
    {
        Lock l(dataMutex);
        schedule = slots;
        sortScheduleLocked();
        trackList = tracks;
        ok = saveScheduleLocked() && saveTracksLocked();
        if (hasHolidays)
        {
            holidays = hols;
            sortHolidaysLocked();
            ok = saveHolidaysLocked() && ok;
        }
    }
    {
        Lock c(cfgMutex);
        applyConfigJson(d["config"].as<JsonObjectConst>(), false);
    }
    ok = saveConfig() && ok;
    queueAudio(AC_VOLUME, currentVolume);
    queueAudio(AC_EQ, eqPreset);
    String summary = String(slots.size()) + " jadwal, " + String(tracks.size()) + " track" +
                     (hasHolidays ? ", " + String(hols.size()) + " hari libur" : "");
    sendResult(r, ok, ok ? "Backup dipulihkan: " + summary : "Backup dipulihkan sebagian, gagal menyimpan ke memori");
}

void setupWebServer()
{
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *r)
              {
        AsyncWebServerResponse *res = r->beginResponse(200, "text/html", (const uint8_t *)INDEX_HTML, strlen(INDEX_HTML));
        res->addHeader("Cache-Control", "no-store");
        r->send(res); });

    server.on("/api/session", HTTP_GET, [](AsyncWebServerRequest *r)
              {
        JsonDocument d;
        d["authenticated"] = isAuthorized(r);
        d["must_change"] = passwordIsDefault();
        d["version"] = FW_VERSION;
        sendJson(r, d); });

    server.on("/api/login", HTTP_POST, handleLogin);

    server.on("/api/logout", HTTP_POST, [](AsyncWebServerRequest *r)
              {
        endSession(r);
        AsyncWebServerResponse *res = r->beginResponse(200, "application/json", "{\"ok\":true,\"msg\":\"Keluar\"}");
        res->addHeader("Set-Cookie", sessionCookie("", true));
        r->send(res); });

    route("/api/password", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        String err = changePassword(postParam(r, "old"), postParam(r, "new"));
        if (err.length()) return sendResult(r, false, err);
        {
            Lock a(authMutex);
            clearSessionsLocked();
        }
        String token = createSession();
        AsyncWebServerResponse *res = r->beginResponse(200, "application/json", "{\"ok\":true,\"msg\":\"Password diganti. Sesi di perangkat lain diakhiri.\"}");
        res->addHeader("Set-Cookie", sessionCookie(token, false));
        r->send(res); });

    route("/api/status", HTTP_GET, [](AsyncWebServerRequest *r)
          {
        DateTime now = getNow();
        char tb[24];
        snprintf(tb, sizeof(tb), "%04d-%02d-%02d %02d:%02d:%02d",
                 now.year(), now.month(), now.day(), now.hour(), now.minute(), now.second());
        bool sta = WiFi.status() == WL_CONNECTED;
        ActiveModeInfo active = activeModeFor(dateString(now));
        JsonDocument d;
        d["version"] = FW_VERSION;
        d["time"] = tb;
        d["dow"] = now.dayOfTheWeek();
        d["clock"] = rtcPresent ? "rtc" : "ntp";
        d["ntp"] = (bool)ntpLastOk;
        d["mode"] = sta ? "STA" : "AP";
        d["ip"] = sta ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
        d["rssi"] = sta ? WiFi.RSSI() : 0;
        d["volume"] = (int)currentVolume;
        d["eq"] = (int)eqPreset;
        d["holiday"] = (bool)holidayMode;
        d["active_mode"] = modeCode(active.mode);
        d["mode_source"] = active.source;
        d["dfp"] = (bool)dfpReady;
        d["sd"] = (bool)sdPresent;
        d["dfp_error"] = getInfo(lastDfpError);
        d["playing"] = (bool)audioPlaying;
        d["track"] = (int)playingTrack;
        d["last_bell"] = getInfo(lastBell);
        d["trusted"] = (bool)timeTrusted;
        d["sleeping"] = (bool)sleeping;
        d["sleep_on"] = (bool)sleepEnabled;
        d["sleep_start"] = minToStr(sleepStartMin);
        d["sleep_end"] = minToStr(sleepEndMin);
        d["must_change"] = passwordIsDefault();
        d["rolled_back"] = otaRolledBack;
        sendJson(r, d); });

    route("/api/today", HTTP_GET, [](AsyncWebServerRequest *r)
          {
        JsonDocument d;
        fillTodayJson(d.to<JsonObject>(), getNow());
        sendStream(r, d); });

    route("/api/modes", HTTP_GET, [](AsyncWebServerRequest *r)
          {
        JsonDocument d;
        {
            Lock c(cfgMutex);
            fillModeJson(d.to<JsonObject>());
        }
        ActiveModeInfo active = activeModeFor(dateString(getNow()));
        d["active"] = modeCode(active.mode);
        d["source"] = active.source;
        sendJson(r, d); });

    route("/api/modes", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        JsonDocument d;
        if (deserializeJson(d, postParam(r, "data")))
            return sendResult(r, false, "Data mode tidak valid");
        ModeCfg parsed;
        String err;
        if (!applyModeJson(d.as<JsonObjectConst>(), parsed, err))
            return sendResult(r, false, err);
        {
            Lock c(cfgMutex);
            modeCfg = parsed;
        }
        bool saved = saveConfig();
        ActiveModeInfo active = activeModeFor(dateString(getNow()));
        sendResult(r, saved, saved ? String("Pengaturan mode disimpan. Mode aktif: ") + modeLabel(active.mode) : "Gagal menyimpan"); });

    route("/api/sleep", HTTP_GET, [](AsyncWebServerRequest *r)
          {
        JsonDocument d;
        d["enabled"] = (bool)sleepEnabled;
        d["start"] = minToStr(sleepStartMin);
        d["end"] = minToStr(sleepEndMin);
        d["oled"] = (bool)sleepOledOff;
        d["sleeping"] = (bool)sleeping;
        sendJson(r, d); });

    route("/api/sleep", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        bool en = postParam(r, "enabled") == "1";
        String st = postParam(r, "start");
        String ed = postParam(r, "end");
        if (!bell::validTime(st.c_str()) || !bell::validTime(ed.c_str()))
            return sendResult(r, false, "Format jam tidak valid");
        int sm = bell::timeToMin(st.c_str(), 0), em = bell::timeToMin(ed.c_str(), 0);
        if (en && sm == em)
            return sendResult(r, false, "Jam mulai dan selesai tidak boleh sama");
        {
            Lock c(cfgMutex);
            sleepStartMin = sm;
            sleepEndMin = em;
            sleepOledOff = postParam(r, "oled") == "1";
            sleepEnabled = en;
        }
        bool saved = saveConfig();
        sendResult(r, saved, saved ? (en ? "Mode tidur aktif " + st + " - " + ed : String("Mode tidur nonaktif")) : "Gagal menyimpan"); });

    route("/api/ring", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        if (!audioReady()) return sendResult(r, false, DFP_MISSING);
        long track = postParam(r, "track").toInt();
        if (track <= 0 || track > MAX_TRACK_NO) return sendResult(r, false, "Nomor track tidak valid");
        if (!queueAudio(AC_PLAY, (uint16_t)track)) return sendResult(r, false, "Perangkat sibuk, coba lagi");
        sendResult(r, true, "Memutar " + trackName(track)); });

    route("/api/stop", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        queueAudio(AC_STOP, 0);
        sendResult(r, true, "Bel dihentikan"); });

    route("/api/time/set", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        String date = postParam(r, "date");
        String tm = postParam(r, "time");
        if (!bell::validDate(date.c_str()) || !bell::validTime(tm.c_str()))
            return sendResult(r, false, "Format tanggal/jam tidak valid");
        int y = date.substring(0, 4).toInt();
        if (y < bell::MIN_VALID_YEAR)
            return sendResult(r, false, "Tahun minimal " + String(bell::MIN_VALID_YEAR));
        if (!rtcPresent) return sendResult(r, false, "RTC tidak terdeteksi, waktu hanya dapat diatur lewat NTP");
        DateTime dt(y, date.substring(5, 7).toInt(), date.substring(8, 10).toInt(), tm.substring(0, 2).toInt(), tm.substring(3, 5).toInt(), 0);
        applyVerifiedTime(&dt);
        sendResult(r, true, "Waktu diatur"); });

    route("/api/volume", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        currentVolume = constrain((int)postParam(r, "value").toInt(), 0, 30);
        queueAudio(AC_VOLUME, currentVolume);
        bool saved = saveConfig();
        sendResult(r, saved, "Volume " + String(currentVolume) + "/30" + (saved ? "" : " (gagal disimpan)")); });

    route("/api/eq", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        long eq = postParam(r, "value").toInt();
        if (eq < 0 || eq > 5) return sendResult(r, false, "Preset EQ tidak valid");
        eqPreset = (int)eq;
        queueAudio(AC_EQ, eqPreset);
        bool saved = saveConfig();
        sendResult(r, saved, String("EQ ") + eqLabel(eqPreset) + (saved ? "" : " (gagal disimpan)")); });

    route("/api/holiday", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        holidayMode = postParam(r, "value") == "1";
        bool saved = saveConfig();
        sendResult(r, saved, String(holidayMode ? "Libur manual aktif, semua bel berhenti" : "Libur manual nonaktif") + (saved ? "" : " (gagal disimpan)")); });

    route("/api/schedule", HTTP_GET, [](AsyncWebServerRequest *r)
          {
        bool hasFilter = r->hasParam("mode");
        ScheduleMode filter = hasFilter ? modeFromCode(r->getParam("mode")->value()) : MODE_REGULER;
        JsonDocument d;
        JsonArray a = d["slots"].to<JsonArray>();
        {
            Lock l(dataMutex);
            for (size_t i = 0; i < schedule.size(); i++) {
                const BellSlot &s = schedule[i];
                if (hasFilter && s.mode != filter) continue;
                JsonObject o = a.add<JsonObject>();
                o["id"] = i;
                o["sig"] = slotSig(s);
                fillSlotJson(o, s);
            }
        }
        d["max"] = MAX_SLOTS;
        sendStream(r, d); });

    route("/api/schedule/add", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        BellSlot s;
        String err;
        if (!parseSlot(r, s, err)) return sendResult(r, false, err);
        bool full = false, saved = true;
        {
            Lock l(dataMutex);
            if (schedule.size() >= MAX_SLOTS) full = true;
            else {
                schedule.push_back(s);
                sortScheduleLocked();
                saved = saveScheduleLocked();
            }
        }
        if (full) return sendResult(r, false, "Jadwal penuh (maks " + String(MAX_SLOTS) + ")");
        sendResult(r, saved, saved ? "Jadwal ditambahkan" : "Gagal menyimpan jadwal"); });

    route("/api/schedule/update", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        BellSlot s;
        String err;
        if (!parseSlot(r, s, err)) return sendResult(r, false, err);
        SlotLookup res;
        bool saved = true;
        {
            Lock l(dataMutex);
            int id;
            res = findSlotLocked(r, id);
            if (res == SLOT_OK) {
                schedule[id] = s;
                sortScheduleLocked();
                saved = saveScheduleLocked();
            }
        }
        if (res != SLOT_OK) return sendSlotLookupError(r, res);
        sendResult(r, saved, saved ? "Jadwal disimpan" : "Gagal menyimpan jadwal"); });

    route("/api/schedule/delete", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        SlotLookup res;
        bool saved = true;
        {
            Lock l(dataMutex);
            int id;
            res = findSlotLocked(r, id);
            if (res == SLOT_OK) {
                schedule.erase(schedule.begin() + id);
                saved = saveScheduleLocked();
            }
        }
        if (res != SLOT_OK) return sendSlotLookupError(r, res);
        sendResult(r, saved, saved ? "Jadwal dihapus" : "Gagal menyimpan jadwal"); });

    route("/api/tracks", HTTP_GET, [](AsyncWebServerRequest *r)
          {
        JsonDocument d;
        {
            Lock l(dataMutex);
            fillTracksJson(d["tracks"].to<JsonArray>());
        }
        sendStream(r, d); });

    route("/api/tracks/add", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        long track = postParam(r, "track").toInt();
        String label = postParam(r, "label");
        label.trim();
        if (track <= 0 || track > MAX_TRACK_NO) return sendResult(r, false, "Nomor track tidak valid");
        if (label.length() == 0 || label.length() > 40) return sendResult(r, false, "Nama 1 sampai 40 karakter");
        bool full = false, saved = true;
        {
            Lock l(dataMutex);
            bool replaced = false;
            for (TrackInfo &t : trackList) {
                if (t.track == track) {
                    t.label = label;
                    replaced = true;
                    break;
                }
            }
            if (!replaced) {
                if (trackList.size() >= MAX_TRACKS) full = true;
                else trackList.push_back({(uint16_t)track, label});
            }
            if (!full) {
                std::sort(trackList.begin(), trackList.end(), [](const TrackInfo &a, const TrackInfo &b) { return a.track < b.track; });
                saved = saveTracksLocked();
            }
        }
        if (full) return sendResult(r, false, "Daftar track penuh (maks " + String(MAX_TRACKS) + ")");
        sendResult(r, saved, saved ? "Nama track disimpan" : "Gagal menyimpan"); });

    route("/api/tracks/delete", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        long track = postParam(r, "track").toInt();
        bool used = false, saved = true;
        {
            Lock l(dataMutex);
            for (const BellSlot &s : schedule)
                if (s.track == track) {
                    used = true;
                    break;
                }
            if (!used) {
                trackList.erase(std::remove_if(trackList.begin(), trackList.end(),
                                               [track](const TrackInfo &t) { return t.track == track; }),
                                trackList.end());
                saved = saveTracksLocked();
            }
        }
        if (used) return sendResult(r, false, "Track masih dipakai jadwal. Ubah atau hapus jadwalnya dulu.");
        sendResult(r, saved, saved ? "Nama track dihapus" : "Gagal menyimpan"); });

    route("/api/holidays", HTTP_GET, [](AsyncWebServerRequest *r)
          {
        JsonDocument d;
        {
            Lock l(dataMutex);
            fillHolidaysJson(d["holidays"].to<JsonArray>());
        }
        d["max"] = MAX_HOLIDAYS;
        sendStream(r, d); });

    route("/api/holidays/add", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        String err = addHoliday(postParam(r, "date"), postParam(r, "name"));
        sendResult(r, err.length() == 0, err.length() ? err : String("Hari libur ditambahkan")); });

    route("/api/holidays/delete", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        bool ok = deleteHoliday(postParam(r, "date"));
        sendResult(r, ok, ok ? "Hari libur dihapus" : "Tanggal tidak ditemukan"); });

    route("/api/holidays/national", HTTP_GET, [](AsyncWebServerRequest *r)
          {
        JsonDocument d;
        fillNationalJson(d.to<JsonObject>());
        sendStream(r, d); });

    route("/api/holidays/national", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        String err = startNationalFetch(postParam(r, "year").toInt());
        sendResult(r, err.length() == 0, err.length() ? err : String("Mengambil data libur nasional")); });

    route("/api/log", HTTP_GET, [](AsyncWebServerRequest *r)
          {
        JsonDocument d;
        fillLogJson(d["logs"].to<JsonArray>());
        sendStream(r, d); });

    route("/api/log/clear", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        bool ok = clearLog();
        sendResult(r, ok, ok ? "Log dikosongkan" : "Gagal mengosongkan log"); });

    route("/api/backup", HTTP_GET, [](AsyncWebServerRequest *r)
          {
        JsonDocument d;
        d["app"] = "bel-madrasah-baremetal";
        d["version"] = FW_VERSION;
        {
            Lock c(cfgMutex);
            fillConfigJson(d["config"].to<JsonObject>(), false);
        }
        {
            Lock l(dataMutex);
            fillScheduleJson(d["schedule"].to<JsonArray>());
            fillTracksJson(d["tracks"].to<JsonArray>());
            fillHolidaysJson(d["holidays"].to<JsonArray>());
        }
        sendStream(r, d, "attachment; filename=\"bel-madrasah-backup.json\""); });

    route("/api/restore", HTTP_POST, handleRestore);

    route("/api/network", HTTP_GET, [](AsyncWebServerRequest *r)
          {
        JsonDocument d;
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
        {
            Lock c(cfgMutex);
            d["static_enabled"] = staticCfg.enabled;
            d["static_ip"] = staticCfg.ip;
        }
        sendJson(r, d); });

    route("/api/network/static", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        bool en = postParam(r, "enabled") == "1";
        String newIp = "";
        if (!en) {
            Lock c(cfgMutex);
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
            Lock c(cfgMutex);
            staticCfg.enabled = true;
            staticCfg.ssid = WiFi.SSID();
            staticCfg.ip = ip.toString();
            staticCfg.gw = gw.toString();
            staticCfg.mask = mask.toString();
            staticCfg.dns = dns.toString();
            newIp = staticCfg.ip;
        }
        if (!saveConfig()) return sendResult(r, false, "Gagal menyimpan konfigurasi");
        scheduleRestart(1500);
        JsonDocument d;
        d["ok"] = true;
        d["msg"] = en ? "Tersimpan. Perangkat restart, buka http://" + newIp : "IP statis dimatikan. Perangkat restart (IP dari DHCP).";
        d["new_ip"] = newIp;
        sendJson(r, d); });

    route("/api/network/reset", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        {
            Lock c(cfgMutex);
            staticCfg.enabled = false;
        }
        saveConfig();
        wifiResetPending = true;
        scheduleRestart(1500);
        sendResult(r, true, "WiFi direset. Perangkat restart, sambungkan ke AP 192.168.4.1"); });

    route("/api/firmware", HTTP_GET, [](AsyncWebServerRequest *r)
          {
        JsonDocument d;
        fillFirmwareJson(d.to<JsonObject>());
        sendJson(r, d); });

    route("/api/firmware/check", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        String err = startOtaJob(OTA_CHECK);
        sendResult(r, err.length() == 0, err.length() ? err : String("Memeriksa pembaruan")); });

    route("/api/firmware/install", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        String err = startOtaJob(OTA_INSTALL);
        sendResult(r, err.length() == 0, err.length() ? err : String("Mengunduh dan memasang firmware")); });

    route("/api/firmware/auto", HTTP_POST, [](AsyncWebServerRequest *r)
          {
        autoUpdate = postParam(r, "value") == "1";
        bool saved = saveConfig();
        sendResult(r, saved, String(autoUpdate ? "Pembaruan otomatis aktif" : "Pembaruan otomatis nonaktif") + (saved ? "" : " (gagal disimpan)")); });

    server.on(
        "/api/firmware/upload", HTTP_POST,
        [](AsyncWebServerRequest *r)
        {
            bool ok = otaUploadOk;
            otaUploadOk = false;
            if (!isAuthorized(r))
                return sendResult(r, false, "Sesi berakhir, silakan login kembali", 401);
            if (otaUploadError.length())
                return sendResult(r, false, otaUploadError);
            if (!ok)
                return sendResult(r, false, "Tidak ada file firmware yang diterima");
            scheduleRestart(2000);
            sendResult(r, true, "Firmware terpasang. Perangkat restart, muat ulang halaman dalam 20 detik.");
        },
        otaUploadChunk);

    server.onNotFound([](AsyncWebServerRequest *r)
                      { sendResult(r, false, "Tidak ditemukan", 404); });
}
