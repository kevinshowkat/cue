import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "src", "index.html"), "utf8");
const app = readFileSync(join(here, "..", "src", "canvas_app.js"), "utf8");

test("Juggernaut shell chrome exposes selection status, export button, and rail root", () => {
  assert.match(html, /class=\"juggernaut-shell-chrome\"/);
  assert.match(html, /id=\"juggernaut-selection-status\"/);
  assert.match(html, /id=\"juggernaut-export-psd\"/);
  assert.match(html, /id=\"action-grid\"[^>]*aria-label=\"Juggernaut left rail\"/);
  assert.match(html, /id=\"drop-hint\"[\s\S]*Drop images or click to upload/);
});

test("Juggernaut shell bridge exposes tool/export registration and request methods", () => {
  assert.match(app, /window\.__JUGGERNAUT_SHELL__\s*=\s*\{/);
  assert.match(app, /registerToolInvoker\(fn\)/);
  assert.match(app, /registerPsdExportHandler\(fn\)/);
  assert.match(app, /requestToolInvocation\(toolKey,\s*meta\s*=\s*\{\}\)/);
  assert.match(app, /requestPsdExport\(meta\s*=\s*\{\}\)/);
  assert.match(app, /getRuntimeVisibility\(\)/);
  assert.match(app, /setRuntimeVisibility\(next\s*=\s*\{\}\)/);
  assert.match(app, /getCanvasSnapshot\(\)/);
});

test("Juggernaut shell bridge emits integration events for tools and PSD export", () => {
  assert.match(app, /juggernaut:shell-ready/);
  assert.match(app, /juggernaut:runtime-visibility-changed/);
  assert.match(app, /juggernaut:tool-requested/);
  assert.match(app, /juggernaut:export-psd-requested/);
  assert.match(app, /juggernaut:apply-tool/);
  assert.match(app, /juggernaut:export-psd/);
});
