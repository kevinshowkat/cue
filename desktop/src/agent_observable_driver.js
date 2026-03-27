import { buildAgentObservableTraceEntry } from "./agent_trace_log.js";

export const AGENT_OBSERVABLE_DRIVER_KEY = "__JUGGERNAUT_AGENT_OBSERVABLE__";
export const AGENT_OBSERVABLE_ACTION_EVENT = "juggernaut:agent-observable-action";
export const AGENT_OBSERVABLE_RESULT_EVENT = "juggernaut:agent-observable-result";
export const AGENT_OBSERVABLE_ERROR_EVENT = "juggernaut:agent-observable-error";

const AGENT_OBSERVABLE_BRIDGE_HANDLER_KEY = "__juggernautAgentObservableHandler";

const OBSERVABLE_ACTIONS = Object.freeze({
  marker_stroke: Object.freeze({
    method: "markerStroke",
    tool: "marker",
    minPoints: 2,
  }),
  protect_stroke: Object.freeze({
    method: "protectStroke",
    tool: "highlight",
    minPoints: 2,
  }),
  magic_select_click: Object.freeze({
    method: "magicSelectClick",
    tool: "magic_select",
    minPoints: 1,
  }),
  stamp_click: Object.freeze({
    method: "stampClick",
    tool: "stamp",
    minPoints: 1,
  }),
  make_space_click: Object.freeze({
    method: "makeSpaceClick",
    tool: "make_space",
    minPoints: 1,
  }),
  eraser_stroke: Object.freeze({
    method: "eraserStroke",
    tool: "eraser",
    minPoints: 1,
  }),
});

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function readFirstString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function readFirstNumber(...values) {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.NaN;
}

function normalizeObservableActionName(value = "") {
  const key = readFirstString(value).toLowerCase();
  if (!key) return "";
  if (OBSERVABLE_ACTIONS[key]) return key;
  if (key === "marker") return "marker_stroke";
  if (key === "highlight") return "protect_stroke";
  if (key === "protect") return "protect_stroke";
  if (key === "magic_select" || key === "magicselect" || key === "magic-select") return "magic_select_click";
  if (key === "stamp") return "stamp_click";
  if (key === "stamp_click" || key === "stampclick" || key === "stamp-click") return "stamp_click";
  if (key === "make_space" || key === "makespace" || key === "make-space") return "make_space_click";
  if (key === "eraser") return "eraser_stroke";
  return "";
}

function normalizePoint(point = null, label = "point") {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} requires finite x and y values`);
  }
  return {
    x,
    y,
  };
}

function normalizePointList(points = [], { minPoints = 1, label = "points" } = {}) {
  const out = [];
  for (const point of Array.isArray(points) ? points : []) {
    out.push(normalizePoint(point, label));
  }
  if (out.length < minPoints) {
    throw new Error(`${label} requires at least ${minPoints} point${minPoints === 1 ? "" : "s"}`);
  }
  return out;
}

function normalizeStepDelayMs(value) {
  const parsed = readFirstNumber(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(5000, Math.round(parsed)));
}

function defaultNormalizeError(error) {
  const text = String(error?.message || error || "Observable driver action failed")
    .replace(/\s+/g, " ")
    .trim();
  return text || "Observable driver action failed";
}

function makeTracePayload(traceLog, entry, { nowMs = () => Date.now() } = {}, fallbackSeqRef) {
  if (traceLog && typeof traceLog.build === "function") {
    return traceLog.build(entry);
  }
  fallbackSeqRef.value += 1;
  return buildAgentObservableTraceEntry(entry, {
    seq: fallbackSeqRef.value,
    nowMs,
  });
}

export function normalizeAgentObservableRequest(actionName, input = {}) {
  const normalizedActionName = normalizeObservableActionName(actionName);
  if (!normalizedActionName) {
    throw new Error("Unsupported observable action");
  }
  const config = OBSERVABLE_ACTIONS[normalizedActionName];
  const pointAction =
    normalizedActionName === "magic_select_click" ||
    normalizedActionName === "stamp_click" ||
    normalizedActionName === "make_space_click";
  const raw = asRecord(input) || {};
  const coordinateSpace = readFirstString(raw.coordinate_space, raw.coordinateSpace, "canvas_css").toLowerCase();
  if (coordinateSpace !== "canvas_css") {
    throw new Error(`Unsupported coordinate_space=${coordinateSpace}; use canvas_css`);
  }
  const point =
    pointAction
      ? normalizePoint(raw.point ?? raw.point_css ?? raw.pointCss ?? raw.points?.[0], "point")
      : null;
  const points =
    pointAction
      ? [point]
      : normalizePointList(raw.points ?? raw.points_css ?? raw.pointsCss, {
          minPoints: config.minPoints,
          label: "points",
        });
  return {
    action: normalizedActionName,
    method: config.method,
    tool: config.tool,
    request_id: readFirstString(raw.request_id, raw.requestId, raw.id) || null,
    source: readFirstString(raw.source) || "agent_observable_driver",
    coordinate_space: coordinateSpace,
    image_id: readFirstString(raw.image_id, raw.imageId) || null,
    point: cloneJson(point || points[0]),
    points: cloneJson(points),
    intent_id: readFirstString(raw.intent_id, raw.intentId, raw.stamp_intent, raw.stampIntent, raw.stampIntentId) || null,
    custom_text: readFirstString(raw.custom_text, raw.customText, raw.label, raw.text) || null,
    step_delay_ms: normalizeStepDelayMs(raw.step_delay_ms ?? raw.stepDelayMs),
    meta: cloneJson(asRecord(raw.meta) || asRecord(raw.metadata) || null),
  };
}

export function createAgentObservableDriver(
  {
    performMarkerStroke = null,
    performProtectStroke = null,
    performMagicSelectClick = null,
    performStampClick = null,
    performMakeSpaceClick = null,
    performEraserStroke = null,
    getContextSnapshot = null,
    traceLog = null,
    nowMs = () => Date.now(),
    normalizeErrorMessage = defaultNormalizeError,
  } = {}
) {
  const fallbackTraceSeq = { value: 0 };
  const handlers = {
    marker_stroke: performMarkerStroke,
    protect_stroke: performProtectStroke,
    magic_select_click: performMagicSelectClick,
    stamp_click: performStampClick,
    make_space_click: performMakeSpaceClick,
    eraser_stroke: performEraserStroke,
  };

  async function captureContext(phase, request, outcome = {}) {
    if (typeof getContextSnapshot !== "function") return null;
    const snapshot = await getContextSnapshot({
      phase,
      request: cloneJson(request),
      result: cloneJson(outcome.result),
      error: outcome.error || null,
    });
    return cloneJson(snapshot);
  }

  async function executeAction(actionName, input = {}) {
    let request = null;
    let result = null;
    let error = null;
    let ok = false;
    const startedAt = Math.max(0, Number(nowMs()) || Date.now());

    try {
      request = normalizeAgentObservableRequest(actionName, input);
      const handler = handlers[request.action];
      if (typeof handler !== "function") {
        throw new Error(`Observable handler missing for ${request.action}`);
      }
      const contextBefore = await captureContext("before", request);
      try {
        const rawResult = await handler(cloneJson(request));
        result = cloneJson(asRecord(rawResult) || { ok: rawResult !== false, value: rawResult });
        ok = result?.ok !== false;
      } catch (err) {
        error = normalizeErrorMessage(err);
        result = { ok: false, error };
        ok = false;
      }
      const contextAfter = await captureContext("after", request, { result, error });
      let traceEntry = {
        source: request.source,
        request_id: request.request_id,
        ok,
        error,
        duration_ms: Math.max(0, (Number(nowMs()) || Date.now()) - startedAt),
        action: cloneJson(request),
        replay: {
          kind: "driver_call",
          method: request.method,
          request: cloneJson(request),
        },
        result: cloneJson(result),
        context_before: contextBefore,
        context_after: contextAfter,
      };
      let tracePayload = null;
      let tracePath = null;
      let tracePersisted = false;
      if (traceLog && typeof traceLog.append === "function") {
        try {
          const persisted = await traceLog.append(traceEntry);
          tracePayload = persisted?.payload || null;
          tracePath = persisted?.path || null;
          tracePersisted = Boolean(persisted?.persisted);
        } catch (traceError) {
          tracePersisted = false;
          tracePath = null;
          if (ok) {
            ok = false;
            error = normalizeErrorMessage(traceError);
            result = {
              ...(asRecord(result) || {}),
              ok: false,
              error,
            };
            traceEntry = {
              ...traceEntry,
              ok: false,
              error,
              result: cloneJson(result),
            };
          }
        }
      }
      if (!tracePayload) {
        tracePayload = makeTracePayload(traceLog, traceEntry, { nowMs }, fallbackTraceSeq);
      }
      return {
        ok,
        error,
        action: cloneJson(request),
        result: cloneJson(result),
        trace: tracePayload,
        trace_path: tracePath,
        trace_persisted: tracePersisted,
      };
    } catch (err) {
      const normalizedError = normalizeErrorMessage(err);
      const traceEntry = {
        source: readFirstString(input?.source, "agent_observable_driver") || "agent_observable_driver",
        request_id: readFirstString(input?.request_id, input?.requestId, input?.id) || null,
        ok: false,
        error: normalizedError,
        duration_ms: Math.max(0, (Number(nowMs()) || Date.now()) - startedAt),
        action: request ? cloneJson(request) : cloneJson(asRecord(input) || {}),
        replay: request
          ? {
              kind: "driver_call",
              method: request.method,
              request: cloneJson(request),
            }
          : null,
        result: {
          ok: false,
          error: normalizedError,
        },
        context_before: request ? await captureContext("before", request) : null,
        context_after: request ? await captureContext("after", request, { result: null, error: normalizedError }) : null,
      };
      let tracePayload = null;
      let tracePath = null;
      let tracePersisted = false;
      if (traceLog && typeof traceLog.append === "function") {
        try {
          const persisted = await traceLog.append(traceEntry);
          tracePayload = persisted?.payload || null;
          tracePath = persisted?.path || null;
          tracePersisted = Boolean(persisted?.persisted);
        } catch {
          tracePath = null;
          tracePersisted = false;
        }
      }
      if (!tracePayload) {
        tracePayload = makeTracePayload(traceLog, traceEntry, { nowMs }, fallbackTraceSeq);
      }
      return {
        ok: false,
        error: normalizedError,
        action: request ? cloneJson(request) : null,
        result: {
          ok: false,
          error: normalizedError,
        },
        trace: tracePayload,
        trace_path: tracePath,
        trace_persisted: tracePersisted,
      };
    }
  }

  const driver = {
    run(request = {}) {
      const actionName = normalizeObservableActionName(
        readFirstString(request?.action, request?.type, request?.kind, request?.tool, request?.method)
      );
      if (!actionName) {
        return executeAction("", request);
      }
      return executeAction(actionName, request);
    },
    markerStroke(request = {}) {
      return executeAction("marker_stroke", request);
    },
    protectStroke(request = {}) {
      return executeAction("protect_stroke", request);
    },
    magicSelectClick(request = {}) {
      return executeAction("magic_select_click", request);
    },
    stampClick(request = {}) {
      return executeAction("stamp_click", request);
    },
    makeSpaceClick(request = {}) {
      return executeAction("make_space_click", request);
    },
    eraserStroke(request = {}) {
      return executeAction("eraser_stroke", request);
    },
    replayTraceEntry(entry = {}) {
      const record = asRecord(entry) || {};
      const replayRequest = asRecord(record.replay?.request) || asRecord(record.action);
      if (!replayRequest) {
        return Promise.resolve({
          ok: false,
          error: "Trace entry is missing replay.request",
          action: null,
          result: {
            ok: false,
            error: "Trace entry is missing replay.request",
          },
          trace: makeTracePayload(
            traceLog,
            {
              ok: false,
              error: "Trace entry is missing replay.request",
              action: cloneJson(record.action || null),
              replay: cloneJson(record.replay || null),
              result: {
                ok: false,
                error: "Trace entry is missing replay.request",
              },
            },
            { nowMs },
            fallbackTraceSeq
          ),
          trace_path: null,
          trace_persisted: false,
        });
      }
      return driver.run(cloneJson(replayRequest));
    },
  };

  return driver;
}

export function dispatchAgentObservableBridgeEvent(
  type,
  detail,
  {
    windowObj = typeof window !== "undefined" ? window : null,
    CustomEventCtor = typeof CustomEvent === "function" ? CustomEvent : null,
  } = {}
) {
  if (!windowObj || typeof windowObj.dispatchEvent !== "function") return false;
  if (typeof CustomEventCtor !== "function") return false;
  windowObj.dispatchEvent(new CustomEventCtor(type, { detail }));
  return true;
}

export function installAgentObservableDriverBridge(
  {
    windowObj = typeof window !== "undefined" ? window : null,
    CustomEventCtor = typeof CustomEvent === "function" ? CustomEvent : null,
    driver = null,
  } = {}
) {
  if (!windowObj || typeof driver !== "object" || driver == null) return null;

  const previousHandler = windowObj[AGENT_OBSERVABLE_BRIDGE_HANDLER_KEY];
  if (typeof previousHandler === "function" && typeof windowObj.removeEventListener === "function") {
    windowObj.removeEventListener(AGENT_OBSERVABLE_ACTION_EVENT, previousHandler);
  }

  const bridge = Object.freeze({
    run: (request = {}) => driver.run(request),
    markerStroke: (request = {}) => driver.markerStroke(request),
    protectStroke: (request = {}) => driver.protectStroke(request),
    magicSelectClick: (request = {}) => driver.magicSelectClick(request),
    stampClick: (request = {}) => driver.stampClick(request),
    makeSpaceClick: (request = {}) => driver.makeSpaceClick(request),
    eraserStroke: (request = {}) => driver.eraserStroke(request),
    replayTraceEntry: (entry = {}) => driver.replayTraceEntry(entry),
  });

  windowObj[AGENT_OBSERVABLE_DRIVER_KEY] = bridge;
  windowObj.juggernautAgentObservable = bridge;

  const handler = async (event) => {
    const result = await bridge.run(event?.detail || {});
    dispatchAgentObservableBridgeEvent(
      result?.ok ? AGENT_OBSERVABLE_RESULT_EVENT : AGENT_OBSERVABLE_ERROR_EVENT,
      result,
      {
        windowObj,
        CustomEventCtor,
      }
    );
    return result;
  };

  windowObj[AGENT_OBSERVABLE_BRIDGE_HANDLER_KEY] = handler;
  if (typeof windowObj.addEventListener === "function") {
    windowObj.addEventListener(AGENT_OBSERVABLE_ACTION_EVENT, handler);
  }
  return {
    bridge,
    handler,
  };
}
