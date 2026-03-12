import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "src", "index.html"), "utf8");
const app = readFileSync(join(here, "..", "src", "canvas_app.js"), "utf8");
const styles = readFileSync(join(here, "..", "src", "styles.css"), "utf8");

test("Juggernaut shell chrome exposes selection status, export button, rail root, and upload affordance", () => {
  assert.match(html, /class=\"juggernaut-shell-chrome\"/);
  assert.match(html, /id=\"juggernaut-selection-status\"/);
  assert.match(html, /id=\"juggernaut-agent-runner-open\"/);
  assert.match(html, /id=\"agent-runner-panel\"/);
  assert.match(html, /id=\"agent-runner-expand\"/);
  assert.match(html, /id=\"agent-runner-banner\"/);
  assert.match(html, /id=\"agent-runner-banner-show\"/);
  assert.match(html, /id=\"agent-runner-banner-stop\"/);
  assert.match(html, /id=\"agent-runner-goal\"/);
  assert.match(html, /id=\"agent-runner-submit\"/);
  assert.match(html, /id=\"agent-runner-expand\"[\s\S]*class=\"agent-runner-button-icon\"/);
  assert.match(html, /id=\"agent-runner-close\"[\s\S]*class=\"agent-runner-button-icon\"/);
  assert.match(html, /id=\"agent-runner-submit\"[\s\S]*class=\"agent-runner-button-icon\"/);
  assert.match(html, /class=\"agent-runner-panel-expanded\"/);
  assert.match(html, /id=\"agent-runner-score\"/);
  assert.match(html, /id=\"agent-runner-copy\"/);
  assert.match(html, /id=\"agent-runner-step\"/);
  assert.match(html, /id=\"agent-runner-auto\"/);
  assert.match(html, /id=\"juggernaut-export-psd\"/);
  assert.match(html, /id=\"action-grid\"[^>]*aria-label=\"Juggernaut left rail\"/);
  assert.match(html, /id=\"drop-hint\"/);
});

test("Juggernaut shell bridge exposes tool/export registration and request methods", () => {
  assert.match(app, /window\.__JUGGERNAUT_SHELL__\s*=\s*\{/);
  assert.match(app, /railContract:\s*JUGGERNAUT_SHELL_RAIL_CONTRACT/);
  assert.match(app, /registerToolInvoker\(fn\)/);
  assert.match(app, /registerSingleImageRailRanker\(fn\)/);
  assert.match(app, /registerPsdExportHandler\(fn\)/);
  assert.match(app, /requestToolInvocation\(toolKey,\s*meta\s*=\s*\{\}\)/);
  assert.match(app, /requestPsdExport\(meta\s*=\s*\{\}\)/);
  assert.match(app, /agentRunnerBridgeKey:\s*AGENT_RUNNER_BRIDGE_KEY/);
  assert.match(app, /openAgentRunner\(\)/);
  assert.match(app, /getAgentRunnerState\(\)/);
  assert.match(app, /window\[AGENT_RUNNER_BRIDGE_KEY\]\s*=\s*Object\.freeze\(\{/);
  assert.match(app, /runAgentRunnerStep\(/);
  assert.match(app, /runAgentRunnerAuto\(/);
  assert.match(app, /function buildAgentRunnerClipboardText\(\)/);
  assert.match(app, /async function copyAgentRunnerLogToClipboard\(\)/);
  assert.match(app, /async function maybeRunAgentRunnerFinalEvaluation\(/);
  assert.match(app, /buildAgentRunnerEvaluationPrompt\(/);
  assert.match(app, /parseAgentRunnerEvaluationResponse\(/);
  assert.match(app, /function renderAgentRunnerBanner\(\)/);
  assert.doesNotMatch(app, /Comparing the visible canvas against the goal with the shared vision planner\./);
  assert.match(app, /function collapseAgentRunnerPanelToBanner\(\)/);
  assert.match(app, /panelExpanded:\s*false/);
  assert.match(app, /const setAgentRunnerButtonLabel = \(button,\s*label\) => \{/);
  assert.match(app, /agentRunnerExpand:\s*document\.getElementById\("agent-runner-expand"\)/);
  assert.match(app, /agentRunnerSubmit:\s*document\.getElementById\("agent-runner-submit"\)/);
  assert.match(app, /function showAgentRunnerPanel\(\{ focusGoal = true,\s*expand = false \} = \{\}\) \{/);
  assert.match(app, /function showAgentRunnerPanel\(\{ focusGoal = true,\s*expand = false \} = \{\}\) \{[\s\S]*runner\.panelExpanded = Boolean\(expand\);/);
  assert.match(app, /els\.agentRunnerExpand\.addEventListener\("click", \(\) => \{[\s\S]*runner\.panelExpanded = !runner\.panelExpanded;/);
  assert.match(app, /els\.agentRunnerSubmit\.addEventListener\("click", \(\) => \{[\s\S]*runAgentRunnerAuto\(\{ source: "agent_runner_panel_compact" \}\)/);
  assert.match(app, /classList\.toggle\("agent-runner-active",\s*active\)/);
  assert.match(app, /getRuntimeVisibility\(\)/);
  assert.match(app, /setRuntimeVisibility\(next\s*=\s*\{\}\)/);
  assert.match(app, /getCanvasSnapshot\(\)/);
});

test("Agent Run panel exposes a copy-logs control and clipboard handler", () => {
  assert.match(app, /agentRunnerCopy:\s*document\.getElementById\("agent-runner-copy"\)/);
  assert.match(app, /agentRunnerScore:\s*document\.getElementById\("agent-runner-score"\)/);
  assert.match(app, /await navigator\.clipboard\.writeText\(text\)/);
  assert.match(app, /showToast\("Agent Run logs copied\.", "tip", 1800\)/);
  assert.match(app, /els\.agentRunnerCopy\.addEventListener\("click", \(\) => \{/);
});

test("Agent Run panel surfaces a final vision score after the run", () => {
  assert.match(app, /finalEvaluation:\s*null/);
  assert.match(app, /Final score/);
  assert.match(app, /Scoring the final result against the goal\./);
  assert.match(app, /providerRouter\.runPlanner\(\{/);
  assert.match(styles, /\.agent-runner-score\s*\{/);
  assert.match(styles, /\.annotate-panel\s*\{[\s\S]*display:\s*flex;[\s\S]*max-height:\s*calc\(100vh - 24px\)/);
  assert.match(styles, /\.annotate-body\s*\{[\s\S]*min-height:\s*0;[\s\S]*overflow-y:\s*auto;/);
  assert.match(styles, /\.annotate-actions\s*\{[\s\S]*position:\s*sticky;[\s\S]*bottom:\s*0;/);
  assert.match(styles, /\.agent-runner-banner\[data-state="scoring"\]\s*\{[\s\S]*--agent-runner-banner-accent:/);
});

test("Agent Run planning captures the visible canvas for live next-step vision reasoning with a visible-image fallback", () => {
  assert.match(app, /async function buildAgentRunnerPlannerImages\(shellSnapshot = null\)/);
  assert.match(app, /const visibleCanvasRef = await captureAgentRunnerVisibleCanvasRef\(runDir\)/);
  assert.match(app, /return \[visibleCanvasRef, \.\.\.visibleImages\];/);
  assert.match(app, /console\.warn\("Agent Run planner vision capture failed; falling back to visible images\.", error\)/);
  assert.match(app, /const plannerImages = await buildAgentRunnerPlannerImages\(shellSnapshot\)/);
  assert.match(app, /images:\s*plannerImages,/);
});

test("Collapsed Agent Run banner uses the shared liquid-glass material treatment", () => {
  assert.match(styles, /\.agent-runner-banner\s*\{[\s\S]*--agent-runner-banner-accent:/);
  assert.match(styles, /\.agent-runner-banner\s*\{[\s\S]*left:\s*auto;[\s\S]*right:\s*calc\(var\(--jg-shell-inset,\s*18px\) \+ 12px\);[\s\S]*bottom:\s*116px/);
  assert.match(styles, /\.agent-runner-banner\s*\{[\s\S]*width:\s*min\(332px/);
  assert.match(styles, /\.agent-runner-banner\s*\{[\s\S]*transform:\s*none/);
  assert.match(styles, /\.agent-runner-banner\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(248,\s*251,\s*255,\s*0\.8\)/);
  assert.match(styles, /\.agent-runner-banner::before\s*\{/);
  assert.match(styles, /\.agent-runner-banner-actions button\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*0\.44\)/);
  assert.match(app, /els\.agentRunnerBannerDetail\.classList\.toggle\("hidden", !detailText\)/);
});

test("Expanded Agent Run panel uses the same liquid-glass shell language", () => {
  assert.match(styles, /\.agent-runner-panel\s*\{[\s\S]*--agent-runner-panel-accent:/);
  assert.match(styles, /\.agent-runner-panel\s*\{[\s\S]*top:\s*auto;[\s\S]*bottom:\s*178px/);
  assert.match(styles, /\.agent-runner-panel\s*\{[\s\S]*transform:\s*translateX\(-50%\)/);
  assert.match(styles, /\.agent-runner-panel\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(248,\s*251,\s*255,\s*0\.82\)/);
  assert.match(styles, /\.agent-runner-panel-header-actions\s*\{/);
  assert.match(styles, /\.agent-runner-panel\.is-collapsed\s*\{[\s\S]*top:\s*calc\(var\(--jg-header-clearance,\s*92px\) - 36px\);[\s\S]*bottom:\s*auto;[\s\S]*transform:\s*translateX\(-50%\)/);
  assert.match(styles, /\.agent-runner-panel \.agent-runner-button-icon\s*\{[\s\S]*width:\s*18px;[\s\S]*height:\s*18px/);
  assert.match(styles, /\.agent-runner-panel\.is-expanded #agent-runner-expand \.agent-runner-button-icon\s*\{[\s\S]*transform:\s*rotate\(180deg\)/);
  assert.match(styles, /\.agent-runner-panel\.is-collapsed \.annotate-title\s*\{[\s\S]*font-size:\s*clamp\(22px,\s*2\.1vw,\s*30px\)/);
  assert.match(styles, /\.agent-runner-panel\.is-collapsed \.annotate-label\s*\{[\s\S]*font-size:\s*14px/);
  assert.match(styles, /\.agent-runner-panel\.is-collapsed \.agent-runner-panel-compact-actions\s*\{[\s\S]*display:\s*flex/);
  assert.match(styles, /\.agent-runner-panel\.is-collapsed #agent-runner-expand,\s*[\s\S]*#agent-runner-close\s*\{[\s\S]*width:\s*34px;[\s\S]*min-height:\s*34px/);
  assert.match(styles, /\.agent-runner-panel\.is-collapsed #agent-runner-expand \.agent-runner-button-label,\s*[\s\S]*#agent-runner-close \.agent-runner-button-label\s*\{[\s\S]*display:\s*none/);
  assert.match(styles, /\.agent-runner-panel\.is-collapsed #agent-runner-expand \.agent-runner-button-icon,\s*[\s\S]*#agent-runner-close \.agent-runner-button-icon\s*\{[\s\S]*width:\s*20px;[\s\S]*height:\s*20px/);
  assert.match(styles, /\.agent-runner-panel\.is-collapsed \.agent-runner-panel-compact-actions\s*\{[\s\S]*justify-content:\s*flex-end/);
  assert.match(styles, /\.agent-runner-panel\.is-collapsed \.agent-runner-panel-compact-actions button\s*\{[\s\S]*width:\s*34px;[\s\S]*min-height:\s*34px;[\s\S]*font-size:\s*11px/);
  assert.match(styles, /\.agent-runner-panel\.is-collapsed #agent-runner-submit \.agent-runner-button-icon\s*\{[\s\S]*width:\s*22px;[\s\S]*height:\s*22px/);
  assert.match(styles, /\.agent-runner-panel\.is-collapsed #agent-runner-submit:disabled\s*\{[\s\S]*color:\s*rgba\(98,\s*110,\s*126,\s*0\.88\)/);
  assert.match(styles, /\.agent-runner-panel\.is-collapsed \.agent-runner-goal-field \.annotate-text\s*\{[\s\S]*font-size:\s*clamp\(22px,\s*1\.8vw,\s*28px\)/);
  assert.match(styles, /\.agent-runner-panel \.agent-runner-panel-expanded\s*\{[\s\S]*display:\s*flex/);
  assert.match(styles, /\.agent-runner-panel\.is-collapsed \.agent-runner-panel-expanded\s*\{[\s\S]*display:\s*none/);
  assert.match(styles, /\.agent-runner-panel::before\s*\{/);
  assert.match(styles, /\.agent-runner-panel \.annotate-title\s*\{[\s\S]*font-family:\s*"Space Grotesk", sans-serif/);
  assert.match(styles, /\.agent-runner-panel \.annotate-meta\s*\{[\s\S]*font-family:\s*"Space Grotesk", sans-serif/);
  assert.match(styles, /\.agent-runner-panel \.annotate-actions button\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*0\.46\)/);
});

test("Juggernaut shell bridge emits integration events for tools and PSD export", () => {
  assert.match(app, /juggernaut:shell-ready/);
  assert.match(app, /juggernaut:runtime-visibility-changed/);
  assert.match(app, /juggernaut:tool-requested/);
  assert.match(app, /juggernaut:export-psd-requested/);
  assert.match(app, /juggernaut:apply-tool/);
  assert.match(app, /juggernaut:export-psd/);
});

test("Juggernaut shell export falls back to the native PSD exporter when no handler is registered", () => {
  assert.match(app, /const exportHookReady = typeof state\.juggernautShell\.psdExportHandler === "function" \|\| typeof invoke === "function";/);
  assert.match(app, /if \(typeof invoke === "function"\) \{\s*await exportRun\(\);\s*return true;\s*\}/);
  assert.doesNotMatch(app, /Export PSD hook ready for the export branch/);
});

test("Juggernaut runner and export controls live in the titlebar session actions", () => {
  const brandStripStart = html.indexOf('<div class="brand-strip"');
  const mainStart = html.indexOf("<main", brandStripStart);
  assert.ok(brandStripStart >= 0 && mainStart > brandStripStart, "expected brand strip before main");
  const brandStripChunk = html.slice(brandStripStart, mainStart);
  assert.match(
    brandStripChunk,
    /class=\"session-tab-strip-actions\"[^>]*role=\"group\"[^>]*aria-label=\"Session actions\"[\s\S]*id=\"session-tab-open\"[\s\S]*id=\"juggernaut-agent-runner-open\"[\s\S]*id=\"juggernaut-export-psd\"[\s\S]*id=\"session-tab-design-review\"/
  );
  assert.doesNotMatch(html, /session-tab-strip-shell-head-placeholder/);
  assert.match(styles, /\.session-tab-runtime-action\s*\{/);
  assert.match(styles, /\.session-tab-runtime-action\.is-ready\s*\{/);
  assert.match(styles, /\.agent-runner-banner\s*\{/);
  assert.match(styles, /\.canvas-wrap\.agent-runner-active\s*\{/);
});
