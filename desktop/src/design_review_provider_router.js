import {
  DESIGN_REVIEW_FINAL_APPLY_MODEL,
  DESIGN_REVIEW_PLANNER_MODEL,
  DESIGN_REVIEW_PREVIEW_MODEL,
  buildDesignReviewApplyRequest,
  buildDesignReviewPreviewPrompt,
  normalizeDesignReviewApplyModel,
} from "./design_review_contract.js";

const VALID_PLANNER_PROVIDERS = new Set(["openai", "openrouter"]);
const VALID_PREVIEW_PROVIDERS = new Set(["google", "openrouter"]);
const VALID_APPLY_PROVIDERS = new Set(["google", "openrouter"]);
const DESIGN_REVIEW_PLANNER_PROVIDER_ERROR =
  "Design review planner requires OPENAI_API_KEY or OPENROUTER_API_KEY.";
const DESIGN_REVIEW_APPLY_PROVIDER_ERROR =
  "Design review final apply requires GEMINI_API_KEY or GOOGLE_API_KEY or OPENROUTER_API_KEY.";
const DESIGN_REVIEW_PROVIDER_COMMAND = "run_design_review_provider_request";

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

function normalizeProviderPreference(value, validProviders) {
  const provider = readFirstString(value).toLowerCase();
  return validProviders.has(provider) ? provider : "";
}

function normalizeImagePathRecord(value) {
  if (typeof value === "string") {
    const path = readFirstString(value) || null;
    return path ? { path } : null;
  }
  const record = asRecord(value);
  if (!record) return null;
  const path = readFirstString(record.path, record.imagePath, record.image_path) || null;
  if (!path) return null;
  return {
    imageId: readFirstString(record.imageId, record.image_id, record.id) || null,
    path,
  };
}

function resolveProviderApiPlan(request = {}) {
  const kind = readFirstString(request?.kind) || "unknown";
  const provider = readFirstString(request?.provider) || "unknown";
  if (kind === "planner" && provider === "openai") {
    return {
      primaryTransport: "responses_websocket",
      fallbackTransport: "responses_http_fallback_on_transport_error",
    };
  }
  if (kind === "planner" && provider === "openrouter") {
    return {
      primaryTransport: "chat_completions",
    };
  }
  if (kind === "upload_analysis" && provider === "openai") {
    return {
      primaryTransport: "responses_http",
    };
  }
  if (kind === "upload_analysis" && provider === "openrouter") {
    return {
      primaryTransport: "chat_completions",
    };
  }
  if (kind === "preview" && provider === "google") {
    return {
      primaryTransport: "gemini_image_preview",
    };
  }
  if (kind === "preview" && provider === "openrouter") {
    return {
      primaryTransport: "openrouter_image_generation",
    };
  }
  if (kind === "apply" && provider === "google") {
    return {
      primaryTransport: "generate_content",
    };
  }
  if (kind === "apply" && provider === "openrouter") {
    return {
      primaryTransport: "responses",
    };
  }
  return {
    primaryTransport: "unknown",
  };
}

function parseProviderErrorEnvelope(error) {
  const raw = readFirstString(error?.message, error);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function buildProviderDebugInfo(request = {}, { response = null, error = null } = {}) {
  const providerRequest = cloneJson(request);
  const targetImagePath = readFirstString(
    request?.targetImage?.path,
    request?.targetImagePath,
    request?.target_image_path
  ) || null;
  const referenceImagePaths = (Array.isArray(request?.referenceImages) ? request.referenceImages : [])
    .map((entry) => normalizeImagePathRecord(entry)?.path)
    .filter(Boolean);
  const requestedModel = readFirstString(
    response?.requestedModel,
    response?.requested_model,
    request?.requestedModel,
    request?.requested_model,
    request?.model
  ) || null;
  const normalizedModel =
    readFirstString(
      response?.normalizedModel,
      response?.normalized_model,
      request?.normalizedModel,
      request?.normalized_model
    ) ||
    (readFirstString(request?.kind) === "apply" ? normalizeDesignReviewApplyModel(requestedModel) : null);
  const providerResponse = asRecord(response)
    ? {
        provider: readFirstString(response.provider) || null,
        model: readFirstString(response.model) || null,
        requestedModel: readFirstString(response.requestedModel, response.requested_model) || null,
        normalizedModel: readFirstString(response.normalizedModel, response.normalized_model) || null,
        transport: readFirstString(response.transport) || null,
        responseId: readFirstString(response.responseId, response.response_id) || null,
        outputPath: readFirstString(response.outputPath, response.outputPreviewRef) || null,
        text:
          readFirstString(response.text, response.outputText, response.rawText) ||
          null,
      }
    : null;
  const provider = readFirstString(response?.provider, request?.provider) || null;
  const transport =
    readFirstString(response?.transport, request?.transport) || resolveProviderApiPlan(request).primaryTransport || null;
  return {
    capturedAt: new Date().toISOString(),
    tauriCommand: DESIGN_REVIEW_PROVIDER_COMMAND,
    provider,
    requestedModel,
    normalizedModel,
    transport,
    route: {
      kind: readFirstString(request?.kind) || null,
      provider,
      requestedModel,
      normalizedModel,
      model: requestedModel,
      apiPlan: resolveProviderApiPlan(request),
    },
    prompt: readFirstString(request?.prompt) || null,
    targetImagePath,
    referenceImagePaths,
    outputPath:
      readFirstString(response?.outputPath, response?.outputPreviewRef, request?.outputPath, request?.output_path) ||
      null,
    providerRequest,
    providerResponse,
    failure: error
      ? {
          name: readFirstString(error?.name) || null,
          message: readFirstString(error?.message, error) || "Design review provider request failed.",
        }
      : null,
  };
}

function decorateProviderError(error, request = {}) {
  const envelope = parseProviderErrorEnvelope(error);
  const message =
    readFirstString(envelope?.message, error?.message, error) || "Design review provider request failed.";
  const wrapped = error instanceof Error ? error : new Error(message);
  if (!wrapped.message) wrapped.message = message;
  const baseDebugInfo = buildProviderDebugInfo(request, { error });
  wrapped.debugInfo = {
    ...baseDebugInfo,
    ...(asRecord(envelope?.debugInfo) || {}),
    route: {
      ...baseDebugInfo.route,
      ...(asRecord(envelope?.debugInfo?.route) || {}),
    },
    providerResponse: baseDebugInfo.providerResponse,
    providerRequest: baseDebugInfo.providerRequest,
    failure: {
      ...baseDebugInfo.failure,
      ...(asRecord(envelope?.failure) || {}),
      message,
    },
  };
  return wrapped;
}

function decorateProviderResult(result, request = {}) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return {
      value: result,
      debugInfo: buildProviderDebugInfo(request, {
        response: { text: readFirstString(result) || null },
      }),
    };
  }
  return {
    ...result,
    debugInfo: buildProviderDebugInfo(request, { response: result }),
  };
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
  const applyProvider = status.gemini ? "google" : status.openrouter ? "openrouter" : "missing";
  return {
    plannerProvider,
    previewProvider,
    applyProvider,
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
    try {
      const result = await requestProvider(request);
      return decorateProviderResult(result, request);
    } catch (error) {
      throw decorateProviderError(error, request);
    }
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

  function assertApplyProviderAvailable(providerSelection) {
    if (!VALID_APPLY_PROVIDERS.has(providerSelection?.applyProvider)) {
      throw new Error(DESIGN_REVIEW_APPLY_PROVIDER_ERROR);
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
    async runApply({ request = {}, proposal = {}, targetImage = null, referenceImages = [], outputPath = "" } = {}) {
      const providerSelection = await resolveProviderSelectionLive();
      assertApplyProviderAvailable(providerSelection);
      return runProviderRequest(
        buildDesignReviewApplyRequest({
          request,
          proposal,
          targetImage,
          referenceImages,
          outputPath,
          provider: providerSelection.applyProvider,
          model: DESIGN_REVIEW_FINAL_APPLY_MODEL,
        })
      );
    },
  };
}
