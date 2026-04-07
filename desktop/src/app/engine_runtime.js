export function adaptCanvasAppDesktopSessionStatusResponse(response, fallbackRunDir = null) {
  const runDir =
    String(response?.session?.runDir || "").trim() || String(fallbackRunDir || "").trim() || null;
  const running = Boolean(response?.runtime?.running);
  const phase = String(response?.runtime?.phase || "").trim();
  const detail = response?.detail ? String(response.detail) : null;
  return {
    running,
    has_child: running,
    has_writer: running,
    pid: Number.isFinite(Number(response?.runtime?.pid)) ? Number(response.runtime.pid) : null,
    automation_frontend_ready: false,
    run_dir: runDir,
    events_path: runDir ? `${runDir}/events.jsonl` : null,
    launch_mode: response?.launch?.mode ? String(response.launch.mode) : null,
    launch_label: response?.launch?.label ? String(response.launch.label) : null,
    last_exit_detail: phase === "stopped" ? detail : null,
    last_error: phase === "error" ? detail : null,
  };
}

export function createCanvasAppEngineRuntime({
  state,
  settings,
  PTY_COMMANDS,
  tauriInvoke,
  buildDesktopSessionStartRequest,
  startDesktopSession,
  cachePtyStatus,
  invalidatePtyStatusCache,
  readPtyStatus,
  ptyStatusMatchesActiveRun,
  writeCanvasRuntimePty,
  getActiveImage,
  setStatus,
  startEventsPolling = () => {},
  showToast = () => {},
  getFlushDeferredEnginePtyExit = () => null,
  processActionQueue = () => Promise.resolve(),
  consoleObj = globalThis.console,
} = {}) {
  async function syncActiveRunPtyBinding({ useCache = true } = {}) {
    if (!state.runDir || !state.eventsPath || state.ptySpawning) {
      state.ptySpawned = false;
      return false;
    }

    try {
      const status = await readPtyStatus({ useCache });
      state.ptySpawned = ptyStatusMatchesActiveRun(status);
    } catch (_) {
      invalidatePtyStatusCache();
      state.ptySpawned = false;
    }
    return Boolean(state.ptySpawned);
  }

  async function ensureEngineSpawned({ reason = "engine", showToastOnFailure = true } = {}) {
    if (state.ptySpawning) return false;
    if (!state.runDir || !state.eventsPath) return false;

    if (await syncActiveRunPtyBinding()) {
      startEventsPolling();
      setStatus("Engine: connected");
      return true;
    }

    await spawnEngine();
    if (state.ptySpawned) startEventsPolling();
    if (!state.ptySpawned && showToastOnFailure) {
      showToast(`Engine failed to start for ${reason}.`, "error", 3200);
    }
    return Boolean(state.ptySpawned);
  }

  async function spawnEngine() {
    if (!state.runDir || !state.eventsPath) return;
    if (state.ptySpawning) return;
    state.ptySpawning = true;
    setStatus("Engine: starting…");
    state.ptySpawned = false;
    state.desktopSessionBridgeActive = false;
    const preferredMode = "native";
    try {
      const response = await startDesktopSession(
        tauriInvoke,
        buildDesktopSessionStartRequest({
          runDir: state.runDir,
          memoryEnabled: settings.memory,
        })
      );
      state.ptySpawned = Boolean(response?.runtime?.running);
      cachePtyStatus(adaptCanvasAppDesktopSessionStatusResponse(response, state.runDir));
      state.engineLaunchMode = response?.launch?.mode ? String(response.launch.mode) : "native";
      state.engineLaunchPath = response?.launch?.label ? String(response.launch.label) : "unknown";
      consoleObj.info?.(
        `[brood] engine launch mode=${state.engineLaunchMode} path=${state.engineLaunchPath} preferred=${preferredMode}`
      );
      await writeCanvasRuntimePty(`${PTY_COMMANDS.TEXT_MODEL} ${settings.textModel}\n`).catch(() => {});
      await writeCanvasRuntimePty(`${PTY_COMMANDS.IMAGE_MODEL} ${settings.imageModel}\n`).catch(() => {});
      const active = getActiveImage();
      if (active?.path) {
        await writeCanvasRuntimePty(`${PTY_COMMANDS.USE} ${active.path}\n`).catch(() => {});
      }
      if (!state.ptySpawned) {
        const detail = response?.detail || "native engine launch failed";
        throw new Error(
          `${detail}. Native engine launch failed; Python compatibility runtime is no longer available in desktop runtime.`
        );
      }
      setStatus(`Engine: started (${state.engineLaunchMode})`);
    } catch (error) {
      consoleObj.error?.(error);
      invalidatePtyStatusCache();
      setStatus(`Engine: failed (${error?.message || error})`, true);
    } finally {
      state.ptySpawning = false;
      const flushDeferredEnginePtyExit = getFlushDeferredEnginePtyExit();
      if (typeof flushDeferredEnginePtyExit === "function") {
        await flushDeferredEnginePtyExit();
      }
      processActionQueue().catch(() => {});
    }
  }

  return Object.freeze({
    syncActiveRunPtyBinding,
    ensureEngineSpawned,
    spawnEngine,
  });
}
