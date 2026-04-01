import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(here, "..", "src", "index.html");
const cssPath = join(here, "..", "src", "styles.css");
const html = readFileSync(htmlPath, "utf8");
const css = readFileSync(cssPath, "utf8");

test("Juggernaut shell: stage chrome carries the left rail, custom tools, and workspace header while legacy dock markup remains available", () => {
  assert.match(html, /class=\"juggernaut-shell-chrome\"[\s\S]*id=\"custom-tool-dock\"[\s\S]*id=\"action-grid\"[\s\S]*id=\"juggernaut-selection-status\"[\s\S]*class=\"juggernaut-shell-head\"[\s\S]*id=\"top-metrics\"/);
  assert.match(html, /class=\"brand-strip\"[^>]*role=\"toolbar\"[\s\S]*class=\"juggernaut-brand\"[^>]*data-tauri-drag-region[\s\S]*class=\"window-drag-region\"[^>]*data-tauri-drag-region[\s\S]*id=\"session-tab-strip\"[\s\S]*class=\"session-tab-run\"[\s\S]*id=\"session-tab-list\"[\s\S]*id=\"session-tab-new\"[\s\S]*id=\"session-tab-fork\"[\s\S]*id=\"juggernaut-agent-runner-open\"[\s\S]*id=\"session-tab-design-review\"[\s\S]*id=\"juggernaut-export-psd\"[\s\S]*class=\"sr-only\"[\s\S]*id=\"engine-status\"[\s\S]*id=\"mother-intent-source-indicator\"[\s\S]*id=\"app-menu-toggle\"/);
  assert.match(html, /class=\"juggernaut-shell-head\"[^>]*aria-hidden=\"true\"[\s\S]*id=\"top-metrics\"[^>]*class=\"top-metrics hidden\"/);
  assert.match(html, /id=\"session-tab-list\"[^>]*role=\"tablist\"/);
  assert.match(html, /id=\"session-tab-new\"/);
  assert.match(html, /id=\"session-tab-fork\"/);
  assert.match(html, /id=\"juggernaut-agent-runner-open\"/);
  assert.match(html, /id=\"juggernaut-export-psd\"/);
  assert.match(html, /id=\"juggernaut-export-menu\"/);
  assert.match(html, /id=\"session-tab-design-review\"/);
  assert.match(html, /id=\"timeline-toggle\"/);
  assert.match(html, /id=\"timeline-body\"/);
  assert.match(html, /id=\"top-metrics\"[^>]*class=\"top-metrics hidden\"/);
  assert.match(html, /id=\"juggernaut-selection-status\"[^>]*class=\"sr-only\"/);
  assert.doesNotMatch(html, /session-tab-strip-shell-head-placeholder/);
  assert.match(html, /id=\"control-strip\"/);
  assert.match(html, /id=\"file-browser-dock\"/);
  assert.match(html, /id=\"hud\"/);
  assert.match(html, /id=\"agents-dock\"/);
  assert.match(html, /id=\"portrait-video\"/);
  assert.match(html, /id=\"portrait-video-2\"/);
});

test("Agents Dock: CSS stacks portraits vertically and keeps dock height aligned to grid", () => {
  assert.match(css, /\.agents-dock\s*\{/);
  assert.match(css, /height:\s*calc\(var\(--hud-keybar-h\)\s*\+\s*2px\)/);
  assert.match(css, /\.agents-dock\s+\.agent-portraits\s*\{[\s\S]*flex-direction:\s*column/);
  assert.match(css, /\.control-strip\s*\{[\s\S]*gap:\s*0/);
});

test("Action Grid: CSS uses hazard stripe frame", () => {
  assert.match(css, /\.action-grid::before\s*\{/);
  assert.match(css, /repeating-linear-gradient\([\s\S]*135deg/);
  assert.match(css, /rgba\(255,\s*197,\s*0/);
});

test("Mother: top-right overlay keeps portrait + controls while dialog panel is hidden", () => {
  assert.match(html, /id=\"mother-overlay\"/);
  assert.match(html, /id=\"mother-panel-stack\"/);
  assert.match(html, /id=\"mother-panel\"/);
  assert.match(html, /id=\"mother-portrait-shell\"/);
  assert.match(html, /id=\"mother-video\"/);
  assert.match(html, /id=\"mother-panel\"[\s\S]*id=\"tips-text\"/);
  assert.match(html, /id=\"mother-panel\"[\s\S]*mother-actions-floating/);
  assert.match(css, /\.mother-overlay\s*\{[\s\S]*position:\s*absolute/);
  assert.match(css, /\.mother-overlay\s*\{[\s\S]*top:\s*12px/);
  assert.match(css, /\.mother-overlay\s*\{[\s\S]*right:\s*12px/);
  assert.match(css, /\.mother-overlay\s*\{[\s\S]*flex-direction:\s*column/);
  assert.match(css, /\.mother-overlay\s*\{[\s\S]*align-items:\s*flex-end/);
  assert.match(css, /#mother-portrait-shell\s*\{/);
  assert.match(css, /#mother-panel-stack\s*\{[\s\S]*width:\s*fit-content/);
  assert.match(css, /#mother-panel\s*\{/);
  assert.match(css, /#mother-panel\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /#mother-panel-stack\s+\.mother-actions\s*\{[\s\S]*justify-content:\s*center/);
});
