import { test } from "node:test";
import assert from "node:assert/strict";

import { createCanvasRenderer } from "../src/app/canvas_renderer.js";

function createStubCanvas(label, calls) {
  const context = {
    clearRect: (...args) => calls.push([`${label}:clearRect`, ...args]),
    save: () => calls.push([`${label}:save`]),
    restore: () => calls.push([`${label}:restore`]),
    setTransform: (...args) => calls.push([`${label}:setTransform`, ...args]),
    beginPath: () => calls.push([`${label}:beginPath`]),
    moveTo: (...args) => calls.push([`${label}:moveTo`, ...args]),
    lineTo: (...args) => calls.push([`${label}:lineTo`, ...args]),
    closePath: () => calls.push([`${label}:closePath`]),
    fill: () => calls.push([`${label}:fill`]),
    stroke: () => calls.push([`${label}:stroke`]),
    fillRect: (...args) => calls.push([`${label}:fillRect`, ...args]),
    strokeRect: (...args) => calls.push([`${label}:strokeRect`, ...args]),
    arc: (...args) => calls.push([`${label}:arc`, ...args]),
    fillText: (...args) => calls.push([`${label}:fillText`, ...args]),
    setLineDash: (...args) => calls.push([`${label}:setLineDash`, ...args]),
    drawImage: (...args) => calls.push([`${label}:drawImage`, ...args]),
  };
  return {
    width: 640,
    height: 360,
    getContext(kind) {
      assert.equal(kind, "2d");
      return context;
    },
  };
}

function createRendererHarness(overrides = {}) {
  const calls = [];
  const rafQueue = [];
  const state = {
    activeTabId: "tab-b",
    pendingTabSwitchPreview: null,
    motherOverlayUiHits: ["stale"],
    activeImageTransformUiHits: ["stale"],
    canvasMode: "multi",
    lassoDraft: [],
    selection: null,
    annotateDraft: null,
    annotateBox: null,
    circleDraft: null,
    activeCircle: null,
    freeformRects: new Map(),
  };
  const els = {
    workCanvas: createStubCanvas("work", calls),
    overlayCanvas: createStubCanvas("overlay", calls),
  };
  const renderer = createCanvasRenderer({
    state,
    els,
    documentObj: { hidden: false },
    requestAnimationFrameFn: (callback) => {
      rafQueue.push(callback);
      calls.push(["scheduleRaf"]);
      return rafQueue.length;
    },
    clearPendingTabSwitchFullRender: (detail) => calls.push(["clearPendingTabSwitchFullRender", detail]),
    renderPendingTabSwitchPreview: () => {
      calls.push(["renderPendingTabSwitchPreview"]);
      return false;
    },
    syncIntentRealtimeClass: () => calls.push(["syncIntentRealtimeClass"]),
    renderJuggernautShellChrome: () => calls.push(["renderJuggernautShellChrome"]),
    renderCommunicationChrome: () => calls.push(["renderCommunicationChrome"]),
    getActiveImage: () => null,
    renderMultiCanvas: (...args) => calls.push(["renderMultiCanvas", args.length]),
    syncEffectsRuntimeScene: () => calls.push(["syncEffectsRuntimeScene"]),
    updateImageFxRect: () => calls.push(["updateImageFxRect"]),
    renderDesignReviewApplyShimmer: () => calls.push(["renderDesignReviewApplyShimmer"]),
    renderCommunicationOverlay: () => calls.push(["renderCommunicationOverlay"]),
    renderIntentOverlay: () => calls.push(["renderIntentOverlay"]),
    renderMotherDraftingPlaceholder: () => calls.push(["renderMotherDraftingPlaceholder"]),
    renderPromptGeneratePlaceholder: () => calls.push(["renderPromptGeneratePlaceholder"]),
    renderReelTouchIndicator: () => calls.push(["renderReelTouchIndicator"]),
    renderMotherRolePreview: () => calls.push(["renderMotherRolePreview"]),
    finishPendingTabSwitchFullRender: (detail) => calls.push(["finishPendingTabSwitchFullRender", detail]),
    scheduleActiveTabPreviewCapture: (reason) => calls.push(["scheduleActiveTabPreviewCapture", reason]),
    shouldAnimateDesignReviewApplyShimmer: () => false,
    hasEffectsRuntime: () => true,
    shouldAnimateEffectVisuals: () => false,
    ...overrides,
  });
  return { calls, rafQueue, renderer, state, els };
}

test("requestRender coalesces scheduler work and arms tab-switch preview metadata", () => {
  const harness = createRendererHarness();

  harness.renderer.requestRender({ allowTabSwitchPreview: true, reason: "titlebar_tab_click" });
  harness.renderer.requestRender();

  assert.deepEqual(harness.state.pendingTabSwitchPreview, {
    tabId: "tab-b",
    reason: "titlebar_tab_click",
    requestedAt: harness.state.pendingTabSwitchPreview.requestedAt,
  });
  assert.equal(typeof harness.state.pendingTabSwitchPreview.requestedAt, "number");
  assert.equal(harness.rafQueue.length, 1);
  assert.equal(harness.calls.filter(([name]) => name === "clearPendingTabSwitchFullRender").length, 1);

  harness.rafQueue.shift()();

  assert.deepEqual(harness.state.motherOverlayUiHits, []);
  assert.deepEqual(harness.state.activeImageTransformUiHits, []);
  assert.equal(harness.calls.filter(([name]) => name === "renderMultiCanvas").length, 1);
});

test("render short-circuits on a preview paint hit before running the full orchestrator", () => {
  let callsRef = null;
  const harness = createRendererHarness({
    renderPendingTabSwitchPreview: () => {
      callsRef.push(["renderPendingTabSwitchPreview"]);
      return true;
    },
  });
  callsRef = harness.calls;

  harness.renderer.render();

  assert.deepEqual(harness.calls, [["renderPendingTabSwitchPreview"]]);
});

test("render requeues itself when effect visuals still need animation frames", () => {
  const harness = createRendererHarness({
    hasEffectsRuntime: () => false,
    shouldAnimateEffectVisuals: () => true,
  });

  harness.renderer.render();

  assert.equal(harness.rafQueue.length, 1);
  assert.equal(harness.calls.some(([name]) => name === "scheduleActiveTabPreviewCapture"), true);
});
