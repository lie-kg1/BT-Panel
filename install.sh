#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js 20 or newer is required." >&2
  exit 1
fi

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if (( node_major < 20 )); then
  echo "Error: Node.js 20 or newer is required; found $(node --version)." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required." >&2
  exit 1
fi

mkdir -p "$ROOT_DIR/data" "$ROOT_DIR/media" "$ROOT_DIR/profile" "$ROOT_DIR/Background"

if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

chmod +x "$ROOT_DIR/install.sh" "$ROOT_DIR/owner.sh"

if [ ! -f "$ROOT_DIR/data/users.json" ]; then
  printf '{"__version__":2,"users":[]}\n' > "$ROOT_DIR/data/users.json"
  chmod 600 "$ROOT_DIR/data/users.json"
fi

if [ ! -f "$ROOT_DIR/.env" ]; then
  cat <<'NOTICE'
Dependencies installed and runtime directories prepared.

Next steps:
  1. Run ./owner.sh to create or update the owner account.
  2. Start the panel with npm start.
  3. Open http://127.0.0.1:3000/
NOTICE
else
  echo "Dependencies installed and runtime directories prepared."
  echo "Run ./owner.sh if you need to create or update the owner account."
fi
