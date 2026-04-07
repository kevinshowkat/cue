import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createSessionTabRenameRuntime } from "../src/app/tab_rename_runtime.js";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(here, "..");
const app = readFileSync(join(desktopRoot, "src", "canvas_app.js"), "utf8");
const tabActivationRuntimeSource = readFileSync(join(desktopRoot, "src", "app", "tab_activation_runtime.js"), "utf8");
const tabLifecycleRuntimeSource = readFileSync(join(desktopRoot, "src", "app", "tab_lifecycle_runtime.js"), "utf8");
const bootShellSource = readFileSync(join(desktopRoot, "src", "app", "boot_shell.js"), "utf8");
const bootReadySource = readFileSync(join(desktopRoot, "src", "app", "boot_ready.js"), "utf8");
const engineRuntimeSource = readFileSync(join(desktopRoot, "src", "app", "engine_runtime.js"), "utf8");
const runProvisioningSource = readFileSync(join(desktopRoot, "src", "app", "run_provisioning.js"), "utf8");
const createRunSignature = "async function createRun({ announce = true, source = \"new_run\" } = {}) {";
const ensureBootShellTabChunk = extractFunctionSourceFromSource(tabLifecycleRuntimeSource, "ensureBootShellTab");
const ensureRunChunk = extractFunctionSourceFromSource(runProvisioningSource, "ensureRun");
const ensureEngineSpawnedChunk = extractFunctionSourceFromSource(engineRuntimeSource, "ensureEngineSpawned");
const spawnEngineChunk = extractFunctionSourceFromSource(engineRuntimeSource, "spawnEngine");
const suspendActiveTabRuntimeChunk = extractFunctionSourceFromSource(tabActivationRuntimeSource, "suspendActiveTabRuntimeForSwitch");
const bootChunk = app.slice(app.indexOf("async function boot() {"), app.indexOf("bindCommunicationReviewBootstrapBridge();"));

function extractFunctionSource(name) {
  return extractFunctionSourceFromSource(app, name);
}

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

function instantiateFunction(name, deps = {}) {
  const source = extractFunctionSource(name);
  const keys = Object.keys(deps);
  const values = Object.values(deps);
  return new Function(...keys, `return (${source});`)(...values);
}

test("ensureRun provisions the current blank tab instead of always creating another tab", () => {
  assert.match(app, /const canvasAppRunProvisioning = createCanvasAppRunProvisioning\(\{/);
  assert.match(app, /async function ensureRun\(\) \{\s*return canvasAppRunProvisioning\.ensureRun\(\);\s*\}/);
  assert.equal(ensureRunChunk.includes("const activeTabId = String(state.activeTabId || \"\").trim();"), true);
  assert.equal(ensureRunChunk.includes("const activeTab = activeTabId ? tabbedSessions.getTab(activeTabId) : null;"), true);
  assert.equal(ensureRunChunk.includes("if (!activeTabId || !activeTab) {"), true);
  assert.equal(ensureRunChunk.includes("await createRun();"), true);
  assert.equal(ensureRunChunk.includes("const payload = await invokeFn(\"create_run_dir\");"), true);
  assert.equal(ensureRunChunk.includes("tabId: activeTabId,"), true);
  assert.equal(ensureRunChunk.includes("runDir: payload.run_dir,"), true);
  assert.equal(ensureRunChunk.includes("eventsPath: payload.events_path,"), true);
  assert.equal(
    ensureRunChunk.includes("{ activate: true, index: tabbedSessions.tabsOrder.indexOf(activeTabId) }"),
    true
  );
  assert.equal(
    ensureRunChunk.includes("await activateTab(activeTabId, {") &&
      ensureRunChunk.includes('reason: "ensure_run_active_tab"') &&
      ensureRunChunk.includes("waitForHydration: true"),
    true
  );
  assert.equal(ensureRunChunk.includes("await syncActiveRunPtyBinding();"), false);
  assert.equal(ensureRunChunk.includes("startEventsPolling();"), false);
});

test("tab activation is lazy and validates engine binding before reusing a PTY", () => {
  const attachActiveTabRuntimeChunk = extractFunctionSourceFromSource(tabActivationRuntimeSource, "attachActiveTabRuntime");

  assert.equal(
    attachActiveTabRuntimeChunk.includes("spawnEngine: shouldSpawnEngine = false"),
    true
  );
  assert.equal(attachActiveTabRuntimeChunk.includes("engineFailureToast = true"), true);
  assert.equal(attachActiveTabRuntimeChunk.includes("tabId = state.activeTabId || null"), true);
  assert.equal(attachActiveTabRuntimeChunk.includes("hydrationToken = tabHydrationToken"), true);
  assert.equal(attachActiveTabRuntimeChunk.includes("scheduleVisualPromptWrite();"), false);
  assert.equal(attachActiveTabRuntimeChunk.includes("if (shouldSpawnEngine && state.runDir) {"), true);
  assert.equal(
    attachActiveTabRuntimeChunk.includes(
      "const ok = await ensureEngineSpawned({ reason, showToastOnFailure: engineFailureToast });"
    ),
    true
  );
  assert.equal(attachActiveTabRuntimeChunk.includes("await syncActiveRunPtyBinding({ useCache: true });"), true);
  assert.equal(attachActiveTabRuntimeChunk.includes("currentTabHydrationMatches(normalizedTabId, hydrationToken)"), true);
  assert.equal(attachActiveTabRuntimeChunk.includes("startEventsPolling();"), true);
  assert.match(app, /const canvasAppTabActivationRuntime = createCanvasAppTabActivationRuntime\(\{/);
  assert.match(app, /async function attachActiveTabRuntime\(\{/);
  assert.match(app, /return canvasAppTabActivationRuntime\.attachActiveTabRuntime\(\{/);
  assert.match(app, /async function activateTab\(tabId, \{ spawnEngine = false, reason = "tab_activate", engineFailureToast = true \} = \{\}\) \{\s*return canvasAppTabActivationRuntime\.activateTab\(/);
  assert.match(app, /const canvasAppEngineRuntime = createCanvasAppEngineRuntime\(\{/);
  assert.match(app, /const \{\s*syncActiveRunPtyBinding,\s*ensureEngineSpawned,\s*spawnEngine,\s*\} = canvasAppEngineRuntime;/);
  assert.equal(
    ensureEngineSpawnedChunk.includes("if (await syncActiveRunPtyBinding()) {"),
    true
  );
  assert.equal(ensureEngineSpawnedChunk.includes("startEventsPolling();"), true);
  assert.equal(ensureEngineSpawnedChunk.includes("setStatus(\"Engine: connected\");"), true);
  assert.equal(ensureEngineSpawnedChunk.includes("await spawnEngine();"), true);
  assert.equal(ensureEngineSpawnedChunk.includes("if (state.ptySpawned) startEventsPolling();"), true);
});

test("spawnEngine converges typed desktop session startup with bridge seeding", () => {
  assert.equal(engineRuntimeSource.includes("export function createCanvasAppEngineRuntime({"), true);
  assert.equal(spawnEngineChunk.includes("await startDesktopSession("), true);
  assert.equal(spawnEngineChunk.includes("buildDesktopSessionStartRequest({"), true);
  assert.equal(spawnEngineChunk.includes("tauriInvoke,"), true);
  assert.equal(
    spawnEngineChunk.includes("await writeCanvasRuntimePty(`${PTY_COMMANDS.TEXT_MODEL} ${settings.textModel}\\n`).catch(() => {});"),
    true
  );
  assert.equal(
    spawnEngineChunk.includes("await writeCanvasRuntimePty(`${PTY_COMMANDS.IMAGE_MODEL} ${settings.imageModel}\\n`).catch(() => {});"),
    true
  );
  assert.equal(
    spawnEngineChunk.includes("await writeCanvasRuntimePty(`${PTY_COMMANDS.USE} ${active.path}\\n`).catch(() => {});"),
    true
  );
});

test("tab runtime suspension forwards the typed desktop session stop handoff", () => {
  assert.equal(
    suspendActiveTabRuntimeChunk.includes("const activeRunDir = String(state.runDir || \"\").trim();"),
    true
  );
  assert.equal(suspendActiveTabRuntimeChunk.includes("Promise.allSettled(["), true);
  assert.equal(
    suspendActiveTabRuntimeChunk.includes('invoke("write_pty", { data: `${PTY_COMMANDS.INTENT_RT_STOP}\\n` })'),
    true
  );
  assert.equal(
    suspendActiveTabRuntimeChunk.includes('invoke("write_pty", { data: `${PTY_COMMANDS.INTENT_RT_MOTHER_STOP}\\n` })'),
    true
  );
  assert.equal(suspendActiveTabRuntimeChunk.includes("void stopDesktopSession("), true);
  assert.equal(suspendActiveTabRuntimeChunk.includes("tauriInvoke,"), true);
  assert.equal(
    suspendActiveTabRuntimeChunk.includes("buildDesktopSessionStopRequest({ runDir: activeRunDir })"),
    true
  );
});

test("boot creates the initial run without showing the new-tab toast", () => {
  const createRunSource = extractFunctionSourceFromSource(runProvisioningSource, "createRun");
  assert.equal(bootChunk.includes("await runCanvasAppBootShellSetup({"), true);
  assert.equal(bootShellSource.includes("ensureBootShellTab();"), true);
  assert.equal(bootChunk.includes("await runCanvasAppBootReadySequence({"), true);
  assert.equal(bootReadySource.includes("await ensureRun();"), true);
  assert.equal(bootChunk.includes('await createRun({ announce: false, source: "boot" });'), false);
  assert.equal(app.includes(createRunSignature), true);
  assert.match(app, /async function createRun\(\{ announce = true, source = "new_run" \} = \{\}\) \{\s*return canvasAppRunProvisioning\.createRun\(\{ announce, source \}\);\s*\}/);
  assert.equal(createRunSource.includes('const normalizedSource = String(source || "new_run").trim() || "new_run";'), true);
  assert.equal(
    createRunSource.includes('const showCreateRunToast = announce && normalizedSource !== "new_run" && normalizedSource !== "boot";'),
    true
  );
  assert.equal(createRunSource.includes("engineFailureToast: showCreateRunToast,"), true);
  assert.equal(createRunSource.includes("New tab ready:"), false);
  assert.equal(createRunSource.includes("engine did not start"), false);
});

test("boot seeds a visible shell tab before the backend provisions the first run", () => {
  assert.equal(app.includes("function ensureBootShellTab() {"), false);
  assert.match(app, /const \{\s*ensureBootShellTab\s*\} = canvasAppTabLifecycleRuntime;/);
  assert.equal(tabLifecycleRuntimeSource.includes("function ensureBootShellTab() {"), true);
  assert.equal(bootShellSource.includes("ensureBootShellTab();"), true);
  assert.equal(ensureBootShellTabChunk.includes("if (tabbedSessions.tabsOrder.length) {"), true);
  assert.equal(
    ensureBootShellTabChunk.includes(
      "return tabbedSessions.getTab(tabbedSessions.activeTabId || tabbedSessions.tabsOrder[0]) || null;"
    ),
    true
  );
  assert.equal(ensureBootShellTabChunk.includes("const session = createFreshTabSession();"), true);
  assert.equal(ensureBootShellTabChunk.includes("const label = tabLabelForRunDir(null, `Run ${tabbedSessions.tabsOrder.length + 1}`);"), true);
  assert.equal(ensureBootShellTabChunk.includes("runDir: null,"), true);
  assert.equal(ensureBootShellTabChunk.includes("eventsPath: null,"), true);
  assert.equal(ensureBootShellTabChunk.includes("{ activate: true }"), true);
  assert.equal(ensureBootShellTabChunk.includes("bindTabSessionToState(session);"), true);
  assert.equal(ensureBootShellTabChunk.includes('publishActiveTabVisibleState({ reason: "boot_shell_tab" });'), true);
  assert.equal(
    ensureBootShellTabChunk.includes('void scheduleTabHydration(tabId, "boot_shell_tab", {') &&
      ensureBootShellTabChunk.includes("spawnEngine: false,") &&
      ensureBootShellTabChunk.includes("engineFailureToast: false,"),
    true
  );
});

test("tab rename can only start for the active tab", () => {
  let renderCalls = 0;
  const records = new Map([
    ["tab-active", { tabId: "tab-active", label: "Active tab" }],
    ["tab-inactive", { tabId: "tab-inactive", label: "Inactive tab" }],
  ]);
  const renameRuntime = createSessionTabRenameRuntime({
    renameState: {
      tabId: null,
      draft: "",
      focusRequested: false,
    },
    getActiveTabId: () => "tab-active",
    getTabById: (tabId) => records.get(tabId) || null,
    getDisplayLabel: (record, fallback) => String(record?.label || fallback || ""),
    defaultUntitledTitle: "Untitled Canvas",
    renderSessionTabStrip() {
      renderCalls += 1;
    },
  });

  assert.equal(extractFunctionSource("startSessionTabRename").includes("return sessionTabRenameRuntime.startSessionTabRename(tabId);"), true);

  assert.equal(renameRuntime.startSessionTabRename("tab-inactive"), false);
  assert.equal(renderCalls, 0);

  assert.equal(renameRuntime.startSessionTabRename("tab-active"), true);
  assert.equal(renderCalls, 1);
});

test("automatic untitled tabs get stable numbered display labels", () => {
  const DEFAULT_UNTITLED_TAB_TITLE = "Untitled Canvas";
  const SESSION_TAB_TITLE_MAX_LENGTH = 40;
  const normalizeSessionTabTitleInput = instantiateFunction("normalizeSessionTabTitleInput", {
    SESSION_TAB_TITLE_MAX_LENGTH,
  });
  const formatUntitledSessionTabLabel = instantiateFunction("formatUntitledSessionTabLabel", {
    DEFAULT_UNTITLED_TAB_TITLE,
  });
  const parseUntitledSessionTabSequence = instantiateFunction("parseUntitledSessionTabSequence", {
    DEFAULT_UNTITLED_TAB_TITLE,
    SESSION_TAB_TITLE_MAX_LENGTH,
    normalizeSessionTabTitleInput,
  });
  const tabs = [
    { tabId: "tab-1", labelManual: false },
    { tabId: "tab-2", labelManual: false },
    { tabId: "tab-3", labelManual: false },
  ];
  const tabbedSessions = {
    tabsOrder: tabs.map((tab) => tab.tabId),
    getTab(tabId) {
      return tabs.find((tab) => tab.tabId === tabId) || null;
    },
  };
  const sessionTabAutomaticLabelForRecord = (record, fallback) => {
    return record?.automaticLabel || fallback;
  };
  const resolveUntitledSessionTabDisplayLabel = instantiateFunction("resolveUntitledSessionTabDisplayLabel", {
    DEFAULT_UNTITLED_TAB_TITLE,
    SESSION_TAB_TITLE_MAX_LENGTH,
    formatUntitledSessionTabLabel,
    parseUntitledSessionTabSequence,
    normalizeSessionTabTitleInput,
    sessionTabAutomaticLabelForRecord,
    tabbedSessions,
  });
  const sessionTabDisplayLabel = instantiateFunction("sessionTabDisplayLabel", {
    DEFAULT_UNTITLED_TAB_TITLE,
    SESSION_TAB_TITLE_MAX_LENGTH,
    normalizeSessionTabTitleInput,
    resolveUntitledSessionTabDisplayLabel,
  });

  assert.equal(sessionTabDisplayLabel(tabs[0], DEFAULT_UNTITLED_TAB_TITLE), "Untitled Canvas");
  assert.equal(sessionTabDisplayLabel(tabs[1], DEFAULT_UNTITLED_TAB_TITLE), "Untitled Canvas (2)");
  assert.equal(sessionTabDisplayLabel(tabs[2], DEFAULT_UNTITLED_TAB_TITLE), "Untitled Canvas (3)");

  tabs[0].labelManual = true;
  tabs[0].label = "Untitled Canvas";
  assert.equal(sessionTabDisplayLabel(tabs[1], DEFAULT_UNTITLED_TAB_TITLE), "Untitled Canvas (2)");
  assert.equal(sessionTabDisplayLabel(tabs[2], DEFAULT_UNTITLED_TAB_TITLE), "Untitled Canvas (3)");
});
