import {
  buildDesignReviewPlannerPrompt,
  buildDesignReviewRequest,
  buildUploadAnalysisPrompt,
  createDesignReviewPreviewJob,
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

function freshState() {
  return {
    status: "idle",
    request: null,
    slots: [],
    proposals: [],
    previewJobs: [],
    errors: [],
    startedAt: null,
    completedAt: null,
  };
}

function previewFilePathForProposal(runDir = "", proposalId = "") {
  const dir = String(runDir || "").trim();
  const proposalKey = String(proposalId || "").trim().replace(/[^a-z0-9._:-]+/gi, "_");
  if (!dir) return "";
  return `${dir}/review-preview-${proposalKey || "proposal"}.png`;
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

export function createDesignReviewPipeline({
  providerRouter = null,
  memoryStore = null,
  uploadAnalysisCache = null,
  hashImage = null,
  slotCount = 3,
} = {}) {
  let state = freshState();
  const listeners = new Set();

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
        previewJobs: initialSlots.map((slot) => slot.previewJob),
        errors: [],
        startedAt: new Date().toISOString(),
        completedAt: null,
      });

      if (!providerRouter?.runPlanner) {
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
      const plannerResult = await providerRouter.runPlanner({
        request,
        prompt: plannerPrompt,
        images: [request.visibleCanvasRef].filter(Boolean),
      });
      const parsed = parseDesignReviewPlannerResponse(
        plannerResult?.text || plannerResult?.outputText || plannerResult?.rawText || "",
        request
      );
      const rankedProposals = applyDesignReviewAccountMemoryBias(parsed.proposals, accountMemorySummary).slice(
        0,
        normalizedSlotCount
      );
      const previewJobs = rankedProposals.map((proposal, index) =>
        createDesignReviewPreviewJob({
          request,
          proposal,
          rank: index + 1,
          status: "queued",
        })
      );
      let nextSlots = initialSlots.slice(0, normalizedSlotCount).map((slot, index) => ({
        ...slot,
        status: rankedProposals[index] ? "preview_pending" : "failed",
        proposal: rankedProposals[index] ? { ...rankedProposals[index] } : null,
        previewJob: previewJobs[index] ? { ...previewJobs[index] } : slot.previewJob,
        error: rankedProposals[index] ? null : "planner_returned_no_proposal",
      }));
      setState({
        ...state,
        status: rankedProposals.length ? "previewing" : "failed",
        proposals: rankedProposals,
        previewJobs,
        slots: nextSlots,
        errors: rankedProposals.length ? [] : ["planner_returned_no_proposal"],
      });
      if (!rankedProposals.length) {
        setState({
          ...state,
          completedAt: new Date().toISOString(),
        });
        return cloneJson(state);
      }

      await Promise.all(
        rankedProposals.map(async (proposal, index) => {
          const rank = index + 1;
          const previewJob = previewJobs[index];
          const outputPath = previewFilePathForProposal(request.visibleCanvasContext?.runDir, proposal.proposalId);
          state = {
            ...state,
            previewJobs: state.previewJobs.map((job) =>
              job.previewJobId === previewJob.previewJobId ? { ...job, status: "running" } : job
            ),
            slots: patchSlot(state.slots, rank, {
              status: "preview_running",
              previewJob: {
                ...previewJob,
                status: "running",
              },
            }),
          };
          emit();
          try {
            const previewResult = await providerRouter.runPreview({
              request,
              proposal,
              inputImage: request.visibleCanvasRef
                ? {
                    path: request.visibleCanvasRef,
                    imageId: proposal.imageId || request.primaryImageId || null,
                  }
                : null,
              outputPath,
            });
            state = {
              ...state,
              previewJobs: state.previewJobs.map((job) =>
                job.previewJobId === previewJob.previewJobId
                  ? {
                      ...job,
                      status: "succeeded",
                      outputPreviewRef:
                        readFirstString(previewResult?.outputPath, previewResult?.outputPreviewRef) || outputPath || null,
                    }
                  : job
              ),
              slots: patchSlot(state.slots, rank, {
                status: "ready",
                outputPreviewRef:
                  readFirstString(previewResult?.outputPath, previewResult?.outputPreviewRef) || outputPath || null,
                previewJob: {
                  ...previewJob,
                  status: "succeeded",
                  outputPreviewRef:
                    readFirstString(previewResult?.outputPath, previewResult?.outputPreviewRef) || outputPath || null,
                },
              }),
            };
            emit();
          } catch (error) {
            state = {
              ...state,
              previewJobs: state.previewJobs.map((job) =>
                job.previewJobId === previewJob.previewJobId
                  ? {
                      ...job,
                      status: "failed",
                      failureReason: String(error?.message || error || "preview_failed"),
                    }
                  : job
              ),
              slots: patchSlot(state.slots, rank, {
                status: "failed",
                error: String(error?.message || error || "preview_failed"),
                previewJob: {
                  ...previewJob,
                  status: "failed",
                  failureReason: String(error?.message || error || "preview_failed"),
                },
              }),
            };
            emit();
          }
        })
      );
      setState({
        ...state,
        status: "ready",
        completedAt: new Date().toISOString(),
      });
      return cloneJson(state);
    },
    acceptProposal(proposalId, { stylePatterns = [], useCasePatterns = [] } = {}) {
      const proposal = state.proposals.find((entry) => String(entry?.proposalId || "").trim() === String(proposalId || "").trim());
      if (!proposal || !memoryStore) return null;
      return recordAcceptedDesignReviewProposal(memoryStore, proposal, {
        stylePatterns,
        useCasePatterns,
      });
    },
  };
}
