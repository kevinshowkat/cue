import { test } from "node:test";
import assert from "node:assert/strict";

import { runCanvasAppBootReadySequence } from "../src/app/boot_ready.js";

test("boot ready sequence provisions the first run, installs shell integrations, and reports readiness", async () => {
  const calls = [];
  const consoleCalls = [];

  await runCanvasAppBootReadySequence({
    railIconPack: "oscillo_ink",
    async syncNativeIconographyMenu(value) {
      calls.push({ type: "syncNativeIconographyMenu", value });
    },
    async ensureRun() {
      calls.push("ensureRun");
    },
    installJuggernautShellBridge() {
      calls.push("installJuggernautShellBridge");
    },
    installBuiltInSingleImageRailIntegration() {
      calls.push("installBuiltInSingleImageRailIntegration");
    },
    renderQuickActions() {
      calls.push("renderQuickActions");
    },
    applyRuntimeChromeVisibility(payload) {
      calls.push({ type: "applyRuntimeChromeVisibility", payload });
    },
    setTimeoutFn(callback, delay) {
      calls.push({ type: "setTimeout", delay });
      callback();
      return 1;
    },
    maybeAutoOpenOpenRouterOnboarding() {
      calls.push("maybeAutoOpenOpenRouterOnboarding");
    },
    invokeFn(command, payload) {
      calls.push({ type: "invoke", command, payload });
      return Promise.resolve();
    },
    requestRender() {
      calls.push("requestRender");
    },
    consoleObj: {
      warn(...args) {
        consoleCalls.push(args);
      },
    },
  });

  assert.deepEqual(calls, [
    { type: "syncNativeIconographyMenu", value: "oscillo_ink" },
    "ensureRun",
    "installJuggernautShellBridge",
    "installBuiltInSingleImageRailIntegration",
    "renderQuickActions",
    { type: "applyRuntimeChromeVisibility", payload: { source: "bridge_ready" } },
    { type: "setTimeout", delay: 140 },
    "maybeAutoOpenOpenRouterOnboarding",
    { type: "invoke", command: "report_automation_frontend_ready", payload: { ready: true } },
    "requestRender",
  ]);
  assert.deepEqual(consoleCalls, []);
});

test("boot ready sequence logs readiness handshake failures without breaking the boot tail", async () => {
  const consoleCalls = [];
  let requestRenderCalled = false;

  await runCanvasAppBootReadySequence({
    async syncNativeIconographyMenu() {},
    async ensureRun() {},
    installJuggernautShellBridge() {},
    installBuiltInSingleImageRailIntegration() {},
    renderQuickActions() {},
    applyRuntimeChromeVisibility() {},
    setTimeoutFn(callback) {
      callback();
      return 1;
    },
    maybeAutoOpenOpenRouterOnboarding() {},
    invokeFn() {
      return Promise.reject(new Error("handshake unavailable"));
    },
    requestRender() {
      requestRenderCalled = true;
    },
    consoleObj: {
      warn(...args) {
        consoleCalls.push(args);
      },
    },
  });

  assert.equal(requestRenderCalled, true);
  assert.equal(consoleCalls.length, 1);
  assert.equal(consoleCalls[0][0], "desktop automation readiness handshake failed");
  assert.match(String(consoleCalls[0][1]?.message || ""), /handshake unavailable/);
});
