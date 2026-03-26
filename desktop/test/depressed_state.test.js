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
  assert.match(css, /inset 0 3px 10px rgba\(167,\s*176,\s*187,\s*0\.34\)/);
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

test("Local-only buttons use the original neutral fills with black icon and label treatment", () => {
  assert.match(
    css,
    /\.tool\[data-provenance="local_only"\]:not\(\.juggernaut-tool\)\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(252,\s*253,\s*254,\s*0\.99\),\s*rgba\(241,\s*244,\s*248,\s*0\.98\)\),[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);[\s\S]*box-shadow:\s*inset 0 1px 0 rgba\(255,\s*255,\s*255,\s*0\.98\);/
  );
  assert.match(
    css,
    /\.tool\[data-provenance="local_only"\]:not\(\.juggernaut-tool\) \.tool-hint,\s*\.tool\[data-provenance="local_only"\]:not\(\.juggernaut-tool\) \.tool-label\s*\{[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);/
  );
  assert.match(
    visualSystemCss,
    /\.juggernaut-tool-rail \.juggernaut-rail-button\.is-local-utility\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*0\.98\),\s*rgba\(250,\s*251,\s*253,\s*0\.88\)\s*44%\),[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);[\s\S]*box-shadow:\s*inset 0 1px 0 rgba\(255,\s*255,\s*255,\s*1\),[\s\S]*inset 0 -10px 18px rgba\(220,\s*225,\s*232,\s*0\.22\);/
  );
  assert.match(
    css,
    /\.juggernaut-tool\.juggernaut-rail-anchor,\s*\.juggernaut-tool\.is-local-utility\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(252,\s*253,\s*254,\s*0\.99\),\s*rgba\(241,\s*244,\s*248,\s*0\.98\)\),[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);/
  );
});

test("Local-only buttons keep a visible inactive neutral state and darker pressed state", () => {
  assert.match(
    css,
    /\.tool\[data-provenance="local_only"\]:not\(\.juggernaut-tool\):disabled\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(252,\s*253,\s*254,\s*0\.99\),\s*rgba\(244,\s*247,\s*250,\s*0\.98\)\),[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.5\);/
  );
  assert.match(
    css,
    /\.tool\[data-provenance="local_only"\]:not\(\.juggernaut-tool\)\.selected,\s*\.tool\[data-provenance="local_only"\]:not\(\.juggernaut-tool\)\.selected:hover,\s*\.tool\[data-provenance="local_only"\]:not\(\.juggernaut-tool\):active,\s*\.tool\[data-provenance="local_only"\]:not\(\.juggernaut-tool\)\.is-active-request\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(244,\s*247,\s*250,\s*0\.99\),\s*rgba\(232,\s*237,\s*243,\s*0\.97\)\),[\s\S]*inset 0 3px 10px rgba\(167,\s*176,\s*187,\s*0\.34\)/
  );
  assert.match(
    css,
    /\.tool\[data-provenance="local_only"\]:not\(\.juggernaut-tool\)\.depressed\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(233,\s*238,\s*244,\s*0\.99\),\s*rgba\(221,\s*227,\s*234,\s*0\.98\)\),[\s\S]*inset 0 4px 12px rgba\(146,\s*156,\s*169,\s*0\.42\)/
  );
  assert.match(
    visualSystemCss,
    /\.juggernaut-tool-rail \.juggernaut-rail-button\.is-local-utility:disabled\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(249,\s*250,\s*252,\s*0\.98\),\s*rgba\(242,\s*245,\s*248,\s*0\.96\)\),[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.5\);/
  );
  assert.match(
    visualSystemCss,
    /\.juggernaut-tool-rail \.juggernaut-rail-button\.is-local-utility\.selected,\s*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.is-local-utility\.selected:hover,\s*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.is-local-utility\.is-active-request,\s*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.is-local-utility\.is-active-request:hover,\s*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.is-local-utility\.is-pressing\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(247,\s*249,\s*252,\s*0\.98\),\s*rgba\(238,\s*242,\s*247,\s*0\.92\)\s*44%\),[\s\S]*inset 0 2px 6px rgba\(216,\s*223,\s*231,\s*0\.78\)/
  );
  assert.match(
    visualSystemCss,
    /\.juggernaut-tool-rail \.juggernaut-rail-button\.is-local-utility\.depressed\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(233,\s*238,\s*244,\s*0\.99\),\s*rgba\(221,\s*227,\s*234,\s*0\.98\)\),[\s\S]*inset 0 4px 12px rgba\(146,\s*156,\s*169,\s*0\.42\)/
  );
  assert.match(
    css,
    /\.juggernaut-tool\.juggernaut-rail-anchor\.is-selection-empty,\s*\.juggernaut-tool\.is-local-utility\.is-selection-empty\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(252,\s*253,\s*254,\s*0\.99\),\s*rgba\(244,\s*247,\s*250,\s*0\.98\)\),[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.5\);/
  );
});

test("Model-backed external-call buttons use flat taupe fills without gradients or glow", () => {
  assert.match(css, /\.tool\.has-action-provenance\s*\{[\s\S]*background:\s*rgba\(204,\s*185,\s*180,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);[\s\S]*box-shadow:\s*none;/);
  assert.match(css, /\.session-tab-strip-action\.has-action-provenance\s*\{[\s\S]*background:\s*rgba\(204,\s*185,\s*180,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);/);
  assert.match(
    visualSystemCss,
    /\.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance\s*\{[\s\S]*background:\s*rgba\(204,\s*185,\s*180,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);[\s\S]*box-shadow:\s*none;/
  );
  assert.match(css, /\.tool\.has-action-provenance \.tool-hint,\s*\.tool\.has-action-provenance \.tool-label\s*\{[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);/);
  assert.match(visualSystemCss, /\.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance \.tool-icon,\s*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance \.tool-hint,\s*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance \.tool-label\s*\{[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);/);
});

test("Model-backed external-call buttons keep a visible inactive state when unavailable", () => {
  assert.match(css, /\.tool\.has-action-provenance:disabled,\s*\.session-tab-strip-action\.has-action-provenance:disabled,\s*\.session-tab-runtime-action\.has-action-provenance:disabled\s*\{[\s\S]*background:\s*rgba\(224,\s*214,\s*211,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.5\);[\s\S]*opacity:\s*1;/);
  assert.match(
    visualSystemCss,
    /\.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance:disabled\s*\{[\s\S]*background:\s*rgba\(224,\s*214,\s*211,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.5\);[\s\S]*opacity:\s*1;/
  );
  assert.match(visualSystemCss, /\.juggernaut-tool-rail \.tool\.has-action-provenance\.is-selection-empty,\s*$/m);
  assert.match(visualSystemCss, /\.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance\.is-selection-empty\s*\{[\s\S]*background:\s*rgba\(224,\s*214,\s*211,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.5\);/);
  assert.match(css, /\.tool\.has-action-provenance:disabled \.tool-icon,\s*\.tool\.has-action-provenance:disabled \.tool-hint,\s*\.tool\.has-action-provenance:disabled \.tool-label,[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.5\);/);
});

test("Model-backed external-call buttons darken and recess when active", () => {
  assert.match(
    css,
    /\.tool\.has-action-provenance\.selected,\s*\.tool\.has-action-provenance\.selected:hover,\s*\.tool\.has-action-provenance:active\s*\{[\s\S]*background:\s*rgba\(170,\s*149,\s*143,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);[\s\S]*inset 0 3px 10px rgba\(81,\s*64,\s*60,\s*0\.46\)/
  );
  assert.match(
    css,
    /\.tool\.has-action-provenance\.depressed,\s*\.tool\.has-action-provenance\.is-active-request\s*\{[\s\S]*background:\s*rgba\(154,\s*132,\s*126,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);[\s\S]*inset 0 4px 12px rgba\(72,\s*56,\s*52,\s*0\.54\)/
  );
  assert.match(
    css,
    /\.session-tab-strip-action\.has-action-provenance:active,\s*\.session-tab-runtime-action\.has-action-provenance:active,\s*\.session-tab-runtime-action\.has-action-provenance\.is-active-request\s*\{[\s\S]*background:\s*rgba\(154,\s*132,\s*126,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);[\s\S]*transform:\s*translateY\(1px\);[\s\S]*inset 0 4px 12px rgba\(72,\s*56,\s*52,\s*0\.54\)/
  );
  assert.match(
    visualSystemCss,
    /\.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance\.selected,\s*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance\.selected:hover,\s*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance\.is-active-request,\s*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance\.is-active-request:hover,\s*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance\.is-pressing\s*\{[\s\S]*background:\s*rgba\(170,\s*149,\s*143,\s*0\.98\);[\s\S]*color:\s*rgba\(0,\s*0,\s*0,\s*0\.92\);[\s\S]*inset 0 3px 10px rgba\(81,\s*64,\s*60,\s*0\.46\)/
  );
  assert.match(
    visualSystemCss,
    /\.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance\.depressed\s*\{[\s\S]*background:\s*rgba\(154,\s*132,\s*126,\s*0\.98\);[\s\S]*inset 0 4px 12px rgba\(72,\s*56,\s*52,\s*0\.54\)/
  );
});
