import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const rendererPath = join(here, "..", "src", "app", "canvas_renderer.js");
const app = readFileSync(appPath, "utf8");
const rendererSource = readFileSync(rendererPath, "utf8");

function extractFunctionSource(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => app.indexOf(marker))
    .find((index) => index >= 0);
  assert.notEqual(start, undefined, `Could not find function ${name}`);
  const signatureStart = app.indexOf("(", start);
  assert.notEqual(signatureStart, -1, `Could not find signature for ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth === 0 && char === "{") {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `Could not find body for ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return app.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract function ${name}`);
}

function instantiateFunction(name, deps = {}) {
  const source = extractFunctionSource(name);
  const keys = Object.keys(deps);
  const values = Object.values(deps);
  return new Function(...keys, `return (${source});`)(...values);
}

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add(name) {
      values.add(name);
    },
    remove(name) {
      values.delete(name);
    },
    contains(name) {
      return values.has(name);
    },
    toggle(name, force) {
      if (force === undefined) {
        if (values.has(name)) values.delete(name);
        else values.add(name);
        return values.has(name);
      }
      if (force) values.add(name);
      else values.delete(name);
      return values.has(name);
    },
  };
}

function buildReviewApplyHarness({
  activeTabId = "tab-a",
  pendingRequestId = "review-1",
  pendingSessionKey = "tab:tab-a",
  targetPath = "/tmp/source.png",
  communicationTool = "marker",
} = {}) {
  const state = {
    activeTabId,
    runDir: "/runs/a",
    communication: {
      tool: communicationTool,
      reviewHistory: [],
      proposalTray: {
        requestId: pendingRequestId,
      },
    },
    canvasMode: "multi",
    tool: "lasso",
    designReviewApply: {
      status: "running",
      sessionKey: pendingSessionKey,
      tabId: pendingSessionKey.startsWith("tab:") ? pendingSessionKey.slice(4) : activeTabId,
      requestId: pendingRequestId,
      proposalId: "proposal-1",
      targetImageId: "img-1",
      referenceImageIds: ["img-2"],
      proposal: {
        proposalId: "proposal-1",
        label: "Swap background",
        actionType: "background_replace",
      },
      request: {
        requestId: pendingRequestId,
        sessionId: pendingSessionKey.replace(/^tab:/, ""),
        primaryImageId: "img-1",
        visibleCanvasContext: {
          images: [
            { id: "img-1", path: targetPath },
            { id: "img-2", path: "/tmp/ref.png" },
          ],
        },
      },
    },
    imagesById: new Map([
      [
        "img-1",
        {
          id: "img-1",
          path: targetPath,
          receiptPath: "/tmp/old-receipt.json",
          kind: "upload",
          source: "upload",
          label: "Hero",
          timelineNodeId: "tl-1",
        },
      ],
      [
        "img-2",
        {
          id: "img-2",
          path: "/tmp/ref.png",
          kind: "upload",
          source: "upload",
          label: "Ref",
          timelineNodeId: "tl-ref",
        },
      ],
    ]),
    lastCostLatency: null,
  };
  const cloneToolRuntimeValue = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
  const asRecord = instantiateFunction("asRecord");
  const readFirstString = instantiateFunction("readFirstString");
  const readFirstNumber = instantiateFunction("readFirstNumber");
  const uniqueStringList = instantiateFunction("uniqueStringList", { readFirstString, Set });
  const createFreshDesignReviewApplyState = instantiateFunction("createFreshDesignReviewApplyState");
  const cloneDesignReviewApplyState = instantiateFunction("cloneDesignReviewApplyState", {
    asRecord,
    readFirstString,
    readFirstNumber,
    uniqueStringList,
    cloneToolRuntimeValue,
    createFreshDesignReviewApplyState,
  });
  const currentDesignReviewApplySessionKey = instantiateFunction("currentDesignReviewApplySessionKey", {
    readFirstString,
    state,
  });
  const designReviewApplyActionLabel = instantiateFunction("designReviewApplyActionLabel", {
    readFirstString,
  });
  const normalizeDesignReviewApplyEventDetail = instantiateFunction("normalizeDesignReviewApplyEventDetail", {
    asRecord,
    cloneToolRuntimeValue,
    cloneDesignReviewApplyState,
    readFirstString,
    readFirstNumber,
    uniqueStringList,
    currentDesignReviewApplySessionKey,
    state,
  });
  const designReviewApplyEventMatchesActiveTab = instantiateFunction("designReviewApplyEventMatchesActiveTab", {
    cloneDesignReviewApplyState,
    currentDesignReviewApplySessionKey,
    readFirstString,
    state,
  });
  const reviewApplyShouldPreserveCommunicationTool = instantiateFunction("reviewApplyShouldPreserveCommunicationTool", {
    readFirstString,
  });
  const designReviewApplyRequestUsesMagicSelect = instantiateFunction("designReviewApplyRequestUsesMagicSelect", {
    asRecord,
    readFirstString,
  });
  const designReviewApplyProposalUsesMagicSelect = instantiateFunction("designReviewApplyProposalUsesMagicSelect", {
    asRecord,
    readFirstString,
  });
  const resolveReviewApplyCommunicationTool = instantiateFunction("resolveReviewApplyCommunicationTool", {
    designReviewApplyRequestUsesMagicSelect,
    designReviewApplyProposalUsesMagicSelect,
    reviewApplyShouldPreserveCommunicationTool,
  });
  const updateDesignReviewApplyCostLatency = instantiateFunction("updateDesignReviewApplyCostLatency", {
    readFirstString,
    readFirstNumber,
    state,
  });

  const receiptCalls = [];
  const replaceCalls = [];
  const timelineCalls = [];
  const clearCalls = [];
  const dismissCalls = [];
  const statusCalls = [];
  const toastCalls = [];
  const topMetricCalls = [];
  const removeImageCalls = [];
  const archiveCalls = [];
  const dispatchCalls = [];
  const communicationToolCalls = [];
  const toolCalls = [];
  let clearVisibleCalls = 0;
  let requestRenderCalls = 0;
  let processActionQueueCalls = 0;
  let syncReviewFlowCalls = 0;

  const clearDesignReviewApplyState = ({ capture = true, publish = true } = {}) => {
    clearCalls.push({ capture, publish });
    state.designReviewApply = createFreshDesignReviewApplyState();
    return state.designReviewApply;
  };
  const writeDesignReviewApplyReceipt = async (payload = {}) => {
    receiptCalls.push(payload);
    return "/runs/a/receipt-review-apply.json";
  };
  const replaceImageInPlace = async (targetId, options = {}) => {
    replaceCalls.push({ targetId, options });
    const item = state.imagesById.get(targetId);
    if (item) {
      item.path = options.path;
      item.receiptPath = options.receiptPath;
      item.kind = options.kind;
      item.label = options.label;
    }
    return true;
  };
  const recordTimelineNode = (payload = {}) => {
    timelineCalls.push(payload);
    return "tl-2";
  };
  const ingestTopMetricsFromReceiptPath = async (...args) => {
    topMetricCalls.push(args);
  };
  const removeImageFromCanvas = async (imageId) => {
    removeImageCalls.push(imageId);
    state.imagesById.delete(String(imageId || ""));
    return true;
  };
  const archiveCommunicationReviewContext = (payload = {}) => {
    archiveCalls.push(payload);
    state.communication.reviewHistory = [payload];
    return payload;
  };
  const setCommunicationTool = (tool = null, options = {}) => {
    communicationToolCalls.push({ tool, options });
    state.communication.tool = tool;
    return tool;
  };
  const ensureCommunicationToolActive = (tool = null, options = {}) => {
    communicationToolCalls.push({ tool, options });
    state.communication.tool = tool;
    return tool;
  };
  const setTool = (tool) => {
    toolCalls.push(tool);
    state.tool = tool;
    return tool;
  };
  const setStatus = (message, isError = false) => {
    statusCalls.push({ message, isError });
  };
  const dismissCommunicationProposalTrayAfterReviewApply = (options = {}) => {
    dismissCalls.push(options);
    return true;
  };
  const showToast = (message, kind, duration) => {
    toastCalls.push({ message, kind, duration });
  };
  const clearVisibleCommunicationReviewState = () => {
    clearVisibleCalls += 1;
    state.communication.markDraft = null;
    state.communication.eraseDraft = null;
    state.communication.marksByImageId = new Map();
    state.communication.canvasMarks = [];
    state.communication.regionProposalsByImageId = new Map();
    state.communication.lastAnchor = null;
    return state.communication;
  };
  const dispatchJuggernautShellEvent = (name, detail) => {
    dispatchCalls.push({ name, detail });
  };
  const requestRender = () => {
    requestRenderCalls += 1;
  };
  const processActionQueue = async () => {
    processActionQueueCalls += 1;
  };
  const syncActiveTabReviewFlowState = () => {
    syncReviewFlowCalls += 1;
    return "";
  };

  const applyAcceptedDesignReviewOutput = instantiateFunction("applyAcceptedDesignReviewOutput", {
    resolveDesignReviewApplyTargetRecord: () => ({
      record: { tabId: activeTabId },
      isActive: true,
    }),
    cloneDesignReviewApplyState,
    normalizeDesignReviewApplyEventDetail,
    designReviewApplyEventMatchesActiveTab,
    readFirstString,
    designReviewApplyActionLabel,
    writeDesignReviewApplyReceipt,
    replaceImageInPlace,
    recordTimelineNode,
    updateDesignReviewApplyCostLatency,
    ingestTopMetricsFromReceiptPath,
    uniqueStringList,
    removeImageFromCanvas,
    archiveCommunicationReviewContext,
    resolveReviewApplyCommunicationTool,
    reviewApplyShouldPreserveCommunicationTool,
    ensureCommunicationToolActive,
    setCommunicationTool,
    setTool,
    clearVisibleCommunicationReviewState,
    clearDesignReviewApplyState,
    dispatchJuggernautShellEvent,
    buildCommunicationBridgeSnapshot: () => ({ markCount: 0, regionGroupCount: 0 }),
    buildJuggernautShellContext: () => ({ activeTabId }),
    syncActiveTabReviewFlowState,
    dismissCommunicationProposalTrayAfterReviewApply,
    setStatus,
    showToast,
    requestRender,
    processActionQueue,
    basename,
    state,
    removeFile: async () => {},
    COMMUNICATION_STATE_CHANGED_EVENT: "juggernaut:communication-state-changed",
    DESIGN_REVIEW_APPLY_SOURCE: "design_review_apply",
  });

  return {
    state,
    receiptCalls,
    replaceCalls,
    timelineCalls,
    clearCalls,
    dismissCalls,
    statusCalls,
    toastCalls,
    topMetricCalls,
    removeImageCalls,
    archiveCalls,
    dispatchCalls,
    communicationToolCalls,
    toolCalls,
    get clearVisibleCalls() {
      return clearVisibleCalls;
    },
    get requestRenderCalls() {
      return requestRenderCalls;
    },
    get processActionQueueCalls() {
      return processActionQueueCalls;
    },
    get syncReviewFlowCalls() {
      return syncReviewFlowCalls;
    },
    applyAcceptedDesignReviewOutput,
  };
}

function buildBackgroundReviewApplyHarness({
  targetTabId = "tab-a",
  targetPath = "/tmp/source.png",
  referencePath = "/tmp/ref.png",
  communicationTool = "marker",
} = {}) {
  const session = {
    runDir: "/runs/a",
    images: [
      {
        id: "img-1",
        path: targetPath,
        receiptPath: "/tmp/old-receipt.json",
        kind: "upload",
        source: "upload",
        label: "Hero",
        timelineNodeId: "tl-1",
      },
      {
        id: "img-2",
        path: referencePath,
        kind: "upload",
        source: "upload",
        label: "Ref",
        timelineNodeId: "tl-ref",
      },
    ],
    imagesById: new Map(),
    activeId: "img-1",
    selectedIds: ["img-1", "img-2"],
    designReviewApply: {
      status: "running",
      sessionKey: `tab:${targetTabId}`,
      tabId: targetTabId,
      requestId: "review-1",
      proposalId: "proposal-1",
      targetImageId: "img-1",
      referenceImageIds: ["img-2"],
    },
    communication: {
      tool: communicationTool,
      proposalTray: {
        visible: true,
        requestId: "review-1",
        slots: [{ status: "apply_running" }],
      },
    },
    timelineNodes: [],
    timelineNodesById: new Map(),
    lastCostLatency: null,
    reviewFlowState: "applying",
    freeformRects: new Map(),
    freeformZOrder: ["img-1", "img-2"],
    multiRects: new Map(),
    circlesByImageId: new Map(),
    lastStatusText: "Engine: applying accepted review…",
    lastStatusError: false,
  };
  for (const image of session.images) {
    session.imagesById.set(image.id, image);
  }
  const record = {
    tabId: targetTabId,
    runDir: session.runDir,
    session,
    reviewFlowState: "applying",
    labelManual: false,
    label: "Hero",
    busy: true,
    tabUiMeta: {},
  };
  const cloneToolRuntimeValue = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
  const asRecord = instantiateFunction("asRecord");
  const readFirstString = instantiateFunction("readFirstString");
  const readFirstNumber = instantiateFunction("readFirstNumber");
  const uniqueStringList = instantiateFunction("uniqueStringList", { readFirstString, Set });
  const createFreshDesignReviewApplyState = instantiateFunction("createFreshDesignReviewApplyState");
  const cloneDesignReviewApplyState = instantiateFunction("cloneDesignReviewApplyState", {
    asRecord,
    readFirstString,
    readFirstNumber,
    uniqueStringList,
    cloneToolRuntimeValue,
    createFreshDesignReviewApplyState,
  });
  const normalizeDesignReviewApplyEventDetail = instantiateFunction("normalizeDesignReviewApplyEventDetail", {
    asRecord,
    cloneToolRuntimeValue,
    cloneDesignReviewApplyState,
    readFirstString,
    readFirstNumber,
    uniqueStringList,
    currentDesignReviewApplySessionKey: () => "",
    state: {
      communication: {
        proposalTray: {
          requestId: null,
        },
      },
    },
  });
  const designReviewApplyActionLabel = instantiateFunction("designReviewApplyActionLabel", {
    readFirstString,
  });
  const designReviewApplyEventMatchesTabRecord = instantiateFunction("designReviewApplyEventMatchesTabRecord", {
    cloneDesignReviewApplyState,
    readFirstString,
  });
  const reviewApplyShouldPreserveCommunicationTool = instantiateFunction("reviewApplyShouldPreserveCommunicationTool", {
    readFirstString,
  });
  const designReviewApplyRequestUsesMagicSelect = instantiateFunction("designReviewApplyRequestUsesMagicSelect", {
    asRecord,
    readFirstString,
  });
  const designReviewApplyProposalUsesMagicSelect = instantiateFunction("designReviewApplyProposalUsesMagicSelect", {
    asRecord,
    readFirstString,
  });
  const resolveReviewApplyCommunicationTool = instantiateFunction("resolveReviewApplyCommunicationTool", {
    designReviewApplyRequestUsesMagicSelect,
    designReviewApplyProposalUsesMagicSelect,
    reviewApplyShouldPreserveCommunicationTool,
  });

  const receiptCalls = [];
  const timelineCalls = [];
  const syncCalls = [];
  const removeFileCalls = [];

  const applyAcceptedDesignReviewOutputToSessionRecord = instantiateFunction("applyAcceptedDesignReviewOutputToSessionRecord", {
    ensureSessionTabRecordSession: () => session,
    cloneDesignReviewApplyState,
    normalizeDesignReviewApplyEventDetail,
    designReviewApplyEventMatchesTabRecord,
    readFirstString,
    designReviewApplyActionLabel,
    writeDesignReviewApplyReceipt: async (payload = {}) => {
      receiptCalls.push(payload);
      return "/runs/a/receipt-review-apply.json";
    },
    replaceImageInSessionRecord: (_session, targetId, options = {}) => {
      const item = session.imagesById.get(targetId) || null;
      if (!item) return false;
      item.path = options.path;
      item.receiptPath = options.receiptPath;
      item.kind = options.kind;
      item.label = options.label;
      item.source = "design_review_apply";
      return true;
    },
    recordTimelineNodeInSession: (_session, payload = {}) => {
      timelineCalls.push(payload);
      return "tl-2";
    },
    updateDesignReviewApplyCostLatencyForSession: (_session, detail = {}) => {
      session.lastCostLatency = {
        provider: detail.provider || null,
        model: detail.normalizedModel || detail.requestedModel || null,
      };
      return true;
    },
    uniqueStringList,
    removeImageFromSessionRecord: (_session, imageId) => {
      session.imagesById.delete(String(imageId || ""));
      session.images = session.images.filter((item) => item.id !== imageId);
      return true;
    },
    clearVisibleCommunicationReviewStateForSession: (_session) => {
      session.communication.proposalTray.visible = false;
      session.communication.proposalTray.requestId = null;
      return session.communication;
    },
    resolveReviewApplyCommunicationTool,
    reviewApplyShouldPreserveCommunicationTool,
    syncSessionTabRecordFromSession: (_record, options = {}) => {
      syncCalls.push(options);
      record.reviewFlowState = options.reviewFlowState ?? record.reviewFlowState;
      record.busy = options.busy ?? record.busy;
      return record;
    },
    persistSessionTimelineForSession: async () => "/runs/a/session-timeline.json",
    createFreshDesignReviewApplyState,
    basename,
    DESIGN_REVIEW_APPLY_SOURCE: "design_review_apply",
    removeFile: async (path) => {
      removeFileCalls.push(path);
    },
  });

  return {
    record,
    session,
    receiptCalls,
    timelineCalls,
    syncCalls,
    removeFileCalls,
    applyAcceptedDesignReviewOutputToSessionRecord,
  };
}

test("review apply success replaces the target image in place and records a timeline-backed receipt", async () => {
  const harness = buildReviewApplyHarness();

  const ok = await harness.applyAcceptedDesignReviewOutput({
    phase: "succeeded",
    sessionKey: "tab:tab-a",
    requestId: "review-1",
    proposal: {
      proposalId: "proposal-1",
      label: "Swap background",
      actionType: "background_replace",
    },
    request: {
      requestId: "review-1",
      sessionId: "tab-a",
      primaryImageId: "img-1",
      visibleCanvasContext: {
        images: [
          { id: "img-1", path: "/tmp/source.png" },
          { id: "img-2", path: "/tmp/ref.png" },
        ],
      },
    },
    targetImageId: "img-1",
    referenceImageIds: ["img-2"],
    outputPath: "/tmp/out.png",
    provider: "google",
    requestedModel: "gemini-3.1-flash-image-preview",
    normalizedModel: "gemini-3.1-flash-image-preview",
    cost_total_usd: 0.12,
    latency_per_image_s: 3.4,
  });

  assert.equal(ok, true);
  assert.equal(harness.receiptCalls.length, 1);
  assert.equal(harness.receiptCalls[0].targetImageId, "img-1");
  assert.deepEqual(harness.receiptCalls[0].referenceImageIds, ["img-2"]);
  assert.equal(harness.replaceCalls.length, 1);
  assert.equal(harness.replaceCalls[0].targetId, "img-1");
  assert.equal(harness.replaceCalls[0].options.path, "/tmp/out.png");
  assert.equal(harness.replaceCalls[0].options.label, "Hero");
  assert.equal(harness.timelineCalls.length, 1);
  assert.deepEqual(harness.timelineCalls[0].parents, ["tl-1"]);
  assert.equal(harness.timelineCalls[0].imageId, "img-1");
  assert.equal(harness.state.imagesById.get("img-1")?.source, "design_review_apply");
  assert.equal(harness.state.imagesById.get("img-1")?.timelineNodeId, "tl-2");
  assert.equal(harness.archiveCalls.length, 1);
  assert.equal(harness.archiveCalls[0].targetBefore.id, "img-1");
  assert.equal(harness.clearVisibleCalls, 1);
  assert.deepEqual(harness.removeImageCalls, ["img-2"]);
  assert.equal(harness.state.imagesById.has("img-2"), false);
  assert.deepEqual(harness.communicationToolCalls, [
    {
      tool: null,
      options: { source: "review_apply_success" },
    },
  ]);
  assert.deepEqual(harness.toolCalls, ["pan"]);
  assert.equal(harness.state.tool, "pan");
  assert.equal(harness.state.lastCostLatency?.provider, "google");
  assert.equal(harness.state.lastCostLatency?.model, "gemini-3.1-flash-image-preview");
  assert.equal(harness.clearCalls.length, 1);
  assert.equal(harness.syncReviewFlowCalls, 1);
  assert.deepEqual(harness.dismissCalls, [{ requestId: "review-1" }]);
  assert.equal(harness.dispatchCalls.length, 1);
  assert.equal(harness.topMetricCalls.length, 1);
  assert.equal(harness.requestRenderCalls, 1);
  assert.equal(harness.processActionQueueCalls, 1);
  assert.deepEqual(harness.statusCalls.at(-1), { message: "Engine: ready", isError: false });
  assert.deepEqual(harness.toastCalls.at(-1), {
    message: "Swap background applied.",
    kind: "tip",
    duration: 2200,
  });
});

test("review apply success keeps magic select armed for immediate post-apply clicks", async () => {
  const harness = buildReviewApplyHarness({ communicationTool: "magic_select" });

  const ok = await harness.applyAcceptedDesignReviewOutput({
    phase: "succeeded",
    sessionKey: "tab:tab-a",
    requestId: "review-1",
    proposal: {
      proposalId: "proposal-1",
      label: "Swap background",
      actionType: "background_replace",
    },
    request: {
      requestId: "review-1",
      sessionId: "tab-a",
      primaryImageId: "img-1",
      visibleCanvasContext: {
        images: [
          { id: "img-1", path: "/tmp/source.png" },
          { id: "img-2", path: "/tmp/ref.png" },
        ],
      },
    },
    targetImageId: "img-1",
    referenceImageIds: ["img-2"],
    outputPath: "/tmp/out.png",
  });

  assert.equal(ok, true);
  assert.deepEqual(harness.communicationToolCalls, []);
  assert.equal(harness.state.communication.tool, "magic_select");
});

test("background review apply completion updates the owning tab session without touching active-tab UI", async () => {
  const harness = buildBackgroundReviewApplyHarness();

  const ok = await harness.applyAcceptedDesignReviewOutputToSessionRecord(harness.record, {
    phase: "succeeded",
    sessionKey: "tab:tab-a",
    requestId: "review-1",
    proposal: {
      proposalId: "proposal-1",
      label: "Swap background",
      actionType: "background_replace",
    },
    request: {
      requestId: "review-1",
      sessionId: "tab-a",
      primaryImageId: "img-1",
      visibleCanvasContext: {
        images: [
          { id: "img-1", path: "/tmp/source.png" },
          { id: "img-2", path: "/tmp/ref.png" },
        ],
      },
    },
    targetImageId: "img-1",
    outputPath: "/tmp/out.png",
    referenceImageIds: ["img-2"],
    provider: "google",
    requestedModel: "gemini-3.1-flash-image-preview",
    normalizedModel: "gemini-3.1-flash-image-preview",
  });

  assert.equal(ok, true);
  assert.equal(harness.receiptCalls.length, 1);
  assert.equal(harness.receiptCalls[0].runDir, "/runs/a");
  assert.equal(harness.session.imagesById.get("img-1")?.path, "/tmp/out.png");
  assert.equal(harness.session.imagesById.get("img-1")?.receiptPath, "/runs/a/receipt-review-apply.json");
  assert.equal(harness.session.imagesById.get("img-1")?.timelineNodeId, "tl-2");
  assert.equal(harness.session.imagesById.get("img-1")?.source, "design_review_apply");
  assert.equal(harness.session.imagesById.has("img-2"), false);
  assert.equal(harness.session.communication.tool, null);
  assert.equal(harness.session.communication.proposalTray.visible, false);
  assert.equal(harness.session.designReviewApply.status, "idle");
  assert.deepEqual(harness.session.selectedIds, ["img-1"]);
  assert.equal(harness.session.lastStatusText, "Engine: ready");
  assert.equal(harness.session.lastStatusError, false);
  assert.equal(harness.session.lastCostLatency?.provider, "google");
  assert.equal(harness.session.lastCostLatency?.model, "gemini-3.1-flash-image-preview");
  assert.equal(harness.timelineCalls.length, 1);
  assert.deepEqual(harness.timelineCalls[0].parents, ["tl-1"]);
  assert.deepEqual(harness.syncCalls.at(-1), {
    publish: true,
    bumpVersions: true,
    busy: false,
    reviewFlowState: "",
  });
  assert.equal(harness.removeFileCalls.length, 0);
});

test("background review apply completion keeps magic select armed in the owning session", async () => {
  const harness = buildBackgroundReviewApplyHarness({ communicationTool: "magic_select" });

  const ok = await harness.applyAcceptedDesignReviewOutputToSessionRecord(harness.record, {
    phase: "succeeded",
    sessionKey: "tab:tab-a",
    requestId: "review-1",
    proposal: {
      proposalId: "proposal-1",
      label: "Swap background",
      actionType: "background_replace",
    },
    request: {
      requestId: "review-1",
      sessionId: "tab-a",
      primaryImageId: "img-1",
      visibleCanvasContext: {
        images: [
          { id: "img-1", path: "/tmp/source.png" },
          { id: "img-2", path: "/tmp/ref.png" },
        ],
      },
    },
    targetImageId: "img-1",
    outputPath: "/tmp/out.png",
    referenceImageIds: ["img-2"],
  });

  assert.equal(ok, true);
  assert.equal(harness.session.communication.tool, "magic_select");
  assert.equal(harness.session.communication.proposalTray.visible, false);
});

test("review apply success re-arms magic select when the request carried a magic select region under highlight", async () => {
  const harness = buildReviewApplyHarness({ communicationTool: "protect" });

  const ok = await harness.applyAcceptedDesignReviewOutput({
    phase: "succeeded",
    sessionKey: "tab:tab-a",
    requestId: "review-1",
    proposal: {
      proposalId: "proposal-1",
      label: "Swap background",
      actionType: "background_replace",
    },
    request: {
      requestId: "review-1",
      sessionId: "tab-a",
      primaryImageId: "img-1",
      reviewTool: "highlight",
      chosenRegionCandidate: {
        id: "candidate-1",
        source: "magic_select",
      },
      regionCandidates: [
        { id: "candidate-1", source: "magic_select" },
      ],
      visibleCanvasContext: {
        images: [
          { id: "img-1", path: "/tmp/source.png" },
          { id: "img-2", path: "/tmp/ref.png" },
        ],
      },
    },
    targetImageId: "img-1",
    referenceImageIds: ["img-2"],
    outputPath: "/tmp/out.png",
  });

  assert.equal(ok, true);
  assert.deepEqual(harness.communicationToolCalls, [
    {
      tool: "magic_select",
      options: { source: "review_apply_success" },
    },
  ]);
  assert.equal(harness.state.communication.tool, "magic_select");
});

test("review apply success re-arms magic select when the request only preserves the active region candidate id", async () => {
  const harness = buildReviewApplyHarness({ communicationTool: "marker" });

  const ok = await harness.applyAcceptedDesignReviewOutput({
    phase: "succeeded",
    sessionKey: "tab:tab-a",
    requestId: "review-1",
    proposal: {
      proposalId: "proposal-1",
      label: "Shift hero right",
      actionType: "move_subject",
    },
    request: {
      requestId: "review-1",
      sessionId: "tab-a",
      primaryImageId: "img-1",
      reviewTool: "marker",
      activeRegionCandidateId: "magic-select-1",
      selectionState: "region",
      chosenRegionCandidate: {
        id: "magic-select-1",
      },
      visibleCanvasContext: {
        images: [
          { id: "img-1", path: "/tmp/source.png" },
        ],
      },
    },
    targetImageId: "img-1",
    referenceImageIds: [],
    outputPath: "/tmp/out.png",
  });

  assert.equal(ok, true);
  assert.deepEqual(harness.communicationToolCalls, [
    {
      tool: "magic_select",
      options: { source: "review_apply_success" },
    },
  ]);
  assert.equal(harness.state.communication.tool, "magic_select");
});

test("background review apply re-arms magic select when the request carried a magic select region under highlight", async () => {
  const harness = buildBackgroundReviewApplyHarness({ communicationTool: "protect" });

  const ok = await harness.applyAcceptedDesignReviewOutputToSessionRecord(harness.record, {
    phase: "succeeded",
    sessionKey: "tab:tab-a",
    requestId: "review-1",
    proposal: {
      proposalId: "proposal-1",
      label: "Swap background",
      actionType: "background_replace",
    },
    request: {
      requestId: "review-1",
      sessionId: "tab-a",
      primaryImageId: "img-1",
      reviewTool: "highlight",
      chosenRegionCandidate: {
        id: "candidate-1",
        source: "magic_select",
      },
      regionCandidates: [
        { id: "candidate-1", source: "magic_select" },
      ],
      visibleCanvasContext: {
        images: [
          { id: "img-1", path: "/tmp/source.png" },
          { id: "img-2", path: "/tmp/ref.png" },
        ],
      },
    },
    targetImageId: "img-1",
    outputPath: "/tmp/out.png",
    referenceImageIds: ["img-2"],
  });

  assert.equal(ok, true);
  assert.equal(harness.session.communication.tool, "magic_select");
});

test("background review apply re-arms magic select when only the proposal target region preserves the candidate id", async () => {
  const harness = buildBackgroundReviewApplyHarness({ communicationTool: "marker" });

  const ok = await harness.applyAcceptedDesignReviewOutputToSessionRecord(harness.record, {
    phase: "succeeded",
    sessionKey: "tab:tab-a",
    requestId: "review-1",
    proposal: {
      proposalId: "proposal-1",
      label: "Shift hero right",
      actionType: "move_subject",
      targetRegion: {
        regionCandidateId: "magic-select-1",
      },
    },
    request: {
      requestId: "review-1",
      sessionId: "tab-a",
      primaryImageId: "img-1",
      reviewTool: "marker",
      visibleCanvasContext: {
        images: [
          { id: "img-1", path: "/tmp/source.png" },
        ],
      },
    },
    targetImageId: "img-1",
    outputPath: "/tmp/out.png",
    referenceImageIds: [],
  });

  assert.equal(ok, true);
  assert.equal(harness.session.communication.tool, "magic_select");
});

test("review apply detail falls back to request-visible reference images and parses ISO timestamps", () => {
  const state = {
    activeTabId: "tab-a",
    runDir: "/runs/a",
    communication: {
      proposalTray: {
        requestId: "review-1",
      },
    },
  };
  const cloneToolRuntimeValue = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
  const asRecord = instantiateFunction("asRecord");
  const readFirstString = instantiateFunction("readFirstString");
  const readFirstNumber = instantiateFunction("readFirstNumber");
  const uniqueStringList = instantiateFunction("uniqueStringList", { readFirstString, Set });
  const createFreshDesignReviewApplyState = instantiateFunction("createFreshDesignReviewApplyState");
  const cloneDesignReviewApplyState = instantiateFunction("cloneDesignReviewApplyState", {
    asRecord,
    readFirstString,
    readFirstNumber,
    uniqueStringList,
    cloneToolRuntimeValue,
    createFreshDesignReviewApplyState,
  });
  const currentDesignReviewApplySessionKey = instantiateFunction("currentDesignReviewApplySessionKey", {
    readFirstString,
    state,
  });
  const normalizeDesignReviewApplyEventDetail = instantiateFunction("normalizeDesignReviewApplyEventDetail", {
    asRecord,
    cloneToolRuntimeValue,
    cloneDesignReviewApplyState,
    readFirstString,
    readFirstNumber,
    uniqueStringList,
    currentDesignReviewApplySessionKey,
    state,
  });

  const normalized = normalizeDesignReviewApplyEventDetail({
    requestId: "review-1",
    targetImageId: "img-target",
    startedAt: "2026-03-09T18:15:20.000Z",
    completedAt: "2026-03-09T18:15:24.000Z",
    request: {
      requestId: "review-1",
      primaryImageId: "img-target",
      selectedImageIds: ["img-target", "img-ref-a"],
      visibleCanvasContext: {
        images: [
          { id: "img-target", path: "/tmp/target.png" },
          { id: "img-ref-a", path: "/tmp/ref-a.png" },
          { id: "img-ref-b", path: "/tmp/ref-b.png" },
        ],
      },
    },
  });

  assert.deepEqual(normalized.referenceImageIds, ["img-ref-a", "img-ref-b"]);
  assert.equal(normalized.startedAt, Date.parse("2026-03-09T18:15:20.000Z"));
  assert.equal(normalized.completedAt, Date.parse("2026-03-09T18:15:24.000Z"));
});

test("entering multi-canvas normalizes the edit tool back to pan", () => {
  const state = {
    canvasMode: "single",
    activeId: "img-1",
    multiRects: new Map([["img-1", { x: 0, y: 0, w: 10, h: 10 }]]),
    multiView: {
      scale: 2,
      offsetX: 40,
      offsetY: 28,
    },
    pointer: {
      active: true,
    },
    selection: { points: [] },
    lassoDraft: [{ x: 1, y: 1 }],
    annotateDraft: { imageId: "img-1" },
    annotateBox: { x0: 0, y0: 0, x1: 1, y1: 1 },
    circleDraft: { imageId: "img-1" },
  };
  const uiDirtyCalls = [];
  const recordCalls = [];
  const selectedIds = [];
  const toolCalls = [];
  let renderCalls = 0;
  const setCanvasMode = instantiateFunction("setCanvasMode", {
    state,
    markActiveTabUiDirty: (payload) => {
      uiDirtyCalls.push(payload);
    },
    recordUserEvent: (name, payload) => {
      recordCalls.push({ name, payload });
    },
    selectedCount: () => selectedIds.length,
    setSelectedIds: (next) => {
      selectedIds.splice(0, selectedIds.length, ...next);
    },
    invalidateActiveTabPreview: () => {},
    hideAnnotatePanel: () => {},
    hideMarkPanel: () => {},
    setTool: (tool) => {
      toolCalls.push(tool);
      state.tool = tool;
    },
    chooseSpawnNodes: () => {},
    renderFilmstrip: () => {},
    renderSelectionMeta: () => {},
    scheduleVisualPromptWrite: () => {},
    motherIdleSyncFromInteraction: () => {},
    effectsRuntime: null,
    document: { hidden: false },
    requestRender: () => {
      renderCalls += 1;
    },
  });

  setCanvasMode("multi");

  assert.equal(state.canvasMode, "multi");
  assert.deepEqual(toolCalls, ["pan"]);
  assert.equal(state.tool, "pan");
  assert.deepEqual(selectedIds, ["img-1"]);
  assert.equal(renderCalls, 1);
  assert.deepEqual(uiDirtyCalls, [{ spawn: true, quickActions: true }]);
  assert.deepEqual(recordCalls, [
    { name: "canvas_mode_set", payload: { prev: "single", next: "multi" } },
  ]);
});

test("canvas runtime binds the unified review-apply lifecycle event", () => {
  assert.match(app, /window\.addEventListener\(DESIGN_REVIEW_APPLY_EVENT,\s*\(event\)\s*=>\s*\{/);
  assert.match(app, /const phase = readFirstString\(detail\?\.phase,\s*detail\?\.status\)\.toLowerCase\(\);/);
  assert.match(app, /if \(phase === "started"[\s\S]*markDesignReviewApplyRunning\(detail\);/);
  assert.match(app, /if \(phase === "succeeded"[\s\S]*void applyAcceptedDesignReviewOutput\(detail\);/);
  assert.match(app, /if \(phase === "failed"[\s\S]*handleDesignReviewApplyFailure\(detail\);/);
  assert.match(app, /bindDesignReviewApplyRuntimeBridge\(\);/);
});

test("review apply success animates the active images and dismisses the tray after replacement", () => {
  assert.match(app, /function shouldAnimateDesignReviewApplyShimmer\(\) \{/);
  assert.match(app, /function renderDesignReviewApplyShimmer\(octx\) \{/);
  assert.match(rendererSource, /renderDesignReviewApplyShimmer\(octx\);/);
  assert.match(app, /dismissCommunicationProposalTrayAfterReviewApply\(\{\s*requestId: normalized\.requestId,/s);
  assert.match(app, /tray\.classList\.add\("is-dismissing"\);/);
  assert.match(app, /source: "review_apply_success"/);
});

test("communication tray host preserves runtime-owned review slots while still positioning the tray", () => {
  const replaceCalls = [];
  const trayEl = {
    classList: createClassList(["is-design-review-runtime"]),
    style: {},
    dataset: {},
    offsetWidth: 120,
    offsetHeight: 80,
  };
  const listEl = {
    replaceChildren(...args) {
      replaceCalls.push(args);
    },
  };
  const communicationTrayAnchorPlacement = instantiateFunction("communicationTrayAnchorPlacement");
  const state = {
    communication: {
      proposalTray: {
        anchorLockCss: null,
        anchorLockSignature: "",
      },
    },
  };
  const positionCommunicationProposalTrayElement = instantiateFunction("positionCommunicationProposalTrayElement", {
    state,
    els: {
      canvasWrap: { clientWidth: 500, clientHeight: 400 },
    },
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    communicationTrayAnchorPlacement,
    clearCommunicationProposalTrayAnchorLock: (tray = null) => {
      if (!tray || typeof tray !== "object") return tray || null;
      tray.anchorLockCss = null;
      tray.anchorLockSignature = "";
      return tray;
    },
    communicationProposalTrayAnchorLockSignature: () => "shell:500:400",
    communicationTrayAnchorPinnedToTitlebar: () => false,
    designReviewButtonTrayAnchor: () => null,
    communicationAnchorCanvasCss: () => ({ x: 50, y: 60 }),
  });
  const renderCommunicationProposalTray = instantiateFunction("renderCommunicationProposalTray", {
    els: {
      communicationProposalTray: trayEl,
      communicationProposalSlotList: listEl,
      canvasWrap: { clientWidth: 500, clientHeight: 400 },
    },
    buildCommunicationProposalTraySnapshot: () => ({
      visible: true,
      source: "design_review_bootstrap_state",
      anchor: { x: 50, y: 60 },
      slots: [
        { index: 0, status: "ready", label: "Proposal 1", title: "T1", copy: "C1" },
      ],
    }),
    communicationAnchorCanvasCss: () => ({ x: 50, y: 60 }),
    communicationProposalSlotIsPending: () => false,
    requestAnimationFrame: (callback) => callback(),
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    positionCommunicationProposalTrayElement,
  });

  renderCommunicationProposalTray();

  assert.equal(replaceCalls.length, 0);
  assert.equal(trayEl.style.left, "68px");
  assert.equal(trayEl.style.top, "12px");
});

test("communication tray host still rebuilds shell slots when the tray is no longer in review runtime mode", () => {
  const replaceCalls = [];
  const trayEl = {
    classList: createClassList(["is-design-review-runtime"]),
    style: {},
    dataset: {},
    offsetWidth: 120,
    offsetHeight: 80,
  };
  const listEl = {
    replaceChildren(...args) {
      replaceCalls.push(args);
    },
  };
  const communicationTrayAnchorPlacement = instantiateFunction("communicationTrayAnchorPlacement");
  const state = {
    communication: {
      proposalTray: {
        anchorLockCss: null,
        anchorLockSignature: "",
      },
    },
  };
  const positionCommunicationProposalTrayElement = instantiateFunction("positionCommunicationProposalTrayElement", {
    state,
    els: {
      canvasWrap: { clientWidth: 500, clientHeight: 400 },
    },
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    communicationTrayAnchorPlacement,
    clearCommunicationProposalTrayAnchorLock: (tray = null) => {
      if (!tray || typeof tray !== "object") return tray || null;
      tray.anchorLockCss = null;
      tray.anchorLockSignature = "";
      return tray;
    },
    communicationProposalTrayAnchorLockSignature: () => "shell:500:400",
    communicationTrayAnchorPinnedToTitlebar: () => false,
    designReviewButtonTrayAnchor: () => null,
    communicationAnchorCanvasCss: () => ({ x: 50, y: 60 }),
  });
  const renderCommunicationProposalTray = instantiateFunction("renderCommunicationProposalTray", {
    els: {
      communicationProposalTray: trayEl,
      communicationProposalSlotList: listEl,
      canvasWrap: { clientWidth: 500, clientHeight: 400 },
    },
    buildCommunicationProposalTraySnapshot: () => ({
      visible: true,
      source: "shell",
      anchor: { x: 50, y: 60 },
      slots: [
        { index: 0, status: "planning", label: "Proposal 1", title: "T1", copy: "C1" },
        { index: 1, status: "hidden", label: "Proposal 2", title: "T2", copy: "C2" },
        { index: 2, status: "failed", label: "Proposal 3", title: "T3", copy: "C3" },
      ],
    }),
    communicationAnchorCanvasCss: () => ({ x: 50, y: 60 }),
    communicationProposalSlotIsPending: (status) => status === "planning",
    requestAnimationFrame: (callback) => callback(),
    clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
    positionCommunicationProposalTrayElement,
    document: {
      createDocumentFragment() {
        return {
          children: [],
          append(node) {
            this.children.push(node);
          },
        };
      },
      createElement() {
        return {
          className: "",
          dataset: {},
          attributes: {},
          textContent: "",
          setAttribute(name, value) {
            this.attributes[name] = value;
          },
          append(...nodes) {
            this.children = (this.children || []).concat(nodes);
          },
        };
      },
    },
  });

  renderCommunicationProposalTray();

  assert.equal(replaceCalls.length, 1);
  assert.equal(replaceCalls[0].length, 1);
  assert.equal(replaceCalls[0][0].children.length, 2);
  assert.equal(trayEl.style.left, "68px");
  assert.equal(trayEl.style.top, "12px");
});
