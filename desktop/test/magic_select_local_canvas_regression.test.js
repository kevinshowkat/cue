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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createMagicSelectHelpers() {
  const communicationPointsBounds = instantiateFunction("communicationPointsBounds");
  const communicationRegionCandidateImagePoints = instantiateFunction("communicationRegionCandidateImagePoints");
  const normalizeCommunicationRegionBounds = instantiateFunction("normalizeCommunicationRegionBounds", {
    clamp,
    communicationPointsBounds,
  });
  const normalizeCommunicationRegionContourPoints = instantiateFunction("normalizeCommunicationRegionContourPoints", {
    clamp,
  });
  const communicationPolygonArea = instantiateFunction("communicationPolygonArea");
  const communicationPolygonCentroid = instantiateFunction("communicationPolygonCentroid");
  const communicationMagicSelectCandidateSelectionScore = instantiateFunction("communicationMagicSelectCandidateSelectionScore", {
    clamp,
    communicationRegionCandidateImagePoints,
    normalizeCommunicationRegionBounds,
    communicationPolygonArea,
    communicationPolygonCentroid,
  });
  const rerankCommunicationMagicSelectCandidates = instantiateFunction("rerankCommunicationMagicSelectCandidates", {
    communicationRegionCandidateImagePoints,
    normalizeCommunicationRegionBounds,
    communicationPolygonArea,
    communicationMagicSelectCandidateSelectionScore,
  });
  const normalizeCommunicationRegionCandidate = instantiateFunction("normalizeCommunicationRegionCandidate", {
    clamp,
    communicationRegionCandidateImagePoints,
    normalizeCommunicationRegionBounds,
    normalizeCommunicationRegionContourPoints,
  });
  const buildCommunicationFallbackRegionCandidate = instantiateFunction("buildCommunicationFallbackRegionCandidate", {
    clamp,
  });
  const resolveCommunicationMagicSelectCandidates = instantiateFunction("resolveCommunicationMagicSelectCandidates", {
    COMMUNICATION_REGION_CANDIDATE_COUNT: 3,
    buildCommunicationFallbackRegionCandidate,
    normalizeCommunicationRegionCandidate,
    rerankCommunicationMagicSelectCandidates,
  });
  const readFirstString = instantiateFunction("readFirstString");
  const resolveCommunicationMagicSelectImagePoint = instantiateFunction("resolveCommunicationMagicSelectImagePoint", {
    state: {
      canvasMode: "single",
      activeId: "img-hero",
      imagesById: new Map([
        ["img-hero", { id: "img-hero" }],
      ]),
    },
    readFirstString,
    getActiveImage: () => ({ id: "img-hero" }),
    canvasToImageForImageId: () => null,
    canvasToImage: (pt) => ({ x: Number(pt?.x) || 0, y: Number(pt?.y) || 0 }),
  });
  return {
    communicationPointsBounds,
    communicationRegionCandidateImagePoints,
    normalizeCommunicationRegionBounds,
    normalizeCommunicationRegionContourPoints,
    communicationPolygonArea,
    communicationPolygonCentroid,
    communicationMagicSelectCandidateSelectionScore,
    rerankCommunicationMagicSelectCandidates,
    normalizeCommunicationRegionCandidate,
    buildCommunicationFallbackRegionCandidate,
    resolveCommunicationMagicSelectCandidates,
    resolveCommunicationMagicSelectImagePoint,
  };
}

test("magic select normalization keeps contour, mask, source, and derived bounds from deterministic candidates", () => {
  const {
    normalizeCommunicationRegionCandidate,
  } = createMagicSelectHelpers();

  const candidate = normalizeCommunicationRegionCandidate(
    "img-hero",
    { x: 42, y: 51 },
    { w: 200, h: 160 },
    {
      id: "subject-1",
      contourPoints: [
        { x: 12, y: 20 },
        { x: 60, y: 18 },
        { x: 58, y: 74 },
        { x: 14, y: 78 },
      ],
      maskRef: {
        path: "/tmp/run/mask-subject-1.png",
        sha256: "abc123",
        width: 96,
        height: 112,
        format: "png",
      },
      confidence: 0.87,
      source: "local_mask_worker",
    },
    0
  );

  assert.deepEqual(candidate?.bounds, {
    x: 12,
    y: 18,
    w: 48,
    h: 60,
  });
  assert.deepEqual(candidate?.contourPoints, [
    { x: 12, y: 20 },
    { x: 60, y: 18 },
    { x: 58, y: 74 },
    { x: 14, y: 78 },
  ]);
  assert.deepEqual(candidate?.maskRef, {
    path: "/tmp/run/mask-subject-1.png",
    sha256: "abc123",
    width: 96,
    height: 112,
    format: "png",
  });
  assert.equal(candidate?.source, "local_mask_worker");
  assert.equal(candidate?.confidence, 0.87);
  assert.deepEqual(candidate?.polygon, candidate?.contourPoints);
});

test("magic select pointer-down falls back to the active single-canvas image when visible hit testing misses after apply", () => {
  const calls = [];
  const readFirstString = instantiateFunction("readFirstString");
  const state = {
    canvasMode: "single",
    activeId: "img-generated",
    imagesById: new Map([
      [
        "img-generated",
        {
          id: "img-generated",
          path: "/tmp/generated.png",
          width: 1280,
          height: 720,
        },
      ],
    ]),
  };
  const resolveCommunicationMagicSelectImagePoint = instantiateFunction("resolveCommunicationMagicSelectImagePoint", {
    state,
    readFirstString,
    getActiveImage: () => state.imagesById.get("img-generated"),
    canvasToImageForImageId: () => null,
    canvasToImage: () => ({ x: 312, y: 144 }),
  });
  const handleCommunicationCanvasPointerDown = instantiateFunction("handleCommunicationCanvasPointerDown", {
    state,
    els: {
      workCanvas: null,
    },
    readFirstString,
    communicationToolId: () => "magic_select",
    communicationBehaviorToolId: () => "magic_select",
    hitTestVisibleCanvasImage: () => null,
    getActiveImage: () => state.imagesById.get("img-generated"),
    resolveCommunicationMagicSelectImagePoint,
    canvasToImageForImageId: () => null,
    canvasToImage: () => ({ x: 312, y: 144 }),
    computeFreeformRectsPx: () => new Map(),
    eraseCommunicationAtCanvasPoint: () => null,
    beginCommunicationImageEraseStroke: () => false,
    beginCommunicationMarkerStroke: () => false,
    beginCommunicationMagicSelectStroke: (...args) => {
      calls.push(args);
      return true;
    },
    recordTimelineNode: () => {},
    invalidateActiveTabPreview: () => {},
    dispatchJuggernautShellEvent: () => {},
    COMMUNICATION_STATE_CHANGED_EVENT: "juggernaut:communication-state-changed",
    buildCommunicationBridgeSnapshot: () => ({}),
    buildJuggernautShellContext: () => ({}),
    requestRender: () => {},
  });

  const event = { button: 0 };
  const point = { x: 640, y: 360 };
  const pointCss = { x: 640, y: 360 };

  const handled = handleCommunicationCanvasPointerDown(event, point, pointCss);

  assert.equal(handled, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][3], "img-generated");
});

test("magic select pointer-down recomputes stale multi-canvas rects before falling through after apply", () => {
  const calls = [];
  const readFirstString = instantiateFunction("readFirstString");
  const state = {
    canvasMode: "multi",
    activeId: "img-generated",
    imagesById: new Map([
      [
        "img-generated",
        {
          id: "img-generated",
          path: "/tmp/generated.png",
          width: 1280,
          height: 720,
        },
      ],
    ]),
    multiRects: new Map([
      ["img-generated", { x: 0, y: 0, w: 10, h: 10 }],
    ]),
  };
  let hitCount = 0;
  const handleCommunicationCanvasPointerDown = instantiateFunction("handleCommunicationCanvasPointerDown", {
    state,
    els: {
      workCanvas: { width: 1280, height: 720 },
    },
    readFirstString,
    communicationToolId: () => "magic_select",
    communicationBehaviorToolId: () => "magic_select",
    hitTestVisibleCanvasImage: () => {
      hitCount += 1;
      return hitCount === 1 ? null : "img-generated";
    },
    getActiveImage: () => state.imagesById.get("img-generated"),
    resolveCommunicationMagicSelectImagePoint: (_point, imageId) => {
      calls.push(["resolve_point", imageId]);
      return { x: 512, y: 256 };
    },
    canvasToImageForImageId: () => null,
    computeFreeformRectsPx: (width, height) => {
      calls.push(["recompute_rects", width, height]);
      return new Map([
        ["img-generated", { x: 120, y: 80, w: 960, h: 540 }],
      ]);
    },
    eraseCommunicationAtCanvasPoint: () => null,
    beginCommunicationImageEraseStroke: () => false,
    beginCommunicationMarkerStroke: () => false,
    beginCommunicationMagicSelectStroke: (...args) => {
      calls.push(["begin_magic_select", args[3]]);
      return true;
    },
    recordTimelineNode: () => {},
    invalidateActiveTabPreview: () => {},
    dispatchJuggernautShellEvent: () => {},
    COMMUNICATION_STATE_CHANGED_EVENT: "juggernaut:communication-state-changed",
    buildCommunicationBridgeSnapshot: () => ({}),
    buildJuggernautShellContext: () => ({}),
    requestRender: () => {},
  });

  const handled = handleCommunicationCanvasPointerDown({ button: 0 }, { x: 640, y: 360 }, { x: 640, y: 360 });

  assert.equal(handled, true);
  assert.deepEqual(calls, [
    ["recompute_rects", 1280, 720],
    ["resolve_point", "img-generated"],
    ["begin_magic_select", "img-generated"],
  ]);
});

test("magic select image-point resolution falls back to the active single-canvas image on pointer-up", () => {
  const readFirstString = instantiateFunction("readFirstString");
  const state = {
    canvasMode: "single",
    activeId: "img-generated",
    imagesById: new Map([
      ["img-generated", { id: "img-generated", path: "/tmp/generated.png" }],
    ]),
  };
  const resolveCommunicationMagicSelectImagePoint = instantiateFunction("resolveCommunicationMagicSelectImagePoint", {
    state,
    readFirstString,
    getActiveImage: () => ({ id: "img-generated" }),
    canvasToImageForImageId: () => null,
    canvasToImage: () => ({ x: 412, y: 228 }),
  });

  const point = resolveCommunicationMagicSelectImagePoint({ x: 640, y: 360 }, "img-generated");

  assert.deepEqual(point, { x: 412, y: 228 });
});

test("magic select image-point resolution recomputes stale multi-canvas rects after apply", () => {
  const calls = [];
  const readFirstString = instantiateFunction("readFirstString");
  const state = {
    canvasMode: "multi",
    activeId: "img-generated",
    imagesById: new Map([
      ["img-generated", { id: "img-generated", path: "/tmp/generated.png" }],
    ]),
    multiRects: new Map([
      ["img-generated", { x: 0, y: 0, w: 10, h: 10 }],
    ]),
  };
  let attempts = 0;
  const resolveCommunicationMagicSelectImagePoint = instantiateFunction("resolveCommunicationMagicSelectImagePoint", {
    state,
    els: {
      workCanvas: { width: 1280, height: 720 },
    },
    readFirstString,
    getActiveImage: () => ({ id: "img-generated" }),
    canvasToImageForImageId: () => {
      attempts += 1;
      return attempts === 1 ? null : { x: 412, y: 228 };
    },
    canvasToImage: () => ({ x: 0, y: 0 }),
    computeFreeformRectsPx: (width, height) => {
      calls.push(["recompute_rects", width, height]);
      return new Map([
        ["img-generated", { x: 120, y: 80, w: 960, h: 540 }],
      ]);
    },
  });

  const point = resolveCommunicationMagicSelectImagePoint({ x: 640, y: 360 }, "img-generated");

  assert.deepEqual(point, { x: 412, y: 228 });
  assert.deepEqual(calls, [["recompute_rects", 1280, 720]]);
});

test("magic select candidate resolution falls back to coarse local diamonds only when deterministic candidates are unavailable", () => {
  const { resolveCommunicationMagicSelectCandidates } = createMagicSelectHelpers();

  const candidates = resolveCommunicationMagicSelectCandidates(
    "img-hero",
    { x: 90, y: 60 },
    { w: 320, h: 240 },
    { ok: false, error: "segmentation unavailable" }
  );

  assert.equal(candidates.length, 3);
  assert.ok(candidates.every((candidate) => candidate.source === "coarse_fallback"));
  assert.ok(candidates.every((candidate) => Array.isArray(candidate.contourPoints) && candidate.contourPoints.length === 4));
});

test("magic select reranks multimask candidates so larger click-covering masks beat tiny high-confidence blobs", () => {
  const { resolveCommunicationMagicSelectCandidates } = createMagicSelectHelpers();

  const candidates = resolveCommunicationMagicSelectCandidates(
    "img-hero",
    { x: 1544, y: 274 },
    { w: 1920, h: 1080 },
    {
      candidates: [
        {
          id: "candidate-small",
          confidence: 0.97,
          bounds: { x: 1476, y: 207, w: 110, h: 142 },
          contourPoints: [
            { x: 1498, y: 207 },
            { x: 1586, y: 228 },
            { x: 1562, y: 349 },
            { x: 1476, y: 330 },
          ],
        },
        {
          id: "candidate-large",
          confidence: 0.89,
          bounds: { x: 1476, y: 151, w: 216, h: 261 },
          contourPoints: [
            { x: 1520, y: 151 },
            { x: 1692, y: 195 },
            { x: 1654, y: 412 },
            { x: 1476, y: 372 },
          ],
        },
        {
          id: "candidate-far",
          confidence: 0.84,
          bounds: { x: 1680, y: 80, w: 70, h: 88 },
          contourPoints: [
            { x: 1692, y: 80 },
            { x: 1750, y: 96 },
            { x: 1738, y: 168 },
            { x: 1680, y: 150 },
          ],
        },
      ],
    }
  );

  assert.deepEqual(candidates.map((candidate) => candidate.id), [
    "candidate-large",
    "candidate-small",
    "candidate-far",
  ]);
});

test("magic select re-click near the same anchor cycles existing candidates without recomputing", () => {
  let resolveCalls = 0;
  const readFirstString = instantiateFunction("readFirstString");
  const state = {
    imagesById: new Map([
      ["img-hero", { id: "img-hero", path: "/tmp/source.png", width: 400, height: 300 }],
    ]),
    communication: {
      regionProposalsByImageId: new Map([
        [
          "img-hero",
          {
            imageId: "img-hero",
            imagePath: "/tmp/source.png",
            anchor: { x: 120, y: 88 },
            candidates: [
              { id: "candidate-a", bounds: { x: 90, y: 60, w: 80, h: 90 } },
              { id: "candidate-b", bounds: { x: 100, y: 64, w: 76, h: 86 } },
            ],
            activeCandidateIndex: 0,
            chosenCandidateId: "candidate-a",
          },
        ],
      ]),
      lastAnchor: null,
    },
  };
  const applyCommunicationMagicSelectAtPoint = instantiateFunction("applyCommunicationMagicSelectAtPoint", {
    state,
    clamp,
    readFirstString,
    communicationRegionGroupForImage: (imageId = "") =>
      state.communication.regionProposalsByImageId.get(String(imageId || "").trim()) || null,
    resolveCommunicationMagicSelectCandidates: () => {
      resolveCalls += 1;
      return [{ id: "replacement" }];
    },
    communicationAnchorFromRegionGroup: (group = null) =>
      group
        ? {
            kind: "region",
            imageId: group.imageId,
            regionId: group.chosenCandidateId,
          }
        : null,
  });

  const group = applyCommunicationMagicSelectAtPoint(
    "img-hero",
    { x: 125, y: 92 },
    {
      candidates: [
        {
          id: "replacement",
          bounds: { x: 10, y: 10, width: 20, height: 20 },
          contourPoints: [
            { x: 10, y: 10 },
            { x: 30, y: 10 },
            { x: 30, y: 30 },
            { x: 10, y: 30 },
          ],
        },
      ],
    }
  );

  assert.equal(resolveCalls, 0);
  assert.equal(group?.activeCandidateIndex, 1);
  assert.equal(group?.chosenCandidateId, "candidate-b");
  assert.deepEqual(
    state.communication.regionProposalsByImageId.get("img-hero")?.candidates?.map((candidate) => candidate.id),
    ["candidate-a", "candidate-b"]
  );
  assert.deepEqual(state.communication.lastAnchor, {
    kind: "region",
    imageId: "img-hero",
    regionId: "candidate-b",
  });
});

test("magic select does not cycle a stale region group when the image path changed after apply", async () => {
  const { resolveCommunicationMagicSelectCandidates } = createMagicSelectHelpers();
  const readFirstString = instantiateFunction("readFirstString");
  const calls = [];
  const state = {
    runDir: "/tmp/run-hero",
    imagesById: new Map([
      [
        "img-hero",
        {
          id: "img-hero",
          path: "/tmp/generated.png",
          width: 320,
          height: 240,
          receiptPath: "/tmp/generated-receipt.json",
        },
      ],
    ]),
    communication: {
      regionProposalsByImageId: new Map([
        [
          "img-hero",
          {
            imageId: "img-hero",
            imagePath: "/tmp/source.png",
            anchor: { x: 120, y: 88 },
            candidates: [
              { id: "candidate-stale-a", bounds: { x: 90, y: 60, w: 80, h: 90 } },
              { id: "candidate-stale-b", bounds: { x: 100, y: 64, w: 76, h: 86 } },
            ],
            activeCandidateIndex: 0,
            chosenCandidateId: "candidate-stale-a",
          },
        ],
      ]),
      lastAnchor: null,
      proposalTray: {
        visible: false,
        anchor: null,
      },
    },
  };
  const communicationRegionGroupForImage = (imageId = "") =>
    state.communication.regionProposalsByImageId.get(String(imageId || "").trim()) || null;
  const communicationAnchorFromRegionGroup = (group = null) =>
    group
      ? {
          kind: "region",
          imageId: group.imageId,
          regionId: group.chosenCandidateId,
        }
      : null;
  const applyCommunicationMagicSelectAtPoint = instantiateFunction("applyCommunicationMagicSelectAtPoint", {
    state,
    clamp,
    readFirstString,
    communicationRegionGroupForImage,
    communicationAnchorFromRegionGroup,
    resolveCommunicationMagicSelectCandidates,
  });
  const runLocalCommunicationMagicSelectAtPoint = instantiateFunction("runLocalCommunicationMagicSelectAtPoint", {
    state,
    clamp,
    readFirstString,
    ensureRun: async () => {
      calls.push(["ensureRun"]);
    },
    setStatus: () => {},
    beginLocalMagicSelectUiActivity: () => {},
    endLocalMagicSelectUiActivity: () => {},
    localMagicSelectPreparedImageForUi: () => ({
      id: "prepared-generated",
      imageId: "img-hero",
      imagePath: "/tmp/generated.png",
      runDir: "/tmp/run-hero",
      stableSourceRef: "/tmp/generated-receipt.json",
      source: "communication_magic_select",
    }),
    rememberLocalMagicSelectPreparedImageForUi: () => null,
    prepareLocalMagicSelectImageForUi: async () => null,
    dropLocalMagicSelectPreparedImageForUi: async () => null,
    runWarmLocalMagicSelectClick: async () => {
      calls.push(["warm_runtime"]);
      return {
        ok: true,
        contract: "juggernaut.magic_select.local.prepared.v1",
        action: "magic_select_warm_click",
        imageId: "img-hero",
        preparedImageId: "prepared-generated",
        preparedImage: {
          id: "prepared-generated",
          imageId: "img-hero",
          imagePath: "/tmp/generated.png",
          runDir: "/tmp/run-hero",
          stableSourceRef: "/tmp/generated-receipt.json",
          source: "communication_magic_select",
        },
        group: {
          candidates: [
            {
              id: "candidate-fresh",
              bounds: { x: 18, y: 22, w: 126, h: 146 },
              contourPoints: [
                { x: 34, y: 22 },
                { x: 144, y: 34 },
                { x: 130, y: 168 },
                { x: 18, y: 154 },
              ],
              maskRef: {
                path: "/tmp/run-hero/mask-fresh.png",
                sha256: "fresh456",
                width: 160,
                height: 180,
                format: "png",
              },
              confidence: 0.87,
              source: "local_model:mobile_sam_vit_t",
            },
          ],
        },
        warnings: [],
      };
    },
    runLocalMagicSelectClick: async () => {
      throw new Error("cold runtime should not be needed");
    },
    applyCommunicationMagicSelectAtPoint,
    communicationRegionGroupForImage,
    communicationTrayAnchorPinnedToTitlebar: () => false,
    showToast: () => {},
    invalidateActiveTabPreview: () => {},
    dispatchJuggernautShellEvent: () => {},
    COMMUNICATION_STATE_CHANGED_EVENT: "juggernaut:communication-state-changed",
    buildCommunicationBridgeSnapshot: () => ({ regionSelections: [] }),
    buildJuggernautShellContext: () => ({ activeImageId: "img-hero" }),
    requestRender: () => {},
  });

  const response = await runLocalCommunicationMagicSelectAtPoint("img-hero", { x: 125, y: 92 }, {
    source: "communication_magic_select",
  });

  assert.equal(response.ok, true);
  assert.equal(response.group?.chosenCandidateId, "candidate-fresh");
  assert.deepEqual(calls, [["ensureRun"], ["warm_runtime"]]);
});

test("magic select prewarm target sync primes the active image before the tool is armed and skips identical rerender work", () => {
  const state = {
    activeTabId: "tab-1",
    runDir: "/tmp/run-hero",
    imagesById: new Map([
      [
        "img-hero",
        {
          id: "img-hero",
          path: "/tmp/source.png",
        },
      ],
    ]),
  };
  const runtime = {
    preparedByImageId: new Map(),
    preparingByImageId: new Map(),
    primaryImageId: null,
    hoverImageId: null,
  };
  const calls = [];
  const syncLocalMagicSelectUiPrewarmTargets = instantiateFunction("syncLocalMagicSelectUiPrewarmTargets", {
    state,
    readFirstString: (...values) => values.find((value) => typeof value === "string" && value.trim()) || "",
    communicationBehaviorToolId: () => null,
    localMagicSelectUiPrewarmRuntimeForTab: () => runtime,
    localMagicSelectPreparedImageForUi: (imageId) => runtime.preparedByImageId.get(imageId) || null,
    localMagicSelectPreparingTaskForUi: (imageId) => runtime.preparingByImageId.get(imageId)?.task || null,
    prepareLocalMagicSelectImageForUi: async (imageId, options) => {
      calls.push(["prepare", imageId, options]);
      runtime.preparingByImageId.set(imageId, {
        task: Promise.resolve(null),
        imagePath: state.imagesById.get(imageId)?.path || "",
        runDir: state.runDir,
      });
      return null;
    },
    dropLocalMagicSelectPreparedImageForUi: async (imageId, options) => {
      calls.push(["drop", imageId, options]);
      return null;
    },
  });

  const first = syncLocalMagicSelectUiPrewarmTargets({
    primaryImageId: "img-hero",
    hoverImageId: null,
    source: "communication_magic_select",
  });
  const second = syncLocalMagicSelectUiPrewarmTargets({
    primaryImageId: "img-hero",
    hoverImageId: null,
    source: "communication_magic_select",
  });

  assert.equal(first, true);
  assert.equal(second, true);
  assert.equal(runtime.primaryImageId, "img-hero");
  assert.equal(runtime.hoverImageId, null);
  assert.deepEqual(calls, [
    [
      "prepare",
      "img-hero",
      {
        tabId: "tab-1",
        source: "communication_magic_select",
      },
    ],
  ]);
});

test("magic select prewarm target sync re-primes the same image id after its source path changes", () => {
  const state = {
    activeTabId: "tab-1",
    runDir: "/tmp/run-hero",
    imagesById: new Map([
      [
        "img-hero",
        {
          id: "img-hero",
          path: "/tmp/generated.png",
        },
      ],
    ]),
  };
  const runtime = {
    preparedByImageId: new Map([
      [
        "img-hero",
        {
          id: "prepared-old",
          imageId: "img-hero",
          imagePath: "/tmp/source.png",
          runDir: "/tmp/run-hero",
        },
      ],
    ]),
    preparingByImageId: new Map([
      [
        "img-hero",
        {
          task: Promise.resolve(null),
          imagePath: "/tmp/source.png",
          runDir: "/tmp/run-hero",
        },
      ],
    ]),
    primaryImageId: "img-hero",
    hoverImageId: null,
  };
  const calls = [];
  const syncLocalMagicSelectUiPrewarmTargets = instantiateFunction("syncLocalMagicSelectUiPrewarmTargets", {
    state,
    readFirstString: (...values) => values.find((value) => typeof value === "string" && value.trim()) || "",
    communicationBehaviorToolId: () => null,
    localMagicSelectUiPrewarmRuntimeForTab: () => runtime,
    localMagicSelectPreparedImageForUi: (imageId, options) => {
      calls.push(["prepared_lookup", imageId, options]);
      runtime.preparedByImageId.delete(imageId);
      return null;
    },
    localMagicSelectPreparingTaskForUi: (imageId, options) => {
      calls.push(["preparing_lookup", imageId, options]);
      runtime.preparingByImageId.delete(imageId);
      return null;
    },
    prepareLocalMagicSelectImageForUi: async (imageId, options) => {
      calls.push(["prepare", imageId, options]);
      return null;
    },
    dropLocalMagicSelectPreparedImageForUi: async (imageId, options) => {
      calls.push(["drop", imageId, options]);
      return null;
    },
  });

  const result = syncLocalMagicSelectUiPrewarmTargets({
    primaryImageId: "img-hero",
    hoverImageId: null,
    source: "communication_magic_select",
  });

  assert.equal(result, true);
  assert.deepEqual(calls, [
    [
      "prepared_lookup",
      "img-hero",
      {
        tabId: "tab-1",
        imagePath: "/tmp/generated.png",
        runDir: "/tmp/run-hero",
      },
    ],
    [
      "preparing_lookup",
      "img-hero",
      {
        tabId: "tab-1",
        imagePath: "/tmp/generated.png",
        runDir: "/tmp/run-hero",
      },
    ],
    [
      "prepare",
      "img-hero",
      {
        tabId: "tab-1",
        source: "communication_magic_select",
      },
    ],
  ]);
});

test("replace image in place clears stale magic select prewarm state and re-syncs the active target", async () => {
  const calls = [];
  const state = {
    activeId: "img-hero",
    runDir: "/tmp/run-hero",
    describePendingPath: null,
    imagesById: new Map([
      [
        "img-hero",
        {
          id: "img-hero",
          path: "/tmp/source.png",
          receiptPath: "/tmp/source-receipt.json",
          receiptMeta: { stale: true },
          receiptMetaChecked: true,
          receiptMetaLoading: true,
          label: "source.png",
          kind: "source",
          img: { naturalWidth: 1, naturalHeight: 1 },
          width: 1,
          height: 1,
          visionDesc: "old",
          visionPending: true,
        },
      ],
    ]),
    communication: {
      regionProposalsByImageId: new Map([
        [
          "img-hero",
          {
            imageId: "img-hero",
            imagePath: "/tmp/source.png",
            anchor: { x: 120, y: 88 },
            candidates: [{ id: "candidate-a" }],
            activeCandidateIndex: 0,
            chosenCandidateId: "candidate-a",
          },
        ],
      ]),
      lastAnchor: { kind: "region", imageId: "img-hero", regionId: "candidate-a" },
    },
  };
  const replaceImageInPlace = instantiateFunction("replaceImageInPlace", {
    state,
    clearEffectTokenForImageId: (imageId) => calls.push(["clear_effect", imageId]),
    invalidateActiveTabPreview: (reason) => calls.push(["invalidate_preview", reason]),
    invalidateImageCache: (imagePath) => calls.push(["invalidate_image_cache", imagePath]),
    dropVisionDescribePath: (imagePath, options) => calls.push(["drop_vision", imagePath, options]),
    markActiveTabUiDirty: (detail) => calls.push(["mark_ui_dirty", detail]),
    basename: (imagePath = "") => String(imagePath || "").split("/").pop(),
    updateFilmstripThumb: (item) => calls.push(["update_thumb", item.path]),
    syncLocalMagicSelectUiPrewarmTargets: (detail) => calls.push(["sync_magic_prewarm", detail]),
    syncActiveTabRecord: (detail) => calls.push(["sync_tab_record", detail]),
    ensureReceiptMeta: async (item) => {
      calls.push(["ensure_receipt_meta", item.receiptPath]);
      return null;
    },
    loadImage: async (imagePath) => {
      calls.push(["load_image", imagePath]);
      return { naturalWidth: 1920, naturalHeight: 1080 };
    },
    setEngineActiveImage: async (imagePath) => calls.push(["set_engine_active_image", imagePath]),
    renderSelectionMeta: () => calls.push(["render_selection_meta"]),
    chooseSpawnNodes: () => calls.push(["choose_spawn_nodes"]),
    renderHudReadout: () => calls.push(["render_hud_readout"]),
    resetViewToFit: () => calls.push(["reset_view_to_fit"]),
    requestRender: () => calls.push(["request_render"]),
    scheduleVisualPromptWrite: () => calls.push(["schedule_visual_prompt_write"]),
    motherIdleSyncFromInteraction: (detail) => calls.push(["mother_idle_sync", detail]),
    dropLocalMagicSelectPreparedImageForUi: async (imageId, detail) => {
      calls.push(["drop_magic_prewarm", imageId, detail]);
      return null;
    },
    console: { error: () => {} },
  });

  const ok = await replaceImageInPlace("img-hero", {
    path: "/tmp/generated.png",
    receiptPath: "/tmp/generated-receipt.json",
    kind: "engine",
  });

  assert.equal(ok, true);
  assert.equal(state.imagesById.get("img-hero")?.path, "/tmp/generated.png");
  assert.equal(state.imagesById.get("img-hero")?.receiptPath, "/tmp/generated-receipt.json");
  assert.equal(state.imagesById.get("img-hero")?.kind, "engine");
  assert.deepEqual(calls.find(([name]) => name === "drop_magic_prewarm"), [
    "drop_magic_prewarm",
    "img-hero",
    {
      reason: "image_replaced",
    },
  ]);
  assert.deepEqual(calls.find(([name]) => name === "sync_magic_prewarm"), [
    "sync_magic_prewarm",
    {
      primaryImageId: "img-hero",
      hoverImageId: null,
      source: "communication_magic_select",
    },
  ]);
  assert.equal(state.communication.regionProposalsByImageId.has("img-hero"), false);
  assert.equal(state.communication.lastAnchor, null);
});

test("single-image rail magic select selection prefers contour points and carries mask metadata", () => {
  const { communicationPointsBounds, communicationRegionCandidateImagePoints } = createMagicSelectHelpers();
  const state = {
    communication: {
      regionProposalsByImageId: new Map([
        [
          "img-hero",
          {
            imageId: "img-hero",
            candidates: [
              {
                id: "subject-1",
                bounds: { x: 20, y: 30, w: 80, h: 90 },
                contourPoints: [
                  { x: 24, y: 34 },
                  { x: 82, y: 32 },
                  { x: 90, y: 112 },
                  { x: 28, y: 118 },
                ],
                maskRef: {
                  path: "/tmp/run/mask-subject-1.png",
                  sha256: "abc123",
                  width: 96,
                  height: 112,
                  format: "png",
                },
                source: "local_mask_worker",
                confidence: 0.91,
              },
            ],
            activeCandidateIndex: 0,
            chosenCandidateId: "subject-1",
          },
        ],
      ]),
    },
  };
  const singleImageRailMagicSelectSelectionForImage = instantiateFunction("singleImageRailMagicSelectSelectionForImage", {
    state,
    clamp,
    communicationPointsBounds,
    communicationRegionCandidateImagePoints,
    communicationRegionGroupForImage: (imageId = "") =>
      state.communication.regionProposalsByImageId.get(String(imageId || "").trim()) || null,
  });

  const selection = singleImageRailMagicSelectSelectionForImage("img-hero");

  assert.deepEqual(selection?.polygon, [
    { x: 24, y: 34 },
    { x: 82, y: 32 },
    { x: 90, y: 112 },
    { x: 28, y: 118 },
  ]);
  assert.deepEqual(selection?.maskRef, {
    path: "/tmp/run/mask-subject-1.png",
    sha256: "abc123",
    width: 96,
    height: 112,
    format: "png",
  });
  assert.equal(selection?.source, "local_mask_worker");
  assert.equal(selection?.confidence, 0.91);
  assert.deepEqual(selection?.chosenRegionCandidate?.maskRef, {
    path: "/tmp/run/mask-subject-1.png",
    sha256: "abc123",
    width: 96,
    height: 112,
    format: "png",
  });
  assert.equal(selection?.chosenRegionCandidate?.source, "local_mask_worker");
  assert.equal(selection?.chosenRegionCandidate?.confidence, 0.91);
});

test("local communication magic select writes runtime-backed groups into communication state", async () => {
  const {
    resolveCommunicationMagicSelectCandidates,
  } = createMagicSelectHelpers();
  const readFirstString = instantiateFunction("readFirstString");
  const calls = [];
  const state = {
    runDir: "/tmp/run-hero",
    imagesById: new Map([
      [
        "img-hero",
        {
          id: "img-hero",
          path: "/tmp/source.png",
          width: 320,
          height: 240,
          receiptPath: "/tmp/source-receipt.json",
        },
      ],
    ]),
    communication: {
      regionProposalsByImageId: new Map(),
      lastAnchor: null,
      proposalTray: {
        visible: false,
        anchor: null,
      },
    },
  };
  const communicationRegionGroupForImage = (imageId = "") =>
    state.communication.regionProposalsByImageId.get(String(imageId || "").trim()) || null;
  const communicationAnchorFromRegionGroup = (group = null) =>
    group
      ? {
          kind: "region",
          imageId: group.imageId,
          regionId: group.chosenCandidateId,
        }
      : null;
  const applyCommunicationMagicSelectAtPoint = instantiateFunction("applyCommunicationMagicSelectAtPoint", {
    state,
    clamp,
    readFirstString,
    communicationRegionGroupForImage,
    communicationAnchorFromRegionGroup,
    resolveCommunicationMagicSelectCandidates,
  });
  const runLocalCommunicationMagicSelectAtPoint = instantiateFunction("runLocalCommunicationMagicSelectAtPoint", {
    state,
    clamp,
    readFirstString,
    ensureRun: async () => {
      calls.push(["ensureRun"]);
    },
    setStatus: (message) => {
      calls.push(["status", message]);
    },
    beginLocalMagicSelectUiActivity: (kind) => {
      calls.push(["activity_begin", kind]);
    },
    endLocalMagicSelectUiActivity: (kind) => {
      calls.push(["activity_end", kind]);
    },
    localMagicSelectPreparedImageForUi: () => null,
    rememberLocalMagicSelectPreparedImageForUi: () => null,
    prepareLocalMagicSelectImageForUi: async (imageId, options) => {
      calls.push(["prepare", imageId, options]);
      return null;
    },
    dropLocalMagicSelectPreparedImageForUi: async () => null,
    runWarmLocalMagicSelectClick: async () => {
      throw new Error("warm click should not run without a prepared image");
    },
    runLocalMagicSelectClick: async (request) => {
      calls.push(["runtime", request]);
      return {
        ok: true,
        contract: "juggernaut.magic_select.local.v1",
        action: "magic_select_click",
        imageId: "img-hero",
        group: {
          chosenCandidateId: "candidate-runtime",
          reproducibility: {
            modelId: "mobile_sam_vit_t",
          },
          candidates: [
            {
              id: "candidate-runtime",
              bounds: { x: 24, y: 30, w: 84, h: 96 },
              contourPoints: [
                { x: 24, y: 30 },
                { x: 106, y: 28 },
                { x: 108, y: 124 },
                { x: 28, y: 126 },
              ],
              maskRef: {
                path: "/tmp/run-hero/mask.png",
                sha256: "def456",
                width: 120,
                height: 144,
                format: "png",
              },
              confidence: 0.93,
              source: "local_model:mobile_sam_vit_t",
            },
          ],
        },
        receipt: {
          path: "/tmp/run-hero/receipt-magic-select.json",
          reproducibility: {
            modelId: "mobile_sam_vit_t",
          },
        },
        warnings: ["native contour simplified"],
      };
    },
    applyCommunicationMagicSelectAtPoint,
    communicationRegionGroupForImage,
    communicationTrayAnchorPinnedToTitlebar: () => false,
    showToast: () => {},
    invalidateActiveTabPreview: (reason) => {
      calls.push(["invalidate", reason]);
    },
    dispatchJuggernautShellEvent: (name, detail) => {
      calls.push(["dispatch", name, detail]);
    },
    COMMUNICATION_STATE_CHANGED_EVENT: "juggernaut:communication-state-changed",
    buildCommunicationBridgeSnapshot: () => ({ regionSelections: [] }),
    buildJuggernautShellContext: () => ({ activeImageId: "img-hero" }),
    requestRender: () => {
      calls.push(["render"]);
    },
  });

  const response = await runLocalCommunicationMagicSelectAtPoint("img-hero", { x: 48, y: 52 }, {
    source: "communication_magic_select",
  });

  assert.equal(response.ok, true);
  assert.equal(response.fallback, false);
  assert.equal(response.group?.chosenCandidateId, "candidate-runtime");
  assert.equal(response.receipt?.path, "/tmp/run-hero/receipt-magic-select.json");
  assert.deepEqual(response.warnings, ["native contour simplified"]);
  assert.deepEqual(state.communication.regionProposalsByImageId.get("img-hero")?.reproducibility, {
    modelId: "mobile_sam_vit_t",
  });
  assert.deepEqual(state.communication.regionProposalsByImageId.get("img-hero")?.warnings, ["native contour simplified"]);
  assert.deepEqual(state.communication.regionProposalsByImageId.get("img-hero")?.receipt, {
    path: "/tmp/run-hero/receipt-magic-select.json",
    reproducibility: {
      modelId: "mobile_sam_vit_t",
    },
  });
  assert.equal(calls[0][0], "ensureRun");
  assert.deepEqual(calls.find(([name]) => name === "runtime"), [
    "runtime",
    {
      imageId: "img-hero",
      imagePath: "/tmp/source.png",
      runDir: "/tmp/run-hero",
      stableSourceRef: "/tmp/source-receipt.json",
      clickAnchor: { x: 48, y: 52 },
      source: "communication_magic_select",
    },
  ]);
  assert.deepEqual(calls.find(([name]) => name === "prepare"), [
    "prepare",
    "img-hero",
    {
      source: "communication_magic_select",
    },
  ]);
  assert.deepEqual(calls.find(([name]) => name === "activity_begin"), ["activity_begin", "click"]);
  assert.deepEqual(calls.findLast(([name]) => name === "activity_end"), ["activity_end", "click"]);
});

test("local communication magic select uses the warm prepared-image path when prewarmed", async () => {
  const {
    resolveCommunicationMagicSelectCandidates,
  } = createMagicSelectHelpers();
  const readFirstString = instantiateFunction("readFirstString");
  const calls = [];
  const toastCalls = [];
  const state = {
    runDir: "/tmp/run-hero",
    imagesById: new Map([
      [
        "img-hero",
        {
          id: "img-hero",
          path: "/tmp/source.png",
          width: 320,
          height: 240,
          receiptPath: "/tmp/source-receipt.json",
        },
      ],
    ]),
    communication: {
      regionProposalsByImageId: new Map(),
      lastAnchor: null,
      proposalTray: {
        visible: false,
        anchor: null,
      },
    },
  };
  const communicationRegionGroupForImage = (imageId = "") =>
    state.communication.regionProposalsByImageId.get(String(imageId || "").trim()) || null;
  const communicationAnchorFromRegionGroup = (group = null) =>
    group
      ? {
          kind: "region",
          imageId: group.imageId,
          regionId: group.chosenCandidateId,
        }
      : null;
  const applyCommunicationMagicSelectAtPoint = instantiateFunction("applyCommunicationMagicSelectAtPoint", {
    state,
    clamp,
    readFirstString,
    communicationRegionGroupForImage,
    communicationAnchorFromRegionGroup,
    resolveCommunicationMagicSelectCandidates,
  });
  const runLocalCommunicationMagicSelectAtPoint = instantiateFunction("runLocalCommunicationMagicSelectAtPoint", {
    state,
    clamp,
    readFirstString,
    ensureRun: async () => {
      calls.push(["ensureRun"]);
    },
    setStatus: (message) => {
      calls.push(["status", message]);
    },
    beginLocalMagicSelectUiActivity: (kind) => {
      calls.push(["activity_begin", kind]);
    },
    endLocalMagicSelectUiActivity: (kind) => {
      calls.push(["activity_end", kind]);
    },
    localMagicSelectPreparedImageForUi: (imageId, options) => {
      calls.push(["prepared_lookup", imageId, options]);
      return {
        id: "prepared-img-hero",
        imageId: "img-hero",
        imagePath: "/tmp/source.png",
        runDir: "/tmp/run-hero",
        stableSourceRef: "/tmp/source-receipt.json",
        source: "communication_magic_select",
      };
    },
    rememberLocalMagicSelectPreparedImageForUi: (preparedImage) => {
      calls.push(["remember", preparedImage]);
      return preparedImage;
    },
    prepareLocalMagicSelectImageForUi: async () => {
      throw new Error("prepare should not rerun when a warm handle is available");
    },
    dropLocalMagicSelectPreparedImageForUi: async () => {
      throw new Error("drop should not run when warm click succeeds");
    },
    runWarmLocalMagicSelectClick: async (request) => {
      calls.push(["warm_runtime", request]);
      return {
        ok: true,
        contract: "juggernaut.magic_select.local.prepared.v1",
        action: "magic_select_warm_click",
        imageId: "img-hero",
        preparedImageId: "prepared-img-hero",
        preparedImage: {
          id: "prepared-img-hero",
          imageId: "img-hero",
          imagePath: "/tmp/source.png",
          runDir: "/tmp/run-hero",
          stableSourceRef: "/tmp/source-receipt.json",
          source: "communication_magic_select",
          lastUsedAt: 1712345679900,
        },
        group: {
          chosenCandidateId: "candidate-small",
          reproducibility: {
            modelId: "mobile_sam_vit_t",
          },
          candidates: [
            {
              id: "candidate-small",
              bounds: { x: 28, y: 34, w: 80, h: 92 },
              contourPoints: [
                { x: 28, y: 34 },
                { x: 106, y: 30 },
                { x: 108, y: 122 },
                { x: 30, y: 126 },
              ],
              maskRef: {
                path: "/tmp/run-hero/mask-warm.png",
                sha256: "warm123",
                width: 120,
                height: 144,
                format: "png",
              },
              confidence: 0.95,
              source: "local_model:mobile_sam_vit_t",
            },
            {
              id: "candidate-large",
              bounds: { x: 18, y: 22, w: 126, h: 146 },
              contourPoints: [
                { x: 34, y: 22 },
                { x: 144, y: 34 },
                { x: 130, y: 168 },
                { x: 18, y: 154 },
              ],
              maskRef: {
                path: "/tmp/run-hero/mask-warm-2.png",
                sha256: "warm456",
                width: 160,
                height: 180,
                format: "png",
              },
              confidence: 0.87,
              source: "local_model:mobile_sam_vit_t",
            },
          ],
        },
        receipt: {
          path: "/tmp/run-hero/receipt-magic-select-warm.json",
          reproducibility: {
            modelId: "mobile_sam_vit_t",
          },
        },
        warnings: ["cache_hit"],
      };
    },
    runLocalMagicSelectClick: async () => {
      throw new Error("cold runtime should not run when a warm handle is available");
    },
    applyCommunicationMagicSelectAtPoint,
    communicationRegionGroupForImage,
    communicationTrayAnchorPinnedToTitlebar: () => false,
    showToast: (message, kind, duration) => {
      toastCalls.push({ message, kind, duration });
    },
    invalidateActiveTabPreview: (reason) => {
      calls.push(["invalidate", reason]);
    },
    dispatchJuggernautShellEvent: (name, detail) => {
      calls.push(["dispatch", name, detail]);
    },
    COMMUNICATION_STATE_CHANGED_EVENT: "juggernaut:communication-state-changed",
    buildCommunicationBridgeSnapshot: () => ({ regionSelections: [] }),
    buildJuggernautShellContext: () => ({ activeImageId: "img-hero" }),
    requestRender: () => {
      calls.push(["render"]);
    },
  });

  const response = await runLocalCommunicationMagicSelectAtPoint("img-hero", { x: 60, y: 72 }, {
    source: "communication_magic_select",
  });

  assert.equal(response.ok, true);
  assert.equal(response.fallback, false);
  assert.equal(response.action, "magic_select_warm_click");
  assert.equal(response.receipt?.path, "/tmp/run-hero/receipt-magic-select-warm.json");
  assert.equal(response.group?.chosenCandidateId, "candidate-large");
  assert.deepEqual(response.warnings, ["cache_hit"]);
  assert.deepEqual(calls.find(([name]) => name === "warm_runtime"), [
    "warm_runtime",
    {
      preparedImageId: "prepared-img-hero",
      preparedImage: {
        id: "prepared-img-hero",
        imageId: "img-hero",
        imagePath: "/tmp/source.png",
        runDir: "/tmp/run-hero",
        stableSourceRef: "/tmp/source-receipt.json",
        source: "communication_magic_select",
      },
      imageId: "img-hero",
      clickAnchor: { x: 60, y: 72 },
      source: "communication_magic_select",
    },
  ]);
  assert.deepEqual(calls.find(([name]) => name === "remember"), [
    "remember",
    {
      id: "prepared-img-hero",
      imageId: "img-hero",
      imagePath: "/tmp/source.png",
      runDir: "/tmp/run-hero",
      stableSourceRef: "/tmp/source-receipt.json",
      source: "communication_magic_select",
      lastUsedAt: 1712345679900,
    },
  ]);
  assert.deepEqual(calls.find(([name]) => name === "activity_begin"), ["activity_begin", "click"]);
  assert.deepEqual(calls.findLast(([name]) => name === "activity_end"), ["activity_end", "click"]);
  assert.deepEqual(toastCalls.at(-1), {
    message: "Magic Select found 2 masks. Click again near the same spot to cycle.",
    kind: "tip",
    duration: 2800,
  });
});

test("local communication magic select falls back to coarse candidates when the runtime fails", async () => {
  const {
    resolveCommunicationMagicSelectCandidates,
  } = createMagicSelectHelpers();
  const readFirstString = instantiateFunction("readFirstString");
  const state = {
    runDir: "/tmp/run-hero",
    imagesById: new Map([
      [
        "img-hero",
        {
          id: "img-hero",
          path: "/tmp/source.png",
          width: 320,
          height: 240,
        },
      ],
    ]),
    communication: {
      regionProposalsByImageId: new Map(),
      lastAnchor: null,
      proposalTray: {
        visible: false,
        anchor: null,
      },
    },
  };
  const communicationRegionGroupForImage = (imageId = "") =>
    state.communication.regionProposalsByImageId.get(String(imageId || "").trim()) || null;
  const communicationAnchorFromRegionGroup = (group = null) =>
    group
      ? {
          kind: "region",
          imageId: group.imageId,
          regionId: group.chosenCandidateId,
        }
      : null;
  const applyCommunicationMagicSelectAtPoint = instantiateFunction("applyCommunicationMagicSelectAtPoint", {
    state,
    clamp,
    readFirstString,
    communicationRegionGroupForImage,
    communicationAnchorFromRegionGroup,
    resolveCommunicationMagicSelectCandidates,
  });
  const runLocalCommunicationMagicSelectAtPoint = instantiateFunction("runLocalCommunicationMagicSelectAtPoint", {
    state,
    clamp,
    readFirstString,
    ensureRun: async () => {},
    setStatus: () => {},
    beginLocalMagicSelectUiActivity: () => {},
    endLocalMagicSelectUiActivity: () => {},
    localMagicSelectPreparedImageForUi: () => null,
    rememberLocalMagicSelectPreparedImageForUi: () => null,
    prepareLocalMagicSelectImageForUi: async () => null,
    dropLocalMagicSelectPreparedImageForUi: async () => null,
    runWarmLocalMagicSelectClick: async () => {
      throw new Error("warm click should not run without a prepared image");
    },
    runLocalMagicSelectClick: async () => {
      throw new Error("missing local weights");
    },
    applyCommunicationMagicSelectAtPoint,
    communicationRegionGroupForImage,
    communicationTrayAnchorPinnedToTitlebar: () => false,
    showToast: () => {},
    invalidateActiveTabPreview: () => {},
    dispatchJuggernautShellEvent: () => {},
    COMMUNICATION_STATE_CHANGED_EVENT: "juggernaut:communication-state-changed",
    buildCommunicationBridgeSnapshot: () => ({ regionSelections: [] }),
    buildJuggernautShellContext: () => ({ activeImageId: "img-hero" }),
    requestRender: () => {},
  });

  const response = await runLocalCommunicationMagicSelectAtPoint("img-hero", { x: 60, y: 72 }, {
    source: "communication_magic_select",
  });

  assert.equal(response.ok, true);
  assert.equal(response.fallback, true);
  assert.equal(response.receipt, null);
  assert.ok(Array.isArray(response.group?.candidates));
  assert.equal(response.group?.candidates?.length, 3);
  assert.ok(response.group?.candidates?.every((candidate) => candidate.source === "coarse_fallback"));
  assert.deepEqual(response.warnings, ["missing local weights"]);
});

test("communication overlay renders the active magic select candidate from contour points instead of bounds geometry", () => {
  const rendered = [];
  const state = {
    communication: {
      regionProposalsByImageId: new Map([
        [
          "img-hero",
          {
            imageId: "img-hero",
            candidates: [
              {
                id: "subject-1",
                bounds: { x: 20, y: 20, w: 80, h: 100 },
                contourPoints: [
                  { x: 24, y: 30 },
                  { x: 88, y: 28 },
                  { x: 92, y: 106 },
                  { x: 28, y: 118 },
                ],
              },
            ],
            activeCandidateIndex: 0,
          },
        ],
      ]),
      marksByImageId: new Map(),
      canvasMarks: [],
      markDraft: null,
    },
  };
  const octx = {
    save() {},
    restore() {},
    setLineDash() {},
    fill() {
      rendered.push({ type: "fill", fillStyle: this.fillStyle });
    },
    stroke() {
      rendered.push({ type: "stroke", strokeStyle: this.strokeStyle, lineWidth: this.lineWidth });
    },
  };
  const els = {
    workCanvas: null,
  };
  const renderCommunicationOverlay = instantiateFunction("renderCommunicationOverlay", {
    getDpr: () => 1,
    els,
    state,
    imageToCanvasForImageId: (_imageId, point) => ({ x: Number(point?.x) || 0, y: Number(point?.y) || 0 }),
    COMMUNICATION_REGION_ACTIVE: "active",
    COMMUNICATION_REGION_IDLE: "idle",
    drawPolygonPath: (_ctx, polygon) => {
      rendered.push({ type: "polygon", polygon });
      return true;
    },
    communicationDraftPointsToCanvas: () => [],
    communicationMarkPointsToCanvas: () => [],
    COMMUNICATION_MARK_STROKE: "rgba(220, 28, 28, 0.96)",
    COMMUNICATION_PROTECT_STROKE: "rgba(0, 0, 0, 0.92)",
    traceCommunicationMarkPath: () => false,
    communicationCanvasMarks: () => [],
    communicationCanvasStamps: () => [],
    communicationCanvasCssScaleForImageId: () => 1,
    communicationMarkViewportScale: () => 1,
  });

  renderCommunicationOverlay(octx);

  assert.deepEqual(rendered[0], {
    type: "polygon",
    polygon: [
      { x: 24, y: 30 },
      { x: 88, y: 28 },
      { x: 92, y: 106 },
      { x: 28, y: 118 },
    ],
  });
  assert.deepEqual(rendered[1], {
    type: "fill",
    fillStyle: "rgba(100, 210, 255, 0.18)",
  });
  assert.deepEqual(rendered[2], {
    type: "stroke",
    strokeStyle: "active",
    lineWidth: 3,
  });
});
