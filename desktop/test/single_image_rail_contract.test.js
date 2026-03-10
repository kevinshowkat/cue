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
const seededJobIds = new Set(["cut_out", "remove", "new_background", "reframe", "variants"]);

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
      "new_background",
      "variants",
      "protect",
      "make_space",
      "remove_people",
      "polish",
      "relight",
    ]
  );
  assert.equal(rail.visibleDynamicJobs.length, SINGLE_IMAGE_RAIL_DYNAMIC_SLOT_COUNT);
  assert.equal(rail.buttons[0].label, "Move");
  assert.equal(rail.buttons[1].label, "Upload");
  assert.equal(rail.buttons[2].label, "Select");
  assert.equal(rail.buttons[3].label, "Cut Out");
  assert.equal(rail.buttons[4].label, "New Background");
  assert.equal(rail.buttons[5].label, "Variants");
  assert.equal(rail.buttons[6].label, "Protect");
  assert.equal(rail.buttons[7].label, "Make Space");
  assert.equal(rail.buttons[8].label, "Remove People");
  assert.equal(rail.buttons[9].label, "Polish");
  assert.equal(rail.buttons[10].label, "Relight");
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
  assert.equal(getSingleImageRailItem("protect")?.label, "Protect");
  assert.equal(getSingleImageRailItem("make_space")?.label, "Make Space");
});

test("single-image rail: affordances use shell bridge state for enablement and selection", () => {
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
      communicationReview: {
        state: {
          tool: "marker",
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
    const rail = buildSingleImageRailButtons({
      hasImage: true,
      hasRegionSelection: false,
      busy: false,
      toolHookReady: true,
    });
    const buttons = Object.fromEntries(rail.buttons.map((button) => [button.toolId, button]));
    assert.equal(buttons.protect.disabled, false);
    assert.equal(buttons.protect.selected, true);
    assert.equal(buttons.make_space.disabled, false);
    assert.equal(buttons.remove_people.disabled, false);
    assert.equal(buttons.remove_people.label, "Remove People");
    assert.equal(buttons.polish.disabled, false);
    assert.equal(buttons.relight.disabled, false);
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
    assert.equal(noImageButtons.protect.disabledReason, "unavailable_in_current_mode");
    assert.equal(noImageButtons.make_space.disabledReason, "unavailable_in_current_mode");
    assert.equal(noImageButtons.remove_people.disabledReason, "unavailable_in_current_mode");
    assert.equal(noImageButtons.polish.disabledReason, "unavailable_in_current_mode");
    assert.equal(noImageButtons.relight.disabledReason, "unavailable_in_current_mode");

    const busyRail = buildSingleImageRailButtons({
      hasImage: true,
      hasRegionSelection: false,
      busy: true,
      toolHookReady: true,
    });
    const busyButtons = Object.fromEntries(busyRail.buttons.map((button) => [button.toolId, button]));
    assert.equal(busyButtons.protect.disabledReason, "busy");
    assert.equal(busyButtons.make_space.disabledReason, "busy");
    assert.equal(busyButtons.remove_people.disabledReason, "busy");
    assert.equal(busyButtons.polish.disabledReason, "busy");
    assert.equal(busyButtons.relight.disabledReason, "busy");
  } finally {
    globalThis.window = originalWindow;
  }
});
