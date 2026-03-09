import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildDesignReviewRequest,
  buildDesignReviewPlannerPrompt,
  createDesignReviewSkeletonSlots,
  parseDesignReviewPlannerResponse,
} from "../src/design_review_contract.js";

test("design review request builder carries visible canvas context, marks, selected ids, cached analyses, and account memory", () => {
  const request = buildDesignReviewRequest({
    shellContext: {
      runDir: "/tmp/run-1",
      activeImageId: "img-1",
      selectedImageIds: ["img-1"],
      regionSelectionActive: true,
      images: [{ id: "img-1", path: "/tmp/input.png" }],
    },
    visibleCanvasRef: "/tmp/run-1/design-review-visible.png",
    visualPrompt: {
      canvas: { mode: "single", active_image_id: "img-1" },
      marks: [{ id: "mark-1", type: "box" }],
    },
    regionCandidates: [
      {
        id: "region-1",
        imageId: "img-1",
        bounds: { x: 12, y: 18, width: 48, height: 52 },
      },
    ],
    activeRegionCandidateId: "region-1",
    cachedImageAnalyses: [{ hash: "hash-1", analysisRef: "analysis/hash-1.json" }],
    accountMemorySummary: { memoryRef: "memory/account.json" },
  });

  assert.equal(request.visibleCanvasRef, "/tmp/run-1/design-review-visible.png");
  assert.deepEqual(request.markIds, ["mark-1"]);
  assert.equal(request.activeRegionCandidateId, "region-1");
  assert.equal(request.selectionState, "region");
  assert.deepEqual(request.selectedImageIds, ["img-1"]);
  assert.equal(request.cachedImageAnalyses[0].hash, "hash-1");
  assert.equal(request.uploadAnalysisRef, "analysis/hash-1.json");
  assert.equal(request.accountMemoryRef, "memory/account.json");
});

test("design review planner response parser accepts fenced JSON and normalizes proposal fields", () => {
  const response = parseDesignReviewPlannerResponse(
    [
      "```json",
      JSON.stringify(
        {
          proposals: [
            {
              title: "Cut out subject",
              imageId: "img-1",
              actionType: "cut_out_subject",
              why: "The subject is isolated cleanly from the background.",
              previewBrief: "Show the subject floating over a neutral matte.",
              applyBrief: "Isolate the subject and keep edge detail.",
              negativeConstraints: ["Do not change wardrobe", "Do not crop the face"],
            },
          ],
        },
        null,
        2
      ),
      "```",
    ].join("\n"),
    {
      requestId: "review-1",
      primaryImageId: "img-1",
      markIds: ["mark-1"],
      slotCount: 3,
    }
  );

  assert.equal(response.ok, true);
  assert.equal(response.proposals.length, 1);
  assert.equal(response.proposals[0].label, "Cut out subject");
  assert.equal(response.proposals[0].actionType, "cut_out_subject");
  assert.equal(response.proposals[0].capability, "subject_isolation");
  assert.deepEqual(response.proposals[0].targetRegion.markIds, ["mark-1"]);
  assert.deepEqual(response.proposals[0].negativeConstraints, ["Do not change wardrobe", "Do not crop the face"]);
});

test("design review skeleton slots reserve 2-3 preview slots immediately", () => {
  const slots = createDesignReviewSkeletonSlots({
    request: {
      requestId: "review-2",
      primaryImageId: "img-2",
    },
    slotCount: 3,
  });

  assert.equal(slots.length, 3);
  assert.equal(slots.every((slot) => slot.status === "skeleton"), true);
  assert.equal(slots.every((slot) => slot.previewJob.status === "queued"), true);
});

test("design review planner prompt stays compact and defines actions as edit intents", () => {
  const prompt = buildDesignReviewPlannerPrompt({
    requestId: "review-compact",
    visibleCanvasRef: "/tmp/review-visible.png",
    markIds: ["mark-1"],
    slotCount: 3,
  });

  assert.match(prompt, /View the canvas image and visible annotations only\./);
  assert.match(prompt, /An action is a concrete visual edit the editor could apply to the image\./);
  assert.match(prompt, /Write actions as short edit intents, not advice, critique, or conversation\./);
  assert.match(prompt, /Return 3 ranked proposals as JSON only\./);
  assert.match(prompt, /"markIds": \[\s*"optional annotation ids"\s*\]/);
  assert.match(prompt, /"actionType": "short edit intent like remove_object, brighten_area, simplify_background"/);
  assert.doesNotMatch(prompt, /"requestId": "review-compact"/);
  assert.doesNotMatch(prompt, /"visibleCanvasRef": "\/tmp\/review-visible\.png"/);
});
