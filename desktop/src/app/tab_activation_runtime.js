export function createCanvasAppTabActivationRuntime({
  state,
  els,
  tabbedSessions,
  createFreshTabSession,
  bindTabSessionToState,
  syncActiveTabRecord,
  currentTabSwitchBlockReason,
  currentTabSwitchBlockMessage,
  showToast,
  syncActiveTabPreviewRuntime,
  syncLocalMagicSelectUiPrewarmTargets,
  setRunInfo,
  setTip,
  setDirectorText,
  updateEmptyCanvasHint,
  syncTimelineDockVisibility,
  requestRender,
  releaseLocalMagicSelectUiPrewarmForTab,
  stopEventsPolling,
  resetDescribeQueue,
  stopIntentTicker,
  clearTabScopedIntentTimers,
  clearAmbientIntentTimers,
  clearMotherIdleTimers,
  clearMotherIdleDispatchTimeout,
  invoke,
  PTY_COMMANDS,
  tauriInvoke,
  buildDesktopSessionStopRequest,
  stopDesktopSession,
  hideImageMenu,
  hideAnnotatePanel,
  hidePromptGeneratePanel,
  hideCreateToolPanel,
  hideMarkPanel,
  closeMotherWheelMenu,
  startPerfSample,
  finishPerfSample,
  syncSessionToolsFromRegistry,
  renderCreateToolPreview,
  renderCustomToolDock,
  renderSelectionMeta,
  renderFilmstrip,
  chooseSpawnNodes,
  renderSessionApiCallsReadout,
  syncIntentModeClass,
  syncJuggernautShellState,
  applyRuntimeChromeVisibility,
  renderMotherMoodStatus,
  renderTimeline,
  ensureEngineSpawned,
  syncActiveRunPtyBinding,
  startEventsPolling,
  setStatus,
  defaultTip = "",
  tabHydrationIdleTimeoutMs = 120,
  windowObj = globalThis.window,
} = {}) {
  let tabHydrationToken = 0;
  let tabHydrationRaf = 0;
  let tabHydrationTimer = null;
  let tabHydrationIdle = null;

  function clearScheduledTabHydration() {
    if (tabHydrationRaf && typeof windowObj !== "undefined" && typeof windowObj?.cancelAnimationFrame === "function") {
      windowObj.cancelAnimationFrame(tabHydrationRaf);
    }
    tabHydrationRaf = 0;
    if (tabHydrationTimer) clearTimeout(tabHydrationTimer);
    tabHydrationTimer = null;
    if (tabHydrationIdle && typeof windowObj !== "undefined" && typeof windowObj?.cancelIdleCallback === "function") {
      windowObj.cancelIdleCallback(tabHydrationIdle);
    }
    tabHydrationIdle = null;
  }

  function suspendActiveTabRuntimeForSwitch() {
    const activeRunDir = String(state.runDir || "").trim();
    void releaseLocalMagicSelectUiPrewarmForTab(state.activeTabId || null, {
      reason: "tab_switch",
    }).catch(() => {});
    clearScheduledTabHydration();
    tabHydrationToken += 1;
    stopEventsPolling();
    state.desktopSessionBridgeActive = false;
    state.ptySpawned = false;
    state.pollInFlight = false;
    resetDescribeQueue({ clearPending: true });
    stopIntentTicker();
    clearTabScopedIntentTimers();
    clearAmbientIntentTimers();
    clearMotherIdleTimers({ first: true, takeover: true });
    clearMotherIdleDispatchTimeout();
    if (state.motherIdle) {
      clearTimeout(state.motherIdle.cooldownTimer);
      state.motherIdle.cooldownTimer = null;
      clearTimeout(state.motherIdle.pendingIntentTimeout);
      state.motherIdle.pendingIntentTimeout = null;
      clearTimeout(state.motherIdle.pendingPromptCompileTimeout);
      state.motherIdle.pendingPromptCompileTimeout = null;
      clearTimeout(state.motherIdle.speculativePrefetchTimer);
      state.motherIdle.speculativePrefetchTimer = null;
      clearTimeout(state.motherIdle.liveProposalRefreshTimer);
      state.motherIdle.liveProposalRefreshTimer = null;
      clearTimeout(state.motherIdle.intentReplayTimer);
      state.motherIdle.intentReplayTimer = null;
      clearTimeout(state.motherIdle.pendingVisionRetryTimer);
      state.motherIdle.pendingVisionRetryTimer = null;
      clearTimeout(state.motherIdle.hintFadeTimer);
      state.motherIdle.hintFadeTimer = null;
    }
    void Promise.allSettled([
      invoke("write_pty", { data: `${PTY_COMMANDS.INTENT_RT_STOP}\n` }),
      invoke("write_pty", { data: `${PTY_COMMANDS.INTENT_RT_MOTHER_STOP}\n` }),
    ]).finally(() => {
      if (!activeRunDir) return;
      void stopDesktopSession(
        tauriInvoke,
        buildDesktopSessionStopRequest({ runDir: activeRunDir })
      ).catch(() => {});
    });
    hideImageMenu();
    hideAnnotatePanel();
    hidePromptGeneratePanel();
    hideCreateToolPanel();
    hideMarkPanel();
    if (els?.communicationProposalTray) {
      els.communicationProposalTray.classList.add("hidden");
    }
    closeMotherWheelMenu({ immediate: true });
    if (els?.timelineDock) els.timelineDock.classList.add("hidden");
    if (state.wheelMenu) {
      clearTimeout(state.wheelMenu.hideTimer);
      state.wheelMenu.hideTimer = null;
      state.wheelMenu.open = false;
    }
  }

  function currentTabHydrationMatches(tabId, hydrationToken) {
    const normalizedTabId = String(tabId || "").trim();
    if (!normalizedTabId) return false;
    return normalizedTabId === String(state.activeTabId || "").trim() && hydrationToken === tabHydrationToken;
  }

  function publishActiveTabVisibleState({ allowTabSwitchPreview = false, reason = "visible_state" } = {}) {
    setRunInfo(state.runDir ? `Run: ${state.runDir}` : "No run");
    setTip(state.lastTipText || defaultTip);
    setDirectorText(state.lastDirectorText, state.lastDirectorMeta);
    updateEmptyCanvasHint();
    syncTimelineDockVisibility();
    requestRender({ allowTabSwitchPreview, reason });
  }

  function scheduleTabHydration(tabId, reason, { spawnEngine = false, engineFailureToast = true } = {}) {
    const normalizedTabId = String(tabId || "").trim();
    if (!normalizedTabId) return Promise.resolve(false);
    const perfSample = startPerfSample("tab:deferred-hydration", {
      reason,
      spawnEngine: Boolean(spawnEngine),
      tabId: normalizedTabId,
    });
    clearScheduledTabHydration();

    const hydrationToken = ++tabHydrationToken;
    const runHydration = async () => {
      if (!currentTabHydrationMatches(normalizedTabId, hydrationToken)) return false;
      return attachActiveTabRuntime({
        tabId: normalizedTabId,
        spawnEngine,
        engineFailureToast,
        reason,
        hydrationToken,
      });
    };
    const startHydration = () => {
      if (!currentTabHydrationMatches(normalizedTabId, hydrationToken)) {
        finishPerfSample(perfSample, "deferredHydrationMs", { stale: true, tabId: normalizedTabId });
        return Promise.resolve(false);
      }
      if (typeof windowObj !== "undefined" && typeof windowObj?.requestIdleCallback === "function") {
        return new Promise((resolve) => {
          tabHydrationIdle = windowObj.requestIdleCallback(
            () => {
              tabHydrationIdle = null;
              void runHydration()
                .then((ok) => {
                  finishPerfSample(perfSample, "deferredHydrationMs", { tabId: normalizedTabId, ok: Boolean(ok) });
                  resolve(Boolean(ok));
                })
                .catch((err) => {
                  console.error("Deferred tab hydration failed:", err);
                  finishPerfSample(perfSample, "deferredHydrationMs", {
                    error: err?.message || String(err || "deferred hydration failed"),
                    ok: false,
                    tabId: normalizedTabId,
                  });
                  resolve(false);
                });
            },
            { timeout: tabHydrationIdleTimeoutMs }
          );
        });
      }
      return runHydration()
        .then((ok) => {
          finishPerfSample(perfSample, "deferredHydrationMs", { tabId: normalizedTabId, ok: Boolean(ok) });
          return Boolean(ok);
        })
        .catch((err) => {
          console.error("Deferred tab hydration failed:", err);
          finishPerfSample(perfSample, "deferredHydrationMs", {
            error: err?.message || String(err || "deferred hydration failed"),
            ok: false,
            tabId: normalizedTabId,
          });
          return false;
        });
    };
    if (typeof windowObj !== "undefined" && typeof windowObj?.requestAnimationFrame === "function") {
      return new Promise((resolve) => {
        tabHydrationRaf = windowObj.requestAnimationFrame(() => {
          tabHydrationRaf = 0;
          tabHydrationTimer = setTimeout(() => {
            tabHydrationTimer = null;
            void startHydration().then((ok) => resolve(Boolean(ok)));
          }, 0);
        });
      });
    }
    return new Promise((resolve) => {
      tabHydrationTimer = setTimeout(() => {
        tabHydrationTimer = null;
        void startHydration().then((ok) => resolve(Boolean(ok)));
      }, 0);
    });
  }

  async function attachActiveTabRuntime({
    tabId = state.activeTabId || null,
    spawnEngine: shouldSpawnEngine = false,
    engineFailureToast = true,
    reason = "tab_activate",
    hydrationToken = tabHydrationToken,
  } = {}) {
    const normalizedTabId = String(tabId || "").trim();
    if (!normalizedTabId) return false;
    if (!currentTabHydrationMatches(normalizedTabId, hydrationToken)) return false;
    syncSessionToolsFromRegistry();
    renderCreateToolPreview();
    renderCustomToolDock();
    renderSelectionMeta();
    if (!currentTabHydrationMatches(normalizedTabId, hydrationToken)) return false;
    renderFilmstrip();
    chooseSpawnNodes();
    renderSessionApiCallsReadout();
    updateEmptyCanvasHint();
    syncIntentModeClass();
    syncJuggernautShellState();
    applyRuntimeChromeVisibility({ source: reason });
    renderMotherMoodStatus();
    syncTimelineDockVisibility();
    if (state.timelineOpen) {
      renderTimeline();
    }
    requestRender();
    if (!currentTabHydrationMatches(normalizedTabId, hydrationToken)) return false;
    if (shouldSpawnEngine && state.runDir) {
      const ok = await ensureEngineSpawned({ reason, showToastOnFailure: engineFailureToast });
      if (!currentTabHydrationMatches(normalizedTabId, hydrationToken)) return false;
      if (ok) setStatus("Engine: ready");
    } else {
      await syncActiveRunPtyBinding({ useCache: true });
      if (!currentTabHydrationMatches(normalizedTabId, hydrationToken)) return false;
      startEventsPolling();
      renderSessionApiCallsReadout();
    }
    return true;
  }

  async function activateTab(tabId, { spawnEngine = false, reason = "tab_activate", engineFailureToast = true } = {}) {
    const normalized = String(tabId || "").trim();
    const perfSample = startPerfSample("tab:activate-fast-path", {
      reason,
      spawnEngine: Boolean(spawnEngine),
      tabId: normalized,
    });
    const finalize = (result, detail = null) => {
      finishPerfSample(perfSample, "activateTabFastPathMs", {
        ...(detail && typeof detail === "object" ? detail : null),
        activeTabId: state.activeTabId || null,
        tabId: normalized,
      });
      return result;
    };
    if (!normalized) {
      return finalize({ ok: false, reason: "missing_tab" }, { ok: false, reason: "missing_tab" });
    }
    const target = tabbedSessions.getTab(normalized);
    if (!target) {
      return finalize({ ok: false, reason: "missing_tab" }, { ok: false, reason: "missing_tab" });
    }
    const waitForHydration = Boolean(arguments[1]?.waitForHydration);
    if (normalized === String(state.activeTabId || "").trim()) {
      syncActiveTabPreviewRuntime();
      publishActiveTabVisibleState();
      syncLocalMagicSelectUiPrewarmTargets({
        primaryImageId: state.activeId || null,
        hoverImageId: null,
        source: "communication_magic_select",
      });
      const hydration = scheduleTabHydration(normalized, reason, { spawnEngine, engineFailureToast });
      if (waitForHydration) await hydration;
      return finalize(
        { ok: true, tabId: normalized, activeTabId: state.activeTabId || null, hydration },
        { ok: true, sameTab: true }
      );
    }
    const blockReason = currentTabSwitchBlockReason({ allowReviewApply: true });
    if (blockReason) {
      showToast(currentTabSwitchBlockMessage(blockReason), "tip", 2200);
      return finalize(
        { ok: false, reason: blockReason, activeTabId: state.activeTabId || null },
        { ok: false, reason: blockReason }
      );
    }
    if (state.activeTabId) {
      suspendActiveTabRuntimeForSwitch();
      syncActiveTabRecord({ capture: true, publish: true });
    }
    target.session = target.session || createFreshTabSession({ runDir: target.runDir || null, eventsPath: target.eventsPath || null });
    bindTabSessionToState(target.session);
    tabbedSessions.setActiveTab(normalized);
    syncActiveTabPreviewRuntime();
    syncActiveTabRecord({ capture: false, publish: true });
    syncLocalMagicSelectUiPrewarmTargets({
      primaryImageId: state.activeId || null,
      hoverImageId: null,
      source: "communication_magic_select",
    });
    publishActiveTabVisibleState({ allowTabSwitchPreview: true, reason });
    const hydration = scheduleTabHydration(normalized, reason, { spawnEngine, engineFailureToast });
    if (waitForHydration) await hydration;
    return finalize(
      {
        ok: true,
        tabId: normalized,
        activeTabId: state.activeTabId || null,
        hydration,
      },
      { ok: true, switched: true }
    );
  }

  return Object.freeze({
    suspendActiveTabRuntimeForSwitch,
    currentTabHydrationMatches,
    publishActiveTabVisibleState,
    scheduleTabHydration,
    attachActiveTabRuntime,
    activateTab,
  });
}
