import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { JUGGERNAUT_PSD_EXPORT_LIMITATIONS } from "../src/juggernaut_export/contract.js";
import { applyToolRuntimeRequest } from "../src/tool_apply_runtime.js";
import { buildToolInvocation, createInSessionToolRegistry } from "../src/tool_runtime.js";

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, "..", "src", "index.html");
const appPath = join(here, "..", "src", "canvas_app.js");
const html = readFileSync(htmlPath, "utf8");
const app = readFileSync(appPath, "utf8");

function loadNamedFunction(name) {
  const pattern = new RegExp(
    `function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n\\n(?:async\\s+)?function\\s+`,
    "m"
  );
  const match = app.match(pattern);
  assert.ok(match, `${name} function not found`);
  const source = match[0].replace(/\n\n(?:async\s+)?function\s+[\s\S]*$/, "").trim();
  return new Function(`return (${source});`)();
}

test("Juggernaut launch slice: upload, custom tool creation, local apply, and PSD export stay wired together", async () => {
  assert.match(html, /id="drop-hint"/);
  assert.match(html, /id="create-tool-panel"/);
  assert.match(html, /id="juggernaut-export-psd"/);

  const registry = createInSessionToolRegistry();
  const manifest = registry.createFromDescription({
    name: "Mono Hero",
    description: "make this black and white with a dramatic punch",
  });
  const invocation = buildToolInvocation(manifest, {
    activeImageId: "img-1",
    selectedImageIds: ["img-1"],
    source: "test",
    trigger: "test",
    requestId: "launch-flow-1",
  });

  assert.equal(registry.size(), 1);
  assert.equal(manifest.execution.kind, "local_edit");
  assert.equal(invocation.execution.operation, "grayscale");
  assert.equal(invocation.target.activeImageId, "img-1");

  const saved = [];
  const applyResult = await applyToolRuntimeRequest(
    {
      imageId: invocation.target.activeImageId,
      tool: {
        id: manifest.toolId,
        name: manifest.label,
        source: "user_generated",
        kind: "filter",
        operation: invocation.execution.operation,
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
        path: "/tmp/input.png",
        receiptPath: "/tmp/input-receipt.json",
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
            data: new Uint8ClampedArray([120, 100, 90, 255]),
          }),
          putImageData: () => {},
        }),
      }),
      saveCanvasArtifact: async (_canvas, options) => {
        saved.push(options);
        return {
          imageId: "img-1",
          outputPath: "/tmp/output.png",
          receiptPath: "/tmp/output-receipt.json",
        };
      },
    }
  );

  assert.equal(applyResult.ok, true);
  assert.equal(applyResult.imageId, "img-1");
  assert.equal(applyResult.outputPath, "/tmp/output.png");
  assert.equal(saved.length, 1);
  assert.equal(saved[0].replaceActive, true);
  assert.equal(saved[0].meta.source, "tool_runtime");

  const buildPsdExportRequest = loadNamedFunction("buildPsdExportRequest");
  const previousGlobals = {
    collectExportTimelineNodes: globalThis.collectExportTimelineNodes,
    state: globalThis.state,
    getVisibleActiveId: globalThis.getVisibleActiveId,
    exportPsdLimitations: globalThis.exportPsdLimitations,
  };

  globalThis.collectExportTimelineNodes = () => [
    {
      id: "node-1",
      action: manifest.label,
    },
  ];
  globalThis.state = {
    runDir: "/tmp/juggernaut-run",
    canvasMode: "multi",
  };
  globalThis.getVisibleActiveId = () => "img-1";
  globalThis.exportPsdLimitations = () => [...JUGGERNAUT_PSD_EXPORT_LIMITATIONS];

  try {
    const request = buildPsdExportRequest({
      outPath: "/tmp/juggernaut-run/export-mono-hero.psd",
      flattenedSourcePath: "/tmp/juggernaut-run/export-mono-hero.flattened.png",
      composite: {
        width: 1,
        height: 1,
        boundsCss: {
          x: 0,
          y: 0,
          w: 1,
          h: 1,
        },
        sourceImages: [
          {
            id: "img-1",
            path: "/tmp/output.png",
            receiptPath: "/tmp/output-receipt.json",
            label: "Mono Hero",
          },
        ],
      },
    });

    assert.equal(request.format, "psd");
    assert.equal(request.runDir, "/tmp/juggernaut-run");
    assert.equal(request.activeImageId, "img-1");
    assert.equal(request.flattenedSourcePath, "/tmp/juggernaut-run/export-mono-hero.flattened.png");
    assert.deepEqual(request.actionSequence, [manifest.label]);
    assert.equal(request.sourceImages[0].receiptPath, "/tmp/output-receipt.json");
    assert.ok(Array.isArray(request.limitations));
    assert.ok(request.limitations.length > 0);
  } finally {
    globalThis.collectExportTimelineNodes = previousGlobals.collectExportTimelineNodes;
    globalThis.state = previousGlobals.state;
    globalThis.getVisibleActiveId = previousGlobals.getVisibleActiveId;
    globalThis.exportPsdLimitations = previousGlobals.exportPsdLimitations;
  }
});
