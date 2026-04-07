import { test } from "node:test";
import assert from "node:assert/strict";

import { handleCanvasAppNativeMenuAction, installCanvasAppBootRuntime } from "../src/app/boot_runtime.js";

test("boot runtime installs listeners and resets runtime state on a real PTY exit", async () => {
  const listeners = new Map();
  const calls = [];
  let flushDeferredEnginePtyExit = null;
  const state = {
    activeTabId: "tab-a",
    pendingPtyExit: false,
    ptySpawning: false,
    desktopSessionBridgeActive: true,
    ptySpawned: true,
    expectingArtifacts: true,
    pendingBlend: { id: "blend" },
    pendingSwapDna: { id: "swap" },
    pendingBridge: { id: "bridge" },
    pendingExtractDna: { id: "extract" },
    pendingSoulLeech: { id: "soul" },
    pendingRecast: { id: "recast" },
    pendingCreateLayers: { id: "layers" },
    pendingPromptGenerate: { id: "prompt" },
    effectTokenApplyLocks: new Map([["fx-1", { lock: true }]]),
    effectTokensById: new Map([["fx-1", { id: "fx-1" }]]),
    runningActionKey: "render",
    engineImageModelRestore: "restore-me",
  };

  const runtime = await installCanvasAppBootRuntime({
    listen: async (eventName, handler) => {
      listeners.set(eventName, handler);
      calls.push({ type: "listen", eventName });
      return () => {};
    },
    desktopSessionUpdateEvent: "desktop-session-update",
    state,
    readPtyStatus: async () => ({ running: false }),
    cachePtyStatus(status) {
      calls.push({ type: "cachePtyStatus", status });
    },
    setStatus(message, isError) {
      calls.push({ type: "setStatus", message, isError });
    },
    resetDescribeQueue(payload) {
      calls.push({ type: "resetDescribeQueue", payload });
    },
    recoverEffectTokenApply(token) {
      calls.push({ type: "recoverEffectTokenApply", token });
    },
    clearPendingReplace() {
      calls.push("clearPendingReplace");
    },
    setImageFxActive(value) {
      calls.push({ type: "setImageFxActive", value });
    },
    updatePortraitIdle() {
      calls.push("updatePortraitIdle");
    },
    setDirectorText(primary, secondary) {
      calls.push({ type: "setDirectorText", primary, secondary });
    },
    renderQuickActions() {
      calls.push("renderQuickActions");
    },
    handleDesktopSessionBridgeUpdate(event) {
      calls.push({ type: "handleDesktopSessionBridgeUpdate", event });
    },
    handleDesktopAutomation(event) {
      calls.push({ type: "handleDesktopAutomation", event });
    },
    parseNativeSlotIndex: () => -1,
    bumpInteraction() {
      calls.push("bumpInteraction");
    },
    runWithUserError(label, task, options) {
      calls.push({ type: "runWithUserError", label, options });
      return task();
    },
    runNativeToolSlot(index) {
      calls.push({ type: "runNativeToolSlot", index });
    },
    runNativeShortcutSlot(index) {
      calls.push({ type: "runNativeShortcutSlot", index });
    },
    applyRailIconPackSetting(value, meta) {
      calls.push({ type: "applyRailIconPackSetting", value, meta });
    },
    createRun() {
      calls.push("createRun");
    },
    openExistingRun() {
      calls.push("openExistingRun");
    },
    saveActiveSessionSnapshot(payload) {
      calls.push({ type: "saveActiveSessionSnapshot", payload });
    },
    closeTab(tabId) {
      calls.push({ type: "closeTab", tabId });
    },
    requestJuggernautExport(payload) {
      calls.push({ type: "requestJuggernautExport", payload });
    },
    juggernautExportRetryHint(format) {
      calls.push({ type: "juggernautExportRetryHint", format });
      return "retry export";
    },
    showCreateToolPanel() {
      calls.push("showCreateToolPanel");
    },
    importPhotos() {
      calls.push("importPhotos");
    },
    settingsToggleEl: null,
    setFlushDeferredEnginePtyExit(handler) {
      flushDeferredEnginePtyExit = handler;
    },
    consoleObj: {
      info(...args) {
        calls.push({ type: "console.info", args });
      },
      log(...args) {
        calls.push({ type: "console.log", args });
      },
    },
  });

  assert.equal(typeof runtime.handleEnginePtyExit, "function");
  assert.equal(typeof runtime.flushDeferredEnginePtyExit, "function");
  assert.equal(typeof flushDeferredEnginePtyExit, "function");
  assert.deepEqual(
    Array.from(listeners.keys()),
    ["pty-exit", "desktop-session-update", "desktop-automation", "native-menu-action"]
  );

  await listeners.get("pty-exit")();

  assert.deepEqual(calls.find((entry) => entry?.type === "cachePtyStatus"), {
    type: "cachePtyStatus",
    status: { running: false, run_dir: null, events_path: null, detail: null },
  });
  assert.deepEqual(calls.find((entry) => entry?.type === "setStatus"), {
    type: "setStatus",
    message: "Engine: exited",
    isError: true,
  });
  assert.deepEqual(calls.find((entry) => entry?.type === "resetDescribeQueue"), {
    type: "resetDescribeQueue",
    payload: { clearPending: true },
  });
  assert.deepEqual(calls.find((entry) => entry?.type === "recoverEffectTokenApply"), {
    type: "recoverEffectTokenApply",
    token: { id: "fx-1" },
  });
  assert.equal(calls.includes("clearPendingReplace"), true);
  assert.deepEqual(calls.find((entry) => entry?.type === "setImageFxActive"), {
    type: "setImageFxActive",
    value: false,
  });
  assert.deepEqual(calls.find((entry) => entry?.type === "setDirectorText"), {
    type: "setDirectorText",
    primary: null,
    secondary: null,
  });
  assert.equal(calls.includes("updatePortraitIdle"), true);
  assert.equal(calls.includes("renderQuickActions"), true);
  assert.equal(state.pendingPtyExit, false);
  assert.equal(state.desktopSessionBridgeActive, false);
  assert.equal(state.ptySpawned, false);
  assert.equal(state.expectingArtifacts, false);
  assert.equal(state.pendingBlend, null);
  assert.equal(state.pendingSwapDna, null);
  assert.equal(state.pendingBridge, null);
  assert.equal(state.pendingExtractDna, null);
  assert.equal(state.pendingSoulLeech, null);
  assert.equal(state.pendingRecast, null);
  assert.equal(state.pendingCreateLayers, null);
  assert.equal(state.pendingPromptGenerate, null);
  assert.equal(state.effectTokenApplyLocks.size, 0);
  assert.equal(state.runningActionKey, null);
  assert.equal(state.engineImageModelRestore, null);

  await listeners.get("desktop-session-update")({ payload: { ok: true } });
  assert.deepEqual(calls.find((entry) => entry?.type === "handleDesktopSessionBridgeUpdate"), {
    type: "handleDesktopSessionBridgeUpdate",
    event: { payload: { ok: true } },
  });

  listeners.get("desktop-automation")({ payload: { requestId: "auto-1" } });
  assert.deepEqual(calls.find((entry) => entry?.type === "handleDesktopAutomation"), {
    type: "handleDesktopAutomation",
    event: { payload: { requestId: "auto-1" } },
  });
});

test("boot runtime treats stopped desktop session status updates as real engine exits", async () => {
  const listeners = new Map();
  const calls = [];
  const state = {
    activeTabId: "tab-a",
    pendingPtyExit: false,
    ptySpawning: false,
    desktopSessionBridgeActive: true,
    ptySpawned: true,
    expectingArtifacts: true,
    pendingBlend: { id: "blend" },
    pendingSwapDna: { id: "swap" },
    pendingBridge: { id: "bridge" },
    pendingExtractDna: { id: "extract" },
    pendingSoulLeech: { id: "soul" },
    pendingRecast: { id: "recast" },
    pendingCreateLayers: { id: "layers" },
    pendingPromptGenerate: { id: "prompt" },
    effectTokenApplyLocks: new Map([["fx-1", { lock: true }]]),
    effectTokensById: new Map([["fx-1", { id: "fx-1" }]]),
    runningActionKey: "render",
    engineImageModelRestore: "restore-me",
    engineLaunchMode: "native",
    engineLaunchPath: null,
  };

  await installCanvasAppBootRuntime({
    listen: async (eventName, handler) => {
      listeners.set(eventName, handler);
      return () => {};
    },
    desktopSessionUpdateEvent: "desktop-session-update",
    state,
    readPtyStatus: async () => ({ running: true }),
    cachePtyStatus(status) {
      calls.push({ type: "cachePtyStatus", status });
    },
    setStatus(message, isError) {
      calls.push({ type: "setStatus", message, isError });
    },
    resetDescribeQueue(payload) {
      calls.push({ type: "resetDescribeQueue", payload });
    },
    recoverEffectTokenApply(token) {
      calls.push({ type: "recoverEffectTokenApply", token });
    },
    clearPendingReplace() {
      calls.push("clearPendingReplace");
    },
    setImageFxActive(value) {
      calls.push({ type: "setImageFxActive", value });
    },
    updatePortraitIdle() {
      calls.push("updatePortraitIdle");
    },
    setDirectorText(primary, secondary) {
      calls.push({ type: "setDirectorText", primary, secondary });
    },
    renderQuickActions() {
      calls.push("renderQuickActions");
    },
    handleDesktopSessionBridgeUpdate(event) {
      calls.push({ type: "handleDesktopSessionBridgeUpdate", event });
      return {
        kind: "status",
        update: {
          kind: "status",
          runDir: "/runs/a",
          detail: "daemon stopped",
          launch: {
            mode: "native",
            label: "Cue Desktop",
          },
        },
        status: {
          running: false,
          detail: "daemon stopped",
        },
      };
    },
    handleDesktopAutomation() {},
    parseNativeSlotIndex: () => -1,
    bumpInteraction() {},
    runWithUserError() {},
    runNativeToolSlot() {},
    runNativeShortcutSlot() {},
    applyRailIconPackSetting() {},
    createRun() {},
    openExistingRun() {},
    saveActiveSessionSnapshot() {},
    closeTab() {},
    requestJuggernautExport() {},
    juggernautExportRetryHint() {
      return "retry";
    },
    showCreateToolPanel() {},
    importPhotos() {},
    settingsToggleEl: null,
    consoleObj: {
      info(...args) {
        calls.push({ type: "console.info", args });
      },
      log() {},
    },
  });

  await listeners.get("desktop-session-update")({ payload: { ok: true } });

  assert.equal(state.engineLaunchMode, "native");
  assert.equal(state.engineLaunchPath, "Cue Desktop");
  assert.equal(state.pendingPtyExit, false);
  assert.equal(state.desktopSessionBridgeActive, false);
  assert.equal(state.ptySpawned, false);
  assert.equal(state.expectingArtifacts, false);
  assert.equal(state.pendingBlend, null);
  assert.equal(state.pendingSwapDna, null);
  assert.equal(state.pendingBridge, null);
  assert.equal(state.pendingExtractDna, null);
  assert.equal(state.pendingSoulLeech, null);
  assert.equal(state.pendingRecast, null);
  assert.equal(state.pendingCreateLayers, null);
  assert.equal(state.pendingPromptGenerate, null);
  assert.equal(state.effectTokenApplyLocks.size, 0);
  assert.equal(state.runningActionKey, null);
  assert.equal(state.engineImageModelRestore, null);
  assert.deepEqual(calls.find((entry) => entry?.type === "setStatus"), {
    type: "setStatus",
    message: "Engine: exited (daemon stopped)",
    isError: true,
  });
  assert.deepEqual(calls.find((entry) => entry?.type === "resetDescribeQueue"), {
    type: "resetDescribeQueue",
    payload: { clearPending: true },
  });
  assert.deepEqual(calls.find((entry) => entry?.type === "recoverEffectTokenApply"), {
    type: "recoverEffectTokenApply",
    token: { id: "fx-1" },
  });
  assert.deepEqual(calls.find((entry) => entry?.type === "setImageFxActive"), {
    type: "setImageFxActive",
    value: false,
  });
  assert.deepEqual(calls.find((entry) => entry?.type === "setDirectorText"), {
    type: "setDirectorText",
    primary: null,
    secondary: null,
  });
  assert.equal(calls.includes("clearPendingReplace"), true);
  assert.equal(calls.includes("updatePortraitIdle"), true);
  assert.equal(calls.includes("renderQuickActions"), true);
  assert.equal(calls.some((entry) => entry?.type === "console.info"), false);
});

test("boot runtime ignores stale PTY exit events and clears deferred state without resetting runtime", async () => {
  const listeners = new Map();
  const calls = [];
  const state = {
    pendingPtyExit: true,
    ptySpawning: false,
    desktopSessionBridgeActive: true,
    ptySpawned: true,
    effectTokenApplyLocks: new Map(),
    effectTokensById: new Map(),
  };

  await installCanvasAppBootRuntime({
    listen: async (eventName, handler) => {
      listeners.set(eventName, handler);
      return () => {};
    },
    desktopSessionUpdateEvent: "desktop-session-update",
    state,
    readPtyStatus: async () => ({ running: true }),
    cachePtyStatus(status) {
      calls.push({ type: "cachePtyStatus", status });
    },
    setStatus(message, isError) {
      calls.push({ type: "setStatus", message, isError });
    },
    resetDescribeQueue() {},
    recoverEffectTokenApply() {},
    clearPendingReplace() {},
    setImageFxActive() {},
    updatePortraitIdle() {},
    setDirectorText() {},
    renderQuickActions() {},
    handleDesktopSessionBridgeUpdate() {},
    handleDesktopAutomation() {},
    parseNativeSlotIndex: () => -1,
    bumpInteraction() {},
    runWithUserError() {},
    runNativeToolSlot() {},
    runNativeShortcutSlot() {},
    applyRailIconPackSetting() {},
    createRun() {},
    openExistingRun() {},
    saveActiveSessionSnapshot() {},
    closeTab() {},
    requestJuggernautExport() {},
    juggernautExportRetryHint() {
      return "retry";
    },
    showCreateToolPanel() {},
    importPhotos() {},
    settingsToggleEl: null,
    consoleObj: {
      info(...args) {
        calls.push({ type: "console.info", args });
      },
      log() {},
    },
  });

  await listeners.get("pty-exit")();

  assert.equal(state.pendingPtyExit, false);
  assert.equal(calls.some((entry) => entry?.type === "cachePtyStatus"), false);
  assert.equal(calls.some((entry) => entry?.type === "setStatus"), false);
  assert.deepEqual(calls.find((entry) => entry?.type === "console.info"), {
    type: "console.info",
    args: ["[brood] ignored stale pty-exit while PTY remains running"],
  });
});

test("boot runtime forwards native menu events to an injected action adapter", async () => {
  const listeners = new Map();
  const calls = [];

  await installCanvasAppBootRuntime({
    listen: async (eventName, handler) => {
      listeners.set(eventName, handler);
      return () => {};
    },
    desktopSessionUpdateEvent: "desktop-session-update",
    state: {
      effectTokenApplyLocks: new Map(),
      effectTokensById: new Map(),
    },
    readPtyStatus: async () => ({ running: false }),
    cachePtyStatus() {},
    setStatus() {},
    resetDescribeQueue() {},
    recoverEffectTokenApply() {},
    clearPendingReplace() {},
    setImageFxActive() {},
    updatePortraitIdle() {},
    setDirectorText() {},
    renderQuickActions() {},
    handleDesktopSessionBridgeUpdate() {
      return null;
    },
    handleDesktopAutomation() {},
    handleNativeMenuAction(event) {
      calls.push(event);
    },
    consoleObj: {
      info() {},
      log() {},
    },
  });

  listeners.get("native-menu-action")({ payload: "open_settings" });

  assert.deepEqual(calls, [{ payload: "open_settings" }]);
});

test("native menu action helper routes tool slots, settings, and exports through the existing runtime hooks", async () => {
  const calls = [];
  const settingsToggleEl = {
    click() {
      calls.push("settingsToggle.click");
    },
  };
  const runWithUserError = (label, task, options) => {
    calls.push({ type: "runWithUserError", label, options });
    return task();
  };
  const deps = {
    parseNativeSlotIndex(action, prefix) {
      return action.startsWith(prefix) ? Number(action.slice(prefix.length)) : -1;
    },
    bumpInteraction() {
      calls.push("bumpInteraction");
    },
    runWithUserError,
    runNativeToolSlot(index) {
      calls.push({ type: "runNativeToolSlot", index });
    },
    runNativeShortcutSlot(index) {
      calls.push({ type: "runNativeShortcutSlot", index });
    },
    applyRailIconPackSetting(value, meta) {
      calls.push({ type: "applyRailIconPackSetting", value, meta });
    },
    createRun() {
      calls.push("createRun");
    },
    openExistingRun() {
      calls.push("openExistingRun");
    },
    saveActiveSessionSnapshot(payload) {
      calls.push({ type: "saveActiveSessionSnapshot", payload });
    },
    closeTab(tabId) {
      calls.push({ type: "closeTab", tabId });
    },
    getActiveTabId() {
      return "tab-z";
    },
    requestJuggernautExport(payload) {
      calls.push({ type: "requestJuggernautExport", payload });
    },
    juggernautExportRetryHint(format) {
      calls.push({ type: "juggernautExportRetryHint", format });
      return "retry export";
    },
    showCreateToolPanel() {
      calls.push("showCreateToolPanel");
    },
    importPhotos() {
      calls.push("importPhotos");
    },
    settingsToggleEl,
  };

  handleCanvasAppNativeMenuAction({ payload: "tools_slot_3" }, deps);
  handleCanvasAppNativeMenuAction({ payload: { action: "settings_icon_pack:oscillo_ink" } }, deps);
  handleCanvasAppNativeMenuAction({ payload: "export_psd" }, deps);
  handleCanvasAppNativeMenuAction({ payload: "open_settings" }, deps);

  assert.deepEqual(calls, [
    "bumpInteraction",
    {
      type: "runWithUserError",
      label: "Tool",
      options: { retryHint: "Adjust the canvas state and retry." },
    },
    { type: "runNativeToolSlot", index: 3 },
    "bumpInteraction",
    {
      type: "applyRailIconPackSetting",
      value: "oscillo_ink",
      meta: { source: "native_menu" },
    },
    "bumpInteraction",
    {
      type: "juggernautExportRetryHint",
      format: "psd",
    },
    {
      type: "runWithUserError",
      label: "Export session",
      options: { retryHint: "retry export" },
    },
    {
      type: "requestJuggernautExport",
      payload: { format: "psd", source: "native_menu" },
    },
    "bumpInteraction",
    "settingsToggle.click",
  ]);
});
