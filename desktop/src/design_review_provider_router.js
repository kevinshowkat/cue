import {
  DESIGN_REVIEW_PLANNER_MODEL,
  DESIGN_REVIEW_PREVIEW_MODEL,
  buildDesignReviewPreviewPrompt,
} from "./design_review_contract.js";

const VALID_PLANNER_PROVIDERS = new Set(["openai", "openrouter"]);
const VALID_PREVIEW_PROVIDERS = new Set(["google", "openrouter"]);
const DESIGN_REVIEW_PLANNER_PROVIDER_ERROR =
  "Design review planner requires OPENAI_API_KEY or OPENROUTER_API_KEY.";

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

function normalizeProviderPreference(value, validProviders) {
  const provider = readFirstString(value).toLowerCase();
  return validProviders.has(provider) ? provider : "";
}

export function resolveDesignReviewProviderSelection({
  keyStatus = {},
  preferredPlannerProvider = "",
  preferredPreviewProvider = "",
} = {}) {
  const status = asRecord(keyStatus) || {};
  const preferredPlanner = normalizeProviderPreference(preferredPlannerProvider, VALID_PLANNER_PROVIDERS);
  const preferredPreview = normalizeProviderPreference(preferredPreviewProvider, VALID_PREVIEW_PROVIDERS);

  let plannerProvider = "missing";
  if (preferredPlanner === "openai" && status.openai) {
    plannerProvider = "openai";
  } else if (preferredPlanner === "openrouter" && status.openrouter) {
    plannerProvider = "openrouter";
  } else if (status.openai) {
    plannerProvider = "openai";
  } else if (status.openrouter) {
    plannerProvider = "openrouter";
  }

  const previewProvider =
    (preferredPreview === "google" && status.gemini) || (preferredPreview === "openrouter" && status.openrouter)
      ? preferredPreview
      : status.gemini
        ? "google"
        : status.openrouter
          ? "openrouter"
          : "auto";
  return {
    plannerProvider,
    previewProvider,
  };
}

export function createDesignReviewProviderRouter({
  requestProvider = null,
  keyStatus = {},
  getKeyStatus = null,
  preferredPlannerProvider = "",
  preferredPreviewProvider = "",
} = {}) {
  async function runProviderRequest(request) {
    if (typeof requestProvider !== "function") {
      throw new Error("Design-review provider request handler is unavailable.");
    }
    return requestProvider(request);
  }

  async function resolveProviderSelectionLive() {
    let liveKeyStatus = keyStatus;
    if (typeof getKeyStatus === "function") {
      try {
        const next = await getKeyStatus();
        if (next && typeof next === "object") {
          liveKeyStatus = next;
        }
      } catch {
        // Keep the last known fallback if key-status refresh fails.
      }
    }
    return resolveDesignReviewProviderSelection({
      keyStatus: liveKeyStatus,
      preferredPlannerProvider,
      preferredPreviewProvider,
    });
  }

  function assertPlannerProviderAvailable(providerSelection) {
    if (!VALID_PLANNER_PROVIDERS.has(providerSelection?.plannerProvider)) {
      throw new Error(DESIGN_REVIEW_PLANNER_PROVIDER_ERROR);
    }
  }

  return {
    get providerSelection() {
      return resolveDesignReviewProviderSelection({
        keyStatus,
        preferredPlannerProvider,
        preferredPreviewProvider,
      });
    },
    async runPlanner({ request = {}, prompt = "", images = [] } = {}) {
      const providerSelection = await resolveProviderSelectionLive();
      assertPlannerProviderAvailable(providerSelection);
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
      const providerSelection = await resolveProviderSelectionLive();
      assertPlannerProviderAvailable(providerSelection);
      return runProviderRequest({
        kind: "upload_analysis",
        provider: providerSelection.plannerProvider,
        model: DESIGN_REVIEW_PLANNER_MODEL,
        image,
        prompt,
      });
    },
    async runPreview({ request = {}, proposal = {}, inputImage = null, outputPath = "" } = {}) {
      const providerSelection = await resolveProviderSelectionLive();
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
