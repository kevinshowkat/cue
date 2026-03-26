import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSingleImageRailButtons,
  getSingleImageRailItem,
  getSingleImageRailMockRankedJobs,
  SINGLE_IMAGE_RAIL_CONTRACT,
  SINGLE_IMAGE_RAIL_DYNAMIC_SLOT_COUNT,
  SINGLE_IMAGE_RAIL_MOCK_ADAPTER,
} from "../src/juggernaut_shell/rail.js";

const here = dirname(fileURLToPath(import.meta.url));
const railSource = readFileSync(join(here, "..", "src", "juggernaut_shell", "rail.js"), "utf8");
const appSource = readFileSync(join(here, "..", "src", "canvas_app.js"), "utf8");
const seededJobIds = new Set(["cut_out", "remove", "reframe", "variants"]);

test("single-image rail: contract renders 3 anchors plus 3 dynamic slots", () => {
  const rail = buildSingleImageRailButtons({
    hasImage: true,
    hasRegionSelection: false,
    toolHookReady: false,
    busy: false,
  });

  assert.equal(rail.contractName, SINGLE_IMAGE_RAIL_CONTRACT);
  assert.deepEqual(
    rail.buttons.map((button) => button.toolId),
    [
      "move",
      "upload",
      "select",
      "cut_out",
      "variants",
      "reframe",
      "remove_people",
    ]
  );
  assert.equal(rail.visibleDynamicJobs.length, SINGLE_IMAGE_RAIL_DYNAMIC_SLOT_COUNT);
  assert.equal(rail.buttons[0].label, "Move");
  assert.equal(rail.buttons[1].label, "Upload");
  assert.equal(rail.buttons[2].label, "Select");
  assert.equal(rail.buttons[3].label, "Cut Out");
  assert.equal(rail.buttons[4].label, "Variants");
  assert.equal(rail.buttons[5].label, "Reframe");
  assert.equal(rail.buttons[6].label, "Remove People");
  assert.equal(rail.buttons[0].provenance, "local_only");
  assert.equal(rail.buttons[3].provenance, "external_model");
  assert.equal(rail.buttons[6].provenance, "external_model");
  assert.equal(rail.buttons[0].hotkey, "");
  assert.equal(rail.buttons[1].hotkey, "1");
  assert.equal(rail.buttons[2].hotkey, "2");
  assert.equal(rail.buttons[3].hotkey, "3");
});

test("single-image rail: mock ranked jobs stay inside the approved seeded set and disabled reasons", () => {
  const ranked = getSingleImageRailMockRankedJobs({
    hasImage: true,
    hasRegionSelection: false,
    toolHookReady: false,
    busy: false,
  });

  assert.equal(ranked.length, 4);
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
    { jobId: "variants", stickyKey: "variants", enabled: true, disabledReason: "" },
    { jobId: "reframe", stickyKey: "reframe", enabled: true, disabledReason: "" },
    { jobId: "remove", stickyKey: "remove", enabled: true, disabledReason: "" },
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
    {
      jobId: "remove",
      label: "Remove",
      capability: "targeted_remove",
      requiresSelection: true,
      enabled: true,
      disabledReason: "",
      confidence: 0.66,
      reasonCodes: [],
      stickyKey: "remove",
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
    ["variants", "reframe", "remove"]
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
      { jobId: "variants", stickyKey: "variants", enabled: true, disabledReason: "" },
      { jobId: "reframe", stickyKey: "reframe", enabled: true, disabledReason: "" },
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
      {
        jobId: "reframe",
        label: "Reframe",
        capability: "crop_or_outpaint",
        requiresSelection: false,
        enabled: true,
        disabledReason: "",
        confidence: 0.73,
        reasonCodes: [],
        stickyKey: "reframe",
      },
    ],
  });

  assert.deepEqual(
    rail.visibleDynamicJobs.map((job) => job.jobId),
    ["variants", "reframe", "cut_out"]
  );
});

test("single-image rail: source keeps keyed slot rendering instead of clearing the full rail", () => {
  assert.match(railSource, /data-slot-key/);
  assert.match(railSource, /root\.dataset\.railContract = SINGLE_IMAGE_RAIL_CONTRACT/);
  assert.match(railSource, /toolEl\.dataset\.provenance/);
  assert.match(railSource, /renderActionProvenanceBadge/);
  assert.match(railSource, /is-external-model/);
  assert.match(railSource, /--jg-primary-rail-button-count/);
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

test("single-image rail: canonical affordance labels keep Remove People standardized", () => {
  assert.equal(getSingleImageRailItem("remove_people")?.label, "Remove People");
  assert.equal(getSingleImageRailItem("new_background")?.label, "New Background");
  assert.equal(getSingleImageRailItem("polish")?.label, "Polish");
  assert.equal(getSingleImageRailItem("relight")?.label, "Relight");
  assert.equal(getSingleImageRailItem("protect")?.label, "Protect");
  assert.equal(getSingleImageRailItem("make_space")?.label, "Make Space");
});

test("single-image rail: region select uses a marquee glyph while Cut Out keeps subject extraction art", () => {
  const selectAnchorStart = railSource.indexOf('toolId: "select"');
  const selectRegionIconStart = railSource.indexOf('iconSvg: railIconSvg("select_region")', selectAnchorStart);
  const cutOutStart = railSource.indexOf('cut_out: Object.freeze({');
  const cutOutSubjectIconStart = railSource.indexOf('iconId: "select_subject"', cutOutStart);

  assert.ok(selectAnchorStart >= 0);
  assert.ok(selectRegionIconStart > selectAnchorStart);
  assert.ok(cutOutStart >= 0);
  assert.ok(cutOutSubjectIconStart > cutOutStart);
});

test("single-image rail: direct affordances use shell bridge state for enablement", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    __JUGGERNAUT_SHELL__: {
      getCanvasSnapshot() {
        return {
          activeImageId: "img-1",
          selectedImageIds: ["img-1"],
          canvasMode: "single",
          images: [
            {
              id: "img-1",
              path: "/tmp/hero.png",
              width: 1024,
              height: 1024,
              active: true,
              selected: true,
            },
          ],
        };
      },
    },
    juggernautApplyTool: async () => ({ ok: true }),
  };

  try {
    const rail = buildSingleImageRailButtons({
      hasImage: true,
      hasRegionSelection: false,
      busy: false,
      toolHookReady: true,
    });
    const buttons = Object.fromEntries(rail.buttons.map((button) => [button.toolId, button]));
    assert.equal(buttons.remove_people.disabled, false);
    assert.equal(buttons.remove_people.label, "Remove People");
    assert.equal(buttons.remove_people.provenance, "external_model");
    assert.equal(buttons.polish, undefined);
    assert.equal(buttons.relight, undefined);
  } finally {
    globalThis.window = originalWindow;
  }
});

test("single-image rail: affordances disable cleanly when no image or busy state blocks them", () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    __JUGGERNAUT_SHELL__: {
      getCanvasSnapshot() {
        return {
          activeImageId: "img-2",
          selectedImageIds: ["img-2"],
          canvasMode: "single",
          images: [
            {
              id: "img-2",
              path: "/tmp/hero-2.png",
              width: 1200,
              height: 900,
              active: true,
              selected: true,
            },
          ],
        };
      },
      communicationReview: {
        state: {
          tool: "",
        },
        getState() {
          return this.state;
        },
        setTool(tool) {
          this.state.tool = tool;
          return tool;
        },
      },
    },
    juggernautApplyTool: async () => ({ ok: true }),
  };

  try {
    const noImage = buildSingleImageRailButtons({
      hasImage: false,
      hasRegionSelection: false,
      busy: false,
      toolHookReady: true,
    });
    const noImageButtons = Object.fromEntries(noImage.buttons.map((button) => [button.toolId, button]));
    assert.equal(noImageButtons.remove_people.disabledReason, "unavailable_in_current_mode");
    assert.equal(noImageButtons.polish, undefined);
    assert.equal(noImageButtons.relight, undefined);

    const busyRail = buildSingleImageRailButtons({
      hasImage: true,
      hasRegionSelection: false,
      busy: true,
      toolHookReady: true,
    });
    const busyButtons = Object.fromEntries(busyRail.buttons.map((button) => [button.toolId, button]));
    assert.equal(busyButtons.remove_people.disabledReason, "busy");
    assert.equal(busyButtons.polish, undefined);
    assert.equal(busyButtons.relight, undefined);
  } finally {
    globalThis.window = originalWindow;
  }
});
