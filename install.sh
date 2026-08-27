#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIN_NODE_MAJOR="${MIN_NODE_MAJOR:-20}"

cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage: ./install.sh [--check]

Install or verify Node.js 20+, npm dependencies, and BT Panel runtime directories.

  --check   Verify the runtime without installing or changing anything.
  -h, --help
USAGE
}

fail() {
  echo "Error: $*" >&2
  exit 1
}

run_root() {
  if (( EUID == 0 )); then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    fail "root privileges are required to install Node.js. Run this script as root or install sudo."
  fi
}

node_major() {
  node -p 'Number(process.versions.node.split(".")[0])'
}

node_is_ready() {
  command -v node >/dev/null 2>&1 || return 1
  (( $(node_major) >= MIN_NODE_MAJOR )) || return 1
  command -v npm >/dev/null 2>&1
}

install_nodejs_debian() {
  command -v apt-get >/dev/null 2>&1 || fail "automatic Node.js installation currently supports Debian/Ubuntu hosts with apt-get. Install Node.js ${MIN_NODE_MAJOR}+ manually, then rerun this script."
  command -v dpkg >/dev/null 2>&1 || fail "dpkg is required for the Debian/Ubuntu Node.js installer."
  command -v curl >/dev/null 2>&1 || run_root apt-get update -y && run_root apt-get install -y curl ca-certificates gnupg

  echo "Installing Node.js ${MIN_NODE_MAJOR}.x from the NodeSource Debian repository..."
  run_root apt-get update -y
  run_root apt-get install -y ca-certificates curl gnupg
  run_root install -d -m 0755 /etc/apt/keyrings

  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor \
    | run_root tee /etc/apt/keyrings/nodesource.gpg >/dev/null

  local architecture
  architecture="$(dpkg --print-architecture)"
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_%s.x nodistro main\n' \
    "$architecture" "$MIN_NODE_MAJOR" \
    | run_root tee /etc/apt/sources.list.d/nodesource.list >/dev/null

  run_root apt-get update -y
  run_root apt-get install -y nodejs
}

ensure_nodejs() {
  if node_is_ready; then
    echo "Node.js $(node --version) and npm $(npm --version) are available."
    return
  fi

  if command -v node >/dev/null 2>&1; then
    echo "Node.js $(node --version) is too old; Node.js ${MIN_NODE_MAJOR}+ is required."
  else
    echo "Node.js is not installed; Node.js ${MIN_NODE_MAJOR}+ is required."
  fi

  install_nodejs_debian
  node_is_ready || fail "Node.js ${MIN_NODE_MAJOR}+ and npm were not available after installation."
  echo "Installed Node.js $(node --version) and npm $(npm --version)."
}

verify_runtime() {
  node_is_ready || fail "Node.js ${MIN_NODE_MAJOR}+ and npm are required."
  echo "Runtime check passed: Node.js $(node --version), npm $(npm --version)."
}

case "${1:-}" in
  "") ;;
  --check)
    verify_runtime
    exit 0
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

ensure_nodejs
verify_runtime

mkdir -p "$ROOT_DIR/data" "$ROOT_DIR/media" "$ROOT_DIR/profile" "$ROOT_DIR/Background"

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

chmod +x "$ROOT_DIR/install.sh" "$ROOT_DIR/owner.sh" "$ROOT_DIR/menu.sh"

if [[ ! -f "$ROOT_DIR/data/users.json" ]]; then
  printf '{"__version__":2,"users":[]}\n' > "$ROOT_DIR/data/users.json"
  chmod 600 "$ROOT_DIR/data/users.json"
fi

cat <<'NOTICE'

BT Panel installation completed.

Next steps:
  1. Run ./owner.sh to create or update the owner account.
  2. Run ./menu.sh for the interactive launcher, or run npm start directly.
  3. Open http://127.0.0.1:3000/

Set a strong SESSION_SECRET in .env before using the panel outside local development.
NOTICE
