import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(here, "..");
const app = readFileSync(join(desktopRoot, "src", "canvas_app.js"), "utf8");
const createRunSignature = "async function createRun({ announce = true, source = \"new_run\" } = {}) {";
const ensureBootShellTabChunk = app.slice(app.indexOf("function ensureBootShellTab() {"), app.indexOf("function captureActiveTabSession("));
const ensureRunChunk = app.slice(app.indexOf("async function ensureRun() {"), app.indexOf(createRunSignature));
const ensureEngineSpawnedChunk = app.slice(
  app.indexOf("async function ensureEngineSpawned({ reason = \"engine\", showToastOnFailure = true } = {}) {"),
  app.indexOf("function allowVisionDescribe() {")
);
const bootChunk = app.slice(app.indexOf("async function boot() {"), app.indexOf("bindCommunicationReviewBootstrapBridge();"));

function extractFunctionSource(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => app.indexOf(marker))
    .find((index) => index >= 0);
  assert.notEqual(start, undefined, `Could not find function ${name}`);
  const signatureStart = app.indexOf("(", start);
  assert.notEqual(signatureStart, -1, `Could not find signature for ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth === 0 && char === "{") {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `Could not find body for ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return app.slice(start, index + 1);
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
  const attachActiveTabRuntimeChunk = extractFunctionSource("attachActiveTabRuntime");

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
  assert.equal(
    ensureEngineSpawnedChunk.includes("if (await syncActiveRunPtyBinding()) {"),
    true
  );
  assert.equal(ensureEngineSpawnedChunk.includes("startEventsPolling();"), true);
  assert.equal(ensureEngineSpawnedChunk.includes("setStatus(\"Engine: connected\");"), true);
  assert.equal(ensureEngineSpawnedChunk.includes("await spawnEngine();"), true);
  assert.equal(ensureEngineSpawnedChunk.includes("if (state.ptySpawned) startEventsPolling();"), true);
});

test("boot creates the initial run without showing the new-tab toast", () => {
  const createRunSource = extractFunctionSource("createRun");
  assert.equal(bootChunk.includes("ensureBootShellTab();"), true);
  assert.equal(bootChunk.includes("await ensureRun();"), true);
  assert.equal(bootChunk.includes('await createRun({ announce: false, source: "boot" });'), false);
  assert.equal(app.includes(createRunSignature), true);
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
  assert.equal(app.includes("function ensureBootShellTab() {"), true);
  assert.equal(ensureBootShellTabChunk.includes("if (tabbedSessions.tabsOrder.length) return"), true);
  assert.equal(ensureBootShellTabChunk.includes("const session = createFreshTabSession();"), true);
  assert.equal(ensureBootShellTabChunk.includes("const label = tabLabelForRunDir(null, `Run ${tabbedSessions.tabsOrder.length + 1}`);"), true);
  assert.equal(ensureBootShellTabChunk.includes("runDir: null,"), true);
  assert.equal(ensureBootShellTabChunk.includes("eventsPath: null,"), true);
  assert.equal(ensureBootShellTabChunk.includes("{ activate: true }"), true);
  assert.equal(ensureBootShellTabChunk.includes("bindTabSessionToState(session);"), true);
  assert.equal(ensureBootShellTabChunk.includes('publishActiveTabVisibleState({ reason: "boot_shell_tab" });'), true);
});

test("tab rename can only start for the active tab", () => {
  const state = {
    activeTabId: "tab-active",
  };
  let renderCalls = 0;
  const startSessionTabRename = instantiateFunction("startSessionTabRename", {
    state,
    tabbedSessions: {
      getTab(tabId) {
        if (tabId !== "tab-active") return { tabId, label: "Inactive tab" };
        return { tabId, label: "Active tab" };
      },
    },
    sessionTabDisplayLabel: (record, fallback) => String(record?.label || fallback || ""),
    DEFAULT_UNTITLED_TAB_TITLE: "Untitled Canvas",
    renderSessionTabStrip() {
      renderCalls += 1;
    },
    sessionTabRenameState: {
      tabId: null,
      draft: "",
      focusRequested: false,
    },
  });

  assert.equal(startSessionTabRename("tab-inactive"), false);
  assert.equal(renderCalls, 0);

  assert.equal(startSessionTabRename("tab-active"), true);
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
