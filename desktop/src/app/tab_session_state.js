export function createCanvasAppTabSessionStateAdapter({
  state,
  settings,
  tabbedSessions,
  createFreshTabSession,
  currentSessionTabReviewFlowState,
  createFreshCommunicationState,
  cloneDesignReviewApplyState,
  cloneToolRuntimeValue,
  createInSessionToolRegistry,
  normalizeTabPreviewState,
  createTabMotherState,
  createTabMotherIdleState,
  createTabIntentState,
  createTabIntentAmbientState,
  createTabAlwaysOnVisionState,
  createTabTopMetricsState,
  buildActiveTabUiMeta,
  normalizeTabUiMeta,
  applyTabUiMetaToState,
  tabUiMetaSignature,
  sessionTabAutomaticLabelForRecord,
  normalizeSessionTabTitleInput,
  normalizeSessionTabReviewFlowState,
  currentTabSwitchBlockReason,
  getFallbackLineOffset = () => 0,
  setFallbackLineOffset = () => {},
  getSessionToolRegistry = () => null,
  setSessionToolRegistry = () => {},
  sessionTabTitleMaxLength = 40,
  defaultUntitledTabTitle = "Untitled Canvas",
  defaultTip = "",
  TextDecoderCtor = globalThis.TextDecoder,
  now = () => Date.now(),
} = {}) {
  const TextDecoderImpl = typeof TextDecoderCtor === "function" ? TextDecoderCtor : globalThis.TextDecoder;

  function createRuntimeTextDecoder() {
    return typeof TextDecoderImpl === "function" ? new TextDecoderImpl("utf-8") : null;
  }

  function captureActiveTabSession(session = null) {
    const next = session && typeof session === "object" ? session : createFreshTabSession();
    next.label = state.activeTabId ? tabbedSessions.getTab(state.activeTabId)?.label || next.label || null : next.label || null;
    next.labelManual = Boolean(state.activeTabId ? tabbedSessions.getTab(state.activeTabId)?.labelManual : next.labelManual);
    next.forkedFromTabId =
      String(state.activeTabId ? tabbedSessions.getTab(state.activeTabId)?.forkedFromTabId || next.forkedFromTabId || "" : next.forkedFromTabId || "").trim() ||
      null;
    next.reviewFlowState = currentSessionTabReviewFlowState();
    next.runDir = state.runDir || null;
    next.eventsPath = state.eventsPath || null;
    next.eventsByteOffset = Math.max(0, Number(state.eventsByteOffset) || 0);
    next.eventsTail = String(state.eventsTail || "");
    next.eventsDecoder =
      TextDecoderImpl && state.eventsDecoder instanceof TextDecoderImpl ? state.eventsDecoder : createRuntimeTextDecoder();
    next.fallbackToFullRead = Boolean(state.fallbackToFullRead);
    next.fallbackLineOffset = Math.max(0, Number(getFallbackLineOffset()) || 0);
    next.images = Array.isArray(state.images) ? state.images : [];
    next.imagesById = state.imagesById instanceof Map ? state.imagesById : new Map();
    next.imagePaletteSeed = Math.max(0, Number(state.imagePaletteSeed) || 0);
    next.activeId = state.activeId ? String(state.activeId) : null;
    next.selectedIds = Array.isArray(state.selectedIds) ? state.selectedIds.slice() : [];
    next.timelineNodes = Array.isArray(state.timelineNodes) ? state.timelineNodes : [];
    next.timelineNodesById = state.timelineNodesById instanceof Map ? state.timelineNodesById : new Map();
    next.timelineHeadNodeId = state.timelineHeadNodeId ? String(state.timelineHeadNodeId) : null;
    next.timelineLatestNodeId = state.timelineLatestNodeId ? String(state.timelineLatestNodeId) : null;
    next.timelineNextSeq = Math.max(1, Number(state.timelineNextSeq) || 1);
    next.timelineOpen = state.timelineOpen !== false;
    next.canvasMode = String(state.canvasMode || "multi");
    next.freeformRects = state.freeformRects instanceof Map ? state.freeformRects : new Map();
    next.freeformZOrder = Array.isArray(state.freeformZOrder) ? state.freeformZOrder.slice() : [];
    next.multiRects = state.multiRects instanceof Map ? state.multiRects : new Map();
    next.view = state.view && typeof state.view === "object" ? { ...state.view } : { scale: 1, offsetX: 0, offsetY: 0 };
    next.multiView =
      state.multiView && typeof state.multiView === "object"
        ? { ...state.multiView }
        : { scale: 1, offsetX: 0, offsetY: 0 };
    next.communication =
      state.communication && typeof state.communication === "object" ? state.communication : createFreshCommunicationState();
    next.designReviewApply = cloneDesignReviewApplyState(state.designReviewApply);
    next.selection = state.selection && typeof state.selection === "object" ? state.selection : null;
    next.lassoDraft = Array.isArray(state.lassoDraft) ? state.lassoDraft.slice() : [];
    next.annotateDraft = state.annotateDraft && typeof state.annotateDraft === "object" ? state.annotateDraft : null;
    next.annotateBox = state.annotateBox && typeof state.annotateBox === "object" ? state.annotateBox : null;
    next.promptGenerateDraft =
      state.promptGenerateDraft && typeof state.promptGenerateDraft === "object"
        ? { ...state.promptGenerateDraft }
        : { prompt: "", model: "" };
    next.promptGenerateDraftAnchor =
      state.promptGenerateDraftAnchor && typeof state.promptGenerateDraftAnchor === "object"
        ? {
            anchorCss: state.promptGenerateDraftAnchor.anchorCss ? { ...state.promptGenerateDraftAnchor.anchorCss } : null,
            anchorWorldCss: state.promptGenerateDraftAnchor.anchorWorldCss
              ? { ...state.promptGenerateDraftAnchor.anchorWorldCss }
              : null,
          }
        : null;
    next.customToolDraft =
      state.customToolDraft && typeof state.customToolDraft === "object"
        ? { ...state.customToolDraft }
        : { name: "", description: "" };
    const sessionToolRegistry = getSessionToolRegistry();
    next.toolRegistry =
      sessionToolRegistry && typeof sessionToolRegistry.list === "function"
        ? sessionToolRegistry
        : createInSessionToolRegistry();
    next.sessionTools = next.toolRegistry.list();
    next.activeCustomToolId = state.activeCustomToolId ? String(state.activeCustomToolId) : null;
    next.lastToolInvocation = state.lastToolInvocation ? cloneToolRuntimeValue(state.lastToolInvocation) : null;
    next.toolInvocationSeq = Math.max(1, Number(state.toolInvocationSeq) || 1);
    next.circleDraft = state.circleDraft && typeof state.circleDraft === "object" ? state.circleDraft : null;
    next.circlesByImageId = state.circlesByImageId instanceof Map ? state.circlesByImageId : new Map();
    next.activeCircle = state.activeCircle && typeof state.activeCircle === "object" ? state.activeCircle : null;
    next.tripletRuleAnnotations =
      state.tripletRuleAnnotations instanceof Map ? state.tripletRuleAnnotations : new Map();
    next.tripletOddOneOutId = state.tripletOddOneOutId ? String(state.tripletOddOneOutId) : null;
    next.tabPreviewState = normalizeTabPreviewState(state.tabPreviewState);
    next.motherResultDetailsOpenId = state.motherResultDetailsOpenId ? String(state.motherResultDetailsOpenId) : null;
    next.wheelMenu = {
      open: false,
      hideTimer: null,
      anchorCss: state.wheelMenu?.anchorCss ? { ...state.wheelMenu.anchorCss } : null,
      anchorWorld: state.wheelMenu?.anchorWorld ? { ...state.wheelMenu.anchorWorld } : null,
    };
    next.userEvents = Array.isArray(state.userEvents) ? state.userEvents : [];
    next.userTelemetryEvents = Array.isArray(state.userTelemetryEvents) ? state.userTelemetryEvents : [];
    next.userEventSeq = Math.max(0, Number(state.userEventSeq) || 0);
    next.mother = state.mother && typeof state.mother === "object" ? state.mother : createTabMotherState();
    next.motherIdle =
      state.motherIdle && typeof state.motherIdle === "object" ? state.motherIdle : createTabMotherIdleState();
    next.intent = state.intent && typeof state.intent === "object" ? state.intent : createTabIntentState();
    next.intentAmbient =
      state.intentAmbient && typeof state.intentAmbient === "object"
        ? state.intentAmbient
        : createTabIntentAmbientState();
    next.alwaysOnVision =
      state.alwaysOnVision && typeof state.alwaysOnVision === "object"
        ? state.alwaysOnVision
        : createTabAlwaysOnVisionState();
    next.lastRecreatePrompt = state.lastRecreatePrompt ? String(state.lastRecreatePrompt) : null;
    next.lastAction = state.lastAction ? String(state.lastAction) : null;
    next.lastTipText = typeof state.lastTipText === "string" ? state.lastTipText : defaultTip;
    next.lastDirectorText = state.lastDirectorText ? String(state.lastDirectorText) : null;
    next.lastDirectorMeta = state.lastDirectorMeta && typeof state.lastDirectorMeta === "object" ? state.lastDirectorMeta : null;
    next.lastCostLatency = state.lastCostLatency && typeof state.lastCostLatency === "object" ? state.lastCostLatency : null;
    next.sessionApiCalls = Math.max(0, Number(state.sessionApiCalls) || 0);
    next.topMetrics = state.topMetrics && typeof state.topMetrics === "object" ? state.topMetrics : createTabTopMetricsState();
    next.lastStatusText = String(state.lastStatusText || "Engine: idle");
    next.lastStatusError = Boolean(state.lastStatusError);
    next.juggernautShellRecentSuccessfulJobs = Array.isArray(state.juggernautShell?.singleImageRail?.recentSuccessfulJobs)
      ? state.juggernautShell.singleImageRail.recentSuccessfulJobs.slice()
      : [];
    next.juggernautShellLastToolKey = String(state.juggernautShell?.lastToolKey || "");
    next.tabUiMeta = buildActiveTabUiMeta(next.tabUiMeta);
    return next;
  }

  function bindTabSessionToState(session = null) {
    const current = session && typeof session === "object" ? session : createFreshTabSession();
    current.label = typeof current.label === "string" ? current.label : null;
    current.labelManual = Boolean(current.labelManual);
    current.reviewFlowState = normalizeSessionTabReviewFlowState(current.reviewFlowState);
    state.desktopSessionBridgeActive = false;
    state.runDir = current.runDir || null;
    state.eventsPath = current.eventsPath || null;
    state.eventsByteOffset = Math.max(0, Number(current.eventsByteOffset) || 0);
    state.eventsTail = String(current.eventsTail || "");
    state.eventsDecoder =
      TextDecoderImpl && current.eventsDecoder instanceof TextDecoderImpl ? current.eventsDecoder : createRuntimeTextDecoder();
    state.fallbackToFullRead = Boolean(current.fallbackToFullRead);
    setFallbackLineOffset(Math.max(0, Number(current.fallbackLineOffset) || 0));
    state.images = Array.isArray(current.images) ? current.images : [];
    state.imagesById = current.imagesById instanceof Map ? current.imagesById : new Map();
    state.imagePaletteSeed = Math.max(0, Number(current.imagePaletteSeed) || 0);
    state.activeId = current.activeId ? String(current.activeId) : null;
    state.selectedIds = Array.isArray(current.selectedIds) ? current.selectedIds.slice() : [];
    state.timelineNodes = Array.isArray(current.timelineNodes) ? current.timelineNodes : [];
    state.timelineNodesById = current.timelineNodesById instanceof Map ? current.timelineNodesById : new Map();
    state.timelineHeadNodeId = current.timelineHeadNodeId ? String(current.timelineHeadNodeId) : null;
    state.timelineLatestNodeId = current.timelineLatestNodeId ? String(current.timelineLatestNodeId) : null;
    state.timelineNextSeq = Math.max(1, Number(current.timelineNextSeq) || 1);
    state.timelineOpen = current.timelineOpen !== false;
    state.canvasMode = String(current.canvasMode || "multi");
    state.freeformRects = current.freeformRects instanceof Map ? current.freeformRects : new Map();
    state.freeformZOrder = Array.isArray(current.freeformZOrder) ? current.freeformZOrder.slice() : [];
    state.multiRects = current.multiRects instanceof Map ? current.multiRects : new Map();
    state.view =
      current.view && typeof current.view === "object" ? current.view : { scale: 1, offsetX: 0, offsetY: 0 };
    state.multiView =
      current.multiView && typeof current.multiView === "object"
        ? current.multiView
        : { scale: 1, offsetX: 0, offsetY: 0 };
    state.communication =
      current.communication && typeof current.communication === "object"
        ? current.communication
        : createFreshCommunicationState();
    state.designReviewApply = cloneDesignReviewApplyState(current.designReviewApply);
    state.selection = current.selection && typeof current.selection === "object" ? current.selection : null;
    state.lassoDraft = Array.isArray(current.lassoDraft) ? current.lassoDraft.slice() : [];
    state.annotateDraft = current.annotateDraft && typeof current.annotateDraft === "object" ? current.annotateDraft : null;
    state.annotateBox = current.annotateBox && typeof current.annotateBox === "object" ? current.annotateBox : null;
    state.promptGenerateDraft =
      current.promptGenerateDraft && typeof current.promptGenerateDraft === "object"
        ? current.promptGenerateDraft
        : { prompt: "", model: "" };
    state.promptGenerateDraftAnchor =
      current.promptGenerateDraftAnchor && typeof current.promptGenerateDraftAnchor === "object"
        ? current.promptGenerateDraftAnchor
        : null;
    state.customToolDraft =
      current.customToolDraft && typeof current.customToolDraft === "object"
        ? current.customToolDraft
        : { name: "", description: "" };
    const sessionToolRegistry =
      current.toolRegistry && typeof current.toolRegistry.list === "function"
        ? current.toolRegistry
        : createInSessionToolRegistry();
    setSessionToolRegistry(sessionToolRegistry);
    state.sessionTools = Array.isArray(current.sessionTools) ? current.sessionTools : sessionToolRegistry.list();
    state.activeCustomToolId = current.activeCustomToolId ? String(current.activeCustomToolId) : null;
    state.lastToolInvocation = current.lastToolInvocation ? cloneToolRuntimeValue(current.lastToolInvocation) : null;
    state.toolInvocationSeq = Math.max(1, Number(current.toolInvocationSeq) || 1);
    state.circleDraft = current.circleDraft && typeof current.circleDraft === "object" ? current.circleDraft : null;
    state.circlesByImageId = current.circlesByImageId instanceof Map ? current.circlesByImageId : new Map();
    state.activeCircle = current.activeCircle && typeof current.activeCircle === "object" ? current.activeCircle : null;
    state.tripletRuleAnnotations =
      current.tripletRuleAnnotations instanceof Map ? current.tripletRuleAnnotations : new Map();
    state.tripletOddOneOutId = current.tripletOddOneOutId ? String(current.tripletOddOneOutId) : null;
    state.tabPreviewState = normalizeTabPreviewState(current.tabPreviewState);
    state.tabPreviewDirty = !Boolean(state.tabPreviewState.valid);
    state.pendingTabSwitchPreview = null;
    state.motherResultDetailsOpenId = current.motherResultDetailsOpenId ? String(current.motherResultDetailsOpenId) : null;
    state.wheelMenu =
      current.wheelMenu && typeof current.wheelMenu === "object"
        ? current.wheelMenu
        : { open: false, hideTimer: null, anchorCss: null, anchorWorld: null };
    state.userEvents = Array.isArray(current.userEvents) ? current.userEvents : [];
    state.userTelemetryEvents = Array.isArray(current.userTelemetryEvents) ? current.userTelemetryEvents : [];
    state.userEventSeq = Math.max(0, Number(current.userEventSeq) || 0);
    state.mother = current.mother && typeof current.mother === "object" ? current.mother : createTabMotherState();
    state.motherIdle =
      current.motherIdle && typeof current.motherIdle === "object" ? current.motherIdle : createTabMotherIdleState();
    state.intent = current.intent && typeof current.intent === "object" ? current.intent : createTabIntentState();
    state.intentAmbient =
      current.intentAmbient && typeof current.intentAmbient === "object"
        ? current.intentAmbient
        : createTabIntentAmbientState();
    state.intentAmbient.enabled = false;
    state.alwaysOnVision =
      current.alwaysOnVision && typeof current.alwaysOnVision === "object"
        ? current.alwaysOnVision
        : createTabAlwaysOnVisionState();
    state.alwaysOnVision.enabled = Boolean(settings.alwaysOnVision);
    if (!state.alwaysOnVision.enabled && state.alwaysOnVision.rtState === "connecting") {
      state.alwaysOnVision.rtState = "off";
    }
    state.lastRecreatePrompt = current.lastRecreatePrompt ? String(current.lastRecreatePrompt) : null;
    state.lastAction = current.lastAction ? String(current.lastAction) : null;
    state.lastTipText = typeof current.lastTipText === "string" ? current.lastTipText : defaultTip;
    state.lastDirectorText = current.lastDirectorText ? String(current.lastDirectorText) : null;
    state.lastDirectorMeta = current.lastDirectorMeta && typeof current.lastDirectorMeta === "object" ? current.lastDirectorMeta : null;
    state.lastCostLatency = current.lastCostLatency && typeof current.lastCostLatency === "object" ? current.lastCostLatency : null;
    state.sessionApiCalls = Math.max(0, Number(current.sessionApiCalls) || 0);
    state.topMetrics =
      current.topMetrics && typeof current.topMetrics === "object" ? current.topMetrics : createTabTopMetricsState();
    state.lastStatusText = String(current.lastStatusText || "Engine: idle");
    state.lastStatusError = Boolean(current.lastStatusError);
    state.juggernautShell.singleImageRail.recentSuccessfulJobs = Array.isArray(current.juggernautShellRecentSuccessfulJobs)
      ? current.juggernautShellRecentSuccessfulJobs
      : [];
    state.juggernautShell.lastToolKey = String(current.juggernautShellLastToolKey || "");
    current.tabUiMeta = normalizeTabUiMeta(current.tabUiMeta);
    applyTabUiMetaToState(current.tabUiMeta);
    state.imageMenuTargetId = null;
    state.promptGenerateHoverCss = null;
    state.effectTokenDrag = null;
    state.motherOverlayUiHits = [];
    state.activeImageTransformUiHits = [];
    state.motherRolePreviewHoverImageId = null;
  }

  function syncActiveTabRecord({ capture = false, publish = false } = {}) {
    const tabId = String(state.activeTabId || "").trim();
    if (!tabId) return null;
    const record = tabbedSessions.getTab(tabId);
    if (!record) return null;
    const previousMetaSignature = tabUiMetaSignature(record.tabUiMeta);
    const previousRunDir = record.runDir ? String(record.runDir) : null;
    const previousLabel = record.label ? String(record.label) : null;
    const previousBusy = Boolean(record.busy);
    const previousThumbnailPath = record.thumbnailPath ? String(record.thumbnailPath) : null;
    const previousReviewFlowState = normalizeSessionTabReviewFlowState(record.reviewFlowState);
    if (capture) {
      record.session = captureActiveTabSession(record.session);
    }
    const uiMeta = buildActiveTabUiMeta(record.tabUiMeta || record.session?.tabUiMeta);
    record.tabUiMeta = uiMeta;
    if (record.session && typeof record.session === "object") {
      record.session.tabUiMeta = { ...uiMeta };
    }
    record.runDir = state.runDir || record.session?.runDir || record.runDir || null;
    record.reviewFlowState = currentSessionTabReviewFlowState();
    if (!record.labelManual) {
      record.label = sessionTabAutomaticLabelForRecord(record, defaultUntitledTabTitle);
    } else {
      record.label = normalizeSessionTabTitleInput(record.label, sessionTabTitleMaxLength) || defaultUntitledTabTitle;
    }
    if (record.session && typeof record.session === "object") {
      record.session.label = record.label;
      record.session.labelManual = Boolean(record.labelManual);
      record.session.reviewFlowState = record.reviewFlowState;
    }
    record.busy = Boolean(currentTabSwitchBlockReason());
    record.thumbnailPath = uiMeta.thumbnailPath;
    record.updatedAt = now();
    if (publish) {
      const changed =
        capture ||
        previousMetaSignature !== tabUiMetaSignature(uiMeta) ||
        previousRunDir !== record.runDir ||
        previousLabel !== record.label ||
        previousBusy !== Boolean(record.busy) ||
        previousThumbnailPath !== record.thumbnailPath ||
        previousReviewFlowState !== normalizeSessionTabReviewFlowState(record.reviewFlowState);
      if (changed) {
        tabbedSessions.upsertTab({ ...record }, { activate: false });
      }
    }
    return record;
  }

  return Object.freeze({
    captureActiveTabSession,
    bindTabSessionToState,
    syncActiveTabRecord,
  });
}
