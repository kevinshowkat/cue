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

test("Shell buttons now share one neutral chassis regardless of provenance", () => {
  assert.match(css, /Shell button chassis unification: one neutral material, provenance via badge, variance only by form factor\./);
  assert.match(css, /--jg-shell-button-fill:[\s\S]*var\(--jg-pack-surface\);/);
  assert.match(css, /--jg-shell-button-border-active:\s*var\(--jg-pack-border-strong\);/);
  assert.match(css, /--jg-shell-button-fill-active:[\s\S]*var\(--jg-pack-surface-deep\);/);
  assert.match(
    css,
    /body\.juggernaut-shell \.tool\[data-provenance\]:not\(\.juggernaut-tool\),[\s\S]*body\.juggernaut-shell \.brand-strip \.session-tab-strip-action\.has-action-provenance,[\s\S]*background:\s*var\(--jg-shell-button-fill\);[\s\S]*color:\s*var\(--jg-shell-button-ink\);/s
  );
  assert.match(
    css,
    /body\.juggernaut-shell \.tool\.has-action-provenance\.selected,[\s\S]*body\.juggernaut-shell \.brand-strip \.session-tab-strip-action\.is-open,[\s\S]*border-color:\s*var\(--jg-shell-button-border-active\);[\s\S]*background:\s*var\(--jg-shell-button-fill-active\);[\s\S]*box-shadow:\s*var\(--jg-shell-button-shadow-active\);/s
  );
  assert.match(
    css,
    /body\.juggernaut-shell \.tool\.has-action-provenance:disabled,[\s\S]*body\.juggernaut-shell \.brand-strip \.session-tab-strip-action:disabled,[\s\S]*background:\s*var\(--jg-shell-button-fill-disabled\);[\s\S]*color:\s*var\(--jg-shell-button-ink-muted\);/s
  );
});

test("Rail buttons use the same neutral chassis for local-only and model-bearing actions", () => {
  assert.match(visualSystemCss, /Rail button chassis unification: one neutral material; provenance reads from the badge, not the fill\./);
  assert.match(
    visualSystemCss,
    /body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button,[\s\S]*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance,[\s\S]*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.is-local-utility\s*\{[\s\S]*background:\s*var\(--jg-shell-button-fill\);[\s\S]*color:\s*var\(--jg-shell-button-ink\);/s
  );
  assert.match(
    visualSystemCss,
    /body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.selected,[\s\S]*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance\.is-pressing,[\s\S]*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.is-local-utility\.is-pressing\s*\{[\s\S]*border-color:\s*var\(--jg-shell-button-border-active\);[\s\S]*background:\s*var\(--jg-shell-button-fill-active\);[\s\S]*box-shadow:\s*var\(--jg-shell-button-shadow-active\);/s
  );
  assert.match(
    visualSystemCss,
    /body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button:disabled,[\s\S]*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.has-action-provenance:disabled,[\s\S]*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.is-local-utility:disabled\s*\{[\s\S]*background:\s*var\(--jg-shell-button-fill-disabled\);[\s\S]*color:\s*var\(--jg-shell-button-ink-muted\);/s
  );
  assert.match(
    visualSystemCss,
    /body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.depressed,[\s\S]*body\.juggernaut-shell \.juggernaut-tool-rail \.juggernaut-rail-button\.is-local-utility\.depressed\s*\{[\s\S]*box-shadow:\s*var\(--jg-shell-button-shadow-depressed\);/s
  );
});

test("Provenance is now communicated with a badge instead of a separate model-backed fill", () => {
  assert.match(css, /--jg-shell-button-badge:\s*var\(--jg-pack-secondary\);/);
  assert.match(css, /--jg-shell-button-badge-halo:\s*var\(--jg-pack-secondary-soft\);/);
  assert.match(
    css,
    /body\.juggernaut-shell \.action-provenance-model-dot\s*\{[\s\S]*radial-gradient\(circle at 32% 28%,\s*rgba\(255,\s*255,\s*255,\s*0\.96\),\s*rgba\(255,\s*255,\s*255,\s*0\.42\)\s*34%,\s*transparent\s*38%\),[\s\S]*var\(--jg-shell-button-badge\);/s
  );
  assert.match(css, /body\.juggernaut-shell \.session-tab-strip-action \.action-provenance-model-dot\s*\{[\s\S]*top:\s*6px[\s\S]*right:\s*6px[\s\S]*width:\s*6px[\s\S]*height:\s*6px;/s);
  assert.match(visualSystemCss, /body\.juggernaut-shell \.juggernaut-tool-rail \.action-provenance-model-dot\s*\{[\s\S]*top:\s*6px[\s\S]*right:\s*6px[\s\S]*width:\s*6px[\s\S]*height:\s*6px;/s);
});
