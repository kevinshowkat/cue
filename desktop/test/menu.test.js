import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, "..", "src", "index.html");
const cssPath = join(here, "..", "src", "styles.css");
const appPath = join(here, "..", "src", "canvas_app.js");
const html = readFileSync(htmlPath, "utf8");
const css = readFileSync(cssPath, "utf8");
const app = readFileSync(appPath, "utf8");

test("Menu: gear toggle + popover exist and include core actions", () => {
  assert.match(html, /id=\"app-menu-toggle\"/);
  assert.match(html, /id=\"app-menu\"/);

  for (const id of ["new-run", "open-run", "save-session", "close-session", "import", "export", "settings-toggle"]) {
    assert.match(html, new RegExp(`id=\\"${id}\\"`));
  }
});

test("Menu: export menu exposes receipt-backed PSD and raster formats without surfacing AI or FIG yet", () => {
  for (const formatId of [
    "juggernaut-export-format-psd",
    "juggernaut-export-format-png",
    "juggernaut-export-format-jpg",
    "juggernaut-export-format-webp",
    "juggernaut-export-format-tiff",
  ]) {
    assert.match(html, new RegExp(`id=\\"${formatId}\\"`));
  }
  assert.doesNotMatch(html, /data-export-format=\"ai\"/);
  assert.doesNotMatch(html, /data-export-format=\"fig\"/);
});

test("Menu: dropped shell toggles stay out of the visible menu surface", () => {
  assert.doesNotMatch(html, /id=\"app-menu\"[\s\S]*id=\"auto-accept-suggested-ability-toggle\"/);
});

test("Menu: runtime declutter toggles are not injected into the baseline app menu", () => {
  assert.match(app, /function ensureRuntimeChromeMenu\(\)/);
  assert.doesNotMatch(app, /label:\s*"GUIDE"/);
  assert.doesNotMatch(app, /label:\s*"DEBUG"/);
  assert.match(html, /id=\"settings-drawer\"[\s\S]*id=\"runtime-pin-assistant-toggle\"[\s\S]*id=\"runtime-diagnostics-toggle\"/);
});

test("Menu: menu items close the popover via data-menu-close", () => {
  for (const id of ["new-run", "open-run", "save-session", "close-session", "import", "export", "settings-toggle"]) {
    assert.match(html, new RegExp(`id=\\"${id}\\"[^>]*data-menu-close=\\"1\\"`));
  }
});

test("Reel mode is buried in Settings admin tools (not top-level UI)", () => {
  assert.doesNotMatch(html, /id=\"reel-mode-toggle\"/);
  assert.doesNotMatch(html, /id=\"reel-size-button\"/);
  assert.match(html, /id=\"settings-drawer\"[\s\S]*key-status-title\">Admin/);
  assert.match(html, /id=\"reel-admin-toggle\"/);
});

test("Layout: legacy inspector/right panel is removed (canvas expands)", () => {
  assert.doesNotMatch(html, /class=\"inspector\"/);
  assert.doesNotMatch(html, /<aside\b/);
});

test("Menu: z-index is above canvas and other overlays", () => {
  assert.match(css, /\.brand-strip\s*\{[\s\S]*z-index:\s*1000/);
  assert.match(css, /\.app-menu\s*\{[\s\S]*z-index:\s*1100/);
});
