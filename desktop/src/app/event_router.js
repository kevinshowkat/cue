import { registerArtifactEventHandlers } from "./event_handlers/artifact_events.js";
import { registerDiagnosticsEventHandlers } from "./event_handlers/diagnostics_events.js";
import { registerIntentEventHandlers } from "./event_handlers/intent_events.js";
import { registerMotherEventHandlers } from "./event_handlers/mother_events.js";
import { registerRecreateEventHandlers } from "./event_handlers/recreate_events.js";

function resolveDomainHandler(handlers, primaryKey, fallbackKey) {
  const candidate = handlers?.[primaryKey] ?? handlers?.[fallbackKey] ?? null;
  return typeof candidate === "function" ? candidate : async () => {};
}

export function createDesktopEventHandlerMap(types, handlers = {}) {
  const map = new Map();
  registerMotherEventHandlers(
    map,
    types,
    resolveDomainHandler(handlers, "onMotherEvent", "onMother")
  );
  registerArtifactEventHandlers(
    map,
    types,
    resolveDomainHandler(handlers, "onArtifactEvent", "onArtifact")
  );
  registerIntentEventHandlers(
    map,
    types,
    resolveDomainHandler(handlers, "onIntentEvent", "onIntent")
  );
  registerDiagnosticsEventHandlers(
    map,
    types,
    resolveDomainHandler(handlers, "onDiagnosticsEvent", "onDiagnostics")
  );
  registerRecreateEventHandlers(
    map,
    types,
    resolveDomainHandler(handlers, "onRecreateEvent", "onRecreate")
  );
  return map;
}

export function createDesktopEventRouter(
  types,
  {
    beforeHandleEvent = null,
    onMotherEvent = null,
    onArtifactEvent = null,
    onIntentEvent = null,
    onDiagnosticsEvent = null,
    onRecreateEvent = null,
  } = {}
) {
  let desktopEventHandlerMap = null;

  function getDesktopEventHandlerMap() {
    if (desktopEventHandlerMap) return desktopEventHandlerMap;
    desktopEventHandlerMap = createDesktopEventHandlerMap(types, {
      onMotherEvent,
      onArtifactEvent,
      onIntentEvent,
      onDiagnosticsEvent,
      onRecreateEvent,
    });
    return desktopEventHandlerMap;
  }

  async function handleEvent(event) {
    if (!event || typeof event !== "object") return;
    let eventType = String(event.type || "");
    if (typeof beforeHandleEvent === "function") {
      const preflight = await beforeHandleEvent(event, eventType);
      if (preflight === false) return;
      if (preflight && typeof preflight === "object") {
        if (preflight.handled) return;
        if (preflight.eventType != null) {
          eventType = String(preflight.eventType || "");
        }
      }
    }
    const handler = getDesktopEventHandlerMap().get(eventType);
    if (!handler) return;
    await handler(event);
  }

  async function handleEventLegacy(event) {
    await handleEvent(event);
  }

  return {
    getDesktopEventHandlerMap,
    handleEvent,
    handleEventLegacy,
  };
}
