const unsigned long OTA_CHECK_INTERVAL = 6UL * 3600UL * 1000UL;
const unsigned long OTA_RETRY_UNSAFE = 30UL * 60UL * 1000UL;
const unsigned long OTA_FIRST_CHECK_AFTER = 3UL * 60UL * 1000UL;
const unsigned long OTA_VALIDATE_AFTER = 60000UL;
const int OTA_SAFE_MINUTES = 5;

volatile JobState otaState = JOB_IDLE;
volatile int otaProgress = 0;
String otaMessage;
String otaAvailable;
String otaAppUrl;
String otaSumsUrl;
String otaLastCheckAt;
unsigned long otaLastCheck = 0;
bool otaValidated = false;
bool otaPendingVerify = false;
bool otaRolledBack = false;
volatile bool otaUploadAuthorized = false;
volatile bool otaUploadOk = false;
String otaUploadError;

void otaBootReport()
{
    const esp_partition_t *running = esp_ota_get_running_partition();
    esp_ota_img_states_t state;
    if (running && esp_ota_get_state_partition(running, &state) == ESP_OK)
        otaPendingVerify = state == ESP_OTA_IMG_PENDING_VERIFY;
    otaRolledBack = esp_ota_get_last_invalid_partition() != nullptr;
    if (otaPendingVerify)
        Serial.println("Firmware baru menunggu verifikasi (60 detik)");
    if (otaRolledBack)
        Serial.println("Firmware sebelumnya gagal berjalan dan sudah dikembalikan");
}

void setOta(JobState state, const String &message)
{
    Lock j(jobMutex);
    otaState = state;
    otaMessage = message;
}

String nowStamp()
{
    if (!timeTrusted)
        return "";
    DateTime now = getNow();
    char b[17];
    snprintf(b, sizeof(b), "%04d-%02d-%02d %02d:%02d", now.year(), now.month(), now.day(), now.hour(), now.minute());
    return String(b);
}

void configureClient(HTTPClient &http)
{
    http.useHTTP10(true);
    http.setTimeout(20000);
    http.setUserAgent("bel-madrasah-fw/" FW_VERSION);
    http.setFollowRedirects(HTTPC_FORCE_FOLLOW_REDIRECTS);
}

String appAssetName(const String &version)
{
    return "bel-madrasah-fw-" + version + "-esp32c3-app.bin";
}

bool findLatestRelease(String &version, String &appUrl, String &sumsUrl, String &err)
{
    NetworkClientSecure client;
    client.useBuiltinCACertBundle();
    HTTPClient http;
    configureClient(http);
    if (!http.begin(client, "https://api.github.com/repos/" FW_REPO "/releases?per_page=30"))
    {
        err = "Tidak dapat membuka koneksi ke GitHub";
        return false;
    }
    http.addHeader("Accept", "application/vnd.github+json");
    int code = http.GET();
    if (code != HTTP_CODE_OK)
    {
        err = code < 0 ? "Koneksi ke GitHub gagal: " + http.errorToString(code) : "GitHub membalas status " + String(code);
        http.end();
        return false;
    }
    JsonDocument filter;
    filter[0]["tag_name"] = true;
    filter[0]["draft"] = true;
    filter[0]["prerelease"] = true;
    filter[0]["assets"][0]["name"] = true;
    filter[0]["assets"][0]["browser_download_url"] = true;
    JsonDocument doc;
    DeserializationError jerr = deserializeJson(doc, http.getStream(), DeserializationOption::Filter(filter));
    http.end();
    if (jerr)
    {
        err = String("Daftar release tidak terbaca: ") + jerr.c_str();
        return false;
    }

    version = "";
    for (JsonObjectConst r : doc.as<JsonArrayConst>())
    {
        String tag = r["tag_name"] | "";
        if (!tag.startsWith("fw-v") || (r["draft"] | false) || (r["prerelease"] | false))
            continue;
        String v = tag.substring(4);
        if (bell::compareVersion(v.c_str(), FW_VERSION) <= 0)
            continue;
        if (version.length() && bell::compareVersion(v.c_str(), version.c_str()) <= 0)
            continue;
        String app, sums;
        for (JsonObjectConst a : r["assets"].as<JsonArrayConst>())
        {
            String name = a["name"] | "";
            if (name == appAssetName(v))
                app = a["browser_download_url"] | "";
            else if (name == "checksums.txt")
                sums = a["browser_download_url"] | "";
        }
        if (app.length() && sums.length())
        {
            version = v;
            appUrl = app;
            sumsUrl = sums;
        }
    }
    return true;
}

bool fetchExpectedSha(const String &url, const String &assetName, String &sha, String &err)
{
    NetworkClientSecure client;
    client.useBuiltinCACertBundle();
    HTTPClient http;
    configureClient(http);
    if (!http.begin(client, url))
    {
        err = "Tidak dapat mengunduh checksums.txt";
        return false;
    }
    int code = http.GET();
    if (code != HTTP_CODE_OK)
    {
        err = "checksums.txt: status " + String(code);
        http.end();
        return false;
    }
    String body = http.getString();
    http.end();
    int start = 0;
    while (start < (int)body.length())
    {
        int end = body.indexOf('\n', start);
        if (end < 0)
            end = body.length();
        String line = body.substring(start, end);
        line.trim();
        if (line.length() > 66 && line.endsWith(" " + assetName))
        {
            sha = line.substring(0, 64);
            sha.toLowerCase();
            return true;
        }
        start = end + 1;
    }
    err = "Checksum untuk " + assetName + " tidak ditemukan";
    return false;
}

bool flashFromUrl(const String &url, const String &expectedSha, String &err)
{
    NetworkClientSecure client;
    client.useBuiltinCACertBundle();
    HTTPClient http;
    configureClient(http);
    if (!http.begin(client, url))
    {
        err = "Tidak dapat mengunduh firmware";
        return false;
    }
    int code = http.GET();
    int total = http.getSize();
    if (code != HTTP_CODE_OK || total <= 0)
    {
        err = "Unduhan firmware gagal (status " + String(code) + ")";
        http.end();
        return false;
    }
    if (!Update.begin(total, U_FLASH))
    {
        err = String("Ruang OTA tidak cukup: ") + Update.errorString();
        http.end();
        return false;
    }

    mbedtls_sha256_context ctx;
    mbedtls_sha256_init(&ctx);
    mbedtls_sha256_starts(&ctx, 0);
    WiFiClient *stream = http.getStreamPtr();
    uint8_t buf[1024];
    int written = 0;
    unsigned long lastData = millis();
    while (written < total)
    {
        size_t avail = stream->available();
        if (!avail)
        {
            if (!http.connected() || millis() - lastData > 20000)
                break;
            delay(5);
            continue;
        }
        int n = stream->readBytes(buf, std::min(avail, sizeof(buf)));
        if (n <= 0)
            continue;
        lastData = millis();
        mbedtls_sha256_update(&ctx, buf, n);
        if (Update.write(buf, n) != (size_t)n)
        {
            err = String("Gagal menulis firmware: ") + Update.errorString();
            break;
        }
        written += n;
        otaProgress = (int)((int64_t)written * 100 / total);
    }
    http.end();
    uint8_t digest[32];
    mbedtls_sha256_finish(&ctx, digest);
    mbedtls_sha256_free(&ctx);

    if (err.length() == 0 && written != total)
        err = "Unduhan firmware terputus";
    if (err.length() == 0 && toHex(digest, sizeof(digest)) != expectedSha)
        err = "Checksum firmware tidak cocok, pemasangan dibatalkan";
    if (err.length())
    {
        Update.abort();
        return false;
    }
    if (!Update.end(true))
    {
        err = String("Firmware ditolak: ") + Update.errorString();
        return false;
    }
    return true;
}

bool safeToInstall(String &why)
{
    if (!timeTrusted)
    {
        why = "waktu belum tepercaya";
        return false;
    }
    if (audioPlaying)
    {
        why = "bel sedang berbunyi";
        return false;
    }
    DateTime now = getNow();
    if (minutesToNextBell(now) < OTA_SAFE_MINUTES)
    {
        why = "ada bel dalam 5 menit";
        return false;
    }
    return true;
}

void otaTask(void *param)
{
    OtaAction action = (OtaAction)(intptr_t)param;
    String version, appUrl, sumsUrl, err;
    otaProgress = 0;
    bool ok = findLatestRelease(version, appUrl, sumsUrl, err);
    {
        Lock j(jobMutex);
        otaLastCheck = millis();
        otaLastCheckAt = nowStamp();
        if (ok)
        {
            otaAvailable = version;
            otaAppUrl = appUrl;
            otaSumsUrl = sumsUrl;
        }
    }

    if (!ok)
        setOta(JOB_ERROR, err);
    else if (version.length() == 0)
        setOta(JOB_DONE, "Firmware sudah versi terbaru");
    else if (action == OTA_CHECK)
        setOta(JOB_DONE, "Tersedia firmware " + version);
    else
    {
        String why;
        if (action == OTA_AUTO && !safeToInstall(why))
        {
            setOta(JOB_DONE, "Firmware " + version + " tersedia, dipasang nanti (" + why + ")");
            Lock j(jobMutex);
            otaLastCheck = millis() - (OTA_CHECK_INTERVAL - OTA_RETRY_UNSAFE);
        }
        else
        {
            setOta(JOB_RUNNING, "Mengunduh firmware " + version);
            String sha;
            if (fetchExpectedSha(sumsUrl, appAssetName(version), sha, err) && flashFromUrl(appUrl, sha, err))
            {
                setOta(JOB_DONE, "Firmware " + version + " terpasang, perangkat restart");
                Serial.println("Firmware " + version + " terpasang, restart");
                scheduleRestart(3000);
            }
            else
                setOta(JOB_ERROR, err);
        }
    }
    releaseNetJob();
    vTaskDelete(NULL);
}

String startOtaJob(OtaAction action)
{
    if (WiFi.status() != WL_CONNECTED)
        return "Perangkat belum terhubung ke internet";
    if (Update.isRunning())
        return "Pemasangan firmware sedang berjalan";
    if (!claimNetJob())
        return "Perangkat sedang mengunduh data lain, coba lagi sebentar";
    setOta(JOB_RUNNING, action == OTA_CHECK ? "Memeriksa pembaruan" : "Menyiapkan pembaruan");
    if (xTaskCreate(otaTask, "otaTask", 16384, (void *)(intptr_t)action, 1, NULL) != pdPASS)
    {
        releaseNetJob();
        setOta(JOB_ERROR, "Memori tidak cukup");
        return "Memori tidak cukup";
    }
    return "";
}

void otaTick()
{
    if (!otaValidated && millis() > OTA_VALIDATE_AFTER && wifiSetupDone && millis() - bellHeartbeat < 5000)
    {
        esp_ota_mark_app_valid_cancel_rollback();
        otaValidated = true;
        if (otaPendingVerify)
        {
            Serial.println("Firmware baru berjalan normal dan dinyatakan sehat");
            otaPendingVerify = false;
        }
    }

    if (!autoUpdate || !otaValidated || WiFi.status() != WL_CONNECTED || !timeTrusted || netJobBusy)
        return;
    unsigned long last;
    {
        Lock j(jobMutex);
        last = otaLastCheck;
    }
    bool due = last == 0 ? millis() > OTA_FIRST_CHECK_AFTER : millis() - last > OTA_CHECK_INTERVAL;
    if (due)
        startOtaJob(OTA_AUTO);
}

void fillFirmwareJson(JsonObject d)
{
    static const char *const states[] = {"idle", "running", "done", "error"};
    const esp_partition_t *running = esp_ota_get_running_partition();
    d["version"] = FW_VERSION;
    d["partition"] = running ? running->label : "";
    d["auto"] = (bool)autoUpdate;
    d["pending_verify"] = otaPendingVerify;
    d["rolled_back"] = otaRolledBack;
    Lock j(jobMutex);
    d["state"] = states[otaState];
    d["message"] = otaMessage;
    d["progress"] = (int)otaProgress;
    d["available"] = otaAvailable;
    d["last_check"] = otaLastCheckAt;
}

void otaUploadChunk(AsyncWebServerRequest *r, const String &filename, size_t index, uint8_t *data, size_t len, bool final)
{
    if (index == 0)
    {
        otaUploadError = "";
        otaUploadOk = false;
        otaUploadAuthorized = isAuthorized(r);
        if (!otaUploadAuthorized)
            return;
        if (Update.isRunning() || !claimNetJob())
        {
            otaUploadError = "Pemasangan firmware lain sedang berjalan";
            otaUploadAuthorized = false;
            return;
        }
        if (!filename.endsWith(".bin"))
            otaUploadError = "File harus berekstensi .bin";
        else if (len == 0 || data[0] != 0xE9)
            otaUploadError = "Bukan file firmware ESP32 (gunakan file -app.bin)";
        else if (!Update.begin(UPDATE_SIZE_UNKNOWN, U_FLASH))
            otaUploadError = String("Ruang OTA tidak cukup: ") + Update.errorString();
        if (otaUploadError.length())
        {
            releaseNetJob();
            otaUploadAuthorized = false;
            return;
        }
        setOta(JOB_RUNNING, "Menerima firmware dari browser");
    }
    if (!otaUploadAuthorized || otaUploadError.length())
        return;
    if (Update.write(data, len) != len)
        otaUploadError = String("Gagal menulis firmware: ") + Update.errorString();
    if (final || otaUploadError.length())
    {
        if (otaUploadError.length())
            Update.abort();
        else if (!Update.end(true))
            otaUploadError = String("Firmware ditolak: ") + Update.errorString();
        else
            otaUploadOk = true;
        setOta(otaUploadError.length() ? JOB_ERROR : JOB_DONE,
               otaUploadError.length() ? otaUploadError : String("Firmware terpasang, perangkat restart"));
        releaseNetJob();
    }
}
