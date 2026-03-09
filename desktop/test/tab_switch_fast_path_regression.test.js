import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createTabbedSessionsStore } from "../src/tabbed_sessions.js";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");
const ensureRunChunk = app.slice(app.indexOf("async function ensureRun() {"), app.indexOf("async function createRun() {"));
const importLocalPathsChunk = app.slice(
  app.indexOf("async function importLocalPathsAtCanvasPoint("),
  app.indexOf("async function importPhotos(")
);

function extractFunctionSource(pattern, label) {
  const match = app.match(pattern);
  assert.ok(match, `${label} function not found`);
  return match[0].replace(/\n\nasync function\s+[\s\S]*$/, "").trim();
}

function createDeferred() {
  let resolve = null;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function loadActivateTabHarness({ attachGate = null } = {}) {
  const activateSource = extractFunctionSource(
    /async function activateTab\([\s\S]*?\n\}\n\nasync function closeTab/,
    "activateTab"
  );
  const harnessSource = [
    "const calls = [];",
    "let tabHydrationToken = 0;",
    "const state = {",
    "  activeTabId: null,",
    "  tabsOrder: [],",
    "  tabsById: null,",
    "  pointer: { active: false },",
    "  gestureZoom: { active: false },",
    "  mother: { running: false },",
    "  motherIdle: { commitMutationInFlight: false },",
    "  actionQueueActive: false,",
    "  actionQueue: [],",
    "  runDir: null,",
    "  eventsPath: null,",
    "  images: [],",
    "};",
    "function syncTabbedSessionsStateFromStore() {",
    "  state.tabsOrder = tabbedSessions.tabsOrder.slice();",
    "  state.tabsById = tabbedSessions.tabsById;",
    "  state.activeTabId = tabbedSessions.activeTabId || null;",
    "}",
    "const tabbedSessions = createTabbedSessionsStore({",
    "  onChange() {",
    "    syncTabbedSessionsStateFromStore();",
    "  },",
    "});",
    "function makeSession(runDir, imageId) {",
    "  return {",
    "    runDir,",
    "    eventsPath: runDir ? `${runDir}/events.jsonl` : null,",
    "    images: imageId ? [{ id: imageId, path: `${runDir}/${imageId}.png` }] : [],",
    "  };",
    "}",
    "tabbedSessions.upsertTab({ tabId: 'tab-a', label: 'Run A', runDir: '/runs/a', session: makeSession('/runs/a', 'img-a') }, { activate: true });",
    "tabbedSessions.upsertTab({ tabId: 'tab-b', label: 'Run B', runDir: '/runs/b', session: makeSession('/runs/b', 'img-b') });",
    "tabbedSessions.upsertTab({ tabId: 'tab-c', label: 'Run C', runDir: '/runs/c', session: makeSession('/runs/c', 'img-c') });",
    "syncTabbedSessionsStateFromStore();",
    "bindTabSessionToState(tabbedSessions.getTab('tab-a').session);",
    "function currentTabSwitchBlockReason() {",
    "  return null;",
    "}",
    "function currentTabSwitchBlockMessage(reason) {",
    "  return String(reason || '');",
    "}",
    "function showToast(...args) {",
    "  calls.push({ name: 'showToast', args });",
    "}",
    "function suspendActiveTabRuntimeForSwitch() {",
    "  calls.push({ name: 'suspendActiveTabRuntimeForSwitch', activeTabId: state.activeTabId });",
    "}",
    "function syncActiveTabRecord(options = {}) {",
    "  calls.push({ name: 'syncActiveTabRecord', options: { ...options }, activeTabId: state.activeTabId });",
    "  return state.activeTabId ? tabbedSessions.getTab(state.activeTabId) : null;",
    "}",
    "function createFreshTabSession(seed = {}) {",
    "  calls.push({ name: 'createFreshTabSession', seed });",
    "  return { ...seed, images: [] };",
    "}",
    "function bindTabSessionToState(session = null) {",
    "  calls.push({",
    "    name: 'bindTabSessionToState',",
    "    runDir: session?.runDir || null,",
    "    imageIds: Array.isArray(session?.images) ? session.images.map((image) => image.id) : [],",
    "  });",
    "  state.runDir = session?.runDir || null;",
    "  state.eventsPath = session?.eventsPath || null;",
    "  state.images = Array.isArray(session?.images) ? session.images.slice() : [];",
    "}",
    "function publishActiveTabVisibleState() {",
    "  calls.push({",
    "    name: 'publishActiveTabVisibleState',",
    "    activeTabId: state.activeTabId,",
    "    runDir: state.runDir,",
    "    imageIds: (state.images || []).map((image) => image.id),",
    "  });",
    "}",
    "function currentTabHydrationMatches(tabId, hydrationToken) {",
    "  return String(tabId || '') === String(state.activeTabId || '') && hydrationToken === tabHydrationToken;",
    "}",
    "function startPerfSample(label, detail = null) {",
    "  calls.push({ name: 'startPerfSample', label, detail });",
    "  return { label, detail, startedAt: 0, id: `${label}:test` };",
    "}",
    "function finishPerfSample(sample, metricKey = null, detail = null) {",
    "  calls.push({ name: 'finishPerfSample', sample, metricKey, detail });",
    "  return 0;",
    "}",
    "async function attachActiveTabRuntime(options = {}) {",
    "  calls.push({",
    "    name: 'attachActiveTabRuntime:start',",
    "    options: { ...options },",
    "    activeTabId: state.activeTabId,",
    "    runDir: state.runDir,",
    "    imageIds: (state.images || []).map((image) => image.id),",
    "  });",
    "  if (typeof attachGate === 'function') {",
    "    await attachGate(options, state, calls);",
    "  }",
    "  calls.push({",
    "    name: 'attachActiveTabRuntime:end',",
    "    options: { ...options },",
    "    activeTabId: state.activeTabId,",
    "    runDir: state.runDir,",
    "    imageIds: (state.images || []).map((image) => image.id),",
    "  });",
    "  return true;",
    "}",
    "function listTabs() {",
    "  return tabbedSessions.listTabs();",
    "}",
    "function scheduleTabHydration(tabId, reason, options = {}) {",
    "  const normalizedTabId = String(tabId || '').trim();",
    "  const hydrationToken = ++tabHydrationToken;",
    "  calls.push({ name: 'scheduleTabHydration', tabId: normalizedTabId, reason, options: { ...options }, hydrationToken });",
    "  return Promise.resolve().then(() => {",
    "    if (!currentTabHydrationMatches(normalizedTabId, hydrationToken)) return false;",
    "    return attachActiveTabRuntime({ tabId: normalizedTabId, reason, hydrationToken, ...options });",
    "  });",
    "}",
    activateSource,
    "return { calls, state, tabbedSessions, activateTab };",
  ].join("\n");
  return new Function("createTabbedSessionsStore", "attachGate", harnessSource)(createTabbedSessionsStore, attachGate);
}

test("blank-tab imports provision the active tab instead of opening a separate run tab", () => {
  assert.match(importLocalPathsChunk, /await ensureRun\(\);[\s\S]*const inputsDir = `\$\{state\.runDir\}\/inputs`;/);
  assert.equal(ensureRunChunk.includes("const activeTabId = String(state.activeTabId || \"\").trim();"), true);
  assert.equal(ensureRunChunk.includes("const activeTab = activeTabId ? tabbedSessions.getTab(activeTabId) : null;"), true);
  assert.equal(ensureRunChunk.includes("tabId: activeTabId,"), true);
  assert.equal(
    ensureRunChunk.includes("{ activate: true, index: tabbedSessions.tabsOrder.indexOf(activeTabId) }"),
    true
  );
  assert.equal(ensureRunChunk.includes("await createRun();"), true);
});

test("activateTab swaps the visible tab state before engine attach resolves", async () => {
  const gate = createDeferred();
  const harness = loadActivateTabHarness({
    attachGate: () => gate.promise,
  });

  const activation = harness.activateTab("tab-b", { spawnEngine: true, reason: "titlebar_tab_click" });
  await Promise.resolve();

  assert.equal(harness.state.activeTabId, "tab-b");
  assert.equal(harness.state.runDir, "/runs/b");
  assert.deepEqual(
    harness.state.images.map((image) => image.id),
    ["img-b"]
  );
  assert.deepEqual(harness.tabbedSessions.tabsOrder, ["tab-a", "tab-b", "tab-c"]);
  assert.equal(
    harness.calls.filter((entry) => entry.name === "createFreshTabSession").length,
    0,
    "expected switching between populated tabs to reuse the existing sessions"
  );

  const bindIndex = harness.calls.findIndex(
    (entry) => entry.name === "bindTabSessionToState" && entry.runDir === "/runs/b"
  );
  const visibleStateIndex = harness.calls.findIndex(
    (entry) => entry.name === "publishActiveTabVisibleState" && entry.runDir === "/runs/b"
  );
  const attachIndex = harness.calls.findIndex((entry) => entry.name === "attachActiveTabRuntime:start");
  assert.ok(bindIndex >= 0, "expected the tab switch to bind tab-b state");
  assert.ok(visibleStateIndex >= 0, "expected the tab switch to publish visible tab state immediately");
  assert.ok(attachIndex >= 0, "expected the tab switch to start runtime attach");
  assert.ok(bindIndex < visibleStateIndex, "expected session binding before visible-state publication");
  assert.ok(visibleStateIndex < attachIndex, "expected the visible tab swap to happen before deferred attach work");

  gate.resolve();
  await activation;
});

test("switching among three populated tabs does not create an extra tab or run", async () => {
  const harness = loadActivateTabHarness();

  await harness.activateTab("tab-b", { spawnEngine: true, reason: "titlebar_tab_click" });
  await harness.activateTab("tab-c", { spawnEngine: true, reason: "titlebar_tab_click" });
  await harness.activateTab("tab-a", { spawnEngine: true, reason: "titlebar_tab_click" });

  assert.deepEqual(harness.tabbedSessions.tabsOrder, ["tab-a", "tab-b", "tab-c"]);
  assert.equal(harness.tabbedSessions.listTabs().length, 3);
  assert.deepEqual(
    harness.tabbedSessions.listTabs().map((tab) => tab.runDir),
    ["/runs/a", "/runs/b", "/runs/c"]
  );
  assert.equal(
    harness.calls.filter((entry) => entry.name === "createFreshTabSession").length,
    0,
    "expected switching among hydrated tabs to avoid provisioning a replacement session"
  );
});

test("late completion from an earlier tab attach does not revert a newer tab selection", async () => {
  const gates = new Map();
  const harness = loadActivateTabHarness({
    attachGate: (_options, state) => {
      const tabId = String(state.activeTabId || "");
      let gate = gates.get(tabId);
      if (!gate) {
        gate = createDeferred();
        gates.set(tabId, gate);
      }
      return gate.promise;
    },
  });

  const first = harness.activateTab("tab-b", { spawnEngine: true, reason: "titlebar_tab_click" });
  await Promise.resolve();
  const second = harness.activateTab("tab-c", { spawnEngine: true, reason: "titlebar_tab_click" });
  await Promise.resolve();

  assert.equal(harness.state.activeTabId, "tab-c");
  assert.equal(harness.state.runDir, "/runs/c");
  assert.deepEqual(
    harness.state.images.map((image) => image.id),
    ["img-c"]
  );

  gates.get("tab-b")?.resolve();
  await first;

  assert.equal(
    harness.state.activeTabId,
    "tab-c",
    "expected the finished tab-b attach to avoid restoring stale visible tab state"
  );
  assert.equal(harness.state.runDir, "/runs/c");

  gates.get("tab-c")?.resolve();
  await second;

  assert.equal(harness.state.activeTabId, "tab-c");
  assert.equal(
    harness.calls.filter((entry) => entry.name === "attachActiveTabRuntime:start").length,
    2
  );
  assert.equal(
    harness.calls.filter((entry) => entry.name === "scheduleTabHydration").length,
    2
  );
});
