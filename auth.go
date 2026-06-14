package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const (
	usersFile       = dataDir + "/users.json"
	sessionTimeout  = 8 * time.Hour
	cookieName      = "bel_session"
	maxLoginFails   = 5
	loginLockout    = 15 * time.Minute
	bcryptCost      = bcrypt.DefaultCost
	sessionCleanInt = 30 * time.Minute
)

type User struct {
	Username     string `json:"username"`
	PasswordHash string `json:"password_hash"`
}

type Session struct {
	Username  string
	ExpiresAt time.Time
}

type loginAttempt struct {
	count     int
	lockUntil time.Time
}

var (
	sessions   = make(map[string]*Session)
	sessionsMu sync.RWMutex

	loginAttempts   = make(map[string]*loginAttempt)
	loginAttemptsMu sync.Mutex
)

func hashPassword(p string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(p), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(h), nil
}

func verifyPassword(hash, p string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(p)) == nil
}

func initAuth() error {
	if _, err := os.Stat(usersFile); os.IsNotExist(err) {
		hash, err := hashPassword("admin123")
		if err != nil {
			return err
		}
		u := User{Username: "admin", PasswordHash: hash}
		data, err := json.MarshalIndent(u, "", "  ")
		if err != nil {
			return err
		}
		if err := os.WriteFile(usersFile, data, 0600); err != nil {
			return err
		}
		logMsg("akun admin default dibuat — username: admin | password: admin123")
		logMsg("segera ganti password melalui halaman pengaturan")
	}
	go cleanupSessions()
	return nil
}

func cleanupSessions() {
	ticker := time.NewTicker(sessionCleanInt)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now()
		sessionsMu.Lock()
		for token, s := range sessions {
			if now.After(s.ExpiresAt) {
				delete(sessions, token)
			}
		}
		sessionsMu.Unlock()
		loginAttemptsMu.Lock()
		for ip, a := range loginAttempts {
			if now.After(a.lockUntil) && a.count < maxLoginFails {
				delete(loginAttempts, ip)
			}
		}
		loginAttemptsMu.Unlock()
	}
}

func loadUser() (*User, error) {
	data, err := os.ReadFile(usersFile)
	if err != nil {
		return nil, err
	}
	var u User
	if err := json.Unmarshal(data, &u); err != nil {
		return nil, err
	}
	return &u, nil
}

func saveUser(u *User) error {
	data, err := json.MarshalIndent(u, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(usersFile, data, 0600)
}

func generateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func createSession(username string) (string, error) {
	token, err := generateToken()
	if err != nil {
		return "", err
	}
	sessionsMu.Lock()
	sessions[token] = &Session{Username: username, ExpiresAt: time.Now().Add(sessionTimeout)}
	sessionsMu.Unlock()
	return token, nil
}

func getSession(r *http.Request) *Session {
	c, err := r.Cookie(cookieName)
	if err != nil {
		return nil
	}
	sessionsMu.RLock()
	s, ok := sessions[c.Value]
	sessionsMu.RUnlock()
	if !ok || time.Now().After(s.ExpiresAt) {
		return nil
	}
	return s
}

func clientIP(r *http.Request) string {
	if xf := r.Header.Get("X-Forwarded-For"); xf != "" {
		parts := strings.Split(xf, ",")
		return strings.TrimSpace(parts[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func isLoginLocked(ip string) (bool, time.Duration) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	a, ok := loginAttempts[ip]
	if !ok {
		return false, 0
	}
	if a.count >= maxLoginFails && time.Now().Before(a.lockUntil) {
		return true, time.Until(a.lockUntil)
	}
	return false, 0
}

func recordLoginFailure(ip string) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	a, ok := loginAttempts[ip]
	if !ok {
		a = &loginAttempt{}
		loginAttempts[ip] = a
	}
	a.count++
	if a.count >= maxLoginFails {
		a.lockUntil = time.Now().Add(loginLockout)
	}
}

func resetLoginFailures(ip string) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	delete(loginAttempts, ip)
}

func isJSONRequest(r *http.Request) bool {
	return strings.Contains(r.Header.Get("Accept"), "application/json") ||
		strings.Contains(r.Header.Get("Content-Type"), "application/json")
}

func requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if getSession(r) == nil {
			if isJSONRequest(r) {
				jsonError(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}
		next(w, r)
	}
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	fmt.Fprintf(w, `{"error":%q}`, msg)
}

func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
