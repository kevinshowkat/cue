import { test } from "node:test";
import assert from "node:assert/strict";

import { DESIGN_REVIEW_FINAL_APPLY_MODEL, DESIGN_REVIEW_PLANNER_MODEL } from "../src/design_review_contract.js";
import {
  createDesignReviewProviderRouter,
  resolveDesignReviewProviderSelection,
} from "../src/design_review_provider_router.js";

test("design review provider selection prefers OpenAI for planning and preserves preview routing", () => {
  const selection = resolveDesignReviewProviderSelection({
    keyStatus: {
      openai: true,
      openrouter: true,
      gemini: true,
    },
  });

  assert.equal(selection.plannerProvider, "openai");
  assert.equal(selection.previewProvider, "google");
  assert.equal(selection.applyProvider, "google");
});

test("design review provider selection falls back to OpenRouter for planning when OpenAI is unavailable", () => {
  const selection = resolveDesignReviewProviderSelection({
    keyStatus: {
      openai: false,
      openrouter: true,
      gemini: false,
    },
  });

  assert.equal(selection.plannerProvider, "openrouter");
  assert.equal(selection.applyProvider, "openrouter");
});

test("design review provider router sends planner requests with the shared gpt-5.4 planner model", async () => {
  const requests = [];
  const router = createDesignReviewProviderRouter({
    keyStatus: {
      openai: true,
      openrouter: true,
    },
    requestProvider: async (request) => {
      requests.push(request);
      return { ok: true };
    },
  });

  await router.runPlanner({
    request: { requestId: "review-1" },
    prompt: "Return proposals",
    images: [{ path: "/tmp/ref.png" }],
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].kind, "planner");
  assert.equal(requests[0].provider, "openai");
  assert.equal(requests[0].model, DESIGN_REVIEW_PLANNER_MODEL);
});

test("design review provider router fails clearly when no planner credentials are configured", async () => {
  const router = createDesignReviewProviderRouter({
    keyStatus: {
      openai: false,
      openrouter: false,
      gemini: true,
    },
    requestProvider: async () => ({ ok: true }),
  });

  await assert.rejects(
    () =>
      router.runPlanner({
        request: { requestId: "review-2" },
        prompt: "Return proposals",
      }),
    /OPENAI_API_KEY or OPENROUTER_API_KEY/
  );
});

test("design review provider router resolves live key status before planner requests", async () => {
  const requests = [];
  const router = createDesignReviewProviderRouter({
    keyStatus: {
      openai: false,
      openrouter: false,
      gemini: false,
    },
    getKeyStatus: async () => ({
      openai: true,
      openrouter: true,
      gemini: false,
    }),
    requestProvider: async (request) => {
      requests.push(request);
      return { ok: true };
    },
  });

  await router.runPlanner({
    request: { requestId: "review-live" },
    prompt: "Return proposals",
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].provider, "openai");
});

test("design review provider router attaches debug payloads to planner transport failures", async () => {
  const router = createDesignReviewProviderRouter({
    keyStatus: {
      openai: true,
      openrouter: false,
      gemini: false,
    },
    requestProvider: async () => {
      throw new Error("OpenAI planner transport timed out.");
    },
  });

  await assert.rejects(
    () =>
      router.runPlanner({
        request: { requestId: "review-debug" },
        prompt: "Return proposals",
        images: ["/tmp/review-visible.png"],
      }),
    (error) => {
      assert.equal(error?.debugInfo?.tauriCommand, "run_design_review_provider_request");
      assert.equal(error?.debugInfo?.route?.kind, "planner");
      assert.equal(error?.debugInfo?.route?.provider, "openai");
      assert.equal(error?.debugInfo?.route?.apiPlan?.primaryTransport, "responses_websocket");
      assert.equal(error?.debugInfo?.providerRequest?.model, DESIGN_REVIEW_PLANNER_MODEL);
      assert.deepEqual(error?.debugInfo?.providerRequest?.images, ["/tmp/review-visible.png"]);
      return true;
    }
  );
});

test("design review provider router falls back to OpenRouter for planner transport failures in auto mode", async () => {
  const requests = [];
  const router = createDesignReviewProviderRouter({
    keyStatus: {
      openai: true,
      openrouter: true,
      gemini: false,
    },
    requestProvider: async (request) => {
      requests.push(request);
      if (request.provider === "openai") {
        throw new Error("OpenAI planner transport timed out.");
      }
      return {
        ok: true,
        provider: "openrouter",
        model: request.model,
        requestedModel: request.model,
        normalizedModel: request.model,
        transport: "chat_completions",
        text: "{\"proposals\":[]}",
      };
    },
  });

  const result = await router.runPlanner({
    request: { requestId: "review-fallback-openrouter" },
    prompt: "Return proposals",
    images: ["/tmp/review-visible.png"],
  });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].provider, "openai");
  assert.equal(requests[1].provider, "openrouter");
  assert.equal(result.debugInfo?.route?.provider, "openrouter");
  assert.equal(result.debugInfo?.route?.fallbackFromProvider, "openai");
});

test("design review provider router honors explicit OpenAI planner preference without OpenRouter fallback", async () => {
  const requests = [];
  const router = createDesignReviewProviderRouter({
    keyStatus: {
      openai: true,
      openrouter: true,
      gemini: false,
    },
    preferredPlannerProvider: "openai",
    requestProvider: async (request) => {
      requests.push(request);
      throw new Error("OpenAI planner transport timed out.");
    },
  });

  await assert.rejects(
    () =>
      router.runPlanner({
        request: { requestId: "review-explicit-openai" },
        prompt: "Return proposals",
      }),
    /OpenAI planner transport timed out/
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].provider, "openai");
});

test("design review provider router resolves apply target and guidance references from the existing request snapshot", async () => {
  const requests = [];
  const router = createDesignReviewProviderRouter({
    keyStatus: {
      openai: true,
      openrouter: true,
      gemini: true,
    },
    requestProvider: async (request) => {
      requests.push(request);
      return {
        ok: true,
        provider: "google",
        requestedModel: request.requestedModel,
        normalizedModel: request.normalizedModel,
        model: request.normalizedModel,
        transport: "generate_content",
        outputPath: request.outputPath,
      };
    },
  });

  const result = await router.runApply({
    request: {
      requestId: "review-apply-router",
      sessionId: "session-router",
      primaryImageId: "img-primary",
      visibleCanvasContext: {
        images: [
          { id: "img-primary", path: "/tmp/primary-router.png" },
          { id: "img-target", path: "/tmp/target-router.png" },
          { id: "img-ref", path: "/tmp/ref-router.png" },
        ],
      },
    },
    proposal: {
      proposalId: "proposal-router",
      imageId: "img-target",
      label: "Warm backdrop",
      actionType: "background_replace",
      applyBrief: "Replace the background with a warmer studio backdrop.",
    },
    outputPath: "/tmp/review-apply-router.png",
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].kind, "apply");
  assert.equal(requests[0].provider, "google");
  assert.equal(requests[0].requestedModel, DESIGN_REVIEW_FINAL_APPLY_MODEL);
  assert.equal(requests[0].normalizedModel, DESIGN_REVIEW_FINAL_APPLY_MODEL);
  assert.equal(requests[0].model, DESIGN_REVIEW_FINAL_APPLY_MODEL);
  assert.deepEqual(requests[0].targetImage, {
    imageId: "img-target",
    path: "/tmp/target-router.png",
  });
  assert.deepEqual(requests[0].referenceImages, [
    { imageId: "img-primary", path: "/tmp/primary-router.png" },
    { imageId: "img-ref", path: "/tmp/ref-router.png" },
  ]);
  assert.equal(requests[0].outputPath, "/tmp/review-apply-router.png");
  assert.match(requests[0].prompt, /Edit only targetImage\./);
  assert.equal(result.debugInfo?.route?.requestedModel, DESIGN_REVIEW_FINAL_APPLY_MODEL);
  assert.equal(result.debugInfo?.route?.normalizedModel, DESIGN_REVIEW_FINAL_APPLY_MODEL);
  assert.equal(result.debugInfo?.targetImagePath, "/tmp/target-router.png");
  assert.deepEqual(result.debugInfo?.referenceImagePaths, [
    "/tmp/primary-router.png",
    "/tmp/ref-router.png",
  ]);
});

test("design review provider router falls back to OpenRouter for final apply when Gemini keys are unavailable", async () => {
  const requests = [];
  const router = createDesignReviewProviderRouter({
    keyStatus: {
      openai: true,
      openrouter: true,
      gemini: false,
    },
    requestProvider: async (request) => {
      requests.push(request);
      return {
        ok: true,
        provider: "openrouter",
        requestedModel: request.requestedModel,
        normalizedModel: request.normalizedModel,
        model: request.normalizedModel,
        transport: "responses",
        outputPath: request.outputPath,
      };
    },
  });

  const result = await router.runApply({
    request: {
      requestId: "review-apply-openrouter",
      primaryImageId: "img-target",
      visibleCanvasContext: {
        images: [{ id: "img-target", path: "/tmp/target-openrouter.png" }],
      },
    },
    proposal: {
      proposalId: "proposal-openrouter",
      imageId: "img-target",
      applyBrief: "Warm up subject tones.",
    },
    outputPath: "/tmp/review-apply-openrouter.png",
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].kind, "apply");
  assert.equal(requests[0].provider, "openrouter");
  assert.equal(result.debugInfo?.route?.provider, "openrouter");
  assert.equal(result.debugInfo?.route?.apiPlan?.primaryTransport, "responses");
});

test("design review provider router preserves an explicit requested apply model override", async () => {
  const requests = [];
  const router = createDesignReviewProviderRouter({
    keyStatus: {
      openai: true,
      openrouter: true,
      gemini: true,
    },
    requestProvider: async (request) => {
      requests.push(request);
      return {
        ok: true,
        provider: request.provider,
        requestedModel: request.requestedModel,
        normalizedModel: request.normalizedModel,
        model: request.normalizedModel,
        transport: "generate_content",
        outputPath: request.outputPath,
      };
    },
  });

  const result = await router.runApply({
    request: {
      requestId: "review-apply-model-override",
      primaryImageId: "img-target",
      visibleCanvasContext: {
        images: [{ id: "img-target", path: "/tmp/target-override.png" }],
      },
    },
    proposal: {
      proposalId: "proposal-model-override",
      imageId: "img-target",
      applyBrief: "Isolate the selected subject onto transparency.",
    },
    targetImage: {
      imageId: "img-target",
      path: "/tmp/target-override.png",
    },
    outputPath: "/tmp/review-apply-override.png",
    model: "Gemini Nano Banana 2",
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].requestedModel, "Gemini Nano Banana 2");
  assert.equal(requests[0].normalizedModel, DESIGN_REVIEW_FINAL_APPLY_MODEL);
  assert.equal(result.debugInfo?.route?.requestedModel, "Gemini Nano Banana 2");
  assert.equal(result.debugInfo?.route?.normalizedModel, DESIGN_REVIEW_FINAL_APPLY_MODEL);
});

test("design review provider router fails clearly when no final apply credentials are configured", async () => {
  const router = createDesignReviewProviderRouter({
    keyStatus: {
      openai: true,
      openrouter: false,
      gemini: false,
    },
    requestProvider: async () => ({ ok: true }),
  });

  await assert.rejects(
    () =>
      router.runApply({
        request: { requestId: "review-apply-no-gemini" },
        proposal: {
          proposalId: "proposal-no-gemini",
          applyBrief: "Tighten the background cleanup.",
        },
        targetImage: { path: "/tmp/no-gemini-target.png" },
        outputPath: "/tmp/no-gemini-output.png",
      }),
    /GEMINI_API_KEY or GOOGLE_API_KEY or OPENROUTER_API_KEY/
  );
});

test("design review provider router preserves shaped debug payloads for apply failures", async () => {
  const router = createDesignReviewProviderRouter({
    keyStatus: {
      openai: true,
      openrouter: true,
      gemini: true,
    },
    requestProvider: async () => {
      throw JSON.stringify({
        message: "Google final apply request failed.",
        debugInfo: {
          provider: "google",
          requestedModel: "Gemini Nano Banana 2",
          normalizedModel: DESIGN_REVIEW_FINAL_APPLY_MODEL,
          transport: "generate_content",
          prompt: "Edit only targetImage.",
          targetImagePath: "/tmp/apply-target.png",
          referenceImagePaths: ["/tmp/apply-ref.png"],
          outputPath: "/tmp/apply-output.png",
        },
      });
    },
  });

  await assert.rejects(
    () =>
      router.runApply({
        request: { requestId: "review-apply-debug" },
        proposal: {
          proposalId: "proposal-apply-debug",
          applyBrief: "Clean the background while keeping the subject intact.",
        },
        targetImage: { path: "/tmp/apply-target.png" },
        referenceImages: [{ path: "/tmp/apply-ref.png" }],
        outputPath: "/tmp/apply-output.png",
      }),
    (error) => {
      assert.equal(error?.debugInfo?.provider, "google");
      assert.equal(error?.debugInfo?.requestedModel, "Gemini Nano Banana 2");
      assert.equal(error?.debugInfo?.normalizedModel, DESIGN_REVIEW_FINAL_APPLY_MODEL);
      assert.equal(error?.debugInfo?.transport, "generate_content");
      assert.equal(error?.debugInfo?.targetImagePath, "/tmp/apply-target.png");
      assert.deepEqual(error?.debugInfo?.referenceImagePaths, ["/tmp/apply-ref.png"]);
      assert.equal(error?.debugInfo?.outputPath, "/tmp/apply-output.png");
      return true;
    }
  );
});
