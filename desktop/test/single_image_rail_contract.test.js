import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSingleImageRailButtons,
  getSingleImageRailMockRankedJobs,
  SINGLE_IMAGE_RAIL_CONTRACT,
  SINGLE_IMAGE_RAIL_DYNAMIC_SLOT_COUNT,
  SINGLE_IMAGE_RAIL_MOCK_ADAPTER,
} from "../src/juggernaut_shell/rail.js";

const here = dirname(fileURLToPath(import.meta.url));
const railSource = readFileSync(join(here, "..", "src", "juggernaut_shell", "rail.js"), "utf8");
const appSource = readFileSync(join(here, "..", "src", "canvas_app.js"), "utf8");
const seededJobIds = new Set(["cut_out", "remove", "new_background", "reframe", "variants"]);

test("single-image rail: contract renders 2 anchors plus 3 dynamic slots", () => {
  const rail = buildSingleImageRailButtons({
    hasImage: true,
    hasRegionSelection: false,
    toolHookReady: false,
    busy: false,
  });

  assert.equal(rail.contractName, SINGLE_IMAGE_RAIL_CONTRACT);
  assert.deepEqual(
    rail.buttons.map((button) => button.toolId),
    ["upload", "select", "cut_out", "new_background", "variants"]
  );
  assert.equal(rail.visibleDynamicJobs.length, SINGLE_IMAGE_RAIL_DYNAMIC_SLOT_COUNT);
  assert.equal(rail.buttons[0].label, "Upload");
  assert.equal(rail.buttons[1].label, "Select");
  assert.equal(rail.buttons[2].label, "Cut Out");
  assert.equal(rail.buttons[3].label, "New Background");
  assert.equal(rail.buttons[4].label, "Variants");
});

test("single-image rail: mock ranked jobs stay inside the approved seeded set and disabled reasons", () => {
  const ranked = getSingleImageRailMockRankedJobs({
    hasImage: true,
    hasRegionSelection: false,
    toolHookReady: false,
    busy: false,
  });

  assert.equal(ranked.length, 5);
  for (const job of ranked) {
    assert.ok(seededJobIds.has(job.jobId));
    assert.equal(job.enabled, false);
    assert.equal(job.disabledReason, "capability_unavailable");
    assert.equal(typeof job.confidence, "number");
    assert.ok(Array.isArray(job.reasonCodes));
    assert.equal(typeof job.stickyKey, "string");
  }
});

test("single-image rail: visible jobs stay sticky when the sticky key still exists and state does not worsen", () => {
  const previousVisibleJobs = [
    { jobId: "new_background", stickyKey: "new_background", enabled: true, disabledReason: "" },
    { jobId: "variants", stickyKey: "variants", enabled: true, disabledReason: "" },
    { jobId: "reframe", stickyKey: "reframe", enabled: true, disabledReason: "" },
  ];
  const rankedJobs = [
    {
      jobId: "cut_out",
      label: "Cut Out",
      capability: "subject_isolation",
      requiresSelection: false,
      enabled: true,
      disabledReason: "",
      confidence: 0.99,
      reasonCodes: ["higher_confidence"],
      stickyKey: "cut_out",
    },
    {
      jobId: "new_background",
      label: "New Background",
      capability: "background_replace",
      requiresSelection: false,
      enabled: true,
      disabledReason: "",
      confidence: 0.7,
      reasonCodes: [],
      stickyKey: "new_background",
    },
    {
      jobId: "variants",
      label: "Variants",
      capability: "identity_preserving_variation",
      requiresSelection: false,
      enabled: true,
      disabledReason: "",
      confidence: 0.68,
      reasonCodes: [],
      stickyKey: "variants",
    },
    {
      jobId: "reframe",
      label: "Reframe",
      capability: "crop_or_outpaint",
      requiresSelection: false,
      enabled: true,
      disabledReason: "",
      confidence: 0.67,
      reasonCodes: [],
      stickyKey: "reframe",
    },
  ];

  const rail = buildSingleImageRailButtons({
    hasImage: true,
    toolHookReady: true,
    rankedJobs,
    previousVisibleJobs,
    rerank: true,
    adapter: SINGLE_IMAGE_RAIL_MOCK_ADAPTER,
  });

  assert.deepEqual(
    rail.visibleDynamicJobs.map((job) => job.jobId),
    ["new_background", "variants", "reframe"]
  );
});

test("single-image rail: worsening enabled state drops the old sticky item", () => {
  const rail = buildSingleImageRailButtons({
    hasImage: true,
    hasRegionSelection: false,
    toolHookReady: true,
    rerank: true,
    previousVisibleJobs: [
      { jobId: "remove", stickyKey: "remove", enabled: true, disabledReason: "" },
      { jobId: "new_background", stickyKey: "new_background", enabled: true, disabledReason: "" },
      { jobId: "variants", stickyKey: "variants", enabled: true, disabledReason: "" },
    ],
    rankedJobs: [
      {
        jobId: "remove",
        label: "Remove",
        capability: "targeted_remove",
        requiresSelection: true,
        enabled: false,
        disabledReason: "selection_required",
        confidence: 0.95,
        reasonCodes: ["selection_missing"],
        stickyKey: "remove",
      },
      {
        jobId: "cut_out",
        label: "Cut Out",
        capability: "subject_isolation",
        requiresSelection: false,
        enabled: true,
        disabledReason: "",
        confidence: 0.8,
        reasonCodes: [],
        stickyKey: "cut_out",
      },
      {
        jobId: "new_background",
        label: "New Background",
        capability: "background_replace",
        requiresSelection: false,
        enabled: true,
        disabledReason: "",
        confidence: 0.75,
        reasonCodes: [],
        stickyKey: "new_background",
      },
      {
        jobId: "variants",
        label: "Variants",
        capability: "identity_preserving_variation",
        requiresSelection: false,
        enabled: true,
        disabledReason: "",
        confidence: 0.74,
        reasonCodes: [],
        stickyKey: "variants",
      },
    ],
  });

  assert.deepEqual(
    rail.visibleDynamicJobs.map((job) => job.jobId),
    ["new_background", "variants", "cut_out"]
  );
});

test("single-image rail: source keeps keyed slot rendering instead of clearing the full rail", () => {
  assert.match(railSource, /data-slot-key/);
  assert.match(railSource, /root\.dataset\.railContract = SINGLE_IMAGE_RAIL_CONTRACT/);
  assert.doesNotMatch(railSource, /root\.innerHTML = "";/);
});

test("single-image rail: canvas app wires real intent ranking and runtime shaping before mock fallback", () => {
  assert.match(appSource, /rankSingleImageIntentJobs/);
  assert.match(appSource, /buildSingleImageRailJobEntries/);
  assert.match(appSource, /buildSingleImageRailInvocation/);
  assert.match(appSource, /registerSingleImageRailRanker\(/);
  assert.match(appSource, /registerToolInvoker\(/);
  assert.match(appSource, /rankResult\.mock\s*\?\s*rankResult\.rankedJobs\s*:\s*buildSingleImageRailJobEntries/);
});

test("single-image rail: canvas app keeps the mock adapter as fallback only", () => {
  assert.match(appSource, /Single-image rail ranker failed, falling back to mock adapter/);
  assert.match(appSource, /adapter:\s*\{\s*\.\.\.SINGLE_IMAGE_RAIL_MOCK_ADAPTER\s*\}/);
  assert.match(appSource, /rankedJobs:\s*getSingleImageRailMockRankedJobs\(context\)/);
});

test("single-image rail: capability success history is retained for ranking context", () => {
  assert.match(appSource, /recentSuccessfulJobs:\s*singleImageRailRecentSuccessfulJobs\(\)/);
  assert.match(appSource, /rememberSingleImageRailSuccess\(result\)/);
});
