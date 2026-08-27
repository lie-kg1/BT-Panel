#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USERS_FILE="${OWNER_USERS_FILE:-$ROOT_DIR/data/users.json}"

if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  RED=$'\033[0;31m'
  GREEN=$'\033[0;32m'
  YELLOW=$'\033[0;33m'
  BLUE=$'\033[0;34m'
  CYAN=$'\033[0;36m'
  RESET=$'\033[0m'
else
  RED=""
  GREEN=""
  YELLOW=""
  BLUE=""
  CYAN=""
  RESET=""
fi

INFO_ICON='ℹ️'
SUCCESS_ICON='✅'
ERROR_ICON='❌'

info() { printf '%b%s %s%b\n' "$CYAN" "$INFO_ICON" "$*" "$RESET"; }
success() { printf '%b%s %s%b\n' "$GREEN" "$SUCCESS_ICON" "$*" "$RESET"; }
error() { printf '%b%s %s%b\n' "$RED" "$ERROR_ICON" "$*" "$RESET" >&2; }

usage() {
  cat <<'USAGE'
Usage: ./owner.sh

Create or update the BT Panel owner account.

Environment overrides:
  OWNER_USERNAME   Owner username; default: admin
  OWNER_EMAIL      Owner email; default: admin@gmail.com
  OWNER_PASSWORD   Owner password; if omitted, prompt securely
  OWNER_USERS_FILE JSON users file; default: ./data/users.json
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -gt 0 ]]; then
  usage >&2
  exit 2
fi

runtime_ready=false
if command -v node >/dev/null 2>&1; then
  node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
  if (( node_major >= 20 )) && [[ -d "$ROOT_DIR/node_modules/bcryptjs" ]]; then
    runtime_ready=true
  fi
fi

if [[ "$runtime_ready" != true ]]; then
  info "🔧 Node.js 20+ or project dependencies are missing; running ./install.sh..."
  bash "$ROOT_DIR/install.sh"
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( node_major < 20 )); then
  error "Error: Node.js 20 or newer is required; found $(node --version)."
  exit 1
fi

if [[ ! -d "$ROOT_DIR/node_modules/bcryptjs" ]]; then
  error "Error: dependencies are not installed after running install.sh."
  exit 1
fi

username="${OWNER_USERNAME:-admin}"
if [[ -z "${OWNER_USERNAME+x}" && -t 0 ]]; then
  read -r -p "${CYAN}👤 Owner username [admin]: ${RESET}" entered_username
  username="${entered_username:-$username}"
fi

password="${OWNER_PASSWORD:-}"
if [[ -z "$password" && -t 0 ]]; then
  read -r -s -p "${CYAN}🔐 Owner password (minimum 8 characters): ${RESET}" password
  printf '\n'
  read -r -s -p "${CYAN}🔐 Confirm owner password: ${RESET}" password_confirmation
  printf '\n'
  [[ "$password" == "$password_confirmation" ]] || {
    error "Error: passwords do not match."
    exit 1
  }
fi

email="${OWNER_EMAIL:-admin@gmail.com}"
if [[ -z "${OWNER_EMAIL+x}" && -t 0 ]]; then
  read -r -p "${CYAN}✉️ Owner email [admin@gmail.com]: ${RESET}" entered_email
  email="${entered_email:-$email}"
fi

if [[ ! "$username" =~ ^[A-Za-z0-9._-]{3,32}$ ]]; then
  error "Error: username must be 3–32 characters using letters, numbers, dots, dashes, or underscores."
  exit 1
fi

if [[ ${#password} -lt 8 ]]; then
  error "Error: password must be at least 8 characters. Set OWNER_PASSWORD or enter it interactively."
  exit 1
fi

export OWNER_USERNAME="$username"
export OWNER_PASSWORD="$password"
export OWNER_EMAIL="$email"
export OWNER_USERS_FILE="$USERS_FILE"
export OWNER_ROOT_DIR="$ROOT_DIR"

node <<'NODE'
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const bcrypt = require(path.join(process.env.OWNER_ROOT_DIR, "node_modules", "bcryptjs"));

const usersFile = process.env.OWNER_USERS_FILE;
const normalize = (value) => String(value || "").trim().toLowerCase();
let data = { __version__: 2, users: [] };

if (fs.existsSync(usersFile)) {
  try {
    data = JSON.parse(fs.readFileSync(usersFile, "utf8"));
  } catch (error) {
    console.error(`\x1b[31m❌ Error: could not parse ${usersFile}: ${error.message}\x1b[0m`);
    process.exit(1);
  }
}
if (!Array.isArray(data.users)) data.users = [];

const username = process.env.OWNER_USERNAME.trim();
const password = process.env.OWNER_PASSWORD;
const email = process.env.OWNER_EMAIL.trim();
const existing = data.users.find((user) => normalize(user.username) === normalize(username));
const now = Date.now();

if (existing) {
  existing.username = username;
  existing.passwordHash = bcrypt.hashSync(password, 10);
  existing.role = "owner";
  existing.status = "active";
  if (email) existing.email = email;
} else {
  data.users.push({
    id: crypto.randomUUID(),
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    role: "owner",
    status: "active",
    createdAt: now,
    lastLogin: null,
    profilePic: "",
    email,
    bio: "",
  });
}

const tempFile = `${usersFile}.tmp-${process.pid}`;
fs.mkdirSync(path.dirname(usersFile), { recursive: true });
fs.writeFileSync(tempFile, `${JSON.stringify({ __version__: 2, users: data.users }, null, 2)}\n`, { mode: 0o600 });
fs.chmodSync(tempFile, 0o600);
fs.renameSync(tempFile, usersFile);
console.log(`\x1b[32m✅ Owner account ${existing ? "updated" : "created"}: ${username}\x1b[0m`);
NODE
