#!/bin/bash
# Installs HUSK for the current user: no admin password, and macOS shows no "unknown developer" warning.
#
#   curl -fsSL https://raw.githubusercontent.com/VladB-evs/husk/main/install.sh | bash
#
# Why there is no warning: macOS puts a "downloaded from the internet" mark on files that a web browser, AirDrop
# or Mail saves. curl does not set that mark, so the app opens like any app you built yourself.
# The script is short and open: read it before you run it.
#
# Settings (environment variables):
#   HUSK_BASE_URL     where HUSK-arm64.zip, HUSK-x64.zip and SHA256SUMS are
#   HUSK_INSTALL_DIR  where HUSK.app goes (default: ~/Applications)
#   HUSK_NO_OPEN=1    do not open the app when the install is done
set -euo pipefail

BASE_URL="${HUSK_BASE_URL:-https://github.com/VladB-evs/husk/releases/latest/download}"
INSTALL_DIR="${HUSK_INSTALL_DIR:-$HOME/Applications}"

fail() { echo "Error: $*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || fail "HUSK is a macOS app."

case "$(uname -m)" in
  arm64) ARCH=arm64 ;;
  x86_64) ARCH=x64 ;;
  *) fail "Unknown processor type: $(uname -m)" ;;
esac

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading HUSK ($ARCH)..."
curl -fL --progress-bar -o "$TMP/HUSK-$ARCH.zip" "$BASE_URL/HUSK-$ARCH.zip" || fail "Download failed: $BASE_URL/HUSK-$ARCH.zip"

# Check that the file arrived whole
if curl -fsSL -o "$TMP/SHA256SUMS" "$BASE_URL/SHA256SUMS"; then
  (cd "$TMP" && grep " HUSK-$ARCH.zip\$" SHA256SUMS | shasum -a 256 -c - >/dev/null) || fail "The download is damaged (checksum does not match). Try again."
else
  echo "Note: no checksum file found, skipping the check."
fi

# Quit HUSK if it is open, so the old copy can be replaced
if pgrep -x HUSK >/dev/null 2>&1; then
  echo "Closing HUSK..."
  osascript -e 'tell application "HUSK" to quit' >/dev/null 2>&1 || true
  sleep 2
fi

ditto -x -k "$TMP/HUSK-$ARCH.zip" "$TMP/out"
[ -d "$TMP/out/HUSK.app" ] || fail "The download does not contain HUSK.app."

mkdir -p "$INSTALL_DIR"
rm -rf "$INSTALL_DIR/HUSK.app"
mv "$TMP/out/HUSK.app" "$INSTALL_DIR/HUSK.app"

# Remove any "downloaded from the internet" mark, in case a browser or a proxy added one
xattr -cr "$INSTALL_DIR/HUSK.app" 2>/dev/null || true
codesign --verify --deep --strict "$INSTALL_DIR/HUSK.app" || fail "The app signature is not valid."

echo "HUSK is installed in $INSTALL_DIR"
echo "Your documents are in ~/Documents/HUSK (they are not changed by an update)."
if [ "${HUSK_NO_OPEN:-0}" != "1" ]; then
  open "$INSTALL_DIR/HUSK.app"
fi
