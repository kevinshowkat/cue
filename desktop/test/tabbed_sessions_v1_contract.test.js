import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const currentDesktopRoot = resolve(here, "..");
const siblingCoreDesktopRoot = resolve(currentDesktopRoot, "..", "..", "juggernaut-tabs-core", "desktop");

function resolveSourceDesktopRoot() {
  const requested = process.env.JUGGERNAUT_TABS_SOURCE_ROOT
    ? resolve(process.env.JUGGERNAUT_TABS_SOURCE_ROOT)
    : null;
  const candidates = [requested, currentDesktopRoot, siblingCoreDesktopRoot].filter(Boolean);
  return (
    candidates.find((desktopRoot) => {
      return existsSync(join(desktopRoot, "src", "canvas_app.js")) && existsSync(join(desktopRoot, "src", "tabbed_sessions.js"));
    }) || currentDesktopRoot
  );
}

const sourceDesktopRoot = resolveSourceDesktopRoot();
const appPath = join(sourceDesktopRoot, "src", "canvas_app.js");
const bridgePath = join(sourceDesktopRoot, "src", "app", "desktop_session_bridge.js");
const engineRuntimePath = join(sourceDesktopRoot, "src", "app", "engine_runtime.js");
const runProvisioningPath = join(sourceDesktopRoot, "src", "app", "run_provisioning.js");
const sessionPersistencePath = join(sourceDesktopRoot, "src", "app", "session_persistence.js");
const tabActivationRuntimePath = join(sourceDesktopRoot, "src", "app", "tab_activation_runtime.js");
const tabLifecycleRuntimePath = join(sourceDesktopRoot, "src", "app", "tab_lifecycle_runtime.js");
const tabSessionStatePath = join(sourceDesktopRoot, "src", "app", "tab_session_state.js");
const tabsPath = join(sourceDesktopRoot, "src", "tabbed_sessions.js");
const app = readFileSync(appPath, "utf8");
const bridgeSource = readFileSync(bridgePath, "utf8");
const engineRuntimeSource = readFileSync(engineRuntimePath, "utf8");
const runProvisioningSource = readFileSync(runProvisioningPath, "utf8");
const sessionPersistenceSource = readFileSync(sessionPersistencePath, "utf8");
const tabActivationRuntimeSource = readFileSync(tabActivationRuntimePath, "utf8");
const tabLifecycleRuntimeSource = readFileSync(tabLifecycleRuntimePath, "utf8");
const tabSessionStateSource = readFileSync(tabSessionStatePath, "utf8");

async function loadTabbedSessionsModule() {
  return import(`${pathToFileURL(tabsPath).href}?source=${Date.now()}`);
}

test("tabbed session store preserves the current tab until activation and closing an inactive tab only removes that shell session", async () => {
  const { createTabbedSessionsStore } = await loadTabbedSessionsModule();
  const store = createTabbedSessionsStore();

  store.upsertTab({ tabId: "tab-a", label: "Run A", runDir: "/runs/a" }, { activate: true });
  store.upsertTab({ tabId: "tab-b", label: "Run B", runDir: "/runs/b" }, { activate: false });

  assert.equal(store.activeTabId, "tab-a");
  assert.deepEqual(
    store.listTabs().map((tab) => tab.tabId),
    ["tab-a", "tab-b"]
  );
  assert.equal(store.listTabs()[0].schemaVersion, "session-tab-v1");
  assert.equal(store.listTabs()[0].title, "Run A");
  assert.equal(store.listTabs()[0].active, true);
  assert.equal(store.listTabs()[0].isActive, true);
  assert.equal(store.listTabs()[1].active, false);
  assert.equal(store.listTabs()[1].isActive, false);

  const closed = store.closeTab("tab-b", { activateNeighbor: false });

  assert.equal(closed?.closed?.tabId, "tab-b");
  assert.equal(closed?.nextActiveId, "tab-a");
  assert.equal(store.activeTabId, "tab-a");
  assert.deepEqual(
    store.listTabs().map((tab) => tab.tabId),
    ["tab-a"]
  );
});

test("canvas app routes New Run and Open Run into fresh tabs instead of wiping the current shell session", () => {
  assert.match(
    runProvisioningSource,
    /async function createRun\(\{[\s\S]*announce = true,[\s\S]*source = "new_run"[\s\S]*\} = \{\}\) \{[\s\S]*const tabId = createTabId\(\);[\s\S]*tabbedSessions\.upsertTab\([\s\S]*runDir: payload\.run_dir,[\s\S]*eventsPath: payload\.events_path,[\s\S]*\{\s*activate: false\s*\}[\s\S]*activateTab\(tabId, \{[\s\S]*spawnEngine: true,[\s\S]*reason: "new_run_tab",?[\s\S]*\}\);/
  );
  assert.match(
    runProvisioningSource,
    /async function openExistingRun\(\) \{[\s\S]*const tabId = createTabId\(\);[\s\S]*let restoredTimeline = null;[\s\S]*let restoredSnapshot = null;[\s\S]*const timelinePath = await sessionTimelinePathForRunDir\(selected\);[\s\S]*const snapshotPath = await sessionSnapshotPathForRunDir\(selected\);[\s\S]*const legacySnapshotPath = await legacySessionSnapshotPathForRunDir\(selected\);[\s\S]*tabbedSessions\.upsertTab\([\s\S]*runDir: session\.runDir \|\| selected,[\s\S]*eventsPath: session\.eventsPath \|\| defaultEventsPath,[\s\S]*\{\s*activate: false\s*\}[\s\S]*activateTab\(tabId, \{ spawnEngine: false, reason: "open_run_tab" \}\);/
  );
  assert.match(
    runProvisioningSource,
    /if \(restoredTimeline\) \{[\s\S]*showToast\(`Opened \$\{tabLabel\} from the saved session timeline\.`, "tip", 3200\);/
  );
  assert.match(
    runProvisioningSource,
    /if \(restoredSnapshot\?\.session\) \{[\s\S]*showToast\(`Opened \$\{tabLabel\} from the saved session snapshot\.`, "tip", 3200\);/
  );
  assert.match(
    tabActivationRuntimeSource,
    /if \(state\.activeTabId\) \{[\s\S]*suspendActiveTabRuntimeForSwitch\(\);[\s\S]*syncActiveTabRecord\(\{ capture: true, publish: true \}\);[\s\S]*\}/
  );
});

test("session reopen helpers prefer canonical session.json writes and keep legacy juggernaut-session.json as a read fallback", () => {
  assert.match(
    app,
    /const SESSION_SNAPSHOT_FILENAME = "session\.json";[\s\S]*const LEGACY_SESSION_SNAPSHOT_FILENAME = "juggernaut-session\.json";/
  );
  assert.match(
    sessionPersistenceSource,
    /async function sessionSnapshotPathForRunDir\(runDir = ""\) \{[\s\S]*sessionSnapshotFilename/
  );
  assert.match(
    sessionPersistenceSource,
    /async function legacySessionSnapshotPathForRunDir\(runDir = ""\) \{[\s\S]*legacySessionSnapshotFilename/
  );
  assert.match(
    sessionPersistenceSource,
    /async function saveActiveSessionSnapshot\(\{ source = "menu" \} = \{\}\) \{[\s\S]*const outPath = await sessionSnapshotPathForRunDir\(session\.runDir \|\| state\.runDir \|\| ""\);/
  );
  assert.match(
    runProvisioningSource,
    /async function openExistingRun\(\) \{[\s\S]*const timelinePath = await sessionTimelinePathForRunDir\(selected\);[\s\S]*const snapshotPath = await sessionSnapshotPathForRunDir\(selected\);[\s\S]*const legacySnapshotPath = await legacySessionSnapshotPathForRunDir\(selected\);[\s\S]*if \(!restoredTimeline && snapshotPath && \(await existsFn\(snapshotPath\)\.catch\(\(\) => false\)\)\) \{[\s\S]*if \(!restoredTimeline && !restoredSnapshot && legacySnapshotPath && \(await existsFn\(legacySnapshotPath\)\.catch\(\(\) => false\)\)\) \{/
  );
});

test("forking the active tab clones the visible session into a detached sibling tab", () => {
  assert.match(
    app,
    /function createForkedTabSession\(session = null,\s*\{ label = null \} = \{\}\) \{[\s\S]*const sourceSessionTools =[\s\S]*cloneSessionValue\([\s\S]*toolRegistry: null,[\s\S]*eventsDecoder: null,[\s\S]*\)/
  );
  assert.match(
    app,
    /function createForkedTabSession\(session = null,\s*\{ label = null \} = \{\}\) \{[\s\S]*next\.forkedFromTabId = String\(cloned\.forkedFromTabId \|\| source\.forkedFromTabId \|\| ""\)\.trim\(\) \|\| null;[\s\S]*next\.communication = sanitizeForkedCommunicationState\(cloned\.communication\);[\s\S]*next\.designReviewApply = createFreshDesignReviewApplyState\(\);[\s\S]*next\.reviewFlowState = currentSessionTabReviewFlowState\(\{[\s\S]*communication: next\.communication,[\s\S]*designReviewApply: next\.designReviewApply,[\s\S]*\}\);[\s\S]*next\.toolRegistry = createInSessionToolRegistry\([\s\S]*next\.sessionTools = next\.toolRegistry\.list\(\);[\s\S]*next\.runDir = null;[\s\S]*next\.eventsPath = null;[\s\S]*next\.eventsByteOffset = 0;/
  );
  assert.match(
    tabLifecycleRuntimeSource,
    /async function forkActiveTab\(\) \{[\s\S]*const sourceLabel = sessionTabDisplayLabel\(sourceRecord,\s*defaultUntitledTabTitle\);[\s\S]*const forkLabel = buildSessionTabForkLabel\(sourceRecord\);[\s\S]*const session = createForkedTabSession\(sourceRecord\.session \|\| createFreshTabSession\(\), \{ label: forkLabel \}\);[\s\S]*session\.forkedFromTabId = activeTabId;[\s\S]*const sourceIndex = tabbedSessions\.tabsOrder\.indexOf\(activeTabId\);[\s\S]*const insertIndex = sourceIndex >= 0 \? sourceIndex \+ 1 : tabbedSessions\.tabsOrder\.length;[\s\S]*tabbedSessions\.upsertTab\([\s\S]*labelManual: true,[\s\S]*forkedFromTabId: activeTabId,[\s\S]*runDir: null,[\s\S]*eventsPath: null,[\s\S]*\{\s*activate: false,\s*index: insertIndex\s*\}[\s\S]*activateTab\(tabId,\s*\{\s*spawnEngine: false,\s*reason: "fork_tab"\s*\}\)/
  );
});

test("activating a tab captures and restores image, selection, run, and session-local runtime state", () => {
  assert.match(
    tabSessionStateSource,
    /function captureActiveTabSession\(session = null\) \{[\s\S]*next\.runDir = state\.runDir \|\| null;[\s\S]*next\.eventsPath = state\.eventsPath \|\| null;[\s\S]*next\.images = Array\.isArray\(state\.images\) \? state\.images : \[\];[\s\S]*next\.activeId = state\.activeId \? String\(state\.activeId\) : null;[\s\S]*next\.selectedIds = Array\.isArray\(state\.selectedIds\) \? state\.selectedIds\.slice\(\) : \[\];[\s\S]*next\.freeformRects = state\.freeformRects instanceof Map \? state\.freeformRects : new Map\(\);[\s\S]*next\.toolRegistry =[\s\S]*next\.topMetrics = state\.topMetrics[\s\S]*next\.lastStatusText = String\(state\.lastStatusText \|\| "Engine: idle"\);/
  );
  assert.match(
    tabSessionStateSource,
    /function bindTabSessionToState\(session = null\) \{[\s\S]*state\.runDir = current\.runDir \|\| null;[\s\S]*state\.eventsPath = current\.eventsPath \|\| null;[\s\S]*state\.images = Array\.isArray\(current\.images\) \? current\.images : \[\];[\s\S]*state\.activeId = current\.activeId \? String\(current\.activeId\) : null;[\s\S]*state\.selectedIds = Array\.isArray\(current\.selectedIds\) \? current\.selectedIds\.slice\(\) : \[\];[\s\S]*state\.freeformRects = current\.freeformRects instanceof Map \? current\.freeformRects : new Map\(\);[\s\S]*setSessionToolRegistry\(sessionToolRegistry\);[\s\S]*state\.topMetrics =[\s\S]*state\.lastStatusText = String\(current\.lastStatusText \|\| "Engine: idle"\);/
  );
  assert.match(
    tabSessionStateSource,
    /function syncActiveTabRecord\(\{ capture = false, publish = false \} = \{\}\) \{[\s\S]*const record = tabbedSessions\.getTab\(tabId\);[\s\S]*if \(capture\) \{[\s\S]*record\.session = captureActiveTabSession\(record\.session\);[\s\S]*\}[\s\S]*record\.runDir = state\.runDir \|\| record\.session\?\.runDir \|\| record\.runDir \|\| null;[\s\S]*record\.busy = Boolean\(currentTabSwitchBlockReason\(\)\);[\s\S]*record\.updatedAt = now\(\);/
  );
  assert.match(
    tabActivationRuntimeSource,
    /target\.session = target\.session \|\| createFreshTabSession\([\s\S]*bindTabSessionToState\(target\.session\);[\s\S]*tabbedSessions\.setActiveTab\(normalized\);/
  );
});

test("busy active tabs block tab switching with the implemented v1 reasons", () => {
  assert.match(
    app,
    /function currentTabSwitchBlockReason\(\{ allowReviewApply = false \} = \{\}\) \{[\s\S]*return "manipulating_canvas";[\s\S]*return "review_apply";[\s\S]*return "assistant_busy";[\s\S]*return "queued_actions";[\s\S]*isEngineBusy\(\{ includeReviewApply: !allowReviewApply \}\)\) return "engine_busy";[\s\S]*return null;[\s\S]*\}/
  );
  assert.match(
    tabActivationRuntimeSource,
    /async function activateTab\(tabId, \{ spawnEngine = false, reason = "tab_activate", engineFailureToast = true \} = \{\}\) \{[\s\S]*const blockReason = currentTabSwitchBlockReason\(\{ allowReviewApply: true \}\);[\s\S]*showToast\(currentTabSwitchBlockMessage\(blockReason\), "tip", 2200\);[\s\S]*return finalize\(\s*\{ ok: false, reason: blockReason, activeTabId: state\.activeTabId \|\| null \},\s*\{ ok: false, reason: blockReason \}\s*\);/
  );
  assert.match(
    tabLifecycleRuntimeSource,
    /async function closeTab\(tabId\) \{[\s\S]*const targetRecord = tabbedSessions\.getTab\(normalized\) \|\| null;[\s\S]*if \(sessionTabHasRunningReviewApply\(targetRecord\)\) \{[\s\S]*reason: "review_apply"[\s\S]*if \(normalized === String\(state\.activeTabId \|\| ""\)\.trim\(\)\) \{[\s\S]*const blockReason = currentTabSwitchBlockReason\(\);[\s\S]*showToast\(currentTabSwitchBlockMessage\(blockReason\), "tip", 2200\);[\s\S]*return \{ ok: false, reason: blockReason, tabs: snapshot\.tabs \};/
  );
});

test("inactive tabs drop live polling and realtime engine attachments in v1", () => {
  assert.match(
    tabActivationRuntimeSource,
    /function suspendActiveTabRuntimeForSwitch\(\) \{[\s\S]*const activeRunDir = String\(state\.runDir \|\| ""\)\.trim\(\);[\s\S]*stopEventsPolling\(\);[\s\S]*resetDescribeQueue\(\{ clearPending: true \}\);[\s\S]*Promise\.allSettled\(\[[\s\S]*invoke\("write_pty", \{ data: `\$\{PTY_COMMANDS\.INTENT_RT_STOP\}\\n` \}\),[\s\S]*invoke\("write_pty", \{ data: `\$\{PTY_COMMANDS\.INTENT_RT_MOTHER_STOP\}\\n` \}\),[\s\S]*stopDesktopSession\(\s*tauriInvoke,\s*buildDesktopSessionStopRequest\(\{ runDir: activeRunDir \}\)\s*\)\.catch\(\(\) => \{\}\);/
  );
  assert.match(app, /function startEventsPolling\(\) \{[\s\S]*if \(!state\.activeTabId \|\| !state\.runDir\) return;/);
  assert.match(
    app,
    /function startEventsPolling\(\) \{[\s\S]*?const pollToken = \+\+activeEventsPollToken;[\s\S]*?state\.poller = \{\s*source: "desktop_session_update",\s*token: pollToken,\s*runDir: state\.runDir,\s*\};\s*\}/
  );
  assert.doesNotMatch(app, /function startEventsPolling\(\) \{[\s\S]*?if \(!state\.eventsPath\) return;[\s\S]*?\}\s*function stopEventsPolling/);
  assert.doesNotMatch(app, /invoke\("read_file_since", \{/);
  assert.match(
    bridgeSource,
    /if \(update\.kind === desktopSessionUpdateKinds\.EVENT && update\.event\) \{[\s\S]*await handleEvent\(update\.event\);[\s\S]*\}/
  );
  assert.match(
    engineRuntimeSource,
    /async function ensureEngineSpawned\(\{ reason = "engine", showToastOnFailure = true \} = \{\}\) \{[\s\S]*await spawnEngine\(\);[\s\S]*if \(state\.ptySpawned\) startEventsPolling\(\);/
  );
  assert.match(tabSessionStateSource, /state\.intentAmbient\.enabled = false;/);
});
