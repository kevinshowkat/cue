import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(here, "..");
const app = readFileSync(join(desktopRoot, "src", "canvas_app.js"), "utf8");
const ensureRunChunk = app.slice(app.indexOf("async function ensureRun() {"), app.indexOf("async function createRun() {"));
const ensureEngineSpawnedChunk = app.slice(
  app.indexOf("async function ensureEngineSpawned({ reason = \"engine\" } = {}) {"),
  app.indexOf("function allowVisionDescribe() {")
);
const attachActiveTabRuntimeChunk = app.slice(
  app.indexOf("async function attachActiveTabRuntime({ spawnEngine: shouldSpawnEngine = false, reason = \"tab_activate\" } = {}) {"),
  app.indexOf("async function activateTab(")
);

test("ensureRun provisions the current blank tab instead of always creating another tab", () => {
  assert.equal(ensureRunChunk.includes("const activeTabId = String(state.activeTabId || \"\").trim();"), true);
  assert.equal(ensureRunChunk.includes("const activeTab = activeTabId ? tabbedSessions.getTab(activeTabId) : null;"), true);
  assert.equal(ensureRunChunk.includes("if (!activeTabId || !activeTab) {"), true);
  assert.equal(ensureRunChunk.includes("await createRun();"), true);
  assert.equal(ensureRunChunk.includes("const payload = await invoke(\"create_run_dir\");"), true);
  assert.equal(ensureRunChunk.includes("tabId: activeTabId,"), true);
  assert.equal(ensureRunChunk.includes("runDir: payload.run_dir,"), true);
  assert.equal(ensureRunChunk.includes("eventsPath: payload.events_path,"), true);
  assert.equal(
    ensureRunChunk.includes("{ activate: true, index: tabbedSessions.tabsOrder.indexOf(activeTabId) }"),
    true
  );
  assert.equal(ensureRunChunk.includes("await syncActiveRunPtyBinding();"), true);
  assert.equal(ensureRunChunk.includes("startEventsPolling();"), true);
});

test("tab activation is lazy and validates engine binding before reusing a PTY", () => {
  assert.equal(
    attachActiveTabRuntimeChunk.includes(
      "async function attachActiveTabRuntime({ spawnEngine: shouldSpawnEngine = false, reason = \"tab_activate\" } = {}) {"
    ),
    true
  );
  assert.equal(attachActiveTabRuntimeChunk.includes("scheduleVisualPromptWrite();"), true);
  assert.equal(attachActiveTabRuntimeChunk.includes("if (shouldSpawnEngine && state.runDir) {"), true);
  assert.equal(attachActiveTabRuntimeChunk.includes("const ok = await ensureEngineSpawned({ reason });"), true);
  assert.equal(attachActiveTabRuntimeChunk.includes("await syncActiveRunPtyBinding();"), true);
  assert.equal(attachActiveTabRuntimeChunk.includes("startEventsPolling();"), true);
  assert.equal(
    ensureEngineSpawnedChunk.includes("if (await syncActiveRunPtyBinding()) {"),
    true
  );
  assert.equal(ensureEngineSpawnedChunk.includes("startEventsPolling();"), true);
  assert.equal(ensureEngineSpawnedChunk.includes("setStatus(\"Engine: connected\");"), true);
  assert.equal(ensureEngineSpawnedChunk.includes("await spawnEngine();"), true);
  assert.equal(ensureEngineSpawnedChunk.includes("if (state.ptySpawned) startEventsPolling();"), true);
});
