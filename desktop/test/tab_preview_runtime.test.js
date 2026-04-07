import { test } from "node:test";
import assert from "node:assert/strict";

import { createCanvasAppTabPreviewRuntime } from "../src/app/tab_preview_runtime.js";

function create2dContext(calls, label) {
  return {
    clearRect(...args) {
      calls.push({ type: `${label}.clearRect`, args });
    },
    drawImage(...args) {
      calls.push({ type: `${label}.drawImage`, args });
    },
    set imageSmoothingEnabled(value) {
      calls.push({ type: `${label}.imageSmoothingEnabled`, value });
    },
    set imageSmoothingQuality(value) {
      calls.push({ type: `${label}.imageSmoothingQuality`, value });
    },
  };
}

function createCanvasSurface(calls, label, width = 320, height = 180) {
  const context = create2dContext(calls, label);
  return {
    width,
    height,
    getContext() {
      return context;
    },
  };
}

function createPreviewRuntimeHarness() {
  const calls = [];
  let rafCallback = null;
  const workCanvas = createCanvasSurface(calls, "work", 320, 180);
  const overlayCanvas = createCanvasSurface(calls, "overlay", 320, 180);
  const effectsCanvas = createCanvasSurface(calls, "effects", 320, 180);
  const state = {
    activeTabId: "tab-a",
    activeId: "img-a",
    canvasMode: "single",
    view: {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    },
    multiView: {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    },
    tabPreviewState: {
      version: 0,
      valid: false,
    },
    tabPreviewDirty: true,
    pendingTabSwitchPreview: null,
    pointer: {
      active: false,
    },
    gestureZoom: {
      active: false,
    },
    reelTouch: {
      visibleUntil: 0,
      downUntil: 0,
    },
    motherOverlayUiHits: ["stale-overlay-hit"],
    activeImageTransformUiHits: ["stale-transform-hit"],
  };
  const tabs = new Map([
    [
      "tab-a",
      {
        tabId: "tab-a",
        session: {
          tabPreviewState: null,
        },
      },
    ],
  ]);

  class FakeOffscreenCanvas {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.context = create2dContext(calls, "capture");
    }

    getContext() {
      return this.context;
    }
  }

  const runtime = createCanvasAppTabPreviewRuntime({
    state,
    els: {
      workCanvas,
      overlayCanvas,
      effectsCanvas,
    },
    tabbedSessions: {
      getTab(tabId) {
        return tabs.get(tabId) || null;
      },
    },
    createFreshTabPreviewState() {
      return {
        version: 0,
        valid: false,
      };
    },
    normalizeTabPreviewState(value = null) {
      const preview = value && typeof value === "object" ? value : {};
      return {
        version: Math.max(0, Number(preview.version) || 0),
        valid: Boolean(preview.valid),
      };
    },
    getDpr() {
      return 2;
    },
    hideImageFxOverlays() {
      calls.push({ type: "hideImageFxOverlays" });
    },
    shouldAnimateEffectVisuals() {
      return false;
    },
    startPerfSample(label, detail = null) {
      calls.push({ type: "startPerfSample", label, detail });
      return { label, detail };
    },
    finishPerfSample(sample, metricKey, detail = null) {
      calls.push({ type: "finishPerfSample", sample, metricKey, detail });
      return 0;
    },
    requestRender() {
      calls.push({ type: "requestRender" });
    },
    windowObj: {
      requestAnimationFrame(callback) {
        calls.push({ type: "requestAnimationFrame" });
        rafCallback = callback;
        return 1;
      },
      cancelAnimationFrame(id) {
        calls.push({ type: "cancelAnimationFrame", id });
      },
    },
    OffscreenCanvasCtor: FakeOffscreenCanvas,
    async createImageBitmapFn(surface) {
      calls.push({ type: "createImageBitmap", width: surface?.width || 0, height: surface?.height || 0 });
      return {
        source: surface,
        close() {
          calls.push({ type: "bitmap.close" });
        },
      };
    },
  });

  return {
    calls,
    state,
    tabs,
    runtime,
    flushRaf() {
      if (!rafCallback) return false;
      const callback = rafCallback;
      rafCallback = null;
      callback();
      return true;
    },
  };
}

test("preview runtime captures a merged snapshot and marks the active session preview valid", async () => {
  const harness = createPreviewRuntimeHarness();

  const ok = await harness.runtime.captureActiveTabPreview({ reason: "test_capture" });
  const entry = harness.runtime.getUsableTabPreviewEntry("tab-a");

  assert.equal(ok, true);
  assert.equal(entry?.kind, "bitmap");
  assert.equal(entry?.canvasWidth, 320);
  assert.equal(entry?.canvasHeight, 180);
  assert.deepEqual(harness.state.tabPreviewState, { version: 0, valid: true });
  assert.deepEqual(harness.tabs.get("tab-a")?.session?.tabPreviewState, { version: 0, valid: true });
  assert.equal(harness.state.tabPreviewDirty, false);
  assert.equal(harness.calls.some((entryCall) => entryCall.type === "capture.drawImage"), true);
  assert.equal(harness.calls.some((entryCall) => entryCall.type === "createImageBitmap"), true);
});

test("preview invalidation drops the cached bitmap and bumps the session preview version", async () => {
  const harness = createPreviewRuntimeHarness();
  await harness.runtime.captureActiveTabPreview({ reason: "prime_cache" });

  const result = harness.runtime.invalidateActiveTabPreview("image_replace");

  assert.deepEqual(result, {
    reason: "image_replace",
    tabId: "tab-a",
    version: 1,
  });
  assert.deepEqual(harness.state.tabPreviewState, { version: 1, valid: false });
  assert.deepEqual(harness.tabs.get("tab-a")?.session?.tabPreviewState, { version: 1, valid: false });
  assert.equal(harness.state.tabPreviewDirty, true);
  assert.equal(harness.runtime.getUsableTabPreviewEntry("tab-a"), null);
  assert.equal(harness.calls.some((entryCall) => entryCall.type === "bitmap.close"), true);
});

test("pending tab-switch previews paint the cached snapshot before scheduling the full render", async () => {
  const harness = createPreviewRuntimeHarness();
  await harness.runtime.captureActiveTabPreview({ reason: "prime_for_preview" });
  harness.state.pendingTabSwitchPreview = {
    tabId: "tab-a",
    reason: "titlebar_tab_click",
  };

  const painted = harness.runtime.renderPendingTabSwitchPreview();

  assert.equal(painted, true);
  assert.equal(harness.state.pendingTabSwitchPreview, null);
  assert.deepEqual(harness.state.motherOverlayUiHits, []);
  assert.deepEqual(harness.state.activeImageTransformUiHits, []);
  assert.equal(harness.calls.some((entryCall) => entryCall.type === "hideImageFxOverlays"), true);
  assert.equal(harness.calls.some((entryCall) => entryCall.type === "work.drawImage"), true);

  assert.equal(harness.flushRaf(), true);
  assert.equal(harness.calls.some((entryCall) => entryCall.type === "requestRender"), true);
});
