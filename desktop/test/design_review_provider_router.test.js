import { test } from "node:test";
import assert from "node:assert/strict";

import { DESIGN_REVIEW_PLANNER_MODEL } from "../src/design_review_contract.js";
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
