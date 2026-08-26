#!/usr/bin/env bash
set -euo pipefail

# This file can run from a cloned BT Panel directory or directly from:
# bash -c "$(curl -fsSL https://raw.githubusercontent.com/lie-kg1/BT-Panel/refs/heads/main/menu.sh)"

PANEL_DIR="$PWD"
PROJECT_RAW_BASE="${PROJECT_RAW_BASE:-https://raw.githubusercontent.com/lie-kg1/BT-Panel/refs/heads/main}"
BOT_RAW_BASE="${BOT_RAW_BASE:-https://raw.githubusercontent.com/lie-kg1/1.0-Bot-lxc/refs/heads/main/discord%20bot%20lxc}"

usage() {
  cat <<'USAGE'
Usage: ./menu.sh

Interactive BT Panel and Discord Bot LXC launcher.

Main menu:
  1  Install Node.js, dependencies, and bot runtime
  2  Create bot configuration
  3  Apply VPS defaults
  4  Open 24/7 manager
  5  Uninstall bot components
  6  Open or install BT Panel
  7  Exit

Run this script from the BT Panel directory when using options 1, 2, or 6.
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

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required. Install curl and run this menu again." >&2
  exit 1
fi

color() {
  local code="$1"
  shift
  printf '\033[%sm%s\033[0m\n' "$code" "$*"
}

pause() {
  read -r -p "Press Enter to continue..." _ || true
}

run_local_or_remote_project_script() {
  local script_name="$1"
  local local_script="$PANEL_DIR/$script_name"
  local temporary_script

  if [[ -f "$local_script" ]]; then
    bash "$local_script"
    return
  fi

  temporary_script="$(mktemp)"
  trap 'rm -f "$temporary_script"' RETURN
  color '1;36' "Downloading BT Panel $script_name..."
  curl -fsSL "$PROJECT_RAW_BASE/$script_name" -o "$temporary_script"
  bash "$temporary_script"
  rm -f "$temporary_script"
  trap - RETURN
}

run_bot_script() {
  local script_name="$1"
  local temporary_script

  temporary_script="$(mktemp)"
  trap 'rm -f "$temporary_script"' RETURN
  color '1;36' "Downloading bot script: $script_name"
  curl -fsSL "$BOT_RAW_BASE/$script_name" -o "$temporary_script"
  bash "$temporary_script"
  rm -f "$temporary_script"
  trap - RETURN
}

ensure_panel_directory() {
  if [[ -f "$PANEL_DIR/package.json" && -f "$PANEL_DIR/app.js" ]]; then
    return 0
  fi

  color '1;33' "BT Panel files were not found in the current directory: $PANEL_DIR"
  color '1;36' 'Change into the cloned BT Panel directory and run menu.sh again.'
  return 1
}

prepare_panel_env() {
  local generated_secret
  if [[ -f "$PANEL_DIR/.env" || ! -f "$PANEL_DIR/.env.example" ]]; then
    return 0
  fi

  cp "$PANEL_DIR/.env.example" "$PANEL_DIR/.env"
  generated_secret="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
  if grep -q '^SESSION_SECRET=' "$PANEL_DIR/.env"; then
    sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$generated_secret/" "$PANEL_DIR/.env"
  else
    printf '\nSESSION_SECRET=%s\n' "$generated_secret" >> "$PANEL_DIR/.env"
  fi
  chmod 600 "$PANEL_DIR/.env"
  color '1;32' 'Created .env with a generated SESSION_SECRET.'
}

launch_botpanel() {
  ensure_panel_directory || return 1
  cd "$PANEL_DIR"

  if [[ ! -d node_modules ]]; then
    run_local_or_remote_project_script install.sh
  fi

  if ! command -v node >/dev/null 2>&1; then
    color '1;31' 'Node.js is still unavailable after installation.'
    return 1
  fi

  prepare_panel_env
  color '1;32' "Starting BT Panel from $PANEL_DIR"
  color '1;36' 'Open http://<this-server-ip>:3000 in your browser once the server is running.'
  exec npm start
}

run_install() {
  if [[ -f "$PANEL_DIR/package.json" && -f "$PANEL_DIR/app.js" ]]; then
    run_local_or_remote_project_script install.sh
  else
    run_bot_script 'install.sh'
  fi
}

run_owner_setup() {
  ensure_panel_directory || return 1
  run_local_or_remote_project_script owner.sh
}

run_uninstall() {
  color '1;31' 'Warning: uninstall may remove bot components and their configuration.'
  read -r -p "Type UNINSTALL to continue: " confirmation
  if [[ "$confirmation" != 'UNINSTALL' ]]; then
    color '1;33' 'Uninstall cancelled.'
    return 0
  fi
  run_bot_script 'uninstall.sh'
}

show_menu() {
  printf '\n'
  color '1;36' '────────────────────────────────────────'
  color '1;32' '          DISCORD BOT LXC / BT PANEL'
  color '1;36' '────────────────────────────────────────'
  printf '\033[1;33m1.\033[0m Install Node.js and dependencies\n'
  printf '\033[1;33m2.\033[0m Create bot configuration\n'
  printf '\033[1;33m3.\033[0m VPS defaults\n'
  printf '\033[1;33m4.\033[0m 24/7 manager\n'
  printf '\033[1;33m5.\033[0m Uninstall bot components\n'
  printf '\033[1;33m6.\033[0m BT Panel\n'
  printf '\033[1;33m7.\033[0m Exit\n'
  color '1;36' '────────────────────────────────────────'
}

while true; do
  show_menu
  read -r -p 'Enter your choice [1-7]: ' choice || {
    printf '\nExiting.\n'
    exit 0
  }

  case "$choice" in
    1)
      color '1;32' 'Running installation...'
      run_install
      pause
      ;;
    2)
      color '1;32' 'Creating bot configuration...'
      run_bot_script 'createbot.sh'
      pause
      ;;
    3)
      color '1;32' 'Applying VPS defaults...'
      run_bot_script 'vpsdefaults.sh'
      pause
      ;;
    4)
      color '1;32' 'Opening 24/7 manager...'
      run_bot_script '247.sh'
      pause
      ;;
    5)
      run_uninstall
      pause
      ;;
    6)
      launch_botpanel
      pause
      ;;
    7)
      color '1;31' 'Exiting...'
      exit 0
      ;;
    *)
      color '1;31' 'Invalid option. Choose a number from 1 to 7.'
      sleep 1
      ;;
  esac
done
