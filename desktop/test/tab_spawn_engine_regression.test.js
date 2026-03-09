import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

function extractFunctionSource(pattern, label) {
  const match = app.match(pattern);
  assert.ok(match, `${label} function not found`);
  return match[0].replace(/\n\nasync function\s+[\s\S]*$/, "").trim();
}

function loadAttachActiveTabRuntimeHarness({ runDir = "/runs/tab-a", ptySpawned = true } = {}) {
  const attachSource = extractFunctionSource(
    /async function attachActiveTabRuntime\([\s\S]*?\n\}\n\nasync function activateTab/,
    "attachActiveTabRuntime"
  );
  const harnessSource = [
    "const calls = [];",
    `const DEFAULT_TIP = ${JSON.stringify("Default tip")};`,
    `const state = ${JSON.stringify({
      activeTabId: "tab-a",
      runDir,
      ptySpawned,
      timelineOpen: false,
      lastTipText: "",
      lastDirectorText: "",
      lastDirectorMeta: null,
    })};`,
    "const els = { timelineOverlay: null };",
    "const record = (name) => (...args) => { calls.push({ name, args }); };",
    "const setRunInfo = record('setRunInfo');",
    "const setTip = record('setTip');",
    "const setDirectorText = record('setDirectorText');",
    "const syncSessionToolsFromRegistry = record('syncSessionToolsFromRegistry');",
    "const renderCreateToolPreview = record('renderCreateToolPreview');",
    "const renderCustomToolDock = record('renderCustomToolDock');",
    "const renderSelectionMeta = record('renderSelectionMeta');",
    "const renderFilmstrip = record('renderFilmstrip');",
    "function chooseSpawnNodes() { calls.push({ name: 'chooseSpawnNodes', args: [] }); renderQuickActions(); }",
    "const renderQuickActions = record('renderQuickActions');",
    "const renderSessionApiCallsReadout = record('renderSessionApiCallsReadout');",
    "const updateEmptyCanvasHint = record('updateEmptyCanvasHint');",
    "const syncIntentModeClass = record('syncIntentModeClass');",
    "const syncJuggernautShellState = record('syncJuggernautShellState');",
    "const applyRuntimeChromeVisibility = record('applyRuntimeChromeVisibility');",
    "const renderMotherMoodStatus = record('renderMotherMoodStatus');",
    "const requestRender = record('requestRender');",
    "const scheduleVisualPromptWrite = record('scheduleVisualPromptWrite');",
    "let tabHydrationToken = 1;",
    "function currentTabHydrationMatches(normalizedTabId, hydrationToken) { return normalizedTabId === String(state.activeTabId || normalizedTabId) && hydrationToken === tabHydrationToken; }",
    "async function spawnEngine() { calls.push({ name: 'spawnEngine', args: [] }); state.ptySpawned = true; }",
    "async function ensureEngineSpawned(options = {}) { calls.push({ name: 'ensureEngineSpawned', args: [options] }); await spawnEngine(); return true; }",
    "async function syncActiveRunPtyBinding() { calls.push({ name: 'syncActiveRunPtyBinding', args: [] }); return Boolean(state.ptySpawned); }",
    "function startEventsPolling() { calls.push({ name: 'startEventsPolling', args: [] }); }",
    "const setStatus = record('setStatus');",
    attachSource,
    "return {",
    "  calls,",
    "  async run(options) {",
    "    return attachActiveTabRuntime(options);",
    "  },",
    "};",
  ].join("\n");
  return new Function(harnessSource)();
}

test("attachActiveTabRuntime keeps the public spawnEngine option while calling the real engine helper", async () => {
  const harness = loadAttachActiveTabRuntimeHarness();
  await harness.run({ spawnEngine: true, reason: "new_run_tab" });

  assert.equal(
    harness.calls.filter((entry) => entry.name === "renderQuickActions").length,
    1,
    "expected attachActiveTabRuntime to render quick actions once during the spawn attach pass"
  );
  assert.equal(
    harness.calls.filter((entry) => entry.name === "ensureEngineSpawned").length,
    1,
    "expected the runtime attach path to call ensureEngineSpawned() once"
  );
  assert.equal(
    harness.calls.filter((entry) => entry.name === "spawnEngine").length,
    1,
    "expected the real spawnEngine() helper to still run once under ensureEngineSpawned()"
  );
  assert.equal(
    harness.calls.filter((entry) => entry.name === "startEventsPolling").length,
    0,
    "expected attachActiveTabRuntime to leave polling orchestration to ensureEngineSpawned() on spawn"
  );
  assert.deepEqual(
    harness.calls.find((entry) => entry.name === "applyRuntimeChromeVisibility")?.args[0],
    { source: "new_run_tab" }
  );

  const skipHarness = loadAttachActiveTabRuntimeHarness();
  await skipHarness.run({ spawnEngine: false, reason: "open_run_tab" });

  assert.equal(
    skipHarness.calls.filter((entry) => entry.name === "renderQuickActions").length,
    1,
    "expected attachActiveTabRuntime to render quick actions once during the reuse attach pass"
  );
  assert.equal(
    skipHarness.calls.filter((entry) => entry.name === "ensureEngineSpawned").length,
    0,
    "expected ensureEngineSpawned() to stay skipped when callers pass false"
  );
  assert.equal(
    skipHarness.calls.filter((entry) => entry.name === "spawnEngine").length,
    0,
    "expected spawnEngine() to stay skipped when callers pass false"
  );
  assert.equal(
    skipHarness.calls.filter((entry) => entry.name === "syncActiveRunPtyBinding").length,
    1,
    "expected attachActiveTabRuntime to validate the current PTY binding when spawn is skipped"
  );
  assert.equal(
    skipHarness.calls.filter((entry) => entry.name === "startEventsPolling").length,
    1,
    "expected polling to resume for the active tab even when engine spawn is skipped"
  );
  assert.equal(
    skipHarness.calls.filter((entry) => entry.name === "renderQuickActions").length,
    1,
    "expected quick actions to render once through chooseSpawnNodes during the reuse attach pass"
  );
});
