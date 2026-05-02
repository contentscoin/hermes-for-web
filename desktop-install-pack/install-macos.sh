#!/usr/bin/env bash
set -euo pipefail

YES=0
PORT=8788
REPO_URL="https://github.com/reallygood83/hermes-for-web.git"
INSTALL_DIR="$HOME/.hermes/webui/workspace/hermes-for-web"
APP_NAME="Hermes CEO Console"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes|-y) YES=1; shift ;;
    --port) PORT="${2:-8788}"; shift 2 ;;
    --repo) REPO_URL="${2:-$REPO_URL}"; shift 2 ;;
    --dir) INSTALL_DIR="${2:-$INSTALL_DIR}"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 2 ;;
  esac
done

say_step(){ printf '\n==> %s\n' "$1"; }
need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1"; exit 1; }; }

say_step "Prerequisites"
need git
need python3
if ! command -v hermes >/dev/null 2>&1; then
  echo "Hermes CLI not found. Installing Hermes Agent via official installer..."
  curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
else
  echo "Hermes CLI found: $(command -v hermes)"
  hermes update || true
fi

say_step "Clone/update Hermes for Web"
mkdir -p "$(dirname "$INSTALL_DIR")"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  git -C "$INSTALL_DIR" pull --ff-only || true
else
  git clone "$REPO_URL" "$INSTALL_DIR"
fi
chmod +x "$INSTALL_DIR/start.sh" || true

say_step "Create launcher script"
mkdir -p "$HOME/.hermes/bin"
cat > "$HOME/.hermes/bin/hermes-ceo-console" <<EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$INSTALL_DIR"
./start.sh "$PORT"
EOF
chmod +x "$HOME/.hermes/bin/hermes-ceo-console"

say_step "Create macOS .app launcher"
APP_DIR="$HOME/Applications/$APP_NAME.app"
mkdir -p "$APP_DIR/Contents/MacOS"
cat > "$APP_DIR/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleExecutable</key><string>launcher</string>
  <key>CFBundleIdentifier</key><string>com.fmg.hermes-ceo-console</string>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundlePackageType</key><string>APPL</string>
</dict></plist>
PLIST
cat > "$APP_DIR/Contents/MacOS/launcher" <<EOF
#!/usr/bin/env bash
open "http://127.0.0.1:$PORT" || true
osascript -e 'display notification "Hermes CEO Console is starting on localhost:$PORT" with title "Hermes"' || true
cd "$INSTALL_DIR"
./start.sh "$PORT"
EOF
chmod +x "$APP_DIR/Contents/MacOS/launcher"

say_step "Integration reminders"
cat <<'TXT'
Telegram: run/check Hermes Agent Telegram integration; do not paste tokens into shared files.
Codex CLI: run `codex login` if not already authenticated.
Paperclip: set PAPERCLIP_WEB_URL for the live WebUI tab, plus PAPERCLIP_BASE_URL and PAPERCLIP_DEFAULT_COMPANY for MCP/API work.
TXT

say_step "Start WebUI"
"$HOME/.hermes/bin/hermes-ceo-console" >/tmp/hermes-ceo-console.log 2>&1 &
sleep 2
curl -fsS "http://127.0.0.1:$PORT/health" || { echo "Health check failed; see /tmp/hermes-ceo-console.log"; exit 1; }
open "http://127.0.0.1:$PORT" || true

echo "Done. App: $APP_DIR"
echo "URL: http://127.0.0.1:$PORT"
