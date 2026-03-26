import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "src", "index.html"), "utf8");
const css = readFileSync(join(here, "..", "src", "styles.css"), "utf8");
const app = readFileSync(join(here, "..", "src", "canvas_app.js"), "utf8");

test("system log tray is bottom-affixed and constrained to a single visible row", () => {
  assert.match(html, /id="spawnbar"[\s\S]*id="toast"[^>]*data-state="hidden"/);
  assert.match(css, /\.toast\s*\{[\s\S]*--toast-accent:\s*rgba\(100,\s*210,\s*255,\s*0\.92\)/);
  assert.match(css, /\.toast\s*\{[\s\S]*bottom:\s*14px/);
  assert.match(css, /\.toast\s*\{[\s\S]*height:\s*44px/);
  assert.match(css, /\.toast\s*\{[\s\S]*backdrop-filter:\s*blur\(24px\)\s+saturate\(1\.3\)/);
  assert.match(css, /\.toast\s*\{[\s\S]*white-space:\s*nowrap[\s\S]*overflow:\s*hidden[\s\S]*text-overflow:\s*ellipsis/s);
  assert.match(css, /\.toast::before\s*\{[\s\S]*width:\s*8px[\s\S]*height:\s*8px/s);
  assert.match(css, /\.toast\[data-kind="info"\]\s*\{/);
  assert.match(css, /\.toast\[data-kind="tip"\]\s*\{/);
  assert.match(css, /\.toast\[data-kind="error"\]\s*\{/);
  assert.match(css, /\.toast\[data-state="visible"\]\s*\{/);
});

test("showToast continues to drive the single runtime toast element by message, kind, and visibility state", () => {
  assert.match(app, /function showToast\(message, kind = "info", timeoutMs = 2400\) \{/);
  assert.match(app, /els\.toast\.textContent = String\(message \|\| ""\);/);
  assert.match(app, /els\.toast\.dataset\.kind = kind;/);
  assert.match(app, /els\.toast\.dataset\.state = "visible";/);
  assert.match(app, /els\.toast\.dataset\.state = "refreshing";/);
  assert.match(app, /function hideToast\(\{ immediate = false \} = \{\}\) \{/);
});
