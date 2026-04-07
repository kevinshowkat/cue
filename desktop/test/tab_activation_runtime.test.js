import { test } from "node:test";
import assert from "node:assert/strict";

import { createCanvasAppTabActivationRuntime } from "../src/app/tab_activation_runtime.js";

function createBaseRuntime(overrides = {}) {
  const calls = [];
  let rafCallback = null;
  let idleCallback = null;
  const state = {
    activeTabId: "tab-a",
    runDir: "/runs/a",
    eventsPath: "/runs/a/events.jsonl",
    activeId: "img-a",
    images: [{ id: "img-a", path: "/runs/a/img-a.png" }],
    lastTipText: "",
    lastDirectorText: "Director",
    lastDirectorMeta: { tone: "calm" },
    timelineOpen: false,
    desktopSessionBridgeActive: true,
    ptySpawned: true,
    pollInFlight: true,
    wheelMenu: { hideTimer: 12, open: true },
    motherIdle: {
      cooldownTimer: 1,
      pendingIntentTimeout: 2,
      pendingPromptCompileTimeout: 3,
      speculativePrefetchTimer: 4,
      liveProposalRefreshTimer: 5,
      intentReplayTimer: 6,
      pendingVisionRetryTimer: 7,
      hintFadeTimer: 8,
    },
    ...overrides.state,
  };
  const tabs = new Map(
    (overrides.tabs || [
      {
        tabId: "tab-a",
        label: "Run A",
        runDir: "/runs/a",
        eventsPath: "/runs/a/events.jsonl",
        session: { runDir: "/runs/a", eventsPath: "/runs/a/events.jsonl", images: [{ id: "img-a", path: "/runs/a/img-a.png" }] },
      },
      {
        tabId: "tab-b",
        label: "Run B",
        runDir: "/runs/b",
        eventsPath: "/runs/b/events.jsonl",
        session: { runDir: "/runs/b", eventsPath: "/runs/b/events.jsonl", images: [{ id: "img-b", path: "/runs/b/img-b.png" }] },
      },
    ]).map((record) => [record.tabId, record])
  );
  const runtime = createCanvasAppTabActivationRuntime({
    state,
    els: {
      communicationProposalTray: {
        classList: {
          add(name) {
            calls.push({ type: "tray.classList.add", name });
          },
        },
      },
      timelineDock: {
        classList: {
          add(name) {
            calls.push({ type: "timelineDock.classList.add", name });
          },
        },
      },
    },
    tabbedSessions: {
      getTab(tabId) {
        return tabs.get(tabId) || null;
      },
      setActiveTab(tabId) {
        calls.push({ type: "setActiveTab", tabId });
        state.activeTabId = tabId;
        return tabs.get(tabId) || null;
      },
    },
    createFreshTabSession(seed = {}) {
      calls.push({ type: "createFreshTabSession", seed });
      return { ...seed, images: [] };
    },
    bindTabSessionToState(session = null) {
      calls.push({ type: "bindTabSessionToState", session });
      state.runDir = session?.runDir || null;
      state.eventsPath = session?.eventsPath || null;
      state.images = Array.isArray(session?.images) ? session.images.slice() : [];
      state.activeId = Array.isArray(session?.images) && session.images[0]?.id ? session.images[0].id : null;
    },
    syncActiveTabRecord(options) {
      calls.push({ type: "syncActiveTabRecord", options });
      return state.activeTabId ? tabs.get(state.activeTabId) || null : null;
    },
    currentTabSwitchBlockReason(options = {}) {
      calls.push({ type: "currentTabSwitchBlockReason", options });
      return overrides.blockReason || null;
    },
    currentTabSwitchBlockMessage(reason) {
      return String(reason || "");
    },
    showToast(message, level, durationMs) {
      calls.push({ type: "showToast", message, level, durationMs });
    },
    syncActiveTabPreviewRuntime() {
      calls.push({ type: "syncActiveTabPreviewRuntime" });
    },
    syncLocalMagicSelectUiPrewarmTargets(detail) {
      calls.push({ type: "syncLocalMagicSelectUiPrewarmTargets", detail });
    },
    setRunInfo(text) {
      calls.push({ type: "setRunInfo", text });
    },
    setTip(text) {
      calls.push({ type: "setTip", text });
    },
    setDirectorText(text, meta) {
      calls.push({ type: "setDirectorText", text, meta });
    },
    updateEmptyCanvasHint() {
      calls.push({ type: "updateEmptyCanvasHint" });
    },
    syncTimelineDockVisibility() {
      calls.push({ type: "syncTimelineDockVisibility" });
    },
    requestRender(options) {
      calls.push({ type: "requestRender", options });
    },
    releaseLocalMagicSelectUiPrewarmForTab(tabId, detail) {
      calls.push({ type: "releaseLocalMagicSelectUiPrewarmForTab", tabId, detail });
      return Promise.resolve();
    },
    stopEventsPolling() {
      calls.push({ type: "stopEventsPolling" });
    },
    resetDescribeQueue(options) {
      calls.push({ type: "resetDescribeQueue", options });
    },
    stopIntentTicker() {
      calls.push({ type: "stopIntentTicker" });
    },
    clearTabScopedIntentTimers() {
      calls.push({ type: "clearTabScopedIntentTimers" });
    },
    clearAmbientIntentTimers() {
      calls.push({ type: "clearAmbientIntentTimers" });
    },
    clearMotherIdleTimers(options) {
      calls.push({ type: "clearMotherIdleTimers", options });
    },
    clearMotherIdleDispatchTimeout() {
      calls.push({ type: "clearMotherIdleDispatchTimeout" });
    },
    invoke(command, payload) {
      calls.push({ type: "invoke", command, payload });
      return Promise.resolve();
    },
    PTY_COMMANDS: {
      INTENT_RT_STOP: "intent-stop",
      INTENT_RT_MOTHER_STOP: "mother-stop",
    },
    tauriInvoke: "tauri-invoke",
    buildDesktopSessionStopRequest(payload) {
      calls.push({ type: "buildDesktopSessionStopRequest", payload });
      return payload;
    },
    stopDesktopSession(invokeTarget, payload) {
      calls.push({ type: "stopDesktopSession", invokeTarget, payload });
      return Promise.resolve();
    },
    hideImageMenu() {
      calls.push({ type: "hideImageMenu" });
    },
    hideAnnotatePanel() {
      calls.push({ type: "hideAnnotatePanel" });
    },
    hidePromptGeneratePanel() {
      calls.push({ type: "hidePromptGeneratePanel" });
    },
    hideCreateToolPanel() {
      calls.push({ type: "hideCreateToolPanel" });
    },
    hideMarkPanel() {
      calls.push({ type: "hideMarkPanel" });
    },
    closeMotherWheelMenu(options) {
      calls.push({ type: "closeMotherWheelMenu", options });
    },
    startPerfSample(label, detail) {
      calls.push({ type: "startPerfSample", label, detail });
      return { label, detail };
    },
    finishPerfSample(sample, metricKey, detail) {
      calls.push({ type: "finishPerfSample", sample, metricKey, detail });
    },
    syncSessionToolsFromRegistry() {
      calls.push({ type: "syncSessionToolsFromRegistry" });
    },
    renderCreateToolPreview() {
      calls.push({ type: "renderCreateToolPreview" });
    },
    renderCustomToolDock() {
      calls.push({ type: "renderCustomToolDock" });
    },
    renderSelectionMeta() {
      calls.push({ type: "renderSelectionMeta" });
    },
    renderFilmstrip() {
      calls.push({ type: "renderFilmstrip" });
    },
    chooseSpawnNodes() {
      calls.push({ type: "chooseSpawnNodes" });
    },
    renderSessionApiCallsReadout() {
      calls.push({ type: "renderSessionApiCallsReadout" });
    },
    syncIntentModeClass() {
      calls.push({ type: "syncIntentModeClass" });
    },
    syncJuggernautShellState() {
      calls.push({ type: "syncJuggernautShellState" });
    },
    applyRuntimeChromeVisibility(options) {
      calls.push({ type: "applyRuntimeChromeVisibility", options });
    },
    renderMotherMoodStatus() {
      calls.push({ type: "renderMotherMoodStatus" });
    },
    renderTimeline() {
      calls.push({ type: "renderTimeline" });
    },
    ensureEngineSpawned(options) {
      calls.push({ type: "ensureEngineSpawned", options });
      return Promise.resolve(true);
    },
    syncActiveRunPtyBinding(options) {
      calls.push({ type: "syncActiveRunPtyBinding", options });
      return Promise.resolve(true);
    },
    startEventsPolling() {
      calls.push({ type: "startEventsPolling" });
    },
    setStatus(text) {
      calls.push({ type: "setStatus", text });
    },
    defaultTip: "Default tip",
    tabHydrationIdleTimeoutMs: 25,
    windowObj: {
      requestAnimationFrame(callback) {
        rafCallback = callback;
        calls.push({ type: "requestAnimationFrame" });
        return 1;
      },
      cancelAnimationFrame(id) {
        calls.push({ type: "cancelAnimationFrame", id });
      },
      requestIdleCallback(callback, options) {
        idleCallback = callback;
        calls.push({ type: "requestIdleCallback", options });
        return 2;
      },
      cancelIdleCallback(id) {
        calls.push({ type: "cancelIdleCallback", id });
      },
    },
    ...overrides.runtime,
  });

  return {
    runtime,
    state,
    tabs,
    calls,
    flushRaf() {
      if (typeof rafCallback === "function") {
        const callback = rafCallback;
        rafCallback = null;
        callback();
      }
    },
    flushIdle() {
      if (typeof idleCallback === "function") {
        const callback = idleCallback;
        idleCallback = null;
        callback();
      }
    },
  };
}

test("tab activation runtime publishes the active tab state into the visible shell chrome", () => {
  const { runtime, calls } = createBaseRuntime();

  runtime.publishActiveTabVisibleState({ allowTabSwitchPreview: true, reason: "titlebar_tab_click" });

  assert.deepEqual(calls.find((entry) => entry.type === "setRunInfo"), {
    type: "setRunInfo",
    text: "Run: /runs/a",
  });
  assert.deepEqual(calls.find((entry) => entry.type === "setTip"), {
    type: "setTip",
    text: "Default tip",
  });
  assert.deepEqual(calls.find((entry) => entry.type === "setDirectorText"), {
    type: "setDirectorText",
    text: "Director",
    meta: { tone: "calm" },
  });
  assert.deepEqual(calls.find((entry) => entry.type === "requestRender"), {
    type: "requestRender",
    options: { allowTabSwitchPreview: true, reason: "titlebar_tab_click" },
  });
});

test("tab activation runtime suspension clears active-tab runtime work and forwards the stop request", async () => {
  const { runtime, state, calls } = createBaseRuntime();

  runtime.suspendActiveTabRuntimeForSwitch();
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(state.desktopSessionBridgeActive, false);
  assert.equal(state.ptySpawned, false);
  assert.equal(state.pollInFlight, false);
  assert.equal(state.wheelMenu.open, false);
  assert.equal(state.wheelMenu.hideTimer, null);
  assert.equal(calls.some((entry) => entry.type === "stopEventsPolling"), true);
  assert.equal(calls.some((entry) => entry.type === "clearTabScopedIntentTimers"), true);
  assert.equal(calls.some((entry) => entry.type === "clearAmbientIntentTimers"), true);
  assert.equal(calls.some((entry) => entry.type === "clearMotherIdleTimers"), true);
  assert.equal(calls.some((entry) => entry.type === "invoke" && entry.command === "write_pty"), true);
  assert.deepEqual(calls.find((entry) => entry.type === "buildDesktopSessionStopRequest"), {
    type: "buildDesktopSessionStopRequest",
    payload: { runDir: "/runs/a" },
  });
  assert.deepEqual(calls.find((entry) => entry.type === "stopDesktopSession"), {
    type: "stopDesktopSession",
    invokeTarget: "tauri-invoke",
    payload: { runDir: "/runs/a" },
  });
});

test("tab activation runtime switches the visible tab before deferred hydration finishes", async () => {
  const { runtime, state, calls, flushRaf, flushIdle } = createBaseRuntime();

  const result = await runtime.activateTab("tab-b", { spawnEngine: false, reason: "titlebar_tab_click" });

  assert.equal(result.ok, true);
  assert.equal(result.activeTabId, "tab-b");
  assert.equal(state.activeTabId, "tab-b");
  assert.equal(state.runDir, "/runs/b");
  assert.equal(calls.some((entry) => entry.type === "syncActiveTabRecord" && entry.options?.capture === true), true);
  assert.equal(calls.some((entry) => entry.type === "setActiveTab" && entry.tabId === "tab-b"), true);
  assert.equal(calls.some((entry) => entry.type === "publishActiveTabVisibleState"), false);

  flushRaf();
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushIdle();
  const hydrated = await result.hydration;

  assert.equal(hydrated, true);
  assert.equal(calls.some((entry) => entry.type === "requestAnimationFrame"), true);
  assert.equal(calls.some((entry) => entry.type === "requestIdleCallback"), true);
  assert.equal(calls.some((entry) => entry.type === "syncSessionToolsFromRegistry"), true);
  assert.equal(calls.some((entry) => entry.type === "renderFilmstrip"), true);
  assert.equal(calls.some((entry) => entry.type === "chooseSpawnNodes"), true);
  assert.equal(calls.some((entry) => entry.type === "syncActiveRunPtyBinding"), true);
  assert.equal(calls.some((entry) => entry.type === "startEventsPolling"), true);
});
