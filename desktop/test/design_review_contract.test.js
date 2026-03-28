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

test("design review request builder derives Highlight and Make Space focus contracts from tool-scoped marks and regions", () => {
  const highlightRequest = buildDesignReviewRequest({
    shellContext: {
      runDir: "/tmp/highlight-run",
      activeImageId: "img-1",
      images: [{ id: "img-1", path: "/tmp/highlight.png" }],
    },
    visualPrompt: {
      canvas: { mode: "single", active_image_id: "img-1" },
      marks: [
        {
          id: "mark-highlight",
          type: "freehand_protect",
          imageId: "img-1",
          bounds: { x: 10, y: 20, width: 120, height: 90 },
        },
      ],
    },
    regionCandidates: [
      {
        id: "region-highlight",
        imageId: "img-1",
        bounds: { x: 16, y: 28, width: 64, height: 72 },
      },
    ],
    activeRegionCandidateId: "region-highlight",
    reviewTool: "Highlight",
  });

  assert.equal(highlightRequest.reviewTool, "highlight");
  assert.deepEqual(
    highlightRequest.focusInputs.map((entry) => entry.kind),
    ["highlight"]
  );
  assert.equal(highlightRequest.protectedRegions.length, 0);
  assert.equal(highlightRequest.focusInputIds.length, 1);
  assert.equal(highlightRequest.protectedRegionIds.length, 0);
  assert.equal(highlightRequest.reservedSpaceIntent, null);

  const makeSpaceRequest = buildDesignReviewRequest({
    shellContext: {
      runDir: "/tmp/make-space-run",
      activeImageId: "img-2",
      images: [{ id: "img-2", path: "/tmp/make-space.png" }],
    },
    visualPrompt: {
      canvas: { mode: "single", active_image_id: "img-2" },
      marks: [
        {
          id: "mark-space",
          type: "freehand_marker",
          imageId: "img-2",
          bounds: { x: 48, y: 30, width: 150, height: 100 },
        },
      ],
    },
    regionCandidates: [
      {
        id: "region-space",
        imageId: "img-2",
        bounds: { x: 44, y: 26, width: 180, height: 120 },
        isActive: true,
      },
    ],
    reviewTool: "Make Space",
  });

  assert.equal(makeSpaceRequest.reviewTool, "make_space");
  assert.deepEqual(
    makeSpaceRequest.focusInputs.map((entry) => entry.kind),
    ["make_space", "make_space"]
  );
  assert.equal(makeSpaceRequest.protectedRegions.length, 0);
  assert.equal(makeSpaceRequest.reservedSpaceIntent?.mode, "reserve_or_create_room");
  assert.equal(makeSpaceRequest.reservedSpaceIntent?.areas.length, 2);
  assert.equal(makeSpaceRequest.reservedSpaceAreaIds.length, 2);
});

test("design review request builder scopes Highlight to the circled images only", () => {
  const visibleImages = [
    {
      id: "img-metal",
      path: "/tmp/metal.png",
      rectCss: { left: 20, top: 20, width: 120, height: 120 },
    },
    {
      id: "img-squid",
      path: "/tmp/squidward.png",
      rectCss: { left: 18, top: 220, width: 120, height: 120 },
    },
    {
      id: "img-sponge",
      path: "/tmp/spongebob.png",
      rectCss: { left: 168, top: 220, width: 120, height: 120 },
    },
  ];
  const request = buildDesignReviewRequest({
    shellContext: {
      runDir: "/tmp/highlight-scope-run",
      activeImageId: "img-metal",
      images: visibleImages,
    },
    visualPrompt: {
      canvas: { mode: "multi", active_image_id: "img-metal" },
      images: visibleImages,
      marks: [
        {
          id: "mark-highlight-scope",
          type: "freehand_protect",
          coordinateSpace: "canvas_overlay",
          points: [
            { x: 14, y: 206 },
            { x: 10, y: 352 },
            { x: 308, y: 352 },
            { x: 302, y: 206 },
            { x: 14, y: 206 },
          ],
          bounds: { x: 10, y: 206, width: 298, height: 146 },
        },
      ],
    },
    reviewTool: "Highlight",
  });

  assert.equal(request.reviewTool, "highlight");
  assert.equal(request.primaryImageId, "img-squid");
  assert.deepEqual(request.focusImageIds, ["img-squid", "img-sponge"]);
  assert.deepEqual(
    request.focusInputs.map((entry) => entry.imageId),
    ["img-squid", "img-sponge"]
  );
});

test("design review planner prompt preserves stamp directives as structured focus context", () => {
  const request = buildDesignReviewRequest({
    shellContext: {
      runDir: "/tmp/stamp-run",
      activeImageId: "img-1",
      images: [{ id: "img-1", path: "/tmp/stamp.png" }],
    },
    visualPrompt: {
      canvas: { mode: "single", active_image_id: "img-1" },
      marks: [],
    },
    focusInputs: [
      {
        focusInputId: "stamp-focus:1",
        kind: "highlight",
        imageId: "img-1",
        bounds: { x: 84, y: 40, width: 132, height: 76 },
        instruction: "Place text here.",
        sourceTool: "stamp",
      },
    ],
    reviewTool: "stamp",
  });

  assert.equal(request.focusInputs.length, 1);
  assert.equal(request.focusInputs[0].instruction, "Place text here.");
  assert.equal(request.focusInputs[0].sourceTool, "stamp");

  const prompt = buildDesignReviewPlannerPrompt(request);
  assert.match(prompt, /Stamp focus inputs are short directive labels/);
  assert.match(prompt, /Place text here\./);
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

test("design review planner response clamps proposal targets to the highlighted image scope", () => {
  const response = parseDesignReviewPlannerResponse(
    JSON.stringify({
      proposals: [
        {
          label: "Metal SpongeBob Squidward",
          imageId: "img-metal",
          actionType: "background_replace",
          why: "Incorrectly tries to use an unrelated image.",
          previewBrief: "Preview a character-only composite.",
          applyBrief: "Replace Squidward with SpongeBob only.",
        },
      ],
    }),
    {
      requestId: "review-highlight-scope",
      primaryImageId: "img-squid",
      focusImageIds: ["img-squid", "img-sponge"],
      selectedImageIds: ["img-squid"],
      slotCount: 3,
    }
  );

  assert.equal(response.ok, true);
  assert.equal(response.proposals[0].imageId, "img-squid");
});

test("design review skeleton slots reserve 2-3 proposal slots immediately", () => {
  const slots = createDesignReviewSkeletonSlots({
    request: {
      requestId: "review-2",
      primaryImageId: "img-2",
    },
    slotCount: 3,
  });

  assert.equal(slots.length, 3);
  assert.equal(slots.every((slot) => slot.status === "skeleton"), true);
  assert.equal(slots.every((slot) => slot.proposal === null), true);
});

test("design review planner prompt stays compact, restores canvas-scope constraints, and defines actions as edit intents", () => {
  const prompt = buildDesignReviewPlannerPrompt({
    requestId: "review-compact",
    visibleCanvasRef: "/tmp/review-visible.png",
    markIds: ["mark-1"],
    slotCount: 3,
    focusImageIds: ["img-ref-2"],
    imageIdentityHints: [
      {
        imageId: "img-ref-2",
        role: "reference",
        subject: "Michael Jordan",
        summary: "Michael Jordan in a red jersey.",
        subjectTags: ["Michael Jordan", "basketball"],
      },
    ],
    focusInputs: [
      {
        focusInputId: "focus-highlight",
        kind: "highlight",
        imageId: "img-ref-2",
        bounds: { x: 12, y: 18, width: 84, height: 64 },
      },
      {
        focusInputId: "focus-space",
        kind: "make_space",
        imageId: "img-ref-2",
        bounds: { x: 110, y: 22, width: 140, height: 80 },
      },
    ],
    reservedSpaceIntent: {
      reservedSpaceIntentId: "space-intent-1",
      areas: [
        {
          reservedSpaceId: "space-1",
          imageId: "img-ref-2",
          bounds: { x: 110, y: 22, width: 140, height: 80 },
        },
      ],
    },
  });

  assert.match(prompt, /View the canvas image and visible annotations only\./);
  assert.match(prompt, /An action is a concrete visual edit the editor could apply to the image\./);
  assert.match(prompt, /Write actions as short edit intents, not advice, critique, or conversation\./);
  assert.match(prompt, /Make previewBrief and applyBrief specific, positive, and verb-first\./);
  assert.match(prompt, /Use concise effect statements, not rationale essays\./);
  assert.match(prompt, /When Highlight circles specific images, keep every proposal scoped to those highlighted images only\./);
  assert.match(prompt, /Ignore unrelated visible images outside reviewScope\.imageIds unless a highlighted annotation explicitly overlaps them\./);
  assert.match(prompt, /Treat off-image and between-image annotations as valid relationship cues for linkage, movement, spacing, and placement between scoped images\./);
  assert.match(prompt, /Treat annotations and the chosen region candidate as focus hints, not crop-only constraints\./);
  assert.match(prompt, /If annotations sketch missing scene elements or motion cues such as a hoop, arrow, dunk path, or destination box, treat them as instruction overlays for what the edited image should render, not as the finished result\./);
  assert.match(prompt, /Highlight focus inputs mark the areas the design review should prioritize\./);
  assert.match(prompt, /Make Space focus inputs mean reserve or create room there\./);
  assert.match(prompt, /Use image identity hints when they exist so subjects are named concretely/);
  assert.match(prompt, /Prefer edits that can plausibly route through the normal execution layer later\./);
  assert.match(prompt, /Return 3 ranked proposals as JSON only\./);
  assert.match(prompt, /"imageIdentityHints": \[/);
  assert.match(prompt, /"reviewScope": \{/);
  assert.match(prompt, /"imageIds": \[\s*"img-ref-2"\s*\]/);
  assert.match(prompt, /"reviewFocus": \{/);
  assert.match(prompt, /"reservedSpaceIntent": \{/);
  assert.match(prompt, /"subject": "Michael Jordan"/);
  assert.match(prompt, /"markIds": \[\s*"optional annotation ids"\s*\]/);
  assert.match(prompt, /"actionType": "short edit intent like remove_object, brighten_area, simplify_background"/);
  assert.match(prompt, /"previewBrief": "short verb-first effect statement"/);
  assert.match(prompt, /"applyBrief": "short verb-first sentence describing the exact edit"/);
  assert.doesNotMatch(prompt, /"requestId": "review-compact"/);
  assert.doesNotMatch(prompt, /"visibleCanvasRef": "\/tmp\/review-visible\.png"/);
  assert.doesNotMatch(prompt, /Use the whole visible canvas as context, not just the local annotation area\./);
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
      focusInputs: [
        {
          focusInputId: "focus-highlight-apply-1",
          kind: "highlight",
          imageId: "img-target",
          bounds: { x: 18, y: 32, width: 80, height: 90 },
        },
      ],
      negativeConstraints: ["Do not alter the subject pose", "Do not change clothing colors"],
      reservedSpaceIntent: {
        reservedSpaceIntentId: "space-intent-apply-1",
        areas: [
          {
            reservedSpaceId: "space-apply-1",
            imageId: "img-target",
            bounds: { x: 200, y: 24, width: 120, height: 96 },
          },
        ],
      },
    },
  });

  assert.match(prompt, /Edit only targetImage\./);
  assert.match(prompt, /Preserve the targetImage framing and aspect ratio unless the proposal explicitly reframes or outpaints it\./);
  assert.match(prompt, /Use referenceImages\[\] as guidance only/);
  assert.match(prompt, /Return exactly one final rendered image for targetImage\./);
  assert.match(prompt, /"requestSnapshot"/);
  assert.match(prompt, /"label": "Tighten background"/);
  assert.match(prompt, /"negativeConstraints": \[/);
  assert.match(prompt, /Keep the edit centered on highlighted focus inputs when they are present\./);
  assert.match(
    prompt,
    /When reservedSpaceIntent is present, preserve or create open room in those areas without altering protectedRegions\./
  );
  assert.match(prompt, /"reservedSpaceIntent": \{/);
  assert.match(prompt, /"focusInputs": \[/);
  assert.match(prompt, /"preserveProtectedRegions": false/);
  assert.match(prompt, /"preserveReservedSpace": true/);
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

test("design review apply request preserves Protect and Make Space focus semantics", () => {
  const applyRequest = buildDesignReviewApplyRequest({
    request: {
      requestId: "review-apply-focus",
      sessionId: "session-focus",
      primaryImageId: "img-target",
      reviewTool: "make_space",
      focusInputs: [
        {
          focusInputId: "focus-protect-1",
          kind: "protect",
          imageId: "img-target",
          bounds: { x: 18, y: 16, width: 72, height: 88 },
        },
        {
          focusInputId: "focus-space-1",
          kind: "make_space",
          imageId: "img-target",
          bounds: { x: 180, y: 20, width: 132, height: 90 },
        },
      ],
      protectedRegions: [
        {
          protectedRegionId: "protected-focus-1",
          imageId: "img-target",
          bounds: { x: 18, y: 16, width: 72, height: 88 },
        },
      ],
      reservedSpaceIntent: {
        reservedSpaceIntentId: "space-intent-focus-1",
        areas: [
          {
            reservedSpaceId: "space-focus-1",
            imageId: "img-target",
            bounds: { x: 180, y: 20, width: 132, height: 90 },
          },
        ],
      },
    },
    proposal: {
      proposalId: "proposal-focus",
      imageId: "img-target",
      label: "Open room on the right",
      actionType: "crop_or_outpaint",
      applyBrief: "Expand the scene to the right and keep the subject untouched.",
    },
    targetImage: {
      imageId: "img-target",
      path: "/tmp/target-focus.png",
    },
  });

  assert.equal(applyRequest.reviewTool, "make_space");
  assert.deepEqual(applyRequest.focusInputIds, ["focus-protect-1", "focus-space-1"]);
  assert.deepEqual(applyRequest.protectedRegionIds, ["protected-focus-1"]);
  assert.deepEqual(applyRequest.reservedSpaceAreaIds, ["space-focus-1"]);
  assert.equal(applyRequest.preserveProtectedRegions, true);
  assert.equal(applyRequest.preserveReservedSpace, true);
  assert.equal(applyRequest.protectedRegions.length, 1);
  assert.equal(applyRequest.reservedSpaceIntent?.areas.length, 1);
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
