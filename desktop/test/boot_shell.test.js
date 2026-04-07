import { test } from "node:test";
import assert from "node:assert/strict";

import { runCanvasAppBootShellSetup } from "../src/app/boot_shell.js";

test("boot shell setup installs local observers, shell UI, and initial startup loops", async () => {
  const calls = [];
  const listeners = new Map();
  const observers = [];
  class ResizeObserverMock {
    constructor(handler) {
      this.handler = handler;
      this.targets = [];
      observers.push(this);
    }
    observe(target) {
      this.targets.push(target);
    }
  }
  const effectsRuntime = {
    setSuspended(value) {
      calls.push({ type: "effects:setSuspended", value });
    },
  };
  const documentObj = {
    hidden: false,
    addEventListener(type, handler) {
      listeners.set(type, handler);
      calls.push({ type: "addEventListener", eventType: type });
    },
  };

  await runCanvasAppBootShellSetup({
    documentObj,
    ResizeObserverCtor: ResizeObserverMock,
    dom: {
      canvasWrap: { id: "canvas-wrap" },
    },
    state: {
      canvasMode: "multi",
    },
    effectsRuntime,
    stopLarvaAnimator() {
      calls.push("stopLarvaAnimator");
    },
    stopMotherGlitchLoop() {
      calls.push("stopMotherGlitchLoop");
    },
    ensureLarvaAnimator() {
      calls.push("ensureLarvaAnimator");
    },
    startMotherGlitchLoop() {
      calls.push("startMotherGlitchLoop");
    },
    ensureCanvasSize() {
      calls.push("ensureCanvasSize");
    },
    scheduleVisualPromptWrite() {
      calls.push("scheduleVisualPromptWrite");
    },
    requestRender() {
      calls.push("requestRender");
    },
    ensureBootShellTab() {
      calls.push("ensureBootShellTab");
    },
    installCanvasHandlers() {
      calls.push("installCanvasHandlers");
    },
    installDnD() {
      calls.push("installDnD");
    },
    installUi() {
      calls.push("installUi");
    },
    installJuggernautShellUi() {
      calls.push("installJuggernautShellUi");
    },
    renderCommunicationChrome() {
      calls.push("renderCommunicationChrome");
    },
    renderMotherMoodStatus() {
      calls.push("renderMotherMoodStatus");
    },
    setMotherMoodMenuOpen(value) {
      calls.push({ type: "setMotherMoodMenuOpen", value });
    },
    async initializeFileBrowserDock() {
      calls.push("initializeFileBrowserDock");
    },
    enableFileBrowserDock: true,
    startSpawnTimer() {
      calls.push("startSpawnTimer");
    },
  });

  assert.deepEqual(calls[0], { type: "addEventListener", eventType: "visibilitychange" });
  assert.deepEqual(observers[0].targets, [{ id: "canvas-wrap" }]);
  observers[0].handler();
  assert.equal(calls.includes("ensureCanvasSize"), true);
  assert.equal(calls.includes("scheduleVisualPromptWrite"), true);
  assert.equal(calls.includes("requestRender"), true);
  assert.equal(calls.includes("ensureBootShellTab"), true);
  assert.equal(calls.includes("installCanvasHandlers"), true);
  assert.equal(calls.includes("installDnD"), true);
  assert.equal(calls.includes("installUi"), true);
  assert.equal(calls.includes("installJuggernautShellUi"), true);
  assert.equal(calls.includes("renderCommunicationChrome"), true);
  assert.equal(calls.includes("renderMotherMoodStatus"), true);
  assert.deepEqual(calls.find((entry) => entry?.type === "setMotherMoodMenuOpen"), {
    type: "setMotherMoodMenuOpen",
    value: false,
  });
  assert.equal(calls.includes("initializeFileBrowserDock"), true);
  assert.equal(calls.includes("startMotherGlitchLoop"), true);
  assert.equal(calls.includes("startSpawnTimer"), true);

  const visibilityHandler = listeners.get("visibilitychange");
  assert.equal(typeof visibilityHandler, "function");

  documentObj.hidden = true;
  visibilityHandler();
  assert.equal(calls.includes("stopLarvaAnimator"), true);
  assert.equal(calls.includes("stopMotherGlitchLoop"), true);
  assert.deepEqual(calls.findLast((entry) => entry?.type === "effects:setSuspended"), {
    type: "effects:setSuspended",
    value: true,
  });

  documentObj.hidden = false;
  visibilityHandler();
  assert.equal(calls.includes("ensureLarvaAnimator"), true);
  assert.deepEqual(calls.findLast((entry) => entry?.type === "effects:setSuspended"), {
    type: "effects:setSuspended",
    value: false,
  });
});

test("boot shell setup keeps wiring later shell steps when an earlier optional installer throws", async () => {
  const calls = [];
  const consoleCalls = [];

  await runCanvasAppBootShellSetup({
    documentObj: {
      hidden: false,
      addEventListener() {},
    },
    dom: {
      canvasWrap: { id: "canvas-wrap" },
    },
    state: {
      canvasMode: "multi",
    },
    stopLarvaAnimator() {},
    stopMotherGlitchLoop() {},
    ensureLarvaAnimator() {},
    startMotherGlitchLoop() {
      calls.push("startMotherGlitchLoop");
    },
    ensureCanvasSize() {},
    scheduleVisualPromptWrite() {},
    requestRender() {},
    ensureBootShellTab() {
      calls.push("ensureBootShellTab");
    },
    installCanvasHandlers() {
      calls.push("installCanvasHandlers");
      throw new Error("pointer setup failed");
    },
    installDnD() {
      calls.push("installDnD");
    },
    installUi() {
      calls.push("installUi");
    },
    installJuggernautShellUi() {
      calls.push("installJuggernautShellUi");
    },
    renderCommunicationChrome() {
      calls.push("renderCommunicationChrome");
    },
    renderMotherMoodStatus() {
      calls.push("renderMotherMoodStatus");
    },
    setMotherMoodMenuOpen(value) {
      calls.push({ type: "setMotherMoodMenuOpen", value });
    },
    startSpawnTimer() {
      calls.push("startSpawnTimer");
    },
    consoleObj: {
      error(...args) {
        consoleCalls.push(args);
      },
    },
  });

  assert.equal(calls.includes("ensureBootShellTab"), true);
  assert.equal(calls.includes("installDnD"), true);
  assert.equal(calls.includes("installUi"), true);
  assert.equal(calls.includes("installJuggernautShellUi"), true);
  assert.equal(calls.includes("renderCommunicationChrome"), true);
  assert.equal(calls.includes("renderMotherMoodStatus"), true);
  assert.deepEqual(calls.find((entry) => entry?.type === "setMotherMoodMenuOpen"), {
    type: "setMotherMoodMenuOpen",
    value: false,
  });
  assert.equal(calls.includes("startSpawnTimer"), true);
  assert.equal(consoleCalls.length, 1);
  assert.equal(consoleCalls[0][0], "Cue boot shell setup failed during installCanvasHandlers:");
  assert.match(String(consoleCalls[0][1]?.message || ""), /pointer setup failed/);
});
