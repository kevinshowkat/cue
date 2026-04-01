export const AGENT_OBSERVABLE_TRACE_SCHEMA = "juggernaut.agent_observable_trace";
export const AGENT_OBSERVABLE_TRACE_SCHEMA_VERSION = 1;
export const AGENT_OBSERVABLE_TRACE_FILENAME = "agent_observable_trace.jsonl";

function cloneJson(value) {
  if (value === undefined) return undefined;
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function normalizeRunDir(runDir = "") {
  const text = String(runDir || "").trim();
  return text || null;
}

function normalizeIsoTimestamp(atMs, nowIso) {
  if (typeof nowIso === "function") return String(nowIso(atMs) || "");
  return new Date(atMs).toISOString();
}

export function agentObservableTracePath(runDir = "") {
  const normalizedRunDir = normalizeRunDir(runDir);
  if (!normalizedRunDir) return null;
  return `${normalizedRunDir}/${AGENT_OBSERVABLE_TRACE_FILENAME}`;
}

export function buildAgentObservableTraceEntry(
  entry = {},
  {
    seq = 1,
    nowMs = () => Date.now(),
    nowIso = null,
  } = {}
) {
  const atMs = Math.max(0, Number(nowMs()) || Date.now());
  const payload = entry && typeof entry === "object" ? entry : {};
  const ok = payload.ok !== false && !payload.error;
  return {
    schema: AGENT_OBSERVABLE_TRACE_SCHEMA,
    schema_version: AGENT_OBSERVABLE_TRACE_SCHEMA_VERSION,
    seq: Math.max(1, Number(seq) || 1),
    at: normalizeIsoTimestamp(atMs, nowIso),
    at_ms: atMs,
    source: String(payload.source || "agent_observable_driver").trim() || "agent_observable_driver",
    request_id: payload.request_id ? String(payload.request_id) : null,
    ok,
    error: payload.error ? String(payload.error) : null,
    duration_ms: Math.max(0, Number(payload.duration_ms) || 0),
    action: cloneJson(payload.action && typeof payload.action === "object" ? payload.action : {}),
    replay: cloneJson(payload.replay && typeof payload.replay === "object" ? payload.replay : null),
    result: cloneJson(payload.result),
    context_before: cloneJson(payload.context_before),
    context_after: cloneJson(payload.context_after),
    meta: cloneJson(payload.meta),
  };
}

export function createAgentTraceLog(
  {
    appendJsonl = null,
    resolveRunDir = null,
    nowMs = () => Date.now(),
    nowIso = null,
    maxBytes = 1_500_000,
  } = {}
) {
  let seq = 0;

  function nextSeq() {
    seq += 1;
    return seq;
  }

  function build(entry = {}) {
    return buildAgentObservableTraceEntry(entry, {
      seq: nextSeq(),
      nowMs,
      nowIso,
    });
  }

  async function append(entry = {}) {
    const payload = build(entry);
    const runDir = typeof resolveRunDir === "function" ? resolveRunDir() : null;
    const path = agentObservableTracePath(runDir);
    if (!path || typeof appendJsonl !== "function") {
      return {
        persisted: false,
        path: null,
        payload,
      };
    }
    await appendJsonl(path, payload, { maxBytes });
    return {
      persisted: true,
      path,
      payload,
    };
  }

  return {
    build,
    append,
    getTracePath() {
      const runDir = typeof resolveRunDir === "function" ? resolveRunDir() : null;
      return agentObservableTracePath(runDir);
    },
  };
}
