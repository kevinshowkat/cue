function replaceResizeObserver({
  ResizeObserverCtor = globalThis.ResizeObserver,
  previousObserver = null,
  target = null,
  onResize = null,
  requestAnimationFrameFn = globalThis.requestAnimationFrame,
} = {}) {
  if (typeof ResizeObserverCtor !== "function" || !target || typeof onResize !== "function") {
    return previousObserver;
  }
  try {
    previousObserver?.disconnect?.();
    const observer = new ResizeObserverCtor(() => {
      onResize();
    });
    observer.observe(target);
    if (typeof requestAnimationFrameFn === "function") {
      requestAnimationFrameFn(() => {
        onResize();
      });
    } else {
      onResize();
    }
    return observer;
  } catch {
    return null;
  }
}

export function runCanvasAppBootPreflight({
  windowObj = globalThis.window,
  documentObj = globalThis.document,
  CustomEventCtor = globalThis.CustomEvent,
  ResizeObserverCtor = globalThis.ResizeObserver,
  requestAnimationFrameFn = globalThis.requestAnimationFrame,
  clearIntervalFn = globalThis.clearInterval,
  setIntervalFn = globalThis.setInterval,
  topMetricsIntervalMs = 15_000,
  dom,
  state,
  topMetricsTickTimer = null,
  brandStripResizeObserver = null,
  hudResizeObserver = null,
  setStatus,
  setRunInfo,
  ensureInstallTelemetryReady,
  renderInstallTelemetryStatus,
  ensureIntentUiIconsLoaded,
  refreshKeyStatus,
  updateAlwaysOnVisionReadout,
  renderQuickActions,
  applyRuntimeChromeVisibility,
  installToolApplyBridge,
  applyToolRuntimeEdit,
  installAgentObservableDriverRuntime,
  publishAgentRunnerBridge,
  renderSessionApiCallsReadout,
  syncBrandStripHeightVar,
  ensurePortraitIndex,
  updatePortraitIdle,
  syncIntentModeClass,
  updateEmptyCanvasHint,
  renderSelectionMeta,
  chooseSpawnNodes,
  renderFilmstrip,
  renderAgentRunnerPlannerOptions,
  renderAgentRunnerPanel,
  ensureCanvasSize,
  createEffectsRuntime,
  getDpr,
  syncHudHeightVar,
  installDprWatcher,
} = {}) {
  setStatus("Engine: booting…");
  setRunInfo("No run");
  ensureInstallTelemetryReady().catch(() => {});
  renderInstallTelemetryStatus();
  ensureIntentUiIconsLoaded().catch(() => {});
  refreshKeyStatus().catch(() => {});
  updateAlwaysOnVisionReadout();
  renderQuickActions();
  applyRuntimeChromeVisibility({ source: "boot" });

  if (windowObj) {
    installToolApplyBridge({
      windowObj,
      CustomEventCtor: typeof CustomEventCtor === "function" ? CustomEventCtor : null,
      applyToolRuntimeEdit,
    });
    installAgentObservableDriverRuntime();
    publishAgentRunnerBridge();
  }

  renderSessionApiCallsReadout();
  clearIntervalFn(topMetricsTickTimer);
  topMetricsTickTimer = setIntervalFn(() => {
    renderSessionApiCallsReadout();
  }, topMetricsIntervalMs);

  syncBrandStripHeightVar();
  brandStripResizeObserver = replaceResizeObserver({
    ResizeObserverCtor,
    previousObserver: brandStripResizeObserver,
    target: dom?.brandStrip || null,
    onResize: syncBrandStripHeightVar,
    requestAnimationFrameFn,
  });

  ensurePortraitIndex().catch(() => {});
  updatePortraitIdle({ fromSettings: true });
  syncIntentModeClass();
  updateEmptyCanvasHint();
  renderSelectionMeta();
  chooseSpawnNodes();
  renderFilmstrip();
  renderAgentRunnerPlannerOptions();
  renderAgentRunnerPanel();
  ensureCanvasSize();

  const effectsRuntime = createEffectsRuntime({ canvas: dom.effectsCanvas });
  effectsRuntime.resize({
    width: dom.workCanvas.width,
    height: dom.workCanvas.height,
    dpr: getDpr(),
  });
  effectsRuntime.setSuspended(Boolean(documentObj?.hidden) || state?.canvasMode !== "multi");

  const hudShell = dom.hud ? dom.hud.querySelector(".hud-shell") : null;
  hudResizeObserver = replaceResizeObserver({
    ResizeObserverCtor,
    previousObserver: hudResizeObserver,
    target: hudShell || dom.hud || null,
    onResize: syncHudHeightVar,
    requestAnimationFrameFn,
  });

  installDprWatcher();

  return {
    effectsRuntime,
    topMetricsTickTimer,
    brandStripResizeObserver,
    hudResizeObserver,
  };
}
