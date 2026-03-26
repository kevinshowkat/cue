import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

test("screenshot metadata persists through session capture, fork, and timeline restore paths", () => {
  assert.match(app, /function createFreshTabSession\(\{ runDir = null,\s*eventsPath = null \} = \{\}\) \{[\s\S]*screenshotPolishMeta:\s*null,/);
  assert.match(app, /next\.screenshotPolishMeta = normalizeScreenshotPolishMetadata\(state\.screenshotPolishMeta\);/);
  assert.match(app, /state\.screenshotPolishMeta = normalizeScreenshotPolishMetadata\(current\.screenshotPolishMeta\);/);
  assert.match(
    app,
    /next\.screenshotPolishMeta = normalizeScreenshotPolishMetadata\(cloned\.screenshotPolishMeta \|\| source\.screenshotPolishMeta\);/
  );
  assert.match(app, /screenshotPolishMeta:\s*normalizeScreenshotPolishMetadata\(current\.screenshotPolishMeta\),/);
  assert.match(
    app,
    /restoredSession\.screenshotPolishMeta = normalizeScreenshotPolishMetadata\(\s*current\.screenshotPolishMeta \|\| restoredSession\.screenshotPolishMeta\s*\);/
  );
  assert.match(
    app,
    /restoredSession\.screenshotPolishMeta = normalizeScreenshotPolishMetadata\(\s*state\.screenshotPolishMeta \|\| restoredSession\.screenshotPolishMeta\s*\);/
  );
});

test("screenshot metadata editor is wired into the shell and tab subtitle summary", () => {
  assert.match(app, /function ensureScreenshotPolishMetadataUi\(\) \{/);
  assert.match(app, /button\.textContent = "Metadata";/);
  assert.match(app, /title\.textContent = "Screenshot Metadata";/);
  assert.match(app, /platformLabel\.textContent = "Platform";/);
  assert.match(app, /screenLabel\.textContent = "Screen";/);
  assert.match(app, /function openScreenshotPolishMetadataPanel\(\) \{/);
  assert.match(app, /const subtitle = screenshotPolishTabSubtitle\(screenshotPolishMeta\) \|\| runDir;/);
});
