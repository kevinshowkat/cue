import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "src", "index.html"), "utf8");
const css = readFileSync(join(here, "..", "src", "styles.css"), "utf8");
const tauriConfig = readFileSync(join(here, "..", "src-tauri", "tauri.conf.json"), "utf8");

test("startup boot overlay points at the local Desktop MP4 and gates reveal until boot finishes", () => {
  assert.match(html, /id="boot-video-overlay"/);
  assert.match(html, /id="boot-video-player"/);
  assert.match(html, /const LOCAL_BOOT_VIDEO_PATH = "\/Users\/mainframe\/Desktop\/load\.mp4";/);
  assert.match(html, /const LOCAL_BOOT_VIDEO_SESSION_KEY = "juggernaut\.localBootVideoShown";/);
  assert.match(html, /const BOOT_VIDEO_MAX_HOLD_MS = 20000;/);
  assert.match(html, /const SPLASH_WINDOW_SIZE = 620;/);
  assert.match(html, /const APP_WINDOW_WIDTH = 1400;/);
  assert.match(html, /const APP_WINDOW_HEIGHT = 900;/);
  assert.match(html, /const bytes = await readBinaryFile\(LOCAL_BOOT_VIDEO_PATH\);/);
  assert.match(html, /bootVideoObjectUrl = URL\.createObjectURL\(new Blob\(\[bytes\], \{ type: "video\/mp4" \}\)\);/);
  assert.match(html, /await appWindow\.setSize\(new LogicalSize\(width, height\)\);/);
  assert.match(html, /await appWindow\.center\(\);/);
  assert.match(html, /await resizeWindow\(SPLASH_WINDOW_SIZE, SPLASH_WINDOW_SIZE\);/);
  assert.match(html, /await resizeWindow\(APP_WINDOW_WIDTH, APP_WINDOW_HEIGHT\);/);
  assert.match(html, /bootReady = true;/);
  assert.match(html, /bootVideoDone = true;/);
  assert.match(html, /let bootRevealStarted = false;/);
  assert.match(html, /if \(bootRevealStarted\) return;/);
  assert.match(html, /bootRevealStarted = true;/);
  assert.match(html, /enterSplashWindowMode\(\);/);
  assert.match(html, /maybeRevealApp\(\);/);
  assert.match(html, /hideBootOverlay\(\);/);
  assert.match(html, /if \(!bootVideoDone\) setBootStatus\("Preparing workspace…"\);\s*maybeRevealApp\(\);/);
  assert.match(tauriConfig, /"width": 620,/);
  assert.match(tauriConfig, /"height": 620,/);
  assert.match(tauriConfig, /"center": true,/);
});

test("startup boot overlay has fullscreen video treatment and fade-out dismissal", () => {
  assert.match(css, /\.boot-video-overlay\s*\{/);
  assert.match(css, /position: fixed;/);
  assert.match(css, /z-index: 20000;/);
  assert.match(css, /\.boot-video-overlay\.is-dismissed\s*\{/);
  assert.match(css, /\.boot-video-player\s*\{/);
  assert.match(css, /width: auto;/);
  assert.match(css, /height: auto;/);
  assert.match(css, /max-width: 100vw;/);
  assert.match(css, /max-height: 100vh;/);
  assert.match(css, /\.boot-video-copy\s*\{/);
});
