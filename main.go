package main

import (
	"embed"
	"html/template"
	"log"
	"net/http"
	"os"
)

//go:embed templates/* static/*
var content embed.FS

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	tmpl := template.Must(template.ParseFS(content, "templates/*.html"))

	http.Handle("/static/", http.FileServer(http.FS(content)))
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		tmpl.ExecuteTemplate(w, "index.html", map[string]string{
			"Title":   "BT Panel",
			"Version": "1.0.0",
		})
	})
	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	addr := ":" + port
	log.Printf("[BT Panel] Starting on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
