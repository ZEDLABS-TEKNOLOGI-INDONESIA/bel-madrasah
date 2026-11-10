String fsReadText(const char *path)
{
    String out;
    if (!LittleFS.exists(path))
        return out;
    File f = LittleFS.open(path, "r");
    if (!f)
        return out;
    out = f.readString();
    f.close();
    return out;
}

bool fsWriteText(const char *path, const String &txt)
{
    String tmp = String(path) + ".tmp";
    File f = LittleFS.open(tmp, "w");
    if (!f)
        return false;
    size_t w = f.print(txt);
    f.close();
    if (w != txt.length())
    {
        LittleFS.remove(tmp);
        return false;
    }
    LittleFS.remove(path);
    return LittleFS.rename(tmp, path);
}

String minToStr(int m)
{
    char b[8];
    snprintf(b, sizeof(b), "%02d:%02d", (m / 60) % 24, m % 60);
    return String(b);
}

void fillModeJson(JsonObject d)
{
    d["manual_override"] = modeCfg.manualOverride;
    d["mode"] = modeCode(modeCfg.manualMode);
    JsonObject ranges = d["ranges"].to<JsonObject>();
    JsonObject disabled = d["disabled_days"].to<JsonObject>();
    for (int m = 0; m < MODE_COUNT; m++)
    {
        if (modeHasRange((ScheduleMode)m))
        {
            JsonObject r = ranges[modeCode((ScheduleMode)m)].to<JsonObject>();
            r["start"] = modeCfg.ranges[m].start;
            r["end"] = modeCfg.ranges[m].end;
        }
        JsonArray days = disabled[modeCode((ScheduleMode)m)].to<JsonArray>();
        for (int dow = 0; dow < 7; dow++)
            if (modeCfg.disabledDays[m] & (1 << dow))
                days.add(bell::dayCodeOf(dow));
    }
}

bool applyModeJson(JsonObjectConst d, ModeCfg &out, String &err)
{
    ModeCfg next;
    String mode = d["mode"] | "reguler";
    if (!validModeCode(mode))
    {
        err = "Mode tidak valid";
        return false;
    }
    next.manualMode = modeFromCode(mode);
    if (d["manual_override"].isNull())
        next.manualOverride = next.manualMode != MODE_REGULER;
    else
        next.manualOverride = d["manual_override"] | false;

    JsonObjectConst ranges = d["ranges"];
    JsonObjectConst disabled = d["disabled_days"];
    for (int m = 0; m < MODE_COUNT; m++)
    {
        const char *code = modeCode((ScheduleMode)m);
        if (modeHasRange((ScheduleMode)m))
        {
            String start = ranges[code]["start"] | "";
            String end = ranges[code]["end"] | "";
            if (start.length() || end.length())
            {
                if (!bell::validDate(start.c_str()) || !bell::validDate(end.c_str()))
                {
                    err = String("Tanggal mode ") + modeLabel((ScheduleMode)m) + " tidak valid";
                    return false;
                }
                if (start > end)
                {
                    err = String("Tanggal mulai mode ") + modeLabel((ScheduleMode)m) + " setelah tanggal selesai";
                    return false;
                }
            }
            next.ranges[m].start = start;
            next.ranges[m].end = end;
        }
        uint8_t mask = 0;
        for (JsonVariantConst v : disabled[code].as<JsonArrayConst>())
        {
            String day = v.as<String>();
            for (int dow = 0; dow < 7; dow++)
                if (day == bell::dayCodeOf(dow))
                    mask |= (1 << dow);
        }
        next.disabledDays[m] = mask;
    }
    out = next;
    return true;
}

void fillConfigJson(JsonObject d, bool includeNetwork)
{
    d["volume"] = (int)currentVolume;
    d["eq"] = (int)eqPreset;
    d["holiday"] = (bool)holidayMode;
    fillModeJson(d["modes"].to<JsonObject>());
    JsonObject sl = d["sleep"].to<JsonObject>();
    sl["enabled"] = (bool)sleepEnabled;
    sl["start"] = minToStr(sleepStartMin);
    sl["end"] = minToStr(sleepEndMin);
    sl["oled"] = (bool)sleepOledOff;
    if (includeNetwork)
    {
        JsonObject s = d["static"].to<JsonObject>();
        s["enabled"] = staticCfg.enabled;
        s["ssid"] = staticCfg.ssid;
        s["ip"] = staticCfg.ip;
        s["gw"] = staticCfg.gw;
        s["mask"] = staticCfg.mask;
        s["dns"] = staticCfg.dns;
        d["auto_update"] = (bool)autoUpdate;
    }
}

void applyConfigJson(JsonObjectConst d, bool includeNetwork)
{
    currentVolume = constrain((int)(d["volume"] | 20), 0, 30);
    eqPreset = constrain((int)(d["eq"] | 0), 0, 5);
    holidayMode = d["holiday"] | false;

    ModeCfg parsed;
    String err;
    JsonObjectConst modes = d["modes"];
    if (modes.isNull())
    {
        JsonDocument legacy;
        legacy["mode"] = d["mode"] | "reguler";
        if (applyModeJson(legacy.as<JsonObjectConst>(), parsed, err))
            modeCfg = parsed;
    }
    else if (applyModeJson(modes, parsed, err))
        modeCfg = parsed;
    else
        Serial.println("Konfigurasi mode diabaikan: " + err);

    JsonObjectConst sl = d["sleep"];
    sleepEnabled = sl["enabled"] | false;
    sleepStartMin = bell::timeToMin(sl["start"] | "18:00", 18 * 60);
    sleepEndMin = bell::timeToMin(sl["end"] | "05:00", 5 * 60);
    sleepOledOff = sl["oled"] | true;

    if (includeNetwork)
    {
        JsonObjectConst s = d["static"];
        staticCfg.enabled = s["enabled"] | false;
        staticCfg.ssid = s["ssid"] | "";
        staticCfg.ip = s["ip"] | "";
        staticCfg.gw = s["gw"] | "";
        staticCfg.mask = s["mask"] | "";
        staticCfg.dns = s["dns"] | "";
        autoUpdate = d["auto_update"] | true;
    }
}

bool saveConfig()
{
    Lock c(cfgMutex);
    JsonDocument d;
    fillConfigJson(d.to<JsonObject>(), true);
    String out;
    serializeJson(d, out);
    return fsWriteText(CONFIG_FILE, out);
}

void loadConfig()
{
    String txt = fsReadText(CONFIG_FILE);
    if (txt.length() == 0)
    {
        saveConfig();
        return;
    }
    JsonDocument d;
    if (deserializeJson(d, txt))
    {
        Serial.println("config.json rusak, memakai nilai bawaan");
        return;
    }
    Lock c(cfgMutex);
    applyConfigJson(d.as<JsonObjectConst>(), true);
}
