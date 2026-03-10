import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  TOOL_APPLY_BRIDGE_EVENT,
  TOOL_APPLY_BRIDGE_FAILURE_EVENT,
  TOOL_APPLY_BRIDGE_SUCCESS_EVENT,
  applyToolRuntimeRequest,
  installToolApplyBridge,
} from "../src/tool_apply_runtime.js";
import { SINGLE_IMAGE_RAIL_CONTRACT } from "../src/single_image_capability_routing.js";
import { buildSingleImageDirectAffordanceInvocation } from "../src/tool_runtime.js";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

class CustomEventMock {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

function createWindowMock() {
  const listeners = new Map();
  const dispatched = [];
  return {
    dispatched,
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    dispatchEvent(event) {
      dispatched.push(event);
      const handlers = Array.from(listeners.get(event.type) || []);
      for (const handler of handlers) {
        handler(event);
      }
      return true;
    },
  };
}

test("tool apply runtime: returns the launch-slice success payload", async () => {
  const saved = [];
  const result = await applyToolRuntimeRequest(
    {
      imageId: "img-1",
      tool: {
        id: "tool-contrast",
        name: "Contrast Pop",
        source: "user",
        kind: "filter",
        operation: "contrast",
        params: {
          intensity: 1,
        },
      },
    },
    {
      hasImageId: (imageId) => imageId === "img-1",
      getActiveImageId: () => "img-1",
      getImageById: () => ({
        id: "img-1",
        path: "/tmp/source.png",
        img: {
          naturalWidth: 1,
          naturalHeight: 1,
        },
      }),
      createCanvas: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: () => {},
          getImageData: () => ({
            width: 1,
            height: 1,
            data: new Uint8ClampedArray([110, 120, 130, 255]),
          }),
          putImageData: () => {},
        }),
      }),
      saveCanvasArtifact: async (canvas, options) => {
        saved.push({
          canvas,
          options,
        });
        return {
          imageId: "img-1",
          outputPath: "/tmp/edited.png",
          receiptPath: "/tmp/receipt.json",
        };
      },
    }
  );

  assert.deepEqual(result, {
    ok: true,
    imageId: "img-1",
    toolId: "tool-contrast",
    outputPath: "/tmp/edited.png",
    receiptStep: {
      kind: "local_raster_edit",
      source: "tool_runtime",
      toolId: "tool-contrast",
      toolName: "Contrast Pop",
      operation: "contrast",
      params: {
        intensity: 1,
      },
      outputPath: "/tmp/edited.png",
      receiptPath: "/tmp/receipt.json",
    },
  });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].options.operation, "tool_contrast");
  assert.equal(saved[0].options.replaceActive, true);
  assert.equal(saved[0].options.targetId, "img-1");
  assert.equal(saved[0].options.meta.source, "tool_runtime");
});

test("tool apply runtime: unsupported operations return a shaped failure payload", async () => {
  const result = await applyToolRuntimeRequest(
    {
      imageId: "img-1",
      tool: {
        id: "tool-crop",
        name: "Square Crop",
        source: "user",
        kind: "filter",
        operation: "crop_square",
        params: {},
      },
    },
    {
      hasImageId: () => true,
      normalizeErrorMessage: (error) => String(error?.message || error),
    }
  );

  assert.deepEqual(result, {
    ok: false,
    imageId: "img-1",
    toolId: "tool-crop",
    outputPath: null,
    receiptStep: null,
    error: "Unsupported tool operation. Supported operations: grayscale, invert, sepia, brighten, contrast, polish, relight.",
  });
});

test("tool apply bridge: installs the event contract and emits success events", async () => {
  const windowObj = createWindowMock();
  const bridge = installToolApplyBridge({
    windowObj,
    CustomEventCtor: CustomEventMock,
    applyToolRuntimeEdit: async (request = {}) => ({
      ok: true,
      imageId: request.imageId || "img-1",
      toolId: request.tool?.id || "tool-gray",
      outputPath: "/tmp/out.png",
      receiptStep: {
        kind: "local_raster_edit",
        source: "tool_runtime",
        toolId: request.tool?.id || "tool-gray",
        toolName: request.tool?.name || "Gray",
        operation: request.tool?.operation || "grayscale",
        params: {
          intensity: 1,
        },
        outputPath: "/tmp/out.png",
        receiptPath: "/tmp/receipt.json",
      },
    }),
  });

  assert.equal(typeof windowObj.juggernautApplyTool, "function");
  assert.equal(windowObj.__juggernautApplyTool, windowObj.juggernautApplyTool);
  assert.equal(typeof bridge?.handler, "function");

  await bridge.handler(
    new CustomEventMock(TOOL_APPLY_BRIDGE_EVENT, {
      detail: {
        imageId: "img-9",
        tool: {
          id: "tool-gray",
          name: "Gray",
          operation: "grayscale",
        },
      },
    })
  );

  const lastEvent = windowObj.dispatched.at(-1);
  assert.equal(lastEvent.type, TOOL_APPLY_BRIDGE_SUCCESS_EVENT);
  assert.deepEqual(lastEvent.detail, {
    ok: true,
    imageId: "img-9",
    toolId: "tool-gray",
    outputPath: "/tmp/out.png",
    receiptStep: {
      kind: "local_raster_edit",
      source: "tool_runtime",
      toolId: "tool-gray",
      toolName: "Gray",
      operation: "grayscale",
      params: {
        intensity: 1,
      },
      outputPath: "/tmp/out.png",
      receiptPath: "/tmp/receipt.json",
    },
  });
  assert.equal(TOOL_APPLY_BRIDGE_EVENT, "juggernaut:apply-tool");
  assert.equal(TOOL_APPLY_BRIDGE_SUCCESS_EVENT, "juggernaut:tool-applied");
  assert.equal(TOOL_APPLY_BRIDGE_FAILURE_EVENT, "juggernaut:tool-apply-failed");
});

test("canvas app keeps a thin bridge into the runtime module", () => {
  assert.match(app, /import \{ applyToolRuntimeRequest, installToolApplyBridge \} from "\.\/tool_apply_runtime\.js"/);
  assert.match(app, /async function applyToolRuntimeEdit\(request = \{\}\)/);
  assert.match(app, /return applyToolRuntimeRequest\(request,\s*\{/);
  assert.match(app, /source:\s*"tool_runtime"/);
  assert.match(app, /replaceActive:\s*true/);
  assert.match(app, /installToolApplyBridge\(\{\s*windowObj:\s*window,\s*CustomEventCtor:\s*typeof CustomEvent === "function" \? CustomEvent : null,\s*applyToolRuntimeEdit,/s);
});

test("tool apply runtime: routes approved single-image capability requests through a provider-agnostic executor", async () => {
  const calls = [];
  const result = await applyToolRuntimeRequest(
    {
      contract: SINGLE_IMAGE_RAIL_CONTRACT,
      jobId: "cut_out",
      target: {
        activeImageId: "img-2",
        selectedImageIds: ["img-2"],
      },
      execution: {
        kind: "model_capability",
        capability: "subject_isolation",
      },
    },
    {
      getActiveImageId: () => "img-2",
      hasImageId: (imageId) => imageId === "img-2",
      getImageById: () => ({
        id: "img-2",
        path: "/tmp/source.png",
      }),
      getCapabilityAvailability: () => ({
        available: true,
      }),
      executeCapability: async (payload) => {
        calls.push(payload);
        return {
          imageId: "img-2",
          outputPath: "/tmp/cutout.png",
          receiptPath: "/tmp/cutout-receipt.json",
        };
      },
    }
  );

  assert.deepEqual(result, {
    ok: true,
    imageId: "img-2",
    toolId: "cut_out",
    outputPath: "/tmp/cutout.png",
    receiptStep: {
      kind: "model_capability_edit",
      source: "tool_runtime",
      jobId: "cut_out",
      toolId: "cut_out",
      toolName: "Cut Out",
      capability: "subject_isolation",
      outputPath: "/tmp/cutout.png",
      receiptPath: "/tmp/cutout-receipt.json",
    },
    jobId: "cut_out",
    capability: "subject_isolation",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].route.jobId, "cut_out");
  assert.equal(calls[0].route.capability, "subject_isolation");
  assert.deepEqual(calls[0].selection, {
    activeImageId: "img-2",
    selectedImageIds: ["img-2"],
  });
});

test("tool apply runtime: direct local-first affordances can execute through the existing local raster path", async () => {
  const invocation = buildSingleImageDirectAffordanceInvocation("polish", {
    activeImageId: "img-3",
    selectedImageIds: ["img-3"],
    requestId: "direct-local-3",
    params: {
      intensity: 0.8,
    },
  });

  const result = await applyToolRuntimeRequest(invocation, {
    getActiveImageId: () => "img-3",
    hasImageId: (imageId) => imageId === "img-3",
    getImageById: () => ({
      id: "img-3",
      path: "/tmp/source.png",
      img: {
        naturalWidth: 1,
        naturalHeight: 1,
      },
    }),
    createCanvas: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => {},
        getImageData: () => ({
          width: 1,
          height: 1,
          data: new Uint8ClampedArray([92, 110, 136, 255]),
        }),
        putImageData: () => {},
      }),
    }),
    saveCanvasArtifact: async () => ({
      imageId: "img-3",
      outputPath: "/tmp/polish.png",
      receiptPath: "/tmp/polish.json",
    }),
  });

  assert.deepEqual(result, {
    ok: true,
    imageId: "img-3",
    toolId: "polish",
    outputPath: "/tmp/polish.png",
    receiptStep: {
      kind: "local_raster_edit",
      source: "tool_runtime",
      toolId: "polish",
      toolName: "Polish",
      operation: "polish",
      params: {
        intensity: 0.8,
      },
      outputPath: "/tmp/polish.png",
      receiptPath: "/tmp/polish.json",
      capability: "image_polish",
      executionType: "local_first",
      routeProfile: "polish_local_first",
    },
  });
});

test("tool apply runtime: capability route returns shaped disabled failures without provider names", async () => {
  const result = await applyToolRuntimeRequest(
    {
      contract: SINGLE_IMAGE_RAIL_CONTRACT,
      jobId: "variants",
      target: {
        activeImageId: "img-5",
        selectedImageIds: ["img-5"],
      },
      execution: {
        kind: "model_capability",
        capability: "identity_preserving_variation",
      },
    },
    {
      getActiveImageId: () => "img-5",
      hasImageId: () => true,
      getImageById: () => ({
        id: "img-5",
        path: "/tmp/source.png",
      }),
      getExecutionMode: () => "local_only",
      normalizeErrorMessage: (error) => String(error?.message || error),
    }
  );

  assert.deepEqual(result, {
    ok: false,
    imageId: "img-5",
    toolId: "variants",
    outputPath: null,
    receiptStep: null,
    error: "Variants is unavailable in the current mode.",
    jobId: "variants",
    capability: "identity_preserving_variation",
    disabledReason: "unavailable_in_current_mode",
  });
  assert.doesNotMatch(JSON.stringify(result), /openai|gemini|flux|imagen/i);
});
