function readNativeMenuAction(payload = null) {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") {
    return String(payload.action || "").trim();
  }
  return "";
}

export function handleCanvasAppNativeMenuAction(
  event,
  {
    parseNativeSlotIndex,
    bumpInteraction,
    runWithUserError,
    runNativeToolSlot,
    runNativeShortcutSlot,
    applyRailIconPackSetting,
    createRun,
    openExistingRun,
    saveActiveSessionSnapshot,
    closeTab,
    getActiveTabId = () => null,
    requestJuggernautExport,
    juggernautExportRetryHint,
    showCreateToolPanel,
    importPhotos,
    settingsToggleEl = null,
  } = {}
) {
  const action = readNativeMenuAction(event?.payload);
  const nativeToolSlotIndex = parseNativeSlotIndex(action, "tools_slot_");
  if (nativeToolSlotIndex >= 0) {
    bumpInteraction();
    void runWithUserError("Tool", () => runNativeToolSlot(nativeToolSlotIndex), {
      retryHint: "Adjust the canvas state and retry.",
    });
    return;
  }
  const nativeShortcutSlotIndex = parseNativeSlotIndex(action, "shortcuts_slot_");
  if (nativeShortcutSlotIndex >= 0) {
    bumpInteraction();
    void runWithUserError("Shortcut", () => runNativeShortcutSlot(nativeShortcutSlotIndex), {
      retryHint: "Pick a visible image or selection and retry.",
    });
    return;
  }
  if (action.startsWith("settings_icon_pack:")) {
    bumpInteraction();
    applyRailIconPackSetting(action.slice("settings_icon_pack:".length), {
      source: "native_menu",
    });
    return;
  }
  if (action === "new_session") {
    bumpInteraction();
    void runWithUserError("New session", () => createRun(), {
      retryHint: "Check permissions and try again.",
    });
    return;
  }
  if (action === "open_session") {
    bumpInteraction();
    void runWithUserError("Open session", () => openExistingRun(), {
      retryHint: "Choose a valid run folder and retry.",
    });
    return;
  }
  if (action === "save_session") {
    bumpInteraction();
    void runWithUserError("Save session", () => saveActiveSessionSnapshot({ source: "native_menu" }), {
      retryHint: "Wait for the current action to settle and retry.",
    });
    return;
  }
  if (action === "close_session") {
    bumpInteraction();
    void runWithUserError("Close session", () => closeTab(getActiveTabId()), {
      retryHint: "Wait for the current action to finish and retry.",
    });
    return;
  }
  if (action === "export_session" || action === "export_psd") {
    bumpInteraction();
    void runWithUserError("Export session", () => requestJuggernautExport({ format: "psd", source: "native_menu" }), {
      retryHint: juggernautExportRetryHint("psd"),
    });
    return;
  }
  if (action === "open_create_tool") {
    bumpInteraction();
    showCreateToolPanel();
    return;
  }
  if (action === "import_photos") {
    bumpInteraction();
    runWithUserError("Import photos", () => importPhotos(), {
      retryHint: "Choose supported image files and retry.",
    });
    return;
  }
  if (action === "open_settings") {
    bumpInteraction();
    settingsToggleEl?.click?.();
  }
}

export async function installCanvasAppBootRuntime({
  listen,
  desktopSessionUpdateEvent,
  state,
  readPtyStatus,
  cachePtyStatus,
  setStatus,
  resetDescribeQueue,
  recoverEffectTokenApply,
  clearPendingReplace,
  setImageFxActive,
  updatePortraitIdle,
  setDirectorText,
  renderQuickActions,
  handleDesktopSessionBridgeUpdate,
  handleDesktopAutomation,
  parseNativeSlotIndex,
  bumpInteraction,
  runWithUserError,
  runNativeToolSlot,
  runNativeShortcutSlot,
  applyRailIconPackSetting,
  createRun,
  openExistingRun,
  saveActiveSessionSnapshot,
  closeTab,
  requestJuggernautExport,
  juggernautExportRetryHint,
  showCreateToolPanel,
  importPhotos,
  settingsToggleEl = null,
  getActiveTabId = () => state?.activeTabId || null,
  setFlushDeferredEnginePtyExit = null,
  consoleObj = globalThis.console,
} = {}) {
  const handleEnginePtyExit = async ({ detail = null, useStaleGuard = true } = {}) => {
    if (useStaleGuard) {
      try {
        const status = await readPtyStatus({ useCache: false });
        if (status?.running) {
          if (state.pendingPtyExit) {
            state.pendingPtyExit = false;
          }
          consoleObj.info("[brood] ignored stale pty-exit while PTY remains running");
          return;
        }
      } catch {
        // Best-effort stale-exit guard; fall back to existing handling if unavailable.
      }
    }

    if (state.ptySpawning) {
      state.pendingPtyExit = true;
      consoleObj.info("[brood] deferred pty-exit while spawn is in progress");
      return;
    }
    cachePtyStatus({ running: false, run_dir: null, events_path: null, detail });
    state.pendingPtyExit = false;
    state.desktopSessionBridgeActive = false;
    setStatus(detail ? `Engine: exited (${detail})` : "Engine: exited", true);
    state.ptySpawned = false;
    resetDescribeQueue({ clearPending: true });
    state.expectingArtifacts = false;
    state.pendingBlend = null;
    state.pendingSwapDna = null;
    state.pendingBridge = null;
    state.pendingExtractDna = null;
    state.pendingSoulLeech = null;
    state.pendingRecast = null;
    state.pendingCreateLayers = null;
    state.pendingPromptGenerate = null;
    for (const [tokenId] of state.effectTokenApplyLocks.entries()) {
      const token = state.effectTokensById.get(tokenId) || null;
      if (token) recoverEffectTokenApply(token);
    }
    state.effectTokenApplyLocks.clear();
    clearPendingReplace();
    state.runningActionKey = null;
    state.engineImageModelRestore = null;
    setImageFxActive(false);
    updatePortraitIdle();
    setDirectorText(null, null);
    renderQuickActions();
  };

  const flushDeferredEnginePtyExit = async () => {
    if (!state.pendingPtyExit || state.ptySpawning) return;
    await handleEnginePtyExit();
  };

  if (typeof setFlushDeferredEnginePtyExit === "function") {
    setFlushDeferredEnginePtyExit(flushDeferredEnginePtyExit);
  }

  await listen("pty-exit", async () => {
    await handleEnginePtyExit();
  });

  await listen(desktopSessionUpdateEvent, async (event) => {
    const bridgeUpdate = await handleDesktopSessionBridgeUpdate(event);
    const update = bridgeUpdate?.update && typeof bridgeUpdate.update === "object" ? bridgeUpdate.update : null;
    const status = bridgeUpdate?.status && typeof bridgeUpdate.status === "object" ? bridgeUpdate.status : null;
    const launchMode = String(update?.launch?.mode || "").trim();
    const launchLabel = String(update?.launch?.label || "").trim();
    if (launchMode) state.engineLaunchMode = launchMode;
    if (launchLabel) state.engineLaunchPath = launchLabel;
    if (!status) return;
    state.ptySpawned = Boolean(status.running);
    if (!status.running && !state.ptySpawning) {
      await handleEnginePtyExit({
        detail: update?.detail || status.detail || null,
        useStaleGuard: false,
      });
    }
  });

  await listen("desktop-automation", (event) => {
    consoleObj.log("[desktop-automation] listener hit", event);
    void handleDesktopAutomation(event);
  });

  await listen("native-menu-action", (event) => {
    handleCanvasAppNativeMenuAction(event, {
      parseNativeSlotIndex,
      bumpInteraction,
      runWithUserError,
      runNativeToolSlot,
      runNativeShortcutSlot,
      applyRailIconPackSetting,
      createRun,
      openExistingRun,
      saveActiveSessionSnapshot,
      closeTab,
      getActiveTabId,
      requestJuggernautExport,
      juggernautExportRetryHint,
      showCreateToolPanel,
      importPhotos,
      settingsToggleEl,
    });
  });

  return {
    handleEnginePtyExit,
    flushDeferredEnginePtyExit,
  };
}
