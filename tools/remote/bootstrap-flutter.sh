#!/usr/bin/env bash
set -euo pipefail
FLUTTER_VERSION="${RESEARCH_FLUTTER_VERSION:-3.47.0}"
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
INSTALL_ROOT="${RESEARCH_FLUTTER_HOME:-$DATA_HOME/research-workspace/flutter/$FLUTTER_VERSION}"
REPOSITORY="${RESEARCH_FLUTTER_REPOSITORY:-https://github.com/flutter/flutter.git}"
ACTION="${1:-install}"

flutter_bin(){ printf '%s/bin/flutter\n' "$INSTALL_ROOT"; }
already_installed(){ [[ -x "$(flutter_bin)" ]]; }

install_flutter(){
  if already_installed; then
    echo "Flutter $FLUTTER_VERSION already installed: $INSTALL_ROOT"
    "$(flutter_bin)" --version
    return 0
  fi
  command -v git >/dev/null 2>&1 || { echo "git is required to bootstrap Flutter without sudo." >&2; exit 1; }
  mkdir -p "$(dirname "$INSTALL_ROOT")"
  temp="${INSTALL_ROOT}.tmp.$$";rm -rf "$temp"
  echo "Installing Flutter $FLUTTER_VERSION in user space..."
  git clone --depth 1 --branch "$FLUTTER_VERSION" "$REPOSITORY" "$temp"
  mv "$temp" "$INSTALL_ROOT"
  "$(flutter_bin)" config --no-analytics >/dev/null 2>&1 || true
  "$(flutter_bin)" precache --web
  "$(flutter_bin)" --version
}

case "$ACTION" in
  install) install_flutter ;;
  path) flutter_bin ;;
  status) if already_installed;then echo "READY $(flutter_bin)";else echo "MISSING $(flutter_bin)";exit 1;fi ;;
  *) echo "Usage: bash tools/remote/bootstrap-flutter.sh [install|path|status]" >&2;exit 2 ;;
esac
