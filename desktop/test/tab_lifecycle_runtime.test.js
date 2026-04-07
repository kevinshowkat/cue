import { test } from "node:test";
import assert from "node:assert/strict";

import { createCanvasAppTabLifecycleRuntime } from "../src/app/tab_lifecycle_runtime.js";

function createTabbedSessionsHarness(state, initialTabs = []) {
  const tabsById = new Map(initialTabs.map((tab) => [tab.tabId, { ...tab }]));
  const tabsOrder = initialTabs.map((tab) => tab.tabId);
  return {
    tabsById,
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
        state.activeTabId = normalized;
        this.activeTabId = normalized;
      }
      return tabsById.get(normalized) || null;
    },
    closeTab(tabId, { activateNeighbor = false } = {}) {
      const normalized = String(tabId || "").trim();
      const closed = tabsById.get(normalized) || null;
      const index = tabsOrder.indexOf(normalized);
      if (index >= 0) tabsOrder.splice(index, 1);
      tabsById.delete(normalized);
      let nextActiveId = this.activeTabId || null;
      if (normalized === String(this.activeTabId || "").trim()) {
        if (activateNeighbor) {
          const nextIndex = Math.max(0, Math.min(index, tabsOrder.length - 1));
          nextActiveId = tabsOrder[nextIndex] || tabsOrder[tabsOrder.length - 1] || null;
        } else {
          nextActiveId = tabsOrder[0] || null;
        }
        this.activeTabId = nextActiveId;
        state.activeTabId = nextActiveId;
      }
      return {
        closed,
        nextActiveId,
      };
    },
    activeTabId: state.activeTabId,
  };
}

function createLifecycleHarness({
  activeTabId = "tab-a",
  renameState = { tabId: null, draft: "" },
  activateResult = { ok: true },
} = {}) {
  const calls = [];
  const state = {
    activeTabId,
  };
  let currentRenameState = {
    tabId: renameState.tabId || null,
    draft: renameState.draft || "",
  };
  const tabbedSessions = createTabbedSessionsHarness(state, [
    {
      tabId: "tab-a",
      label: "Tab A",
      runDir: "/runs/a",
      session: {
        runDir: "/runs/a",
        reviewFlowState: "idle",
        tabUiMeta: {
          thumbnailPath: "/thumbs/a.png",
        },
      },
    },
    {
      tabId: "tab-b",
      label: "Tab B",
      runDir: "/runs/b",
      session: {
        runDir: "/runs/b",
        reviewFlowState: "idle",
        tabUiMeta: {
          thumbnailPath: "/thumbs/b.png",
        },
      },
    },
    {
      tabId: "tab-c",
      label: "Tab C",
      runDir: "/runs/c",
      session: {
        runDir: "/runs/c",
        reviewFlowState: "idle",
        tabUiMeta: {
          thumbnailPath: "/thumbs/c.png",
        },
      },
    },
  ]);
  tabbedSessions.activeTabId = activeTabId;

  const runtime = createCanvasAppTabLifecycleRuntime({
    state,
    tabbedSessions,
    getTabsSnapshot() {
      return {
        tabsOrder: tabbedSessions.tabsOrder.slice(),
        activeTabId: state.activeTabId,
        tabs: tabbedSessions.tabsOrder.map((tabId) => ({
          tabId,
          active: tabId === state.activeTabId,
        })),
      };
    },
    getSessionTabRenameState() {
      return currentRenameState;
    },
    resetSessionTabRenameState() {
      calls.push({ type: "resetSessionTabRenameState" });
      currentRenameState = {
        tabId: null,
        draft: "",
      };
    },
    commitSessionTabRename(tabId, draft) {
      calls.push({ type: "commitSessionTabRename", tabId, draft });
      currentRenameState = {
        tabId: null,
        draft: "",
      };
      return true;
    },
    sessionTabHasRunningReviewApply(record = null) {
      calls.push({ type: "sessionTabHasRunningReviewApply", tabId: record?.tabId || null });
      return false;
    },
    currentTabSwitchBlockReason() {
      calls.push({ type: "currentTabSwitchBlockReason" });
      return null;
    },
    currentTabSwitchBlockMessage(reason) {
      calls.push({ type: "currentTabSwitchBlockMessage", reason });
      return String(reason || "");
    },
    showToast(message, level, durationMs) {
      calls.push({ type: "showToast", message, level, durationMs });
    },
    suspendActiveTabRuntimeForSwitch() {
      calls.push({ type: "suspendActiveTabRuntimeForSwitch" });
    },
    syncActiveTabRecord(options = {}) {
      calls.push({ type: "syncActiveTabRecord", options });
      return state.activeTabId ? tabbedSessions.getTab(state.activeTabId) : null;
    },
    bindTabSessionToState(session = null) {
      calls.push({ type: "bindTabSessionToState", session });
    },
    createFreshTabSession(seed = {}) {
      calls.push({ type: "createFreshTabSession", seed });
      return { ...seed, reviewFlowState: "idle", tabUiMeta: {} };
    },
    syncActiveTabPreviewRuntime() {
      calls.push({ type: "syncActiveTabPreviewRuntime" });
    },
    publishActiveTabVisibleState(options = {}) {
      calls.push({ type: "publishActiveTabVisibleState", options });
    },
    scheduleTabHydration(tabId, reason, options = {}) {
      calls.push({ type: "scheduleTabHydration", tabId, reason, options });
      return Promise.resolve(true);
    },
    disposeTabPreviewForTab(tabId) {
      calls.push({ type: "disposeTabPreviewForTab", tabId });
      return true;
    },
    sessionTabDisplayLabel(record, fallback) {
      return String(record?.label || fallback || "");
    },
    createForkedTabSession(session = null, { label = null } = {}) {
      calls.push({ type: "createForkedTabSession", session, label });
      return {
        ...(session || {}),
        label,
        runDir: null,
        eventsPath: null,
        eventsByteOffset: 0,
        reviewFlowState: "idle",
        tabUiMeta: {
          thumbnailPath: "/thumbs/fork.png",
        },
      };
    },
    buildSessionTabForkLabel(record = null) {
      calls.push({ type: "buildSessionTabForkLabel", tabId: record?.tabId || null });
      return `Fork of ${record?.label || "tab"}`;
    },
    createTabId() {
      calls.push({ type: "createTabId" });
      return "tab-new";
    },
    normalizeTabUiMeta(meta = null) {
      calls.push({ type: "normalizeTabUiMeta", meta });
      return meta ? { ...meta, normalized: true } : { normalized: true };
    },
    async activateTab(tabId, options = {}) {
      calls.push({ type: "activateTab", tabId, options });
      if (activateResult?.ok) {
        state.activeTabId = tabId;
        tabbedSessions.activeTabId = tabId;
      }
      return activateResult;
    },
    defaultUntitledTabTitle: "Untitled Canvas",
  });

  return {
    calls,
    state,
    tabbedSessions,
    runtime,
  };
}

test("tab lifecycle runtime closes the active tab through the neighbor-preview handoff", async () => {
  const harness = createLifecycleHarness({
    renameState: {
      tabId: "tab-a",
      draft: "Draft title",
    },
  });

  const result = await harness.runtime.closeTab("tab-a");

  assert.deepEqual(result, {
    ok: true,
    closedTabId: "tab-a",
    activeTabId: "tab-b",
    tabs: [
      { tabId: "tab-b", active: true },
      { tabId: "tab-c", active: false },
    ],
  });
  assert.deepEqual(harness.tabbedSessions.tabsOrder, ["tab-b", "tab-c"]);
  assert.equal(harness.calls.some((entry) => entry.type === "resetSessionTabRenameState"), true);
  assert.equal(harness.calls.some((entry) => entry.type === "suspendActiveTabRuntimeForSwitch"), true);
  assert.deepEqual(
    harness.calls.find((entry) => entry.type === "syncActiveTabRecord"),
    {
      type: "syncActiveTabRecord",
      options: { capture: true, publish: true },
    }
  );
  assert.equal(
    harness.calls.some((entry) => entry.type === "bindTabSessionToState" && entry.session?.runDir === "/runs/b"),
    true
  );
  assert.equal(harness.calls.some((entry) => entry.type === "syncActiveTabPreviewRuntime"), true);
  assert.deepEqual(
    harness.calls.find((entry) => entry.type === "publishActiveTabVisibleState"),
    {
      type: "publishActiveTabVisibleState",
      options: {
        allowTabSwitchPreview: true,
        reason: "close_tab",
      },
    }
  );
  assert.deepEqual(
    harness.calls.find((entry) => entry.type === "scheduleTabHydration"),
    {
      type: "scheduleTabHydration",
      tabId: "tab-b",
      reason: "close_tab",
      options: {
        spawnEngine: false,
      },
    }
  );
  assert.deepEqual(
    harness.calls.filter((entry) => entry.type === "disposeTabPreviewForTab"),
    [{ type: "disposeTabPreviewForTab", tabId: "tab-a" }]
  );
});

test("tab lifecycle runtime closes an inactive tab without touching the active runtime", async () => {
  const harness = createLifecycleHarness();

  const result = await harness.runtime.closeTab("tab-b");

  assert.deepEqual(result, {
    ok: true,
    closedTabId: "tab-b",
    activeTabId: "tab-a",
    tabs: [
      { tabId: "tab-a", active: true },
      { tabId: "tab-c", active: false },
    ],
  });
  assert.deepEqual(harness.tabbedSessions.tabsOrder, ["tab-a", "tab-c"]);
  assert.equal(harness.calls.some((entry) => entry.type === "suspendActiveTabRuntimeForSwitch"), false);
  assert.equal(harness.calls.some((entry) => entry.type === "syncActiveTabRecord"), false);
  assert.equal(harness.calls.some((entry) => entry.type === "bindTabSessionToState"), false);
  assert.equal(harness.calls.some((entry) => entry.type === "publishActiveTabVisibleState"), false);
  assert.equal(harness.calls.some((entry) => entry.type === "scheduleTabHydration"), false);
  assert.deepEqual(
    harness.calls.filter((entry) => entry.type === "disposeTabPreviewForTab"),
    [{ type: "disposeTabPreviewForTab", tabId: "tab-b" }]
  );
});

test("tab lifecycle runtime forks the active tab into a detached sibling tab", async () => {
  const harness = createLifecycleHarness({
    renameState: {
      tabId: "tab-a",
      draft: "Renamed tab",
    },
  });

  const result = await harness.runtime.forkActiveTab();

  assert.deepEqual(result, {
    ok: true,
    tabId: "tab-new",
    sourceTabId: "tab-a",
    activeTabId: "tab-new",
  });
  assert.deepEqual(harness.tabbedSessions.tabsOrder, ["tab-a", "tab-new", "tab-b", "tab-c"]);
  assert.deepEqual(
    harness.calls.find((entry) => entry.type === "commitSessionTabRename"),
    {
      type: "commitSessionTabRename",
      tabId: "tab-a",
      draft: "Renamed tab",
    }
  );
  assert.deepEqual(
    harness.calls.find((entry) => entry.type === "syncActiveTabRecord"),
    {
      type: "syncActiveTabRecord",
      options: { capture: true, publish: true },
    }
  );
  assert.equal(
    harness.calls.some((entry) => entry.type === "createForkedTabSession" && entry.label === "Fork of Tab A"),
    true
  );
  assert.deepEqual(
    harness.calls.find((entry) => entry.type === "activateTab"),
    {
      type: "activateTab",
      tabId: "tab-new",
      options: {
        spawnEngine: false,
        reason: "fork_tab",
      },
    }
  );
  assert.deepEqual(harness.tabbedSessions.getTab("tab-new"), {
    tabId: "tab-new",
    label: "Fork of Tab A",
    labelManual: true,
    forkedFromTabId: "tab-a",
    runDir: null,
    eventsPath: null,
    session: {
      runDir: null,
      eventsPath: null,
      eventsByteOffset: 0,
      reviewFlowState: "idle",
      tabUiMeta: {
        thumbnailPath: "/thumbs/fork.png",
      },
      label: "Fork of Tab A",
      forkedFromTabId: "tab-a",
    },
    busy: false,
    reviewFlowState: "idle",
    tabUiMeta: {
      thumbnailPath: "/thumbs/fork.png",
      normalized: true,
    },
    thumbnailPath: "/thumbs/fork.png",
  });
});

test("tab lifecycle runtime rolls back a forked tab when activation fails", async () => {
  const harness = createLifecycleHarness({
    activateResult: {
      ok: false,
      reason: "blocked",
    },
  });

  const result = await harness.runtime.forkActiveTab();

  assert.deepEqual(result, {
    ok: false,
    reason: "blocked",
  });
  assert.deepEqual(harness.tabbedSessions.tabsOrder, ["tab-a", "tab-b", "tab-c"]);
  assert.equal(harness.tabbedSessions.getTab("tab-new"), null);
  assert.equal(harness.calls.some((entry) => entry.type === "showToast" && entry.message.includes("Forked")), false);
});
