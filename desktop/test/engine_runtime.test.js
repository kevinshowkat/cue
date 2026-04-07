import { test } from "node:test";
import assert from "node:assert/strict";

import {
  adaptCanvasAppDesktopSessionStatusResponse,
  createCanvasAppEngineRuntime,
} from "../src/app/engine_runtime.js";

test("engine runtime adapts typed desktop session responses into the legacy PTY status shape", () => {
  const adapted = adaptCanvasAppDesktopSessionStatusResponse(
    {
      runtime: {
        running: true,
        phase: "ready",
        pid: 77,
      },
      session: {
        runDir: "/runs/a",
      },
      launch: {
        mode: "native",
        label: "Cue Desktop",
      },
    },
    "/runs/fallback"
  );

  assert.deepEqual(adapted, {
    running: true,
    has_child: true,
    has_writer: true,
    pid: 77,
    automation_frontend_ready: false,
    run_dir: "/runs/a",
    events_path: "/runs/a/events.jsonl",
    launch_mode: "native",
    launch_label: "Cue Desktop",
    last_exit_detail: null,
    last_error: null,
  });
});

test("engine runtime reuses an active PTY binding before attempting a new spawn", async () => {
  const state = {
    runDir: "/runs/a",
    eventsPath: "/runs/a/events.jsonl",
    ptySpawning: false,
    ptySpawned: false,
  };
  const calls = [];
  const runtime = createCanvasAppEngineRuntime({
    state,
    settings: {
      memory: true,
      textModel: "text-model",
      imageModel: "image-model",
    },
    PTY_COMMANDS: {
      TEXT_MODEL: "text_model",
      IMAGE_MODEL: "image_model",
      USE: "use",
    },
    tauriInvoke: Symbol("tauri"),
    buildDesktopSessionStartRequest(payload) {
      calls.push({ type: "buildDesktopSessionStartRequest", payload });
      return payload;
    },
    async startDesktopSession() {
      calls.push({ type: "startDesktopSession" });
      throw new Error("spawn path should stay idle");
    },
    cachePtyStatus(status) {
      calls.push({ type: "cachePtyStatus", status });
    },
    invalidatePtyStatusCache() {
      calls.push({ type: "invalidatePtyStatusCache" });
    },
    async readPtyStatus({ useCache }) {
      calls.push({ type: "readPtyStatus", useCache });
      return {
        running: true,
        run_dir: "/runs/a",
        events_path: "/runs/a/events.jsonl",
      };
    },
    ptyStatusMatchesActiveRun(status) {
      calls.push({ type: "ptyStatusMatchesActiveRun", status });
      return true;
    },
    async writeCanvasRuntimePty(data) {
      calls.push({ type: "writeCanvasRuntimePty", data });
    },
    getActiveImage() {
      calls.push({ type: "getActiveImage" });
      return null;
    },
    setStatus(message, isError) {
      calls.push({ type: "setStatus", message, isError });
    },
    startEventsPolling() {
      calls.push({ type: "startEventsPolling" });
    },
    showToast(message, level, durationMs) {
      calls.push({ type: "showToast", message, level, durationMs });
    },
    getFlushDeferredEnginePtyExit() {
      calls.push({ type: "getFlushDeferredEnginePtyExit" });
      return async () => {
        calls.push({ type: "flushDeferredEnginePtyExit" });
      };
    },
    processActionQueue() {
      calls.push({ type: "processActionQueue" });
      return Promise.resolve();
    },
    consoleObj: {
      info(...args) {
        calls.push({ type: "console.info", args });
      },
      error(...args) {
        calls.push({ type: "console.error", args });
      },
    },
  });

  const ok = await runtime.ensureEngineSpawned({ reason: "tab_activate", showToastOnFailure: true });

  assert.equal(ok, true);
  assert.equal(state.ptySpawned, true);
  assert.deepEqual(calls, [
    { type: "readPtyStatus", useCache: true },
    {
      type: "ptyStatusMatchesActiveRun",
      status: {
        running: true,
        run_dir: "/runs/a",
        events_path: "/runs/a/events.jsonl",
      },
    },
    { type: "startEventsPolling" },
    { type: "setStatus", message: "Engine: connected", isError: undefined },
  ]);
});

test("engine runtime starts the typed desktop session, seeds PTY commands, and drains deferred cleanup", async () => {
  const state = {
    runDir: "/runs/a",
    eventsPath: "/runs/a/events.jsonl",
    ptySpawning: false,
    ptySpawned: false,
    desktopSessionBridgeActive: true,
    engineLaunchMode: "native",
    engineLaunchPath: null,
  };
  const writes = [];
  const statuses = [];
  const cached = [];
  const calls = [];
  const tauriInvoke = Symbol("tauri");
  const runtime = createCanvasAppEngineRuntime({
    state,
    settings: {
      memory: false,
      textModel: "cue-text",
      imageModel: "cue-image",
    },
    PTY_COMMANDS: {
      TEXT_MODEL: "text_model",
      IMAGE_MODEL: "image_model",
      USE: "use",
    },
    tauriInvoke,
    buildDesktopSessionStartRequest(payload) {
      calls.push({ type: "buildDesktopSessionStartRequest", payload });
      return { request: payload };
    },
    async startDesktopSession(invokeFn, request) {
      calls.push({ type: "startDesktopSession", invokeFn, request });
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
    cachePtyStatus(status) {
      cached.push(status);
    },
    invalidatePtyStatusCache() {
      calls.push({ type: "invalidatePtyStatusCache" });
    },
    async readPtyStatus() {
      throw new Error("readPtyStatus should not run during spawn");
    },
    ptyStatusMatchesActiveRun() {
      throw new Error("ptyStatusMatchesActiveRun should not run during spawn");
    },
    async writeCanvasRuntimePty(data) {
      writes.push(data);
    },
    getActiveImage() {
      return { path: "/images/a.png" };
    },
    setStatus(message, isError) {
      statuses.push({ message, isError });
    },
    startEventsPolling() {
      calls.push({ type: "startEventsPolling" });
    },
    showToast(message, level, durationMs) {
      calls.push({ type: "showToast", message, level, durationMs });
    },
    getFlushDeferredEnginePtyExit() {
      return async () => {
        calls.push({ type: "flushDeferredEnginePtyExit" });
      };
    },
    processActionQueue() {
      calls.push({ type: "processActionQueue" });
      return Promise.resolve();
    },
    consoleObj: {
      info(...args) {
        calls.push({ type: "console.info", args });
      },
      error(...args) {
        calls.push({ type: "console.error", args });
      },
    },
  });

  await runtime.spawnEngine();

  assert.equal(state.ptySpawning, false);
  assert.equal(state.ptySpawned, true);
  assert.equal(state.desktopSessionBridgeActive, false);
  assert.equal(state.engineLaunchMode, "native");
  assert.equal(state.engineLaunchPath, "Cue Desktop");
  assert.deepEqual(statuses, [
    { message: "Engine: starting…", isError: undefined },
    { message: "Engine: started (native)", isError: undefined },
  ]);
  assert.deepEqual(cached, [
    {
      running: true,
      has_child: true,
      has_writer: true,
      pid: 42,
      automation_frontend_ready: false,
      run_dir: "/runs/a",
      events_path: "/runs/a/events.jsonl",
      launch_mode: "native",
      launch_label: "Cue Desktop",
      last_exit_detail: null,
      last_error: null,
    },
  ]);
  assert.deepEqual(writes, [
    "text_model cue-text\n",
    "image_model cue-image\n",
    "use /images/a.png\n",
  ]);
  assert.deepEqual(calls, [
    {
      type: "buildDesktopSessionStartRequest",
      payload: {
        runDir: "/runs/a",
        memoryEnabled: false,
      },
    },
    {
      type: "startDesktopSession",
      invokeFn: tauriInvoke,
      request: {
        request: {
          runDir: "/runs/a",
          memoryEnabled: false,
        },
      },
    },
    {
      type: "console.info",
      args: ["[brood] engine launch mode=native path=Cue Desktop preferred=native"],
    },
    { type: "flushDeferredEnginePtyExit" },
    { type: "processActionQueue" },
  ]);
});

test("engine runtime invalidates cached status and still drains deferred cleanup when startup fails", async () => {
  const state = {
    runDir: "/runs/a",
    eventsPath: "/runs/a/events.jsonl",
    ptySpawning: false,
    ptySpawned: true,
    desktopSessionBridgeActive: true,
  };
  const calls = [];
  const statuses = [];
  const runtime = createCanvasAppEngineRuntime({
    state,
    settings: {
      memory: true,
      textModel: "cue-text",
      imageModel: "cue-image",
    },
    PTY_COMMANDS: {
      TEXT_MODEL: "text_model",
      IMAGE_MODEL: "image_model",
      USE: "use",
    },
    tauriInvoke: Symbol("tauri"),
    buildDesktopSessionStartRequest(payload) {
      calls.push({ type: "buildDesktopSessionStartRequest", payload });
      return payload;
    },
    async startDesktopSession() {
      throw new Error("runtime offline");
    },
    cachePtyStatus(status) {
      calls.push({ type: "cachePtyStatus", status });
    },
    invalidatePtyStatusCache() {
      calls.push({ type: "invalidatePtyStatusCache" });
    },
    async readPtyStatus() {
      throw new Error("readPtyStatus should not run during spawn");
    },
    ptyStatusMatchesActiveRun() {
      throw new Error("ptyStatusMatchesActiveRun should not run during spawn");
    },
    async writeCanvasRuntimePty(data) {
      calls.push({ type: "writeCanvasRuntimePty", data });
    },
    getActiveImage() {
      return null;
    },
    setStatus(message, isError) {
      statuses.push({ message, isError });
    },
    startEventsPolling() {
      calls.push({ type: "startEventsPolling" });
    },
    showToast(message, level, durationMs) {
      calls.push({ type: "showToast", message, level, durationMs });
    },
    getFlushDeferredEnginePtyExit() {
      return async () => {
        calls.push({ type: "flushDeferredEnginePtyExit" });
      };
    },
    processActionQueue() {
      calls.push({ type: "processActionQueue" });
      return Promise.resolve();
    },
    consoleObj: {
      info(...args) {
        calls.push({ type: "console.info", args });
      },
      error(...args) {
        calls.push({ type: "console.error", args });
      },
    },
  });

  await runtime.spawnEngine();

  assert.equal(state.ptySpawning, false);
  assert.equal(state.ptySpawned, false);
  assert.equal(state.desktopSessionBridgeActive, false);
  assert.deepEqual(statuses, [
    { message: "Engine: starting…", isError: undefined },
    { message: "Engine: failed (runtime offline)", isError: true },
  ]);
  assert.deepEqual(calls[0], {
    type: "buildDesktopSessionStartRequest",
    payload: {
      runDir: "/runs/a",
      memoryEnabled: true,
    },
  });
  assert.equal(calls[1]?.type, "console.error");
  assert.equal(calls[1]?.args?.[0] instanceof Error, true);
  assert.equal(calls[1]?.args?.[0]?.message, "runtime offline");
  assert.deepEqual(calls.slice(2), [
    { type: "invalidatePtyStatusCache" },
    { type: "flushDeferredEnginePtyExit" },
    { type: "processActionQueue" },
  ]);
});
