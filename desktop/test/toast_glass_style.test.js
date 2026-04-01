import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "src", "index.html"), "utf8");
const css = readFileSync(join(here, "..", "src", "styles.css"), "utf8");
const app = readFileSync(join(here, "..", "src", "canvas_app.js"), "utf8");

test("system log tray is bottom-affixed and rendered as an icon-only badge", () => {
  assert.match(html, /id="spawnbar"[\s\S]*id="toast"[^>]*data-state="hidden"/);
  assert.match(css, /\.toast\s*\{[\s\S]*width:\s*calc\(var\(--jg-system-strip-height\)\s*\+\s*4px\)/);
  assert.match(css, /\.toast\s*\{[\s\S]*height:\s*calc\(var\(--jg-system-strip-height\)\s*\+\s*4px\)/);
  assert.match(css, /\.toast\s*\{[\s\S]*backdrop-filter:\s*blur\(24px\)\s+saturate\(1\.14\)/);
  assert.match(css, /\.toast\s*\{[\s\S]*cursor:\s*help/);
  assert.match(css, /\.toast\s+\.toast-icon\s*\{/);
  assert.match(css, /\.toast\[data-kind="info"\]\s+\.toast-icon::before/);
  assert.match(css, /\.toast\[data-kind="tip"\]\s+\.toast-icon::before/);
  assert.match(css, /\.toast\[data-kind="error"\]\s+\.toast-icon::before/);
  assert.match(css, /\.toast\[data-kind="tip"\]\s*\{/);
  assert.match(css, /\.toast\[data-kind="error"\]\s*\{/);
  assert.match(css, /\.toast\[data-state="visible"\]\s*\{/);
});

test("showToast continues to drive the single runtime toast element by message, kind, and visibility state", () => {
  assert.match(app, /function showToast\(message, kind = "info", timeoutMs = 2400\) \{/);
  assert.match(app, /const icon = document\.createElement\("span"\);/);
  assert.match(app, /icon\.className = "toast-icon";/);
  assert.match(app, /const label = document\.createElement\("span"\);/);
  assert.match(app, /label\.className = "sr-only";/);
  assert.match(app, /label\.textContent = nextMessage;/);
  assert.match(app, /els\.toast\.replaceChildren\(icon, label\);/);
  assert.match(app, /els\.toast\.dataset\.kind = kind;/);
  assert.match(app, /els\.toast\.dataset\.state = "visible";/);
  assert.match(app, /els\.toast\.setAttribute\("aria-label", nextMessage\);/);
  assert.match(app, /els\.toast\.title = nextMessage;/);
  assert.match(app, /els\.toast\.dataset\.state = "refreshing";/);
  assert.match(app, /function hideToast\(\{ immediate = false \} = \{\}\) \{/);
});
