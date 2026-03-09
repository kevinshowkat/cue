import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

function loadNamedFunctionSource(name) {
  const pattern = new RegExp(
    `function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n\\n(?:async\\s+)?function\\s+`,
    "m"
  );
  const match = app.match(pattern);
  assert.ok(match, `${name} function not found`);
  return match[0].replace(/\n\n(?:async\s+)?function\s+[\s\S]*$/, "").trim();
}

function instantiateFunction(name, deps = {}) {
  const source = loadNamedFunctionSource(name);
  const keys = Object.keys(deps);
  const values = Object.values(deps);
  return new Function(...keys, `return (${source});`)(...values);
}

test("marker pointer down consumes blank-canvas drags and seeds a screen-space draft", () => {
  const calls = [];
  const state = {
    pointer: {},
    communication: {
      markDraft: null,
    },
  };
  const COMMUNICATION_POINTER_KINDS = {
    MARKER: "communication_marker",
    MAGIC_SELECT: "communication_magic_select",
  };
  const els = {
    overlayCanvas: {
      setPointerCapture(pointerId) {
        calls.push(["capture", pointerId]);
      },
    },
  };
  const requestRender = () => calls.push(["render"]);
  const bumpInteraction = (meta) => calls.push(["bump", meta]);
  const beginCommunicationMarkerStroke = instantiateFunction("beginCommunicationMarkerStroke", {
    bumpInteraction,
    els,
    state,
    COMMUNICATION_POINTER_KINDS,
    requestRender,
  });
  const handleCommunicationCanvasPointerDown = instantiateFunction("handleCommunicationCanvasPointerDown", {
    communicationToolId: () => "marker",
    eraseCommunicationAtCanvasPoint: () => null,
    dispatchJuggernautShellEvent: () => calls.push(["dispatch"]),
    COMMUNICATION_STATE_CHANGED_EVENT: "juggernaut:communication-state-changed",
    buildCommunicationBridgeSnapshot: () => ({}),
    buildJuggernautShellContext: () => ({}),
    requestRender,
    hitTestVisibleCanvasImage: () => null,
    beginCommunicationMarkerStroke,
    canvasToImageForImageId: () => null,
    beginCommunicationMagicSelectStroke: () => false,
  });

  const consumed = handleCommunicationCanvasPointerDown(
    { button: 0, pointerId: 7 },
    { x: 40, y: 60 },
    { x: 20, y: 30 }
  );

  assert.equal(consumed, true);
  assert.equal(state.pointer.kind, COMMUNICATION_POINTER_KINDS.MARKER);
  assert.equal(state.pointer.imageId, null);
  assert.equal(state.communication.markDraft.coordinateSpace, "canvas_world");
  assert.deepEqual(state.communication.markDraft.screenPoints, [{ x: 20, y: 30 }]);
  assert.equal(calls.filter(([name]) => name === "dispatch").length, 0);
  assert.equal(calls.filter(([name]) => name === "capture").length, 1);
});

test("marker drag samples include coalesced pointer events when available", () => {
  const communicationCoalescedScreenPoints = instantiateFunction("communicationCoalescedScreenPoints", {
    canvasCssPointFromEvent: (event) => ({
      x: Number(event.offsetX) || 0,
      y: Number(event.offsetY) || 0,
    }),
  });

  const samples = communicationCoalescedScreenPoints({
    offsetX: 30,
    offsetY: 40,
    getCoalescedEvents() {
      return [
        { offsetX: 10, offsetY: 20 },
        { offsetX: 18, offsetY: 28 },
      ];
    },
  });

  assert.deepEqual(samples, [
    { x: 10, y: 20 },
    { x: 18, y: 28 },
    { x: 30, y: 40 },
  ]);
});

test("blank-canvas marker commits stay in the canvas mark bucket", () => {
  const state = {
    communication: {
      markDraft: {
        imageId: null,
        coordinateSpace: "canvas_world",
        screenPoints: [
          { x: 12, y: 18 },
          { x: 40, y: 56 },
        ],
      },
      marksByImageId: new Map(),
      canvasMarks: [],
      lastAnchor: null,
    },
  };
  const commitCommunicationMarkDraft = instantiateFunction("commitCommunicationMarkDraft", {
    state,
    communicationDraftScreenPoints: (draft) => draft.screenPoints,
    communicationPolylineLength: () => 42,
    COMMUNICATION_MARK_MIN_DRAG_PX: 6,
    communicationCommittedPointsFromDraft: () => [
      { x: 2, y: 4 },
      { x: 6, y: 8 },
    ],
    COMMUNICATION_MARK_STROKE: "rgba(255, 94, 190, 0.96)",
    COMMUNICATION_MARK_MAX_POINTS: 240,
    communicationMarksForImage: () => [],
    communicationCanvasMarks: () => state.communication.canvasMarks,
    communicationAnchorFromMark: (mark) => ({
      kind: "mark",
      imageId: mark.imageId,
      markId: mark.id,
    }),
  });

  const mark = commitCommunicationMarkDraft();

  assert.equal(mark.imageId, null);
  assert.equal(mark.coordinateSpace, "canvas_world");
  assert.equal(mark.kind, "freehand_marker");
  assert.equal(state.communication.marksByImageId.size, 0);
  assert.equal(state.communication.canvasMarks.length, 1);
  assert.equal(state.communication.markDraft, null);
  assert.equal(state.communication.lastAnchor?.markId, mark.id);
});

test("marker render traces a smoothed quadratic freehand path", () => {
  const traceCommunicationMarkPath = instantiateFunction("traceCommunicationMarkPath");
  const calls = [];
  const ctx = {
    beginPath() {
      calls.push(["beginPath"]);
    },
    moveTo(x, y) {
      calls.push(["moveTo", x, y]);
    },
    lineTo(x, y) {
      calls.push(["lineTo", x, y]);
    },
    quadraticCurveTo(cpx, cpy, x, y) {
      calls.push(["quadraticCurveTo", cpx, cpy, x, y]);
    },
  };

  const traced = traceCommunicationMarkPath(ctx, [
    { x: 0, y: 0 },
    { x: 10, y: 14 },
    { x: 24, y: 20 },
    { x: 40, y: 32 },
  ]);

  assert.equal(traced, true);
  assert.equal(calls.filter(([name]) => name === "lineTo").length, 0);
  assert.equal(calls.filter(([name]) => name === "quadraticCurveTo").length, 3);
});
