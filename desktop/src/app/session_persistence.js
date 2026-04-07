function sortedTimelineNodes(nodes = []) {
  return (Array.isArray(nodes) ? nodes.slice() : []).sort((left, right) => {
    const leftSeq = Number(left?.seq) || 0;
    const rightSeq = Number(right?.seq) || 0;
    if (leftSeq !== rightSeq) return leftSeq - rightSeq;
    const leftCreatedAt = String(left?.createdAt || "");
    const rightCreatedAt = String(right?.createdAt || "");
    if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt.localeCompare(rightCreatedAt);
    return String(left?.nodeId || "").localeCompare(String(right?.nodeId || ""));
  });
}

export function createCanvasAppSessionPersistence({
  state,
  joinPath,
  sessionSnapshotFilename = "session.json",
  legacySessionSnapshotFilename = "juggernaut-session.json",
  sessionTimelineFilename = "session-timeline.json",
  serializeSessionTimeline,
  deserializeSessionTimeline,
  restoreSessionTimelineSnapshot,
  serializeSessionSnapshot,
  deserializeSessionSnapshot,
  writeTextFile,
  readTextFile,
  readDir,
  captureActiveTabSession,
  createFreshTabSession,
  currentTabSwitchBlockReason,
  currentTabSwitchBlockMessage,
  showToast,
  ensureRun,
  tabbedSessions,
  syncSessionToolsFromRegistry,
  syncActiveTabRecord,
  sessionTabDisplayLabel,
  defaultUntitledTabTitle = "Untitled Canvas",
  queueNativeSystemMenuSync = () => {},
  timelineSortedNodes = sortedTimelineNodes,
  basename = (path = "") => {
    const normalized = String(path || "").replace(/\\/g, "/");
    const parts = normalized.split("/");
    return parts[parts.length - 1] || normalized;
  },
  addImage = () => {},
  extractReceiptMeta = () => null,
  setActiveImage = async () => {},
  setCanvasMode = () => {},
  setTip = () => {},
  consoleObj = globalThis.console,
} = {}) {
  async function joinRunScopedPath(runDir = "", leaf = "") {
    const targetRunDir = String(runDir || "").trim();
    const targetLeaf = String(leaf || "").trim();
    if (!targetRunDir || !targetLeaf) return "";
    try {
      return await joinPath(targetRunDir, targetLeaf);
    } catch {
      return `${targetRunDir}/${targetLeaf}`;
    }
  }

  async function sessionSnapshotPathForRunDir(runDir = "") {
    return joinRunScopedPath(runDir, sessionSnapshotFilename);
  }

  async function legacySessionSnapshotPathForRunDir(runDir = "") {
    return joinRunScopedPath(runDir, legacySessionSnapshotFilename);
  }

  async function sessionTimelinePathForRunDir(runDir = "") {
    return joinRunScopedPath(runDir, sessionTimelineFilename);
  }

  function buildSessionTimelinePayloadFromSession(session = null, { runDir = null } = {}) {
    const current = session && typeof session === "object" ? session : {};
    return serializeSessionTimeline({
      runDir: runDir || current.runDir || null,
      headNodeId: current.timelineHeadNodeId || null,
      latestNodeId: current.timelineLatestNodeId || null,
      nextSeq: current.timelineNextSeq || 1,
      updatedAt: new Date().toISOString(),
      nodes: Array.isArray(current.timelineNodes) ? current.timelineNodes : [],
    });
  }

  async function writeSessionTimelineForRunDir(runDir = "", payload = null) {
    const outPath = await sessionTimelinePathForRunDir(runDir);
    if (!outPath || !payload || typeof payload !== "object") return null;
    await writeTextFile(outPath, JSON.stringify(payload, null, 2));
    return outPath;
  }

  async function persistSessionTimelineForSession(session = null) {
    const current = session && typeof session === "object" ? session : null;
    const runDir = String(current?.runDir || "").trim();
    if (!runDir) return null;
    const payload = buildSessionTimelinePayloadFromSession(current, { runDir });
    try {
      return await writeSessionTimelineForRunDir(runDir, payload);
    } catch (error) {
      consoleObj.warn?.("session timeline write failed", error);
      return null;
    }
  }

  async function persistActiveSessionTimeline() {
    const activeSession = captureActiveTabSession(
      createFreshTabSession({
        runDir: state.runDir || null,
        eventsPath: state.eventsPath || null,
      })
    );
    return await persistSessionTimelineForSession(activeSession);
  }

  async function loadSessionTimelineFromPath(path = "") {
    const targetPath = String(path || "").trim();
    if (!targetPath) return null;
    const raw = await readTextFile(targetPath);
    return deserializeSessionTimeline(JSON.parse(raw));
  }

  function restoreSessionFromTimelineRecord(timeline = null, { runDir = null, eventsPath = null } = {}) {
    const current = timeline && typeof timeline === "object" ? timeline : null;
    if (!current || !Array.isArray(current.nodes) || !current.nodes.length) return null;
    const nodes = timelineSortedNodes(current.nodes);
    const headNodeId = String(current.headNodeId || current.latestNodeId || nodes[nodes.length - 1]?.nodeId || "").trim();
    const headNode =
      nodes.find((node) => String(node?.nodeId || "").trim() === headNodeId) ||
      nodes[nodes.length - 1] ||
      null;
    if (!headNode?.snapshot) return null;
    const restoredSession = restoreSessionTimelineSnapshot(headNode.snapshot, {
      runDir: runDir || current.runDir || null,
      eventsPath,
    });
    restoredSession.timelineNodes = nodes;
    restoredSession.timelineNodesById = new Map(
      nodes
        .filter((node) => node?.nodeId)
        .map((node) => [String(node.nodeId), node])
    );
    restoredSession.timelineHeadNodeId = headNode.nodeId;
    restoredSession.timelineLatestNodeId =
      String(current.latestNodeId || "").trim() ||
      (nodes[nodes.length - 1]?.nodeId || headNode.nodeId);
    restoredSession.timelineNextSeq = Math.max(
      1,
      Number(current.nextSeq) || 0,
      nodes.length ? Math.max(...nodes.map((node) => Math.max(1, Number(node?.seq) || 1))) + 1 : 1
    );
    restoredSession.timelineOpen = true;
    return restoredSession;
  }

  async function saveActiveSessionSnapshot({ source = "menu" } = {}) {
    void source;
    const blockReason = currentTabSwitchBlockReason();
    if (blockReason) {
      showToast(currentTabSwitchBlockMessage(blockReason), "tip", 2200);
      return { ok: false, reason: blockReason };
    }
    const activeTabId = String(state.activeTabId || "").trim();
    if (!activeTabId) return { ok: false, reason: "missing_tab" };
    await ensureRun();
    const record = tabbedSessions.getTab(activeTabId) || null;
    if (!record) return { ok: false, reason: "missing_tab" };
    syncSessionToolsFromRegistry();
    syncActiveTabRecord({ capture: true, publish: true });
    const session = record.session && typeof record.session === "object" ? record.session : captureActiveTabSession();
    const outPath = await sessionSnapshotPathForRunDir(session.runDir || state.runDir || "");
    if (!outPath) return { ok: false, reason: "missing_run_dir" };
    const timelineOutPath = await persistSessionTimelineForSession(session);
    const payload = serializeSessionSnapshot({
      session,
      label: sessionTabDisplayLabel(record, defaultUntitledTabTitle),
    });
    await writeTextFile(outPath, JSON.stringify(payload, null, 2));
    showToast(`Saved session to ${basename(outPath)}.`, "tip", 2200);
    queueNativeSystemMenuSync();
    return { ok: true, outPath, timelineOutPath };
  }

  async function loadSessionSnapshotFromPath(path = "") {
    const targetPath = String(path || "").trim();
    if (!targetPath) return null;
    const raw = await readTextFile(targetPath);
    return deserializeSessionSnapshot(JSON.parse(raw));
  }

  async function loadExistingArtifacts() {
    if (!state.runDir) return;
    const entries = await readDir(state.runDir, { recursive: false }).catch(() => []);
    let restored = 0;
    for (const entry of entries) {
      if (!entry?.name) continue;
      if (!entry.name.startsWith("receipt-") || !entry.name.endsWith(".json")) continue;
      const receiptPath = entry.path;
      let payload = null;
      try {
        payload = JSON.parse(await readTextFile(receiptPath));
      } catch {
        continue;
      }
      const imagePath = payload?.artifacts?.image_path;
      if (typeof imagePath !== "string" || !imagePath) continue;
      const artifactId = entry.name.slice("receipt-".length).replace(/\.json$/, "");
      addImage(
        {
          id: artifactId,
          kind: "receipt",
          path: imagePath,
          receiptPath,
          receiptMeta: extractReceiptMeta(payload),
          receiptMetaChecked: true,
          label: basename(imagePath),
        },
        { select: false }
      );
      restored += 1;
    }
    if (state.images.length > 0 && !state.activeId) {
      await setActiveImage(state.images[state.images.length - 1].id);
    }
    if (state.images.length > 1) {
      setCanvasMode("multi");
      setTip("Multiple photos loaded. Click a photo to focus it.");
    }
    return restored;
  }

  return Object.freeze({
    sessionSnapshotPathForRunDir,
    legacySessionSnapshotPathForRunDir,
    sessionTimelinePathForRunDir,
    buildSessionTimelinePayloadFromSession,
    writeSessionTimelineForRunDir,
    persistSessionTimelineForSession,
    persistActiveSessionTimeline,
    loadSessionTimelineFromPath,
    restoreSessionFromTimelineRecord,
    saveActiveSessionSnapshot,
    loadSessionSnapshotFromPath,
    loadExistingArtifacts,
  });
}
