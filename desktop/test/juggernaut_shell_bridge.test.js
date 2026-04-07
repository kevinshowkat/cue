import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { installLegacyCanvasAppBridges } from "../src/app/shell_bridges.js";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "src", "index.html"), "utf8");
const app = readFileSync(join(here, "..", "src", "canvas_app.js"), "utf8");
const domSource = readFileSync(join(here, "..", "src", "app", "dom.js"), "utf8");
const shellBridgeSource = readFileSync(
  join(here, "..", "src", "app", "shell_bridges.js"),
  "utf8"
);
const shellChromeRenderer = readFileSync(
  join(here, "..", "src", "app", "shell_chrome_renderer.js"),
  "utf8"
);
const tabStripUiSource = readFileSync(
  join(here, "..", "src", "app", "tab_strip_ui.js"),
  "utf8"
);
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
  assert.match(html, /id=\"juggernaut-export-menu\"/);
  assert.match(html, /id=\"juggernaut-export-format-psd\"/);
  assert.match(html, /id=\"juggernaut-export-format-png\"/);
  assert.match(html, /id=\"action-grid\"[^>]*aria-label=\"Cue left rail\"/);
  assert.match(html, /id=\"drop-hint\"/);
  assert.match(html, /id=\"drop-hint\"[^>]*aria-hidden=\"true\"/);
  assert.doesNotMatch(html, /id=\"drop-hint\"[^>]*role=\"button\"/);
});

test("Juggernaut shell bridge exposes tool/export registration and request methods", () => {
  assert.match(shellBridgeSource, /windowObj\.__JUGGERNAUT_SHELL__\s*=\s*shellBridge/);
  assert.match(shellBridgeSource, /railContract:\s*JUGGERNAUT_SHELL_RAIL_CONTRACT/);
  assert.match(shellBridgeSource, /registerToolInvoker:\s*registerBridgeHook/);
  assert.match(shellBridgeSource, /registerSingleImageRailRanker:\s*registerBridgeHook/);
  assert.match(shellBridgeSource, /registerPsdExportHandler:\s*registerBridgeHook/);
  assert.match(shellBridgeSource, /requestExport\(meta\s*=\s*\{\}\)/);
  assert.match(shellBridgeSource, /requestToolInvocation\(toolKey,\s*meta\s*=\s*\{\}\)/);
  assert.match(shellBridgeSource, /requestPsdExport\(meta\s*=\s*\{\}\)/);
  assert.match(shellBridgeSource, /agentRunnerBridgeKey:\s*AGENT_RUNNER_BRIDGE_KEY/);
  assert.match(shellBridgeSource, /openAgentRunner\(\)/);
  assert.match(shellBridgeSource, /getAgentRunnerState\(\)/);
  assert.match(app, /function installJuggernautShellBridge\(\)\s*\{\s*return installLegacyCanvasAppShellBridges\(\{/s);
  assert.match(app, /function exposeJuggernautShellHooks\(\)\s*\{\s*return exposeLegacyCanvasAppGlobalBridges\(\{/s);
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
  assert.match(domSource, /\["agentRunnerExpand", "agent-runner-expand"\]/);
  assert.match(domSource, /\["agentRunnerSubmit", "agent-runner-submit"\]/);
  assert.match(app, /function showAgentRunnerPanel\(\{ focusGoal = true,\s*expand = false \} = \{\}\) \{/);
  assert.match(app, /function showAgentRunnerPanel\(\{ focusGoal = true,\s*expand = false \} = \{\}\) \{[\s\S]*runner\.panelExpanded = Boolean\(expand\);/);
  assert.match(app, /els\.agentRunnerExpand\.addEventListener\("click", \(\) => \{[\s\S]*runner\.panelExpanded = !runner\.panelExpanded;/);
  assert.match(app, /els\.agentRunnerSubmit\.addEventListener\("click", \(\) => \{[\s\S]*runAgentRunnerAuto\(\{ source: "agent_runner_panel_compact" \}\)/);
  assert.match(app, /classList\.toggle\("agent-runner-active",\s*active\)/);
  assert.match(shellBridgeSource, /getRuntimeVisibility\(\)/);
  assert.match(shellBridgeSource, /setRuntimeVisibility\(next\s*=\s*\{\}\)/);
  assert.match(shellBridgeSource, /getCanvasSnapshot\(\)/);
  assert.match(app, /function syncDropHintInteractivity\(\)\s*\{[\s\S]*tabIndex = -1;[\s\S]*pointerEvents = "none";[\s\S]*cursor = "default";[\s\S]*\}/);
  assert.doesNotMatch(app, /els\.dropHint\.addEventListener\("click",/);
  assert.doesNotMatch(app, /els\.dropHint\.addEventListener\("keydown",/);
});

test("Juggernaut shell bridge install preserves legacy globals and nested bridge surfaces", () => {
  const calls = [];
  const windowObj = {};
  const state = {
    juggernautShell: {
      toolInvoker: null,
      psdExportHandler: null,
      singleImageRail: {
        contract: "juggernaut.single-image.v1",
        adapter: { id: "mock-adapter" },
        mock: false,
        ranker: null,
      },
    },
  };
  const bridge = installLegacyCanvasAppBridges({
    windowObj,
    state,
    JUGGERNAUT_SHELL_BRIDGE_VERSION: "bridge.v1",
    JUGGERNAUT_SHELL_RAIL_CONTRACT: "rail.v1",
    JUGGERNAUT_SHELL_RAIL: [{ toolId: "polish", label: "Polish" }],
    runtimeChromeVisibilitySnapshot: () => ({ showAssistant: true }),
    applyJuggernautTool: (toolId) => ({ ok: true, toolId }),
    exportJuggernautPsd: (meta = {}) => ({ ok: true, meta }),
    renderQuickActions: () => calls.push("quick"),
    renderJuggernautShellChrome: () => calls.push("chrome"),
    invokeJuggernautShellTool: (toolKey, meta = {}) => ({ toolKey, meta }),
    requestJuggernautExport: (meta = {}) => ({ kind: "export", meta }),
    requestJuggernautPsdExport: (meta = {}) => ({ kind: "psd", meta }),
    importPhotos: () => ({ kind: "import" }),
    listTabs: () => [{ id: "tab-1" }],
    createRun: () => ({ kind: "new-run" }),
    openExistingRun: () => ({ kind: "open-run" }),
    activateTab: (tabId) => tabId,
    closeTab: (tabId) => tabId,
    subscribeTabs: () => () => {},
    buildJuggernautShellContext: () => ({ activeImageId: "img-1" }),
    buildCommunicationReviewPayload: (meta = {}) => ({ payload: meta }),
    buildCommunicationBridgeSnapshot: () => ({ tool: "marker" }),
    buildAgentRunnerBridgeSnapshot: () => ({ running: false }),
    showAgentRunnerPanel: (options = {}) => options,
    hideAgentRunnerPanel: () => ({ hidden: true }),
    agentRunnerActive: () => true,
    requestCommunicationDesignReview: (meta = {}) => ({ review: meta }),
    setCommunicationProposalTray: (next = {}, meta = {}) => ({ next, meta }),
    hideCommunicationProposalTray: (meta = {}) => ({ hidden: meta }),
    setCommunicationTool: (tool, meta = {}) => ({ tool, meta }),
    setRuntimeChromeVisibility: (next = {}, meta = {}) => ({ next, meta }),
    AGENT_RUNNER_BRIDGE_KEY: "__JUGGERNAUT_AGENT_RUNNER__",
    installTabbedSessionsBridge: (shellBridge) => {
      calls.push({ tabsInjected: true, shellBridge });
      shellBridge.tabsBridgeKey = "__TABBED_SESSIONS__";
    },
    dispatchJuggernautShellEvent: (type, detail) => {
      calls.push({ type, detail });
      return { type, detail };
    },
    singleImageRailRecentSuccessfulJobs: () => [{ jobId: "polish" }],
  });

  assert.equal(windowObj.__JUGGERNAUT_SHELL__, bridge);
  assert.equal(windowObj.applyJuggernautTool, bridge.applyJuggernautTool);
  assert.equal(windowObj.exportJuggernautPsd, bridge.exportJuggernautPsd);
  assert.equal(windowObj.__juggernautShell.state, state.juggernautShell);
  assert.deepEqual(windowObj.__JUGGERNAUT_RUNTIME_FLAGS__.getRuntimeVisibility(), {
    showAssistant: true,
  });
  assert.deepEqual(bridge.singleImageRail.recentSuccessfulJobs, [{ jobId: "polish" }]);
  assert.deepEqual(bridge.requestToolInvocation("polish", { source: "shell" }), {
    toolKey: "polish",
    meta: { source: "shell" },
  });
  assert.deepEqual(bridge.requestExport({ format: "png" }), {
    kind: "export",
    meta: { format: "png" },
  });
  assert.deepEqual(bridge.showCommunicationProposalTray({ open: true }), {
    next: { open: true },
    meta: { source: "bridge" },
  });
  assert.deepEqual(bridge.communicationReview.showTray({ open: true }), {
    next: { open: true },
    meta: { source: "bridge_nested" },
  });
  const unregisterToolInvoker = bridge.registerToolInvoker(() => true);
  const unregisterRanker = bridge.registerSingleImageRailRanker(() => []);
  const unregisterPsd = bridge.registerPsdExportHandler(() => true);
  assert.equal(typeof state.juggernautShell.toolInvoker, "function");
  assert.equal(typeof state.juggernautShell.singleImageRail.ranker, "function");
  assert.equal(typeof state.juggernautShell.psdExportHandler, "function");
  unregisterToolInvoker();
  unregisterRanker();
  unregisterPsd();
  assert.equal(state.juggernautShell.toolInvoker, null);
  assert.equal(state.juggernautShell.singleImageRail.ranker, null);
  assert.equal(state.juggernautShell.psdExportHandler, null);
  assert.ok(calls.some((entry) => entry === "quick"));
  assert.ok(calls.some((entry) => entry === "chrome"));
  assert.ok(calls.some((entry) => entry?.type === "juggernaut:shell-ready"));
});

test("Agent Run panel exposes a copy-logs control and clipboard handler", () => {
  assert.match(domSource, /\["agentRunnerCopy", "agent-runner-copy"\]/);
  assert.match(domSource, /\["agentRunnerScore", "agent-runner-score"\]/);
  assert.match(app, /await navigator\.clipboard\.writeText\(text\)/);
  assert.match(app, /showToast\("Agent Run logs copied\.", "tip", 1800\)/);
  assert.match(app, /els\.agentRunnerCopy\.addEventListener\("click", \(\) => \{/);
});

test("Agent Run panel surfaces a final vision score after the run", () => {
  assert.match(app, /finalEvaluation:\s*null/);
  assert.match(app, /goalContract:\s*null/);
  assert.match(app, /goalContractStatus:\s*"idle"/);
  assert.match(app, /goalContractPromise:\s*null/);
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
  assert.match(app, /async function ensureAgentRunnerGoalContract\(/);
  assert.match(app, /async function maybeRunAgentRunnerStopCheck\(/);
  assert.match(app, /Compiling goal contract from the goal text\./);
  assert.match(app, /Goal contract ready:/);
  assert.match(app, /Goal contract is still compiling in the background\./);
  assert.match(app, /readFirstString\(record\.goalContractStatus\) === "failed"\)\s*\{\s*return null;/);
  assert.match(app, /blocked: \$\{result\.verdict\.summary\}/);
  assert.match(app, /const plannerImages = await buildAgentRunnerPlannerImages\(shellSnapshot\)/);
  assert.match(app, /images:\s*plannerImages,/);
});

test("Agent Run routes export actions through the shared multi-format export bridge", () => {
  assert.match(app, /function isAgentRunnerExportAction\(action = null\)/);
  assert.match(app, /function agentRunnerExportFormat\(action = null\)/);
  assert.match(app, /if \(isAgentRunnerExportAction\(action\)\) \{/);
  assert.match(app, /const format = agentRunnerExportFormat\(action\);/);
  assert.match(app, /requestJuggernautExport\(\{ format, source: "agent_runner" \}\)/);
  assert.match(app, /message: `\$\{exportFormatLabel\(format\)\} export requested\.`/);
});

test("Collapsed Agent Run banner uses the shared liquid-glass material treatment", () => {
  assert.match(styles, /\.agent-runner-banner\s*\{[\s\S]*--agent-runner-banner-accent:/);
  assert.match(styles, /\.agent-runner-banner\s*\{[\s\S]*left:\s*auto;[\s\S]*right:\s*calc\(var\(--jg-shell-inset,\s*18px\) \+ 12px\);[\s\S]*bottom:\s*116px/);
  assert.match(styles, /\.agent-runner-banner\s*\{[\s\S]*width:\s*min\(332px/);
  assert.match(styles, /\.agent-runner-banner\s*\{[\s\S]*transform:\s*none/);
  assert.match(styles, /\.agent-runner-banner\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(248,\s*251,\s*255,\s*0\.8\)/);
  assert.match(styles, /\.agent-runner-banner::before\s*\{/);
  assert.match(styles, /\.agent-runner-banner-actions button\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*0\.44\)/);
  assert.match(app, /function resolveAgentRunnerBannerDetail\(runner = null\)\s*\{[\s\S]*const limit = resolveAgentRunnerActionBudgetLimit\(record\);[\s\S]*const used = roundAgentRunnerBudgetValue\(record\.budgetUsed\);[\s\S]*return `Budget \$\{formatAgentRunnerBudgetValue\(used\)\} \/ \$\{formatAgentRunnerBudgetValue\(limit\)\}`;[\s\S]*\}/);
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
  assert.match(shellBridgeSource, /juggernaut:shell-ready/);
  assert.match(app, /juggernaut:runtime-visibility-changed/);
  assert.match(app, /juggernaut:tool-requested/);
  assert.match(app, /juggernaut:export-requested/);
  assert.match(app, /juggernaut:export-psd-requested/);
  assert.match(app, /juggernaut:apply-tool/);
  assert.match(app, /juggernaut:export/);
  assert.match(app, /juggernaut:export-psd/);
});

test("Juggernaut shell export falls back to the native PSD exporter when no handler is registered", () => {
  assert.match(app, /const exportHookReady = typeof state\.juggernautShell\.psdExportHandler === "function" \|\| nativeRasterExportReady\(\);/);
  assert.match(app, /if \(nativeRasterExportReady\(\)\) \{\s*return await exportRunInFormat\(normalizedFormat\);\s*\}/);
  assert.doesNotMatch(app, /Export PSD hook ready for the export branch/);
});

test("Juggernaut runner and export controls live in the titlebar session actions", () => {
  const brandStripStart = html.indexOf('<div class="brand-strip"');
  const mainStart = html.indexOf("<main", brandStripStart);
  assert.ok(brandStripStart >= 0 && mainStart > brandStripStart, "expected brand strip before main");
  const brandStripChunk = html.slice(brandStripStart, mainStart);
  assert.match(
    brandStripChunk,
    /class=\"session-tab-strip-actions\"[^>]*role=\"group\"[^>]*aria-label=\"Session actions\"[\s\S]*id=\"juggernaut-agent-runner-open\"[\s\S]*id=\"session-tab-design-review\"[\s\S]*id=\"juggernaut-export-psd\"/
  );
  assert.doesNotMatch(html, /session-tab-strip-shell-head-placeholder/);
  assert.match(styles, /\.session-tab-runtime-action\s*\{/);
  assert.match(html, /data-juggernaut-icon-slot=\"history\"/);
  assert.match(html, /data-juggernaut-icon-slot=\"agent_run\"/);
  assert.match(html, /data-juggernaut-icon-slot=\"export\"/);
  assert.match(html, /data-juggernaut-icon-slot=\"design_review\"/);
  assert.match(app, /function syncJuggernautShellIconography\(packId = settings\.railIconPack\)/);
  assert.match(app, /slot\.innerHTML = getJuggernautRailIconMarkup\(resolvedIconId,\s*resolvedPackId\);/);
  assert.match(tabStripUiSource, /indicator\.dataset\.juggernautIconSlot = "fork_session";/);
  assert.match(styles, /\.session-tab-runtime-action\.is-ready\s*\{/);
  assert.match(styles, /\.agent-runner-banner\s*\{/);
  assert.match(styles, /\.canvas-wrap\.agent-runner-active\s*\{/);
});

test("Juggernaut shell export toggle disables until the canvas has an exportable image", () => {
  assert.match(shellChromeRenderer, /const exportToggleReady = !emptyCanvas && exportMenuReady;/);
  assert.match(shellChromeRenderer, /els\.juggernautExportPsd\.disabled = !exportToggleReady;/);
  assert.match(shellChromeRenderer, /if \(!exportToggleReady && isJuggernautExportMenuOpen\(\)\) \{\s*closeJuggernautExportMenu\(\);\s*\}/);
});
