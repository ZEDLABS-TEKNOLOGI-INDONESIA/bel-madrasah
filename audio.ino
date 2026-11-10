const unsigned long SCHEDULED_ERROR_WINDOW = 15000UL;

static const char *const EQ_LABELS[] = {"Normal", "Pop", "Rock", "Jazz", "Classic", "Bass"};

const char *eqLabel(int eq)
{
    return (eq >= 0 && eq <= 5) ? EQ_LABELS[eq] : EQ_LABELS[0];
}

bool queueAudio(AudioCmdType type, uint16_t arg)
{
    AudioCmd c{type, arg};
    return xQueueSend(audioQueue, &c, 0) == pdTRUE;
}

bool audioReady()
{
    return dfpReady && sdPresent;
}

void dfpBegin()
{
    dfpSerial.end();
    dfpSerial.begin(9600, SERIAL_8N1, DFP_RX_PIN, DFP_TX_PIN);
    dfpReady = dfPlayer.begin(dfpSerial, true, true);
    if (!dfpReady)
    {
        Serial.println("DFPlayer tidak terdeteksi/kartu SD DFPlayer tidak ada");
        return;
    }
    sdPresent = true;
    dfPlayer.volume(currentVolume);
    dfPlayer.EQ(eqPreset);
    dfPlayer.outputDevice(DFPLAYER_DEVICE_SD);
    setInfo(lastDfpError, "");
    Serial.println("DFPlayer siap");
}

String trackFileName(uint16_t track)
{
    char b[16];
    snprintf(b, sizeof(b), "mp3/%04u.mp3", track);
    return String(b);
}

String dfpErrorText(int code, uint16_t track)
{
    switch (code)
    {
    case Busy:
        return "DFPlayer sibuk atau kartu SD belum siap";
    case Sleeping:
        return "DFPlayer dalam mode tidur";
    case SerialWrongStack:
    case CheckSumNotMatch:
        return "Komunikasi serial DFPlayer terganggu";
    case FileIndexOut:
    case FileMismatch:
        return "File track " + String(track) + " tidak ada di kartu SD (" + trackFileName(track) + ")";
    default:
        return "DFPlayer error " + String(code);
    }
}

void reportScheduledFailure(const String &reason)
{
    if (!scheduledTrack || millis() - scheduledAt > SCHEDULED_ERROR_WINDOW)
        return;
    DateTime now = getNow();
    char when[17];
    snprintf(when, sizeof(when), "%04d-%02d-%02d %02d:%02d", now.year(), now.month(), now.day(), now.hour(), now.minute());
    logActivity(when, activeModeFor(dateString(now)).mode, scheduledTrack, "gagal", reason);
    scheduledTrack = 0;
}

void dfpTick()
{
    if (!dfPlayer.available())
        return;
    uint8_t type = dfPlayer.readType();
    int value = dfPlayer.read();
    switch (type)
    {
    case DFPlayerPlayFinished:
        audioPlaying = false;
        playingTrack = 0;
        scheduledTrack = 0;
        break;
    case DFPlayerError:
    {
        String e = dfpErrorText(value, playingTrack);
        setInfo(lastDfpError, e);
        Serial.println(e);
        reportScheduledFailure(e);
        audioPlaying = false;
        playingTrack = 0;
        break;
    }
    case DFPlayerCardRemoved:
        sdPresent = false;
        audioPlaying = false;
        playingTrack = 0;
        setInfo(lastDfpError, "Kartu SD DFPlayer dicabut");
        reportScheduledFailure("Kartu SD DFPlayer dicabut");
        Serial.println("Kartu SD DFPlayer dicabut");
        break;
    case DFPlayerCardInserted:
    case DFPlayerCardOnline:
        sdPresent = true;
        setInfo(lastDfpError, "");
        Serial.println("Kartu SD DFPlayer terpasang");
        break;
    default:
        break;
    }
}

void playTrack(uint16_t track)
{
    if (!audioReady() || track == 0)
        return;
    setInfo(lastDfpError, "");
    playingTrack = track;
    dfPlayer.playMp3Folder(track);
    audioPlaying = true;
    playStartedAt = millis();
    Serial.printf("Memutar track %d\n", track);
}

void stopTrack()
{
    if (dfpReady)
        dfPlayer.stop();
    audioPlaying = false;
    playingTrack = 0;
}

void handleAudioCmd(const AudioCmd &c)
{
    switch (c.type)
    {
    case AC_PLAY:
        playTrack(c.arg);
        break;
    case AC_STOP:
        stopTrack();
        break;
    case AC_VOLUME:
        if (dfpReady)
            dfPlayer.volume(c.arg);
        break;
    case AC_EQ:
        if (dfpReady)
            dfPlayer.EQ(c.arg);
        break;
    }
}

void audioTick()
{
    if (dfpReady)
        dfpTick();
    if (audioPlaying && millis() - playStartedAt > PLAY_TIMEOUT)
    {
        audioPlaying = false;
        playingTrack = 0;
    }
}
