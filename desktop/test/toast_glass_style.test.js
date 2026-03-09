import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "..", "src", "styles.css"), "utf8");
const app = readFileSync(join(here, "..", "src", "canvas_app.js"), "utf8");

test("toast chrome uses the liquid-glass system treatment", () => {
  assert.match(css, /\.toast\s*\{[\s\S]*--toast-accent:\s*rgba\(100,\s*210,\s*255,\s*0\.92\)/);
  assert.match(css, /\.toast\s*\{[\s\S]*backdrop-filter:\s*blur\(24px\)\s+saturate\(1\.3\)/);
  assert.match(css, /\.toast::before\s*\{/);
  assert.match(css, /\.toast\[data-kind="info"\]\s*\{/);
  assert.match(css, /\.toast\[data-kind="tip"\]\s*\{/);
  assert.match(css, /\.toast\[data-kind="error"\]\s*\{/);
});

test("showToast continues to drive the single runtime toast element by message and kind", () => {
  assert.match(app, /function showToast\(message, kind = "info", timeoutMs = 2400\) \{/);
  assert.match(app, /els\.toast\.textContent = String\(message \|\| ""\);/);
  assert.match(app, /els\.toast\.dataset\.kind = kind;/);
});
