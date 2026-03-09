import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SINGLE_IMAGE_RAIL_CONTRACT,
  rankSingleImageIntentJobs,
} from "../src/single_image_intent_ranking.js";

function job(result, jobId) {
  return result.rankedJobs.find((entry) => entry.jobId === jobId) || null;
}

test("single-image ranking: portrait without selection keeps remove disabled and promotes safe non-selection jobs", () => {
  const result = rankSingleImageIntentJobs({
    imageCount: 1,
    hasActiveImage: true,
    mode: "single",
    selectionPresent: false,
    activeImage: {
      semanticHints: {
        portrait: 0.96,
        person: 0.94,
        group: 0.05,
      },
      geometryHints: {
        needsReframe: 0.18,
      },
    },
  });

  assert.equal(result.contractName, SINGLE_IMAGE_RAIL_CONTRACT);
  assert.equal(result.rankedJobs[0].jobId, "variants");
  assert.equal(result.rankedJobs[1].jobId, "new_background");
  assert.equal(result.rankedJobs.at(-1)?.jobId, "remove");
  assert.equal(job(result, "remove")?.enabled, false);
  assert.equal(job(result, "remove")?.disabledReason, "selection_required");
  assert.equal(job(result, "variants")?.stickyKey, "single-image-rail-v1:variants");
});

test("single-image ranking: group photo with region selection prioritizes targeted remove", () => {
  const result = rankSingleImageIntentJobs({
    imageCount: 1,
    hasActiveImage: true,
    mode: "single",
    selection: { present: true, count: 1 },
    activeImage: {
      semanticHints: {
        person: 0.82,
        group: 0.97,
      },
    },
  });

  assert.equal(result.rankedJobs[0].jobId, "remove");
  assert.equal(job(result, "remove")?.enabled, true);
  assert.equal(job(result, "remove")?.disabledReason, null);
  assert.match(job(result, "remove")?.reasonCodes.join(","), /selection_present/);
  assert.match(job(result, "remove")?.reasonCodes.join(","), /group_hint/);
});

test("single-image ranking: product shot on messy background prioritizes new background then cut out", () => {
  const result = rankSingleImageIntentJobs({
    imageCount: 1,
    hasActiveImage: true,
    mode: "single",
    activeImage: {
      semanticHints: {
        product: 0.97,
        backgroundBusy: 0.92,
      },
      geometryHints: {
        needsReframe: 0.32,
      },
    },
  });

  assert.equal(result.rankedJobs[0].jobId, "new_background");
  assert.equal(result.rankedJobs[1].jobId, "cut_out");
  assert.ok(job(result, "new_background")?.confidence > job(result, "cut_out")?.confidence);
});

test("single-image ranking: screenshot image favors reframe and suppresses semantic cut-out actions", () => {
  const result = rankSingleImageIntentJobs({
    imageCount: 1,
    hasActiveImage: true,
    mode: "single",
    activeImage: {
      semanticHints: {
        screenshot: 0.99,
        ui: 0.99,
      },
      geometryHints: {
        needsReframe: 0.46,
        cropIssue: 0.41,
      },
    },
  });

  assert.equal(result.rankedJobs[0].jobId, "reframe");
  assert.ok(job(result, "reframe")?.confidence > 0.7);
  assert.ok(job(result, "cut_out")?.confidence < 0.1);
  assert.ok(job(result, "new_background")?.confidence < 0.1);
});

test("single-image ranking: transparent isolated asset demotes cut out and favors new background", () => {
  const result = rankSingleImageIntentJobs({
    imageCount: 1,
    hasActiveImage: true,
    mode: "single",
    activeImage: {
      hasTransparency: true,
      transparencyHint: 0.98,
      isolationHint: 0.95,
      semanticHints: {
        product: 0.78,
      },
    },
    recentSuccessfulJobIds: ["variants"],
  });

  assert.equal(result.rankedJobs[0].jobId, "new_background");
  assert.equal(result.rankedJobs[1].jobId, "variants");
  assert.equal(result.rankedJobs.at(-1)?.jobId, "remove");
  assert.ok(job(result, "cut_out")?.confidence < job(result, "variants")?.confidence);
  assert.match(job(result, "cut_out")?.reasonCodes.join(","), /already_isolated/);
});

test("single-image ranking: capability and mode gates only use approved disabled reasons", () => {
  const result = rankSingleImageIntentJobs({
    imageCount: 2,
    hasActiveImage: true,
    mode: "multi",
    busy: true,
    capabilityAvailability: {
      targeted_remove: false,
    },
    supportedImage: false,
  });

  const allowed = new Set([
    "selection_required",
    "busy",
    "unsupported_image",
    "unavailable_in_current_mode",
    "capability_unavailable",
    null,
  ]);

  for (const entry of result.rankedJobs) {
    assert.ok(allowed.has(entry.disabledReason));
    assert.equal(entry.enabled, false);
    assert.equal(entry.disabledReason, "unavailable_in_current_mode");
  }
});
