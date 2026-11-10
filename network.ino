uint32_t ip2u(const IPAddress &ip)
{
    return ((uint32_t)ip[0] << 24) | ((uint32_t)ip[1] << 16) | ((uint32_t)ip[2] << 8) | ip[3];
}

IPAddress u2ip(uint32_t v)
{
    return IPAddress((uint8_t)(v >> 24), (uint8_t)(v >> 16), (uint8_t)(v >> 8), (uint8_t)v);
}

String storedSsid()
{
    wifi_config_t c;
    if (esp_wifi_get_config(WIFI_IF_STA, &c) != ESP_OK)
        return "";
    return String((const char *)c.sta.ssid);
}

void startFallbackAP()
{
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAPConfig(AP_IP, AP_IP, AP_MASK);
    WiFi.softAP(AP_SSID, AP_PASS);
    apActive = true;
    Serial.println("Mode AP aktif: http://192.168.4.1");
}

void stopFallbackAP()
{
    WiFi.softAPdisconnect(true);
    WiFi.mode(WIFI_STA);
    WiFi.setTxPower(WIFI_POWER_11dBm);
    apActive = false;
    Serial.println("AP dimatikan, WiFi tersambung");
}

void onWifiConnected()
{
    WiFi.setSleep(WIFI_PS_MIN_MODEM);
    if (apActive)
        stopFallbackAP();
    MDNS.end();
    if (MDNS.begin("bel-madrasah"))
        MDNS.addService("http", "tcp", 80);
    lastNtpAttempt = 0;
    Serial.println("WiFi terkoneksi: " + WiFi.localIP().toString());
}

void networkTick()
{
    if (!wifiSetupDone)
        return;
    static bool wasConnected = false;
    static unsigned long disconnectedSince = 0;
    static unsigned long lastReconnect = 0;
    bool connected = WiFi.status() == WL_CONNECTED;
    if (connected)
    {
        if (!wasConnected)
            onWifiConnected();
        wasConnected = true;
        disconnectedSince = 0;
        return;
    }
    wasConnected = false;
    if (disconnectedSince == 0)
        disconnectedSince = millis();
    if (!apActive && millis() - disconnectedSince > 20000)
        startFallbackAP();
    if (millis() - lastReconnect > (apActive ? 180000UL : 60000UL))
    {
        lastReconnect = millis();
        WiFi.reconnect();
    }
}

void connectWiFi()
{
    WiFi.mode(WIFI_STA);
    WiFi.setTxPower(WIFI_POWER_11dBm);
    WiFi.setAutoReconnect(true);

    bool hadSaved = storedSsid().length() > 0;

    WiFiManager wm;
    wm.setConnectTimeout(15);
    wm.setConfigPortalTimeout(120);
    wm.setEnableConfigPortal(!hadSaved);
    wm.setAPStaticIPConfig(AP_IP, AP_IP, AP_MASK);

    bool disableStatic = false;
    {
        Lock c(cfgMutex);
        if (staticCfg.enabled)
        {
            IPAddress ip, gw, mask, dns;
            bool valid = ip.fromString(staticCfg.ip) && gw.fromString(staticCfg.gw) && mask.fromString(staticCfg.mask);
            if (!dns.fromString(staticCfg.dns))
                dns = gw;
            String saved = storedSsid();
            if (valid && saved.length() && saved == staticCfg.ssid)
            {
                wm.setSTAStaticIPConfig(ip, gw, mask, dns);
                Serial.println("Memakai IP statis: " + staticCfg.ip);
            }
            else
            {
                staticCfg.enabled = false;
                disableStatic = true;
            }
        }
    }
    if (disableStatic)
    {
        saveConfig();
        Serial.println("IP statis dinonaktifkan (jaringan berbeda)");
    }

    bool ok = wm.autoConnect(AP_SSID, AP_PASS);
    if (!ok)
    {
        Serial.println("WiFi tidak terkoneksi, memakai AP + RTC");
        startFallbackAP();
    }
    else if (!hadSaved)
    {
        Serial.println("WiFi baru tersimpan, restart...");
        delay(1000);
        ESP.restart();
    }
}

void wifiTask(void *param)
{
    connectWiFi();
    setupWebServer();
    server.begin();
    wifiSetupDone = true;
    Serial.println("Web server aktif, IP: " + (WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : WiFi.softAPIP().toString()));
    vTaskDelete(NULL);
}
