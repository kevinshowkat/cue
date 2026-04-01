#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/desktop"
TAURI_DIR="$DESKTOP_DIR/src-tauri"
DMG_DIR="$TAURI_DIR/target/release/bundle/dmg"
VERIFY_QUEUE_SCRIPT="$ROOT_DIR/scripts/rewrite_verification_queue.mjs"

checksum_cmd() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1"
    return
  fi
  shasum -a 256 "$1"
}

echo "[release-check] rewrite verification queue"
node "$VERIFY_QUEUE_SCRIPT" run --group release-check

echo "[release-check] desktop tests"
(
  cd "$DESKTOP_DIR"
  npm test
)

echo "[release-check] canvas_app.js syntax"
node --check "$DESKTOP_DIR/src/canvas_app.js"

echo "[release-check] frontend build"
(
  cd "$DESKTOP_DIR"
  npm run build
)

echo "[release-check] rust check"
(
  cd "$TAURI_DIR"
  cargo check
)

echo "[release-check] tauri dmg build"
(
  cd "$DESKTOP_DIR"
  npm run tauri build
)

echo "[release-check] dmg artifacts"
find "$DMG_DIR" -maxdepth 1 -type f -name '*.dmg' | sort | while IFS= read -r artifact; do
  [ -n "$artifact" ] || continue
  checksum_cmd "$artifact"
done
