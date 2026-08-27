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
  read -r -p "${CYAN}⏎ Press Enter to continue...${RESET}" _ || true
}

require_project() {
  if [[ ! -f "$ROOT_DIR/package.json" || ! -f "$ROOT_DIR/install.sh" ]]; then
    error "Error: BT Panel project files were not found in $ROOT_DIR."
    info "Clone the repository, cd into its directory, and run menu.sh again."
    return 1
  fi
}

show_menu() {
  printf '\n%b%s%b\n' "$BLUE" '========================================' "$RESET"
  printf '%b%s%b\n' "$GREEN" '              🚀 BT PANEL MENU' "$RESET"
  printf '%b%s%b\n' "$BLUE" '========================================' "$RESET"
  printf '%b%s%b\n' "$CYAN" '🔹 1) Install or update dependencies' "$RESET"
  printf '%b%s%b\n' "$CYAN" '🔹 2) Create or update owner account' "$RESET"
  printf '%b%s%b\n' "$CYAN" '🔹 3) Build project' "$RESET"
  printf '%b%s%b\n' "$CYAN" '🔹 4) Run project checks' "$RESET"
  printf '%b%s%b\n' "$CYAN" '🔹 5) Start production server' "$RESET"
  printf '%b%s%b\n' "$CYAN" '🔹 6) Start development server' "$RESET"
  printf '%b%s%b\n' "$CYAN" '🔹 7) Install Pterodactyl Panel' "$RESET"
  printf '%b%s%b\n' "$CYAN" '🔹 8) Install Wings node' "$RESET"
  printf '%b%s%b\n' "$CYAN" '🔹 9) Install Pterodactyl Panel + Wings' "$RESET"
  printf '%b%s%b\n' "$YELLOW" '🔹 10) Exit' "$RESET"
  printf '%b%s%b\n' "$BLUE" '========================================' "$RESET"
}

while true; do
  show_menu
  read -r -p "${CYAN}👉 Choose an option [1-10]: ${RESET}" choice || {
    printf '\n'
    info 'Exiting.'
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
      require_project || { pause; continue; }
      PTERODACTYL_INSTALL_CONFIRM=YES bash "$ROOT_DIR/install.sh" --pterodactyl-panel
      pause
      ;;
    8)
      require_project || { pause; continue; }
      WINGS_INSTALL_CONFIRM=YES bash "$ROOT_DIR/install.sh" --wings
      pause
      ;;
    9)
      require_project || { pause; continue; }
      PTERODACTYL_INSTALL_CONFIRM=YES WINGS_INSTALL_CONFIRM=YES bash "$ROOT_DIR/install.sh" --pterodactyl
      pause
      ;;
    10)
      success 'Goodbye.'
      exit 0
      ;;
    *)
      error "Invalid option: $choice"
      ;;
  esac
done
