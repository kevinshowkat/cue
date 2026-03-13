import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

function extractFunctionSource(name) {
  const markers = [
    `export async function ${name}(`,
    `export function ${name}(`,
    `async function ${name}(`,
    `function ${name}(`,
  ];
  const start = markers
    .map((marker) => app.indexOf(marker))
    .find((index) => index >= 0);
  assert.notEqual(start, undefined, `${name} function not found`);
  const signatureStart = app.indexOf("(", start);
  assert.notEqual(signatureStart, -1, `Could not find signature for ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth === 0 && char === "{") {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `Could not find body for ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return app
        .slice(start, index + 1)
        .replace(/^export\s+/, "");
    }
  }
  throw new Error(`Could not extract function ${name}`);
}

function instantiateFunction(name, deps = {}) {
  const source = extractFunctionSource(name);
  const keys = Object.keys(deps);
  const values = Object.values(deps);
  return new Function(...keys, `return (${source});`)(...values);
}

test("marker pointer down consumes blank-canvas drags and seeds a screen-space draft", () => {
  const calls = [];
  const state = {
    canvasMode: "single",
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
    state,
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
  assert.equal(state.communication.markDraft.kind, "freehand_marker");
  assert.equal(state.communication.markDraft.coordinateSpace, "canvas_overlay");
  assert.deepEqual(state.communication.markDraft.screenPoints, [{ x: 20, y: 30 }]);
  assert.equal(calls.filter(([name]) => name === "dispatch").length, 0);
  assert.equal(calls.filter(([name]) => name === "capture").length, 1);
  assert.equal(calls.filter(([name]) => name === "prevent").length, 1);
  assert.equal(calls.filter(([name]) => name === "stop").length, 1);
});

test("protect pointer down preserves a distinct draft kind for downstream commit/render", () => {
  const calls = [];
  const state = {
    canvasMode: "single",
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
    state,
    communicationToolId: () => "protect",
    communicationBehaviorToolId: (tool) => (tool === "protect" ? "marker" : tool),
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
    {
      button: 0,
      pointerId: 17,
      preventDefault() {
        calls.push(["prevent"]);
      },
      stopPropagation() {
        calls.push(["stop"]);
      },
    },
    { x: 36, y: 52 },
    { x: 18, y: 26 }
  );

  assert.equal(consumed, true);
  assert.equal(state.pointer.kind, COMMUNICATION_POINTER_KINDS.MARKER);
  assert.equal(state.communication.markDraft.kind, "freehand_protect");
  assert.deepEqual(state.communication.markDraft.screenPoints, [{ x: 18, y: 26 }]);
});

test("eraser pointer down on an image bootstraps multi-image hit testing before starting a real image erase", () => {
  const calls = [];
  const state = {
    canvasMode: "multi",
    multiRects: new Map(),
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
    workCanvas: {
      width: 1280,
      height: 720,
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
    state,
    els,
    computeFreeformRectsPx: (canvasWidth, canvasHeight) => {
      calls.push(["computeFreeformRectsPx", canvasWidth, canvasHeight]);
      return new Map([["img-hero", { x: 0, y: 0, w: canvasWidth, h: canvasHeight }]]);
    },
    communicationToolId: () => "eraser",
    communicationBehaviorToolId: (tool) => tool,
    eraseCommunicationAtCanvasPoint: () => null,
    invalidateActiveTabPreview: () => calls.push(["invalidate"]),
    dispatchJuggernautShellEvent: () => calls.push(["dispatch"]),
    COMMUNICATION_STATE_CHANGED_EVENT: "juggernaut:communication-state-changed",
    buildCommunicationBridgeSnapshot: () => ({}),
    buildJuggernautShellContext: () => ({}),
    requestRender,
    hitTestVisibleCanvasImage: () => (state.multiRects.size ? "img-hero" : null),
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
  assert.equal(calls.filter(([name]) => name === "computeFreeformRectsPx").length, 1);
  assert.equal(calls.filter(([name]) => name === "dispatch").length, 0);
  assert.equal(calls.filter(([name]) => name === "capture").length, 1);
});

test("eraser click still removes an existing annotation before any image erase begins", () => {
  const calls = [];
  const handleCommunicationCanvasPointerDown = instantiateFunction("handleCommunicationCanvasPointerDown", {
    communicationToolId: () => "eraser",
    communicationBehaviorToolId: (tool) => tool,
    eraseCommunicationAtCanvasPoint: () => ({ kind: "mark", imageId: "img-hero" }),
    invalidateActiveTabPreview: (reason) => calls.push(["invalidate", reason]),
    dispatchJuggernautShellEvent: (type, detail) => calls.push(["dispatch", type, detail?.source || null]),
    COMMUNICATION_STATE_CHANGED_EVENT: "juggernaut:communication-state-changed",
    buildCommunicationBridgeSnapshot: () => ({ marks: [] }),
    buildJuggernautShellContext: () => ({ activeId: "img-hero" }),
    requestRender: () => calls.push(["render"]),
    hitTestVisibleCanvasImage: () => {
      calls.push(["hitTestVisibleCanvasImage"]);
      return "img-hero";
    },
    beginCommunicationImageEraseStroke: () => {
      calls.push(["beginImageErase"]);
      return true;
    },
  });

  const consumed = handleCommunicationCanvasPointerDown(
    { button: 0 },
    { x: 64, y: 92 },
    { x: 32, y: 46 }
  );

  assert.equal(consumed, true);
  assert.deepEqual(calls, [
    ["invalidate", "selection_overlay_change"],
    ["dispatch", "juggernaut:communication-state-changed", "canvas_eraser"],
    ["render"],
  ]);
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

test("blank-canvas marker commits stay in the canvas mark bucket in viewport-aware world space", () => {
  const state = {
    communication: {
      markDraft: {
        imageId: null,
        kind: "freehand_marker",
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
    canvasScreenCssToWorldCss: (point) => point,
    communicationAnchorFromMark: (mark) => ({
      kind: "mark",
      imageId: mark.imageId,
      markId: mark.id,
    }),
  });

  const mark = commitCommunicationMarkDraft();

  assert.equal(mark.imageId, null);
  assert.equal(mark.sourceImageId, null);
  assert.equal(mark.coordinateSpace, "canvas_world");
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

test("protect commits keep a distinct semantic kind and black stroke color", () => {
  const state = {
    communication: {
      markDraft: {
        imageId: null,
        kind: "freehand_protect",
        coordinateSpace: "canvas_overlay",
        screenPoints: [
          { x: 14, y: 20 },
          { x: 34, y: 44 },
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
    communicationPolylineLength: () => 32,
    COMMUNICATION_MARK_MIN_DRAG_PX: 6,
    communicationCommittedPointsFromDraft: (draft) => draft.screenPoints,
    COMMUNICATION_MARK_STROKE: "rgba(220, 28, 28, 0.96)",
    COMMUNICATION_PROTECT_STROKE: "rgba(0, 0, 0, 0.92)",
    COMMUNICATION_MARK_MAX_POINTS: 240,
    communicationMarksForImage: () => [],
    communicationCanvasMarks: () => state.communication.canvasMarks,
    canvasScreenCssToWorldCss: (point) => point,
    communicationAnchorFromMark: (mark) => ({
      kind: "mark",
      imageId: mark.imageId,
      markId: mark.id,
    }),
  });

  const mark = commitCommunicationMarkDraft();

  assert.equal(mark.kind, "freehand_protect");
  assert.equal(mark.color, "rgba(0, 0, 0, 0.92)");
  assert.equal(state.communication.canvasMarks.length, 1);
  assert.equal(state.communication.canvasMarks[0]?.id, mark.id);
});

test("move tool clears the active communication marker before returning to pan", async () => {
  const calls = [];
  const state = {
    tool: "pan",
    activeId: "img-hero",
    juggernautShell: {
      lastToolKey: "",
      selectedImageId: "img-hero",
      selectedImageIds: ["img-hero"],
      selectedImage: { id: "img-hero" },
      toolInvoker: null,
    },
  };
  const applyJuggernautTool = instantiateFunction("applyJuggernautTool", {
    state,
    renderJuggernautShellChrome: () => calls.push(["render"]),
    singleImageRailJobMeta: () => null,
    juggernautShellToolLabel: () => "Move",
    JUGGERNAUT_SHELL_RAIL_CONTRACT: "single_image_shell",
    buildJuggernautShellContext: () => ({ activeId: state.activeId }),
    dispatchJuggernautShellEvent: (type) => {
      calls.push(["dispatch", type]);
      return { defaultPrevented: false };
    },
    setCommunicationTool: (tool, options = {}) => {
      calls.push(["setCommunicationTool", tool, options.source || null]);
      return null;
    },
    setTool: (tool) => {
      calls.push(["setTool", tool]);
    },
    runWithUserError: async () => {
      throw new Error("unexpected upload invocation");
    },
    importPhotos: async () => {
      throw new Error("unexpected import invocation");
    },
    exportJuggernautPsd: async () => {
      throw new Error("unexpected export invocation");
    },
  });

  const ok = await applyJuggernautTool("move");

  assert.equal(ok, true);
  assert.equal(state.juggernautShell.lastToolKey, "move");
  const clearIndex = calls.findIndex(([name]) => name === "setCommunicationTool");
  const panIndex = calls.findIndex(([name]) => name === "setTool");
  assert.notEqual(clearIndex, -1);
  assert.notEqual(panIndex, -1);
  assert.ok(clearIndex < panIndex);
  assert.deepEqual(calls[clearIndex], ["setCommunicationTool", null, "shell_move"]);
  assert.deepEqual(calls[panIndex], ["setTool", "pan"]);
});

test("shell move/select selection yields to an armed communication tool", () => {
  const juggernautActiveToolId = instantiateFunction("juggernautActiveToolId", {
    state: { tool: "pan" },
    communicationToolArmed: () => true,
  });
  assert.equal(juggernautActiveToolId(), "");

  const panToolId = instantiateFunction("juggernautActiveToolId", {
    state: { tool: "pan" },
    communicationToolArmed: () => false,
  });
  assert.equal(panToolId(), "move");

  const lassoToolId = instantiateFunction("juggernautActiveToolId", {
    state: { tool: "lasso" },
    communicationToolArmed: () => false,
  });
  assert.equal(lassoToolId(), "select");
});

test("communication tool selection refreshes quick actions so left-rail selection can change", () => {
  const calls = [];
  const state = {
    communication: {
      tool: null,
      markDraft: { id: "draft-mark" },
      eraseDraft: { id: "draft-erase" },
    },
  };
  const applyCommunicationToolSelection = instantiateFunction("applyCommunicationToolSelection", {
    COMMUNICATION_TOOL_IDS: ["marker", "protect", "magic_select", "make_space", "eraser"],
    state,
    syncDropHintInteractivity: () => calls.push(["syncDropHintInteractivity"]),
    renderCommunicationChrome: () => calls.push(["renderCommunicationChrome"]),
    renderQuickActions: () => calls.push(["renderQuickActions"]),
    dispatchJuggernautShellEvent: (type, detail) => {
      calls.push(["dispatch", type, detail?.source || null]);
      return null;
    },
    COMMUNICATION_STATE_CHANGED_EVENT: "juggernaut:communication-state-changed",
    buildCommunicationBridgeSnapshot: () => ({ tool: state.communication.tool }),
    buildJuggernautShellContext: () => ({ activeId: "img-hero" }),
    requestRender: () => calls.push(["requestRender"]),
  });

  const tool = applyCommunicationToolSelection("marker", { source: "communication_rail", toggle: true });

  assert.equal(tool, "marker");
  assert.equal(state.communication.tool, "marker");
  assert.equal(state.communication.markDraft, null);
  assert.equal(state.communication.eraseDraft, null);
  assert.ok(calls.some(([name]) => name === "renderQuickActions"));
});

test("image-hit marker commits into the image mark bucket so zoom keeps the stroke attached", () => {
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
    communicationScreenCssPointToCanvas: (point) => point,
    canvasToImageForImageId: (point) => ({
      x: Math.round((Number(point?.x) || 0) * 0.5),
      y: Math.round((Number(point?.y) || 0) * 0.25),
    }),
    canvasScreenCssToWorldCss: (point) => point,
    communicationAnchorFromMark: (mark) => ({
      kind: "mark",
      imageId: mark.imageId,
      sourceImageId: mark.sourceImageId,
      markId: mark.id,
    }),
  });

  const mark = commitCommunicationMarkDraft();

  assert.equal(mark.coordinateSpace, "image");
  assert.equal(mark.imageId, "img-1");
  assert.equal(mark.sourceImageId, "img-1");
  assert.deepEqual(mark.points, [
    { x: 9, y: 6 },
    { x: 24, y: 18 },
  ]);
  assert.equal(state.communication.marksByImageId.size, 1);
  assert.equal(state.communication.canvasMarks.length, 0);
  assert.equal(state.communication.marksByImageId.get("img-1")?.[0]?.id, mark.id);
});

test("communication overlay renders marker as a thick red stroke and protect as a thin black line", () => {
  const rendered = [];
  const state = {
    communication: {
      regionProposalsByImageId: new Map(),
      marksByImageId: new Map([[
        "img-1",
        [
          {
            id: "marker-1",
            kind: "freehand_marker",
            points: [
              { x: 0, y: 0 },
              { x: 10, y: 10 },
            ],
          },
          {
            id: "protect-1",
            kind: "freehand_protect",
            color: "rgba(0, 0, 0, 0.92)",
            points: [
              { x: 20, y: 20 },
              { x: 30, y: 30 },
            ],
          },
        ],
      ]]),
      canvasMarks: [],
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
    COMMUNICATION_MARK_STROKE: "rgba(220, 28, 28, 0.96)",
    COMMUNICATION_PROTECT_STROKE: "rgba(0, 0, 0, 0.92)",
    traceCommunicationMarkPath: () => true,
    communicationCanvasMarks: () => state.communication.canvasMarks,
    communicationCanvasCssScaleForImageId: () => 1,
    communicationMarkViewportScale: () => 1,
  });

  renderCommunicationOverlay(octx);

  assert.deepEqual(rendered, [
    {
      lineWidth: 12,
      strokeStyle: "rgba(220, 28, 28, 0.16)",
      globalAlpha: 1,
    },
    {
      lineWidth: 8,
      strokeStyle: "rgba(220, 28, 28, 0.94)",
      globalAlpha: 1,
    },
    {
      lineWidth: 2,
      strokeStyle: "rgba(0, 0, 0, 0.92)",
      globalAlpha: 1,
    },
  ]);
});

test("communication overlay scales image-space annotations with the viewport zoom", () => {
  const rendered = [];
  const state = {
    communication: {
      regionProposalsByImageId: new Map(),
      marksByImageId: new Map([[
        "img-1",
        [{
          id: "mark-1",
          imageId: "img-1",
          coordinateSpace: "image",
          points: [
            { x: 10, y: 12 },
            { x: 30, y: 42 },
          ],
        }],
      ]]),
      canvasMarks: [],
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
    communicationCanvasCssScaleForImageId: () => 0.5,
    communicationMarkViewportScale: () => 0.5,
  });

  renderCommunicationOverlay(octx);

  assert.deepEqual(rendered, [
    {
      lineWidth: 6,
      strokeStyle: "rgba(255, 94, 190, 0.16)",
    },
    {
      lineWidth: 4,
      strokeStyle: "rgba(255, 94, 190, 0.94)",
    },
  ]);
});

test("image-space communication anchors preserve image coordinates for downstream targeting", () => {
  const communicationAnchorFromMark = instantiateFunction("communicationAnchorFromMark", {
    communicationMarkPointsToCanvasCss: () => [
      { x: 20, y: 30 },
      { x: 60, y: 70 },
    ],
    communicationPointsBounds: instantiateFunction("communicationPointsBounds"),
  });

  const anchor = communicationAnchorFromMark({
    id: "mark-image",
    imageId: "img-hero",
    coordinateSpace: "image",
    points: [
      { x: 120, y: 220 },
      { x: 180, y: 260 },
    ],
  });

  assert.deepEqual(anchor, {
    kind: "mark",
    imageId: "img-hero",
    markId: "mark-image",
    imagePoint: { x: 180, y: 260 },
    imageBounds: {
      x0: 120,
      y0: 220,
      x1: 180,
      y1: 260,
      w: 60,
      h: 40,
    },
    canvasPoint: { x: 60, y: 70 },
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
