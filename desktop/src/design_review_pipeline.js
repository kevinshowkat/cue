import {
  buildDesignReviewPlannerPrompt,
  buildDesignReviewRequest,
  buildUploadAnalysisPrompt,
  createDesignReviewSkeletonSlots,
  parseDesignReviewPlannerResponse,
} from "./design_review_contract.js";
import {
  applyDesignReviewAccountMemoryBias,
  readDesignReviewAccountMemory,
  recordAcceptedDesignReviewProposal,
  summarizeDesignReviewAccountMemory,
} from "./design_review_memory.js";
import { scheduleOpportunisticUploadAnalysis } from "./design_review_upload_analysis.js";

function readFirstString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function uniqueStrings(values = [], { limit = Infinity } = {}) {
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = String(value || "").trim();
    if (!text || out.includes(text)) continue;
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function freshState() {
  return {
    status: "idle",
    request: null,
    slots: [],
    proposals: [],
    previewJobs: [],
    plannerDebugInfo: null,
    activeApply: null,
    lastApplyEvent: null,
    errors: [],
    startedAt: null,
    completedAt: null,
  };
}

function applyFilePathForProposal(runDir = "", proposalId = "") {
  const dir = String(runDir || "").trim();
  const proposalKey = String(proposalId || "").trim().replace(/[^a-z0-9._:-]+/gi, "_");
  if (!dir) return "";
  return `${dir}/review-apply-${proposalKey || "proposal"}.png`;
}

function patchSlot(slots = [], rank = 1, patch = {}) {
  return slots.map((slot) => {
    if (Number(slot?.rank) !== Number(rank)) return slot;
    return {
      ...slot,
      ...(patch && typeof patch === "object" ? patch : {}),
    };
  });
}

function patchSlotByProposalId(slots = [], proposalId = "", patch = {}) {
  const normalizedProposalId = readFirstString(proposalId);
  if (!normalizedProposalId) return Array.isArray(slots) ? slots.slice() : [];
  return (Array.isArray(slots) ? slots : []).map((slot) => {
    if (readFirstString(slot?.proposal?.proposalId) !== normalizedProposalId) return slot;
    return {
      ...slot,
      ...(patch && typeof patch === "object" ? patch : {}),
    };
  });
}

function patchProposal(proposals = [], proposalId = "", patch = {}) {
  const normalizedProposalId = readFirstString(proposalId);
  if (!normalizedProposalId) return Array.isArray(proposals) ? proposals.slice() : [];
  return (Array.isArray(proposals) ? proposals : []).map((proposal) => {
    if (readFirstString(proposal?.proposalId) !== normalizedProposalId) return proposal;
    return {
      ...proposal,
      ...(patch && typeof patch === "object" ? patch : {}),
    };
  });
}

function findProposalInReviewState(reviewState = {}, proposalId = "") {
  const normalizedProposalId = readFirstString(proposalId);
  if (!normalizedProposalId) return null;
  const proposals = Array.isArray(reviewState?.proposals) ? reviewState.proposals : [];
  const proposalMatch =
    proposals.find((proposal) => readFirstString(proposal?.proposalId) === normalizedProposalId) ||
    null;
  if (proposalMatch) return proposalMatch;
  const slots = Array.isArray(reviewState?.slots) ? reviewState.slots : [];
  return (
    slots
      .map((slot) => asRecord(slot?.proposal))
      .find((proposal) => readFirstString(proposal?.proposalId) === normalizedProposalId) || null
  );
}

function imageCatalogFromRequest(request = {}) {
  const visibleCanvasContext = asRecord(request?.visibleCanvasContext) || {};
  return Array.isArray(visibleCanvasContext.images)
    ? visibleCanvasContext.images.filter((image) => image && typeof image === "object")
    : [];
}

function reviewScopeImageIds(request = {}) {
  return uniqueStrings(request?.focusImageIds || [], { limit: 12 });
}

function findImageRecordById(request = {}, imageId = "") {
  const normalizedImageId = readFirstString(imageId);
  if (!normalizedImageId) return null;
  return (
    imageCatalogFromRequest(request).find(
      (image) =>
        readFirstString(image?.id, image?.imageId, image?.image_id) === normalizedImageId
    ) || null
  );
}

function resolveProposalTargetImageId(request = {}, proposal = {}) {
  const visibleCanvasContext = asRecord(request?.visibleCanvasContext) || {};
  const imageCatalog = imageCatalogFromRequest(request);
  const catalogIds = imageCatalog
    .map((image) => readFirstString(image?.id, image?.imageId, image?.image_id))
    .filter(Boolean);
  const catalogIdSet = new Set(catalogIds);
  const scopedImageIds = reviewScopeImageIds(request);
  const scopedImageIdSet = new Set(scopedImageIds);
  const candidates = [
    proposal?.imageId,
    proposal?.image_id,
    proposal?.targetImageId,
    proposal?.target_image_id,
    proposal?.targetRegion?.imageId,
    proposal?.targetRegion?.image_id,
    request?.primaryImageId,
    visibleCanvasContext?.activeImageId,
    visibleCanvasContext?.canvas?.active_image_id,
    request?.selectedImageIds?.[0],
    request?.imageIdsInView?.[0],
    scopedImageIds[0] || null,
    catalogIds[0] || null,
  ]
    .map((value) => readFirstString(value))
    .filter(Boolean);

  if (scopedImageIds.length) {
    for (const candidate of candidates) {
      if (scopedImageIdSet.has(candidate) && (catalogIdSet.size === 0 || catalogIdSet.has(candidate))) {
        return candidate;
      }
    }
    if (catalogIdSet.size > 0) {
      return scopedImageIds.find((imageId) => catalogIdSet.has(imageId)) || catalogIds[0] || null;
    }
    return scopedImageIds[0] || candidates[0] || null;
  }
  if (catalogIdSet.size > 0) {
    for (const candidate of candidates) {
      if (catalogIdSet.has(candidate)) return candidate;
    }
    return catalogIds[0] || null;
  }
  return candidates[0] || null;
}

function resolveProposalReferenceImageIds(request = {}, proposal = {}, targetImageId = null) {
  const normalizedTargetImageId = readFirstString(targetImageId);
  const scopedImageIds = reviewScopeImageIds(request).filter((imageId) => imageId !== normalizedTargetImageId);
  const scopedImageIdSet = new Set(scopedImageIds);
  const explicitReferenceIds = uniqueStrings(
    [
      ...(Array.isArray(proposal?.referenceImageIds) ? proposal.referenceImageIds : []),
      ...(Array.isArray(proposal?.reference_image_ids) ? proposal.reference_image_ids : []),
      ...(Array.isArray(proposal?.referenceImages)
        ? proposal.referenceImages.map((image) => readFirstString(image?.imageId, image?.id))
        : []),
      ...(Array.isArray(proposal?.reference_images)
        ? proposal.reference_images.map((image) =>
            readFirstString(image?.imageId, image?.image_id, image?.id)
          )
        : []),
    ],
    { limit: 12 }
  ).filter((imageId) =>
    imageId !== normalizedTargetImageId &&
    (!scopedImageIdSet.size || scopedImageIdSet.has(imageId))
  );
  if (explicitReferenceIds.length) return explicitReferenceIds;
  if (scopedImageIds.length) return scopedImageIds;
  return uniqueStrings(
    [
      ...(Array.isArray(request?.selectedImageIds) ? request.selectedImageIds : []),
      ...(Array.isArray(request?.imageIdsInView) ? request.imageIdsInView : []),
      ...imageCatalogFromRequest(request).map((image) =>
        readFirstString(image?.id, image?.imageId, image?.image_id)
      ),
    ],
    { limit: 12 }
  ).filter((imageId) => imageId && imageId !== normalizedTargetImageId);
}

function resolveReviewSessionKey(request = {}, fallback = "") {
  const normalizedFallback = readFirstString(fallback);
  if (normalizedFallback) return normalizedFallback;
  const visibleCanvasContext = asRecord(request?.visibleCanvasContext) || {};
  const activeTabId = readFirstString(visibleCanvasContext.activeTabId);
  if (activeTabId) return `tab:${activeTabId}`;
  const runDir = readFirstString(visibleCanvasContext.runDir);
  if (runDir) return `run:${runDir}`;
  const sessionId = readFirstString(request?.sessionId);
  if (sessionId) {
    if (/^(tab|run|session|request):/i.test(sessionId)) return sessionId;
    return `session:${sessionId}`;
  }
  const requestId = readFirstString(request?.requestId);
  if (requestId) return `request:${requestId}`;
  return "";
}

function buildLocalApplyDebugInfo({
  request = {},
  sessionKey = "",
  proposal = {},
  targetImageId = null,
  targetImage = null,
  referenceImageIds = [],
  referenceImages = [],
  outputPath = null,
  error = null,
  reason = "",
} = {}) {
  const focusInputs = Array.isArray(proposal?.focusInputs)
    ? proposal.focusInputs
    : Array.isArray(request?.focusInputs)
      ? request.focusInputs
      : [];
  const protectedRegions = Array.isArray(proposal?.protectedRegions)
    ? proposal.protectedRegions
    : Array.isArray(request?.protectedRegions)
      ? request.protectedRegions
      : [];
  const reservedSpaceIntent =
    asRecord(proposal?.reservedSpaceIntent) || asRecord(request?.reservedSpaceIntent) || null;
  return {
    source: "design_review_pipeline",
    route: {
      kind: "apply",
    },
    requestId: readFirstString(request?.requestId) || null,
    sessionKey: readFirstString(sessionKey) || null,
    proposal: cloneJson(proposal),
    request: cloneJson(request),
    reason: readFirstString(reason) || null,
    focusInputs: cloneJson(focusInputs),
    focusInputIds: uniqueStrings(
      focusInputs.map((entry) => readFirstString(entry?.focusInputId)),
      { limit: 12 }
    ),
    protectedRegions: cloneJson(protectedRegions),
    protectedRegionIds: uniqueStrings(
      protectedRegions.map((entry) => readFirstString(entry?.protectedRegionId)),
      { limit: 12 }
    ),
    reservedSpaceIntent: cloneJson(reservedSpaceIntent),
    reservedSpaceAreaIds: uniqueStrings(
      (Array.isArray(reservedSpaceIntent?.areas) ? reservedSpaceIntent.areas : []).map((entry) =>
        readFirstString(entry?.reservedSpaceId)
      ),
      { limit: 12 }
    ),
    targetImageId: readFirstString(targetImageId) || null,
    targetImagePath: readFirstString(targetImage?.path, targetImage?.imagePath) || null,
    referenceImageIds: uniqueStrings(referenceImageIds, { limit: 12 }),
    referenceImagePaths: uniqueStrings(
      (Array.isArray(referenceImages) ? referenceImages : []).map((image) =>
        readFirstString(image?.path, image?.imagePath)
      ),
      { limit: 12 }
    ),
    outputPath: readFirstString(outputPath) || null,
    message: readFirstString(error?.message, error) || null,
  };
}

function resolveApplyFocusSemantics(request = {}, proposal = {}) {
  const focusInputs = Array.isArray(proposal?.focusInputs)
    ? proposal.focusInputs
    : Array.isArray(request?.focusInputs)
      ? request.focusInputs
      : [];
  const protectedRegions = Array.isArray(proposal?.protectedRegions)
    ? proposal.protectedRegions
    : Array.isArray(request?.protectedRegions)
      ? request.protectedRegions
      : [];
  const reservedSpaceIntent =
    asRecord(proposal?.reservedSpaceIntent) || asRecord(request?.reservedSpaceIntent) || null;
  return {
    focusInputs: cloneJson(focusInputs),
    protectedRegions: cloneJson(protectedRegions),
    reservedSpaceIntent: cloneJson(reservedSpaceIntent),
    focusInputIds: uniqueStrings(
      focusInputs.map((entry) => readFirstString(entry?.focusInputId)),
      { limit: 12 }
    ),
    protectedRegionIds: uniqueStrings(
      protectedRegions.map((entry) => readFirstString(entry?.protectedRegionId)),
      { limit: 12 }
    ),
    reservedSpaceAreaIds: uniqueStrings(
      (Array.isArray(reservedSpaceIntent?.areas) ? reservedSpaceIntent.areas : []).map((entry) =>
        readFirstString(entry?.reservedSpaceId)
      ),
      { limit: 12 }
    ),
  };
}

export function createDesignReviewPipeline({
  providerRouter = null,
  memoryStore = null,
  uploadAnalysisCache = null,
  hashImage = null,
  slotCount = 3,
  runApply = null,
  onApplyEvent = null,
  onPlannerEvent = null,
} = {}) {
  let state = freshState();
  let activeRunToken = 0;
  const listeners = new Set();
  const applyRunner =
    typeof runApply === "function"
      ? runApply
      : typeof providerRouter?.runApply === "function"
        ? providerRouter.runApply.bind(providerRouter)
        : null;

  const emit = () => {
    const snapshot = cloneJson(state);
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error("Design-review listener failed:", error);
      }
    }
    return snapshot;
  };

  const setState = (next) => {
    state = next;
    return emit();
  };

  const emitApplyEvent = (payload = null) => {
    const eventPayload = cloneJson(payload);
    if (typeof onApplyEvent !== "function" || !eventPayload) return eventPayload;
    try {
      onApplyEvent(eventPayload);
    } catch (error) {
      console.error("Design-review apply listener failed:", error);
    }
    return eventPayload;
  };

  const emitPlannerEvent = async (payload = null) => {
    const eventPayload = cloneJson(payload);
    if (typeof onPlannerEvent !== "function" || !eventPayload) return eventPayload;
    try {
      await onPlannerEvent(eventPayload);
    } catch (error) {
      console.error("Design-review planner listener failed:", error);
    }
    return eventPayload;
  };

  return {
    getState() {
      return cloneJson(state);
    },
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      listener(cloneJson(state));
      return () => {
        listeners.delete(listener);
      };
    },
    async warmUploadAnalysis(images = [], { consent = null, onUpdate = null } = {}) {
      const out = [];
      if (!providerRouter?.runUploadAnalysis || !uploadAnalysisCache) return out;
      for (const image of Array.isArray(images) ? images : []) {
        const prompt = buildUploadAnalysisPrompt({
          imageId: image?.id || null,
          imagePath: image?.path || image?.imagePath || null,
        });
        out.push(
          await scheduleOpportunisticUploadAnalysis({
            image,
            consent,
            cacheStore: uploadAnalysisCache,
            hashImage,
            analyzeImage: ({ image: inputImage }) =>
              providerRouter.runUploadAnalysis({
                image: inputImage,
                prompt,
              }),
            onUpdate,
          })
        );
      }
      return out;
    },
    async startReview(input = {}) {
      const runToken = activeRunToken + 1;
      activeRunToken = runToken;
      const isCurrentRun = () => runToken === activeRunToken;
      const request =
        input?.request && typeof input.request === "object"
          ? { ...input.request }
          : buildDesignReviewRequest({
              ...input,
              slotCount,
            });
      const normalizedSlotCount = Math.max(2, Math.min(3, Number(request.slotCount) || slotCount || 3));
      const initialSlots = createDesignReviewSkeletonSlots({
        request,
        slotCount: normalizedSlotCount,
      });
      setState({
        status: "planning",
        request,
        slots: initialSlots,
        proposals: [],
        previewJobs: [],
        plannerDebugInfo: null,
        activeApply: null,
        lastApplyEvent: null,
        errors: [],
        startedAt: new Date().toISOString(),
        completedAt: null,
      });

      if (!providerRouter?.runPlanner) {
        if (!isCurrentRun()) return cloneJson(state);
        setState({
          ...state,
          status: "failed",
          errors: ["planner_unavailable"],
          completedAt: new Date().toISOString(),
        });
        return cloneJson(state);
      }

      const accountMemorySummary =
        request.accountMemorySummary ||
        summarizeDesignReviewAccountMemory(memoryStore ? readDesignReviewAccountMemory(memoryStore) : null);
      const plannerPrompt = buildDesignReviewPlannerPrompt({
        ...request,
        accountMemorySummary,
      });
      const plannerImages = [request.visibleCanvasRef].filter(Boolean);
      const plannerAttemptId = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      const plannerStartedAt = new Date().toISOString();
      const plannerEventBase = {
        attemptId: plannerAttemptId,
        requestId: readFirstString(request?.requestId) || null,
        startedAt: plannerStartedAt,
        request: cloneJson(request),
        prompt: plannerPrompt,
        images: cloneJson(plannerImages),
      };
      await emitPlannerEvent({
        ...plannerEventBase,
        phase: "started",
      });
      let plannerResult = null;
      let plannerDebugInfo = null;
      let plannerRawText = "";
      let parsed = null;
      let rankedProposals = [];
      try {
        plannerResult = await providerRouter.runPlanner({
          request,
          prompt: plannerPrompt,
          images: plannerImages,
        });
        plannerDebugInfo = cloneJson(plannerResult?.debugInfo || null);
        plannerRawText = plannerResult?.text || plannerResult?.outputText || plannerResult?.rawText || "";
        parsed = parseDesignReviewPlannerResponse(plannerRawText, request);
        rankedProposals = applyDesignReviewAccountMemoryBias(parsed.proposals, accountMemorySummary).slice(
          0,
          normalizedSlotCount
        );
        await emitPlannerEvent({
          ...plannerEventBase,
          phase: "succeeded",
          completedAt: new Date().toISOString(),
          rawText: plannerRawText || null,
          parsedResponse: cloneJson(parsed),
          rankedProposals: cloneJson(rankedProposals),
          plannerResult: cloneJson(plannerResult),
          plannerDebugInfo,
        });
      } catch (error) {
        const failureDebugInfo = plannerDebugInfo || cloneJson(error?.debugInfo || null);
        await emitPlannerEvent({
          ...plannerEventBase,
          phase: "failed",
          completedAt: new Date().toISOString(),
          rawText: plannerRawText || null,
          plannerResult: cloneJson(plannerResult),
          plannerDebugInfo: failureDebugInfo,
          failure: {
            name: readFirstString(error?.name) || null,
            message: readFirstString(error?.message, error) || "Edit proposals request failed.",
          },
        });
        throw error;
      }
      if (!isCurrentRun()) return cloneJson(state);
      let nextSlots = initialSlots.slice(0, normalizedSlotCount).map((slot, index) => ({
        ...slot,
        status: rankedProposals[index] ? "ready" : "failed",
        proposal: rankedProposals[index] ? { ...rankedProposals[index] } : null,
        error: rankedProposals[index] ? null : "planner_returned_no_proposal",
        debugInfo: rankedProposals[index] ? null : plannerDebugInfo,
      }));
      setState({
        ...state,
        status: rankedProposals.length ? "ready" : "failed",
        proposals: rankedProposals,
        previewJobs: [],
        plannerDebugInfo,
        slots: nextSlots,
        errors: rankedProposals.length ? [] : ["planner_returned_no_proposal"],
        completedAt: new Date().toISOString(),
      });
      if (!rankedProposals.length) {
        if (!isCurrentRun()) return cloneJson(state);
        return cloneJson(state);
      }
      return cloneJson(state);
    },
    acceptProposal(proposalId, { stylePatterns = [], useCasePatterns = [], reviewState = null } = {}) {
      const proposal = findProposalInReviewState(asRecord(reviewState) || state, proposalId);
      if (!proposal || !memoryStore) return null;
      return recordAcceptedDesignReviewProposal(memoryStore, proposal, {
        stylePatterns,
        useCasePatterns,
      });
    },
    async applyProposal(proposalId, { sessionKey = null, reviewState = null, onStateChange = null } = {}) {
      const normalizedProposalId = readFirstString(proposalId);
      let workingState = cloneJson(asRecord(reviewState) || state);
      const sourceRequestId = readFirstString(workingState?.request?.requestId);
      const shouldSyncGlobalState =
        !asRecord(reviewState) ||
        (sourceRequestId && sourceRequestId === readFirstString(state?.request?.requestId));
      const publishState = (nextState) => {
        workingState = cloneJson(nextState);
        if (shouldSyncGlobalState) {
          return setState(nextState);
        }
        const snapshot = cloneJson(nextState);
        if (typeof onStateChange === "function") {
          try {
            onStateChange(snapshot);
          } catch (error) {
            console.error("Design-review apply state listener failed:", error);
          }
        }
        return snapshot;
      };
      const request = cloneJson(workingState?.request);
      const proposal = cloneJson(findProposalInReviewState(workingState, normalizedProposalId)) || null;
      if (!request || !proposal) {
        return {
          ok: false,
          reason: "proposal_unavailable",
          requestId: readFirstString(request?.requestId) || null,
          proposalId: normalizedProposalId || null,
        };
      }
      const requestId = readFirstString(request?.requestId) || null;
      if (
        readFirstString(workingState?.activeApply?.requestId) === requestId &&
        readFirstString(workingState?.activeApply?.status) === "running"
      ) {
        return {
          ok: false,
          reason: "apply_in_progress",
          requestId,
          proposalId: normalizedProposalId,
        };
      }

      const resolvedSessionKey = resolveReviewSessionKey(request, sessionKey);
      const targetImageId = resolveProposalTargetImageId(request, proposal);
      const referenceImageIds = resolveProposalReferenceImageIds(request, proposal, targetImageId);
      const targetImage = findImageRecordById(request, targetImageId);
      const referenceImages = referenceImageIds
        .map((imageId) => findImageRecordById(request, imageId))
        .filter(Boolean);
      const outputPath = applyFilePathForProposal(
        request?.visibleCanvasContext?.runDir,
        proposal.proposalId
      );
      const focusSemantics = resolveApplyFocusSemantics(request, proposal);
      const startedAt = new Date().toISOString();
      const startedEvent = {
        phase: "started",
        status: "apply_running",
        requestId,
        sessionKey: resolvedSessionKey || null,
        proposal: {
          ...proposal,
          status: "apply_running",
        },
        request,
        targetImageId,
        referenceImageIds,
        focusInputs: focusSemantics.focusInputs,
        focusInputIds: focusSemantics.focusInputIds,
        protectedRegions: focusSemantics.protectedRegions,
        protectedRegionIds: focusSemantics.protectedRegionIds,
        reservedSpaceIntent: focusSemantics.reservedSpaceIntent,
        reservedSpaceAreaIds: focusSemantics.reservedSpaceAreaIds,
        outputPath: null,
        debugInfo: null,
        error: null,
        startedAt,
        completedAt: null,
      };

      publishState({
        ...workingState,
        status: "apply_running",
        activeApply: {
          requestId,
          proposalId: normalizedProposalId,
          sessionKey: resolvedSessionKey || null,
          targetImageId,
          referenceImageIds,
          focusInputIds: focusSemantics.focusInputIds,
          protectedRegionIds: focusSemantics.protectedRegionIds,
          reservedSpaceAreaIds: focusSemantics.reservedSpaceAreaIds,
          status: "running",
          startedAt,
          completedAt: null,
        },
        lastApplyEvent: startedEvent,
        proposals: patchProposal(workingState?.proposals, normalizedProposalId, {
          status: "apply_running",
        }),
        slots: patchSlotByProposalId(workingState?.slots, normalizedProposalId, {
          status: "apply_running",
          error: null,
          debugInfo: null,
          apply: {
            status: "running",
            sessionKey: resolvedSessionKey || null,
            targetImageId,
            referenceImageIds,
            focusInputIds: focusSemantics.focusInputIds,
            protectedRegionIds: focusSemantics.protectedRegionIds,
            reservedSpaceAreaIds: focusSemantics.reservedSpaceAreaIds,
            outputPath: null,
            startedAt,
            completedAt: null,
            debugInfo: null,
            error: null,
          },
        }),
        errors: [],
      });
      emitApplyEvent(startedEvent);

      const finishWithFailure = (error, reason = "apply_failed") => {
        const completedAt = new Date().toISOString();
        const debugInfo =
          cloneJson(error?.debugInfo) ||
          buildLocalApplyDebugInfo({
            request,
            sessionKey: resolvedSessionKey,
            proposal,
            targetImageId,
            targetImage,
            referenceImageIds,
            referenceImages,
            outputPath,
            error,
            reason,
        });
        const failureEvent = {
          phase: "failed",
          status: "apply_failed",
          requestId,
          sessionKey: resolvedSessionKey || null,
          proposal: {
            ...proposal,
            status: "apply_failed",
          },
          request,
          targetImageId,
          referenceImageIds,
          focusInputs: focusSemantics.focusInputs,
          focusInputIds: focusSemantics.focusInputIds,
          protectedRegions: focusSemantics.protectedRegions,
          protectedRegionIds: focusSemantics.protectedRegionIds,
          reservedSpaceIntent: focusSemantics.reservedSpaceIntent,
          reservedSpaceAreaIds: focusSemantics.reservedSpaceAreaIds,
          outputPath: null,
          debugInfo,
          error: readFirstString(error?.message, error) || "Applying an edit proposal failed.",
          startedAt,
          completedAt,
        };
        publishState({
          ...workingState,
          status: "apply_failed",
          activeApply: null,
          lastApplyEvent: failureEvent,
          proposals: patchProposal(workingState?.proposals, normalizedProposalId, {
            status: "apply_failed",
          }),
          slots: patchSlotByProposalId(workingState?.slots, normalizedProposalId, {
            status: "apply_failed",
            error: failureEvent.error,
            debugInfo,
            apply: {
              status: "failed",
              sessionKey: resolvedSessionKey || null,
              targetImageId,
              referenceImageIds,
              focusInputIds: focusSemantics.focusInputIds,
              protectedRegionIds: focusSemantics.protectedRegionIds,
              reservedSpaceAreaIds: focusSemantics.reservedSpaceAreaIds,
              outputPath: null,
              startedAt,
              completedAt,
              debugInfo,
              error: failureEvent.error,
            },
          }),
          errors: [failureEvent.error],
          completedAt,
        });
        emitApplyEvent(failureEvent);
        return {
          ok: false,
          reason,
          ...failureEvent,
        };
      };

      if (!applyRunner) {
        return finishWithFailure(
          new Error("Edit proposal apply handler is unavailable."),
          "apply_unavailable"
        );
      }
      if (!targetImageId || !readFirstString(targetImage?.path, targetImage?.imagePath)) {
        return finishWithFailure(
          new Error("Accepted review proposal is missing a target image."),
          "target_image_unavailable"
        );
      }

      try {
        const applyResult = await applyRunner({
          request,
          proposal,
          sessionKey: resolvedSessionKey || null,
          targetImageId,
          referenceImageIds,
          targetImage,
          referenceImages,
          outputPath,
        });
        const completedAt = new Date().toISOString();
        const resolvedOutputPath =
          readFirstString(
            applyResult?.outputPath,
            applyResult?.outputImagePath,
            applyResult?.path
          ) || outputPath || null;
        if (!resolvedOutputPath) {
          return finishWithFailure(
            new Error("Edit proposal apply did not produce an output image."),
            "apply_missing_output"
          );
        }
        const successEvent = {
          phase: "succeeded",
          status: "apply_succeeded",
          requestId,
          sessionKey: resolvedSessionKey || null,
          proposal: {
            ...proposal,
            status: "apply_succeeded",
          },
          request,
          targetImageId,
          referenceImageIds,
          focusInputs: focusSemantics.focusInputs,
          focusInputIds: focusSemantics.focusInputIds,
          protectedRegions: focusSemantics.protectedRegions,
          protectedRegionIds: focusSemantics.protectedRegionIds,
          reservedSpaceIntent: focusSemantics.reservedSpaceIntent,
          reservedSpaceAreaIds: focusSemantics.reservedSpaceAreaIds,
          outputPath: resolvedOutputPath,
          debugInfo: cloneJson(applyResult?.debugInfo || null),
          error: null,
          startedAt,
          completedAt,
        };
        publishState({
          ...workingState,
          status: "apply_succeeded",
          activeApply: null,
          lastApplyEvent: successEvent,
          proposals: patchProposal(workingState?.proposals, normalizedProposalId, {
            status: "apply_succeeded",
          }),
          slots: patchSlotByProposalId(workingState?.slots, normalizedProposalId, {
            status: "apply_succeeded",
            error: null,
            debugInfo: cloneJson(applyResult?.debugInfo || null),
            apply: {
              status: "succeeded",
              sessionKey: resolvedSessionKey || null,
              targetImageId,
              referenceImageIds,
              focusInputIds: focusSemantics.focusInputIds,
              protectedRegionIds: focusSemantics.protectedRegionIds,
              reservedSpaceAreaIds: focusSemantics.reservedSpaceAreaIds,
              outputPath: resolvedOutputPath,
              startedAt,
              completedAt,
              debugInfo: cloneJson(applyResult?.debugInfo || null),
              error: null,
            },
          }),
          errors: [],
          completedAt,
        });
        emitApplyEvent(successEvent);
        return {
          ok: true,
          ...successEvent,
        };
      } catch (error) {
        return finishWithFailure(error, "apply_failed");
      }
    },
  };
}
