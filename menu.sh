#!/usr/bin/env bash
set -euo pipefail

# When sourced through `bash -c "$(curl ...)"`, BASH_SOURCE may be unset.
# In that case, use the caller's current directory as the project directory.
SCRIPT_SOURCE="${BASH_SOURCE[0]-}"
if [[ -n "$SCRIPT_SOURCE" && -f "$SCRIPT_SOURCE" ]]; then
  ROOT_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
else
  ROOT_DIR="$PWD"
fi
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage: ./menu.sh

Open the BT Panel interactive launcher. Run it from the BT Panel project
directory. Use the numbered menu to install, configure, validate, build,
or start the panel.
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

require_project() {
  if [[ ! -f "$ROOT_DIR/package.json" || ! -f "$ROOT_DIR/install.sh" ]]; then
    printf 'Error: BT Panel project files were not found in %s.\n' "$ROOT_DIR" >&2
    printf 'Clone the repository, cd into its directory, and run menu.sh again.\n' >&2
    return 1
  fi
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
      require_project || { pause; continue; }
      bash "$ROOT_DIR/install.sh"
      pause
      ;;
    2)
      require_project || { pause; continue; }
      bash "$ROOT_DIR/owner.sh"
      pause
      ;;
    3)
      require_project || { pause; continue; }
      npm run build
      pause
      ;;
    4)
      require_project || { pause; continue; }
      npm run check
      pause
      ;;
    5)
      require_project || { pause; continue; }
      exec npm start
      ;;
    6)
      require_project || { pause; continue; }
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
