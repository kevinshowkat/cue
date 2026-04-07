import { test } from "node:test";
import assert from "node:assert/strict";

import { DESKTOP_EVENT_TYPES } from "../src/canvas_protocol.js";
import { createDesktopEventHandlerMap, createDesktopEventRouter } from "../src/app/event_router.js";

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
