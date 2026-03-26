import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
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

test("PSD export helper sanitizes source names into stable file stems", () => {
  const exportBaseStem = loadNamedFunction("exportBaseStem");
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
  const exportPsdLimitations = loadNamedFunction("exportPsdLimitations");
  const limitations = exportPsdLimitations();
  assert.ok(Array.isArray(limitations));
  assert.ok(limitations.some((entry) => /flattened/i.test(String(entry))));
  assert.ok(limitations.some((entry) => /css pixels/i.test(String(entry))));
});

test("Export helpers normalize raster aliases and filter extensions", () => {
  const normalizeExportFormat = loadNamedFunction("normalizeExportFormat");
  globalThis.normalizeExportFormat = normalizeExportFormat;
  try {
    const exportFormatFilterExtensions = loadNamedFunction("exportFormatFilterExtensions");
    assert.equal(normalizeExportFormat("jpeg"), "jpg");
    assert.equal(normalizeExportFormat("tif"), "tiff");
    assert.equal(normalizeExportFormat("webp"), "webp");
    assert.deepEqual(exportFormatFilterExtensions("jpg"), ["jpg", "jpeg"]);
    assert.deepEqual(exportFormatFilterExtensions("tiff"), ["tiff", "tif"]);
  } finally {
    delete globalThis.normalizeExportFormat;
  }
});

test("Export run invokes Tauri with a structured raster request", () => {
  assert.match(app, /async function exportRunInFormat\(format = "psd"\)/);
  assert.match(app, /const normalizedFormat = normalizeExportFormat\(format\);/);
  assert.match(app, /const outPath = await chooseExportDestinationPath\(\{[\s\S]*format: normalizedFormat,[\s\S]*suggestedStem: stem,[\s\S]*stamp,[\s\S]*\}\);/);
  assert.match(app, /const flattenedSourcePath =[\s\S]*join\(state\.runDir,\s*`export-\$\{stem\}-\$\{stamp\}\.flattened\.png`\)/);
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
