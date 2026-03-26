import { createInSessionToolRegistry } from "./tool_runtime.js";

export const SESSION_SNAPSHOT_SCHEMA = "juggernaut.session_snapshot.v1";
export const SESSION_SNAPSHOT_VERSION = 1;

const SERIALIZED_TYPE_KEY = "__juggernautSerializedType";
const SERIALIZED_MAP_TYPE = "map";
const SERIALIZED_SET_TYPE = "set";
const SERIALIZED_DATE_TYPE = "date";

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function serializeSessionValueInternal(value, seen) {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    return value.map((entry) => serializeSessionValueInternal(entry, seen));
  }
  if (value instanceof Map) {
    return {
      [SERIALIZED_TYPE_KEY]: SERIALIZED_MAP_TYPE,
      entries: Array.from(value.entries()).map(([key, entry]) => [
        serializeSessionValueInternal(key, seen),
        serializeSessionValueInternal(entry, seen),
      ]),
    };
  }
  if (value instanceof Set) {
    return {
      [SERIALIZED_TYPE_KEY]: SERIALIZED_SET_TYPE,
      values: Array.from(value.values()).map((entry) => serializeSessionValueInternal(entry, seen)),
    };
  }
  if (value instanceof Date) {
    return {
      [SERIALIZED_TYPE_KEY]: SERIALIZED_DATE_TYPE,
      value: Number.isFinite(value.getTime()) ? value.toISOString() : null,
    };
  }
  if (!isPlainObject(value)) {
    return null;
  }
  if (seen.has(value)) {
    return null;
  }
  seen.add(value);
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "function" || entry === undefined) continue;
    out[key] = serializeSessionValueInternal(entry, seen);
  }
  seen.delete(value);
  return out;
}

export function serializeSessionValue(value) {
  return serializeSessionValueInternal(value, new WeakSet());
}

export function deserializeSessionValue(value) {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value)) {
    return value.map((entry) => deserializeSessionValue(entry));
  }
  if (!isPlainObject(value)) return value;
  const serializedType = String(value[SERIALIZED_TYPE_KEY] || "").trim();
  if (serializedType === SERIALIZED_MAP_TYPE) {
    const out = new Map();
    const entries = Array.isArray(value.entries) ? value.entries : [];
    for (const pair of entries) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      out.set(deserializeSessionValue(pair[0]), deserializeSessionValue(pair[1]));
    }
    return out;
  }
  if (serializedType === SERIALIZED_SET_TYPE) {
    const out = new Set();
    const values = Array.isArray(value.values) ? value.values : [];
    for (const entry of values) {
      out.add(deserializeSessionValue(entry));
    }
    return out;
  }
  if (serializedType === SERIALIZED_DATE_TYPE) {
    return value.value ? String(value.value) : null;
  }
  const out = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === SERIALIZED_TYPE_KEY) continue;
    out[key] = deserializeSessionValue(entry);
  }
  return out;
}

function clonePlainObject(value) {
  return value && typeof value === "object" ? { ...value } : value;
}

function normalizeScreenshotPolishString(value, { maxLength = 256 } = {}) {
  const compact = String(value || "").replace(/\s+/g, " ").trim();
  if (!compact) return null;
  if (compact.length <= maxLength) return compact;
  return compact.slice(0, Math.max(0, maxLength)).trim() || null;
}

function normalizeScreenshotPolishDimension(value) {
  const n = Math.round(Number(value) || 0);
  return n > 0 ? n : null;
}

export function normalizeScreenshotPolishMetadata(meta = null) {
  const current = meta && typeof meta === "object" && !Array.isArray(meta) ? meta : null;
  if (!current) return null;
  const rawSourceFrame =
    current.sourceFrame && typeof current.sourceFrame === "object" && !Array.isArray(current.sourceFrame)
      ? current.sourceFrame
      : {};
  const rawResolution =
    current.resolution && typeof current.resolution === "object" && !Array.isArray(current.resolution)
      ? current.resolution
      : {};
  const sourceFrame = {
    id: normalizeScreenshotPolishString(rawSourceFrame.id ?? current.sourceFrameId, { maxLength: 160 }),
    path: normalizeScreenshotPolishString(rawSourceFrame.path ?? current.sourceFramePath, { maxLength: 4096 }),
    label: normalizeScreenshotPolishString(rawSourceFrame.label ?? current.sourceFrameLabel, { maxLength: 160 }),
  };
  const resolution = {
    width: normalizeScreenshotPolishDimension(rawResolution.width ?? current.resolutionWidth),
    height: normalizeScreenshotPolishDimension(rawResolution.height ?? current.resolutionHeight),
  };
  const hasSourceFrame = Boolean(sourceFrame.id || sourceFrame.path || sourceFrame.label);
  const hasResolution = Boolean(resolution.width || resolution.height);
  const normalized = {
    sourceFrame: hasSourceFrame ? sourceFrame : null,
    platformTarget: normalizeScreenshotPolishString(current.platformTarget, { maxLength: 64 }),
    screenName: normalizeScreenshotPolishString(current.screenName, { maxLength: 160 }),
    resolution: hasResolution ? resolution : null,
  };
  if (!normalized.sourceFrame && !normalized.platformTarget && !normalized.screenName && !normalized.resolution) {
    return null;
  }
  return normalized;
}

export function rehydrateSessionSnapshotSession(rawSession = {}) {
  const current = rawSession && typeof rawSession === "object" ? { ...rawSession } : {};
  const images = Array.isArray(current.images)
    ? current.images
        .map((item) => (item && typeof item === "object" ? { ...item, img: null } : null))
        .filter(Boolean)
    : [];
  const imagesById = new Map();
  for (const item of images) {
    const imageId = String(item?.id || "").trim();
    if (!imageId) continue;
    imagesById.set(imageId, item);
  }

  const timelineNodes = Array.isArray(current.timelineNodes)
    ? current.timelineNodes.map((node) => clonePlainObject(node)).filter(Boolean)
    : [];
  const timelineNodesById = new Map();
  for (const node of timelineNodes) {
    const nodeId = String(node?.nodeId || "").trim();
    if (!nodeId) continue;
    timelineNodesById.set(nodeId, node);
  }

  const selectedIds = Array.isArray(current.selectedIds)
    ? current.selectedIds
        .map((id) => String(id || "").trim())
        .filter((id, index, values) => id && values.indexOf(id) === index && imagesById.has(id))
    : [];
  const activeId = String(current.activeId || "").trim();
  const normalizedActiveId = activeId && imagesById.has(activeId) ? activeId : selectedIds[0] || images[0]?.id || null;
  const freeformZOrder = Array.isArray(current.freeformZOrder)
    ? current.freeformZOrder
        .map((id) => String(id || "").trim())
        .filter((id, index, values) => id && values.indexOf(id) === index && imagesById.has(id))
    : [];
  for (const imageId of imagesById.keys()) {
    if (!freeformZOrder.includes(imageId)) {
      freeformZOrder.push(imageId);
    }
  }

  const toolRegistry = createInSessionToolRegistry(Array.isArray(current.sessionTools) ? current.sessionTools : []);

  return {
    ...current,
    images,
    imagesById,
    selectedIds,
    activeId: normalizedActiveId,
    freeformZOrder,
    timelineNodes,
    timelineNodesById,
    timelineHeadNodeId: current.timelineHeadNodeId ? String(current.timelineHeadNodeId) : null,
    timelineLatestNodeId: current.timelineLatestNodeId ? String(current.timelineLatestNodeId) : null,
    timelineNextSeq: Math.max(
      1,
      Number(current.timelineNextSeq) || 0,
      timelineNodes.length ? Math.max(...timelineNodes.map((node) => Math.max(1, Number(node?.seq) || 1))) + 1 : 1
    ),
    timelineOpen: current.timelineOpen !== false,
    screenshotPolishMeta: normalizeScreenshotPolishMetadata(current.screenshotPolishMeta),
    toolRegistry,
    sessionTools: toolRegistry.list(),
    eventsDecoder: new TextDecoder("utf-8"),
  };
}

export function serializeSessionSnapshot({ session = null, label = "" } = {}) {
  return {
    schema: SESSION_SNAPSHOT_SCHEMA,
    version: SESSION_SNAPSHOT_VERSION,
    savedAt: new Date().toISOString(),
    label: String(label || "").trim() || null,
    session: serializeSessionValue(session && typeof session === "object" ? session : {}),
  };
}

export function deserializeSessionSnapshot(payload = null) {
  const current = payload && typeof payload === "object" ? payload : null;
  if (!current) {
    throw new Error("Session snapshot is missing.");
  }
  if (String(current.schema || "").trim() !== SESSION_SNAPSHOT_SCHEMA) {
    throw new Error("Unsupported session snapshot schema.");
  }
  return {
    schema: SESSION_SNAPSHOT_SCHEMA,
    version: Math.max(1, Number(current.version) || SESSION_SNAPSHOT_VERSION),
    savedAt: current.savedAt ? String(current.savedAt) : null,
    label: current.label ? String(current.label) : null,
    session: rehydrateSessionSnapshotSession(deserializeSessionValue(current.session)),
  };
}
