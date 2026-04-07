export async function runCanvasAppBootShellSetup({
  documentObj = globalThis.document,
  ResizeObserverCtor = globalThis.ResizeObserver,
  consoleObj = globalThis.console,
  dom,
  state,
  effectsRuntime = null,
  stopLarvaAnimator,
  stopMotherGlitchLoop,
  ensureLarvaAnimator,
  startMotherGlitchLoop,
  ensureCanvasSize,
  scheduleVisualPromptWrite,
  requestRender,
  ensureBootShellTab,
  installCanvasHandlers,
  installDnD,
  installUi,
  installJuggernautShellUi,
  renderCommunicationChrome,
  renderMotherMoodStatus,
  setMotherMoodMenuOpen,
  initializeFileBrowserDock,
  enableFileBrowserDock = false,
  startSpawnTimer,
} = {}) {
  const runOptionalShellStep = async (label, handler) => {
    if (typeof handler !== "function") return;
    try {
      await handler();
    } catch (error) {
      consoleObj?.error?.(`Cue boot shell setup failed during ${label}:`, error);
    }
  };

  documentObj?.addEventListener?.("visibilitychange", () => {
    if (documentObj.hidden) {
      stopLarvaAnimator();
      stopMotherGlitchLoop();
    } else {
      ensureLarvaAnimator();
      startMotherGlitchLoop();
    }
    if (effectsRuntime) {
      effectsRuntime.setSuspended(documentObj.hidden || state?.canvasMode !== "multi");
    }
  });

  if (typeof ResizeObserverCtor === "function" && dom?.canvasWrap) {
    new ResizeObserverCtor(() => {
      ensureCanvasSize();
      scheduleVisualPromptWrite();
      requestRender();
    }).observe(dom.canvasWrap);
  }

  ensureBootShellTab();
  await runOptionalShellStep("installCanvasHandlers", installCanvasHandlers);
  await runOptionalShellStep("installDnD", installDnD);
  await runOptionalShellStep("installUi", installUi);
  await runOptionalShellStep("installJuggernautShellUi", installJuggernautShellUi);
  await runOptionalShellStep("renderCommunicationChrome", renderCommunicationChrome);
  await runOptionalShellStep("renderMotherMoodStatus", renderMotherMoodStatus);
  await runOptionalShellStep("setMotherMoodMenuOpen", () => setMotherMoodMenuOpen(false));
  if (enableFileBrowserDock) {
    await runOptionalShellStep("initializeFileBrowserDock", initializeFileBrowserDock);
  }
  await runOptionalShellStep("startMotherGlitchLoop", startMotherGlitchLoop);
  await runOptionalShellStep("startSpawnTimer", startSpawnTimer);
}
