#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage: PTERODACTYL_INSTALL_CONFIRM=YES sudo ./install.sh --pterodactyl-panel

Installs the documented Pterodactyl Panel dependencies and downloads the
latest Panel release to /var/www/pterodactyl. Review the official guide,
configure the database, .env, queues, and web server manually afterward.
USAGE
  exit 0
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "Error: run this installer as root or with sudo." >&2
  exit 1
fi

if [[ "${PTERODACTYL_INSTALL_CONFIRM:-}" != "YES" ]]; then
  cat >&2 <<'NOTICE'
This will install the official Pterodactyl Panel dependencies and release files
on this Linux host. It expects a fresh server and may install PHP, MariaDB,
Redis, Nginx, Composer, and other system packages. It will not install Wings
or create a database unless you explicitly continue.

Set PTERODACTYL_INSTALL_CONFIRM=YES to continue, or run with --help.
NOTICE
  exit 2
fi

if [[ "${1:-}" != "" ]]; then
  echo "Error: unknown option: ${1}" >&2
  exit 2
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "Error: this installer currently supports Debian/Ubuntu hosts with apt-get." >&2
  exit 1
fi

apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl git tar unzip nginx mariadb-server redis-server \
  php8.3 php8.3-cli php8.3-fpm php8.3-gd php8.3-mysql php8.3-mbstring \
  php8.3-bcmath php8.3-xml php8.3-curl php8.3-zip

if ! command -v composer >/dev/null 2>&1; then
  curl -fsSL https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi

install -d -m 0755 /var/www/pterodactyl
cd /var/www/pterodactyl
curl -fL -o panel.tar.gz https://github.com/pterodactyl/panel/releases/latest/download/panel.tar.gz
tar -xzvf panel.tar.gz
rm -f panel.tar.gz
chmod -R 755 storage bootstrap/cache
chown -R www-data:www-data /var/www/pterodactyl

systemctl enable --now mariadb redis-server php8.3-fpm nginx

cat <<'NEXT'
Pterodactyl Panel files and dependencies are installed.
Next, follow the official Panel guide to create the database, copy .env,
run composer install, generate APP_KEY, migrate/seed, create the first user,
and configure Nginx/TLS:
https://pterodactyl.io/panel/1.0/getting_started.html

Wings is a separate node control plane. Install it only after the Panel is
configured and a node has been created in the Panel.
NEXT
