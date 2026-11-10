const size_t LOG_KEEP_AFTER_ROTATE = 120;
size_t logLines = 0;

size_t countLogLinesLocked()
{
    File f = LittleFS.open(LOG_FILE, "r");
    if (!f)
        return 0;
    size_t n = 0;
    while (f.available())
        if (f.read() == '\n')
            n++;
    f.close();
    return n;
}

void logBegin()
{
    Lock l(logMutex);
    logLines = countLogLinesLocked();
}

void rotateLogLocked()
{
    std::vector<String> lines;
    File f = LittleFS.open(LOG_FILE, "r");
    if (!f)
        return;
    while (f.available())
    {
        String line = f.readStringUntil('\n');
        if (line.length())
            lines.push_back(line);
        if (lines.size() > LOG_KEEP_AFTER_ROTATE)
            lines.erase(lines.begin());
    }
    f.close();
    String out;
    for (const String &line : lines)
        out += line + "\n";
    if (fsWriteText(LOG_FILE, out))
        logLines = lines.size();
}

void logActivity(const String &when, ScheduleMode mode, uint16_t track, const char *status, const String &reason)
{
    JsonDocument d;
    d["t"] = when;
    d["m"] = modeCode(mode);
    d["k"] = track;
    d["l"] = trackName(track);
    d["s"] = status;
    if (reason.length())
        d["r"] = reason;
    String line;
    serializeJson(d, line);

    Lock l(logMutex);
    File f = LittleFS.open(LOG_FILE, "a");
    if (!f)
        return;
    f.println(line);
    f.close();
    if (++logLines > MAX_LOG_LINES)
        rotateLogLocked();
}

void fillLogJson(JsonArray out)
{
    std::vector<String> lines;
    {
        Lock l(logMutex);
        File f = LittleFS.open(LOG_FILE, "r");
        if (!f)
            return;
        while (f.available())
        {
            String line = f.readStringUntil('\n');
            if (line.length())
                lines.push_back(line);
        }
        f.close();
    }
    for (auto it = lines.rbegin(); it != lines.rend(); ++it)
    {
        JsonDocument d;
        if (deserializeJson(d, *it))
            continue;
        out.add(d.as<JsonObjectConst>());
    }
}

bool clearLog()
{
    Lock l(logMutex);
    logLines = 0;
    return !LittleFS.exists(LOG_FILE) || LittleFS.remove(LOG_FILE);
}
