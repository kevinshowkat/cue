import { test } from "node:test";
import assert from "node:assert/strict";

import { createDesignReviewMemoryStore, readDesignReviewAccountMemory } from "../src/design_review_memory.js";
import { createDesignReviewPipeline } from "../src/design_review_pipeline.js";
import { createUploadAnalysisCacheStore } from "../src/design_review_upload_analysis.js";

test("design review pipeline plans, fans out previews, and records acceptance memory", async () => {
  const memoryStore = createDesignReviewMemoryStore();
  const uploadAnalysisCache = createUploadAnalysisCacheStore();
  const pipeline = createDesignReviewPipeline({
    providerRouter: {
      async runPlanner() {
        return {
          text: JSON.stringify({
            proposals: [
              {
                label: "Cut out subject",
                imageId: "img-1",
                actionType: "cut_out_subject",
                why: "The subject is clearly separable from the background.",
                previewBrief: "Preview the isolated subject on a neutral card.",
                applyBrief: "Isolate the subject and preserve edge detail.",
                negativeConstraints: ["Do not crop the face"],
              },
              {
                label: "Swap background",
                imageId: "img-1",
                actionType: "background_replace",
                why: "A cleaner backdrop will make the product read faster.",
                previewBrief: "Preview a soft studio sweep background.",
                applyBrief: "Replace the background only.",
                negativeConstraints: ["Do not alter the product silhouette"],
              },
            ],
          }),
        };
      },
      async runPreview({ proposal, outputPath }) {
        return {
          outputPath: outputPath || `/tmp/${proposal.proposalId}.png`,
        };
      },
      async runUploadAnalysis() {
        return {
          summary: "Unused in this test.",
        };
      },
    },
    memoryStore,
    uploadAnalysisCache,
    hashImage: async (image) => `hash:${image?.path || ""}`,
  });

  const result = await pipeline.startReview({
    request: {
      requestId: "review-1",
      primaryImageId: "img-1",
      visibleCanvasRef: "/tmp/review-visible.png",
      visibleCanvasContext: {
        runDir: "/tmp/review-run",
      },
      selectedImageIds: ["img-1"],
      slotCount: 2,
      accountMemorySummary: {
        acceptedActionTypes: [],
        preferredStylePatterns: [],
        preferredUseCasePatterns: [],
      },
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.proposals.length, 2);
  assert.equal(result.slots.length, 2);
  assert.equal(result.slots.every((slot) => slot.status === "ready"), true);
  assert.ok(result.slots[0].outputPreviewRef.endsWith(".png"));

  const memory = pipeline.acceptProposal(result.proposals[0].proposalId, {
    stylePatterns: ["neutral card"],
    useCasePatterns: ["catalog"],
  });
  const persisted = readDesignReviewAccountMemory(memoryStore);

  assert.equal(memory.acceptedActionTypes.cut_out_subject, 1);
  assert.equal(persisted.acceptedActionTypes.cut_out_subject, 1);
});

test("design review pipeline ignores stale review completions after a newer review starts", async () => {
  let resolveFirstPlanner;
  const firstPlanner = new Promise((resolve) => {
    resolveFirstPlanner = resolve;
  });
  const plannerCalls = [];
  const pipeline = createDesignReviewPipeline({
    providerRouter: {
      async runPlanner({ request }) {
        plannerCalls.push(request.requestId);
        if (request.requestId === "review-1") {
          return firstPlanner;
        }
        return {
          text: JSON.stringify({
            proposals: [
              {
                label: "Second review wins",
                imageId: "img-2",
                actionType: "targeted_remove",
                why: "This is the active review state.",
                previewBrief: "Preview the active request only.",
                applyBrief: "Apply the active request only.",
              },
            ],
          }),
        };
      },
      async runPreview({ proposal, outputPath }) {
        return {
          outputPath: outputPath || `/tmp/${proposal.proposalId}.png`,
        };
      },
    },
  });

  const firstRun = pipeline.startReview({
    request: {
      requestId: "review-1",
      primaryImageId: "img-1",
      visibleCanvasRef: "/tmp/review-1.png",
      visibleCanvasContext: { runDir: "/tmp/review-1" },
    },
  });
  const secondRun = pipeline.startReview({
    request: {
      requestId: "review-2",
      primaryImageId: "img-2",
      visibleCanvasRef: "/tmp/review-2.png",
      visibleCanvasContext: { runDir: "/tmp/review-2" },
      slotCount: 2,
    },
  });

  resolveFirstPlanner({
    text: JSON.stringify({
      proposals: [
        {
          label: "Stale review",
          imageId: "img-1",
          actionType: "cut_out_subject",
          why: "This should not overwrite the newer state.",
          previewBrief: "Preview the stale request.",
          applyBrief: "Apply the stale request.",
        },
      ],
    }),
  });

  await firstRun;
  const secondResult = await secondRun;

  assert.deepEqual(plannerCalls, ["review-1", "review-2"]);
  assert.equal(secondResult.request.requestId, "review-2");
  assert.equal(secondResult.proposals[0].label, "Second review wins");
  assert.equal(pipeline.getState().request.requestId, "review-2");
});

test("design review pipeline preserves preview debug payloads on failed proposal slots", async () => {
  const pipeline = createDesignReviewPipeline({
    providerRouter: {
      async runPlanner() {
        return {
          text: JSON.stringify({
            proposals: [
              {
                label: "Swap background",
                imageId: "img-1",
                actionType: "background_replace",
                why: "A cleaner backdrop will make the product read faster.",
                previewBrief: "Preview a soft studio sweep background.",
                applyBrief: "Replace the background only.",
              },
            ],
          }),
        };
      },
      async runPreview() {
        const error = new Error("The review preview could not be prepared.");
        error.debugInfo = {
          tauriCommand: "run_design_review_provider_request",
          route: {
            kind: "preview",
            provider: "google",
          },
          providerRequest: {
            model: "gemini-3.1-flash-image-preview",
          },
        };
        throw error;
      },
    },
  });

  const result = await pipeline.startReview({
    request: {
      requestId: "review-preview-debug",
      primaryImageId: "img-1",
      visibleCanvasRef: "/tmp/review-visible.png",
      visibleCanvasContext: {
        runDir: "/tmp/review-run",
      },
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.slots[0].status, "failed");
  assert.equal(result.slots[0].debugInfo?.route?.kind, "preview");
  assert.equal(result.slots[0].debugInfo?.providerRequest?.model, "gemini-3.1-flash-image-preview");
});

test("design review pipeline applies an accepted proposal and emits structured apply events", async () => {
  const applyEvents = [];
  const applyCalls = [];
  const pipeline = createDesignReviewPipeline({
    providerRouter: {
      async runPlanner() {
        return {
          text: JSON.stringify({
            proposals: [
              {
                label: "Make the side image the target",
                imageId: "img-2",
                actionType: "background_replace",
                why: "The side image is the editable target for this review.",
                previewBrief: "Preview a cleaner product backdrop.",
                applyBrief: "Replace the backdrop only on the target image.",
                negativeConstraints: ["Do not alter the product silhouette"],
              },
            ],
          }),
        };
      },
      async runPreview({ proposal, outputPath }) {
        return {
          outputPath: outputPath || `/tmp/${proposal.proposalId}.png`,
        };
      },
    },
    runApply: async (payload) => {
      applyCalls.push(payload);
      return {
        outputPath: payload.outputPath || "/tmp/review-apply-output.png",
        debugInfo: {
          route: {
            kind: "apply",
          },
        },
      };
    },
    onApplyEvent: (event) => {
      applyEvents.push(event);
    },
  });

  const review = await pipeline.startReview({
    request: {
      requestId: "review-apply-1",
      sessionId: "tab:tab-a",
      primaryImageId: "img-1",
      visibleCanvasRef: "/tmp/review-visible.png",
      imageIdsInView: ["img-1", "img-2"],
      selectedImageIds: ["img-1", "img-2"],
      visibleCanvasContext: {
        runDir: "/tmp/review-run",
        activeTabId: "tab-a",
        images: [
          {
            id: "img-1",
            path: "/tmp/primary.png",
          },
          {
            id: "img-2",
            path: "/tmp/secondary.png",
          },
        ],
      },
    },
  });

  const applyResult = await pipeline.applyProposal(review.proposals[0].proposalId, {
    sessionKey: "tab:tab-a",
  });
  const finalState = pipeline.getState();

  assert.equal(applyResult.ok, true);
  assert.equal(applyCalls.length, 1);
  assert.equal(applyCalls[0].proposal.applyBrief, "Replace the backdrop only on the target image.");
  assert.equal(applyCalls[0].targetImageId, "img-2");
  assert.equal(applyCalls[0].targetImage.path, "/tmp/secondary.png");
  assert.deepEqual(applyCalls[0].referenceImageIds, ["img-1"]);
  assert.deepEqual(
    applyCalls[0].referenceImages.map((image) => image.id),
    ["img-1"]
  );
  assert.equal(finalState.status, "apply_succeeded");
  assert.equal(finalState.slots[0].status, "apply_succeeded");
  assert.equal(finalState.activeApply, null);
  assert.deepEqual(
    applyEvents.map((event) => event.phase),
    ["started", "succeeded"]
  );
  assert.equal(applyEvents[0].requestId, "review-apply-1");
  assert.equal(applyEvents[0].sessionKey, "tab:tab-a");
  assert.equal(applyEvents[0].targetImageId, "img-2");
  assert.deepEqual(applyEvents[0].referenceImageIds, ["img-1"]);
  assert.ok(String(applyEvents[1].outputPath || "").includes("review-apply"));
});

test("design review pipeline blocks duplicate applies while one proposal is already running", async () => {
  let resolveApply;
  const applyPromise = new Promise((resolve) => {
    resolveApply = resolve;
  });
  const pipeline = createDesignReviewPipeline({
    providerRouter: {
      async runPlanner() {
        return {
          text: JSON.stringify({
            proposals: [
              {
                label: "Replace the background",
                imageId: "img-1",
                actionType: "background_replace",
                why: "The single image is the active target.",
                previewBrief: "Preview a studio backdrop.",
                applyBrief: "Replace the backdrop only.",
              },
            ],
          }),
        };
      },
      async runPreview({ proposal, outputPath }) {
        return {
          outputPath: outputPath || `/tmp/${proposal.proposalId}.png`,
        };
      },
    },
    runApply: async ({ outputPath }) => {
      await applyPromise;
      return {
        outputPath: outputPath || "/tmp/review-apply-output.png",
      };
    },
  });

  const review = await pipeline.startReview({
    request: {
      requestId: "review-apply-duplicate",
      primaryImageId: "img-1",
      visibleCanvasRef: "/tmp/review-visible.png",
      visibleCanvasContext: {
        runDir: "/tmp/review-run",
        images: [
          {
            id: "img-1",
            path: "/tmp/primary.png",
          },
        ],
      },
    },
  });

  const firstApply = pipeline.applyProposal(review.proposals[0].proposalId);
  const duplicate = await pipeline.applyProposal(review.proposals[0].proposalId);

  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, "apply_in_progress");
  assert.equal(pipeline.getState().status, "apply_running");
  assert.equal(pipeline.getState().activeApply?.status, "running");

  resolveApply({
    outputPath: "/tmp/review-apply-output.png",
  });
  const firstResult = await firstApply;

  assert.equal(firstResult.ok, true);
  assert.equal(pipeline.getState().status, "apply_succeeded");
});

test("design review pipeline can apply from an explicit tab-local review snapshot after another tab becomes active", async () => {
  const applyCalls = [];
  const localStateUpdates = [];
  const pipeline = createDesignReviewPipeline({
    providerRouter: {
      async runPlanner({ request }) {
        return {
          text: JSON.stringify({
            proposals: [
              {
                label: `Apply for ${request.requestId}`,
                imageId: request.requestId === "review-tab-a" ? "img-a" : "img-b",
                actionType: "background_replace",
                why: "Use the tab-local target image only.",
                previewBrief: "Preview the accepted tab-local change.",
                applyBrief: "Apply the accepted change to the tab-local target only.",
              },
            ],
          }),
        };
      },
      async runPreview({ proposal, outputPath }) {
        return {
          outputPath: outputPath || `/tmp/${proposal.proposalId}.png`,
        };
      },
    },
    runApply: async (payload) => {
      applyCalls.push(payload);
      return {
        outputPath: payload.outputPath || `/tmp/${payload.request.requestId}-apply.png`,
      };
    },
  });

  const tabAReview = await pipeline.startReview({
    request: {
      requestId: "review-tab-a",
      sessionId: "tab:tab-a",
      primaryImageId: "img-a",
      visibleCanvasRef: "/tmp/review-tab-a.png",
      visibleCanvasContext: {
        runDir: "/tmp/review-tab-a",
        activeTabId: "tab-a",
        images: [
          {
            id: "img-a",
            path: "/tmp/tab-a-target.png",
          },
          {
            id: "img-a-ref",
            path: "/tmp/tab-a-reference.png",
          },
        ],
      },
      selectedImageIds: ["img-a-ref"],
    },
  });
  const tabAState = pipeline.getState();

  await pipeline.startReview({
    request: {
      requestId: "review-tab-b",
      sessionId: "tab:tab-b",
      primaryImageId: "img-b",
      visibleCanvasRef: "/tmp/review-tab-b.png",
      visibleCanvasContext: {
        runDir: "/tmp/review-tab-b",
        activeTabId: "tab-b",
        images: [
          {
            id: "img-b",
            path: "/tmp/tab-b-target.png",
          },
        ],
      },
    },
  });

  const memoryStore = createDesignReviewMemoryStore();
  const memoryPipeline = createDesignReviewPipeline({
    memoryStore,
  });
  memoryPipeline.acceptProposal(tabAReview.proposals[0].proposalId, {
    reviewState: tabAState,
    useCasePatterns: ["background_replace"],
  });
  assert.equal(
    readDesignReviewAccountMemory(memoryStore).acceptedActionTypes.background_replace,
    1
  );

  const applyResult = await pipeline.applyProposal(tabAReview.proposals[0].proposalId, {
    sessionKey: "tab:tab-a",
    reviewState: tabAState,
    onStateChange: (nextState) => {
      localStateUpdates.push(nextState);
    },
  });

  assert.equal(applyResult.ok, true);
  assert.equal(applyCalls.length, 1);
  assert.equal(applyCalls[0].request.requestId, "review-tab-a");
  assert.equal(applyCalls[0].targetImageId, "img-a");
  assert.equal(applyCalls[0].targetImage.path, "/tmp/tab-a-target.png");
  assert.deepEqual(applyCalls[0].referenceImageIds, ["img-a-ref"]);
  assert.equal(localStateUpdates.at(0)?.status, "apply_running");
  assert.equal(localStateUpdates.at(-1)?.status, "apply_succeeded");
  assert.equal(localStateUpdates.at(-1)?.slots[0]?.status, "apply_succeeded");
  assert.equal(pipeline.getState().request.requestId, "review-tab-b");
});

test("design review pipeline preserves apply debug payloads on failed proposal slots", async () => {
  const pipeline = createDesignReviewPipeline({
    providerRouter: {
      async runPlanner() {
        return {
          text: JSON.stringify({
            proposals: [
              {
                label: "Retouch product",
                imageId: "img-1",
                actionType: "targeted_remove",
                why: "A focused cleanup will tighten the shot.",
                previewBrief: "Preview the cleanup only.",
                applyBrief: "Remove the dust spot from the product.",
              },
            ],
          }),
        };
      },
      async runPreview({ proposal, outputPath }) {
        return {
          outputPath: outputPath || `/tmp/${proposal.proposalId}.png`,
        };
      },
    },
    runApply: async () => {
      const error = new Error("The final edit could not be rendered.");
      error.debugInfo = {
        route: {
          kind: "apply",
          provider: "google",
        },
        providerRequest: {
          model: "gemini-nano-banana-2",
        },
      };
      throw error;
    },
  });

  const review = await pipeline.startReview({
    request: {
      requestId: "review-apply-debug",
      primaryImageId: "img-1",
      visibleCanvasRef: "/tmp/review-visible.png",
      visibleCanvasContext: {
        runDir: "/tmp/review-run",
        images: [
          {
            id: "img-1",
            path: "/tmp/primary.png",
          },
        ],
      },
    },
  });

  const applyResult = await pipeline.applyProposal(review.proposals[0].proposalId);
  const finalState = pipeline.getState();

  assert.equal(applyResult.ok, false);
  assert.equal(applyResult.reason, "apply_failed");
  assert.equal(finalState.status, "apply_failed");
  assert.equal(finalState.slots[0].status, "apply_failed");
  assert.equal(finalState.slots[0].apply?.debugInfo?.route?.kind, "apply");
  assert.equal(
    finalState.slots[0].apply?.debugInfo?.providerRequest?.model,
    "gemini-nano-banana-2"
  );
});
