import { test } from "node:test";
import assert from "node:assert/strict";

import { DESIGN_REVIEW_ACCOUNT_MEMORY_SCHEMA } from "../src/design_review_contract.js";
import {
  applyDesignReviewAccountMemoryBias,
  createDesignReviewMemoryStore,
  readDesignReviewAccountMemory,
  recordAcceptedDesignReviewProposal,
  summarizeDesignReviewAccountMemory,
} from "../src/design_review_memory.js";

test("accepted design review proposals update action, style, and use-case memory", () => {
  const store = createDesignReviewMemoryStore();
  recordAcceptedDesignReviewProposal(
    store,
    { actionType: "background_replace" },
    {
      stylePatterns: ["studio white"],
      useCasePatterns: ["product shot"],
    }
  );
  recordAcceptedDesignReviewProposal(
    store,
    { actionType: "background_replace" },
    {
      stylePatterns: ["studio white"],
      useCasePatterns: ["product shot"],
    }
  );

  const memory = readDesignReviewAccountMemory(store);
  const summary = summarizeDesignReviewAccountMemory(memory);

  assert.equal(memory.schemaVersion, DESIGN_REVIEW_ACCOUNT_MEMORY_SCHEMA);
  assert.equal(summary.schemaVersion, DESIGN_REVIEW_ACCOUNT_MEMORY_SCHEMA);
  assert.equal(memory.acceptedActionTypes.background_replace, 2);
  assert.equal(summary.acceptedActionTypes[0].actionType, "background_replace");
  assert.equal(summary.preferredStylePatterns[0].label, "studio white");
  assert.equal(summary.preferredUseCasePatterns[0].label, "product shot");
});

test("account memory bias reranks proposals that match accepted action types and patterns", () => {
  const proposals = applyDesignReviewAccountMemoryBias(
    [
      {
        proposalId: "p-1",
        label: "Swap background",
        why: "Move to a studio white backdrop for a product shot.",
        previewBrief: "Studio white product preview.",
        actionType: "background_replace",
        rank: 2,
      },
      {
        proposalId: "p-2",
        label: "Remove distraction",
        why: "Remove the extra object on the edge.",
        previewBrief: "Cleaner frame.",
        actionType: "targeted_remove",
        rank: 1,
      },
    ],
    {
      acceptedActionTypes: [{ actionType: "background_replace", count: 4 }],
      preferredStylePatterns: [{ label: "studio white", count: 2 }],
      preferredUseCasePatterns: [{ label: "product shot", count: 2 }],
    }
  );

  assert.equal(proposals[0].proposalId, "p-1");
  assert.ok(proposals[0].memoryBias > 0);
  assert.equal(proposals[0].rank, 1);
});
