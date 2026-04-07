import { test } from "node:test";
import assert from "node:assert/strict";

import { createCanvasAppRunProvisioning } from "../src/app/run_provisioning.js";

function createTabbedSessionsHarness(initialTabs = [], activeTabId = null) {
  const tabsById = new Map(initialTabs.map((tab) => [tab.tabId, { ...tab }]));
  const tabsOrder = initialTabs.map((tab) => tab.tabId);
  return {
    tabsOrder,
    getTab(tabId) {
      return tabsById.get(String(tabId || "").trim()) || null;
    },
    upsertTab(tab, { activate = false, index = null } = {}) {
      const normalized = String(tab?.tabId || "").trim();
      const exists = tabsById.has(normalized);
      tabsById.set(normalized, { ...tab });
      if (!exists) {
        if (Number.isInteger(index) && index >= 0 && index <= tabsOrder.length) {
          tabsOrder.splice(index, 0, normalized);
        } else {
          tabsOrder.push(normalized);
        }
      }
      if (activate) {
        this.activeTabId = normalized;
      }
      return tabsById.get(normalized);
    },
    activeTabId,
  };
}

function readFirstString(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

test("run provisioning promotes the active blank tab into a real run without creating another tab", async () => {
  const calls = [];
  class FakeTextDecoder {
    constructor(label) {
      this.label = label;
    }
  }
  const state = {
    runDir: null,
    activeTabId: "tab-a",
    installTelemetry: {
      runSequence: 0,
      firstRunLogged: false,
    },
  };
  const tabbedSessions = createTabbedSessionsHarness([
    {
      tabId: "tab-a",
      label: "Run Shell",
      session: {
        tabUiMeta: {
          thumbnailPath: "/tmp/thumb.png",
        },
      },
    },
  ], "tab-a");
  const provisioning = createCanvasAppRunProvisioning({
    state,
    async invokeFn(command) {
      calls.push({ type: "invokeFn", command });
      return {
        run_dir: "/runs/a",
        events_path: "/runs/a/events.jsonl",
      };
    },
    async openDialog() {
      throw new Error("openDialog should stay unused");
    },
    async existsFn() {
      return false;
    },
    setStatus(message) {
      calls.push({ type: "setStatus", message });
    },
    setRunInfo(message) {
      calls.push({ type: "setRunInfo", message });
    },
    showToast(message, level, durationMs) {
      calls.push({ type: "showToast", message, level, durationMs });
    },
    bumpInteraction() {
      calls.push({ type: "bumpInteraction" });
    },
    emitInstallTelemetryAsync(name, payload) {
      calls.push({ type: "emitInstallTelemetryAsync", name, payload });
    },
    tabbedSessions,
    createFreshTabSession(seed = {}) {
      calls.push({ type: "createFreshTabSession", seed });
      return { ...seed };
    },
    captureActiveTabSession(session = null) {
      calls.push({ type: "captureActiveTabSession", session });
      return {
        ...(session || {}),
      };
    },
    createTabId() {
      calls.push({ type: "createTabId" });
      return "tab-new";
    },
    bindTabSessionToState(session) {
      calls.push({ type: "bindTabSessionToState", session });
      state.runDir = session?.runDir || null;
    },
    normalizeTabUiMeta(meta = null) {
      return meta ? { ...meta, normalized: true } : { normalized: true };
    },
    tabLabelForRunDir(runDir, fallback) {
      return `label:${runDir}:${fallback}`;
    },
    syncActiveTabRecord(options) {
      calls.push({ type: "syncActiveTabRecord", options });
    },
    async syncActiveRunPtyBinding() {
      calls.push({ type: "syncActiveRunPtyBinding" });
      return false;
    },
    startEventsPolling() {
      calls.push({ type: "startEventsPolling" });
    },
    async activateTab(tabId, options) {
      calls.push({ type: "activateTab", tabId, options });
      return { ok: true, tabId, activeTabId: tabId, hydration: Promise.resolve(true) };
    },
    currentTabSwitchBlockReason() {
      return null;
    },
    currentTabSwitchBlockMessage(reason) {
      return String(reason || "");
    },
    async sessionTimelinePathForRunDir() {
      return "";
    },
    async sessionSnapshotPathForRunDir() {
      return "";
    },
    async legacySessionSnapshotPathForRunDir() {
      return "";
    },
    async loadSessionTimelineFromPath() {
      return null;
    },
    restoreSessionFromTimelineRecord() {
      return null;
    },
    async loadSessionSnapshotFromPath() {
      return null;
    },
    normalizeSessionTabTitleInput(value) {
      return String(value || "");
    },
    readFirstString,
    sessionTabTitleMaxLength: 40,
    async restoreIntentStateFromRunDir() {},
    async loadExistingArtifacts() {
      return 0;
    },
    TextDecoderCtor: FakeTextDecoder,
  });

  await provisioning.ensureRun();

  assert.equal(state.installTelemetry.runSequence, 1);
  assert.equal(state.installTelemetry.firstRunLogged, true);
  assert.deepEqual(calls.slice(0, 3), [
    { type: "setStatus", message: "Engine: creating run…" },
    { type: "invokeFn", command: "create_run_dir" },
    {
      type: "emitInstallTelemetryAsync",
      name: "new_run_created",
      payload: {
        run_sequence: 1,
        source: "active_tab_run",
      },
    },
  ]);
  assert.equal(calls.some((entry) => entry.type === "createTabId"), false);
  assert.deepEqual(calls.find((entry) => entry.type === "setRunInfo"), {
    type: "setRunInfo",
    message: "Run: /runs/a",
  });
  assert.deepEqual(calls.find((entry) => entry.type === "activateTab"), {
    type: "activateTab",
    tabId: "tab-a",
    options: {
      spawnEngine: false,
      reason: "ensure_run_active_tab",
      engineFailureToast: false,
      waitForHydration: true,
    },
  });
  assert.equal(calls.some((entry) => entry.type === "syncActiveRunPtyBinding"), false);
  assert.equal(calls.some((entry) => entry.type === "startEventsPolling"), false);
  const boundSession = calls.find((entry) => entry.type === "bindTabSessionToState")?.session;
  assert.equal(boundSession?.runDir, "/runs/a");
  assert.equal(boundSession?.eventsPath, "/runs/a/events.jsonl");
  assert.equal(boundSession?.eventsDecoder instanceof FakeTextDecoder, true);
  assert.equal(boundSession?.eventsDecoder?.label, "utf-8");
  assert.deepEqual(tabbedSessions.getTab("tab-a"), {
    tabId: "tab-a",
    label: "label:/runs/a:Run Shell",
    runDir: "/runs/a",
    eventsPath: "/runs/a/events.jsonl",
    session: {
      tabUiMeta: {
        thumbnailPath: "/tmp/thumb.png",
      },
      runDir: "/runs/a",
      eventsPath: "/runs/a/events.jsonl",
      eventsByteOffset: 0,
      eventsTail: "",
      eventsDecoder: boundSession.eventsDecoder,
      fallbackToFullRead: false,
      fallbackLineOffset: 0,
    },
    busy: false,
    tabUiMeta: {
      thumbnailPath: "/tmp/thumb.png",
      normalized: true,
    },
    thumbnailPath: "/tmp/thumb.png",
  });
});

test("run provisioning creates a detached run tab and activates it with engine spawn semantics", async () => {
  const calls = [];
  const state = {
    runDir: null,
    activeTabId: "tab-a",
    installTelemetry: {
      runSequence: 4,
      firstRunLogged: false,
    },
  };
  const tabbedSessions = createTabbedSessionsHarness([], null);
  const hydration = Promise.resolve(true);
  const provisioning = createCanvasAppRunProvisioning({
    state,
    async invokeFn(command) {
      calls.push({ type: "invokeFn", command });
      return {
        run_dir: "/runs/new",
        events_path: "/runs/new/events.jsonl",
      };
    },
    async openDialog() {
      return null;
    },
    async existsFn() {
      return false;
    },
    setStatus(message) {
      calls.push({ type: "setStatus", message });
    },
    setRunInfo() {},
    showToast(message, level, durationMs) {
      calls.push({ type: "showToast", message, level, durationMs });
    },
    bumpInteraction() {},
    emitInstallTelemetryAsync(name, payload) {
      calls.push({ type: "emitInstallTelemetryAsync", name, payload });
    },
    tabbedSessions,
    createFreshTabSession(seed = {}) {
      return {
        ...seed,
        tabUiMeta: {
          thumbnailPath: "/tmp/session-thumb.png",
        },
      };
    },
    captureActiveTabSession(session = null) {
      return session;
    },
    createTabId() {
      calls.push({ type: "createTabId" });
      return "tab-new";
    },
    bindTabSessionToState() {},
    normalizeTabUiMeta(meta = null) {
      return meta ? { ...meta, normalized: true } : { normalized: true };
    },
    tabLabelForRunDir(runDir, fallback) {
      return `label:${runDir}:${fallback}`;
    },
    syncActiveTabRecord() {},
    async syncActiveRunPtyBinding() {
      return false;
    },
    startEventsPolling() {},
    async activateTab(tabId, options) {
      calls.push({ type: "activateTab", tabId, options });
      state.activeTabId = tabId;
      return {
        ok: true,
        hydration,
      };
    },
    currentTabSwitchBlockReason() {
      return null;
    },
    currentTabSwitchBlockMessage(reason) {
      return String(reason || "");
    },
    async sessionTimelinePathForRunDir() {
      return "";
    },
    async sessionSnapshotPathForRunDir() {
      return "";
    },
    async legacySessionSnapshotPathForRunDir() {
      return "";
    },
    async loadSessionTimelineFromPath() {
      return null;
    },
    restoreSessionFromTimelineRecord() {
      return null;
    },
    async loadSessionSnapshotFromPath() {
      return null;
    },
    normalizeSessionTabTitleInput(value) {
      return String(value || "");
    },
    readFirstString,
    sessionTabTitleMaxLength: 40,
    async restoreIntentStateFromRunDir() {},
    async loadExistingArtifacts() {
      return 0;
    },
  });

  const result = await provisioning.createRun({ announce: false, source: "boot" });

  assert.equal(state.installTelemetry.runSequence, 5);
  assert.equal(state.installTelemetry.firstRunLogged, true);
  assert.deepEqual(calls, [
    { type: "setStatus", message: "Engine: creating run tab…" },
    { type: "invokeFn", command: "create_run_dir" },
    {
      type: "emitInstallTelemetryAsync",
      name: "new_run_created",
      payload: {
        run_sequence: 5,
        source: "boot",
      },
    },
    { type: "createTabId" },
    {
      type: "activateTab",
      tabId: "tab-new",
      options: {
        spawnEngine: true,
        engineFailureToast: false,
        reason: "new_run_tab",
      },
    },
  ]);
  assert.deepEqual(tabbedSessions.getTab("tab-new"), {
    tabId: "tab-new",
    label: "label:/runs/new:Run 1",
    runDir: "/runs/new",
    eventsPath: "/runs/new/events.jsonl",
    session: {
      runDir: "/runs/new",
      eventsPath: "/runs/new/events.jsonl",
      tabUiMeta: {
        thumbnailPath: "/tmp/session-thumb.png",
      },
    },
    busy: false,
    tabUiMeta: {
      thumbnailPath: "/tmp/session-thumb.png",
      normalized: true,
    },
    thumbnailPath: "/tmp/session-thumb.png",
  });
  assert.deepEqual(result, {
    ok: true,
    hydration,
  });
});

test("run provisioning opens a saved timeline into a new tab before any artifact fallback runs", async () => {
  const calls = [];
  const state = {
    activeTabId: "tab-a",
    installTelemetry: {},
  };
  const tabbedSessions = createTabbedSessionsHarness([], null);
  const provisioning = createCanvasAppRunProvisioning({
    state,
    async invokeFn() {
      throw new Error("invokeFn should stay unused");
    },
    async openDialog() {
      return "/runs/existing";
    },
    async existsFn(path) {
      return path === "/runs/existing/timeline.json";
    },
    setStatus(message) {
      calls.push({ type: "setStatus", message });
    },
    setRunInfo() {},
    showToast(message, level, durationMs) {
      calls.push({ type: "showToast", message, level, durationMs });
    },
    bumpInteraction() {
      calls.push({ type: "bumpInteraction" });
    },
    emitInstallTelemetryAsync() {},
    tabbedSessions,
    createFreshTabSession(seed = {}) {
      return { ...seed, tabUiMeta: null };
    },
    captureActiveTabSession(session = null) {
      return session;
    },
    createTabId() {
      return "tab-restored";
    },
    bindTabSessionToState() {},
    normalizeTabUiMeta(meta = null) {
      return meta ? { ...meta, normalized: true } : { normalized: true };
    },
    tabLabelForRunDir(runDir, fallback) {
      return `label:${runDir}:${fallback}`;
    },
    syncActiveTabRecord() {},
    async syncActiveRunPtyBinding() {
      return false;
    },
    startEventsPolling() {},
    async activateTab(tabId, options) {
      calls.push({ type: "activateTab", tabId, options });
      state.activeTabId = tabId;
      return {
        ok: true,
        hydration: Promise.resolve(true),
      };
    },
    currentTabSwitchBlockReason() {
      return null;
    },
    currentTabSwitchBlockMessage(reason) {
      return String(reason || "");
    },
    async sessionTimelinePathForRunDir() {
      return "/runs/existing/timeline.json";
    },
    async sessionSnapshotPathForRunDir() {
      return "/runs/existing/session.json";
    },
    async legacySessionSnapshotPathForRunDir() {
      return "/runs/existing/juggernaut-session.json";
    },
    async loadSessionTimelineFromPath(path) {
      calls.push({ type: "loadSessionTimelineFromPath", path });
      return { id: "timeline-record" };
    },
    restoreSessionFromTimelineRecord(record, seed) {
      calls.push({ type: "restoreSessionFromTimelineRecord", record, seed });
      return {
        label: "Timeline Session",
        labelManual: true,
        runDir: seed.runDir,
        eventsPath: seed.eventsPath,
        tabUiMeta: {
          thumbnailPath: "/tmp/timeline-thumb.png",
        },
      };
    },
    async loadSessionSnapshotFromPath() {
      throw new Error("snapshot restore should stay unused");
    },
    normalizeSessionTabTitleInput(value) {
      return String(value || "").trim();
    },
    readFirstString,
    sessionTabTitleMaxLength: 40,
    async restoreIntentStateFromRunDir() {
      calls.push({ type: "restoreIntentStateFromRunDir" });
    },
    async loadExistingArtifacts() {
      calls.push({ type: "loadExistingArtifacts" });
      return 2;
    },
    consoleObj: {
      warn(...args) {
        calls.push({ type: "console.warn", args });
      },
    },
  });

  const result = await provisioning.openExistingRun();

  assert.deepEqual(result, {
    ok: true,
    tabId: "tab-restored",
    activeTabId: "tab-restored",
    restoredTimeline: true,
  });
  assert.deepEqual(calls, [
    { type: "bumpInteraction" },
    { type: "setStatus", message: "Engine: opening run tab…" },
    { type: "loadSessionTimelineFromPath", path: "/runs/existing/timeline.json" },
    {
      type: "restoreSessionFromTimelineRecord",
      record: { id: "timeline-record" },
      seed: {
        runDir: "/runs/existing",
        eventsPath: "/runs/existing/events.jsonl",
      },
    },
    {
      type: "activateTab",
      tabId: "tab-restored",
      options: {
        spawnEngine: false,
        reason: "open_run_tab",
      },
    },
    {
      type: "showToast",
      message: "Opened Timeline Session from the saved session timeline.",
      level: "tip",
      durationMs: 3200,
    },
  ]);
  assert.deepEqual(tabbedSessions.getTab("tab-restored"), {
    tabId: "tab-restored",
    label: "Timeline Session",
    labelManual: true,
    runDir: "/runs/existing",
    eventsPath: "/runs/existing/events.jsonl",
    session: {
      label: "Timeline Session",
      labelManual: true,
      runDir: "/runs/existing",
      eventsPath: "/runs/existing/events.jsonl",
      tabUiMeta: {
        thumbnailPath: "/tmp/timeline-thumb.png",
      },
    },
    busy: false,
    tabUiMeta: {
      thumbnailPath: "/tmp/timeline-thumb.png",
      normalized: true,
    },
    thumbnailPath: "/tmp/timeline-thumb.png",
  });
});

test("run provisioning falls back to run artifacts when no saved session data exists", async () => {
  const calls = [];
  const state = {
    activeTabId: "tab-a",
    installTelemetry: {},
  };
  const tabbedSessions = createTabbedSessionsHarness([], null);
  const provisioning = createCanvasAppRunProvisioning({
    state,
    async invokeFn() {
      throw new Error("invokeFn should stay unused");
    },
    async openDialog() {
      return "/runs/raw";
    },
    async existsFn() {
      return false;
    },
    setStatus(message) {
      calls.push({ type: "setStatus", message });
    },
    setRunInfo() {},
    showToast(message, level, durationMs) {
      calls.push({ type: "showToast", message, level, durationMs });
    },
    bumpInteraction() {
      calls.push({ type: "bumpInteraction" });
    },
    emitInstallTelemetryAsync() {},
    tabbedSessions,
    createFreshTabSession(seed = {}) {
      return { ...seed, tabUiMeta: null };
    },
    captureActiveTabSession(session = null) {
      return session;
    },
    createTabId() {
      return "tab-open";
    },
    bindTabSessionToState() {},
    normalizeTabUiMeta(meta = null) {
      return meta ? { ...meta, normalized: true } : { normalized: true };
    },
    tabLabelForRunDir(runDir, fallback) {
      return `label:${runDir}:${fallback}`;
    },
    syncActiveTabRecord() {},
    async syncActiveRunPtyBinding() {
      return false;
    },
    startEventsPolling() {},
    async activateTab(tabId, options) {
      calls.push({ type: "activateTab", tabId, options });
      state.activeTabId = tabId;
      return {
        ok: true,
        hydration: Promise.resolve(true),
      };
    },
    currentTabSwitchBlockReason() {
      return null;
    },
    currentTabSwitchBlockMessage(reason) {
      return String(reason || "");
    },
    async sessionTimelinePathForRunDir() {
      return "/runs/raw/timeline.json";
    },
    async sessionSnapshotPathForRunDir() {
      return "/runs/raw/session.json";
    },
    async legacySessionSnapshotPathForRunDir() {
      return "/runs/raw/juggernaut-session.json";
    },
    async loadSessionTimelineFromPath() {
      return null;
    },
    restoreSessionFromTimelineRecord() {
      return null;
    },
    async loadSessionSnapshotFromPath() {
      return null;
    },
    normalizeSessionTabTitleInput(value) {
      return String(value || "").trim();
    },
    readFirstString,
    sessionTabTitleMaxLength: 40,
    async restoreIntentStateFromRunDir() {
      calls.push({ type: "restoreIntentStateFromRunDir" });
    },
    async loadExistingArtifacts() {
      calls.push({ type: "loadExistingArtifacts" });
      return 3;
    },
  });

  const result = await provisioning.openExistingRun();

  assert.deepEqual(result, {
    ok: true,
    tabId: "tab-open",
    activeTabId: "tab-open",
  });
  assert.deepEqual(calls, [
    { type: "bumpInteraction" },
    { type: "setStatus", message: "Engine: opening run tab…" },
    {
      type: "activateTab",
      tabId: "tab-open",
      options: {
        spawnEngine: false,
        reason: "open_run_tab",
      },
    },
    { type: "restoreIntentStateFromRunDir" },
    { type: "loadExistingArtifacts" },
    {
      type: "showToast",
      message: "Opened label:/runs/raw:Run 1 in a new tab (3 artifacts).",
      level: "tip",
      durationMs: 3200,
    },
  ]);
});
