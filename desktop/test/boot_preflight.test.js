import { test } from "node:test";
import assert from "node:assert/strict";

import { runCanvasAppBootPreflight } from "../src/app/boot_preflight.js";

test("boot preflight wires the startup bridges, observers, and effects runtime", () => {
  const calls = [];
  const intervalToken = { id: "top-metrics-timer" };
  const observers = [];
  const hudShell = { id: "hud-shell" };
  const previousBrandObserver = {
    disconnect() {
      calls.push("disconnect:brand");
    },
  };
  const previousHudObserver = {
    disconnect() {
      calls.push("disconnect:hud");
    },
  };
  class ResizeObserverMock {
    constructor(handler) {
      this.handler = handler;
      this.targets = [];
      observers.push(this);
    }
    observe(target) {
      this.targets.push(target);
    }
    disconnect() {
      calls.push(`disconnect:new:${this.targets[0]?.id || "unknown"}`);
    }
  }
  const effectsRuntime = {
    resize(payload) {
      calls.push({ type: "effects:resize", payload });
    },
    setSuspended(value) {
      calls.push({ type: "effects:suspend", value });
    },
  };

  const result = runCanvasAppBootPreflight({
    windowObj: { id: "window" },
    documentObj: { hidden: false },
    CustomEventCtor: function CustomEventMock() {},
    ResizeObserverCtor: ResizeObserverMock,
    requestAnimationFrameFn(callback) {
      calls.push("requestAnimationFrame");
      callback();
      return 1;
    },
    clearIntervalFn(timer) {
      calls.push({ type: "clearInterval", timer });
    },
    setIntervalFn(callback, delay) {
      calls.push({ type: "setInterval", delay });
      assert.equal(typeof callback, "function");
      return intervalToken;
    },
    dom: {
      brandStrip: { id: "brand-strip" },
      workCanvas: { width: 1440, height: 900 },
      effectsCanvas: { id: "effects-canvas" },
      hud: {
        querySelector(selector) {
          return selector === ".hud-shell" ? hudShell : null;
        },
      },
    },
    state: {
      canvasMode: "multi",
    },
    topMetricsTickTimer: "old-timer",
    brandStripResizeObserver: previousBrandObserver,
    hudResizeObserver: previousHudObserver,
    setStatus(value) {
      calls.push({ type: "setStatus", value });
    },
    setRunInfo(value) {
      calls.push({ type: "setRunInfo", value });
    },
    ensureInstallTelemetryReady() {
      calls.push("ensureInstallTelemetryReady");
      return Promise.resolve();
    },
    renderInstallTelemetryStatus() {
      calls.push("renderInstallTelemetryStatus");
    },
    ensureIntentUiIconsLoaded() {
      calls.push("ensureIntentUiIconsLoaded");
      return Promise.resolve();
    },
    refreshKeyStatus() {
      calls.push("refreshKeyStatus");
      return Promise.resolve();
    },
    updateAlwaysOnVisionReadout() {
      calls.push("updateAlwaysOnVisionReadout");
    },
    renderQuickActions() {
      calls.push("renderQuickActions");
    },
    applyRuntimeChromeVisibility(payload) {
      calls.push({ type: "applyRuntimeChromeVisibility", payload });
    },
    installToolApplyBridge(payload) {
      calls.push({ type: "installToolApplyBridge", payload });
    },
    applyToolRuntimeEdit() {},
    installAgentObservableDriverRuntime() {
      calls.push("installAgentObservableDriverRuntime");
    },
    publishAgentRunnerBridge() {
      calls.push("publishAgentRunnerBridge");
    },
    renderSessionApiCallsReadout() {
      calls.push("renderSessionApiCallsReadout");
    },
    syncBrandStripHeightVar() {
      calls.push("syncBrandStripHeightVar");
    },
    ensurePortraitIndex() {
      calls.push("ensurePortraitIndex");
      return Promise.resolve();
    },
    updatePortraitIdle(payload) {
      calls.push({ type: "updatePortraitIdle", payload });
    },
    syncIntentModeClass() {
      calls.push("syncIntentModeClass");
    },
    updateEmptyCanvasHint() {
      calls.push("updateEmptyCanvasHint");
    },
    renderSelectionMeta() {
      calls.push("renderSelectionMeta");
    },
    chooseSpawnNodes() {
      calls.push("chooseSpawnNodes");
    },
    renderFilmstrip() {
      calls.push("renderFilmstrip");
    },
    renderAgentRunnerPlannerOptions() {
      calls.push("renderAgentRunnerPlannerOptions");
    },
    renderAgentRunnerPanel() {
      calls.push("renderAgentRunnerPanel");
    },
    ensureCanvasSize() {
      calls.push("ensureCanvasSize");
    },
    createEffectsRuntime(payload) {
      calls.push({ type: "createEffectsRuntime", payload });
      return effectsRuntime;
    },
    getDpr() {
      return 2;
    },
    syncHudHeightVar() {
      calls.push("syncHudHeightVar");
    },
    installDprWatcher() {
      calls.push("installDprWatcher");
    },
  });

  assert.deepEqual(result, {
    effectsRuntime,
    topMetricsTickTimer: intervalToken,
    brandStripResizeObserver: observers[0],
    hudResizeObserver: observers[1],
  });
  assert.deepEqual(calls[0], { type: "setStatus", value: "Engine: booting…" });
  assert.deepEqual(calls[1], { type: "setRunInfo", value: "No run" });
  assert.equal(calls.includes("ensureInstallTelemetryReady"), true);
  assert.equal(calls.includes("renderInstallTelemetryStatus"), true);
  assert.equal(calls.includes("ensureIntentUiIconsLoaded"), true);
  assert.equal(calls.includes("refreshKeyStatus"), true);
  assert.equal(calls.includes("renderQuickActions"), true);
  assert.deepEqual(calls.find((entry) => entry?.type === "applyRuntimeChromeVisibility")?.payload, { source: "boot" });
  assert.deepEqual(calls.find((entry) => entry?.type === "installToolApplyBridge")?.payload?.windowObj, { id: "window" });
  assert.equal(typeof calls.find((entry) => entry?.type === "installToolApplyBridge")?.payload?.applyToolRuntimeEdit, "function");
  assert.equal(calls.includes("installAgentObservableDriverRuntime"), true);
  assert.equal(calls.includes("publishAgentRunnerBridge"), true);
  assert.deepEqual(calls.find((entry) => entry?.type === "clearInterval"), { type: "clearInterval", timer: "old-timer" });
  assert.deepEqual(calls.find((entry) => entry?.type === "setInterval"), { type: "setInterval", delay: 15_000 });
  assert.equal(calls.includes("disconnect:brand"), true);
  assert.equal(calls.includes("disconnect:hud"), true);
  assert.deepEqual(calls.find((entry) => entry?.type === "createEffectsRuntime"), {
    type: "createEffectsRuntime",
    payload: { canvas: { id: "effects-canvas" } },
  });
  assert.deepEqual(calls.find((entry) => entry?.type === "effects:resize"), {
    type: "effects:resize",
    payload: { width: 1440, height: 900, dpr: 2 },
  });
  assert.deepEqual(calls.find((entry) => entry?.type === "effects:suspend"), {
    type: "effects:suspend",
    value: false,
  });
  assert.equal(calls.includes("syncHudHeightVar"), true);
  assert.equal(calls.includes("installDprWatcher"), true);
  assert.deepEqual(observers[0].targets, [{ id: "brand-strip" }]);
  assert.deepEqual(observers[1].targets, [hudShell]);
});
