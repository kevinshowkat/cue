import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

test("canvas app carries app-level tab state and runtime helpers", () => {
  assert.match(app, /tabsOrder:\s*\[\]/);
  assert.match(app, /tabsById:\s*new Map\(\)/);
  assert.match(app, /activeTabId:\s*null/);
  assert.match(app, /createTabbedSessionsStore/);
  assert.match(app, /function createFreshTabSession\(/);
  assert.match(app, /function captureActiveTabSession\(/);
  assert.match(app, /function bindTabSessionToState\(/);
  assert.match(app, /async function activateTab\(/);
  assert.match(app, /async function closeTab\(/);
  assert.match(app, /function stopEventsPolling\(/);
});

test("canvas app exposes the tab bridge contract for UI consumers", () => {
  assert.match(app, /window\[TABBED_SESSIONS_BRIDGE_KEY\]\s*=\s*bridge/);
  assert.match(app, /function listTabs\(/);
  assert.match(app, /function subscribeTabs\(/);
  assert.match(app, /createNewRunTab\(\)\s*{\s*return createRun\(\);/);
  assert.match(app, /openRunTab\(\)\s*{\s*return openExistingRun\(\);/);
  assert.match(app, /activateTab,/);
  assert.match(app, /closeTab,/);
  assert.match(app, /TABBED_SESSIONS_CHANGED_EVENT/);
});
