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
  assert.match(app, /const outPath = `\$\{state\.runDir\}\/export-\$\{stem\}-\$\{stamp\}\.psd`;/);
  assert.match(app, /const flattenedSourcePath = `\$\{state\.runDir\}\/export-\$\{stem\}-\$\{stamp\}\.flattened\.png`;/);
  assert.match(app, /const request = buildPsdExportRequest\(\{ outPath, flattenedSourcePath, composite \}\);/);
  assert.match(app, /await invoke\("export_run", \{ request \}\);/);
});
