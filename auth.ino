const char *SESSION_COOKIE = "bel_sid";
const unsigned int PBKDF2_ITERATIONS = 5000;
const unsigned long SESSION_IDLE_MS = 12UL * 3600UL * 1000UL;
const unsigned long SESSION_MAX_MS = 7UL * 24UL * 3600UL * 1000UL;
const int MAX_SESSIONS = 8;
const int MAX_LOGIN_FAILS = 5;
const unsigned long LOGIN_LOCKOUT_MS = 15UL * 60UL * 1000UL;
const int MAX_TRACKED_IPS = 16;
const size_t MIN_PASSWORD_LEN = 8;

struct AuthCred
{
    uint8_t salt[16];
    uint8_t hash[32];
    bool isDefault;
};

struct SessionSlot
{
    bool used;
    uint8_t hash[32];
    unsigned long created;
    unsigned long lastSeen;
};

struct LoginAttempt
{
    uint32_t ip;
    uint8_t fails;
    unsigned long lockUntil;
};

AuthCred cred;
SessionSlot sessions[MAX_SESSIONS];
LoginAttempt attempts[MAX_TRACKED_IPS];

String toHex(const uint8_t *b, size_t n)
{
    static const char *digits = "0123456789abcdef";
    String s;
    s.reserve(n * 2);
    for (size_t i = 0; i < n; i++)
    {
        s += digits[b[i] >> 4];
        s += digits[b[i] & 0x0F];
    }
    return s;
}

bool fromHex(const String &s, uint8_t *out, size_t n)
{
    if (s.length() != n * 2)
        return false;
    for (size_t i = 0; i < n; i++)
    {
        int v = 0;
        for (int k = 0; k < 2; k++)
        {
            char c = s[i * 2 + k];
            int d = (c >= '0' && c <= '9') ? c - '0' : (c >= 'a' && c <= 'f') ? c - 'a' + 10 : -1;
            if (d < 0)
                return false;
            v = v * 16 + d;
        }
        out[i] = (uint8_t)v;
    }
    return true;
}

void derivePassword(const String &password, const uint8_t salt[16], uint8_t out[32])
{
    mbedtls_pkcs5_pbkdf2_hmac_ext(MBEDTLS_MD_SHA256, (const unsigned char *)password.c_str(), password.length(),
                                  salt, 16, PBKDF2_ITERATIONS, 32, out);
}

void sha256(const uint8_t *in, size_t n, uint8_t out[32])
{
    mbedtls_sha256(in, n, out, 0);
}

bool saveCredLocked()
{
    JsonDocument d;
    d["salt"] = toHex(cred.salt, sizeof(cred.salt));
    d["hash"] = toHex(cred.hash, sizeof(cred.hash));
    d["iter"] = PBKDF2_ITERATIONS;
    d["default"] = cred.isDefault;
    String out;
    serializeJson(d, out);
    return fsWriteText(AUTH_FILE, out);
}

bool setPasswordLocked(const String &password, bool isDefault)
{
    esp_fill_random(cred.salt, sizeof(cred.salt));
    derivePassword(password, cred.salt, cred.hash);
    cred.isDefault = isDefault;
    return saveCredLocked();
}

void clearSessionsLocked()
{
    memset(sessions, 0, sizeof(sessions));
}

void authBegin()
{
    Lock a(authMutex);
    memset(sessions, 0, sizeof(sessions));
    memset(attempts, 0, sizeof(attempts));
    String txt = fsReadText(AUTH_FILE);
    JsonDocument d;
    if (txt.length() && !deserializeJson(d, txt) && (int)(d["iter"] | 0) == (int)PBKDF2_ITERATIONS &&
        fromHex(d["salt"] | "", cred.salt, sizeof(cred.salt)) && fromHex(d["hash"] | "", cred.hash, sizeof(cred.hash)))
    {
        cred.isDefault = d["default"] | false;
        return;
    }
    setPasswordLocked(DEFAULT_ADMIN_PASSWORD, true);
    Serial.println("Password admin bawaan dipakai. Ganti setelah login pertama.");
}

bool passwordMatches(const String &password)
{
    uint8_t salt[16], expected[32], actual[32];
    {
        Lock a(authMutex);
        memcpy(salt, cred.salt, sizeof(salt));
        memcpy(expected, cred.hash, sizeof(expected));
    }
    derivePassword(password, salt, actual);
    return bell::constantTimeEqual(actual, expected, sizeof(actual));
}

bool passwordIsDefault()
{
    Lock a(authMutex);
    return cred.isDefault;
}

String changePassword(const String &oldPassword, const String &newPassword)
{
    if (!passwordMatches(oldPassword))
        return "Password lama salah";
    if (newPassword.length() < MIN_PASSWORD_LEN)
        return "Password baru minimal " + String(MIN_PASSWORD_LEN) + " karakter";
    if (newPassword == DEFAULT_ADMIN_PASSWORD)
        return "Password baru tidak boleh sama dengan password bawaan";
    if (newPassword.length() > 64)
        return "Password baru maksimal 64 karakter";
    Lock a(authMutex);
    return setPasswordLocked(newPassword, false) ? "" : "Gagal menyimpan password";
}

String createSession()
{
    uint8_t token[32];
    esp_fill_random(token, sizeof(token));
    Lock a(authMutex);
    int slot = 0;
    for (int i = 0; i < MAX_SESSIONS; i++)
    {
        if (!sessions[i].used)
        {
            slot = i;
            break;
        }
        if (sessions[i].lastSeen - sessions[slot].lastSeen > 0x7FFFFFFFUL)
            slot = i;
    }
    SessionSlot &s = sessions[slot];
    s.used = true;
    sha256(token, sizeof(token), s.hash);
    s.created = s.lastSeen = millis();
    return toHex(token, sizeof(token));
}

String cookieToken(AsyncWebServerRequest *r)
{
    if (!r->hasHeader("Cookie"))
        return "";
    String cookies = r->getHeader("Cookie")->value();
    String key = String(SESSION_COOKIE) + "=";
    int start = 0;
    while (start < (int)cookies.length())
    {
        int end = cookies.indexOf(';', start);
        if (end < 0)
            end = cookies.length();
        String part = cookies.substring(start, end);
        part.trim();
        if (part.startsWith(key))
            return part.substring(key.length());
        start = end + 1;
    }
    return "";
}

int findSessionLocked(const String &tokenHex)
{
    uint8_t token[32], hash[32];
    if (!fromHex(tokenHex, token, sizeof(token)))
        return -1;
    sha256(token, sizeof(token), hash);
    unsigned long now = millis();
    for (int i = 0; i < MAX_SESSIONS; i++)
    {
        SessionSlot &s = sessions[i];
        if (!s.used || !bell::constantTimeEqual(s.hash, hash, sizeof(hash)))
            continue;
        if (now - s.lastSeen > SESSION_IDLE_MS || now - s.created > SESSION_MAX_MS)
        {
            s.used = false;
            return -1;
        }
        return i;
    }
    return -1;
}

bool isAuthorized(AsyncWebServerRequest *r)
{
    String token = cookieToken(r);
    if (token.length() == 0)
        return false;
    Lock a(authMutex);
    int i = findSessionLocked(token);
    if (i < 0)
        return false;
    sessions[i].lastSeen = millis();
    return true;
}

void endSession(AsyncWebServerRequest *r)
{
    String token = cookieToken(r);
    Lock a(authMutex);
    int i = findSessionLocked(token);
    if (i >= 0)
        sessions[i].used = false;
}

uint32_t clientIp(AsyncWebServerRequest *r)
{
    IPAddress ip = r->client()->remoteIP();
    return ((uint32_t)ip[0] << 24) | ((uint32_t)ip[1] << 16) | ((uint32_t)ip[2] << 8) | ip[3];
}

unsigned long loginLockRemaining(uint32_t ip)
{
    Lock a(authMutex);
    unsigned long now = millis();
    for (LoginAttempt &at : attempts)
        if (at.ip == ip && at.fails >= MAX_LOGIN_FAILS && (long)(at.lockUntil - now) > 0)
            return at.lockUntil - now;
    return 0;
}

void recordLoginResult(uint32_t ip, bool ok)
{
    Lock a(authMutex);
    LoginAttempt *slot = nullptr;
    for (LoginAttempt &at : attempts)
        if (at.ip == ip)
            slot = &at;
    if (ok)
    {
        if (slot)
            *slot = {0, 0, 0};
        return;
    }
    if (!slot)
    {
        slot = &attempts[0];
        for (LoginAttempt &at : attempts)
            if (at.ip == 0 || at.fails < slot->fails)
                slot = &at;
        *slot = {ip, 0, 0};
    }
    if (slot->fails >= MAX_LOGIN_FAILS && (long)(slot->lockUntil - millis()) <= 0)
        slot->fails = 0;
    if (++slot->fails >= MAX_LOGIN_FAILS)
        slot->lockUntil = millis() + LOGIN_LOCKOUT_MS;
}

String sessionCookie(const String &token, bool clear)
{
    String c = String(SESSION_COOKIE) + "=" + (clear ? "" : token) + "; Path=/; HttpOnly; SameSite=Strict";
    c += clear ? "; Max-Age=0" : "; Max-Age=" + String(SESSION_MAX_MS / 1000UL);
    return c;
}

void resetPasswordToDefault()
{
    Lock a(authMutex);
    setPasswordLocked(DEFAULT_ADMIN_PASSWORD, true);
    clearSessionsLocked();
    memset(attempts, 0, sizeof(attempts));
}

void serialCommandTick()
{
    static String buf;
    while (Serial.available())
    {
        char c = (char)Serial.read();
        if (c == '\r')
            continue;
        if (c != '\n')
        {
            if (buf.length() < 64)
                buf += c;
            continue;
        }
        String cmd = buf;
        buf = "";
        cmd.trim();
        if (cmd == "reset-password")
        {
            resetPasswordToDefault();
            Serial.println("Password admin dikembalikan ke bawaan. Semua sesi login diakhiri.");
        }
        else if (cmd == "versi" || cmd == "version")
            Serial.println("Firmware " FW_VERSION);
        else if (cmd.length())
            Serial.println("Perintah tersedia: reset-password, versi");
    }
}
