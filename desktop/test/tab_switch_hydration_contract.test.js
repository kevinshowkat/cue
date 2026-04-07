import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const rendererPath = join(here, "..", "src", "app", "canvas_renderer.js");
const tabActivationRuntimePath = join(here, "..", "src", "app", "tab_activation_runtime.js");
const tabLifecycleRuntimePath = join(here, "..", "src", "app", "tab_lifecycle_runtime.js");
const tabPreviewRuntimePath = join(here, "..", "src", "app", "tab_preview_runtime.js");
const runProvisioningPath = join(here, "..", "src", "app", "run_provisioning.js");
const timelineUiPath = join(here, "..", "src", "app", "timeline_ui.js");
const app = readFileSync(appPath, "utf8");
const rendererSource = readFileSync(rendererPath, "utf8");
const tabActivationRuntimeSource = readFileSync(tabActivationRuntimePath, "utf8");
const tabLifecycleRuntimeSource = readFileSync(tabLifecycleRuntimePath, "utf8");
const tabPreviewRuntimeSource = readFileSync(tabPreviewRuntimePath, "utf8");
const runProvisioningSource = readFileSync(runProvisioningPath, "utf8");
const timelineUiSource = readFileSync(timelineUiPath, "utf8");

function extractFunctionSource(name, source = app) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  assert.notEqual(start, undefined, `Could not find function ${name}`);
  const signatureStart = source.indexOf("(", start);
  assert.notEqual(signatureStart, -1, `Could not find signature for ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth === 0 && char === "{") {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `Could not find body for ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract function ${name}`);
}

test("tab switching keeps the visual swap on the fast path and defers hydration work", () => {
  const activateTabSource = extractFunctionSource("activateTab", tabActivationRuntimeSource);
  const attachSource = extractFunctionSource("attachActiveTabRuntime", tabActivationRuntimeSource);
  const scheduleSource = extractFunctionSource("scheduleTabHydration", tabActivationRuntimeSource);
  const renderSource = extractFunctionSource("render", rendererSource);
  const previewSource = extractFunctionSource("renderPendingTabSwitchPreview", tabPreviewRuntimeSource);
  const descriptorSource = extractFunctionSource("buildTabPreviewDescriptor", tabPreviewRuntimeSource);

  assert.match(scheduleSource, /requestAnimationFrame\(\(\) => \{/);
  assert.match(scheduleSource, /setTimeout\(\(\) => \{/);
  assert.match(scheduleSource, /requestIdleCallback/);
  assert.match(
    activateTabSource,
    /bindTabSessionToState\(target\.session\);[\s\S]*tabbedSessions\.setActiveTab\(normalized\);[\s\S]*syncActiveTabPreviewRuntime\(\);[\s\S]*publishActiveTabVisibleState\(\{\s*allowTabSwitchPreview:\s*true,\s*reason\s*\}\);[\s\S]*const hydration = scheduleTabHydration\(normalized, reason, \{\s*spawnEngine,\s*engineFailureToast\s*\}\);/
  );
  assert.match(
    attachSource,
    /renderFilmstrip\(\);[\s\S]*chooseSpawnNodes\(\);[\s\S]*renderTimeline\(\);[\s\S]*await syncActiveRunPtyBinding\(\{ useCache: true \}\);[\s\S]*startEventsPolling\(\);/
  );
  assert.match(renderSource, /if \(renderPendingTabSwitchPreview\(\)\) \{\s*return;\s*\}/);
  assert.match(previewSource, /scheduleTabSwitchFullRender\(normalizedTabId,\s*pending\.reason,\s*\{\s*previewHit:\s*true\s*\}\)/);
  assert.match(previewSource, /scheduleTabSwitchFullRender\(normalizedTabId,\s*pending\.reason,\s*\{\s*previewHit:\s*false\s*\}\)/);
  assert.match(descriptorSource, /tabId:\s*normalizedTabId/);
  assert.match(descriptorSource, /canvasWidth:\s*Math\.max\(0,\s*Number\(work\?\.width\) \|\| 0\)/);
  assert.match(descriptorSource, /canvasHeight:\s*Math\.max\(0,\s*Number\(work\?\.height\) \|\| 0\)/);
  assert.match(descriptorSource, /dpr:\s*getDpr\(\)/);
  assert.match(descriptorSource, /viewportKey:\s*buildTabPreviewViewportKey\(\)/);
  assert.match(descriptorSource, /visualVersion:\s*Math\.max\(0,\s*Number\(previewState\.version\) \|\| 0\)/);
});

test("deferred tab hydration uses a token guard so stale async work cannot complete after a newer switch", () => {
  const attachSource = extractFunctionSource("attachActiveTabRuntime", tabActivationRuntimeSource);
  const scheduleSource = extractFunctionSource("scheduleTabHydration", tabActivationRuntimeSource);
  const guardMatches = attachSource.match(/currentTabHydrationMatches\(normalizedTabId, hydrationToken\)/g) || [];

  assert.match(tabActivationRuntimeSource, /const hydrationToken = \+\+tabHydrationToken;/);
  assert.match(scheduleSource, /attachActiveTabRuntime\(\{[\s\S]*hydrationToken,[\s\S]*\}\)/);
  assert.ok(guardMatches.length >= 4, "expected repeated hydration token guards in attachActiveTabRuntime");
});

test("tab switching does not perform immediate visual-prompt writes, PTY probes, or deferred-ui rebuilds on the click path", () => {
  const activateTabSource = extractFunctionSource("activateTab", tabActivationRuntimeSource);
  const attachSource = extractFunctionSource("attachActiveTabRuntime", tabActivationRuntimeSource);

  assert.equal(activateTabSource.includes("scheduleVisualPromptWrite"), false);
  assert.equal(activateTabSource.includes("syncActiveRunPtyBinding"), false);
  assert.equal(activateTabSource.includes("startEventsPolling"), false);
  assert.equal(activateTabSource.includes('invoke("get_pty_status")'), false);
  assert.equal(activateTabSource.includes("renderFilmstrip"), false);
  assert.equal(activateTabSource.includes("renderTimeline"), false);
  assert.equal(activateTabSource.includes("renderQuickActions"), false);
  assert.equal(attachSource.includes("scheduleVisualPromptWrite"), false);
});

test("tab hydration renders quick actions through chooseSpawnNodes without a duplicate direct render in attachActiveTabRuntime", () => {
  const attachSource = extractFunctionSource("attachActiveTabRuntime", tabActivationRuntimeSource);
  const chooseSpawnNodesSource = extractFunctionSource("chooseSpawnNodes");

  assert.equal(attachSource.includes("renderQuickActions"), false);
  assert.match(attachSource, /renderFilmstrip\(\);[\s\S]*chooseSpawnNodes\(\);[\s\S]*renderSessionApiCallsReadout\(\);/);
  assert.ok((chooseSpawnNodesSource.match(/renderQuickActions\(\);/g) || []).length >= 1);
});

test("create and open paths rely on activateTab's single hydration schedule instead of scheduling their own follow-up hydrations", () => {
  const createRunSource = extractFunctionSource("createRun", runProvisioningSource);
  const openExistingRunSource = extractFunctionSource("openExistingRun", runProvisioningSource);

  assert.equal(createRunSource.includes("scheduleTabHydration"), false);
  assert.equal(openExistingRunSource.includes("scheduleTabHydration"), false);
  assert.match(
    createRunSource,
    /const result = await activateTab\(tabId, \{[\s\S]*spawnEngine: true,[\s\S]*reason: "new_run_tab",?[\s\S]*\}\);[\s\S]*if \(result\?\.hydration\) await result\.hydration;/
  );
  assert.match(
    openExistingRunSource,
    /const activation = await activateTab\(tabId, \{ spawnEngine: false, reason: "open_run_tab" \}\);[\s\S]*if \(activation\?\.hydration\) await activation\.hydration;/
  );
});

test("tab metadata reads stay pure and do not capture the active session", () => {
  const getTabsSnapshotSource = extractFunctionSource("getTabsSnapshot");
  const listTabsSource = extractFunctionSource("listTabs");
  const subscribeTabsSource = extractFunctionSource("subscribeTabs");
  const publishSource = extractFunctionSource("publishTabbedSessionsSnapshot");

  assert.equal(getTabsSnapshotSource.includes("syncActiveTabRecord"), false);
  assert.equal(getTabsSnapshotSource.includes("capture: true"), false);
  assert.equal(listTabsSource.includes("syncActiveTabRecord"), false);
  assert.equal(subscribeTabsSource.includes("syncActiveTabRecord"), false);
  assert.match(subscribeTabsSource, /tabbedSessions\.subscribe\(\(snapshot\) => \{\s*listener\(getTabsSnapshot\(snapshot\)\);/);
  assert.match(publishSource, /tabs:\s*snapshot\.tabs\.slice\(\)/);
  assert.equal(publishSource.includes("tabs: listTabs()"), false);
});

test("tab activation keeps tab metadata off the fast path while explicit switch-away capture remains", () => {
  const activateSource = extractFunctionSource("activateTab", tabActivationRuntimeSource);
  const closeSource = extractFunctionSource("closeTab", tabLifecycleRuntimeSource);

  assert.equal(activateSource.includes("tabs: listTabs()"), false);
  assert.match(activateSource, /syncActiveTabRecord\(\{ capture: true, publish: true \}\);/);
  assert.match(activateSource, /syncActiveTabRecord\(\{ capture: false, publish: true \}\);/);
  assert.match(closeSource, /syncActiveTabRecord\(\{ capture: true, publish: true \}\);/);
});

test("preview invalidation clears stale merged snapshots and marks the session preview invalid", () => {
  const invalidateSource = extractFunctionSource("invalidateActiveTabPreview", tabPreviewRuntimeSource);
  const paintSource = extractFunctionSource("paintTabPreviewEntry", tabPreviewRuntimeSource);
  const entrySource = extractFunctionSource("canUseTabPreviewEntry", tabPreviewRuntimeSource);

  assert.match(invalidateSource, /clearScheduledTabPreviewCapture\(\)/);
  assert.match(invalidateSource, /tabPreviewCache\.delete\(normalizedTabId\)/);
  assert.match(invalidateSource, /valid:\s*false/);
  assert.match(invalidateSource, /state\.tabPreviewDirty = true/);
  assert.match(paintSource, /wctx\.drawImage\(source,\s*0,\s*0,\s*work\.width,\s*work\.height\)/);
  assert.match(paintSource, /hideImageFxOverlays\(\)/);
  assert.match(entrySource, /entry\.canvasWidth/);
  assert.match(entrySource, /entry\.canvasHeight/);
  assert.match(entrySource, /entry\.dpr/);
  assert.match(entrySource, /entry\.viewportKey/);
  assert.match(entrySource, /entry\.visualVersion/);
});

test("deferred hydration surfaces are individually gated by stable render signatures", () => {
  const renderFilmstripSource = extractFunctionSource("renderFilmstrip");
  const renderTimelineWrapperSource = extractFunctionSource("renderTimeline");
  const renderTimelineSource = extractFunctionSource("renderTimeline", timelineUiSource);
  const chooseSpawnNodesSource = extractFunctionSource("chooseSpawnNodes");
  const quickActionsSignatureSource = extractFunctionSource("quickActionsRenderSignature");
  const renderQuickActionsSource = extractFunctionSource("renderQuickActions");
  const renderCustomToolDockSource = extractFunctionSource("renderCustomToolDock");

  assert.match(renderFilmstripSource, /state\.lastRenderedFilmstripKey === nextDataKey/);
  assert.match(renderFilmstripSource, /state\.lastRenderedFilmstripSelectionKey === nextSelectionKey/);
  assert.match(renderTimelineWrapperSource, /return timelineUi\.renderTimeline\(\);/);
  assert.match(renderTimelineSource, /state\.lastRenderedTimelineStructureKey !== structureKey/);
  assert.match(renderTimelineSource, /state\.lastRenderedTimelineViewKey !== viewKey/);
  assert.match(chooseSpawnNodesSource, /state\.lastRenderedSpawnNodesKey === nextKey/);
  assert.match(quickActionsSignatureSource, /juggernautActiveToolId\(\)/);
  assert.match(renderQuickActionsSource, /state\.lastRenderedQuickActionsKey === nextKey/);
  assert.match(renderCustomToolDockSource, /state\.lastRenderedCustomToolDockKey === nextKey/);
});
