import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, "..", "src", "index.html");
const appPath = join(here, "..", "src", "canvas_app.js");
const artifactEventsPath = join(here, "..", "src", "app", "event_handlers", "artifact_events.js");
const html = readFileSync(htmlPath, "utf8");
const app = readFileSync(appPath, "utf8");
const artifactEventsSource = readFileSync(artifactEventsPath, "utf8");

test("Prompt Generate modal is present in index markup", () => {
  assert.match(html, /id="prompt-generate-panel"/);
  assert.match(html, /id="prompt-generate-model"/);
  assert.match(html, /id="prompt-generate-text"/);
  assert.match(html, /id="prompt-generate-send"/);
});

test("Prompt Generate skill remains wired into the modal/runtime path after the Juggernaut rail split", () => {
  assert.match(app, /showPromptGeneratePanel\(\)/);
  assert.match(app, /async function runPromptGenerate\(/);
  assert.match(app, /state\.pendingPromptGenerate/);
  assert.match(app, /function currentPromptGenerateAnchorCss\(/);
  assert.match(app, /function renderPromptGeneratePlaceholder\(/);
  assert.match(artifactEventsSource, /seedPromptGeneratePlacementRectCss\(id, promptGenerate\)/);
  assert.match(app, /state\.promptGenerateDraftAnchor/);
  assert.match(app, /anchorCss:\s*resolvedAnchorCss/);
  assert.match(app, /anchorWorldCss:\s*resolvedAnchorWorldCss/);
  assert.match(app, /anchorCss:\s*draftAnchor\?\.anchorCss/);
  assert.match(app, /anchorWorldCss:\s*draftAnchor\?\.anchorWorldCss/);
  assert.doesNotMatch(html, /prompt_generate/);
});

test("Prompt Generate normalizes edit-style prompts to standalone generation", () => {
  assert.match(app, /function normalizePromptGeneratePrompt\(/);
  assert.match(app, /generate a brand-new image from text only:/);
});

test("Prompt Generate stays outside disabled auto-accept suggested-ability flows", () => {
  assert.match(app, /const autoAcceptSuggestedAbilityToggle = document\.getElementById\("auto-accept-suggested-ability-toggle"\);/);
  assert.match(app, /autoAcceptSuggestedAbilityToggle\.checked = false;/);
  assert.match(app, /autoAcceptSuggestedAbilityToggle\.disabled = true;/);
  assert.match(app, /localStorage\.removeItem\("cue\.autoAcceptSuggestedAbility"\);/);
  assert.match(app, /localStorage\.removeItem\("brood\.autoAcceptSuggestedAbility"\);/);
});
