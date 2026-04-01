import { test } from "node:test";
import assert from "node:assert/strict";

import { DESIGN_REVIEW_UPLOAD_ANALYSIS_SCHEMA } from "../src/design_review_contract.js";
import {
  createUploadAnalysisWarmupController,
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
  assert.equal(stored.schemaVersion, DESIGN_REVIEW_UPLOAD_ANALYSIS_SCHEMA);
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

  assert.equal(normalized.schemaVersion, DESIGN_REVIEW_UPLOAD_ANALYSIS_SCHEMA);
  assert.equal(normalized.hash, "hash-3");
  assert.equal(normalized.summary, "Bright sneaker on a seamless backdrop.");
  assert.deepEqual(normalized.subjectTags, ["sneaker"]);
});

test("upload analysis warmup controller only schedules newly seen images", async () => {
  const cache = createUploadAnalysisCacheStore();
  cache.setConsent("granted");
  const analyzed = [];
  const controller = createUploadAnalysisWarmupController({
    cacheStore: cache,
    hashImage: async (image) => `hash:${image?.path || image?.id || ""}`,
    analyzeImage: async ({ image }) => {
      analyzed.push(image.path);
      return {
        summary: `summary:${image.path}`,
      };
    },
  });

  const first = await controller.warmImages(
    [
      { id: "img-1", path: "/tmp/one.png" },
      { id: "img-2", path: "/tmp/two.png" },
    ],
    { consent: "granted" }
  );
  await Promise.all(first.map((entry) => entry?.promise).filter(Boolean));
  const second = await controller.warmImages(
    [
      { id: "img-1b", path: "/tmp/one.png" },
      { id: "img-3", path: "/tmp/three.png" },
    ],
    { consent: "granted" }
  );
  await Promise.all(second.map((entry) => entry?.promise).filter(Boolean));

  assert.deepEqual(analyzed, ["/tmp/one.png", "/tmp/two.png", "/tmp/three.png"]);
  assert.equal(cache.get("hash:/tmp/one.png").summary, "summary:/tmp/one.png");
  assert.equal(cache.get("hash:/tmp/three.png").summary, "summary:/tmp/three.png");
});
