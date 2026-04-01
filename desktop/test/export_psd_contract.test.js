import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CUE_EXPORT_ARCHITECTURE_HOOK_FORMATS,
  CUE_EXPORT_BASELINE_FORMATS,
  CUE_NATIVE_EXPORT_FORMATS,
  CUE_PSD_EXPORT_CONTRACT,
  CUE_RASTER_EXPORT_CONTRACT,
  buildCueExportArtifactLayout,
  cueExportContractForFormat,
  cueExportLimitationsForFormat,
  cueExportWriterIdForFormat,
} from "../src/juggernaut_export/contract.js";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

test("Export contract keeps PSD plus PNG as the baseline proof target and reserves AI or FIG hooks", () => {
  assert.deepEqual(CUE_EXPORT_BASELINE_FORMATS, ["psd", "png"]);
  assert.deepEqual(CUE_NATIVE_EXPORT_FORMATS, ["psd", "png", "jpg", "webp", "tiff"]);
  assert.deepEqual(CUE_EXPORT_ARCHITECTURE_HOOK_FORMATS, ["ai", "fig"]);
  assert.equal(cueExportContractForFormat("psd"), CUE_PSD_EXPORT_CONTRACT);
  assert.equal(cueExportContractForFormat("png"), CUE_RASTER_EXPORT_CONTRACT);
  assert.equal(cueExportWriterIdForFormat("psd"), "cue-psd-export-v1");
  assert.equal(cueExportWriterIdForFormat("jpg"), "cue-raster-export-v1");
});

test("Export artifact layout uses canonical run artifacts and receipts directories", () => {
  const layout = buildCueExportArtifactLayout({
    runDir: "/tmp/cue_runs/run-123",
    format: "png",
    stem: "Mono Hero",
    stamp: "20260401T111500",
  });
  assert.deepEqual(layout, {
    artifactsDir: "/tmp/cue_runs/run-123/artifacts",
    receiptsDir: "/tmp/cue_runs/run-123/receipts",
    flattenedSourcePath: "/tmp/cue_runs/run-123/artifacts/export-mono-hero-20260401T111500.flattened.png",
    artifactPath: "/tmp/cue_runs/run-123/artifacts/export-mono-hero-20260401T111500.png",
    receiptPath: "/tmp/cue_runs/run-123/receipts/receipt-export-mono-hero-20260401T111500.json",
  });
});

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

test("PSD export helper sanitizes source names into stable file stems", () => {
  const exportBaseStem = instantiateNamedFunction("exportBaseStem");
  globalThis.basename = (value) => {
    const parts = String(value || "").split(/[\\/]/);
    return parts[parts.length - 1] || "";
  };
  assert.equal(exportBaseStem("Hero Image.png"), "hero-image");
  assert.equal(exportBaseStem("  weird///Name!!.psd  "), "name");
  assert.equal(exportBaseStem(""), "canvas");
  delete globalThis.basename;
});

test("PSD export limitations explicitly call out flattened fidelity", () => {
  globalThis.cueExportLimitationsForFormat = cueExportLimitationsForFormat;
  const exportPsdLimitations = instantiateNamedFunction("exportPsdLimitations");
  try {
    const limitations = exportPsdLimitations();
    assert.ok(Array.isArray(limitations));
    assert.ok(limitations.some((entry) => /flattened/i.test(String(entry))));
    assert.ok(limitations.some((entry) => /css pixels/i.test(String(entry))));
  } finally {
    delete globalThis.cueExportLimitationsForFormat;
  }
});

test("Export helpers normalize raster aliases and filter extensions", () => {
  const normalizeExportFormat = instantiateNamedFunction("normalizeExportFormat");
  globalThis.normalizeExportFormat = normalizeExportFormat;
  try {
    const exportFormatFilterExtensions = instantiateNamedFunction("exportFormatFilterExtensions");
    assert.equal(normalizeExportFormat("jpeg"), "jpg");
    assert.equal(normalizeExportFormat("tif"), "tiff");
    assert.equal(normalizeExportFormat("webp"), "webp");
    assert.deepEqual(exportFormatFilterExtensions("jpg"), ["jpg", "jpeg"]);
    assert.deepEqual(exportFormatFilterExtensions("tiff"), ["tiff", "tif"]);
  } finally {
    delete globalThis.normalizeExportFormat;
  }
});

test("Export canvas writer creates the artifact directory before writing", async () => {
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

test("Export run invokes Tauri with a structured raster request", () => {
  assert.match(app, /async function exportRunInFormat\(format = "psd"\)/);
  assert.match(app, /const normalizedFormat = normalizeExportFormat\(format\);/);
  assert.match(app, /const outPath = await chooseExportDestinationPath\(\{[\s\S]*format: normalizedFormat,[\s\S]*suggestedStem: stem,[\s\S]*stamp,[\s\S]*\}\);/);
  assert.match(app, /const artifactLayout = buildCueExportArtifactLayout\(\{[\s\S]*runDir: state\.runDir,[\s\S]*format: normalizedFormat,[\s\S]*stem,[\s\S]*stamp,[\s\S]*\}\);/);
  assert.match(app, /const flattenedSourcePath = String\(artifactLayout\?\.flattenedSourcePath \|\| ""\)\.trim\(\);/);
  assert.match(app, /const request = buildPsdExportRequest\(\{[\s\S]*outPath,[\s\S]*flattenedSourcePath,[\s\S]*composite,[\s\S]*format: normalizedFormat,[\s\S]*\}\);/);
  assert.match(app, /await invoke\("export_run", \{ request \}\);/);
  assert.match(app, /async function exportRun\(\) \{\s*return exportRunInFormat\("psd"\);\s*\}/);
  assert.match(app, /async function exportRunPng\(\) \{\s*return exportRunInFormat\("png"\);\s*\}/);
  assert.match(app, /async function exportRunJpg\(\) \{\s*return exportRunInFormat\("jpg"\);\s*\}/);
  assert.match(app, /async function exportRunWebp\(\) \{\s*return exportRunInFormat\("webp"\);\s*\}/);
  assert.match(app, /async function exportRunTiff\(\) \{\s*return exportRunInFormat\("tiff"\);\s*\}/);
});

test("Export prompts for a save path so the user can rename the file across raster formats", () => {
  assert.match(app, /const suggestedName = `export-\$\{exportBaseStem\(suggestedStem\)\}-\$\{String\(stamp \|\| exportTimestampTag\(\)\)\}\$\{extension\}`;/);
  assert.match(app, /const extension = exportFormatExtension\(normalizedFormat\);/);
  assert.match(app, /const label = exportFormatLabel\(normalizedFormat\);/);
  assert.match(app, /const picked = await save\(\{[\s\S]*defaultPath,[\s\S]*filters: \[\{ name: label, extensions: exportFormatFilterExtensions\(normalizedFormat\) \}\],[\s\S]*\}\);/);
  assert.match(app, /const normalizedPath = normalizeExportPathExtension\(selectedPath,\s*extension\);/);
});
