import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const cssPath = join(here, "..", "src", "styles.css");
const visualSystemCssPath = join(here, "..", "src", "juggernaut_shell", "visual_system.css");
const railPath = join(here, "..", "src", "juggernaut_shell", "rail.js");
const app = readFileSync(appPath, "utf8");
const css = readFileSync(cssPath, "utf8");
const visualSystemCss = readFileSync(visualSystemCssPath, "utf8");
const rail = readFileSync(railPath, "utf8");

test("Juggernaut rail: depressed class is applied only when an action is actively running", () => {
  assert.match(app, /const runningKey = currentRunningActionKey\(\);/);
  assert.match(rail, /toolEl\.classList\.toggle\("depressed", Boolean\(button\.running\)\);/);
});

test("Juggernaut rail keeps local-first actions out of local-utility styling", () => {
  assert.match(rail, /toolEl\.classList\.toggle\("is-local-utility", button\.provenance === ACTION_PROVENANCE\.LOCAL_ONLY\);/);
  assert.match(app, /const isLocalOnly = provenance === ACTION_PROVENANCE\.LOCAL_ONLY;/);
  assert.match(app, /btn\.classList\.toggle\("is-local-utility", isLocalOnly\);/);
});

test("Action Grid: currentRunningActionKey maps pending actions to a single depressed key", () => {
  for (const key of [
    "pendingBlend",
    "pendingBridge",
    "pendingSwapDna",
    "pendingExtractRule",
    "pendingOddOneOut",
    "pendingTriforce",
  ]) {
    assert.match(app, new RegExp(`state\\.${key}`));
  }
});

test("Action Grid: local actions use runningActionKey so depressed state shows while running", () => {
  assert.match(app, /runningActionKey:\s*null/);
  assert.match(app, /if\s*\(state\.runningActionKey\)\s*return\s*state\.runningActionKey/);
  assert.match(app, /beginRunningAction\(\"bg\"\)/);
  assert.match(app, /clearRunningAction\(\"bg\"\)/);
});

test("CSS: depressed state has a down/pressed transform", () => {
  assert.match(css, /\.tool\.depressed\s*\{/);
  assert.match(css, /transform:\s*translate3d\(0,\s*2px,\s*0\)/);
});

test("Juggernaut rail selected state reads as a pressed-in active button", () => {
  assert.match(css, /\.juggernaut-tool\.juggernaut-rail-anchor\.selected,\s*\.juggernaut-tool\.is-local-utility\.selected\s*\{/);
  assert.match(css, /transform:\s*translate3d\(0,\s*2px,\s*0\)\s*scale\(0\.982\)/);
  assert.match(css, /inset 0 2px 8px rgba\(5,\s*9,\s*14,\s*0\.58\)/);
  assert.match(css, /\.juggernaut-tool\.juggernaut-rail-anchor\.selected \.tool-icon,\s*\.juggernaut-tool\.is-local-utility\.selected \.tool-icon\s*\{/);
});

test("Juggernaut rail hover and click keep selected tools visibly pressed", () => {
  assert.match(
    css,
    /\.juggernaut-tool\.juggernaut-rail-anchor:active,\s*\.juggernaut-tool\.is-local-utility:active,\s*\.juggernaut-tool\.juggernaut-rail-anchor\.is-pressing,\s*\.juggernaut-tool\.is-local-utility\.is-pressing,\s*\.juggernaut-tool\.juggernaut-rail-anchor\.selected:hover,\s*\.juggernaut-tool\.is-local-utility\.selected:hover\s*\{/
  );
  assert.match(css, /transform:\s*translate3d\(0,\s*3px,\s*0\)\s*scale\(0\.976\)/);
  assert.match(
    css,
    /\.juggernaut-tool\.juggernaut-rail-anchor:active \.tool-icon,\s*\.juggernaut-tool\.is-local-utility:active \.tool-icon,\s*\.juggernaut-tool\.juggernaut-rail-anchor\.is-pressing \.tool-icon,\s*\.juggernaut-tool\.is-local-utility\.is-pressing \.tool-icon,\s*\.juggernaut-tool\.juggernaut-rail-anchor\.selected:hover \.tool-icon,\s*\.juggernaut-tool\.is-local-utility\.selected:hover \.tool-icon\s*\{/
  );
});

test("Juggernaut rail selected active-request state keeps the pressed treatment", () => {
  assert.match(
    css,
    /\.juggernaut-tool\.juggernaut-rail-anchor\.selected\.is-active-request,\s*\.juggernaut-tool\.is-local-utility\.selected\.is-active-request,\s*\.juggernaut-tool\.juggernaut-rail-anchor\.selected\.is-active-request:hover,\s*\.juggernaut-tool\.is-local-utility\.selected\.is-active-request:hover,\s*\.juggernaut-tool\.juggernaut-rail-anchor\.is-pressing\.is-active-request,\s*\.juggernaut-tool\.is-local-utility\.is-pressing\.is-active-request\s*\{/
  );
  assert.match(css, /transform:\s*translate3d\(0,\s*3px,\s*0\)\s*scale\(0\.976\)/);
  assert.match(
    css,
    /\.juggernaut-tool\.juggernaut-rail-anchor\.selected\.is-active-request \.tool-icon,\s*\.juggernaut-tool\.is-local-utility\.selected\.is-active-request \.tool-icon,\s*\.juggernaut-tool\.juggernaut-rail-anchor\.selected\.is-active-request:hover \.tool-icon,\s*\.juggernaut-tool\.is-local-utility\.selected\.is-active-request:hover \.tool-icon,\s*\.juggernaut-tool\.juggernaut-rail-anchor\.is-pressing\.is-active-request \.tool-icon,\s*\.juggernaut-tool\.is-local-utility\.is-pressing\.is-active-request \.tool-icon\s*\{/
  );
});

test("Juggernaut shell rail hover styling does not override selected or pressed buttons", () => {
  assert.match(
    visualSystemCss,
    /body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button:hover:not\(:disabled\):not\(\.selected\):not\(\.is-active-request\):not\(\.is-pressing\):not\(\.depressed\)\s*\{/
  );
});

test("Juggernaut shell rail selected hover keeps a light-shell pressed treatment", () => {
  assert.match(
    visualSystemCss,
    /body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.selected,\s*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.selected:hover,\s*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.is-active-request,\s*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.is-active-request:hover,\s*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.is-pressing\s*\{/
  );
  assert.match(visualSystemCss, /filter:\s*none;/);
  assert.match(visualSystemCss, /transform:\s*translate3d\(0,\s*1px,\s*0\)/);
});

test("Model-backed blue buttons use flat fills without blue gradients or glow", () => {
  assert.match(css, /\.tool\.has-action-provenance\s*\{[\s\S]*background:\s*rgba\(53,\s*104,\s*235,\s*0\.98\);[\s\S]*box-shadow:\s*none;/);
  assert.match(css, /\.session-tab-strip-action\.has-action-provenance\s*\{[\s\S]*background:\s*rgba\(53,\s*104,\s*235,\s*0\.98\);/);
  assert.match(
    visualSystemCss,
    /\.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance\s*\{[\s\S]*background:\s*rgba\(53,\s*104,\s*235,\s*0\.98\);[\s\S]*box-shadow:\s*none;/
  );
});

test("Model-backed blue buttons keep a visible inactive state when unavailable", () => {
  assert.match(css, /\.tool\.has-action-provenance:disabled,\s*\.session-tab-strip-action\.has-action-provenance:disabled,\s*\.session-tab-runtime-action\.has-action-provenance:disabled\s*\{[\s\S]*background:\s*rgba\(53,\s*104,\s*235,\s*0\.72\);[\s\S]*opacity:\s*1;/);
  assert.match(
    visualSystemCss,
    /\.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance:disabled\s*\{[\s\S]*background:\s*rgba\(53,\s*104,\s*235,\s*0\.72\);[\s\S]*opacity:\s*1;/
  );
  assert.match(visualSystemCss, /\.juggernaut-tool-rail \.tool\.has-action-provenance\.is-selection-empty,\s*$/m);
  assert.match(visualSystemCss, /\.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance\.is-selection-empty\s*\{[\s\S]*opacity:\s*1;/);
});
