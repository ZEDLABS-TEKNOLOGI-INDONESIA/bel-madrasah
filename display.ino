bool oledIsOff = false;

void oledPower(bool on)
{
    Lock l(i2cMutex);
    if (!oledReady)
        return;
    if (!on)
    {
        oled.clearDisplay();
        oled.display();
    }
    oled.ssd1306_command(on ? SSD1306_DISPLAYON : SSD1306_DISPLAYOFF);
}

void oledDrawCentered(const String &text, int y, uint8_t size)
{
    int16_t x1, y1;
    uint16_t w, h;
    oled.setTextSize(size);
    oled.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);
    oled.setCursor(((int)OLED_WIDTH - (int)w) / 2 - x1, y);
    oled.print(text);
}

void oledShow(const String &label, String value, bool big = false)
{
    Lock l(i2cMutex);
    if (!oledReady)
        return;
    oled.clearDisplay();
    oled.setTextColor(SSD1306_WHITE);
    oledDrawCentered(label, 0, 1);
    if (big)
        oledDrawCentered(value, 14, 2);
    else
    {
        if (value.length() > 21)
            value = value.substring(0, 21);
        oledDrawCentered(value, 18, 1);
    }
    oled.display();
}

void displayBegin()
{
    oledReady = oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
    if (!oledReady)
        Serial.println("OLED SSD1306 tidak terdeteksi!");
    else
        oledShow("BEL MADRASAH", "v" FW_VERSION);
}

void oledTask(void *param)
{
    for (;;)
    {
        bool wantOff = sleeping && sleepOledOff;
        if (wantOff != oledIsOff)
        {
            oledPower(!wantOff);
            oledIsOff = wantOff;
        }
        if (wantOff)
        {
            vTaskDelay(pdMS_TO_TICKS(1000));
            continue;
        }

        int screen = (millis() / OLED_SCREEN_INTERVAL) % 3;
        bool sta = WiFi.status() == WL_CONNECTED;

        if (screen == 0)
        {
            DateTime now = getNow();
            char tb[12];
            snprintf(tb, sizeof(tb), "%02d:%02d:%02d", now.hour(), now.minute(), now.second());
            if (!timeTrusted)
                oledShow("WAKTU BELUM VALID", tb, false);
            else if (sleeping)
            {
                char eb[16];
                snprintf(eb, sizeof(eb), "s/d %02d:%02d", sleepEndMin / 60, sleepEndMin % 60);
                oledShow("MODE TIDUR", eb, false);
            }
            else
                oledShow("WAKTU", tb, true);
        }
        else if (screen == 1)
            oledShow("IP ADDRESS", sta ? WiFi.localIP().toString() : WiFi.softAPIP().toString());
        else
            oledShow("NAMA WIFI", sta ? WiFi.SSID() : String(AP_SSID));
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}
