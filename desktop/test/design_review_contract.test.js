import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DESIGN_REVIEW_FINAL_APPLY_MODEL,
  buildDesignReviewRequest,
  buildDesignReviewApplyPrompt,
  buildDesignReviewApplyRequest,
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
    cachedImageAnalyses: [
      {
        hash: "hash-1",
        analysisRef: "analysis/hash-1.json",
        imageId: "img-1",
        imagePath: "/tmp/input.png",
        summary: "Michael Jordan portrait against a clean studio backdrop.",
        subjectTags: ["Michael Jordan", "basketball player"],
        styleTags: ["studio", "portrait"],
      },
    ],
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
  assert.deepEqual(request.imageIdentityHints, [
    {
      imageId: "img-1",
      role: "target",
      label: "/tmp/input.png",
      subject: "Michael Jordan",
      summary: "Michael Jordan portrait against a clean studio backdrop.",
      subjectTags: ["Michael Jordan", "basketball player"],
      styleTags: ["studio", "portrait"],
    },
  ]);
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

test("design review planner prompt stays compact, restores canvas-scope constraints, and defines actions as edit intents", () => {
  const prompt = buildDesignReviewPlannerPrompt({
    requestId: "review-compact",
    visibleCanvasRef: "/tmp/review-visible.png",
    markIds: ["mark-1"],
    slotCount: 3,
    imageIdentityHints: [
      {
        imageId: "img-ref-2",
        role: "reference",
        subject: "Michael Jordan",
        summary: "Michael Jordan in a red jersey.",
        subjectTags: ["Michael Jordan", "basketball"],
      },
    ],
  });

  assert.match(prompt, /View the canvas image and visible annotations only\./);
  assert.match(prompt, /An action is a concrete visual edit the editor could apply to the image\./);
  assert.match(prompt, /Write actions as short edit intents, not advice, critique, or conversation\./);
  assert.match(prompt, /Make previewBrief and applyBrief specific, positive, and verb-first\./);
  assert.match(prompt, /Use concise effect statements, not rationale essays\./);
  assert.match(prompt, /Use the whole visible canvas as context, not just the local annotation area\./);
  assert.match(prompt, /Treat annotations and the chosen region candidate as focus hints, not crop-only constraints\./);
  assert.match(prompt, /Use image identity hints when they exist so subjects are named concretely/);
  assert.match(prompt, /Prefer edits that can plausibly route through the normal execution layer later\./);
  assert.match(prompt, /Return 3 ranked proposals as JSON only\./);
  assert.match(prompt, /"imageIdentityHints": \[/);
  assert.match(prompt, /"subject": "Michael Jordan"/);
  assert.match(prompt, /"markIds": \[\s*"optional annotation ids"\s*\]/);
  assert.match(prompt, /"actionType": "short edit intent like remove_object, brighten_area, simplify_background"/);
  assert.match(prompt, /"previewBrief": "short verb-first effect statement"/);
  assert.match(prompt, /"applyBrief": "short verb-first sentence describing the exact edit"/);
  assert.doesNotMatch(prompt, /"requestId": "review-compact"/);
  assert.doesNotMatch(prompt, /"visibleCanvasRef": "\/tmp\/review-visible\.png"/);
});

test("design review apply prompt explicitly constrains edits to targetImage and guidance references only", () => {
  const prompt = buildDesignReviewApplyPrompt({
    request: {
      requestId: "review-apply-1",
      sessionId: "session-1",
      primaryImageId: "img-target",
      imageIdsInView: ["img-target", "img-ref"],
      markIds: ["mark-1"],
      activeRegionCandidateId: "region-1",
      selectedImageIds: ["img-target"],
      visibleCanvasContext: {
        runDir: "/tmp/run-apply",
        canvasMode: "single",
        imageCount: 2,
        activeImageId: "img-target",
      },
    },
    proposal: {
      label: "Tighten background",
      actionType: "background_replace",
      applyBrief: "Replace the background with a cleaner warm studio wall.",
      targetRegion: {
        markIds: ["mark-1"],
        regionCandidateId: "region-1",
        bounds: { x: 10, y: 12, width: 220, height: 260 },
      },
      negativeConstraints: ["Do not alter the subject pose", "Do not change clothing colors"],
    },
  });

  assert.match(prompt, /Edit only targetImage\./);
  assert.match(prompt, /Preserve the targetImage framing and aspect ratio unless the proposal explicitly reframes or outpaints it\./);
  assert.match(prompt, /Use referenceImages\[\] as guidance only/);
  assert.match(prompt, /Return exactly one final rendered image for targetImage\./);
  assert.match(prompt, /"requestSnapshot"/);
  assert.match(prompt, /"label": "Tighten background"/);
  assert.match(prompt, /"negativeConstraints": \[/);
});

test("design review apply request keeps one target image and de-duplicates references", () => {
  const applyRequest = buildDesignReviewApplyRequest({
    request: {
      requestId: "review-apply-2",
      sessionId: "session-2",
      primaryImageId: "img-target",
    },
    proposal: {
      proposalId: "proposal-2",
      imageId: "img-target",
      label: "Clean edges",
      actionType: "subject_isolation",
      applyBrief: "Clean the subject edges and remove the grey fringe.",
    },
    targetImage: {
      imageId: "img-target",
      path: "/tmp/target.png",
    },
    referenceImages: [
      { imageId: "img-ref-1", path: "/tmp/ref-a.png" },
      { imageId: "img-ref-2", path: "/tmp/ref-a.png" },
      { imageId: "img-target", path: "/tmp/target.png" },
      "/tmp/ref-b.png",
    ],
    outputPath: "/tmp/output.png",
    model: "Gemini Nano Banana 2",
  });

  assert.equal(applyRequest.schemaVersion, "design-review-apply-request-v1");
  assert.equal(applyRequest.kind, "apply");
  assert.equal(applyRequest.provider, "google");
  assert.equal(applyRequest.requestedModel, "Gemini Nano Banana 2");
  assert.equal(applyRequest.normalizedModel, DESIGN_REVIEW_FINAL_APPLY_MODEL);
  assert.equal(applyRequest.model, "Gemini Nano Banana 2");
  assert.deepEqual(applyRequest.targetImage, {
    imageId: "img-target",
    path: "/tmp/target.png",
  });
  assert.deepEqual(applyRequest.referenceImages, [
    { imageId: "img-ref-1", path: "/tmp/ref-a.png" },
    { imageId: null, path: "/tmp/ref-b.png" },
  ]);
  assert.equal(applyRequest.outputPath, "/tmp/output.png");
  assert.match(applyRequest.prompt, /Edit only targetImage\./);
});

test("design review apply request resolves target and fallback references from the existing request snapshot", () => {
  const applyRequest = buildDesignReviewApplyRequest({
    request: {
      requestId: "review-apply-3",
      sessionId: "session-3",
      primaryImageId: "img-primary",
      visibleCanvasContext: {
        images: [
          { id: "img-primary", path: "/tmp/primary.png" },
          { id: "img-target", path: "/tmp/target-from-request.png" },
          { id: "img-ref", path: "/tmp/ref-from-request.png" },
        ],
      },
    },
    proposal: {
      proposalId: "proposal-3",
      imageId: "img-target",
      label: "Warm background",
      actionType: "background_replace",
      applyBrief: "Replace only the background with a warmer studio wall.",
    },
    outputPath: "/tmp/output-from-request.png",
  });

  assert.deepEqual(applyRequest.targetImage, {
    imageId: "img-target",
    path: "/tmp/target-from-request.png",
  });
  assert.deepEqual(applyRequest.referenceImages, [
    { imageId: "img-primary", path: "/tmp/primary.png" },
    { imageId: "img-ref", path: "/tmp/ref-from-request.png" },
  ]);
});

test("design review apply request falls back to request.primaryImageId when the proposal does not name a target image", () => {
  const applyRequest = buildDesignReviewApplyRequest({
    request: {
      requestId: "review-apply-4",
      sessionId: "session-4",
      primaryImageId: "img-primary",
      visibleCanvasContext: {
        images: [
          { id: "img-primary", path: "/tmp/primary-fallback.png" },
          { id: "img-ref", path: "/tmp/ref-fallback.png" },
        ],
      },
    },
    proposal: {
      proposalId: "proposal-4",
      label: "Clean subject edges",
      actionType: "subject_isolation",
      applyBrief: "Clean the subject edges without changing the pose.",
    },
    outputPath: "/tmp/output-fallback.png",
  });

  assert.deepEqual(applyRequest.targetImage, {
    imageId: "img-primary",
    path: "/tmp/primary-fallback.png",
  });
  assert.deepEqual(applyRequest.referenceImages, [{ imageId: "img-ref", path: "/tmp/ref-fallback.png" }]);
});
