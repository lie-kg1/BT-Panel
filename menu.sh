#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage: ./menu.sh

Open the BT Panel interactive launcher. Use the numbered menu to install,
configure, validate, build, or start the panel.
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

pause() {
  read -r -p "Press Enter to continue..." _ || true
}

show_menu() {
  printf '\n%s\n' '========================================'
  printf '%s\n' '              BT PANEL MENU'
  printf '%s\n' '========================================'
  printf '%s\n' '1) Install or update dependencies'
  printf '%s\n' '2) Create or update owner account'
  printf '%s\n' '3) Build project'
  printf '%s\n' '4) Run project checks'
  printf '%s\n' '5) Start production server'
  printf '%s\n' '6) Start development server'
  printf '%s\n' '7) Exit'
  printf '%s\n' '========================================'
}

while true; do
  show_menu
  read -r -p "Choose an option [1-7]: " choice || {
    printf '\nExiting.\n'
    exit 0
  }

  case "$choice" in
    1)
      bash "$ROOT_DIR/install.sh"
      pause
      ;;
    2)
      bash "$ROOT_DIR/owner.sh"
      pause
      ;;
    3)
      npm run build
      pause
      ;;
    4)
      npm run check
      pause
      ;;
    5)
      exec npm start
      ;;
    6)
      exec npm run dev
      ;;
    7)
      printf '%s\n' 'Goodbye.'
      exit 0
      ;;
    *)
      printf 'Invalid option: %s\n' "$choice" >&2
      ;;
  esac
done
