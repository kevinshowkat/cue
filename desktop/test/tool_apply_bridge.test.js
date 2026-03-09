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
    error: "Unsupported tool operation. Supported operations: grayscale, invert, sepia, brighten, contrast.",
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
