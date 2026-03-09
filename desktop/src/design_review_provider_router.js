import {
  DESIGN_REVIEW_PLANNER_MODEL,
  DESIGN_REVIEW_PREVIEW_MODEL,
  buildDesignReviewPreviewPrompt,
} from "./design_review_contract.js";

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

export function resolveDesignReviewProviderSelection({
  keyStatus = {},
  preferredPlannerProvider = "",
  preferredPreviewProvider = "",
} = {}) {
  const status = asRecord(keyStatus) || {};
  const plannerProvider =
    readFirstString(preferredPlannerProvider) ||
    (status.openai ? "openai" : status.openrouter ? "openrouter" : status.gemini ? "google" : "auto");
  const previewProvider =
    readFirstString(preferredPreviewProvider) ||
    (status.gemini ? "google" : status.openrouter ? "openrouter" : "auto");
  return {
    plannerProvider,
    previewProvider,
  };
}

export function createDesignReviewProviderRouter({
  requestProvider = null,
  keyStatus = {},
  preferredPlannerProvider = "",
  preferredPreviewProvider = "",
} = {}) {
  const providerSelection = resolveDesignReviewProviderSelection({
    keyStatus,
    preferredPlannerProvider,
    preferredPreviewProvider,
  });

  async function runProviderRequest(request) {
    if (typeof requestProvider !== "function") {
      throw new Error("Design-review provider request handler is unavailable.");
    }
    return requestProvider(request);
  }

  return {
    providerSelection,
    async runPlanner({ request = {}, prompt = "", images = [] } = {}) {
      return runProviderRequest({
        kind: "planner",
        provider: providerSelection.plannerProvider,
        model: DESIGN_REVIEW_PLANNER_MODEL,
        requestId: request?.requestId || null,
        prompt,
        images,
      });
    },
    async runUploadAnalysis({ image = {}, prompt = "" } = {}) {
      return runProviderRequest({
        kind: "upload_analysis",
        provider: providerSelection.plannerProvider,
        model: DESIGN_REVIEW_PLANNER_MODEL,
        image,
        prompt,
      });
    },
    async runPreview({ request = {}, proposal = {}, inputImage = null, outputPath = "" } = {}) {
      return runProviderRequest({
        kind: "preview",
        provider: providerSelection.previewProvider,
        model: DESIGN_REVIEW_PREVIEW_MODEL,
        requestId: request?.requestId || null,
        inputImage,
        outputPath,
        prompt: buildDesignReviewPreviewPrompt({ request, proposal }),
        proposal,
      });
    },
  };
}
