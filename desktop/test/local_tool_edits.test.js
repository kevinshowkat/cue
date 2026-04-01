import { test } from "node:test";
import assert from "node:assert/strict";

import {
  applyDeterministicRasterEdit,
  buildLocalToolEditPlan,
  buildLocalToolReceiptStep,
  listSupportedLocalToolOperations,
  normalizeLocalToolApplyRequest,
  renderLocalToolEditCanvas,
} from "../src/local_tool_edits.js";

test("local tool edits: normalizes the launch-slice tool shape", () => {
  const resolved = normalizeLocalToolApplyRequest({
    imageId: "img-7",
    tool: {
      id: "tool-mono",
      name: "Mono Portrait",
      source: "user",
      kind: "filter",
      operation: "black and white",
      params: {
        strength: 0.6,
      },
    },
  });

  assert.deepEqual(resolved, {
    id: "tool-mono",
    name: "Mono Portrait",
    source: "user",
    kind: "filter",
    operation: "grayscale",
    capability: null,
    executionType: null,
    routeProfile: null,
    surface: null,
    params: {
      intensity: 0.6,
    },
  });
});

test("local tool edits: supported operations are restricted to the launch slice", () => {
  assert.deepEqual(
    listSupportedLocalToolOperations().map((item) => item.id),
    ["grayscale", "invert", "sepia", "brighten", "contrast", "polish", "relight"]
  );
  assert.equal(
    buildLocalToolEditPlan({
      tool: {
        id: "tool-crop",
        name: "Square Crop",
        source: "user",
        kind: "filter",
        operation: "crop_square",
        params: {},
      },
    }),
    null
  );
});

test("local tool edits: deterministic grayscale preserves alpha", () => {
  const next = applyDeterministicRasterEdit(
    {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([
        100, 150, 200, 255,
        10, 20, 30, 64,
      ]),
    },
    buildLocalToolEditPlan({
      tool: {
        id: "tool-gray",
        name: "Gray",
        source: "user",
        kind: "filter",
        operation: "grayscale",
        params: {
          intensity: 1,
        },
      },
    })
  );

  assert.equal(next.data[0], next.data[1]);
  assert.equal(next.data[1], next.data[2]);
  assert.equal(next.data[4], next.data[5]);
  assert.equal(next.data[5], next.data[6]);
  assert.equal(next.data[3], 255);
  assert.equal(next.data[7], 64);
});

test("local tool edits: deterministic contrast changes pixel values", () => {
  const next = applyDeterministicRasterEdit(
    {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([110, 120, 130, 255]),
    },
    "contrast",
    {
      intensity: 1,
    }
  );

  assert.deepEqual(Array.from(next.data), [99, 115, 131, 255]);
});

test("local tool edits: invocation payloads can carry direct-affordance routing metadata", () => {
  const localRuntime = {
    target: "single_image_local_edit",
    resolutionOrder: ["installed_pack_manifest", "cue_home_env", "cue_env", "legacy_env"],
    baselinePlatform: "macos",
    windowsStatus: "secondary",
  };
  const resolved = normalizeLocalToolApplyRequest({
    contract: "single-image-rail-v1",
    jobId: "polish",
    label: "Polish",
    capability: "image_polish",
    executionType: "local_first",
    routeProfile: "polish_local_first",
    execution: {
      kind: "local_edit",
      operation: "polish",
      capability: "image_polish",
      executionType: "local_first",
      routeProfile: "polish_local_first",
      routingStrategy: "local_first_with_model_fallback",
      localRuntime,
      params: {
        intensity: 0.7,
      },
    },
    route: {
      routingStrategy: "local_first_with_model_fallback",
      localRuntime,
    },
  });

  assert.deepEqual(resolved, {
    id: "polish",
    name: "Polish",
    source: "local",
    kind: "local_edit",
    operation: "polish",
    capability: "image_polish",
    executionType: "local_first",
    routeProfile: "polish_local_first",
    routingStrategy: "local_first_with_model_fallback",
    localRuntime,
    surface: null,
    params: {
      intensity: 0.7,
    },
  });
});

test("local tool edits: deterministic polish nudges global finish without touching alpha", () => {
  const next = applyDeterministicRasterEdit(
    {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([96, 118, 144, 200]),
    },
    "polish",
    {
      intensity: 1,
    }
  );

  assert.equal(next.data[3], 200);
  assert.notDeepEqual(Array.from(next.data.slice(0, 3)), [96, 118, 144]);
  assert.ok(next.data[0] >= 96);
  assert.ok(next.data[1] >= 118);
});

test("local tool edits: deterministic relight lifts shadows and warms the image globally", () => {
  const next = applyDeterministicRasterEdit(
    {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([48, 56, 68, 255]),
    },
    "relight",
    {
      intensity: 1,
    }
  );

  assert.ok(next.data[0] > 48);
  assert.ok(next.data[1] > 56);
  assert.ok(next.data[2] > 68);
  assert.ok(next.data[0] >= next.data[2]);
});

test("local tool edits: render path uses raster mutation instead of canvas filters", () => {
  const plan = buildLocalToolEditPlan({
    tool: {
      id: "tool-warm",
      name: "Warm",
      source: "user",
      kind: "filter",
      operation: "sepia",
      params: {
        intensity: 1,
      },
    },
  });
  let putImageDataCalls = 0;
  const context = {
    drawImage: () => {},
    getImageData: () => ({
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([40, 90, 160, 255]),
    }),
    putImageData: (imageData) => {
      putImageDataCalls += 1;
      assert.notDeepEqual(Array.from(imageData.data), [40, 90, 160, 255]);
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
  };

  const out = renderLocalToolEditCanvas(
    {
      naturalWidth: 1,
      naturalHeight: 1,
    },
    plan,
    {
      createCanvas: () => canvas,
    }
  );

  assert.equal(out.width, 1);
  assert.equal(out.height, 1);
  assert.equal(putImageDataCalls, 1);
});

test("local tool edits: receipt step captures deterministic edit metadata", () => {
  const plan = buildLocalToolEditPlan({
    tool: {
      id: "tool-bright",
      name: "Brighten",
      source: "generated",
      kind: "filter",
      operation: "brighten",
      params: {
        intensity: 0.8,
      },
    },
  });

  assert.deepEqual(buildLocalToolReceiptStep(plan, { outputPath: "/tmp/out.png", receiptPath: "/tmp/receipt.json" }), {
    kind: "local_raster_edit",
    source: "tool_runtime",
    toolId: "tool-bright",
    toolName: "Brighten",
    operation: "brighten",
    params: {
      intensity: 0.8,
    },
    outputPath: "/tmp/out.png",
    receiptPath: "/tmp/receipt.json",
  });
});

test("local tool edits: receipt step preserves local-first routing metadata", () => {
  const localRuntime = {
    target: "single_image_local_edit",
    resolutionOrder: ["installed_pack_manifest", "cue_home_env", "cue_env", "legacy_env"],
    baselinePlatform: "macos",
    windowsStatus: "secondary",
  };
  const plan = buildLocalToolEditPlan({
    contract: "single-image-rail-v1",
    jobId: "relight",
    label: "Relight",
    capability: "image_relight",
    executionType: "local_first",
    routeProfile: "relight_local_first",
    routingStrategy: "local_first_with_model_fallback",
    execution: {
      kind: "local_edit",
      operation: "relight",
      executionType: "local_first",
      routeProfile: "relight_local_first",
      routingStrategy: "local_first_with_model_fallback",
      localRuntime,
      params: {
        intensity: 0.55,
      },
    },
  });

  assert.deepEqual(buildLocalToolReceiptStep(plan, { outputPath: "/tmp/relight.png", receiptPath: "/tmp/relight.json" }), {
    kind: "local_raster_edit",
    source: "tool_runtime",
    toolId: "relight",
    toolName: "Relight",
    operation: "relight",
    params: {
      intensity: 0.55,
    },
    outputPath: "/tmp/relight.png",
    receiptPath: "/tmp/relight.json",
    capability: "image_relight",
    executionType: "local_first",
    routeProfile: "relight_local_first",
    routingStrategy: "local_first_with_model_fallback",
    localRuntime,
  });
});

test("local tool edits: receipt step carries routing metadata for direct affordances", () => {
  const plan = buildLocalToolEditPlan({
    contract: "single-image-rail-v1",
    jobId: "relight",
    label: "Relight",
    capability: "image_relight",
    executionType: "local_first",
    routeProfile: "relight_local_first",
    execution: {
      kind: "local_edit",
      operation: "relight",
      capability: "image_relight",
      executionType: "local_first",
      routeProfile: "relight_local_first",
      params: {
        intensity: 0.85,
      },
    },
  });

  assert.deepEqual(buildLocalToolReceiptStep(plan, { outputPath: "/tmp/relight.png", receiptPath: "/tmp/relight.json" }), {
    kind: "local_raster_edit",
    source: "tool_runtime",
    toolId: "relight",
    toolName: "Relight",
    operation: "relight",
    params: {
      intensity: 0.85,
    },
    outputPath: "/tmp/relight.png",
    receiptPath: "/tmp/relight.json",
    capability: "image_relight",
    executionType: "local_first",
    routeProfile: "relight_local_first",
  });
});
