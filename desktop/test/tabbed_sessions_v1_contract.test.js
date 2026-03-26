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
const tabsPath = join(sourceDesktopRoot, "src", "tabbed_sessions.js");
const app = readFileSync(appPath, "utf8");

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
  assert.equal(store.listTabs()[0].active, true);
  assert.equal(store.listTabs()[1].active, false);

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
    app,
    /async function createRun\(\{[\s\S]*announce = true,[\s\S]*source = "new_run"[\s\S]*\} = \{\}\) \{[\s\S]*const tabId = createTabId\(\);[\s\S]*tabbedSessions\.upsertTab\([\s\S]*runDir: payload\.run_dir,[\s\S]*eventsPath: payload\.events_path,[\s\S]*\{\s*activate: false\s*\}[\s\S]*activateTab\(tabId, \{[\s\S]*spawnEngine: true,[\s\S]*reason: "new_run_tab",?[\s\S]*\}\);/
  );
  assert.match(
    app,
    /async function openExistingRun\(\) \{[\s\S]*const tabId = createTabId\(\);[\s\S]*tabbedSessions\.upsertTab\([\s\S]*runDir: selected,[\s\S]*eventsPath: `\$\{selected\}\/events\.jsonl`,[\s\S]*\{\s*activate: false\s*\}[\s\S]*activateTab\(tabId, \{ spawnEngine: false, reason: "open_run_tab" \}\);/
  );
  assert.match(
    app,
    /if \(state\.activeTabId\) \{[\s\S]*suspendActiveTabRuntimeForSwitch\(\);[\s\S]*syncActiveTabRecord\(\{ capture: true, publish: true \}\);[\s\S]*\}/
  );
});

test("activating a tab captures and restores image, selection, run, and session-local runtime state", () => {
  assert.match(
    app,
    /function captureActiveTabSession\(session = null\) \{[\s\S]*next\.runDir = state\.runDir \|\| null;[\s\S]*next\.eventsPath = state\.eventsPath \|\| null;[\s\S]*next\.images = Array\.isArray\(state\.images\) \? state\.images : \[\];[\s\S]*next\.activeId = state\.activeId \? String\(state\.activeId\) : null;[\s\S]*next\.selectedIds = Array\.isArray\(state\.selectedIds\) \? state\.selectedIds\.slice\(\) : \[\];[\s\S]*next\.freeformRects = state\.freeformRects instanceof Map \? state\.freeformRects : new Map\(\);[\s\S]*next\.toolRegistry =[\s\S]*next\.topMetrics = state\.topMetrics[\s\S]*next\.lastStatusText = String\(state\.lastStatusText \|\| "Engine: idle"\);/
  );
  assert.match(
    app,
    /function bindTabSessionToState\(session = null\) \{[\s\S]*state\.runDir = current\.runDir \|\| null;[\s\S]*state\.eventsPath = current\.eventsPath \|\| null;[\s\S]*state\.images = Array\.isArray\(current\.images\) \? current\.images : \[\];[\s\S]*state\.activeId = current\.activeId \? String\(current\.activeId\) : null;[\s\S]*state\.selectedIds = Array\.isArray\(current\.selectedIds\) \? current\.selectedIds\.slice\(\) : \[\];[\s\S]*state\.freeformRects = current\.freeformRects instanceof Map \? current\.freeformRects : new Map\(\);[\s\S]*sessionToolRegistry =[\s\S]*state\.topMetrics =[\s\S]*state\.lastStatusText = String\(current\.lastStatusText \|\| "Engine: idle"\);/
  );
  assert.match(
    app,
    /target\.session = target\.session \|\| createFreshTabSession\([\s\S]*bindTabSessionToState\(target\.session\);[\s\S]*tabbedSessions\.setActiveTab\(normalized\);/
  );
});

test("busy active tabs block tab switching with the implemented v1 reasons", () => {
  assert.match(
    app,
    /function currentTabSwitchBlockReason\(\{ allowReviewApply = false \} = \{\}\) \{[\s\S]*return "manipulating_canvas";[\s\S]*return "review_apply";[\s\S]*return "assistant_busy";[\s\S]*return "queued_actions";[\s\S]*isEngineBusy\(\{ includeReviewApply: !allowReviewApply \}\)\) return "engine_busy";[\s\S]*return null;[\s\S]*\}/
  );
  assert.match(
    app,
    /async function activateTab\(tabId, \{ spawnEngine = false, reason = "tab_activate", engineFailureToast = true \} = \{\}\) \{[\s\S]*const blockReason = currentTabSwitchBlockReason\(\{ allowReviewApply: true \}\);[\s\S]*showToast\(currentTabSwitchBlockMessage\(blockReason\), "tip", 2200\);[\s\S]*return finalize\(\s*\{ ok: false, reason: blockReason, activeTabId: state\.activeTabId \|\| null \},\s*\{ ok: false, reason: blockReason \}\s*\);/
  );
  assert.match(
    app,
    /async function closeTab\(tabId\) \{[\s\S]*const targetRecord = tabbedSessions\.getTab\(normalized\) \|\| null;[\s\S]*if \(sessionTabHasRunningReviewApply\(targetRecord\)\) \{[\s\S]*reason: "review_apply"[\s\S]*if \(normalized === String\(state\.activeTabId \|\| ""\)\.trim\(\)\) \{[\s\S]*const blockReason = currentTabSwitchBlockReason\(\);[\s\S]*showToast\(currentTabSwitchBlockMessage\(blockReason\), "tip", 2200\);[\s\S]*return \{ ok: false, reason: blockReason, tabs: snapshot\.tabs \};/
  );
});

test("inactive tabs drop live polling and realtime engine attachments in v1", () => {
  assert.match(
    app,
    /function suspendActiveTabRuntimeForSwitch\(\) \{[\s\S]*stopEventsPolling\(\);[\s\S]*resetDescribeQueue\(\{ clearPending: true \}\);[\s\S]*invoke\("write_pty", \{ data: `\$\{PTY_COMMANDS\.INTENT_RT_STOP\}\\n` \}\)\.catch\(\(\) => \{\}\);[\s\S]*invoke\("write_pty", \{ data: `\$\{PTY_COMMANDS\.INTENT_RT_MOTHER_STOP\}\\n` \}\)\.catch\(\(\) => \{\}\);/
  );
  assert.match(app, /function startEventsPolling\(\) \{[\s\S]*if \(!state\.activeTabId \|\| !state\.eventsPath\) return;/);
  assert.match(app, /await spawnEngine\(\);[\s\S]*startEventsPolling\(\);/);
  assert.match(app, /state\.intentAmbient\.enabled = false;/);
});
