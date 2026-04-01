import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CUE_EXPORT_ARCHITECTURE_HOOK_FORMATS,
  CUE_EXPORT_BASELINE_FORMATS,
  CUE_EXPORT_RASTER_FORMATS,
  buildCueExportArtifactLayout,
  cueExportLimitationsForFormat,
} from "../src/juggernaut_export/contract.js";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

function loadNamedFunction(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => app.indexOf(marker))
    .find((index) => index >= 0);
  assert.notEqual(start, undefined, `${name} function not found`);
  const signatureStart = app.indexOf("(", start);
  assert.notEqual(signatureStart, -1, `Could not find signature for ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth === 0 && char === "{") {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `Could not find body for ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return app.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract function ${name}`);
}

function instantiateNamedFunction(name, deps = {}) {
  const source = loadNamedFunction(name);
  const keys = Object.keys(deps);
  const values = Object.values(deps);
  return new Function(...keys, `return (${source});`)(...values);
}

test("Raster proof keeps PNG in the baseline while AI and FIG stay hidden architecture hooks", () => {
  assert.deepEqual(CUE_EXPORT_BASELINE_FORMATS, ["psd", "png"]);
  assert.deepEqual(CUE_EXPORT_RASTER_FORMATS, ["png", "jpg", "webp", "tiff"]);
  assert.deepEqual(CUE_EXPORT_ARCHITECTURE_HOOK_FORMATS, ["ai", "fig"]);
});

test("Raster artifact layout uses canonical run artifacts and receipts directories", () => {
  const layout = buildCueExportArtifactLayout({
    runDir: "/tmp/cue_runs/run-raster",
    format: "webp",
    stem: "HUD Polish",
    stamp: "20260401T121530",
  });
  assert.deepEqual(layout, {
    artifactsDir: "/tmp/cue_runs/run-raster/artifacts",
    receiptsDir: "/tmp/cue_runs/run-raster/receipts",
    flattenedSourcePath: "/tmp/cue_runs/run-raster/artifacts/export-hud-polish-20260401T121530.flattened.png",
    artifactPath: "/tmp/cue_runs/run-raster/artifacts/export-hud-polish-20260401T121530.webp",
    receiptPath: "/tmp/cue_runs/run-raster/receipts/receipt-export-hud-polish-20260401T121530.json",
  });
});

test("Raster limitations explicitly call out flattened output across supported formats", () => {
  for (const format of CUE_EXPORT_RASTER_FORMATS) {
    const limitations = cueExportLimitationsForFormat(format);
    assert.ok(Array.isArray(limitations), `${format} limitations should be an array`);
    assert.ok(
      limitations.some((entry) => /flattened/i.test(String(entry))),
      `${format} limitations should mention flattened output`
    );
  }
});

test("Raster export routes through the shared exportRunInFormat path", () => {
  assert.match(app, /const artifactLayout = buildCueExportArtifactLayout\(\{[\s\S]*runDir: state\.runDir,[\s\S]*format: normalizedFormat,[\s\S]*stem,[\s\S]*stamp,[\s\S]*\}\);/);
  assert.match(app, /const flattenedSourcePath = String\(artifactLayout\?\.flattenedSourcePath \|\| ""\)\.trim\(\);/);
  assert.match(app, /const request = buildPsdExportRequest\(\{[\s\S]*outPath,[\s\S]*flattenedSourcePath,[\s\S]*composite,[\s\S]*format: normalizedFormat,[\s\S]*\}\);/);
  assert.match(app, /async function exportRunPng\(\) \{\s*return exportRunInFormat\("png"\);\s*\}/);
  assert.match(app, /async function exportRunJpg\(\) \{\s*return exportRunInFormat\("jpg"\);\s*\}/);
  assert.match(app, /async function exportRunWebp\(\) \{\s*return exportRunInFormat\("webp"\);\s*\}/);
  assert.match(app, /async function exportRunTiff\(\) \{\s*return exportRunInFormat\("tiff"\);\s*\}/);
});

test("Flattened raster source writer creates the artifact directory before writing", async () => {
  const calls = [];
  const writeCanvasPngToPath = instantiateNamedFunction("writeCanvasPngToPath", {
    dirname: async (value) => {
      calls.push(["dirname", value]);
      return "/tmp/cue-run/artifacts";
    },
    createDir: async (path, options) => {
      calls.push(["createDir", path, options]);
    },
    writeBinaryFile: async (path, bytes) => {
      calls.push(["writeBinaryFile", path, Array.from(bytes)]);
    },
  });
  const canvas = {
    toBlob(resolve, type) {
      calls.push(["toBlob", type]);
      resolve({
        async arrayBuffer() {
          return Uint8Array.from([1, 2, 3]).buffer;
        },
      });
    },
  };

  const outPath = "/tmp/cue-run/artifacts/export-canvas.flattened.png";
  const result = await writeCanvasPngToPath(canvas, outPath);

  assert.equal(result, outPath);
  assert.deepEqual(calls, [
    ["dirname", outPath],
    ["createDir", "/tmp/cue-run/artifacts", { recursive: true }],
    ["toBlob", "image/png"],
    ["writeBinaryFile", outPath, [1, 2, 3]],
  ]);
});
