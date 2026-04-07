import { test } from "node:test";
import assert from "node:assert/strict";

import { createCanvasAppSessionPersistence } from "../src/app/session_persistence.js";

function createBasePersistence(overrides = {}) {
  const state = {
    runDir: "/runs/a",
    eventsPath: "/runs/a/events.jsonl",
    activeTabId: "tab-a",
    images: [],
    activeId: null,
    ...overrides.state,
  };
  const writes = [];
  const reads = new Map();
  const calls = [];
  const persistence = createCanvasAppSessionPersistence({
    state,
    async joinPath(runDir, leaf) {
      calls.push({ type: "joinPath", runDir, leaf });
      return `${runDir}/${leaf}`;
    },
    sessionSnapshotFilename: "session.json",
    legacySessionSnapshotFilename: "juggernaut-session.json",
    sessionTimelineFilename: "session-timeline.json",
    serializeSessionTimeline(payload) {
      calls.push({ type: "serializeSessionTimeline", payload });
      return payload;
    },
    deserializeSessionTimeline(payload) {
      calls.push({ type: "deserializeSessionTimeline", payload });
      return payload;
    },
    restoreSessionTimelineSnapshot(snapshot, options) {
      calls.push({ type: "restoreSessionTimelineSnapshot", snapshot, options });
      return {
        restored: true,
        runDir: options.runDir,
        eventsPath: options.eventsPath,
      };
    },
    serializeSessionSnapshot(payload) {
      calls.push({ type: "serializeSessionSnapshot", payload });
      return payload;
    },
    deserializeSessionSnapshot(payload) {
      calls.push({ type: "deserializeSessionSnapshot", payload });
      return payload;
    },
    async writeTextFile(path, content) {
      writes.push({ path, content });
    },
    async readTextFile(path) {
      if (!reads.has(path)) throw new Error(`missing read fixture: ${path}`);
      return reads.get(path);
    },
    async readDir() {
      return [];
    },
    captureActiveTabSession(session = null) {
      calls.push({ type: "captureActiveTabSession", session });
      return session;
    },
    createFreshTabSession(seed = {}) {
      calls.push({ type: "createFreshTabSession", seed });
      return { ...seed };
    },
    currentTabSwitchBlockReason() {
      return null;
    },
    currentTabSwitchBlockMessage(reason) {
      return String(reason || "");
    },
    showToast(message, level, durationMs) {
      calls.push({ type: "showToast", message, level, durationMs });
    },
    async ensureRun() {
      calls.push({ type: "ensureRun" });
    },
    tabbedSessions: {
      getTab(tabId) {
        calls.push({ type: "getTab", tabId });
        return {
          tabId,
          label: "Run A",
          session: {
            runDir: "/runs/a",
            timelineNodes: [{ nodeId: "node-1", seq: 1 }],
            timelineHeadNodeId: "node-1",
            timelineLatestNodeId: "node-1",
            timelineNextSeq: 2,
          },
        };
      },
    },
    syncSessionToolsFromRegistry() {
      calls.push({ type: "syncSessionToolsFromRegistry" });
    },
    syncActiveTabRecord(options) {
      calls.push({ type: "syncActiveTabRecord", options });
    },
    sessionTabDisplayLabel(record, fallback) {
      calls.push({ type: "sessionTabDisplayLabel", record, fallback });
      return record?.label || fallback;
    },
    defaultUntitledTabTitle: "Untitled Canvas",
    queueNativeSystemMenuSync() {
      calls.push({ type: "queueNativeSystemMenuSync" });
    },
    timelineSortedNodes(nodes = []) {
      calls.push({ type: "timelineSortedNodes", nodes });
      return nodes.slice().sort((left, right) => (Number(left?.seq) || 0) - (Number(right?.seq) || 0));
    },
    basename(path = "") {
      calls.push({ type: "basename", path });
      const parts = String(path || "").split("/");
      return parts[parts.length - 1] || path;
    },
    addImage(item, options) {
      calls.push({ type: "addImage", item, options });
      state.images.push(item);
    },
    extractReceiptMeta(payload) {
      calls.push({ type: "extractReceiptMeta", payload });
      return payload?.meta || null;
    },
    async setActiveImage(imageId) {
      calls.push({ type: "setActiveImage", imageId });
      state.activeId = imageId;
    },
    setCanvasMode(mode) {
      calls.push({ type: "setCanvasMode", mode });
    },
    setTip(message) {
      calls.push({ type: "setTip", message });
    },
    consoleObj: {
      warn(...args) {
        calls.push({ type: "console.warn", args });
      },
    },
    ...overrides,
  });
  return { persistence, state, calls, writes, reads };
}

test("session persistence resolves run-scoped snapshot and timeline paths with join fallback", async () => {
  const { persistence } = createBasePersistence({
    async joinPath(runDir, leaf) {
      if (leaf === "session-timeline.json") throw new Error("join failed");
      return `${runDir}/${leaf}`;
    },
  });

  assert.equal(await persistence.sessionSnapshotPathForRunDir("/runs/a"), "/runs/a/session.json");
  assert.equal(await persistence.legacySessionSnapshotPathForRunDir("/runs/a"), "/runs/a/juggernaut-session.json");
  assert.equal(await persistence.sessionTimelinePathForRunDir("/runs/a"), "/runs/a/session-timeline.json");
});

test("session persistence restores timeline-backed sessions with rebuilt node metadata", () => {
  const { persistence, calls } = createBasePersistence();

  const restored = persistence.restoreSessionFromTimelineRecord(
    {
      runDir: "/runs/a",
      latestNodeId: "node-2",
      nextSeq: 3,
      nodes: [
        { nodeId: "node-2", seq: 2, snapshot: { id: "snap-2" } },
        { nodeId: "node-1", seq: 1, snapshot: { id: "snap-1" } },
      ],
    },
    {
      runDir: "/runs/a",
      eventsPath: "/runs/a/events.jsonl",
    }
  );

  assert.deepEqual(restored, {
    restored: true,
    runDir: "/runs/a",
    eventsPath: "/runs/a/events.jsonl",
    timelineNodes: [
      { nodeId: "node-1", seq: 1, snapshot: { id: "snap-1" } },
      { nodeId: "node-2", seq: 2, snapshot: { id: "snap-2" } },
    ],
    timelineNodesById: new Map([
      ["node-1", { nodeId: "node-1", seq: 1, snapshot: { id: "snap-1" } }],
      ["node-2", { nodeId: "node-2", seq: 2, snapshot: { id: "snap-2" } }],
    ]),
    timelineHeadNodeId: "node-2",
    timelineLatestNodeId: "node-2",
    timelineNextSeq: 3,
    timelineOpen: true,
  });
  assert.equal(calls.some((entry) => entry.type === "timelineSortedNodes"), true);
  assert.deepEqual(calls.find((entry) => entry.type === "restoreSessionTimelineSnapshot"), {
    type: "restoreSessionTimelineSnapshot",
    snapshot: { id: "snap-2" },
    options: {
      runDir: "/runs/a",
      eventsPath: "/runs/a/events.jsonl",
    },
  });
});

test("session persistence saves canonical session and timeline files for the active tab", async () => {
  const { persistence, calls, writes } = createBasePersistence();

  const result = await persistence.saveActiveSessionSnapshot({ source: "menu" });

  assert.deepEqual(result, {
    ok: true,
    outPath: "/runs/a/session.json",
    timelineOutPath: "/runs/a/session-timeline.json",
  });
  assert.equal(calls.some((entry) => entry.type === "ensureRun"), true);
  assert.equal(calls.some((entry) => entry.type === "syncSessionToolsFromRegistry"), true);
  assert.deepEqual(calls.find((entry) => entry.type === "syncActiveTabRecord"), {
    type: "syncActiveTabRecord",
    options: { capture: true, publish: true },
  });
  assert.equal(writes.length, 2);
  assert.equal(writes[0].path, "/runs/a/session-timeline.json");
  assert.equal(writes[1].path, "/runs/a/session.json");
  assert.equal(writes[0].content.includes("\"runDir\": \"/runs/a\""), true);
  assert.equal(writes[1].content.includes("\"label\": \"Run A\""), true);
  assert.deepEqual(calls.find((entry) => entry.type === "showToast"), {
    type: "showToast",
    message: "Saved session to session.json.",
    level: "tip",
    durationMs: 2200,
  });
  assert.equal(calls.some((entry) => entry.type === "queueNativeSystemMenuSync"), true);
});

test("session persistence restores receipt artifacts into the active run state", async () => {
  const { persistence, state, calls, reads } = createBasePersistence({
    state: {
      runDir: "/runs/a",
      images: [],
      activeId: null,
    },
    async readDir() {
      return [
        { name: "receipt-a.json", path: "/runs/a/receipt-a.json" },
        { name: "ignore.txt", path: "/runs/a/ignore.txt" },
        { name: "receipt-b.json", path: "/runs/a/receipt-b.json" },
      ];
    },
  });
  reads.set(
    "/runs/a/receipt-a.json",
    JSON.stringify({
      artifacts: { image_path: "/runs/a/artifact-a.png" },
      meta: { kind: "a" },
    })
  );
  reads.set(
    "/runs/a/receipt-b.json",
    JSON.stringify({
      artifacts: { image_path: "/runs/a/artifact-b.png" },
      meta: { kind: "b" },
    })
  );

  const restored = await persistence.loadExistingArtifacts();

  assert.equal(restored, 2);
  assert.equal(state.images.length, 2);
  assert.equal(state.activeId, "b");
  assert.deepEqual(
    calls.filter((entry) => entry.type === "addImage").map((entry) => entry.item.id),
    ["a", "b"]
  );
  assert.deepEqual(calls.find((entry) => entry.type === "setActiveImage"), {
    type: "setActiveImage",
    imageId: "b",
  });
  assert.deepEqual(calls.find((entry) => entry.type === "setCanvasMode"), {
    type: "setCanvasMode",
    mode: "multi",
  });
  assert.deepEqual(calls.find((entry) => entry.type === "setTip"), {
    type: "setTip",
    message: "Multiple photos loaded. Click a photo to focus it.",
  });
});
