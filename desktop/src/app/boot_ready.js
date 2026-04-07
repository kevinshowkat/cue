export async function runCanvasAppBootReadySequence({
  railIconPack = "",
  syncNativeIconographyMenu,
  ensureRun,
  installJuggernautShellBridge,
  installBuiltInSingleImageRailIntegration,
  renderQuickActions = null,
  applyRuntimeChromeVisibility,
  setTimeoutFn = globalThis.setTimeout,
  onboardingDelayMs = 140,
  maybeAutoOpenOpenRouterOnboarding,
  invokeFn,
  requestRender,
  consoleObj = globalThis.console,
} = {}) {
  await syncNativeIconographyMenu(railIconPack);
  await ensureRun();
  installJuggernautShellBridge();
  installBuiltInSingleImageRailIntegration();
  renderQuickActions?.();
  applyRuntimeChromeVisibility({ source: "bridge_ready" });
  setTimeoutFn(() => {
    maybeAutoOpenOpenRouterOnboarding();
  }, onboardingDelayMs);
  await invokeFn("report_automation_frontend_ready", { ready: true }).catch((err) => {
    consoleObj.warn("desktop automation readiness handshake failed", err);
  });
  requestRender();
}
