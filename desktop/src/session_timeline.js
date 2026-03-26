import {
  deserializeSessionValue,
  normalizeScreenshotPolishMetadata,
  rehydrateSessionSnapshotSession,
  serializeSessionValue,
} from "./session_snapshot.js";

export const SESSION_TIMELINE_FILENAME = "session-timeline.json";
export const SESSION_TIMELINE_SCHEMA_VERSION = 1;

const DEFAULT_VIEW = Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 });

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
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

function normalizeSerializedSnapshot(snapshot = null) {
  if (!snapshot || typeof snapshot !== "object") return null;
  return serializeSessionValue(deserializeSessionValue(snapshot));
}

function sanitizeCommunicationState(communication = null) {
  const cloned = cloneStructured(asObject(communication) || {});
  if (!cloned || typeof cloned !== "object") return {};
  cloned.markDraft = null;
  cloned.eraseDraft = null;
  return cloned;
}

function cloneTimelineImage(item = null) {
  if (!item || typeof item !== "object") return null;
  return {
    ...item,
    img: null,
    imgLoading: false,
  };
}

function buildTimelineImagesById(images = []) {
  const out = new Map();
  for (const item of Array.isArray(images) ? images : []) {
    const imageId = String(item?.id || "").trim();
    if (!imageId) continue;
    out.set(imageId, item);
  }
  return out;
}

export function captureSessionTimelineSnapshot(session = null) {
  const current = session && typeof session === "object" ? session : {};
  const screenshotPolishMeta = normalizeScreenshotPolishMetadata(current.screenshotPolishMeta);
  const images = Array.isArray(current.images) ? current.images.map(cloneTimelineImage).filter(Boolean) : [];
  const snapshot = {
    label: typeof current.label === "string" ? current.label : null,
    labelManual: Boolean(current.labelManual),
    forkedFromTabId: current.forkedFromTabId ? String(current.forkedFromTabId) : null,
    reviewFlowState: current.reviewFlowState ? String(current.reviewFlowState) : "",
    screenshotPolishMeta: screenshotPolishMeta ? cloneStructured(screenshotPolishMeta) : null,
    images,
    imagesById: buildTimelineImagesById(images),
    imagePaletteSeed: Math.max(0, Number(current.imagePaletteSeed) || 0),
    activeId: current.activeId ? String(current.activeId) : null,
    selectedIds: Array.isArray(current.selectedIds) ? current.selectedIds.slice() : [],
    canvasMode: String(current.canvasMode || "multi"),
    freeformRects: cloneStructured(current.freeformRects instanceof Map ? current.freeformRects : new Map()),
    freeformZOrder: Array.isArray(current.freeformZOrder) ? current.freeformZOrder.slice() : [],
    multiRects: cloneStructured(current.multiRects instanceof Map ? current.multiRects : new Map()),
    view: cloneStructured(asObject(current.view) || DEFAULT_VIEW) || { ...DEFAULT_VIEW },
    multiView: cloneStructured(asObject(current.multiView) || DEFAULT_VIEW) || { ...DEFAULT_VIEW },
    communication: sanitizeCommunicationState(current.communication),
    selection: cloneStructured(current.selection && typeof current.selection === "object" ? current.selection : null),
    annotateBox: cloneStructured(current.annotateBox && typeof current.annotateBox === "object" ? current.annotateBox : null),
    circlesByImageId: cloneStructured(current.circlesByImageId instanceof Map ? current.circlesByImageId : new Map()),
    activeCircle: cloneStructured(current.activeCircle && typeof current.activeCircle === "object" ? current.activeCircle : null),
    sessionTools: cloneStructured(Array.isArray(current.sessionTools) ? current.sessionTools : []),
    activeCustomToolId: current.activeCustomToolId ? String(current.activeCustomToolId) : null,
    lastAction: current.lastAction ? String(current.lastAction) : null,
    lastTipText: typeof current.lastTipText === "string" ? current.lastTipText : null,
    lastDirectorText: current.lastDirectorText ? String(current.lastDirectorText) : null,
    lastDirectorMeta: cloneStructured(asObject(current.lastDirectorMeta)),
    designReviewApply: cloneStructured(asObject(current.designReviewApply)),
    lastCostLatency: cloneStructured(asObject(current.lastCostLatency)),
  };
  return serializeSessionValue(snapshot);
}

export function restoreSessionTimelineSnapshot(snapshot = null, { runDir = null, eventsPath = null } = {}) {
  const restored = rehydrateSessionSnapshotSession(deserializeSessionValue(snapshot));
  restored.runDir = runDir ? String(runDir) : restored.runDir || null;
  restored.eventsPath = eventsPath ? String(eventsPath) : restored.eventsPath || null;
  restored.timelineOpen = true;
  return restored;
}

function normalizeTimelineNode(node = null, index = 0) {
  const current = node && typeof node === "object" ? node : {};
  const seq = Math.max(1, Number(current.seq) || index + 1);
  const fallbackNodeId = `tl-${String(seq).padStart(6, "0")}`;
  return {
    nodeId: current.nodeId ? String(current.nodeId) : fallbackNodeId,
    seq,
    createdAt: Number.isFinite(Number(current.createdAt)) ? Number(current.createdAt) : Date.now(),
    kind: current.kind ? String(current.kind) : null,
    action: current.action ? String(current.action) : null,
    visualMode: current.visualMode ? String(current.visualMode) : null,
    label: current.label ? String(current.label) : null,
    detail: current.detail ? String(current.detail) : null,
    parents: uniqueStringList(current.parents),
    imageIds: uniqueStringList(current.imageIds),
    previewImageId: current.previewImageId ? String(current.previewImageId) : null,
    previewPath: current.previewPath ? String(current.previewPath) : null,
    receiptPaths: uniqueStringList(current.receiptPaths),
    snapshot: normalizeSerializedSnapshot(current.snapshot),
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
  screenshotPolishMeta = null,
  nodes = [],
} = {}) {
  const normalizedNodes = sortTimelineNodes(nodes.map((node, index) => normalizeTimelineNode(node, index)));
  const lastNode = normalizedNodes[normalizedNodes.length - 1] || null;
  const resolvedLatestNodeId = String(latestNodeId || "").trim() || (lastNode?.nodeId || null);
  const resolvedHeadNodeId = String(headNodeId || "").trim() || resolvedLatestNodeId || null;
  const resolvedNextSeq = Math.max(
    1,
    Number(nextSeq) || 0,
    lastNode ? Math.max(1, Number(lastNode.seq) || 0) + 1 : 1
  );
  return {
    schemaVersion: SESSION_TIMELINE_SCHEMA_VERSION,
    runDir: runDir ? String(runDir) : null,
    headNodeId: resolvedHeadNodeId,
    latestNodeId: resolvedLatestNodeId,
    nextSeq: resolvedNextSeq,
    updatedAt: updatedAt ? String(updatedAt) : new Date().toISOString(),
    screenshotPolishMeta: normalizeScreenshotPolishMetadata(screenshotPolishMeta),
    nodes: normalizedNodes,
  };
}

export function deserializeSessionTimeline(payload = null) {
  const current = payload && typeof payload === "object" ? payload : {};
  const normalizedNodes = sortTimelineNodes(
    (Array.isArray(current.nodes) ? current.nodes : []).map((node, index) => normalizeTimelineNode(node, index))
  );
  const lastNode = normalizedNodes[normalizedNodes.length - 1] || null;
  const latestNodeId =
    String(current.latestNodeId || "").trim() ||
    (lastNode?.nodeId || null);
  const headNodeId =
    String(current.headNodeId || "").trim() ||
    latestNodeId ||
    null;
  return {
    schemaVersion: Math.max(1, Number(current.schemaVersion) || SESSION_TIMELINE_SCHEMA_VERSION),
    runDir: current.runDir ? String(current.runDir) : null,
    headNodeId,
    latestNodeId,
    nextSeq: Math.max(
      1,
      Number(current.nextSeq) || 0,
      lastNode ? Math.max(1, Number(lastNode.seq) || 0) + 1 : 1
    ),
    updatedAt: current.updatedAt ? String(current.updatedAt) : null,
    screenshotPolishMeta: normalizeScreenshotPolishMetadata(current.screenshotPolishMeta),
    nodes: normalizedNodes,
  };
}
