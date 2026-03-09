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
    params: {
      intensity: 0.6,
    },
  });
});

test("local tool edits: supported operations are restricted to the launch slice", () => {
  assert.deepEqual(
    listSupportedLocalToolOperations().map((item) => item.id),
    ["grayscale", "invert", "sepia", "brighten", "contrast"]
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
