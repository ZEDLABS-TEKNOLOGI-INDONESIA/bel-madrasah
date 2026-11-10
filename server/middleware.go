package main

import (
	"net/http"
	"os"
	"strings"
)

func trustedOrigins() []string {
	scheme := "http"
	if os.Getenv("BEL_TLS") == "1" {
		scheme = "https"
	}

	if v := os.Getenv("BEL_ORIGINS"); v != "" {
		var origins []string
		for _, o := range strings.Split(v, ",") {
			o = strings.TrimSpace(o)
			if o == "" {
				continue
			}
			if !strings.Contains(o, "://") {
				o = scheme + "://" + o
			}
			origins = append(origins, o)
		}
		return origins
	}

	return []string{
		scheme + "://localhost:4321",
		scheme + "://localhost:3000",
		scheme + "://127.0.0.1:4321",
		scheme + "://0.0.0.0:4321",
	}
}

func corsMiddleware(allowed []string, next http.Handler) http.Handler {
	isAllowed := func(origin string) bool {
		for _, o := range allowed {
			if o == origin {
				return true
			}
		}
		return false
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && isAllowed(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept")
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func maxBodyMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 35<<20)
		next.ServeHTTP(w, r)
	})
}
