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
    trySetOverlayPointerCapture: (pointerId) => els.overlayCanvas.setPointerCapture(pointerId),
    COMMUNICATION_POINTER_KINDS,
    requestRender,
  });
  const handleCommunicationCanvasPointerDown = instantiateFunction("handleCommunicationCanvasPointerDown", {
    communicationToolId: () => "marker",
    communicationBehaviorToolId: (tool) => tool,
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

  const event = {
    button: 0,
    pointerId: 7,
    preventDefault() {
      calls.push(["prevent"]);
    },
    stopPropagation() {
      calls.push(["stop"]);
    },
  };
  const consumed = handleCommunicationCanvasPointerDown(
    event,
    { x: 40, y: 60 },
    { x: 20, y: 30 }
  );

  assert.equal(consumed, true);
  assert.equal(state.pointer.kind, COMMUNICATION_POINTER_KINDS.MARKER);
  assert.equal(state.pointer.imageId, null);
  assert.equal(state.communication.markDraft.coordinateSpace, "canvas_overlay");
  assert.deepEqual(state.communication.markDraft.screenPoints, [{ x: 20, y: 30 }]);
  assert.equal(calls.filter(([name]) => name === "dispatch").length, 0);
  assert.equal(calls.filter(([name]) => name === "capture").length, 1);
  assert.equal(calls.filter(([name]) => name === "prevent").length, 1);
  assert.equal(calls.filter(([name]) => name === "stop").length, 1);
});

test("eraser pointer down on an image starts a real image-erase stroke instead of clearing annotations wholesale", () => {
  const calls = [];
  const state = {
    pointer: {},
    communication: {
      eraseDraft: null,
    },
  };
  const COMMUNICATION_POINTER_KINDS = {
    MARKER: "communication_marker",
    MAGIC_SELECT: "communication_magic_select",
    ERASER: "communication_eraser",
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
  const beginCommunicationImageEraseStroke = instantiateFunction("beginCommunicationImageEraseStroke", {
    bumpInteraction,
    els,
    state,
    trySetOverlayPointerCapture: (pointerId) => els.overlayCanvas.setPointerCapture(pointerId),
    COMMUNICATION_POINTER_KINDS,
    COMMUNICATION_IMAGE_ERASE_BRUSH_CSS_PX: 22,
    requestRender,
  });
  const handleCommunicationCanvasPointerDown = instantiateFunction("handleCommunicationCanvasPointerDown", {
    communicationToolId: () => "eraser",
    communicationBehaviorToolId: (tool) => tool,
    eraseCommunicationAtCanvasPoint: () => null,
    invalidateActiveTabPreview: () => calls.push(["invalidate"]),
    dispatchJuggernautShellEvent: () => calls.push(["dispatch"]),
    COMMUNICATION_STATE_CHANGED_EVENT: "juggernaut:communication-state-changed",
    buildCommunicationBridgeSnapshot: () => ({}),
    buildJuggernautShellContext: () => ({}),
    requestRender,
    hitTestVisibleCanvasImage: () => "img-hero",
    beginCommunicationImageEraseStroke,
    beginCommunicationMarkerStroke: () => false,
    canvasToImageForImageId: () => ({ x: 10, y: 12 }),
    beginCommunicationMagicSelectStroke: () => false,
  });

  const event = {
    button: 0,
    pointerId: 11,
  };
  const consumed = handleCommunicationCanvasPointerDown(
    event,
    { x: 84, y: 126 },
    { x: 42, y: 63 }
  );

  assert.equal(consumed, true);
  assert.equal(state.pointer.kind, COMMUNICATION_POINTER_KINDS.ERASER);
  assert.equal(state.pointer.imageId, "img-hero");
  assert.equal(state.communication.eraseDraft.imageId, "img-hero");
  assert.deepEqual(state.communication.eraseDraft.screenPoints, [{ x: 42, y: 63 }]);
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

test("blank-canvas marker commits stay in the overlay mark bucket with raw points", () => {
  const state = {
    communication: {
      markDraft: {
        imageId: null,
        coordinateSpace: "canvas_overlay",
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
    communicationCommittedPointsFromDraft: (draft) => draft.screenPoints,
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
  assert.equal(mark.sourceImageId, null);
  assert.equal(mark.coordinateSpace, "canvas_overlay");
  assert.equal(mark.kind, "freehand_marker");
  assert.deepEqual(mark.points, [
    { x: 12, y: 18 },
    { x: 40, y: 56 },
  ]);
  assert.equal(state.communication.marksByImageId.size, 0);
  assert.equal(state.communication.canvasMarks.length, 1);
  assert.equal(state.communication.markDraft, null);
  assert.equal(state.communication.lastAnchor?.markId, mark.id);
});

test("image-hit marker commits preserve overlay-space geometry and avoid image buckets", () => {
  const state = {
    communication: {
      markDraft: {
        imageId: "img-1",
        coordinateSpace: "canvas_overlay",
        screenPoints: [
          { x: 18, y: 24 },
          { x: 48, y: 72 },
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
    communicationPolylineLength: () => 64,
    COMMUNICATION_MARK_MIN_DRAG_PX: 6,
    communicationCommittedPointsFromDraft: (draft) => draft.screenPoints,
    COMMUNICATION_MARK_STROKE: "rgba(255, 94, 190, 0.96)",
    COMMUNICATION_MARK_MAX_POINTS: 240,
    communicationMarksForImage: () => [],
    communicationCanvasMarks: () => state.communication.canvasMarks,
    communicationAnchorFromMark: (mark) => ({
      kind: "mark",
      imageId: null,
      sourceImageId: mark.sourceImageId,
      markId: mark.id,
    }),
  });

  const mark = commitCommunicationMarkDraft();

  assert.equal(mark.coordinateSpace, "canvas_overlay");
  assert.equal(mark.imageId, "img-1");
  assert.equal(mark.sourceImageId, "img-1");
  assert.deepEqual(mark.points, [
    { x: 18, y: 24 },
    { x: 48, y: 72 },
  ]);
  assert.equal(state.communication.marksByImageId.size, 0);
  assert.equal(state.communication.canvasMarks.length, 1);
  assert.equal(state.communication.canvasMarks[0].id, mark.id);
});

test("communication overlay renders each annotation with a felt-tip shoulder and core stroke", () => {
  const rendered = [];
  const marks = Array.from({ length: 15 }, (_, index) => ({
    id: `mark-${index + 1}`,
    points: [
      { x: index, y: index },
      { x: index + 10, y: index + 10 },
    ],
  }));
  const state = {
    communication: {
      regionProposalsByImageId: new Map(),
      marksByImageId: new Map([["img-1", marks.slice(0, 8)]]),
      canvasMarks: marks.slice(8),
      markDraft: null,
    },
  };
  const octx = {
    save() {},
    restore() {},
    stroke() {
      rendered.push({
        lineWidth: this.lineWidth,
        strokeStyle: this.strokeStyle,
        globalAlpha: this.globalAlpha,
      });
    },
  };
  const renderCommunicationOverlay = instantiateFunction("renderCommunicationOverlay", {
    getDpr: () => 1,
    state,
    imageToCanvasForImageId: () => null,
    COMMUNICATION_REGION_ACTIVE: "active",
    COMMUNICATION_REGION_IDLE: "idle",
    drawPolygonPath: () => false,
    communicationDraftPointsToCanvas: () => [],
    communicationMarkPointsToCanvas: (mark) => mark.points,
    COMMUNICATION_MARK_STROKE: "rgba(255, 94, 190, 0.96)",
    traceCommunicationMarkPath: () => true,
    communicationCanvasMarks: () => state.communication.canvasMarks,
  });

  renderCommunicationOverlay(octx);

  assert.equal(rendered.length, 30);
  assert.deepEqual(rendered[0], {
    lineWidth: 12,
    strokeStyle: "rgba(255, 94, 190, 0.16)",
    globalAlpha: 1,
  });
  assert.deepEqual(rendered[1], {
    lineWidth: 8,
    strokeStyle: "rgba(255, 94, 190, 0.94)",
    globalAlpha: 1,
  });
});

test("review targeting resolves an overlay mark onto the overlapping visible image", () => {
  const communicationPointsBounds = instantiateFunction("communicationPointsBounds");
  const communicationRectCssPolygon = instantiateFunction("communicationRectCssPolygon", {
    transformPointForRect: (point) => point,
  });
  const communicationPointInPolygon = instantiateFunction("communicationPointInPolygon");
  const communicationSegmentCross = instantiateFunction("communicationSegmentCross");
  const communicationPointOnSegment = instantiateFunction("communicationPointOnSegment", {
    communicationSegmentCross,
  });
  const communicationSegmentsIntersect = instantiateFunction("communicationSegmentsIntersect", {
    communicationSegmentCross,
    communicationPointOnSegment,
  });
  const communicationPolylinePolygonOverlapScore = instantiateFunction(
    "communicationPolylinePolygonOverlapScore",
    {
      communicationPointInPolygon,
      communicationSegmentsIntersect,
    }
  );
  const resolveCommunicationMarkOverlapTarget = instantiateFunction(
    "resolveCommunicationMarkOverlapTarget",
    {
      communicationMarkPointsToCanvasCss: (mark) => mark.points,
      communicationPointsBounds,
      buildCommunicationVisibleImagesPayload: () => [
        {
          id: "img-1",
          active: true,
          selected: true,
          width: 100,
          height: 80,
          rectCss: {
            left: 10,
            top: 10,
            width: 100,
            height: 80,
            rotateDeg: 0,
            skewXDeg: 0,
          },
        },
      ],
      buildCommunicationRegionsPayload: () => [],
      communicationRegionBoundsCssPolygon: () => [],
      communicationPolylinePolygonOverlapScore,
      communicationRectCssPolygon,
    }
  );

  const target = resolveCommunicationMarkOverlapTarget({
    id: "mark-1",
    coordinateSpace: "canvas_overlay",
    points: [
      { x: 18, y: 20 },
      { x: 84, y: 42 },
    ],
  });

  assert.equal(target.kind, "image");
  assert.equal(target.imageId, "img-1");
  assert.equal(target.markId, "mark-1");
  assert.equal(target.source, "mark_overlap_image");
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
