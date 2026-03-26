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

test("Export run invokes Tauri with a structured PSD request", () => {
  assert.match(app, /const outPath = await chooseExportDestinationPath\(\{[\s\S]*format: "psd",[\s\S]*suggestedStem: stem,[\s\S]*stamp,[\s\S]*\}\);/);
  assert.match(app, /const flattenedSourcePath =[\s\S]*join\(state\.runDir,\s*`export-\$\{stem\}-\$\{stamp\}\.flattened\.png`\)/);
  assert.match(app, /const request = buildPsdExportRequest\(\{ outPath, flattenedSourcePath, composite \}\);/);
  assert.match(app, /await invoke\("export_run", \{ request \}\);/);
});

test("Export prompts for a save path so the user can rename the file and keeps PNG receipts beside it", () => {
  assert.match(app, /const suggestedName = `export-\$\{exportBaseStem\(suggestedStem\)\}-\$\{String\(stamp \|\| exportTimestampTag\(\)\)\}\$\{extension\}`;/);
  assert.match(app, /const picked = await save\(\{[\s\S]*defaultPath,[\s\S]*filters: \[\{ name: label, extensions: \[extension\.replace\("\.", ""\)\] \}\],[\s\S]*\}\);/);
  assert.match(app, /const normalizedPath = normalizeExportPathExtension\(selectedPath,\s*extension\);/);
  assert.match(app, /const outPath = await chooseExportDestinationPath\(\{[\s\S]*format: "png",[\s\S]*suggestedStem: stem,[\s\S]*stamp,[\s\S]*\}\);/);
  assert.match(app, /const exportDir = typeof dirname === "function" \? await dirname\(outPath\)\.catch\(\(\) => ""\) : "";/);
  assert.match(app, /outputDir: exportDir \|\| state\.runDir/);
});
