import { registerArtifactEventHandlers } from "./artifact_events.js";
import { registerDiagnosticsEventHandlers } from "./diagnostics_events.js";
import { registerIntentEventHandlers } from "./intent_events.js";
import { registerRecreateEventHandlers } from "./recreate_events.js";

export function createDesktopEventHandlerMap(types, handlers) {
  const map = new Map();
  registerArtifactEventHandlers(map, types, handlers);
  registerIntentEventHandlers(map, types, handlers);
  registerDiagnosticsEventHandlers(map, types, handlers);
  registerRecreateEventHandlers(map, types, handlers);
  return map;
}
