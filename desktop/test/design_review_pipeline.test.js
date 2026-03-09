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
