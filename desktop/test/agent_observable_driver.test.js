import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AGENT_OBSERVABLE_ACTION_EVENT,
  AGENT_OBSERVABLE_DRIVER_KEY,
  AGENT_OBSERVABLE_ERROR_EVENT,
  AGENT_OBSERVABLE_RESULT_EVENT,
  createAgentObservableDriver,
  installAgentObservableDriverBridge,
} from "../src/agent_observable_driver.js";
import {
  AGENT_OBSERVABLE_TRACE_FILENAME,
  AGENT_OBSERVABLE_TRACE_SCHEMA,
  createAgentTraceLog,
} from "../src/agent_trace_log.js";

function createFakeWindow() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) {
      const list = listeners.get(type) || [];
      list.push(handler);
      listeners.set(type, list);
    },
    removeEventListener(type, handler) {
      const list = listeners.get(type) || [];
      listeners.set(
        type,
        list.filter((item) => item !== handler)
      );
    },
    dispatchEvent(event) {
      const list = listeners.get(event?.type) || [];
      for (const handler of list) {
        handler(event);
      }
      return true;
    },
  };
}

class TestCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

test("agent trace log persists schema-stamped observable traces into the run directory", async () => {
  const writes = [];
  const traceLog = createAgentTraceLog({
    appendJsonl: async (path, payload, options = {}) => {
      writes.push({ path, payload, options });
    },
    resolveRunDir: () => "/tmp/juggernaut-run",
    nowMs: () => 1_700_000_000_123,
  });

  const result = await traceLog.append({
    request_id: "req-1",
    action: {
      action: "marker_stroke",
      tool: "marker",
    },
    result: {
      ok: true,
      mark_id: "mark-1",
    },
  });

  assert.equal(result.persisted, true);
  assert.equal(result.path, `/tmp/juggernaut-run/${AGENT_OBSERVABLE_TRACE_FILENAME}`);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].payload.schema, AGENT_OBSERVABLE_TRACE_SCHEMA);
  assert.equal(writes[0].payload.seq, 1);
  assert.equal(writes[0].payload.request_id, "req-1");
  assert.deepEqual(writes[0].payload.result, {
    ok: true,
    mark_id: "mark-1",
  });
});

test("observable driver normalizes marker stroke calls and emits replayable traces", async () => {
  const writes = [];
  const phases = [];
  const requests = [];
  const traceLog = createAgentTraceLog({
    appendJsonl: async (path, payload) => {
      writes.push({ path, payload });
    },
    resolveRunDir: () => "/tmp/observable-driver",
    nowMs: () => 1_700_000_010_000,
  });
  const driver = createAgentObservableDriver({
    performMarkerStroke: async (request = {}) => {
      requests.push(request);
      return {
        ok: true,
        mark_id: "mark-42",
        image_id: request.image_id,
        point_count: Array.isArray(request.points) ? request.points.length : 0,
      };
    },
    getContextSnapshot: ({ phase, request }) => {
      phases.push({ phase, request });
      return {
        phase,
        tool: request?.tool || null,
      };
    },
    traceLog,
    nowMs: () => 1_700_000_010_000,
  });

  const result = await driver.markerStroke({
    request_id: "req-marker",
    source: "test_suite",
    image_id: "img-hero",
    points: [
      { x: 10, y: 12 },
      { x: 16, y: 24 },
      { x: 28, y: 36 },
    ],
    step_delay_ms: 18,
    meta: {
      suite: "observable",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.error, null);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].tool, "marker");
  assert.equal(requests[0].coordinate_space, "canvas_css");
  assert.equal(requests[0].step_delay_ms, 18);
  assert.deepEqual(requests[0].points, [
    { x: 10, y: 12 },
    { x: 16, y: 24 },
    { x: 28, y: 36 },
  ]);
  assert.deepEqual(phases.map((entry) => entry.phase), ["before", "after"]);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, `/tmp/observable-driver/${AGENT_OBSERVABLE_TRACE_FILENAME}`);
  assert.equal(result.trace.schema, AGENT_OBSERVABLE_TRACE_SCHEMA);
  assert.equal(result.trace.request_id, "req-marker");
  assert.equal(result.trace.action.action, "marker_stroke");
  assert.equal(result.trace.replay.method, "markerStroke");
  assert.deepEqual(result.trace.replay.request.points, requests[0].points);
  assert.deepEqual(result.result, {
    ok: true,
    mark_id: "mark-42",
    image_id: "img-hero",
    point_count: 3,
  });
});

test("observable driver can replay a persisted trace entry through the same handler path", async () => {
  let markerCalls = 0;
  const driver = createAgentObservableDriver({
    performMarkerStroke: async () => {
      markerCalls += 1;
      return {
        ok: true,
        mark_id: `mark-${markerCalls}`,
      };
    },
    nowMs: () => 1_700_000_020_000,
  });

  const first = await driver.markerStroke({
    request_id: "req-replay",
    points: [
      { x: 5, y: 8 },
      { x: 9, y: 12 },
    ],
  });
  const replayed = await driver.replayTraceEntry(first.trace);

  assert.equal(first.ok, true);
  assert.equal(replayed.ok, true);
  assert.equal(markerCalls, 2);
  assert.equal(replayed.trace.action.request_id, "req-replay");
  assert.equal(replayed.trace.replay.method, "markerStroke");
});

test("observable driver supports protect and make-space actions as first-class observable calls", async () => {
  const requests = [];
  const driver = createAgentObservableDriver({
    performProtectStroke: async (request = {}) => {
      requests.push(request);
      return {
        ok: true,
        tool: request.tool,
        point_count: Array.isArray(request.points) ? request.points.length : 0,
      };
    },
    performMakeSpaceClick: async (request = {}) => {
      requests.push(request);
      return {
        ok: true,
        tool: request.tool,
        image_id: request.image_id,
      };
    },
    nowMs: () => 1_700_000_025_000,
  });

  const protect = await driver.protectStroke({
    request_id: "req-protect",
    points: [
      { x: 18, y: 22 },
      { x: 28, y: 36 },
    ],
  });
  const makeSpace = await driver.run({
    action: "make_space",
    request_id: "req-space",
    image_id: "img-hero",
    point: { x: 64, y: 72 },
  });

  assert.equal(protect.ok, true);
  assert.equal(protect.trace.action.tool, "protect");
  assert.equal(protect.trace.replay.method, "protectStroke");
  assert.equal(makeSpace.ok, true);
  assert.equal(makeSpace.trace.action.tool, "make_space");
  assert.equal(makeSpace.trace.replay.method, "makeSpaceClick");
  assert.deepEqual(
    requests.map((request) => request.tool),
    ["protect", "make_space"]
  );
});

test("observable driver bridge exposes stable window APIs and result events", async () => {
  const windowObj = createFakeWindow();
  const resultEvents = [];
  const errorEvents = [];
  let magicSelectCalls = 0;
  const driver = createAgentObservableDriver({
    performMagicSelectClick: async (request = {}) => {
      magicSelectCalls += 1;
      return {
        ok: true,
        tool: request.tool,
        image_id: request.image_id,
      };
    },
    nowMs: () => 1_700_000_030_000,
  });

  windowObj.addEventListener(AGENT_OBSERVABLE_RESULT_EVENT, (event) => {
    resultEvents.push(event.detail);
  });
  windowObj.addEventListener(AGENT_OBSERVABLE_ERROR_EVENT, (event) => {
    errorEvents.push(event.detail);
  });

  installAgentObservableDriverBridge({
    windowObj,
    CustomEventCtor: TestCustomEvent,
    driver,
  });

  assert.equal(typeof windowObj[AGENT_OBSERVABLE_DRIVER_KEY]?.magicSelectClick, "function");
  assert.equal(typeof windowObj[AGENT_OBSERVABLE_DRIVER_KEY]?.protectStroke, "function");
  assert.equal(typeof windowObj[AGENT_OBSERVABLE_DRIVER_KEY]?.makeSpaceClick, "function");

  windowObj.dispatchEvent(
    new TestCustomEvent(AGENT_OBSERVABLE_ACTION_EVENT, {
      detail: {
        action: "magic_select_click",
        image_id: "img-focus",
        point: { x: 44, y: 55 },
      },
    })
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(magicSelectCalls, 1);
  assert.equal(resultEvents.length, 1);
  assert.equal(errorEvents.length, 0);
  assert.equal(resultEvents[0].ok, true);
  assert.equal(resultEvents[0].trace.action.tool, "magic_select");
});
