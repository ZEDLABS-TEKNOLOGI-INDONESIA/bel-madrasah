package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var secureCookie = os.Getenv("BEL_TLS") == "1"

func handleLogin(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		if getSession(r) != nil {
			http.Redirect(w, r, "/", http.StatusSeeOther)
			return
		}
		http.ServeFile(w, r, filepath.Join(staticDir, "login.html"))

	case http.MethodPost:
		ip := clientIP(r)
		if locked, remaining := isLoginLocked(ip); locked {
			mins := int(remaining.Minutes()) + 1
			jsonError(w,
				fmt.Sprintf("terlalu banyak percobaan gagal, coba lagi dalam %d menit", mins),
				http.StatusTooManyRequests)
			return
		}

		var body struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			jsonError(w, "request tidak valid", http.StatusBadRequest)
			return
		}
		body.Username = strings.TrimSpace(body.Username)

		user, err := loadUser()
		if err != nil {
			jsonError(w, "gagal memuat data user", http.StatusInternalServerError)
			return
		}
		if body.Username != user.Username || !verifyPassword(user.PasswordHash, body.Password) {
			recordLoginFailure(ip)
			jsonError(w, "username atau password salah", http.StatusUnauthorized)
			return
		}

		resetLoginFailures(ip)
		token, err := createSession(body.Username)
		if err != nil {
			jsonError(w, "gagal membuat sesi", http.StatusInternalServerError)
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name:     cookieName,
			Value:    token,
			Path:     "/",
			HttpOnly: true,
			Secure:   secureCookie,
			SameSite: http.SameSiteLaxMode,
			Expires:  time.Now().Add(sessionTimeout),
		})
		jsonOK(w, map[string]string{"message": "login berhasil"})

	default:
		methodNotAllowed(w)
	}
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(cookieName); err == nil {
		deleteSession(c.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secureCookie,
		Expires:  time.Unix(0, 0),
	})
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

func handleChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "request tidak valid", http.StatusBadRequest)
		return
	}
	if len(body.NewPassword) < 8 {
		jsonError(w, "password baru minimal 8 karakter", http.StatusBadRequest)
		return
	}
	user, err := loadUser()
	if err != nil {
		jsonError(w, "gagal memuat data user", http.StatusInternalServerError)
		return
	}
	if !verifyPassword(user.PasswordHash, body.OldPassword) {
		jsonError(w, "password lama salah", http.StatusUnauthorized)
		return
	}
	hash, err := hashPassword(body.NewPassword)
	if err != nil {
		jsonError(w, "gagal mengenkripsi password", http.StatusInternalServerError)
		return
	}
	user.PasswordHash = hash
	if err := saveUser(user); err != nil {
		jsonError(w, "gagal menyimpan password", http.StatusInternalServerError)
		return
	}
	logMsg("password administrator diubah")
	jsonOK(w, map[string]string{"message": "password berhasil diubah"})
}
