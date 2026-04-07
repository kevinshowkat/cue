import { test } from "node:test";
import assert from "node:assert/strict";

import { DESKTOP_EVENT_TYPES } from "../src/canvas_protocol.js";
import {
  createCanvasAppDesktopEventRouter,
  createDesktopEventDomainHandlers,
  createDesktopEventHandlerMap,
  createDesktopEventRouter,
} from "../src/app/event_router.js";

test("event router groups desktop event domains into a handler map", () => {
  const handlers = {
    onMotherEvent() {},
    onArtifactEvent() {},
    onIntentEvent() {},
    onDiagnosticsEvent() {},
    onRecreateEvent() {},
  };
  const map = createDesktopEventHandlerMap(DESKTOP_EVENT_TYPES, handlers);

  assert.equal(map.get(DESKTOP_EVENT_TYPES.MOTHER_PROMPT_COMPILED), handlers.onMotherEvent);
  assert.equal(map.get(DESKTOP_EVENT_TYPES.GENERATION_FAILED), handlers.onArtifactEvent);
  assert.equal(map.get(DESKTOP_EVENT_TYPES.INTENT_ICONS), handlers.onIntentEvent);
  assert.equal(map.get(DESKTOP_EVENT_TYPES.IMAGE_DESCRIPTION), handlers.onDiagnosticsEvent);
  assert.equal(map.get(DESKTOP_EVENT_TYPES.RECREATE_DONE), handlers.onRecreateEvent);
});

test("event router runs preflight hooks and legacy dispatch through the same route", async () => {
  const calls = [];
  const router = createDesktopEventRouter(DESKTOP_EVENT_TYPES, {
    beforeHandleEvent(event, eventType) {
      calls.push(`before:${eventType}`);
    },
    onMotherEvent(event) {
      calls.push(`mother:${event.type}`);
    },
  });

  await router.handleEventLegacy({ type: DESKTOP_EVENT_TYPES.VERSION_CREATED });

  assert.deepEqual(calls, [
    `before:${DESKTOP_EVENT_TYPES.VERSION_CREATED}`,
    `mother:${DESKTOP_EVENT_TYPES.VERSION_CREATED}`,
  ]);
});

test("event router builds shared domain handlers from a single deps object", () => {
  const deps = { traceId: "shared" };
  const factoryCalls = [];
  const handlers = createDesktopEventDomainHandlers(deps, {
    createMotherEventHandlerImpl(receivedDeps) {
      factoryCalls.push(["mother", receivedDeps]);
      return () => "mother";
    },
    createArtifactEventHandlerImpl(receivedDeps) {
      factoryCalls.push(["artifact", receivedDeps]);
      return () => "artifact";
    },
    createIntentEventHandlerImpl(receivedDeps) {
      factoryCalls.push(["intent", receivedDeps]);
      return () => "intent";
    },
    createDiagnosticsEventHandlerImpl(receivedDeps) {
      factoryCalls.push(["diagnostics", receivedDeps]);
      return () => "diagnostics";
    },
    createRecreateEventHandlerImpl(receivedDeps) {
      factoryCalls.push(["recreate", receivedDeps]);
      return () => "recreate";
    },
  });

  assert.deepEqual(factoryCalls, [
    ["mother", deps],
    ["artifact", deps],
    ["intent", deps],
    ["diagnostics", deps],
    ["recreate", deps],
  ]);
  assert.equal(handlers.onMotherEvent(), "mother");
  assert.equal(handlers.onArtifactEvent(), "artifact");
  assert.equal(handlers.onIntentEvent(), "intent");
  assert.equal(handlers.onDiagnosticsEvent(), "diagnostics");
  assert.equal(handlers.onRecreateEvent(), "recreate");
});

test("canvas app desktop event router composes extracted domain handler factories", async () => {
  const calls = [];
  const deps = { scope: "canvas_app" };
  const router = createCanvasAppDesktopEventRouter({
    types: DESKTOP_EVENT_TYPES,
    deps,
    beforeHandleEvent(_event, eventType) {
      calls.push(`before:${eventType}`);
    },
    createMotherEventHandlerImpl(receivedDeps) {
      assert.equal(receivedDeps, deps);
      return (event) => {
        calls.push(`mother:${event.type}`);
      };
    },
    createArtifactEventHandlerImpl(receivedDeps) {
      assert.equal(receivedDeps, deps);
      return (event) => {
        calls.push(`artifact:${event.type}`);
      };
    },
    createIntentEventHandlerImpl(receivedDeps) {
      assert.equal(receivedDeps, deps);
      return (event) => {
        calls.push(`intent:${event.type}`);
      };
    },
    createDiagnosticsEventHandlerImpl(receivedDeps) {
      assert.equal(receivedDeps, deps);
      return (event) => {
        calls.push(`diagnostics:${event.type}`);
      };
    },
    createRecreateEventHandlerImpl(receivedDeps) {
      assert.equal(receivedDeps, deps);
      return (event) => {
        calls.push(`recreate:${event.type}`);
      };
    },
  });

  await router.handleEvent({ type: DESKTOP_EVENT_TYPES.IMAGE_DESCRIPTION });
  await router.handleEvent({ type: DESKTOP_EVENT_TYPES.RECREATE_DONE });

  assert.deepEqual(calls, [
    `before:${DESKTOP_EVENT_TYPES.IMAGE_DESCRIPTION}`,
    `diagnostics:${DESKTOP_EVENT_TYPES.IMAGE_DESCRIPTION}`,
    `before:${DESKTOP_EVENT_TYPES.RECREATE_DONE}`,
    `recreate:${DESKTOP_EVENT_TYPES.RECREATE_DONE}`,
  ]);
});
