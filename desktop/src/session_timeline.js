import {
  captureSessionVisibleState,
  deserializeSessionValue,
  rehydrateSessionSnapshotSession,
  serializeSessionValue,
} from "./session_snapshot.js";

export const SESSION_TIMELINE_FILENAME = "session-timeline.json";
export const SESSION_TIMELINE_SCHEMA = "cue.timeline.v1";
export const SESSION_TIMELINE_SCHEMA_VERSION = 1;
const LEGACY_SESSION_TIMELINE_SCHEMA_VERSION = 1;
const INLINE_SNAPSHOT_KIND = "inline";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function firstString(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function uniqueStringList(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function cloneStructured(value) {
  return deserializeSessionValue(serializeSessionValue(value));
}

function deriveRunIdFromRunDir(runDir = "") {
  const normalized = String(runDir || "").trim().replace(/[\\/]+$/, "");
  if (!normalized) return "";
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || "";
}

function normalizeTimestampMs(value, fallback = Date.now()) {
  if (Number.isFinite(Number(value))) return Number(value);
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoTimestamp(value, fallback = new Date().toISOString()) {
  if (!value) return fallback;
  const parsed = normalizeTimestampMs(value, NaN);
  if (!Number.isFinite(parsed)) return fallback;
  return new Date(parsed).toISOString();
}

function normalizeSerializedSnapshot(snapshot = null) {
  if (!snapshot || typeof snapshot !== "object") return null;
  return captureSessionVisibleState(rehydrateSessionSnapshotSession(cloneStructured(snapshot)));
}

export function captureSessionTimelineSnapshot(session = null) {
  return captureSessionVisibleState(session);
}

export function restoreSessionTimelineSnapshot(snapshot = null, { runDir = null, eventsPath = null } = {}) {
  const restored = rehydrateSessionSnapshotSession(snapshot);
  restored.runDir = runDir ? String(runDir) : restored.runDir || null;
  restored.eventsPath = eventsPath ? String(eventsPath) : restored.eventsPath || null;
  restored.timelineOpen = true;
  return restored;
}

function inlineSnapshotFromNode(node = null) {
  const current = node && typeof node === "object" ? node : {};
  const snapshotRef = asObject(current.snapshot_ref) || asObject(current.snapshotRef);
  if (snapshotRef) {
    const kind = firstString(snapshotRef.kind);
    if (kind && kind !== INLINE_SNAPSHOT_KIND) return null;
    return snapshotRef.snapshot;
  }
  return current.snapshot;
}

function timelineActionKey(action = "", kind = "") {
  const normalizedAction = String(action || "").trim().toLowerCase();
  const normalizedKind = String(kind || "").trim().toLowerCase();
  if (normalizedAction.includes("import")) return "import";
  if (
    normalizedAction.includes("variation") ||
    normalizedAction.includes("remove") ||
    normalizedAction.includes("replace") ||
    normalizedAction.includes("recreate") ||
    normalizedAction.includes("recast") ||
    normalizedAction.includes("blend") ||
    normalizedAction.includes("bridge") ||
    normalizedAction.includes("background") ||
    normalizedAction.includes("extract")
  ) {
    return "result";
  }
  if (normalizedAction.includes("move") || normalizedAction.includes("drag")) return "move";
  if (normalizedAction.includes("resize") || normalizedAction.includes("scale")) return "resize";
  if (normalizedAction.includes("rotate")) return "rotate";
  if (normalizedAction.includes("skew")) return "skew";
  if (normalizedAction.includes("mark")) return "mark";
  if (normalizedAction.includes("highlight")) return "highlight";
  if (normalizedAction.includes("magic")) return "magic";
  if (normalizedAction.includes("erase")) return "erase";
  if (normalizedAction.includes("annotate")) return "annotate";
  if (normalizedAction.includes("circle")) return "circle";
  if (normalizedAction.includes("delete") || normalizedAction.includes("remove image")) return "delete";
  if (normalizedKind === "image_result") return "result";
  if (normalizedKind === "transform") return "move";
  if (normalizedKind === "annotation") return "mark";
  if (normalizedKind === "delete") return "delete";
  return "state";
}

function inferTimelineVisualMode(node = null) {
  const explicit = firstString(node?.visualMode, node?.visual_mode);
  if (explicit) return explicit;
  const actionKey = timelineActionKey(node?.action, node?.kind);
  return actionKey === "import" || actionKey === "result" ? "thumbnail" : "icon";
}

function normalizeTimelineNode(node = null, index = 0) {
  const current = node && typeof node === "object" ? node : {};
  const seq = Math.max(1, Number(current.seq) || index + 1);
  const fallbackNodeId = `tl-${String(seq).padStart(6, "0")}`;
  return {
    nodeId: firstString(current.nodeId, current.node_id) || fallbackNodeId,
    seq,
    createdAt: normalizeTimestampMs(current.createdAt ?? current.created_at),
    kind: firstString(current.kind) || null,
    action: firstString(current.action) || null,
    visualMode: inferTimelineVisualMode(current),
    label: firstString(current.label) || null,
    detail: firstString(current.detail) || null,
    parents: uniqueStringList(current.parents),
    imageIds: uniqueStringList(current.imageIds || current.image_ids),
    previewImageId: firstString(current.previewImageId, current.preview_image_id) || null,
    previewPath: firstString(current.previewPath, current.preview_path) || null,
    receiptPaths: uniqueStringList(current.receiptPaths || current.receipt_paths),
    snapshot: normalizeSerializedSnapshot(inlineSnapshotFromNode(current)),
  };
}

function sortTimelineNodes(nodes = []) {
  return Array.from(Array.isArray(nodes) ? nodes : []).sort((a, b) => {
    const aSeq = Math.max(0, Number(a?.seq) || 0);
    const bSeq = Math.max(0, Number(b?.seq) || 0);
    if (aSeq !== bSeq) return aSeq - bSeq;
    return Math.max(0, Number(a?.createdAt) || 0) - Math.max(0, Number(b?.createdAt) || 0);
  });
}

export function findSessionTimelineNode(timeline = null, nodeId = "") {
  const normalizedNodeId = String(nodeId || "").trim();
  if (!normalizedNodeId) return null;
  const nodes = Array.isArray(timeline?.nodes) ? timeline.nodes : [];
  return nodes.find((node) => String(node?.nodeId || "") === normalizedNodeId) || null;
}

export function resolveSessionTimelineHeadNode(timeline = null) {
  const nodes = sortTimelineNodes(Array.isArray(timeline?.nodes) ? timeline.nodes : []);
  if (!nodes.length) return null;
  const requestedHeadId = String(timeline?.headNodeId || "").trim();
  return findSessionTimelineNode({ nodes }, requestedHeadId) || nodes[nodes.length - 1] || null;
}

export function serializeSessionTimeline({
  runDir = null,
  headNodeId = null,
  latestNodeId = null,
  nextSeq = 1,
  updatedAt = null,
  nodes = [],
} = {}) {
  const normalizedNodes = sortTimelineNodes(nodes.map((node, index) => normalizeTimelineNode(node, index)));
  const canonicalNodes = normalizedNodes.filter((node) => node?.snapshot);
  const lastNode = normalizedNodes[normalizedNodes.length - 1] || null;
  const lastCanonicalNode = canonicalNodes[canonicalNodes.length - 1] || null;
  const requestedLatestNodeId = String(latestNodeId || "").trim();
  const requestedHeadNodeId = String(headNodeId || "").trim();
  const resolvedLatestNodeId =
    (requestedLatestNodeId && canonicalNodes.find((node) => node.nodeId === requestedLatestNodeId)?.nodeId) ||
    (lastCanonicalNode?.nodeId || null);
  const resolvedHeadNodeId =
    (requestedHeadNodeId && canonicalNodes.find((node) => node.nodeId === requestedHeadNodeId)?.nodeId) ||
    resolvedLatestNodeId ||
    null;
  const resolvedNextSeq = Math.max(
    1,
    Number(nextSeq) || 0,
    lastNode ? Math.max(1, Number(lastNode.seq) || 0) + 1 : 1
  );
  return {
    schema: SESSION_TIMELINE_SCHEMA,
    version: SESSION_TIMELINE_SCHEMA_VERSION,
    run_id: firstString(deriveRunIdFromRunDir(runDir)),
    head_node_id: resolvedHeadNodeId,
    latest_node_id: resolvedLatestNodeId,
    next_seq: resolvedNextSeq,
    updated_at: updatedAt ? String(updatedAt) : new Date().toISOString(),
    nodes: canonicalNodes.map((node) => ({
      node_id: node.nodeId,
      seq: node.seq,
      created_at: toIsoTimestamp(node.createdAt),
      kind: node.kind,
      action: node.action,
      label: node.label,
      detail: node.detail,
      parents: uniqueStringList(node.parents),
      image_ids: uniqueStringList(node.imageIds),
      preview_image_id: node.previewImageId,
      preview_path: node.previewPath,
      receipt_paths: uniqueStringList(node.receiptPaths),
      snapshot_ref: {
        kind: INLINE_SNAPSHOT_KIND,
        snapshot: node.snapshot,
      },
    })),
  };
}

export function deserializeSessionTimeline(payload = null) {
  const current = payload && typeof payload === "object" ? payload : {};
  const normalizedNodes = sortTimelineNodes(
    (Array.isArray(current.nodes) ? current.nodes : []).map((node, index) => normalizeTimelineNode(node, index))
  );
  const lastNode = normalizedNodes[normalizedNodes.length - 1] || null;
  const latestNodeId =
    firstString(current.latest_node_id, current.latestNodeId) ||
    (lastNode?.nodeId || null);
  const headNodeId =
    firstString(current.head_node_id, current.headNodeId) ||
    latestNodeId ||
    null;
  return {
    schema: firstString(current.schema) || SESSION_TIMELINE_SCHEMA,
    version: Math.max(
      1,
      Number(current.version ?? current.schemaVersion) || LEGACY_SESSION_TIMELINE_SCHEMA_VERSION
    ),
    runId: firstString(current.run_id, current.runId, deriveRunIdFromRunDir(current.runDir)) || null,
    runDir: current.runDir ? String(current.runDir) : null,
    headNodeId,
    latestNodeId,
    nextSeq: Math.max(
      1,
      Number(current.next_seq ?? current.nextSeq) || 0,
      lastNode ? Math.max(1, Number(lastNode.seq) || 0) + 1 : 1
    ),
    updatedAt: firstString(current.updated_at, current.updatedAt) || null,
    nodes: normalizedNodes,
  };
}
