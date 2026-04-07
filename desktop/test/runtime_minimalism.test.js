import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(here, "..", "src", "canvas_app.js"), "utf8");
const shellChromeRenderer = readFileSync(join(here, "..", "src", "app", "shell_chrome_renderer.js"), "utf8");
const visualSystemCss = readFileSync(join(here, "..", "src", "juggernaut_shell", "visual_system.css"), "utf8");

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
  const fnMatch = shellChromeRenderer.match(/export function renderJuggernautShellChrome\(host = \{\}\)[\s\S]*?\n}\n\nexport function renderCommunicationChrome/);
  assert.ok(fnMatch, "renderJuggernautShellChrome function not found");
  assert.doesNotMatch(fnMatch[0], /classList\.toggle\("pulse"/);
});

test("Runtime minimalism keeps the upload tool on standard local-button styling even on an empty canvas", () => {
  assert.match(shellChromeRenderer, /const emptyCanvas = state\.images\.length === 0;/);
  assert.doesNotMatch(shellChromeRenderer, /btn\.classList\.toggle\("is-empty-canvas-cue", key === "upload" && emptyCanvas\);/);
  assert.doesNotMatch(visualSystemCss, /@keyframes juggernautUploadGoldShimmer/);
  assert.doesNotMatch(
    visualSystemCss,
    /body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.is-empty-canvas-cue\[data-tool-id="upload"\]\s*\{/
  );
});
