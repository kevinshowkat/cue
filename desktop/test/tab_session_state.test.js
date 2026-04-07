import { test } from "node:test";
import assert from "node:assert/strict";

import { createCanvasAppTabSessionStateAdapter } from "../src/app/tab_session_state.js";

function createRegistry(entries = []) {
  return {
    list() {
      return entries.slice();
    },
  };
}

function createBaseHarness(overrides = {}) {
  let fallbackLineOffset = overrides.fallbackLineOffset ?? 9;
  let sessionToolRegistry = overrides.sessionToolRegistry ?? createRegistry([{ toolId: "tool-a", label: "Tool A" }]);
  const calls = [];
  const state = {
    activeTabId: "tab-a",
    desktopSessionBridgeActive: true,
    runDir: "/runs/a",
    eventsPath: "/runs/a/events.jsonl",
    eventsByteOffset: 4,
    eventsTail: "tail-a",
    eventsDecoder: new TextDecoder("utf-8"),
    fallbackToFullRead: true,
    images: [{ id: "img-1", path: "/runs/a/img-1.png" }],
    imagesById: new Map([["img-1", { id: "img-1", path: "/runs/a/img-1.png" }]]),
    imagePaletteSeed: 3,
    activeId: "img-1",
    selectedIds: ["img-1"],
    timelineNodes: [{ nodeId: "node-1", seq: 1 }],
    timelineNodesById: new Map([["node-1", { nodeId: "node-1", seq: 1 }]]),
    timelineHeadNodeId: "node-1",
    timelineLatestNodeId: "node-1",
    timelineNextSeq: 2,
    timelineOpen: true,
    canvasMode: "single",
    freeformRects: new Map([["img-1", { x: 1, y: 2 }]]),
    freeformZOrder: ["img-1"],
    multiRects: new Map([["img-1", { x: 3, y: 4 }]]),
    view: { scale: 2, offsetX: 5, offsetY: 6 },
    multiView: { scale: 1.5, offsetX: 7, offsetY: 8 },
    communication: { proposalTray: { visible: false } },
    designReviewApply: { status: "idle" },
    selection: { kind: "image" },
    lassoDraft: [{ x: 1, y: 2 }],
    annotateDraft: { mode: "box" },
    annotateBox: { x: 10, y: 11 },
    promptGenerateDraft: { prompt: "prompt", model: "gpt" },
    promptGenerateDraftAnchor: {
      anchorCss: { top: 1, left: 2 },
      anchorWorldCss: { top: 3, left: 4 },
    },
    customToolDraft: { name: "Custom", description: "Desc" },
    sessionTools: [{ toolId: "tool-a", label: "Tool A" }],
    activeCustomToolId: "tool-a",
    lastToolInvocation: { toolId: "tool-a" },
    toolInvocationSeq: 2,
    circleDraft: { active: true },
    circlesByImageId: new Map([["img-1", [{ circleId: "c-1" }]]]),
    activeCircle: { circleId: "c-1" },
    tripletRuleAnnotations: new Map([["img-1", { note: "keep" }]]),
    tripletOddOneOutId: "img-1",
    tabPreviewState: { version: 3, valid: true },
    tabPreviewDirty: false,
    pendingTabSwitchPreview: { tabId: "tab-b" },
    motherResultDetailsOpenId: "mother-1",
    wheelMenu: {
      open: true,
      hideTimer: 42,
      anchorCss: { left: 1 },
      anchorWorld: { top: 2 },
    },
    userEvents: [{ kind: "click" }],
    userTelemetryEvents: [{ kind: "telemetry" }],
    userEventSeq: 7,
    mother: { running: false },
    motherIdle: { commitMutationInFlight: false },
    intent: { phase: "idle" },
    intentAmbient: { enabled: true },
    alwaysOnVision: { enabled: true, rtState: "connecting" },
    lastRecreatePrompt: "recreate",
    lastAction: "action",
    lastTipText: "Tip text",
    lastDirectorText: "Director",
    lastDirectorMeta: { label: "Meta" },
    lastCostLatency: { cost: 1 },
    sessionApiCalls: 5,
    topMetrics: { tokens: 10 },
    lastStatusText: "Engine: connected",
    lastStatusError: false,
    juggernautShell: {
      singleImageRail: {
        recentSuccessfulJobs: [{ jobId: "job-1" }],
      },
      lastToolKey: "tool-a",
    },
    imageMenuTargetId: "img-1",
    promptGenerateHoverCss: { top: 1 },
    effectTokenDrag: { dragging: true },
    motherOverlayUiHits: [1],
    activeImageTransformUiHits: [2],
    motherRolePreviewHoverImageId: "img-1",
    ...overrides.state,
  };

  const tabs = new Map(
    (overrides.tabs || [
      {
        tabId: "tab-a",
        label: "Run A",
        labelManual: true,
        forkedFromTabId: "tab-root",
        reviewFlowState: "ready",
        runDir: "/runs/a",
        busy: false,
        thumbnailPath: "/thumb-old.png",
        tabUiMeta: {
          filmstripVersion: 0,
          timelineVersion: 0,
          spawnVersion: 0,
          quickActionsVersion: 0,
          customToolDockVersion: 0,
          thumbnailPath: "/thumb-old.png",
        },
        session: { tabUiMeta: { thumbnailPath: "/thumb-session-old.png" } },
      },
    ]).map((record) => [record.tabId, record])
  );

  const adapter = createCanvasAppTabSessionStateAdapter({
    state,
    settings: {
      alwaysOnVision: false,
      ...overrides.settings,
    },
    tabbedSessions: {
      getTab(tabId) {
        return tabs.get(tabId) || null;
      },
      upsertTab(record, options) {
        calls.push({ type: "upsertTab", record, options });
        tabs.set(record.tabId, record);
        return record;
      },
    },
    createFreshTabSession(seed = {}) {
      return { ...seed };
    },
    currentSessionTabReviewFlowState() {
      return overrides.reviewFlowState || "planning";
    },
    createFreshCommunicationState() {
      return { fresh: true };
    },
    cloneDesignReviewApplyState(value) {
      return value && typeof value === "object" ? { ...value } : { status: "idle" };
    },
    cloneToolRuntimeValue(value) {
      return value && typeof value === "object" ? { ...value } : null;
    },
    createInSessionToolRegistry() {
      return createRegistry([{ toolId: "fallback", label: "Fallback" }]);
    },
    normalizeTabPreviewState(value) {
      return value && typeof value === "object" ? { ...value } : { version: 0, valid: false };
    },
    createTabMotherState() {
      return { running: false };
    },
    createTabMotherIdleState() {
      return { commitMutationInFlight: false };
    },
    createTabIntentState() {
      return { phase: "idle" };
    },
    createTabIntentAmbientState() {
      return { enabled: false };
    },
    createTabAlwaysOnVisionState() {
      return { enabled: false, rtState: "off" };
    },
    createTabTopMetricsState() {
      return { tokens: 0 };
    },
    buildActiveTabUiMeta() {
      return {
        filmstripVersion: 1,
        timelineVersion: 2,
        spawnVersion: 3,
        quickActionsVersion: 4,
        customToolDockVersion: 5,
        thumbnailPath: "/thumb-next.png",
      };
    },
    normalizeTabUiMeta(meta = null) {
      return meta && typeof meta === "object"
        ? { ...meta }
        : {
            filmstripVersion: 0,
            timelineVersion: 0,
            spawnVersion: 0,
            quickActionsVersion: 0,
            customToolDockVersion: 0,
            thumbnailPath: null,
          };
    },
    applyTabUiMetaToState(meta) {
      calls.push({ type: "applyTabUiMetaToState", meta });
    },
    tabUiMetaSignature(meta = null) {
      return JSON.stringify(meta || null);
    },
    sessionTabAutomaticLabelForRecord(record, fallback) {
      void fallback;
      return record?.automaticLabel || "Auto Label";
    },
    normalizeSessionTabTitleInput(value, max = 40) {
      return String(value || "").trim().slice(0, max);
    },
    normalizeSessionTabReviewFlowState(value = "") {
      const normalized = String(value || "").trim().toLowerCase();
      return ["planning", "ready", "applying", "failed"].includes(normalized) ? normalized : "";
    },
    currentTabSwitchBlockReason() {
      return overrides.blockReason || null;
    },
    getFallbackLineOffset() {
      return fallbackLineOffset;
    },
    setFallbackLineOffset(nextOffset) {
      fallbackLineOffset = nextOffset;
    },
    getSessionToolRegistry() {
      return sessionToolRegistry;
    },
    setSessionToolRegistry(nextRegistry) {
      sessionToolRegistry = nextRegistry;
    },
    sessionTabTitleMaxLength: 40,
    defaultUntitledTabTitle: "Untitled Canvas",
    defaultTip: "Default tip",
    now() {
      return 12345;
    },
    ...overrides.adapter,
  });

  return {
    adapter,
    state,
    tabs,
    calls,
    getFallbackLineOffsetValue() {
      return fallbackLineOffset;
    },
    getSessionToolRegistryValue() {
      return sessionToolRegistry;
    },
  };
}

test("tab session state captures the active runtime into a tab session snapshot", () => {
  const { adapter, state } = createBaseHarness();

  const session = adapter.captureActiveTabSession({ tabUiMeta: { thumbnailPath: "/thumb-existing.png" } });

  assert.equal(session.label, "Run A");
  assert.equal(session.labelManual, true);
  assert.equal(session.forkedFromTabId, "tab-root");
  assert.equal(session.reviewFlowState, "planning");
  assert.equal(session.runDir, "/runs/a");
  assert.equal(session.eventsPath, "/runs/a/events.jsonl");
  assert.equal(session.fallbackLineOffset, 9);
  assert.notStrictEqual(session.selectedIds, state.selectedIds);
  assert.deepEqual(session.sessionTools, [{ toolId: "tool-a", label: "Tool A" }]);
  assert.equal(session.toolRegistry.list()[0].toolId, "tool-a");
  assert.deepEqual(session.topMetrics, { tokens: 10 });
  assert.equal(session.lastStatusText, "Engine: connected");
  assert.equal(session.lastTipText, "Tip text");
  assert.equal(session.tabUiMeta.thumbnailPath, "/thumb-next.png");
});

test("tab session state binding restores runtime state and resets per-tab transient UI", () => {
  const registry = createRegistry([{ toolId: "tool-b", label: "Tool B" }]);
  const { adapter, state, calls, getFallbackLineOffsetValue, getSessionToolRegistryValue } = createBaseHarness();

  adapter.bindTabSessionToState({
    runDir: "/runs/b",
    eventsPath: "/runs/b/events.jsonl",
    eventsByteOffset: 8,
    eventsTail: "tail-b",
    eventsDecoder: new TextDecoder("utf-8"),
    fallbackToFullRead: true,
    fallbackLineOffset: 21,
    images: [{ id: "img-b", path: "/runs/b/img-b.png" }],
    imagesById: new Map([["img-b", { id: "img-b", path: "/runs/b/img-b.png" }]]),
    activeId: "img-b",
    selectedIds: ["img-b"],
    freeformRects: new Map([["img-b", { x: 1, y: 1 }]]),
    freeformZOrder: ["img-b"],
    multiRects: new Map([["img-b", { x: 2, y: 2 }]]),
    communication: { proposalTray: { visible: false } },
    designReviewApply: { status: "idle" },
    promptGenerateDraft: { prompt: "updated", model: "gpt-5" },
    customToolDraft: { name: "Custom B", description: "Desc B" },
    toolRegistry: registry,
    sessionTools: [{ toolId: "tool-b", label: "Tool B" }],
    tabPreviewState: { version: 9, valid: false },
    intentAmbient: { enabled: true },
    alwaysOnVision: { enabled: true, rtState: "connecting" },
    juggernautShellRecentSuccessfulJobs: [{ jobId: "job-2" }],
    juggernautShellLastToolKey: "tool-b",
    tabUiMeta: {
      filmstripVersion: 5,
      timelineVersion: 6,
      spawnVersion: 7,
      quickActionsVersion: 8,
      customToolDockVersion: 9,
      thumbnailPath: "/thumb-bind.png",
    },
    lastStatusText: "Engine: failed",
    lastStatusError: true,
  });

  assert.equal(state.desktopSessionBridgeActive, false);
  assert.equal(state.runDir, "/runs/b");
  assert.equal(state.eventsPath, "/runs/b/events.jsonl");
  assert.equal(state.activeId, "img-b");
  assert.deepEqual(state.selectedIds, ["img-b"]);
  assert.deepEqual(state.sessionTools, [{ toolId: "tool-b", label: "Tool B" }]);
  assert.strictEqual(getSessionToolRegistryValue(), registry);
  assert.equal(getFallbackLineOffsetValue(), 21);
  assert.equal(state.tabPreviewDirty, true);
  assert.equal(state.pendingTabSwitchPreview, null);
  assert.equal(state.intentAmbient.enabled, false);
  assert.equal(state.alwaysOnVision.enabled, false);
  assert.equal(state.alwaysOnVision.rtState, "off");
  assert.deepEqual(state.juggernautShell.singleImageRail.recentSuccessfulJobs, [{ jobId: "job-2" }]);
  assert.equal(state.juggernautShell.lastToolKey, "tool-b");
  assert.equal(state.lastStatusText, "Engine: failed");
  assert.equal(state.lastStatusError, true);
  assert.equal(state.imageMenuTargetId, null);
  assert.equal(state.promptGenerateHoverCss, null);
  assert.equal(state.effectTokenDrag, null);
  assert.deepEqual(state.motherOverlayUiHits, []);
  assert.deepEqual(state.activeImageTransformUiHits, []);
  assert.equal(state.motherRolePreviewHoverImageId, null);
  assert.deepEqual(calls.find((entry) => entry.type === "applyTabUiMetaToState"), {
    type: "applyTabUiMetaToState",
    meta: {
      filmstripVersion: 5,
      timelineVersion: 6,
      spawnVersion: 7,
      quickActionsVersion: 8,
      customToolDockVersion: 9,
      thumbnailPath: "/thumb-bind.png",
    },
  });
});

test("tab session state sync updates the active record and republishes changed tab metadata", () => {
  const { adapter, tabs, calls } = createBaseHarness({
    blockReason: "engine_busy",
    tabs: [
      {
        tabId: "tab-a",
        label: "Old Label",
        labelManual: false,
        automaticLabel: "Auto Label",
        reviewFlowState: "ready",
        runDir: "/runs/old",
        busy: false,
        thumbnailPath: "/thumb-old.png",
        tabUiMeta: {
          filmstripVersion: 0,
          timelineVersion: 0,
          spawnVersion: 0,
          quickActionsVersion: 0,
          customToolDockVersion: 0,
          thumbnailPath: "/thumb-old.png",
        },
        session: { tabUiMeta: { thumbnailPath: "/thumb-session-old.png" } },
      },
    ],
  });

  const originalRecord = tabs.get("tab-a");
  const result = adapter.syncActiveTabRecord({ capture: true, publish: true });
  const record = tabs.get("tab-a");

  assert.strictEqual(result, originalRecord);
  assert.equal(record.runDir, "/runs/a");
  assert.equal(record.reviewFlowState, "planning");
  assert.equal(record.label, "Auto Label");
  assert.equal(record.busy, true);
  assert.equal(record.thumbnailPath, "/thumb-next.png");
  assert.equal(record.updatedAt, 12345);
  assert.equal(record.session.label, "Auto Label");
  assert.equal(record.session.labelManual, false);
  assert.equal(record.session.reviewFlowState, "planning");
  assert.equal(record.session.tabUiMeta.thumbnailPath, "/thumb-next.png");
  assert.deepEqual(calls.find((entry) => entry.type === "upsertTab"), {
    type: "upsertTab",
    record,
    options: { activate: false },
  });
});
