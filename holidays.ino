const char *HOLIDAY_ICS_URL =
    "https://calendar.google.com/calendar/ical/id.indonesian%23holiday%40group.v.calendar.google.com/public/basic.ics";
const size_t MAX_NATIONAL = 60;

volatile JobState nationalState = JOB_IDLE;
int nationalYear = 0;
String nationalMessage;
std::vector<NationalHoliday> nationalList;
volatile bool netJobBusy = false;

void sortHolidaysLocked()
{
    std::sort(holidays.begin(), holidays.end(), [](const Holiday &a, const Holiday &b)
              { return a.date < b.date; });
}

void fillHolidaysJson(JsonArray a)
{
    for (const Holiday &h : holidays)
    {
        JsonObject o = a.add<JsonObject>();
        o["date"] = h.date;
        o["name"] = h.name;
    }
}

bool parseHolidaysJson(JsonArrayConst a, std::vector<Holiday> &out, String &err)
{
    out.clear();
    for (JsonObjectConst o : a)
    {
        Holiday h{o["date"] | "", o["name"] | ""};
        h.name.trim();
        if (!bell::validDate(h.date.c_str()) || h.name.length() > 60)
        {
            err = "Hari libur ke-" + String(out.size() + 1) + " tidak valid";
            return false;
        }
        if (out.size() >= MAX_HOLIDAYS)
        {
            err = "Hari libur melebihi " + String(MAX_HOLIDAYS);
            return false;
        }
        out.push_back(h);
    }
    return true;
}

bool saveHolidaysLocked()
{
    JsonDocument d;
    fillHolidaysJson(d["holidays"].to<JsonArray>());
    String out;
    serializeJson(d, out);
    return fsWriteText(HOLIDAYS_FILE, out);
}

void loadHolidays()
{
    String txt = fsReadText(HOLIDAYS_FILE);
    Lock l(dataMutex);
    holidays.clear();
    if (txt.length() == 0)
        return;
    JsonDocument d;
    String err;
    std::vector<Holiday> parsed;
    if (deserializeJson(d, txt) || !parseHolidaysJson(d["holidays"].as<JsonArrayConst>(), parsed, err))
    {
        Serial.println("holidays.json rusak, daftar libur dikosongkan");
        return;
    }
    holidays = parsed;
    sortHolidaysLocked();
}

String holidayName(const String &date)
{
    Lock l(dataMutex);
    for (const Holiday &h : holidays)
        if (h.date == date)
            return h.name.length() ? h.name : String("Libur");
    return "";
}

String addHoliday(const String &date, String name)
{
    name.trim();
    if (!bell::validDate(date.c_str()))
        return "Tanggal tidak valid";
    if (name.length() > 60)
        return "Keterangan terlalu panjang (maks 60 karakter)";
    Lock l(dataMutex);
    for (const Holiday &h : holidays)
        if (h.date == date)
            return "Tanggal sudah ada";
    if (holidays.size() >= MAX_HOLIDAYS)
        return "Daftar libur penuh (maks " + String(MAX_HOLIDAYS) + ")";
    holidays.push_back({date, name});
    sortHolidaysLocked();
    return saveHolidaysLocked() ? "" : "Gagal menyimpan";
}

bool deleteHoliday(const String &date)
{
    Lock l(dataMutex);
    size_t before = holidays.size();
    holidays.erase(std::remove_if(holidays.begin(), holidays.end(), [&date](const Holiday &h)
                                  { return h.date == date; }),
                   holidays.end());
    if (holidays.size() == before)
        return false;
    saveHolidaysLocked();
    return true;
}

bool claimNetJob()
{
    Lock j(jobMutex);
    if (netJobBusy)
        return false;
    netJobBusy = true;
    return true;
}

void releaseNetJob()
{
    Lock j(jobMutex);
    netJobBusy = false;
}

void setNational(JobState state, const String &message)
{
    Lock j(jobMutex);
    nationalState = state;
    nationalMessage = message;
}

void nationalTask(void *param)
{
    int year = (int)(intptr_t)param;
    std::vector<NationalHoliday> found;
    String error;
    {
        NetworkClientSecure client;
        client.useBuiltinCACertBundle();
        HTTPClient http;
        http.useHTTP10(true);
        http.setTimeout(15000);
        http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
        if (!http.begin(client, HOLIDAY_ICS_URL))
            error = "Tidak dapat membuka koneksi";
        else
        {
            int code = http.GET();
            if (code != HTTP_CODE_OK)
                error = code < 0 ? "Koneksi gagal: " + http.errorToString(code) : "Sumber membalas status " + String(code);
            else
            {
                Stream &s = http.getStream();
                bell::IcsHolidayParser parser(year);
                bell::IcsHolidayParser::Holiday h;
                String pending;
                unsigned long lastByte = millis();
                auto flush = [&](const String &line)
                {
                    if (line.length() && parser.feed(line.c_str(), h) && found.size() < MAX_NATIONAL)
                        found.push_back({String(h.date), String(h.name), h.cuti});
                };
                while (http.connected() || s.available())
                {
                    if (!s.available())
                    {
                        if (millis() - lastByte > 15000)
                        {
                            error = "Unduhan terhenti";
                            break;
                        }
                        delay(10);
                        continue;
                    }
                    lastByte = millis();
                    String line = s.readStringUntil('\n');
                    line.replace("\r", "");
                    if (line.startsWith(" ") || line.startsWith("\t"))
                    {
                        if (pending.length() < 400)
                            pending += line.substring(1);
                        continue;
                    }
                    flush(pending);
                    pending = line;
                }
                flush(pending);
            }
            http.end();
        }
    }
    std::sort(found.begin(), found.end(), [](const NationalHoliday &a, const NationalHoliday &b)
              { return a.date < b.date; });
    {
        Lock j(jobMutex);
        nationalList = found;
        nationalYear = year;
        if (error.length())
        {
            nationalState = JOB_ERROR;
            nationalMessage = error;
        }
        else
        {
            nationalState = JOB_DONE;
            nationalMessage = found.empty() ? "Belum ada data untuk tahun " + String(year) : "";
        }
    }
    releaseNetJob();
    vTaskDelete(NULL);
}

String startNationalFetch(int year)
{
    if (year < bell::MIN_VALID_YEAR || year > bell::MAX_VALID_YEAR)
        return "Tahun tidak valid";
    if (WiFi.status() != WL_CONNECTED)
        return "Perangkat belum terhubung ke internet";
    if (!claimNetJob())
        return "Perangkat sedang mengunduh data lain, coba lagi sebentar";
    setNational(JOB_RUNNING, "");
    if (xTaskCreate(nationalTask, "holidayTask", 12288, (void *)(intptr_t)year, 1, NULL) != pdPASS)
    {
        releaseNetJob();
        setNational(JOB_ERROR, "Memori tidak cukup");
        return "Memori tidak cukup";
    }
    return "";
}

void fillNationalJson(JsonObject d)
{
    static const char *const states[] = {"idle", "running", "done", "error"};
    Lock j(jobMutex);
    d["state"] = states[nationalState];
    d["year"] = nationalYear;
    d["message"] = nationalMessage;
    JsonArray a = d["holidays"].to<JsonArray>();
    for (const NationalHoliday &h : nationalList)
    {
        JsonObject o = a.add<JsonObject>();
        o["date"] = h.date;
        o["name"] = h.name;
        o["cuti"] = h.cuti;
    }
}
