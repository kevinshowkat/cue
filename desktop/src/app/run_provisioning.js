export function createCanvasAppRunProvisioning({
  state,
  invokeFn,
  openDialog,
  existsFn,
  setStatus,
  setRunInfo,
  showToast,
  bumpInteraction,
  emitInstallTelemetryAsync,
  tabbedSessions,
  createFreshTabSession,
  captureActiveTabSession,
  createTabId,
  bindTabSessionToState,
  normalizeTabUiMeta,
  tabLabelForRunDir,
  syncActiveTabRecord,
  syncActiveRunPtyBinding,
  startEventsPolling,
  activateTab,
  currentTabSwitchBlockReason,
  currentTabSwitchBlockMessage,
  sessionTimelinePathForRunDir,
  sessionSnapshotPathForRunDir,
  legacySessionSnapshotPathForRunDir,
  loadSessionTimelineFromPath,
  restoreSessionFromTimelineRecord,
  loadSessionSnapshotFromPath,
  normalizeSessionTabTitleInput,
  readFirstString,
  sessionTabTitleMaxLength = 40,
  restoreIntentStateFromRunDir,
  loadExistingArtifacts,
  TextDecoderCtor = globalThis.TextDecoder,
  consoleObj = globalThis.console,
} = {}) {
  function noteNewRunCreated(source = "new_run") {
    if (!state.installTelemetry || typeof state.installTelemetry !== "object") {
      state.installTelemetry = {};
    }
    state.installTelemetry.runSequence = (Number(state.installTelemetry.runSequence) || 0) + 1;
    emitInstallTelemetryAsync("new_run_created", {
      run_sequence: Number(state.installTelemetry.runSequence) || 1,
      source,
    });
    state.installTelemetry.firstRunLogged = true;
  }

  async function ensureRun() {
    if (state.runDir) return;
    const activeTabId = String(state.activeTabId || "").trim();
    const activeTab = activeTabId ? tabbedSessions.getTab(activeTabId) : null;
    if (!activeTabId || !activeTab) {
      await createRun();
      return;
    }
    setStatus("Engine: creating run…");
    const payload = await invokeFn("create_run_dir");
    noteNewRunCreated("active_tab_run");
    const session = captureActiveTabSession(activeTab.session || createFreshTabSession());
    session.runDir = payload.run_dir;
    session.eventsPath = payload.events_path;
    session.eventsByteOffset = 0;
    session.eventsTail = "";
    session.eventsDecoder = TextDecoderCtor ? new TextDecoderCtor("utf-8") : null;
    session.fallbackToFullRead = false;
    session.fallbackLineOffset = 0;
    bindTabSessionToState(session);
    tabbedSessions.upsertTab(
      {
        ...activeTab,
        tabId: activeTabId,
        label: tabLabelForRunDir(payload.run_dir, activeTab.label || activeTabId),
        runDir: payload.run_dir,
        eventsPath: payload.events_path,
        session,
        busy: false,
        tabUiMeta: normalizeTabUiMeta(session.tabUiMeta),
        thumbnailPath: session.tabUiMeta?.thumbnailPath || null,
      },
      { activate: true, index: tabbedSessions.tabsOrder.indexOf(activeTabId) }
    );
    syncActiveTabRecord({ capture: false, publish: true });
    setRunInfo(`Run: ${payload.run_dir}`);
    await activateTab(activeTabId, {
      spawnEngine: false,
      reason: "ensure_run_active_tab",
      engineFailureToast: false,
      waitForHydration: true,
    });
  }

  async function createRun({ announce = true, source = "new_run" } = {}) {
    const blockReason = currentTabSwitchBlockReason({ allowReviewApply: true });
    if (blockReason) {
      showToast(currentTabSwitchBlockMessage(blockReason), "tip", 2200);
      return { ok: false, reason: blockReason };
    }
    const normalizedSource = String(source || "new_run").trim() || "new_run";
    const showCreateRunToast = announce && normalizedSource !== "new_run" && normalizedSource !== "boot";
    setStatus("Engine: creating run tab…");
    const payload = await invokeFn("create_run_dir");
    noteNewRunCreated(normalizedSource);
    const tabId = createTabId();
    const session = createFreshTabSession({
      runDir: payload.run_dir,
      eventsPath: payload.events_path,
    });
    tabbedSessions.upsertTab(
      {
        tabId,
        label: tabLabelForRunDir(payload.run_dir, `Run ${tabbedSessions.tabsOrder.length + 1}`),
        runDir: payload.run_dir,
        eventsPath: payload.events_path,
        session,
        busy: false,
        tabUiMeta: normalizeTabUiMeta(session.tabUiMeta),
        thumbnailPath: session.tabUiMeta?.thumbnailPath || null,
      },
      { activate: false }
    );
    const result = await activateTab(tabId, {
      spawnEngine: true,
      engineFailureToast: showCreateRunToast,
      reason: "new_run_tab",
    });
    if (result?.hydration) await result.hydration;
    return result;
  }

  function restoreSessionFromSnapshotPayload(snapshot = null, { selected = "", defaultEventsPath = "", session } = {}) {
    if (!snapshot?.session) return session;
    const nextSession = snapshot.session;
    nextSession.runDir = selected;
    nextSession.eventsPath = nextSession.eventsPath || defaultEventsPath;
    if (!nextSession.label && snapshot.label) {
      nextSession.label = String(snapshot.label);
    }
    return nextSession;
  }

  async function openExistingRun() {
    bumpInteraction();
    const blockReason = currentTabSwitchBlockReason({ allowReviewApply: true });
    if (blockReason) {
      showToast(currentTabSwitchBlockMessage(blockReason), "tip", 2200);
      return { ok: false, reason: blockReason };
    }
    const selected = await openDialog({ directory: true, multiple: false });
    if (!selected) return { ok: false, reason: "cancelled" };
    setStatus("Engine: opening run tab…");
    const tabId = createTabId();
    const defaultEventsPath = `${selected}/events.jsonl`;
    let session = createFreshTabSession({
      runDir: selected,
      eventsPath: defaultEventsPath,
    });
    let restoredTimeline = null;
    let restoredSnapshot = null;
    const timelinePath = await sessionTimelinePathForRunDir(selected);
    if (timelinePath && (await existsFn(timelinePath).catch(() => false))) {
      try {
        restoredTimeline = await loadSessionTimelineFromPath(timelinePath);
        const restoredFromTimeline = restoreSessionFromTimelineRecord(restoredTimeline, {
          runDir: selected,
          eventsPath: defaultEventsPath,
        });
        if (restoredFromTimeline) {
          session = restoredFromTimeline;
        } else {
          restoredTimeline = null;
        }
      } catch (error) {
        consoleObj.warn?.("run session timeline restore failed", error);
        showToast("Saved timeline could not be restored. Falling back to the session snapshot.", "tip", 3200);
        restoredTimeline = null;
      }
    }
    const snapshotPath = await sessionSnapshotPathForRunDir(selected);
    const legacySnapshotPath = await legacySessionSnapshotPathForRunDir(selected);
    if (!restoredTimeline && snapshotPath && (await existsFn(snapshotPath).catch(() => false))) {
      try {
        restoredSnapshot = await loadSessionSnapshotFromPath(snapshotPath);
        session = restoreSessionFromSnapshotPayload(restoredSnapshot, {
          selected,
          defaultEventsPath,
          session,
        });
      } catch (error) {
        consoleObj.warn?.("run session snapshot restore failed", error);
        showToast("Saved session snapshot could not be restored. Falling back to run artifacts.", "tip", 3200);
      }
    }
    if (!restoredTimeline && !restoredSnapshot && legacySnapshotPath && (await existsFn(legacySnapshotPath).catch(() => false))) {
      try {
        restoredSnapshot = await loadSessionSnapshotFromPath(legacySnapshotPath);
        session = restoreSessionFromSnapshotPayload(restoredSnapshot, {
          selected,
          defaultEventsPath,
          session,
        });
      } catch (error) {
        consoleObj.warn?.("legacy run session snapshot restore failed", error);
        showToast("Legacy session snapshot could not be restored. Falling back to run artifacts.", "tip", 3200);
      }
    }
    const tabLabel =
      normalizeSessionTabTitleInput(readFirstString(restoredSnapshot?.label, session.label), sessionTabTitleMaxLength) ||
      tabLabelForRunDir(selected, `Run ${tabbedSessions.tabsOrder.length + 1}`);
    tabbedSessions.upsertTab(
      {
        tabId,
        label: tabLabel,
        labelManual: Boolean(session.labelManual),
        runDir: session.runDir || selected,
        eventsPath: session.eventsPath || defaultEventsPath,
        session,
        busy: false,
        tabUiMeta: normalizeTabUiMeta(session.tabUiMeta),
        thumbnailPath: session.tabUiMeta?.thumbnailPath || null,
      },
      { activate: false }
    );
    const activation = await activateTab(tabId, { spawnEngine: false, reason: "open_run_tab" });
    if (!activation?.ok) return activation;
    if (activation?.hydration) await activation.hydration;
    if (restoredTimeline) {
      showToast(`Opened ${tabLabel} from the saved session timeline.`, "tip", 3200);
      return { ok: true, tabId, activeTabId: state.activeTabId || null, restoredTimeline: true };
    }
    if (restoredSnapshot?.session) {
      showToast(`Opened ${tabLabel} from the saved session snapshot.`, "tip", 3200);
      return { ok: true, tabId, activeTabId: state.activeTabId || null, restoredSnapshot: true };
    }
    await restoreIntentStateFromRunDir().catch(() => {});
    const restoredArtifacts = await loadExistingArtifacts();
    showToast(`Opened ${tabLabel} in a new tab${restoredArtifacts ? ` (${restoredArtifacts} artifacts)` : ""}.`, "tip", 3200);
    return { ok: true, tabId, activeTabId: state.activeTabId || null };
  }

  return Object.freeze({
    ensureRun,
    createRun,
    openExistingRun,
  });
}
