import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(here, "..", "src", "canvas_app.js"), "utf8");

test("Runtime minimalism hides idle engine status unless diagnostics are enabled or an error occurs", () => {
  assert.match(
    app,
    /function runtimeChromeShouldShowEngineStatus\(\)\s*\{\s*return runtimeChromeVisibilitySnapshot\(\)\.diagnosticsVisible \|\| Boolean\(state\.lastStatusError\);\s*\}/
  );
  assert.match(app, /els\.engineStatus\.classList\.toggle\("hidden", !showEngineStatus\);/);
});

test("Runtime minimalism hides the shell selection readout until diagnostics are enabled or images exist", () => {
  assert.match(
    app,
    /function runtimeChromeShouldShowSelectionStatus\(\)\s*\{\s*return runtimeChromeVisibilitySnapshot\(\)\.diagnosticsVisible \|\| \(Number\(state\.images\?\.length\) \|\| 0\) > 0;\s*\}/
  );
  assert.match(app, /els\.juggernautSelectionStatus\.classList\.toggle\("hidden", !showSelectionStatus\);/);
});

test("Runtime minimalism keeps the empty-state upload tool from pulsing", () => {
  const fnMatch = app.match(/function renderJuggernautShellChrome\(\)[\s\S]*?\n}\n\nasync function invokeJuggernautShellTool/);
  assert.ok(fnMatch, "renderJuggernautShellChrome function not found");
  assert.doesNotMatch(fnMatch[0], /classList\.toggle\("pulse"/);
});
