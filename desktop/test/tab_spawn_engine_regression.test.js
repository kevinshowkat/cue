import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const activationRuntimePath = join(here, "..", "src", "app", "tab_activation_runtime.js");
const activationRuntimeSource = readFileSync(activationRuntimePath, "utf8");

function extractFunctionSourceFromSource(source, name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  assert.notEqual(start, undefined, `Could not find function ${name}`);
  const signatureStart = source.indexOf("(", start);
  assert.notEqual(signatureStart, -1, `Could not find signature for ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth === 0 && char === "{") {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `Could not find body for ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract function ${name}`);
}

function loadAttachActiveTabRuntimeHarness({ runDir = "/runs/tab-a", ptySpawned = true } = {}) {
  const attachSource = extractFunctionSourceFromSource(activationRuntimeSource, "attachActiveTabRuntime");
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
    "const els = { timelineDock: null };",
    "const record = (name) => (...args) => { calls.push({ name, args }); };",
    "const setRunInfo = record('setRunInfo');",
    "const setTip = record('setTip');",
    "const setDirectorText = record('setDirectorText');",
    "const syncSessionToolsFromRegistry = record('syncSessionToolsFromRegistry');",
    "const renderCreateToolPreview = record('renderCreateToolPreview');",
    "const renderCustomToolDock = record('renderCustomToolDock');",
    "const renderSelectionMeta = record('renderSelectionMeta');",
    "const renderFilmstrip = record('renderFilmstrip');",
    "const renderTimeline = record('renderTimeline');",
    "function chooseSpawnNodes() { calls.push({ name: 'chooseSpawnNodes', args: [] }); renderQuickActions(); }",
    "const renderQuickActions = record('renderQuickActions');",
    "const renderSessionApiCallsReadout = record('renderSessionApiCallsReadout');",
    "const updateEmptyCanvasHint = record('updateEmptyCanvasHint');",
    "const syncIntentModeClass = record('syncIntentModeClass');",
    "const syncJuggernautShellState = record('syncJuggernautShellState');",
    "const applyRuntimeChromeVisibility = record('applyRuntimeChromeVisibility');",
    "const renderMotherMoodStatus = record('renderMotherMoodStatus');",
    "function syncTimelineDockVisibility() { calls.push({ name: 'syncTimelineDockVisibility', args: [] }); return Boolean(state.timelineOpen); }",
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
