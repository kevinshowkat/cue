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
  });
  return {
    communicationPointsBounds,
    communicationRegionCandidateImagePoints,
    normalizeCommunicationRegionBounds,
    normalizeCommunicationRegionContourPoints,
    normalizeCommunicationRegionCandidate,
    buildCommunicationFallbackRegionCandidate,
    resolveCommunicationMagicSelectCandidates,
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

test("magic select re-click near the same anchor cycles existing candidates without recomputing", () => {
  let resolveCalls = 0;
  const readFirstString = instantiateFunction("readFirstString");
  const state = {
    imagesById: new Map([
      ["img-hero", { id: "img-hero", width: 400, height: 300 }],
    ]),
    communication: {
      regionProposalsByImageId: new Map([
        [
          "img-hero",
          {
            imageId: "img-hero",
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
    runLocalMagicSelectClick: async () => {
      throw new Error("missing local weights");
    },
    applyCommunicationMagicSelectAtPoint,
    communicationRegionGroupForImage,
    communicationTrayAnchorPinnedToTitlebar: () => false,
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
  const renderCommunicationOverlay = instantiateFunction("renderCommunicationOverlay", {
    getDpr: () => 1,
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
