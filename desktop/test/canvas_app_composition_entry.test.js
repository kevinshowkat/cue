import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(here, "..", "src", "canvas_app.js"), "utf8");

test("canvas app entrypoint boots through the composition root with explicit bridge installation", () => {
  assert.match(app, /import \{ createCanvasApp \} from "\.\/app\/create_canvas_app\.js"/);
  assert.match(app, /import \{ createCanvasAppDesktopEventRouter \} from "\.\/app\/event_router\.js"/);
  assert.match(app, /import \{ runCanvasAppBootReadySequence \} from "\.\/app\/boot_ready\.js"/);
  assert.match(app, /import \{ installCanvasAppBootRuntime \} from "\.\/app\/boot_runtime\.js"/);
  assert.match(app, /import \{ runCanvasAppBootShellSetup \} from "\.\/app\/boot_shell\.js"/);
  assert.match(app, /import \{\s*adaptCanvasAppDesktopSessionStatusResponse,\s*createCanvasAppEngineRuntime,\s*\} from "\.\/app\/engine_runtime\.js"/);
  assert.match(app, /import \{ createCanvasAppRunProvisioning \} from "\.\/app\/run_provisioning\.js"/);
  assert.match(app, /import \{ createCanvasAppSessionPersistence \} from "\.\/app\/session_persistence\.js"/);
  assert.match(app, /import \{ createCanvasAppTabActivationRuntime \} from "\.\/app\/tab_activation_runtime\.js"/);
  assert.match(app, /import \{ createCanvasAppTabLifecycleRuntime \} from "\.\/app\/tab_lifecycle_runtime\.js"/);
  assert.match(app, /import \{ createCanvasAppTabPreviewRuntime \} from "\.\/app\/tab_preview_runtime\.js"/);
  assert.match(app, /import \{ createCanvasAppTabSessionStateAdapter \} from "\.\/app\/tab_session_state\.js"/);
  assert.match(app, /import \{\s*createCanvasAppNativeMenuActionBridge,\s*createNativeMenuRuntime,\s*\} from "\.\/app\/native_menu_runtime\.js";/);
  assert.match(app, /const legacyCanvasAppSettingsStore = Object\.freeze\(\{/);
  assert.match(app, /return adaptCanvasAppDesktopSessionStatusResponse\(response, runDir\);/);
  assert.match(app, /const canvasAppEngineRuntime = createCanvasAppEngineRuntime\(\{[\s\S]*buildDesktopSessionStartRequest,[\s\S]*startDesktopSession,[\s\S]*readPtyStatus,[\s\S]*ptyStatusMatchesActiveRun,[\s\S]*writeCanvasRuntimePty,[\s\S]*getActiveImage,[\s\S]*setStatus,[\s\S]*startEventsPolling,[\s\S]*showToast,[\s\S]*getFlushDeferredEnginePtyExit\(\) \{[\s\S]*return flushDeferredEnginePtyExit;[\s\S]*\},[\s\S]*processActionQueue,[\s\S]*\}\);/);
  assert.match(app, /const \{\s*syncActiveRunPtyBinding,\s*ensureEngineSpawned,\s*spawnEngine,\s*\} = canvasAppEngineRuntime;/);
  assert.match(app, /const canvasAppTabSessionStateAdapter = createCanvasAppTabSessionStateAdapter\(\{[\s\S]*settings,[\s\S]*tabbedSessions,[\s\S]*createFreshTabSession,[\s\S]*currentSessionTabReviewFlowState,[\s\S]*createFreshCommunicationState,[\s\S]*cloneDesignReviewApplyState,[\s\S]*cloneToolRuntimeValue,[\s\S]*createInSessionToolRegistry,[\s\S]*normalizeTabPreviewState,[\s\S]*createTabMotherState,[\s\S]*createTabMotherIdleState,[\s\S]*createTabIntentState,[\s\S]*createTabIntentAmbientState,[\s\S]*createTabAlwaysOnVisionState,[\s\S]*createTabTopMetricsState,[\s\S]*buildActiveTabUiMeta,[\s\S]*normalizeTabUiMeta,[\s\S]*applyTabUiMetaToState,[\s\S]*tabUiMetaSignature,[\s\S]*sessionTabAutomaticLabelForRecord,[\s\S]*normalizeSessionTabTitleInput,[\s\S]*normalizeSessionTabReviewFlowState,[\s\S]*currentTabSwitchBlockReason,[\s\S]*getFallbackLineOffset\(\) \{[\s\S]*return fallbackLineOffset;[\s\S]*\},[\s\S]*setFallbackLineOffset\(nextOffset\) \{[\s\S]*fallbackLineOffset = nextOffset;[\s\S]*\},[\s\S]*getSessionToolRegistry\(\) \{[\s\S]*return sessionToolRegistry;[\s\S]*\},[\s\S]*setSessionToolRegistry\(nextRegistry\) \{[\s\S]*sessionToolRegistry = nextRegistry;[\s\S]*\},[\s\S]*sessionTabTitleMaxLength:\s*SESSION_TAB_TITLE_MAX_LENGTH,[\s\S]*defaultUntitledTabTitle:\s*DEFAULT_UNTITLED_TAB_TITLE,[\s\S]*defaultTip:\s*DEFAULT_TIP,[\s\S]*\}\);/);
  assert.match(app, /const canvasAppTabActivationRuntime = createCanvasAppTabActivationRuntime\(\{[\s\S]*state,[\s\S]*els,[\s\S]*tabbedSessions,[\s\S]*createFreshTabSession,[\s\S]*bindTabSessionToState,[\s\S]*syncActiveTabRecord,[\s\S]*currentTabSwitchBlockReason,[\s\S]*currentTabSwitchBlockMessage,[\s\S]*showToast,[\s\S]*syncActiveTabPreviewRuntime\(\.\.\.args\)\s*\{[\s\S]*canvasAppTabPreviewRuntime\.syncActiveTabPreviewRuntime\(\.\.\.args\);[\s\S]*\},[\s\S]*syncLocalMagicSelectUiPrewarmTargets,[\s\S]*setRunInfo,[\s\S]*setTip,[\s\S]*setDirectorText,[\s\S]*updateEmptyCanvasHint,[\s\S]*syncTimelineDockVisibility,[\s\S]*requestRender:\s*requestCanvasRender,[\s\S]*releaseLocalMagicSelectUiPrewarmForTab,[\s\S]*stopEventsPolling,[\s\S]*resetDescribeQueue,[\s\S]*stopIntentTicker,[\s\S]*clearTabScopedIntentTimers,[\s\S]*clearAmbientIntentTimers,[\s\S]*clearMotherIdleTimers,[\s\S]*clearMotherIdleDispatchTimeout,[\s\S]*invoke,[\s\S]*PTY_COMMANDS,[\s\S]*tauriInvoke,[\s\S]*buildDesktopSessionStopRequest,[\s\S]*stopDesktopSession,[\s\S]*hideImageMenu,[\s\S]*hideAnnotatePanel,[\s\S]*hidePromptGeneratePanel,[\s\S]*hideCreateToolPanel,[\s\S]*hideMarkPanel,[\s\S]*closeMotherWheelMenu,[\s\S]*startPerfSample,[\s\S]*finishPerfSample,[\s\S]*syncSessionToolsFromRegistry,[\s\S]*renderCreateToolPreview,[\s\S]*renderCustomToolDock,[\s\S]*renderSelectionMeta,[\s\S]*renderFilmstrip,[\s\S]*chooseSpawnNodes,[\s\S]*renderSessionApiCallsReadout,[\s\S]*syncIntentModeClass,[\s\S]*syncJuggernautShellState,[\s\S]*applyRuntimeChromeVisibility,[\s\S]*renderMotherMoodStatus,[\s\S]*renderTimeline,[\s\S]*ensureEngineSpawned,[\s\S]*syncActiveRunPtyBinding,[\s\S]*startEventsPolling,[\s\S]*setStatus,[\s\S]*defaultTip:\s*DEFAULT_TIP,[\s\S]*tabHydrationIdleTimeoutMs:\s*TAB_HYDRATION_IDLE_TIMEOUT_MS,[\s\S]*\}\);/);
  assert.match(app, /const canvasAppTabPreviewRuntime = createCanvasAppTabPreviewRuntime\(\{[\s\S]*state,[\s\S]*els,[\s\S]*tabbedSessions,[\s\S]*createFreshTabPreviewState,[\s\S]*normalizeTabPreviewState,[\s\S]*getDpr,[\s\S]*hideImageFxOverlays,[\s\S]*shouldAnimateEffectVisuals,[\s\S]*startPerfSample,[\s\S]*finishPerfSample,[\s\S]*requestRender:\s*requestCanvasRender,[\s\S]*tabPreviewCaptureSettleMs:\s*TAB_PREVIEW_CAPTURE_SETTLE_MS,[\s\S]*tabPreviewMaxEdgePx:\s*TAB_PREVIEW_MAX_EDGE_PX,[\s\S]*\}\);/);
  assert.match(app, /const \{\s*syncActiveTabPreviewRuntime,\s*clearPendingTabSwitchFullRender,\s*finishPendingTabSwitchFullRender,\s*getPendingTabSwitchFullRenderTabId,\s*invalidateActiveTabPreview,\s*scheduleActiveTabPreviewCapture,\s*renderPendingTabSwitchPreview,\s*disposeTabPreviewForTab,\s*\} = canvasAppTabPreviewRuntime;/);
  assert.match(app, /const canvasAppTabLifecycleRuntime = createCanvasAppTabLifecycleRuntime\(\{[\s\S]*state,[\s\S]*tabbedSessions,[\s\S]*getTabsSnapshot,[\s\S]*getSessionTabRenameState\(\) \{[\s\S]*return sessionTabRenameState;[\s\S]*\},[\s\S]*resetSessionTabRenameState,[\s\S]*commitSessionTabRename,[\s\S]*sessionTabHasRunningReviewApply,[\s\S]*currentTabSwitchBlockReason,[\s\S]*currentTabSwitchBlockMessage,[\s\S]*showToast,[\s\S]*suspendActiveTabRuntimeForSwitch,[\s\S]*syncActiveTabRecord,[\s\S]*bindTabSessionToState,[\s\S]*createFreshTabSession,[\s\S]*syncActiveTabPreviewRuntime\(\.\.\.args\)\s*\{[\s\S]*canvasAppTabPreviewRuntime\.syncActiveTabPreviewRuntime\(\.\.\.args\);[\s\S]*\},[\s\S]*publishActiveTabVisibleState,[\s\S]*scheduleTabHydration,[\s\S]*disposeTabPreviewForTab\(\.\.\.args\)\s*\{[\s\S]*canvasAppTabPreviewRuntime\.disposeTabPreviewForTab\(\.\.\.args\);[\s\S]*\},[\s\S]*sessionTabDisplayLabel,[\s\S]*createForkedTabSession,[\s\S]*buildSessionTabForkLabel,[\s\S]*createTabId,[\s\S]*tabLabelForRunDir,[\s\S]*normalizeTabUiMeta,[\s\S]*activateTab,[\s\S]*defaultUntitledTabTitle:\s*DEFAULT_UNTITLED_TAB_TITLE,[\s\S]*\}\);/);
  assert.match(app, /const \{\s*ensureBootShellTab\s*\} = canvasAppTabLifecycleRuntime;/);
  assert.match(app, /const canvasAppSessionPersistence = createCanvasAppSessionPersistence\(\{[\s\S]*joinPath:\s*join,[\s\S]*sessionSnapshotFilename:\s*SESSION_SNAPSHOT_FILENAME,[\s\S]*legacySessionSnapshotFilename:\s*LEGACY_SESSION_SNAPSHOT_FILENAME,[\s\S]*sessionTimelineFilename:\s*SESSION_TIMELINE_FILENAME,[\s\S]*serializeSessionTimeline,[\s\S]*deserializeSessionTimeline,[\s\S]*restoreSessionTimelineSnapshot,[\s\S]*serializeSessionSnapshot,[\s\S]*deserializeSessionSnapshot,[\s\S]*captureActiveTabSession,[\s\S]*ensureRun,[\s\S]*sessionTabDisplayLabel,[\s\S]*queueNativeSystemMenuSync,[\s\S]*extractReceiptMeta,[\s\S]*setCanvasMode,[\s\S]*setTip,[\s\S]*\}\);/);
  assert.match(app, /const \{\s*sessionSnapshotPathForRunDir,\s*legacySessionSnapshotPathForRunDir,\s*sessionTimelinePathForRunDir,\s*persistSessionTimelineForSession,\s*persistActiveSessionTimeline,\s*loadSessionTimelineFromPath,\s*restoreSessionFromTimelineRecord,\s*saveActiveSessionSnapshot,\s*loadSessionSnapshotFromPath,\s*loadExistingArtifacts,\s*\} = canvasAppSessionPersistence;/);
  assert.match(app, /const canvasAppRunProvisioning = createCanvasAppRunProvisioning\(\{[\s\S]*invokeFn:\s*invoke,[\s\S]*openDialog:\s*open,[\s\S]*existsFn:\s*exists,[\s\S]*tabbedSessions,[\s\S]*syncActiveRunPtyBinding,[\s\S]*startEventsPolling,[\s\S]*activateTab,[\s\S]*sessionTimelinePathForRunDir,[\s\S]*sessionSnapshotPathForRunDir,[\s\S]*legacySessionSnapshotPathForRunDir,[\s\S]*loadSessionTimelineFromPath,[\s\S]*restoreSessionFromTimelineRecord,[\s\S]*loadSessionSnapshotFromPath,[\s\S]*normalizeSessionTabTitleInput,[\s\S]*sessionTabTitleMaxLength:\s*SESSION_TAB_TITLE_MAX_LENGTH,[\s\S]*restoreIntentStateFromRunDir,[\s\S]*loadExistingArtifacts,[\s\S]*\}\);/);
  assert.match(app, /function captureActiveTabSession\(session = null\) \{\s*return canvasAppTabSessionStateAdapter\.captureActiveTabSession\(session\);\s*\}/);
  assert.match(app, /function bindTabSessionToState\(session = null\) \{\s*return canvasAppTabSessionStateAdapter\.bindTabSessionToState\(session\);\s*\}/);
  assert.match(app, /function syncActiveTabRecord\(\{ capture = false, publish = false \} = \{\}\) \{\s*return canvasAppTabSessionStateAdapter\.syncActiveTabRecord\(\{ capture, publish \}\);\s*\}/);
  assert.match(app, /function clearTabScopedIntentTimers\(\) \{[\s\S]*intentInferenceTimer = null;[\s\S]*intentInferenceTimeout = null;[\s\S]*intentStateWriteTimer = null;[\s\S]*\}/);
  assert.doesNotMatch(app, /function syncActiveTabPreviewRuntime\(/);
  assert.doesNotMatch(app, /function clearPendingTabSwitchFullRender\(/);
  assert.doesNotMatch(app, /function finishPendingTabSwitchFullRender\(/);
  assert.doesNotMatch(app, /function getPendingTabSwitchFullRenderTabId\(/);
  assert.doesNotMatch(app, /function invalidateActiveTabPreview\(/);
  assert.doesNotMatch(app, /function scheduleActiveTabPreviewCapture\(/);
  assert.doesNotMatch(app, /function renderPendingTabSwitchPreview\(/);
  assert.doesNotMatch(app, /function disposeTabPreviewForTab\(/);
  assert.match(app, /function suspendActiveTabRuntimeForSwitch\(\) \{\s*return canvasAppTabActivationRuntime\.suspendActiveTabRuntimeForSwitch\(\);\s*\}/);
  assert.match(app, /function currentTabHydrationMatches\(tabId, hydrationToken\) \{\s*return canvasAppTabActivationRuntime\.currentTabHydrationMatches\(tabId, hydrationToken\);\s*\}/);
  assert.match(app, /function publishActiveTabVisibleState\(\{ allowTabSwitchPreview = false, reason = "visible_state" \} = \{\}\) \{\s*return canvasAppTabActivationRuntime\.publishActiveTabVisibleState\(\{ allowTabSwitchPreview, reason \}\);\s*\}/);
  assert.match(app, /function scheduleTabHydration\(tabId, reason, \{ spawnEngine = false, engineFailureToast = true \} = \{\}\) \{\s*return canvasAppTabActivationRuntime\.scheduleTabHydration\(tabId, reason, \{ spawnEngine, engineFailureToast \}\);\s*\}/);
  assert.match(app, /async function attachActiveTabRuntime\(\{[\s\S]*\} = \{\}\) \{\s*return canvasAppTabActivationRuntime\.attachActiveTabRuntime\(\{[\s\S]*spawnEngine: shouldSpawnEngine,[\s\S]*engineFailureToast,[\s\S]*reason,[\s\S]*hydrationToken,[\s\S]*\}\);\s*\}/);
  assert.match(app, /async function activateTab\(tabId, \{ spawnEngine = false, reason = "tab_activate", engineFailureToast = true \} = \{\}\) \{\s*return canvasAppTabActivationRuntime\.activateTab\(tabId, \{[\s\S]*spawnEngine,[\s\S]*reason,[\s\S]*engineFailureToast,[\s\S]*waitForHydration: Boolean\(arguments\[1\]\?\.waitForHydration\),[\s\S]*\}\);\s*\}/);
  assert.match(app, /async function closeTab\(tabId\) \{\s*return canvasAppTabLifecycleRuntime\.closeTab\(tabId\);\s*\}/);
  assert.match(app, /async function forkActiveTab\(\) \{\s*return canvasAppTabLifecycleRuntime\.forkActiveTab\(\);\s*\}/);
  assert.match(app, /async function ensureRun\(\) \{\s*return canvasAppRunProvisioning\.ensureRun\(\);\s*\}/);
  assert.match(app, /async function createRun\(\{ announce = true, source = "new_run" \} = \{\}\) \{\s*return canvasAppRunProvisioning\.createRun\(\{ announce, source \}\);\s*\}/);
  assert.match(app, /async function openExistingRun\(\) \{\s*return canvasAppRunProvisioning\.openExistingRun\(\);\s*\}/);
  assert.doesNotMatch(app, /function ensureBootShellTab\(/);
  assert.match(app, /const \{\s*handleNativeMenuAction\s*\} = createCanvasAppNativeMenuActionBridge\(\{[\s\S]*parseNativeSlotIndex,[\s\S]*bumpInteraction,[\s\S]*runWithUserError,[\s\S]*runNativeToolSlot,[\s\S]*runNativeShortcutSlot,[\s\S]*applyRailIconPackSetting,[\s\S]*createRun,[\s\S]*openExistingRun,[\s\S]*saveActiveSessionSnapshot,[\s\S]*closeTab,[\s\S]*getActiveTabId:\s*\(\)\s*=>\s*state\.activeTabId \|\| null,[\s\S]*requestJuggernautExport,[\s\S]*juggernautExportRetryHint,[\s\S]*showCreateToolPanel,[\s\S]*importPhotos,[\s\S]*settingsToggleEl:\s*els\.settingsToggle,[\s\S]*\}\);/);
  assert.match(app, /const desktopEventRouter = createCanvasAppDesktopEventRouter\(\{[\s\S]*types:\s*DESKTOP_EVENT_TYPES,[\s\S]*deps:\s*desktopEventHandlerDeps,[\s\S]*beforeHandleEvent\(event, eventType\) \{[\s\S]*topMetricIngestTokensFromPayload\(event, \{ atMs: Date\.now\(\), render: false \}\);[\s\S]*\},[\s\S]*\}\);/);
  assert.match(
    app,
    /function installLegacyCanvasAppBridges\(\) \{[\s\S]*bindCommunicationReviewBootstrapBridge\(\);[\s\S]*bindDesignReviewApplyRuntimeBridge\(\);[\s\S]*exposeJuggernautShellHooks\(\);[\s\S]*syncJuggernautShellState\(\);[\s\S]*\}/
  );
  assert.match(app, /function handleCanvasAppFatalBootError\(\{ error \}\) \{/);
  assert.match(app, /setStatus\(`Engine: boot failed \(\$\{error\?\.message \|\| error\}\)`\, true\);/);
  assert.match(app, /await runCanvasAppBootShellSetup\(\{[\s\S]*ensureBootShellTab,[\s\S]*installCanvasHandlers,[\s\S]*installDnD,[\s\S]*installUi,[\s\S]*installJuggernautShellUi,[\s\S]*initializeFileBrowserDock,[\s\S]*enableFileBrowserDock:\s*ENABLE_FILE_BROWSER_DOCK,[\s\S]*startSpawnTimer,[\s\S]*\}\);/);
  assert.match(app, /await installCanvasAppBootRuntime\(\{[\s\S]*listen,[\s\S]*desktopSessionUpdateEvent:\s*DESKTOP_SESSION_UPDATE_EVENT,[\s\S]*readPtyStatus,[\s\S]*cachePtyStatus,[\s\S]*handleDesktopSessionBridgeUpdate,[\s\S]*handleDesktopAutomation,[\s\S]*handleNativeMenuAction,[\s\S]*setFlushDeferredEnginePtyExit\(nextHandler\)\s*\{[\s\S]*flushDeferredEnginePtyExit = nextHandler;[\s\S]*\},[\s\S]*\}\);/);
  assert.doesNotMatch(app, /import \{ createArtifactEventHandler \} from "\.\/app\/event_handlers\/artifact_events\.js";/);
  assert.doesNotMatch(app, /import \{ createDiagnosticsEventHandler \} from "\.\/app\/event_handlers\/diagnostics_events\.js";/);
  assert.doesNotMatch(app, /import \{ createIntentEventHandler \} from "\.\/app\/event_handlers\/intent_events\.js";/);
  assert.doesNotMatch(app, /import \{ createMotherEventHandler \} from "\.\/app\/event_handlers\/mother_events\.js";/);
  assert.doesNotMatch(app, /import \{ createRecreateEventHandler \} from "\.\/app\/event_handlers\/recreate_events\.js";/);
  assert.match(app, /await runCanvasAppBootReadySequence\(\{[\s\S]*railIconPack:\s*settings\.railIconPack,[\s\S]*syncNativeIconographyMenu,[\s\S]*ensureRun,[\s\S]*installJuggernautShellBridge,[\s\S]*installBuiltInSingleImageRailIntegration,[\s\S]*renderQuickActions,[\s\S]*applyRuntimeChromeVisibility,[\s\S]*maybeAutoOpenOpenRouterOnboarding,[\s\S]*invokeFn:\s*invoke,[\s\S]*requestRender,[\s\S]*\}\);/);
  assert.match(
    app,
    /const canvasApp = createCanvasApp\(\{[\s\S]*documentObj:\s*document,[\s\S]*dom:\s*els,[\s\S]*settingsStore:\s*legacyCanvasAppSettingsStore,[\s\S]*installBridges:\s*\[installLegacyCanvasAppBridges\],[\s\S]*onBoot:\s*async\s*\(\)\s*=>\s*\{[\s\S]*await boot\(\);[\s\S]*\},[\s\S]*onFatalBootError:\s*handleCanvasAppFatalBootError,[\s\S]*\}\);/
  );
  assert.match(app, /void canvasApp\.boot\(\)\.catch\(\(\) => \{\}\);/);
});

test("canvas app composes tab rename and tab strip modules instead of owning their implementation bodies", () => {
  assert.match(app, /import \{ createSessionTabRenameRuntime \} from "\.\/app\/tab_rename_runtime\.js";/);
  assert.match(app, /import \{ createSessionTabStripUi \} from "\.\/app\/tab_strip_ui\.js";/);
  assert.match(app, /const sessionTabRenameRuntime = createSessionTabRenameRuntime\(\{[\s\S]*renameState: sessionTabRenameState,/s);
  assert.match(app, /sessionTabStripUi = createSessionTabStripUi\(\{[\s\S]*buildTabSummary: buildSessionTabUiSummary,[\s\S]*renameRuntime: sessionTabRenameRuntime,/s);
  assert.match(app, /const \{\s*renderSessionTabStrip,\s*installSessionTabStripUi\s*,?\s*\} = sessionTabStripUi;/);
  assert.match(app, /function startSessionTabRename\(tabId = ""\) \{\s*return sessionTabRenameRuntime\.startSessionTabRename\(tabId\);\s*\}/);
  assert.match(
    app,
    /function commitSessionTabRename\(tabId = "", rawTitle = sessionTabRenameState\.draft\) \{\s*return sessionTabRenameRuntime\.commitSessionTabRename\(tabId, rawTitle\);\s*\}/
  );
  assert.match(app, /function cancelSessionTabRename\(\) \{\s*return sessionTabRenameRuntime\.cancelSessionTabRename\(\);\s*\}/);
  assert.match(app, /function focusSessionTabRenameInput\(\) \{\s*return sessionTabRenameRuntime\.focusSessionTabRenameInput\(\);\s*\}/);
  assert.doesNotMatch(app, /function renderSessionTabStrip\(/);
  assert.doesNotMatch(app, /function installSessionTabStripUi\(/);
  assert.match(app, /function installUi\(\) \{[\s\S]*installSessionTabStripUi\(\);/s);
  assert.doesNotMatch(app, /function createSessionTabStripItem\(/);
  assert.doesNotMatch(app, /function createSessionTabReviewIcon\(/);
  assert.doesNotMatch(app, /function createSessionTabForkIndicator\(/);
});

test("canvas app composes the extracted timeline shelf runtime from the app module", () => {
  assert.match(app, /import \{ createTimelineUi \} from "\.\/app\/timeline_ui\.js";/);
  assert.match(app, /const timelineUi = createTimelineUi\(\{/);
  assert.match(app, /timelineSortedNodes,/);
  assert.match(app, /currentTimelineHeadNode,/);
  assert.match(app, /syncActiveTabRecord,/);
  assert.match(app, /timelineNodeSummary,/);
  assert.match(app, /jumpToTimelineNode,/);
});

test("canvas app keeps timeline entry points as wrapper glue and installs the extracted UI bindings", () => {
  assert.match(app, /function toggleTimeline\(options = \{\}\) \{\s*return timelineUi\.toggleTimeline\(options\);\s*\}/s);
  assert.match(app, /function syncTimelineDockVisibility\(\) \{\s*return timelineUi\.syncTimelineDockVisibility\(\);\s*\}/s);
  assert.match(
    app,
    /function syncTimelineShelfToggle\(nodes = timelineSortedNodes\(\), headNode = currentTimelineHeadNode\(\)\) \{\s*return timelineUi\.syncTimelineShelfToggle\(nodes, headNode\);\s*\}/s
  );
  assert.match(app, /function renderTimeline\(\) \{\s*return timelineUi\.renderTimeline\(\);\s*\}/s);
  assert.match(app, /const \{[\s\S]*installTimelineUi,[\s\S]*\} = timelineUi;/s);
  assert.match(app, /installTimelineUi\(\);/);
});

test("canvas app composes the extracted canvas renderer module as wrapper glue", () => {
  assert.match(app, /import \{ createCanvasRenderer \} from "\.\/app\/canvas_renderer\.js";/);
  assert.match(app, /let canvasRendererRuntime = null;/);
  assert.match(app, /function requestCanvasRender\(\.\.\.args\) \{\s*return canvasRendererRuntime\?\.requestRender\?\.\(\.\.\.args\);\s*\}/);
  assert.match(app, /canvasRendererRuntime = createCanvasRenderer\(\{/);
  assert.match(app, /const \{ requestRender, render \} = canvasRendererRuntime;/);
  assert.match(app, /clearPendingTabSwitchFullRender,/);
  assert.match(app, /renderPendingTabSwitchPreview,/);
  assert.match(app, /scheduleActiveTabPreviewCapture,/);
  assert.match(app, /hasEffectsRuntime:\s*\(\)\s*=>\s*Boolean\(effectsRuntime\),/);
});

test("canvas app no longer owns the top-level render scheduler functions or scheduler flag", () => {
  assert.doesNotMatch(app, /function requestRender\(/);
  assert.doesNotMatch(app, /function render\(/);
  assert.doesNotMatch(app, /needsRender:\s*false,/);
});

test("canvas app composes the extracted canvas input and drag-drop installers as wrapper glue", () => {
  assert.match(app, /import \{ installCanvasHandlers as installCanvasInputController \} from "\.\/app\/canvas_input_controller\.js";/);
  assert.match(app, /import \{ installDnD as installCanvasDndController \} from "\.\/app\/dnd_controller\.js";/);
  assert.match(app, /function createCanvasHandlerConfig\(\) \{/);
  assert.match(app, /function installCanvasHandlers\(\) \{\s*const canvasHandlerConfig = createCanvasHandlerConfig\(\);\s*if \(!canvasHandlerConfig\) return;\s*installCanvasInputController\(\{[\s\S]*els,[\s\S]*state,[\s\S]*\.\.\.canvasHandlerConfig,[\s\S]*\}\);\s*\}/);
  assert.match(app, /function installDnD\(\) \{\s*installCanvasDndController\(\{[\s\S]*els,[\s\S]*state,[\s\S]*canvasScreenCssToWorldCss,[\s\S]*normalizeLocalFsPath,[\s\S]*importLocalPathsAtCanvasPoint,[\s\S]*fileBrowserReadInternalDragPath,[\s\S]*canvasCssPointFromEvent,[\s\S]*ENABLE_DRAG_DROP_IMPORT,[\s\S]*\}\);\s*\}/);
  assert.doesNotMatch(app, /import \{ installCanvasGestureHandlers \} from "\.\/canvas_handlers\/gesture_handlers\.js";/);
  assert.doesNotMatch(app, /import \{ installCanvasInputHandlers \} from "\.\/canvas_handlers\/install_canvas_input_handlers\.js";/);
});
