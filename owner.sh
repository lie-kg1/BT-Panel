#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USERS_FILE="${OWNER_USERS_FILE:-$ROOT_DIR/data/users.json}"

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
  echo "Node.js 20+ or project dependencies are missing; running ./install.sh..."
  bash "$ROOT_DIR/install.sh"
fi

node_major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( node_major < 20 )); then
  echo "Error: Node.js 20 or newer is required; found $(node --version)." >&2
  exit 1
fi

if [[ ! -d "$ROOT_DIR/node_modules/bcryptjs" ]]; then
  echo "Error: dependencies are not installed after running install.sh." >&2
  exit 1
fi

username="${OWNER_USERNAME:-admin}"
if [[ -z "${OWNER_USERNAME+x}" && -t 0 ]]; then
  read -r -p "Owner username [admin]: " entered_username
  username="${entered_username:-$username}"
fi

password="${OWNER_PASSWORD:-}"
if [[ -z "$password" && -t 0 ]]; then
  read -r -s -p "Owner password (minimum 8 characters): " password
  printf '\n'
  read -r -s -p "Confirm owner password: " password_confirmation
  printf '\n'
  [[ "$password" == "$password_confirmation" ]] || {
    echo "Error: passwords do not match." >&2
    exit 1
  }
fi

email="${OWNER_EMAIL:-admin@gmail.com}"
if [[ -z "${OWNER_EMAIL+x}" && -t 0 ]]; then
  read -r -p "Owner email [admin@gmail.com]: " entered_email
  email="${entered_email:-$email}"
fi

if [[ ! "$username" =~ ^[A-Za-z0-9._-]{3,32}$ ]]; then
  echo "Error: username must be 3–32 characters using letters, numbers, dots, dashes, or underscores." >&2
  exit 1
fi

if [[ ${#password} -lt 8 ]]; then
  echo "Error: password must be at least 8 characters. Set OWNER_PASSWORD or enter it interactively." >&2
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
    console.error(`Error: could not parse ${usersFile}: ${error.message}`);
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
console.log(`Owner account ${existing ? "updated" : "created"}: ${username}`);
NODE
