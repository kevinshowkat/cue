import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

function extractFunctionSource(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => app.indexOf(marker))
    .find((index) => index >= 0);
  assert.notEqual(start, undefined, `Could not find function ${name}`);
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
      return app.slice(start, index + 1);
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

test("fork communication sanitization preserves working marks while dropping design-review runtime state", () => {
  const createFreshCommunicationStampPickerState = () => ({
    visible: false,
    imageId: null,
    sourceImageId: null,
    coordinateSpace: null,
    targetPoint: null,
    targetBounds: null,
    anchorCss: null,
    anchorFrame: "shell",
    pickerMode: "intent_list",
    customText: "",
    selectedIntentId: "",
  });
  const createFreshCommunicationState = () => ({
    tool: null,
    markDraft: null,
    eraseDraft: null,
    stampPicker: createFreshCommunicationStampPickerState(),
    marksByImageId: new Map(),
    canvasMarks: [],
    stampsByImageId: new Map(),
    canvasStamps: [],
    regionProposalsByImageId: new Map(),
    reviewHistory: [],
    screenshotPolish: {
      proposalId: null,
      selectedProposalId: null,
      previewImagePath: null,
      changedRegionBounds: null,
      preserveRegionIds: [],
      rationaleCodes: [],
      frameContext: null,
      updatedAt: 0,
    },
    lastAnchor: null,
    proposalTray: {
      visible: false,
      requestId: null,
      source: null,
      anchor: null,
      anchorLockCss: null,
      anchorLockSignature: "",
      slots: [{ status: "hidden" }, { status: "hidden" }, { status: "hidden" }],
    },
    reviewRequestSeq: 0,
    lastReviewRequestedAt: 0,
  });
  const cloneScreenshotPolishState = (value = null) => ({
    proposalId: value?.proposalId || null,
    selectedProposalId: value?.selectedProposalId || value?.proposalId || null,
    previewImagePath: value?.previewImagePath || null,
    changedRegionBounds: value?.changedRegionBounds || null,
    preserveRegionIds: Array.isArray(value?.preserveRegionIds) ? value.preserveRegionIds.slice() : [],
    rationaleCodes: Array.isArray(value?.rationaleCodes) ? value.rationaleCodes.slice() : [],
    frameContext: value?.frameContext || null,
    updatedAt: Number(value?.updatedAt) || 0,
  });
  const sanitizeForkedCommunicationState = instantiateFunction("sanitizeForkedCommunicationState", {
    createFreshCommunicationState,
    createFreshCommunicationStampPickerState,
    cloneScreenshotPolishState,
    Map,
    Array,
  });

  const markDraft = { imageId: "img-1", points: [{ x: 1, y: 2 }] };
  const source = {
    tool: "marker",
    markDraft,
    eraseDraft: { imageId: "img-1", points: [{ x: 4, y: 5 }] },
    stampPicker: { visible: true, selectedIntentId: "fix" },
    marksByImageId: new Map([["img-1", [{ id: "mark-1" }]]]),
    canvasMarks: [{ id: "mark-1", imageId: "img-1" }],
    stampsByImageId: new Map([["img-1", [{ id: "stamp-1", intentId: "fix" }]]]),
    canvasStamps: [{ id: "stamp-canvas-1", intentId: "move" }],
    regionProposalsByImageId: new Map([["img-1", [{ id: "region-1" }]]]),
    reviewHistory: [{ requestId: "review-old" }],
    screenshotPolish: {
      proposalId: "proposal-1",
      selectedProposalId: "proposal-1",
      previewImagePath: "/tmp/preview.png",
      changedRegionBounds: { x: 4, y: 8, w: 32, h: 16 },
      preserveRegionIds: ["subject"],
      rationaleCodes: ["preserve_subject"],
      frameContext: { targetImageId: "img-1" },
      updatedAt: 123,
    },
    lastAnchor: { kind: "mark", imageId: "img-1", markId: "mark-1" },
    proposalTray: {
      visible: true,
      requestId: "review-live",
      source: "design_review_bootstrap_state",
      anchor: { kind: "titlebar" },
      anchorLockCss: { x: 10, y: 20 },
      anchorLockSignature: "sig-1",
      slots: [{ status: "preview_running" }, { status: "skeleton" }, { status: "hidden" }],
    },
    reviewRequestSeq: 7,
    lastReviewRequestedAt: 12345,
  };

  const result = sanitizeForkedCommunicationState(source);

  assert.notEqual(result, source);
  assert.equal(result.tool, "marker");
  assert.equal(result.markDraft, markDraft);
  assert.deepEqual(result.stampPicker, createFreshCommunicationStampPickerState());
  assert.deepEqual(Array.from(result.marksByImageId.entries()), [["img-1", [{ id: "mark-1" }]]]);
  assert.deepEqual(result.canvasMarks, [{ id: "mark-1", imageId: "img-1" }]);
  assert.deepEqual(Array.from(result.stampsByImageId.entries()), [["img-1", [{ id: "stamp-1", intentId: "fix" }]]]);
  assert.deepEqual(result.canvasStamps, [{ id: "stamp-canvas-1", intentId: "move" }]);
  assert.deepEqual(Array.from(result.regionProposalsByImageId.entries()), [["img-1", [{ id: "region-1" }]]]);
  assert.deepEqual(result.reviewHistory, [{ requestId: "review-old" }]);
  assert.deepEqual(result.screenshotPolish, {
    proposalId: "proposal-1",
    selectedProposalId: "proposal-1",
    previewImagePath: "/tmp/preview.png",
    changedRegionBounds: { x: 4, y: 8, w: 32, h: 16 },
    preserveRegionIds: ["subject"],
    rationaleCodes: ["preserve_subject"],
    frameContext: { targetImageId: "img-1" },
    updatedAt: 123,
  });
  assert.deepEqual(result.lastAnchor, { kind: "mark", imageId: "img-1", markId: "mark-1" });
  assert.equal(result.proposalTray.visible, false);
  assert.equal(result.proposalTray.requestId, null);
  assert.equal(result.proposalTray.source, null);
  assert.equal(result.proposalTray.anchor, null);
  assert.equal(result.proposalTray.anchorLockCss, null);
  assert.equal(result.proposalTray.anchorLockSignature, "");
  assert.deepEqual(result.proposalTray.slots, [{ status: "hidden" }, { status: "hidden" }, { status: "hidden" }]);
  assert.equal(result.reviewRequestSeq, 0);
  assert.equal(result.lastReviewRequestedAt, 0);
  assert.equal(source.proposalTray.requestId, "review-live");
});
