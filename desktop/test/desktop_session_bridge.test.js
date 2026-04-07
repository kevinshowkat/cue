import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createCanvasAppDesktopSessionBridge,
  normalizeCanvasAppPtyStatus,
} from "../src/app/desktop_session_bridge.js";

function readFirstString(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

test("desktop session bridge normalizes typed status payloads into the canvas PTY shape", () => {
  const normalized = normalizeCanvasAppPtyStatus(
    {
      contract: "desktop-session.v1",
      runtime: {
        running: true,
        phase: "ready",
        pid: 1234,
      },
      session: {
        runDir: "/runs/a",
      },
      launch: {
        mode: "native",
        label: "Cue Desktop",
      },
    },
    {
      runDir: "/runs/a",
      eventsPath: null,
      readFirstString,
    }
  );

  assert.deepEqual(normalized, {
    contract: "desktop-session.v1",
    running: true,
    phase: "ready",
    run_dir: "/runs/a",
    events_path: "/runs/a/events.jsonl",
    launch_mode: "native",
    launch_label: "Cue Desktop",
    detail: null,
    pid: 1234,
  });
});

test("desktop session bridge reads typed PTY status, caches it, and activates the bridge for the active run", async () => {
  const state = {
    runDir: "/runs/a",
    eventsPath: "/runs/a/events.jsonl",
    desktopSessionBridgeActive: false,
  };
  let cache = {
    status: null,
    fetchedAt: 0,
  };
  let pendingPromise = null;
  let requestCount = 0;
  const bridge = createCanvasAppDesktopSessionBridge({
    state,
    getCachedStatus() {
      return cache;
    },
    setCachedStatus(nextCache) {
      cache = nextCache;
    },
    getPendingStatusPromise() {
      return pendingPromise;
    },
    setPendingStatusPromise(nextPromise) {
      pendingPromise = nextPromise;
    },
    cacheTtlMs: 1200,
    nowMs: () => 1000,
    readFirstString,
    async requestDesktopSessionStatus() {
      requestCount += 1;
      return {
        runtime: {
          running: true,
          phase: "ready",
          pid: 42,
        },
        session: {
          runDir: "/runs/a",
        },
        launch: {
          mode: "native",
          label: "Cue Desktop",
        },
      };
    },
    async requestLegacyPtyStatus() {
      throw new Error("legacy path should not run");
    },
  });

  const first = await bridge.readPtyStatus({ useCache: true });
  const second = await bridge.readPtyStatus({ useCache: true });

  assert.equal(requestCount, 1);
  assert.equal(state.desktopSessionBridgeActive, true);
  assert.deepEqual(first, second);
  assert.deepEqual(first, {
    contract: null,
    running: true,
    phase: "ready",
    run_dir: "/runs/a",
    events_path: "/runs/a/events.jsonl",
    launch_mode: "native",
    launch_label: "Cue Desktop",
    detail: null,
    pid: 42,
  });
  assert.deepEqual(cache, {
    status: first,
    fetchedAt: 1000,
  });
});

test("desktop session bridge falls back to the legacy PTY status command when the typed status command is unavailable", async () => {
  const state = {
    runDir: "/runs/a",
    eventsPath: "/runs/a/events.jsonl",
    desktopSessionBridgeActive: false,
  };
  let cache = {
    status: null,
    fetchedAt: 0,
  };
  let pendingPromise = null;
  const bridge = createCanvasAppDesktopSessionBridge({
    state,
    getCachedStatus() {
      return cache;
    },
    setCachedStatus(nextCache) {
      cache = nextCache;
    },
    getPendingStatusPromise() {
      return pendingPromise;
    },
    setPendingStatusPromise(nextPromise) {
      pendingPromise = nextPromise;
    },
    readFirstString,
    async requestDesktopSessionStatus() {
      throw new Error("unknown Tauri command: desktop_session_status");
    },
    async requestLegacyPtyStatus() {
      return {
        running: false,
        run_dir: "/runs/a",
        events_path: "/runs/a/events.jsonl",
        detail: "stopped",
      };
    },
  });

  const status = await bridge.readPtyStatus({ useCache: false });

  assert.deepEqual(status, {
    contract: null,
    running: false,
    phase: "stopped",
    run_dir: "/runs/a",
    events_path: "/runs/a/events.jsonl",
    launch_mode: null,
    launch_label: null,
    detail: "stopped",
    pid: null,
  });
});

test("desktop session bridge only applies live updates for the active polled run and forwards event payloads", async () => {
  const state = {
    runDir: "/runs/a",
    eventsPath: "/runs/a/events.jsonl",
    poller: {
      runDir: "/runs/a",
    },
  };
  const cached = [];
  const handled = [];
  const bridge = createCanvasAppDesktopSessionBridge({
    state,
    setCachedStatus(nextCache) {
      cached.push(nextCache);
    },
    readFirstString,
    handleEvent: async (event) => {
      handled.push(event);
    },
    unwrapDesktopSessionUpdate: (payload) => payload,
    desktopSessionUpdateKinds: {
      STATUS: "status",
      EVENT: "event",
    },
  });

  const statusResult = await bridge.handleDesktopSessionBridgeUpdate({
    payload: {
      kind: "status",
      runDir: "/runs/a",
      runtime: {
        running: true,
        phase: "ready",
        pid: 77,
      },
      launch: {
        mode: "native",
        label: "Cue Desktop",
      },
    },
  });
  const eventResult = await bridge.handleDesktopSessionBridgeUpdate({
    payload: {
      kind: "event",
      runDir: "/runs/a",
      event: {
        type: "artifact_created",
        id: "evt-1",
      },
    },
  });
  const ignoredResult = await bridge.handleDesktopSessionBridgeUpdate({
    payload: {
      kind: "status",
      runDir: "/runs/b",
      runtime: {
        running: true,
        phase: "ready",
      },
    },
  });

  assert.deepEqual(statusResult, {
    kind: "status",
    update: {
      kind: "status",
      runDir: "/runs/a",
      runtime: {
        running: true,
        phase: "ready",
        pid: 77,
      },
      launch: {
        mode: "native",
        label: "Cue Desktop",
      },
    },
    status: {
      contract: null,
      running: true,
      phase: "ready",
      run_dir: "/runs/a",
      events_path: "/runs/a/events.jsonl",
      launch_mode: "native",
      launch_label: "Cue Desktop",
      detail: null,
      pid: 77,
    },
  });
  assert.deepEqual(eventResult, {
    kind: "event",
    update: {
      kind: "event",
      runDir: "/runs/a",
      event: {
        type: "artifact_created",
        id: "evt-1",
      },
    },
    status: null,
  });
  assert.equal(ignoredResult, null);
  assert.equal(cached.length, 1);
  assert.deepEqual(cached[0].status, {
    contract: null,
    running: true,
    phase: "ready",
    run_dir: "/runs/a",
    events_path: "/runs/a/events.jsonl",
    launch_mode: "native",
    launch_label: "Cue Desktop",
    detail: null,
    pid: 77,
  });
  assert.deepEqual(handled, [{ type: "artifact_created", id: "evt-1" }]);
});

test("desktop session bridge returns stopped live status with normalized detail", async () => {
  const state = {
    runDir: "/runs/a",
    eventsPath: "/runs/a/events.jsonl",
    poller: {
      runDir: "/runs/a",
    },
  };
  const cached = [];
  const bridge = createCanvasAppDesktopSessionBridge({
    state,
    setCachedStatus(nextCache) {
      cached.push(nextCache);
    },
    readFirstString,
    unwrapDesktopSessionUpdate: (payload) => payload,
    desktopSessionUpdateKinds: {
      STATUS: "status",
      EVENT: "event",
    },
  });

  const result = await bridge.handleDesktopSessionBridgeUpdate({
    payload: {
      kind: "status",
      runDir: "/runs/a",
      runtime: {
        running: false,
        phase: "stopped",
      },
      detail: "daemon stopped",
      launch: {
        mode: "native",
        label: "Cue Desktop",
      },
    },
  });

  assert.deepEqual(result, {
    kind: "status",
    update: {
      kind: "status",
      runDir: "/runs/a",
      runtime: {
        running: false,
        phase: "stopped",
      },
      detail: "daemon stopped",
      launch: {
        mode: "native",
        label: "Cue Desktop",
      },
    },
    status: {
      contract: null,
      running: false,
      phase: "stopped",
      run_dir: "/runs/a",
      events_path: "/runs/a/events.jsonl",
      launch_mode: "native",
      launch_label: "Cue Desktop",
      detail: "daemon stopped",
      pid: null,
    },
  });
  assert.equal(state.desktopSessionBridgeActive, true);
  assert.equal(cached[0].status?.running, false);
  assert.equal(cached[0].status?.detail, "daemon stopped");
});
