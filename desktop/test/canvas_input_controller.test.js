import { test } from "node:test";
import assert from "node:assert/strict";

import { installCanvasHandlers } from "../src/app/canvas_input_controller.js";

test("canvas input controller skips installation without an overlay canvas", () => {
  const state = {};
  let inputInstallCount = 0;
  let gestureInstallCount = 0;

  installCanvasHandlers({
    els: {},
    state,
    pointer: { onPointerDown() {} },
    gestures: { onGestureStart() {} },
    installCanvasInputHandlersImpl: () => {
      inputInstallCount += 1;
    },
    installCanvasGestureHandlersImpl: () => {
      gestureInstallCount += 1;
    },
  });

  assert.equal(inputInstallCount, 0);
  assert.equal(gestureInstallCount, 0);
  assert.equal(state.gestureZoom, undefined);
});

test("canvas input controller wires overlay handlers, preview listeners, and gesture state once", () => {
  const installs = [];
  const previewEvents = [];
  const overlayCanvas = {};
  const motherRolePreview = {
    dataset: {},
    addEventListener(type, handler) {
      previewEvents.push([type, typeof handler]);
    },
  };
  const state = {};

  installCanvasHandlers({
    els: {
      overlayCanvas,
      motherRolePreview,
    },
    state,
    motherRolePreview: {
      onPointerMove() {},
      onPointerLeave() {},
      onPointerDown() {},
    },
    pointer: { onPointerDown() {} },
    keyboard: { onKeyDown() {} },
    wheel: { onWheel() {} },
    gestures: {
      onGestureStart() {},
      onGestureChange() {},
      onGestureEnd() {},
    },
    installCanvasInputHandlersImpl: (target, config) => {
      installs.push({ kind: "input", target, config });
    },
    installCanvasGestureHandlersImpl: (target, config) => {
      installs.push({ kind: "gesture", target, config });
    },
  });

  assert.equal(motherRolePreview.dataset.liveTetherHoverBound, "1");
  assert.deepEqual(previewEvents, [
    ["pointermove", "function"],
    ["pointerleave", "function"],
    ["pointerdown", "function"],
  ]);
  assert.deepEqual(state.gestureZoom, { active: false, lastScale: 1 });
  assert.equal(installs.length, 3);
  assert.equal(installs[0].kind, "input");
  assert.equal(installs[1].kind, "input");
  assert.equal(installs[2].kind, "gesture");

  installCanvasHandlers({
    els: {
      overlayCanvas,
      motherRolePreview,
    },
    state,
    motherRolePreview: {
      onPointerMove() {},
      onPointerLeave() {},
      onPointerDown() {},
    },
    installCanvasInputHandlersImpl: () => {},
  });

  assert.deepEqual(previewEvents, [
    ["pointermove", "function"],
    ["pointerleave", "function"],
    ["pointerdown", "function"],
  ]);
});
