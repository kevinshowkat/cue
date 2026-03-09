import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createUploadAnalysisCacheStore,
  normalizeUploadAnalysisResult,
  scheduleOpportunisticUploadAnalysis,
} from "../src/design_review_upload_analysis.js";

test("upload analysis cache enforces first-use consent gating", async () => {
  const cache = createUploadAnalysisCacheStore();
  const result = await scheduleOpportunisticUploadAnalysis({
    image: { id: "img-1", path: "/tmp/input.png" },
    cacheStore: cache,
    analyzeImage: async () => ({ summary: "should not run" }),
  });

  assert.equal(result.started, false);
  assert.equal(result.status, "consent_required");
});

test("upload analysis cache stores opportunistic results by image hash without blocking", async () => {
  const cache = createUploadAnalysisCacheStore();
  cache.setConsent("granted");
  const scheduled = await scheduleOpportunisticUploadAnalysis({
    image: { id: "img-2", path: "/tmp/input-2.png" },
    cacheStore: cache,
    hashImage: async () => "hash-2",
    analyzeImage: async () => ({
      summary: "Clean tabletop product photo.",
      subjectTags: ["lamp"],
      styleTags: ["studio"],
      useCaseTags: ["catalog"],
      actionBiases: ["background_replace"],
    }),
  });

  assert.equal(scheduled.started, true);
  const stored = await scheduled.promise;
  assert.equal(stored.hash, "hash-2");
  assert.equal(cache.get("hash-2").summary, "Clean tabletop product photo.");
  assert.deepEqual(cache.get("hash-2").actionBiases, ["background_replace"]);
});

test("upload analysis normalization accepts text-wrapped JSON payloads", () => {
  const normalized = normalizeUploadAnalysisResult(
    {
      text: JSON.stringify({
        summary: "Bright sneaker on a seamless backdrop.",
        subjectTags: ["sneaker"],
        styleTags: ["commercial"],
      }),
    },
    {
      hash: "hash-3",
      imagePath: "/tmp/sneaker.png",
      imageId: "img-3",
    }
  );

  assert.equal(normalized.hash, "hash-3");
  assert.equal(normalized.summary, "Bright sneaker on a seamless backdrop.");
  assert.deepEqual(normalized.subjectTags, ["sneaker"]);
});
