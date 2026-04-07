export function desktopSessionCommandUnavailable(error, commandName = "") {
  const message = String(error?.message || error || "");
  if (!message.includes("unknown Tauri command")) return false;
  return !commandName || message.includes(commandName);
}

export function desktopSessionInactiveRunError(error) {
  return String(error?.message || error || "").includes("desktop session runDir is not the active runtime");
}

export function joinRunPathLeaf(runDir = "", leaf = "") {
  const normalizedRunDir = String(runDir || "").trim();
  const normalizedLeaf = String(leaf || "").trim();
  if (!normalizedRunDir || !normalizedLeaf) return "";
  if (normalizedRunDir.endsWith("/") || normalizedRunDir.endsWith("\\")) {
    return `${normalizedRunDir}${normalizedLeaf}`;
  }
  return `${normalizedRunDir}${normalizedRunDir.includes("\\") ? "\\" : "/"}${normalizedLeaf}`;
}

export function normalizeCanvasAppPtyStatus(
  status = null,
  {
    runDir = null,
    eventsPath = null,
    readFirstString = (...values) => {
      for (const value of values) {
        const normalized = String(value || "").trim();
        if (normalized) return normalized;
      }
      return "";
    },
  } = {}
) {
  const current = status && typeof status === "object" ? status : {};
  const runtime = current.runtime && typeof current.runtime === "object" ? current.runtime : {};
  const launch = current.launch && typeof current.launch === "object" ? current.launch : {};
  const session = current.session && typeof current.session === "object" ? current.session : {};
  const normalizedRunDir = readFirstString(current.run_dir, current.runDir, session.runDir, runDir) || null;
  const normalizedEventsPath =
    readFirstString(
      current.events_path,
      current.eventsPath,
      eventsPath,
      normalizedRunDir ? joinRunPathLeaf(normalizedRunDir, "events.jsonl") : ""
    ) || null;
  const running = runtime.running != null ? Boolean(runtime.running) : Boolean(current.running);
  const phase = readFirstString(runtime.phase, current.phase) || (running ? "ready" : "stopped");
  const rawPid = runtime.pid ?? current.pid;
  return {
    contract: readFirstString(current.contract) || null,
    running,
    phase,
    run_dir: normalizedRunDir,
    events_path: normalizedEventsPath,
    launch_mode: readFirstString(current.launch_mode, launch.mode) || null,
    launch_label: readFirstString(current.launch_label, launch.label) || null,
    detail: readFirstString(current.detail, current.last_error, current.last_exit_detail) || null,
    pid: Number.isFinite(Number(rawPid)) ? Number(rawPid) : null,
  };
}

export function createCanvasAppDesktopSessionBridge({
  state,
  getCachedStatus = () => ({ status: null, fetchedAt: 0 }),
  setCachedStatus = () => {},
  getPendingStatusPromise = () => null,
  setPendingStatusPromise = () => {},
  cacheTtlMs = 1200,
  nowMs = () => Date.now(),
  readFirstString = (...values) => {
    for (const value of values) {
      const normalized = String(value || "").trim();
      if (normalized) return normalized;
    }
    return "";
  },
  requestDesktopSessionStatus = async () => null,
  requestLegacyPtyStatus = async () => null,
  handleEvent = async () => {},
  unwrapDesktopSessionUpdate = (payload) => payload,
  desktopSessionUpdateKinds = Object.freeze({
    STATUS: "status",
    EVENT: "event",
  }),
} = {}) {
  const normalizePtyStatus = (status = null, { runDir = state?.runDir || null, eventsPath = state?.eventsPath || null } = {}) =>
    normalizeCanvasAppPtyStatus(status, {
      runDir,
      eventsPath,
      readFirstString,
    });

  function ptyStatusMatchesActiveRun(status) {
    const normalizedStatus = normalizePtyStatus(status);
    if (!normalizedStatus.running) return false;
    const runDir = String(state?.runDir || "").trim();
    const eventsPath = String(state?.eventsPath || "").trim();
    if (!runDir || !eventsPath) return false;
    const statusRunDir = String(normalizedStatus.run_dir || "").trim();
    const statusEventsPath = String(normalizedStatus.events_path || "").trim();
    if (statusRunDir && statusRunDir !== runDir) return false;
    if (statusEventsPath && statusEventsPath !== eventsPath) return false;
    return statusRunDir === runDir;
  }

  function invalidatePtyStatusCache() {
    setCachedStatus({
      status: null,
      fetchedAt: 0,
    });
  }

  function cachePtyStatus(status) {
    setCachedStatus({
      status: status && typeof status === "object" ? normalizePtyStatus(status) : null,
      fetchedAt: nowMs(),
    });
  }

  function activateDesktopSessionBridgeForActiveRun(runDir = state?.runDir || null) {
    const nextRunDir = String(runDir || "").trim();
    const activeRunDir = String(state?.runDir || "").trim();
    if (!nextRunDir || !activeRunDir || nextRunDir !== activeRunDir) return false;
    if (!state.desktopSessionBridgeActive) {
      state.desktopSessionBridgeActive = true;
    }
    return true;
  }

  async function readPtyStatus({ useCache = true } = {}) {
    const cache = getCachedStatus() || {};
    const now = nowMs();
    if (
      useCache &&
      cache.status &&
      now - Number(cache.fetchedAt || 0) <= cacheTtlMs
    ) {
      return cache.status;
    }

    let pendingPromise = getPendingStatusPromise();
    if (!pendingPromise) {
      pendingPromise = (async () => {
        const normalizedRunDir = String(state?.runDir || "").trim();
        const normalizedEventsPath = String(state?.eventsPath || "").trim() || null;
        if (normalizedRunDir) {
          try {
            const response = await requestDesktopSessionStatus({
              runDir: normalizedRunDir,
              eventsPath: normalizedEventsPath,
            });
            activateDesktopSessionBridgeForActiveRun(normalizedRunDir);
            const status = normalizePtyStatus(response, {
              runDir: normalizedRunDir,
              eventsPath: normalizedEventsPath,
            });
            cachePtyStatus(status);
            return status;
          } catch (error) {
            if (desktopSessionInactiveRunError(error)) {
              const inactiveStatus = normalizePtyStatus(
                {
                  running: false,
                  run_dir: normalizedRunDir,
                  events_path: normalizedEventsPath,
                  detail: String(error?.message || error || "").trim() || null,
                },
                { runDir: normalizedRunDir, eventsPath: normalizedEventsPath }
              );
              cachePtyStatus(inactiveStatus);
              return inactiveStatus;
            }
            if (!desktopSessionCommandUnavailable(error, "desktop_session_status")) {
              throw error;
            }
          }
        }
        const legacyStatus = normalizePtyStatus(await requestLegacyPtyStatus({
          runDir: normalizedRunDir,
          eventsPath: normalizedEventsPath,
        }), {
          runDir: normalizedRunDir,
          eventsPath: normalizedEventsPath,
        });
        cachePtyStatus(legacyStatus);
        return legacyStatus;
      })().finally(() => {
        setPendingStatusPromise(null);
      });
      setPendingStatusPromise(pendingPromise);
    }
    return pendingPromise;
  }

  function isDesktopSessionUpdateActiveForRun(runDir) {
    const activeRunDir = String(state?.runDir || "").trim();
    const pollRunDir = String(state?.poller?.runDir || "").trim();
    const nextRunDir = String(runDir || "").trim();
    return Boolean(nextRunDir && nextRunDir === activeRunDir && nextRunDir === pollRunDir);
  }

  function normalizeDesktopSessionUpdateStatus(update = null) {
    return normalizePtyStatus(
      {
        contract: update?.contract,
        session: {
          runDir: update?.runDir,
        },
        runtime: update?.runtime,
        launch: update?.launch,
        detail: update?.detail,
      },
      {
        runDir: update?.runDir || state?.runDir || null,
        eventsPath: state?.eventsPath || null,
      }
    );
  }

  async function handleDesktopSessionBridgeUpdate(event) {
    const update = unwrapDesktopSessionUpdate(event?.payload);
    if (!update || !isDesktopSessionUpdateActiveForRun(update.runDir)) return null;
    activateDesktopSessionBridgeForActiveRun(update.runDir);
    if (update.kind === desktopSessionUpdateKinds.STATUS) {
      const status = normalizeDesktopSessionUpdateStatus(update);
      cachePtyStatus(status);
      return {
        kind: desktopSessionUpdateKinds.STATUS,
        update,
        status,
      };
    }
    if (update.kind === desktopSessionUpdateKinds.EVENT && update.event) {
      await handleEvent(update.event);
      return {
        kind: desktopSessionUpdateKinds.EVENT,
        update,
        status: null,
      };
    }
    return {
      kind: update.kind,
      update,
      status: null,
    };
  }

  return Object.freeze({
    normalizePtyStatus,
    ptyStatusMatchesActiveRun,
    invalidatePtyStatusCache,
    cachePtyStatus,
    activateDesktopSessionBridgeForActiveRun,
    readPtyStatus,
    isDesktopSessionUpdateActiveForRun,
    handleDesktopSessionBridgeUpdate,
  });
}
