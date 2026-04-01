import { createInSessionToolRegistry } from "./tool_runtime.js";

export const SESSION_SNAPSHOT_SCHEMA = "cue.session.v1";
export const SESSION_SNAPSHOT_VERSION = 1;
const LEGACY_SESSION_SNAPSHOT_SCHEMA = "juggernaut.session_snapshot.v1";

const SERIALIZED_TYPE_KEY = "__juggernautSerializedType";
const SERIALIZED_MAP_TYPE = "map";
const SERIALIZED_SET_TYPE = "set";
const SERIALIZED_DATE_TYPE = "date";
const DEFAULT_VIEW = Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 });

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

function cloneStructured(value) {
  return deserializeSessionValue(serializeSessionValue(value));
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

function firstString(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function deriveRunIdFromRunDir(runDir = "") {
  const normalized = String(runDir || "").trim().replace(/[\\/]+$/, "");
  if (!normalized) return "";
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || "";
}

function toCanvasViewport(view = null) {
  const current = view && typeof view === "object" ? view : DEFAULT_VIEW;
  return {
    scale: Number.isFinite(Number(current.scale)) ? Number(current.scale) : DEFAULT_VIEW.scale,
    offset_x: Number.isFinite(Number(current.offsetX)) ? Number(current.offsetX) : DEFAULT_VIEW.offsetX,
    offset_y: Number.isFinite(Number(current.offsetY)) ? Number(current.offsetY) : DEFAULT_VIEW.offsetY,
  };
}

function fromCanvasViewport(view = null) {
  const current = view && typeof view === "object" ? view : DEFAULT_VIEW;
  return {
    scale: Number.isFinite(Number(current.scale)) ? Number(current.scale) : DEFAULT_VIEW.scale,
    offsetX: Number.isFinite(Number(current.offset_x ?? current.offsetX))
      ? Number(current.offset_x ?? current.offsetX)
      : DEFAULT_VIEW.offsetX,
    offsetY: Number.isFinite(Number(current.offset_y ?? current.offsetY))
      ? Number(current.offset_y ?? current.offsetY)
      : DEFAULT_VIEW.offsetY,
  };
}

function normalizeSessionImageRecord(item = null) {
  if (!item || typeof item !== "object") return null;
  const imageId = firstString(item.image_id, item.id);
  const path = firstString(item.path);
  if (!imageId || !path) return null;
  const width = Number(item.width);
  const height = Number(item.height);
  return {
    image_id: imageId,
    artifact_id: firstString(item.artifact_id, item.artifactId) || null,
    path,
    kind: firstString(item.kind) || null,
    label: firstString(item.label) || null,
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
    timeline_node_id: firstString(item.timeline_node_id, item.timelineNodeId) || null,
    source_receipt_path: firstString(item.source_receipt_path, item.sourceReceiptPath, item.receiptPath) || null,
  };
}

function buildSessionCommunicationPayload(session = null) {
  const current = session && typeof session === "object" ? session : {};
  const communication = current.communication && typeof current.communication === "object" ? current.communication : {};
  return {
    tool: firstString(communication.tool) || null,
    marks_by_image_id: serializeSessionValue(communication.marksByImageId instanceof Map ? communication.marksByImageId : new Map()),
    canvas_marks: serializeSessionValue(Array.isArray(communication.canvasMarks) ? communication.canvasMarks : []),
    stamps_by_image_id: serializeSessionValue(
      communication.stampsByImageId instanceof Map ? communication.stampsByImageId : new Map()
    ),
    canvas_stamps: serializeSessionValue(Array.isArray(communication.canvasStamps) ? communication.canvasStamps : []),
    stamp_picker: serializeSessionValue(
      communication.stampPicker && typeof communication.stampPicker === "object" ? communication.stampPicker : null
    ),
    region_proposals_by_image_id: serializeSessionValue(
      communication.regionProposalsByImageId instanceof Map ? communication.regionProposalsByImageId : new Map()
    ),
    review_history: serializeSessionValue(Array.isArray(communication.reviewHistory) ? communication.reviewHistory : []),
    last_anchor: serializeSessionValue(communication.lastAnchor && typeof communication.lastAnchor === "object" ? communication.lastAnchor : null),
    proposal_tray: serializeSessionValue(
      communication.proposalTray && typeof communication.proposalTray === "object" ? communication.proposalTray : null
    ),
    canvas_layout: {
      image_palette_seed: Math.max(0, Number(current.imagePaletteSeed) || 0),
      freeform_rects: serializeSessionValue(current.freeformRects instanceof Map ? current.freeformRects : new Map()),
      freeform_z_order: uniqueStringList(current.freeformZOrder),
      multi_rects: serializeSessionValue(current.multiRects instanceof Map ? current.multiRects : new Map()),
    },
    annotate_box: serializeSessionValue(current.annotateBox && typeof current.annotateBox === "object" ? current.annotateBox : null),
    circles_by_image_id: serializeSessionValue(current.circlesByImageId instanceof Map ? current.circlesByImageId : new Map()),
    active_circle: serializeSessionValue(current.activeCircle && typeof current.activeCircle === "object" ? current.activeCircle : null),
    session_tools: serializeSessionValue(Array.isArray(current.sessionTools) ? current.sessionTools : []),
    active_custom_tool_id: firstString(current.activeCustomToolId) || null,
    last_action: firstString(current.lastAction) || null,
    last_tip_text: typeof current.lastTipText === "string" ? current.lastTipText : null,
    last_director_text: firstString(current.lastDirectorText) || null,
    last_director_meta: serializeSessionValue(current.lastDirectorMeta && typeof current.lastDirectorMeta === "object" ? current.lastDirectorMeta : null),
    last_cost_latency: serializeSessionValue(current.lastCostLatency && typeof current.lastCostLatency === "object" ? current.lastCostLatency : null),
    label_manual: Boolean(current.labelManual),
    review_flow_state: firstString(current.reviewFlowState) || "",
    forked_from_tab_id: firstString(current.forkedFromTabId) || null,
  };
}

function parseOverlayCommunicationState(overlays = null) {
  const current = overlays && typeof overlays === "object" ? overlays : {};
  const communication = deserializeSessionValue(current.communication);
  const payload = communication && typeof communication === "object" ? communication : {};
  const canvasLayout = payload.canvas_layout && typeof payload.canvas_layout === "object" ? payload.canvas_layout : {};
  return {
    communication: {
      tool: firstString(payload.tool) || null,
      markDraft: null,
      eraseDraft: null,
      stampPicker: payload.stamp_picker && typeof payload.stamp_picker === "object"
        ? deserializeSessionValue(payload.stamp_picker)
        : null,
      marksByImageId: deserializeSessionValue(payload.marks_by_image_id) instanceof Map
        ? deserializeSessionValue(payload.marks_by_image_id)
        : new Map(),
      canvasMarks: Array.isArray(deserializeSessionValue(payload.canvas_marks))
        ? deserializeSessionValue(payload.canvas_marks)
        : [],
      stampsByImageId: deserializeSessionValue(payload.stamps_by_image_id) instanceof Map
        ? deserializeSessionValue(payload.stamps_by_image_id)
        : new Map(),
      canvasStamps: Array.isArray(deserializeSessionValue(payload.canvas_stamps))
        ? deserializeSessionValue(payload.canvas_stamps)
        : [],
      regionProposalsByImageId: deserializeSessionValue(payload.region_proposals_by_image_id) instanceof Map
        ? deserializeSessionValue(payload.region_proposals_by_image_id)
        : new Map(),
      reviewHistory: Array.isArray(deserializeSessionValue(payload.review_history))
        ? deserializeSessionValue(payload.review_history)
        : [],
      lastAnchor: deserializeSessionValue(payload.last_anchor),
      proposalTray: deserializeSessionValue(payload.proposal_tray),
    },
    imagePaletteSeed: Math.max(0, Number(canvasLayout.image_palette_seed) || 0),
    freeformRects: deserializeSessionValue(canvasLayout.freeform_rects) instanceof Map
      ? deserializeSessionValue(canvasLayout.freeform_rects)
      : new Map(),
    freeformZOrder: uniqueStringList(canvasLayout.freeform_z_order),
    multiRects: deserializeSessionValue(canvasLayout.multi_rects) instanceof Map
      ? deserializeSessionValue(canvasLayout.multi_rects)
      : new Map(),
    selection: deserializeSessionValue(current.selection),
    annotateBox: deserializeSessionValue(payload.annotate_box),
    circlesByImageId: deserializeSessionValue(payload.circles_by_image_id) instanceof Map
      ? deserializeSessionValue(payload.circles_by_image_id)
      : new Map(),
    activeCircle: deserializeSessionValue(payload.active_circle),
    sessionTools: Array.isArray(deserializeSessionValue(payload.session_tools))
      ? deserializeSessionValue(payload.session_tools)
      : [],
    activeCustomToolId: firstString(payload.active_custom_tool_id) || null,
    lastAction: firstString(payload.last_action) || null,
    lastTipText: typeof payload.last_tip_text === "string" ? payload.last_tip_text : null,
    lastDirectorText: firstString(payload.last_director_text) || null,
    lastDirectorMeta: deserializeSessionValue(payload.last_director_meta),
    lastCostLatency: deserializeSessionValue(payload.last_cost_latency),
    labelManual: Boolean(payload.label_manual),
    reviewFlowState: firstString(payload.review_flow_state) || "",
    forkedFromTabId: firstString(payload.forked_from_tab_id) || null,
  };
}

export function captureSessionVisibleState(session = null) {
  const current = session && typeof session === "object" ? session : {};
  const images = (Array.isArray(current.images) ? current.images : []).map((item) => normalizeSessionImageRecord(item)).filter(Boolean);
  const imageIds = new Set(images.map((item) => item.image_id));
  const selectedImageIds = uniqueStringList(current.selectedIds).filter((imageId) => imageIds.has(imageId));
  const activeCandidateId = firstString(current.activeId);
  const activeImageId = imageIds.has(activeCandidateId) ? activeCandidateId : selectedImageIds[0] || images[0]?.image_id || null;
  return {
    active_image_id: activeImageId,
    selected_image_ids: selectedImageIds,
    images,
    canvas: {
      mode: firstString(current.canvasMode) || "multi",
      view: toCanvasViewport(current.view),
      multi_view: toCanvasViewport(current.multiView),
    },
    overlays: {
      communication: buildSessionCommunicationPayload(current),
      selection: serializeSessionValue(current.selection && typeof current.selection === "object" ? current.selection : null),
    },
  };
}

function rehydrateTimelineNodes(rawNodes = null) {
  const nodes = Array.isArray(rawNodes) ? rawNodes.map((node) => cloneStructured(node)).filter(Boolean) : [];
  const nodesById = new Map();
  for (const node of nodes) {
    const nodeId = firstString(node?.nodeId, node?.node_id);
    if (!nodeId) continue;
    nodesById.set(nodeId, node);
  }
  return {
    nodes,
    nodesById,
  };
}

function rehydrateLegacySessionSnapshotSession(rawSession = {}) {
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
    toolRegistry,
    sessionTools: toolRegistry.list(),
    eventsDecoder: new TextDecoder("utf-8"),
  };
}

function rehydrateCanonicalSessionSnapshotSession(rawState = {}) {
  const current = rawState && typeof rawState === "object" ? rawState : {};
  const images = (Array.isArray(current.images) ? current.images : []).map((item) => {
    const normalized = normalizeSessionImageRecord(item);
    if (!normalized) return null;
    return {
      id: normalized.image_id,
      artifactId: normalized.artifact_id,
      path: normalized.path,
      kind: normalized.kind,
      label: normalized.label,
      width: normalized.width,
      height: normalized.height,
      timelineNodeId: normalized.timeline_node_id,
      receiptPath: normalized.source_receipt_path,
      img: null,
      imgLoading: false,
    };
  }).filter(Boolean);
  const imagesById = new Map();
  for (const item of images) {
    const imageId = firstString(item?.id);
    if (!imageId) continue;
    imagesById.set(imageId, item);
  }

  const selectedIds = uniqueStringList(current.selected_image_ids || current.selectedImageIds)
    .filter((imageId) => imagesById.has(imageId));
  const activeId = firstString(current.active_image_id, current.activeImageId);
  const normalizedActiveId = activeId && imagesById.has(activeId) ? activeId : selectedIds[0] || images[0]?.id || null;

  const overlayState = parseOverlayCommunicationState(current.overlays);
  const freeformZOrder = overlayState.freeformZOrder.filter((imageId) => imagesById.has(imageId));
  for (const imageId of imagesById.keys()) {
    if (!freeformZOrder.includes(imageId)) freeformZOrder.push(imageId);
  }

  const toolRegistry = createInSessionToolRegistry(Array.isArray(overlayState.sessionTools) ? overlayState.sessionTools : []);

  return {
    images,
    imagesById,
    imagePaletteSeed: overlayState.imagePaletteSeed,
    activeId: normalizedActiveId,
    selectedIds,
    timelineNodes: [],
    timelineNodesById: new Map(),
    timelineHeadNodeId: null,
    timelineLatestNodeId: null,
    timelineNextSeq: 1,
    timelineOpen: true,
    canvasMode: firstString(current.canvas?.mode, current.canvasMode) || "multi",
    freeformRects: overlayState.freeformRects instanceof Map ? overlayState.freeformRects : new Map(),
    freeformZOrder,
    multiRects: overlayState.multiRects instanceof Map ? overlayState.multiRects : new Map(),
    view: fromCanvasViewport(current.canvas?.view),
    multiView: fromCanvasViewport(current.canvas?.multi_view || current.canvas?.multiView),
    communication: overlayState.communication,
    selection: overlayState.selection && typeof overlayState.selection === "object" ? overlayState.selection : null,
    annotateBox: overlayState.annotateBox && typeof overlayState.annotateBox === "object" ? overlayState.annotateBox : null,
    circlesByImageId: overlayState.circlesByImageId instanceof Map ? overlayState.circlesByImageId : new Map(),
    activeCircle: overlayState.activeCircle && typeof overlayState.activeCircle === "object" ? overlayState.activeCircle : null,
    toolRegistry,
    sessionTools: toolRegistry.list(),
    activeCustomToolId: overlayState.activeCustomToolId,
    lastAction: overlayState.lastAction,
    lastTipText: overlayState.lastTipText,
    lastDirectorText: overlayState.lastDirectorText,
    lastDirectorMeta: overlayState.lastDirectorMeta && typeof overlayState.lastDirectorMeta === "object" ? overlayState.lastDirectorMeta : null,
    lastCostLatency: overlayState.lastCostLatency && typeof overlayState.lastCostLatency === "object" ? overlayState.lastCostLatency : null,
    labelManual: overlayState.labelManual,
    reviewFlowState: overlayState.reviewFlowState,
    forkedFromTabId: overlayState.forkedFromTabId,
    eventsDecoder: new TextDecoder("utf-8"),
  };
}

function isCanonicalSessionState(value = null) {
  const current = value && typeof value === "object" ? value : null;
  if (!current) return false;
  return Boolean(current.canvas || current.overlays || current.active_image_id || current.selected_image_ids);
}

export function rehydrateSessionSnapshotSession(rawSession = {}) {
  if (isCanonicalSessionState(rawSession)) {
    return rehydrateCanonicalSessionSnapshotSession(rawSession);
  }
  return rehydrateLegacySessionSnapshotSession(rawSession);
}

export function serializeSessionSnapshot({ session = null, label = "" } = {}) {
  const current = session && typeof session === "object" ? session : {};
  const runId = firstString(current.runId, deriveRunIdFromRunDir(current.runDir));
  return {
    schema: SESSION_SNAPSHOT_SCHEMA,
    version: SESSION_SNAPSHOT_VERSION,
    run_id: runId,
    saved_at: new Date().toISOString(),
    tab_label: firstString(label, current.label) || null,
    forked_from_run_id: firstString(current.forkedFromRunId) || null,
    state: captureSessionVisibleState(current),
    timeline: {
      head_node_id: firstString(current.timelineHeadNodeId) || null,
      latest_node_id: firstString(current.timelineLatestNodeId) || null,
      next_seq: Math.max(1, Number(current.timelineNextSeq) || 1),
    },
    save_state: {
      dirty: Boolean(current.dirty || current?.saveState?.dirty),
    },
  };
}

export function deserializeSessionSnapshot(payload = null) {
  const current = payload && typeof payload === "object" ? payload : null;
  if (!current) {
    throw new Error("Session snapshot is missing.");
  }
  const schema = firstString(current.schema);
  if (schema === LEGACY_SESSION_SNAPSHOT_SCHEMA) {
    return {
      schema: LEGACY_SESSION_SNAPSHOT_SCHEMA,
      version: Math.max(1, Number(current.version) || SESSION_SNAPSHOT_VERSION),
      runId: null,
      savedAt: current.savedAt ? String(current.savedAt) : null,
      label: current.label ? String(current.label) : null,
      session: rehydrateLegacySessionSnapshotSession(deserializeSessionValue(current.session)),
    };
  }
  if (schema !== SESSION_SNAPSHOT_SCHEMA) {
    throw new Error("Unsupported session snapshot schema.");
  }
  const session = rehydrateCanonicalSessionSnapshotSession(current.state);
  const rehydratedTimeline = rehydrateTimelineNodes(deserializeSessionValue(current.timeline?.nodes));
  const latestNodeId =
    firstString(current.timeline?.latest_node_id, current.timeline?.latestNodeId) ||
    firstString(rehydratedTimeline.nodes[rehydratedTimeline.nodes.length - 1]?.nodeId);
  const headNodeId =
    firstString(current.timeline?.head_node_id, current.timeline?.headNodeId) ||
    latestNodeId ||
    null;
  session.timelineNodes = rehydratedTimeline.nodes;
  session.timelineNodesById = rehydratedTimeline.nodesById;
  session.label = firstString(current.tab_label) || null;
  session.forkedFromRunId = firstString(current.forked_from_run_id) || null;
  session.timelineHeadNodeId = headNodeId;
  session.timelineLatestNodeId = latestNodeId;
  session.timelineNextSeq = Math.max(
    1,
    Number(current.timeline?.next_seq ?? current.timeline?.nextSeq) || 0,
    rehydratedTimeline.nodes.length
      ? Math.max(...rehydratedTimeline.nodes.map((node) => Math.max(1, Number(node?.seq) || 1))) + 1
      : 1
  );
  session.timelineOpen = true;
  return {
    schema: SESSION_SNAPSHOT_SCHEMA,
    version: Math.max(1, Number(current.version) || SESSION_SNAPSHOT_VERSION),
    runId: firstString(current.run_id) || null,
    savedAt: current.saved_at ? String(current.saved_at) : null,
    label: firstString(current.tab_label) || null,
    session,
  };
}
