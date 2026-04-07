export function createCanvasAppTabLifecycleRuntime({
  state,
  tabbedSessions,
  getTabsSnapshot,
  getSessionTabRenameState,
  resetSessionTabRenameState,
  commitSessionTabRename,
  sessionTabHasRunningReviewApply,
  currentTabSwitchBlockReason,
  currentTabSwitchBlockMessage,
  showToast,
  suspendActiveTabRuntimeForSwitch,
  syncActiveTabRecord,
  bindTabSessionToState,
  createFreshTabSession,
  syncActiveTabPreviewRuntime,
  publishActiveTabVisibleState,
  scheduleTabHydration,
  disposeTabPreviewForTab,
  sessionTabDisplayLabel,
  createForkedTabSession,
  buildSessionTabForkLabel,
  createTabId,
  normalizeTabUiMeta,
  activateTab,
  defaultUntitledTabTitle = "Untitled Canvas",
} = {}) {
  async function closeTab(tabId) {
    const normalized = String(tabId || "").trim();
    const snapshot = getTabsSnapshot();
    if (!normalized) {
      return { ok: false, reason: "missing_tab", tabs: snapshot.tabs };
    }
    const targetRecord = tabbedSessions.getTab(normalized) || null;
    if (!targetRecord) {
      return { ok: false, reason: "missing_tab", tabs: snapshot.tabs };
    }
    if (sessionTabHasRunningReviewApply(targetRecord)) {
      showToast(currentTabSwitchBlockMessage("review_apply"), "tip", 2200);
      return { ok: false, reason: "review_apply", tabs: snapshot.tabs };
    }
    if (tabbedSessions.tabsOrder.length <= 1) {
      showToast("Keep one tab open in this build.", "tip", 2200);
      return { ok: false, reason: "last_tab", tabs: snapshot.tabs };
    }
    if (String(getSessionTabRenameState()?.tabId || "").trim() === normalized) {
      resetSessionTabRenameState();
    }
    if (normalized === String(state.activeTabId || "").trim()) {
      const blockReason = currentTabSwitchBlockReason();
      if (blockReason) {
        showToast(currentTabSwitchBlockMessage(blockReason), "tip", 2200);
        return { ok: false, reason: blockReason, tabs: snapshot.tabs };
      }
      suspendActiveTabRuntimeForSwitch();
      syncActiveTabRecord({ capture: true, publish: true });
      const order = tabbedSessions.tabsOrder.slice();
      const index = order.indexOf(normalized);
      const remaining = order.filter((id) => id !== normalized);
      const nextIndex = Math.max(0, Math.min(index, remaining.length - 1));
      const nextActiveId = remaining[nextIndex] || remaining[remaining.length - 1] || null;
      const nextTab = nextActiveId ? tabbedSessions.getTab(nextActiveId) || null : null;
      if (nextTab) {
        bindTabSessionToState(nextTab.session || createFreshTabSession({ runDir: nextTab.runDir || null }));
      }
      const closed = tabbedSessions.closeTab(normalized, { activateNeighbor: true });
      if (closed?.nextActiveId) {
        syncActiveTabPreviewRuntime();
        publishActiveTabVisibleState({ allowTabSwitchPreview: true, reason: "close_tab" });
        void scheduleTabHydration(closed.nextActiveId, "close_tab", { spawnEngine: false });
      }
      showToast(`Closed ${sessionTabDisplayLabel(closed?.closed, "tab")}.`, "tip", 1800);
      disposeTabPreviewForTab(normalized);
      return { ok: true, closedTabId: normalized, activeTabId: state.activeTabId || null, tabs: getTabsSnapshot().tabs };
    }
    const closed = tabbedSessions.closeTab(normalized, { activateNeighbor: false });
    showToast(`Closed ${sessionTabDisplayLabel(closed?.closed, "tab")}.`, "tip", 1800);
    disposeTabPreviewForTab(normalized);
    return { ok: true, closedTabId: normalized, activeTabId: state.activeTabId || null, tabs: getTabsSnapshot().tabs };
  }

  async function forkActiveTab() {
    const activeTabId = String(state.activeTabId || "").trim();
    const activeTab = activeTabId ? tabbedSessions.getTab(activeTabId) : null;
    if (!activeTabId || !activeTab) {
      return { ok: false, reason: "missing_tab", activeTabId: state.activeTabId || null };
    }
    const blockReason = currentTabSwitchBlockReason();
    if (blockReason) {
      showToast(currentTabSwitchBlockMessage(blockReason), "tip", 2200);
      return { ok: false, reason: blockReason, activeTabId: state.activeTabId || null };
    }
    if (String(getSessionTabRenameState()?.tabId || "").trim() === activeTabId) {
      commitSessionTabRename(activeTabId, getSessionTabRenameState()?.draft);
    }
    syncActiveTabRecord({ capture: true, publish: true });
    const sourceRecord = tabbedSessions.getTab(activeTabId) || activeTab;
    const sourceLabel = sessionTabDisplayLabel(sourceRecord, defaultUntitledTabTitle);
    const forkLabel = buildSessionTabForkLabel(sourceRecord);
    const session = createForkedTabSession(sourceRecord.session || createFreshTabSession(), { label: forkLabel });
    session.forkedFromTabId = activeTabId;
    const tabId = createTabId();
    const sourceIndex = tabbedSessions.tabsOrder.indexOf(activeTabId);
    const insertIndex = sourceIndex >= 0 ? sourceIndex + 1 : tabbedSessions.tabsOrder.length;
    tabbedSessions.upsertTab(
      {
        tabId,
        label: forkLabel,
        labelManual: true,
        forkedFromTabId: activeTabId,
        runDir: null,
        eventsPath: null,
        session,
        busy: false,
        reviewFlowState: session.reviewFlowState,
        tabUiMeta: normalizeTabUiMeta(session.tabUiMeta),
        thumbnailPath: session.tabUiMeta?.thumbnailPath || null,
      },
      { activate: false, index: insertIndex }
    );
    const activation = await activateTab(tabId, { spawnEngine: false, reason: "fork_tab" });
    if (!activation?.ok) {
      tabbedSessions.closeTab(tabId, { activateNeighbor: false });
      return activation;
    }
    showToast(`Forked ${sourceLabel} into ${forkLabel}.`, "tip", 2600);
    return {
      ok: true,
      tabId,
      sourceTabId: activeTabId,
      activeTabId: state.activeTabId || null,
    };
  }

  return Object.freeze({
    closeTab,
    forkActiveTab,
  });
}
