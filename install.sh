#!/bin/bash
set -e

# ============================================
# BT Panel Installer
# Builds Go app + Nginx + Cloudflare Tunnel
# Domain: panel.emplex.com
# ============================================

DOMAIN="panel.emplex.com"
APP_NAME="bt-panel"
APP_DIR="/opt/${APP_NAME}"
SERVICE_NAME="${APP_NAME}.service"
USER="btpanel"
GO_VERSION="1.23.0"

echo "========================================"
echo "  BT Panel Installer"
echo "  Domain: ${DOMAIN}"
echo "========================================"

# --- Detect OS ---
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "[!] Cannot detect OS. Exiting."
    exit 1
fi

echo "[*] Detected OS: ${OS}"

# --- Install system deps ---
echo "[*] Installing dependencies..."
install_deps() {
    if [[ "$OS" == "ubuntu" || "$OS" == "debian" ]]; then
        apt-get update -qq
        apt-get install -y -qq git curl wget nginx certbot python3-certbot-nginx build-essential
    elif [[ "$OS" == "centos" || "$OS" == "rhel" || "$OS" == "rocky" || "$OS" == "almalinux" || "$OS" == "fedora" ]]; then
        dnf install -y git curl wget nginx certbot python3-certbot-nginx gcc
    else
        echo "[!] Unsupported OS: ${OS}"
        exit 1
    fi
}
install_deps

# --- Install Go if not present ---
if ! command -v go &>/dev/null; then
    echo "[*] Installing Go ${GO_VERSION}..."
    wget -q "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" -O /tmp/go.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf /tmp/go.tar.gz
    rm /tmp/go.tar.gz
    export PATH=$PATH:/usr/local/go/bin
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile
fi

go version

# --- Create app user ---
if ! id "$USER" &>/dev/null; then
    useradd -r -s /bin/false -d "$APP_DIR" "$USER"
    echo "[*] Created user: ${USER}"
fi

# --- Prepare app directory ---
echo "[*] Setting up app directory..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/templates"
mkdir -p "$APP_DIR/static"

# --- Write source files ---
echo "[*] Writing application files..."

cat > "$APP_DIR/main.go" <<'GOCODE'
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
GOCODE

cat > "$APP_DIR/templates/index.html" <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{.Title}}</title>
    <link rel="stylesheet" href="/static/style.css">
</head>
<body>
    <div class="panel">
        <h1>{{.Title}}</h1>
        <p class="version">Version {{.Version}}</p>
        <div class="status">
            <span class="dot"></span>
            <span>Running</span>
        </div>
    </div>
</body>
</html>
HTML

cat > "$APP_DIR/static/style.css" <<'CSS'
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    background: #0a0a1a;
    color: #e0e0ff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex; justify-content: center; align-items: center; height: 100vh;
}
.panel {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 48px 64px;
    backdrop-filter: blur(20px);
    text-align: center;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
h1 {
    font-size: 2rem; font-weight: 600; margin-bottom: 8px;
    background: linear-gradient(135deg, #a78bfa, #60a5fa);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.version { color: #6b7280; font-size: 0.9rem; margin-bottom: 20px; }
.status {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(74,222,128,0.1); color: #4ade80;
    padding: 8px 16px; border-radius: 999px;
    font-size: 0.85rem; font-weight: 500;
}
.dot {
    width: 8px; height: 8px; background: #4ade80; border-radius: 50%;
    animation: pulse 2s infinite;
}
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
CSS

# --- Build ---
echo "[*] Building Go application..."
cd "$APP_DIR"
export PATH=$PATH:/usr/local/go/bin
go mod init "${APP_NAME}" 2>/dev/null || true
go mod tidy
go build -o "${APP_NAME}" main.go
chown -R "${USER}:${USER}" "$APP_DIR"
chmod +x "${APP_NAME}"
echo "[*] Build complete: ${APP_DIR}/${APP_NAME}"

# --- Systemd service ---
echo "[*] Creating systemd service..."
cat > "/etc/systemd/system/${SERVICE_NAME}" <<EOF
[Unit]
Description=BT Panel
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${APP_DIR}
ExecStart=${APP_DIR}/${APP_NAME}
Restart=always
RestartSec=5
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

# --- Nginx config ---
echo "[*] Configuring Nginx..."
cat > "/etc/nginx/sites-available/${APP_NAME}" <<'NGINX'
server {
    listen 80;
    server_name panel.emplex.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /health {
        access_log off;
        proxy_pass http://127.0.0.1:3000/health;
    }
}
NGINX

rm -f "/etc/nginx/sites-enabled/${APP_NAME}"
ln -s "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
nginx -t && systemctl reload nginx

# --- Cloudflare Tunnel ---
echo "[*] Setting up Cloudflare Tunnel..."
CLOUDFLARED_BIN="/usr/local/bin/cloudflared"
if [ ! -f "$CLOUDFLARED_BIN" ]; then
    echo "[*] Installing cloudflared..."
    curl -fsSL -o "$CLOUDFLARED_BIN" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
    chmod +x "$CLOUDFLARED_BIN"
fi

CF_DIR="/root/.cloudflared"
mkdir -p "$CF_DIR"

cat > "$CF_DIR/config.yml" <<'CFCONFIG'
# Cloudflare Tunnel config for panel.emplex.com
# Run: cloudflared tunnel login
# Then: cloudflared tunnel create bt-panel
# Then: cloudflared tunnel route dns <UUID> panel.emplex.com
# Replace <TUNNEL_UUID> below and run: cloudflared tunnel run <TUNNEL_UUID>
#
# tunnel: <TUNNEL_UUID>
# credentials-file: /root/.cloudflared/<TUNNEL_UUID>.json
#
# ingress:
#   - hostname: panel.emplex.com
#     service: http://localhost:3000
#   - service: http_status:404
CFCONFIG

# --- Summary ---
echo ""
echo "========================================"
echo "  Installation Complete!"
echo "========================================"
echo ""
echo "  App:      ${APP_DIR}"
echo "  Service:  systemctl status ${SERVICE_NAME}"
echo "  Local:    http://localhost:3000"
echo "  Nginx:    http://${DOMAIN}"
echo ""
echo "  Cloudflare Tunnel Setup:"
echo "  1. cloudflared tunnel login"
echo "  2. cloudflared tunnel create bt-panel"
echo "  3. cloudflared tunnel route dns <UUID> ${DOMAIN}"
echo "  4. Edit /root/.cloudflared/config.yml with your tunnel UUID"
echo "  5. cloudflared service install"
echo "  6. systemctl start cloudflared"
echo ""
echo "  Or use Cloudflare DNS Proxy:"
echo "  - Add A record: ${DOMAIN} -> $(curl -s ifconfig.me)"
echo "  - Enable orange cloud (proxy)"
echo "  - SSL/TLS -> Full (strict)"
echo "  - Always Use HTTPS -> ON"
echo ""
