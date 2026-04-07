import { test } from "node:test";
import assert from "node:assert/strict";

import { createCanvasApp } from "../src/app/create_canvas_app.js";

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    toggle(value, force) {
      if (force === undefined) {
        if (values.has(value)) values.delete(value);
        else values.add(value);
        return values.has(value);
      }
      if (force) values.add(value);
      else values.delete(value);
      return force;
    },
    contains(value) {
      return values.has(value);
    },
  };
}

function createDocumentMock() {
  const ids = new Map();
  const bootError = {
    id: "boot-error",
    textContent: "Cue failed to initialize. Check the terminal for errors.",
    classList: createClassList(["hidden"]),
  };
  ids.set("boot-error", bootError);
  for (const id of [
    "app",
    "session-tab-list",
    "session-tab-new",
    "session-tab-fork",
    "canvas-wrap",
    "drop-hint",
    "work-canvas",
    "effects-canvas",
    "overlay-canvas",
    "action-grid",
    "timeline-dock",
    "toast",
  ]) {
    ids.set(id, { id });
  }
  return {
    body: {
      classList: createClassList(["boot-pending"]),
    },
    getElementById(id) {
      return ids.get(id) || null;
    },
    querySelector(selector) {
      if (selector === ".brand-strip") return { className: "brand-strip" };
      return null;
    },
  };
}

test("create canvas app: boot validates DOM, syncs settings, and marks runtime ready", async () => {
  const documentObj = createDocumentMock();
  let bridgeInstalls = 0;
  const app = createCanvasApp({
    documentObj,
    storage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
    normalizeRailIconPackId: (value) => String(value || "").trim() || "default_classic",
    defaultRailIconPackId: "default_classic",
    installBridges: [
      async ({ dom, store }) => {
        bridgeInstalls += 1;
        assert.equal(dom.sessionTabList?.id, "session-tab-list");
        assert.equal(store.getState().boot.phase, "booting");
      },
    ],
  });

  const result = await app.boot();

  assert.equal(result, app);
  assert.equal(bridgeInstalls, 1);
  assert.equal(app.store.getState().boot.phase, "ready");
  assert.equal(app.store.getState().runtime.ready, true);
  assert.equal(app.store.getState().settings.railIconPack, "default_classic");
  assert.equal(documentObj.body.classList.contains("boot-pending"), false);
  assert.equal(documentObj.body.classList.contains("boot-failed"), false);
  assert.equal(documentObj.getElementById("boot-error")?.classList.contains("hidden"), true);
});

test("create canvas app: boot failure exposes the boot error path", async () => {
  const documentObj = createDocumentMock();
  let capturedError = null;
  const app = createCanvasApp({
    documentObj,
    storage: {
      getItem() {
        return null;
      },
      setItem() {},
    },
    normalizeRailIconPackId: (value) => String(value || "").trim() || "default_classic",
    defaultRailIconPackId: "default_classic",
    onBoot() {
      throw new Error("missing canvas runtime adapter");
    },
    onFatalBootError({ error }) {
      capturedError = error;
    },
  });

  await assert.rejects(() => app.boot(), /missing canvas runtime adapter/);

  assert.equal(app.store.getState().boot.phase, "failed");
  assert.equal(capturedError?.message, "missing canvas runtime adapter");
  assert.equal(documentObj.body.classList.contains("boot-failed"), true);
  assert.equal(documentObj.getElementById("boot-error")?.classList.contains("hidden"), false);
  assert.match(documentObj.getElementById("boot-error")?.textContent || "", /missing canvas runtime adapter/);
});

test("create canvas app: provided dom and settings store are used before boot callback runs", async () => {
  const documentObj = createDocumentMock();
  const providedDom = {
    sessionTabList: { id: "provided-session-tab-list" },
    appRoot: { id: "provided-app" },
    brandStrip: { className: "brand-strip" },
    sessionTabNew: { id: "provided-session-tab-new" },
    sessionTabFork: { id: "provided-session-tab-fork" },
    canvasWrap: { id: "provided-canvas-wrap" },
    dropHint: { id: "provided-drop-hint" },
    workCanvas: { id: "provided-work-canvas" },
    effectsCanvas: { id: "provided-effects-canvas" },
    overlayCanvas: { id: "provided-overlay-canvas" },
    actionGrid: { id: "provided-action-grid" },
    timelineDock: { id: "provided-timeline-dock" },
    toast: { id: "provided-toast" },
  };
  const settingsState = { railIconPack: "oscillo_ink" };
  const settingsStore = {
    getState() {
      return settingsState;
    },
  };
  const calls = [];
  const app = createCanvasApp({
    documentObj,
    dom: providedDom,
    settingsStore,
    installBridges: [
      async ({ dom, store }) => {
        calls.push(`bridge:${dom.sessionTabList?.id}`);
        assert.equal(dom, providedDom);
        assert.equal(store.getState().settings, settingsState);
      },
    ],
    onBoot({ dom, settingsStore: bootSettingsStore }) {
      calls.push(`boot:${dom.sessionTabList?.id}`);
      assert.equal(dom, providedDom);
      assert.equal(bootSettingsStore, settingsStore);
    },
  });

  await app.boot();

  assert.deepEqual(calls, ["bridge:provided-session-tab-list", "boot:provided-session-tab-list"]);
  assert.equal(app.store.getState().settings, settingsState);
});
