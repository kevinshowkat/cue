const DESIGN_REVIEW_DEFAULT_SLOT_COUNT = 3;

export const DESIGN_REVIEW_REQUEST_SCHEMA = "design-review-request-v1";
export const DESIGN_REVIEW_PROPOSAL_SCHEMA = "design-review-proposal-v1";
export const DESIGN_REVIEW_PREVIEW_JOB_SCHEMA = "proposal-preview-job-v1";
export const DESIGN_REVIEW_APPLY_REQUEST_SCHEMA = "design-review-apply-request-v1";
export const DESIGN_REVIEW_ACCOUNT_MEMORY_SCHEMA = "design-review-account-memory-v1";
export const DESIGN_REVIEW_UPLOAD_ANALYSIS_SCHEMA = "design-review-upload-analysis-v1";
export const DESIGN_REVIEW_PLANNER_MODEL = "gpt-5.4";
export const DESIGN_REVIEW_PREVIEW_MODEL = "gemini-3.1-flash-image-preview";
// Provider-facing Gemini model id for the final apply path (marketed as Nano Banana 2).
export const DESIGN_REVIEW_FINAL_APPLY_MODEL = "gemini-3.1-flash-image-preview";
export const DESIGN_REVIEW_TRIGGER = "design_review_button";

const KNOWN_ACTION_TYPES = Object.freeze({
  cut_out_subject: "subject_isolation",
  subject_isolation: "subject_isolation",
  remove_object: "targeted_remove",
  targeted_remove: "targeted_remove",
  replace_background: "background_replace",
  background_replace: "background_replace",
  crop_or_outpaint: "crop_or_outpaint",
  reframe: "crop_or_outpaint",
  generate_variants: "identity_preserving_variation",
  identity_preserving_variation: "identity_preserving_variation",
});

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function readFirstString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function clampText(value, maxLen = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
}

function normalizeProposalEffectStatement(value, maxLen = 140) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const compact = clampText(text, maxLen);
  if (!compact || /[.!?…]$/.test(compact)) return compact;
  return `${compact}.`;
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

function normalizeBounds(raw) {
  const rect = asRecord(raw);
  if (!rect) return null;
  const x = Number(rect.x);
  const y = Number(rect.y);
  const width = Number(rect.width ?? rect.w);
  const height = Number(rect.height ?? rect.h);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return {
    x,
    y,
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

function nowId(prefix = "review") {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${stamp}${rand}`;
}

function selectionStateFromInputs({
  activeRegionCandidateId = "",
  regionSelectionActive = false,
  selectedImageIds = [],
} = {}) {
  if (String(activeRegionCandidateId || "").trim()) return "region";
  if (regionSelectionActive) return "region";
  if (Array.isArray(selectedImageIds) && selectedImageIds.length) return "subject";
  return "none";
}

function normalizeImageIdentityHints({
  imagesInView = [],
  cachedImageAnalyses = [],
  primaryImageId = null,
  selectedImageIds = [],
} = {}) {
  const images = Array.isArray(imagesInView) ? imagesInView.filter((item) => item && typeof item === "object") : [];
  const analyses = Array.isArray(cachedImageAnalyses)
    ? cachedImageAnalyses.filter((entry) => entry && typeof entry === "object")
    : [];
  const selectedSet = new Set(uniqueStrings(selectedImageIds || []));
  const normalizedPrimaryImageId = readFirstString(primaryImageId) || null;
  const findAnalysisForImage = (image = null) => {
    const imageId = readFirstString(image?.id, image?.imageId, image?.image_id);
    const imagePath = readFirstString(image?.path, image?.imagePath, image?.image_path);
    return analyses.find((analysis) => {
      const analysisImageId = readFirstString(analysis?.imageId, analysis?.image_id);
      const analysisImagePath = readFirstString(analysis?.imagePath, analysis?.image_path);
      if (imageId && analysisImageId && analysisImageId === imageId) return true;
      if (imagePath && analysisImagePath && analysisImagePath === imagePath) return true;
      return false;
    }) || null;
  };
  return images.slice(0, 6).map((image, index) => {
    const imageId = readFirstString(image?.id, image?.imageId, image?.image_id) || null;
    const analysis = findAnalysisForImage(image);
    const subjectTags = uniqueStrings(analysis?.subjectTags || analysis?.subject_tags || [], { limit: 4 });
    const styleTags = uniqueStrings(analysis?.styleTags || analysis?.style_tags || [], { limit: 3 });
    const label = clampText(
      readFirstString(image?.label, image?.name, image?.title, image?.path, image?.imagePath) || `Image ${index + 1}`,
      80
    );
    const subject = clampText(subjectTags[0] || label, 60);
    const role =
      imageId && normalizedPrimaryImageId && imageId === normalizedPrimaryImageId
        ? "target"
        : imageId && selectedSet.has(imageId)
          ? "selected_reference"
          : "reference";
    return {
      imageId,
      role,
      label,
      subject,
      summary: clampText(analysis?.summary, 120) || null,
      subjectTags,
      styleTags,
    };
  });
}

function normalizeTargetRegion(raw = {}) {
  const record = asRecord(raw) || {};
  const markIds = uniqueStrings(record.markIds || record.mark_ids || [], { limit: 6 });
  const regionCandidateId = readFirstString(record.regionCandidateId, record.region_candidate_id) || null;
  const bounds = normalizeBounds(record.bounds);
  return {
    markIds,
    regionCandidateId,
    bounds,
  };
}

function normalizeVisibleCanvasApplyImages(request = {}) {
  const visibleCanvasContext = asRecord(request.visibleCanvasContext) || {};
  const images = Array.isArray(visibleCanvasContext.images) ? visibleCanvasContext.images : [];
  const byId = new Map();
  const ordered = [];
  for (const rawImage of images) {
    const record = asRecord(rawImage);
    if (!record) continue;
    const imageId = readFirstString(record.id, record.imageId, record.image_id) || null;
    const path = readFirstString(record.path, record.imagePath, record.image_path) || null;
    if (!imageId && !path) continue;
    const existing = imageId ? byId.get(imageId) : null;
    if (existing) {
      if (!existing.path && path) existing.path = path;
      continue;
    }
    if (path && ordered.some((entry) => entry.path === path)) continue;
    const next = { imageId, path };
    ordered.push(next);
    if (imageId) byId.set(imageId, next);
  }
  return { ordered, byId };
}

function resolveApplyImageFromVisibleCanvas(imageId = null, visibleImagesById = null) {
  const normalizedImageId = readFirstString(imageId) || null;
  if (!normalizedImageId || !(visibleImagesById instanceof Map)) return null;
  const match = visibleImagesById.get(normalizedImageId);
  return match?.path
    ? {
        imageId: match.imageId || normalizedImageId,
        path: match.path,
      }
    : null;
}

function normalizeApplyImage(rawImage = null, { fallbackImageId = null, visibleImagesById = null } = {}) {
  if (typeof rawImage === "string") {
    const text = readFirstString(rawImage) || null;
    if (!text) return null;
    return (
      resolveApplyImageFromVisibleCanvas(text, visibleImagesById) || {
        imageId: readFirstString(fallbackImageId) || null,
        path: text,
      }
    );
  }
  const record = asRecord(rawImage);
  if (!record) {
    return resolveApplyImageFromVisibleCanvas(fallbackImageId, visibleImagesById);
  }
  const imageId = readFirstString(record.imageId, record.image_id, record.id, fallbackImageId) || null;
  const path = readFirstString(record.path, record.imagePath, record.image_path) || null;
  if (path) return { imageId, path };
  return resolveApplyImageFromVisibleCanvas(imageId, visibleImagesById);
}

function collectApplyReferenceImages({ referenceImages = [], visibleImages = [], visibleImagesById = null, target = null } = {}) {
  const references = [];
  const appendImage = (rawImage = null) => {
    const image = normalizeApplyImage(rawImage, { visibleImagesById });
    if (!image?.path) return;
    if (target?.path && image.path === target.path) return;
    if (target?.imageId && image.imageId && image.imageId === target.imageId) return;
    if (references.some((entry) => entry.path === image.path)) return;
    references.push(image);
  };

  const explicitImages = Array.isArray(referenceImages) ? referenceImages : [];
  explicitImages.forEach(appendImage);
  if (!references.length) {
    visibleImages.forEach(appendImage);
  }
  return references;
}

export function normalizeDesignReviewApplyModel(rawModel = "") {
  const trimmed = readFirstString(rawModel);
  if (!trimmed) return DESIGN_REVIEW_FINAL_APPLY_MODEL;
  const lower = trimmed.toLowerCase();
  if (lower === "gemini nano banana 2" || lower === "nano banana 2") {
    return DESIGN_REVIEW_FINAL_APPLY_MODEL;
  }
  const withoutModelsPrefix = lower.startsWith("models/") ? trimmed.slice("models/".length).trim() : trimmed;
  const withoutGooglePrefix =
    withoutModelsPrefix.toLowerCase().startsWith("google/")
      ? withoutModelsPrefix.slice("google/".length).trim()
      : withoutModelsPrefix;
  return withoutGooglePrefix || DESIGN_REVIEW_FINAL_APPLY_MODEL;
}

export function buildDesignReviewRequest({
  shellContext = {},
  visibleCanvasRef = null,
  visualPrompt = null,
  regionCandidates = [],
  activeRegionCandidateId = null,
  selectedImageIds = null,
  cachedImageAnalyses = [],
  accountMemorySummary = null,
  requestId = null,
  sessionId = null,
  trigger = DESIGN_REVIEW_TRIGGER,
  uploadAnalysisRef = null,
  slotCount = DESIGN_REVIEW_DEFAULT_SLOT_COUNT,
} = {}) {
  const shell = asRecord(shellContext) || {};
  const visual = asRecord(visualPrompt) || {};
  const imagesInView = Array.isArray(shell.images) ? shell.images : Array.isArray(visual.images) ? visual.images : [];
  const imageIdsInView = uniqueStrings(
    imagesInView.map((item) => readFirstString(item?.id, item?.image_id)),
    { limit: 12 }
  );
  const selected = uniqueStrings(
    Array.isArray(selectedImageIds) ? selectedImageIds : shell.selectedImageIds || [],
    { limit: 6 }
  );
  const primaryImageId =
    readFirstString(shell.activeImageId, visual.canvas?.active_image_id, selected[0], imageIdsInView[0]) || null;
  const marks = Array.isArray(visual.marks) ? visual.marks.filter((item) => item && typeof item === "object") : [];
  const markIds = uniqueStrings(marks.map((item) => item.id), { limit: 16 });
  const chosenRegionCandidate = (Array.isArray(regionCandidates) ? regionCandidates : []).find(
    (candidate) => readFirstString(candidate?.id, candidate?.regionCandidateId, candidate?.region_candidate_id) === String(activeRegionCandidateId || "").trim()
  );
  const selectionState = selectionStateFromInputs({
    activeRegionCandidateId,
    regionSelectionActive: Boolean(shell.regionSelectionActive),
    selectedImageIds: selected,
  });
  const analyses = (Array.isArray(cachedImageAnalyses) ? cachedImageAnalyses : [])
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({ ...entry }));
  const imageIdentityHints = normalizeImageIdentityHints({
    imagesInView,
    cachedImageAnalyses: analyses,
    primaryImageId,
    selectedImageIds: selected,
  });
  const firstAnalysisRef =
    readFirstString(uploadAnalysisRef, analyses[0]?.analysisRef, analyses[0]?.analysis_ref) || null;
  const normalizedRequestId = readFirstString(requestId) || nowId("review");
  const normalizedSessionId =
    readFirstString(sessionId, shell.activeTabId, shell.runDir ? `session:${shell.runDir}` : "") || normalizedRequestId;

  return {
    schemaVersion: DESIGN_REVIEW_REQUEST_SCHEMA,
    requestId: normalizedRequestId,
    sessionId: normalizedSessionId,
    visibleCanvasRef: readFirstString(visibleCanvasRef) || null,
    imageIdsInView,
    primaryImageId,
    markIds,
    activeRegionCandidateId: readFirstString(activeRegionCandidateId) || null,
    selectionState,
    trigger: readFirstString(trigger) || DESIGN_REVIEW_TRIGGER,
    uploadAnalysisRef: firstAnalysisRef,
    accountMemoryRef: readFirstString(accountMemorySummary?.memoryRef, accountMemorySummary?.memory_ref) || null,
    slotCount: clamp(slotCount, 2, 3),
    visibleCanvasContext: {
      runDir: readFirstString(shell.runDir, visual.run_dir) || null,
      canvasMode: readFirstString(shell.canvasMode, visual.canvas?.mode) || "single",
      imageCount:
        Number.isFinite(Number(shell.imageCount)) && Number(shell.imageCount) >= 0
          ? Number(shell.imageCount)
          : imageIdsInView.length,
      activeImageId: readFirstString(shell.activeImageId, visual.canvas?.active_image_id) || null,
      canvas: asRecord(visual.canvas) ? { ...visual.canvas } : null,
      images: imagesInView.map((item) => ({ ...item })),
    },
    imageIdentityHints,
    marks: marks.map((item) => ({ ...item })),
    regionCandidates: (Array.isArray(regionCandidates) ? regionCandidates : [])
      .filter((item) => item && typeof item === "object")
      .map((item, index) => ({
        id:
          readFirstString(item.id, item.regionCandidateId, item.region_candidate_id) ||
          `region_${index + 1}`,
        imageId: readFirstString(item.imageId, item.image_id, primaryImageId) || null,
        source: readFirstString(item.source) || "magic_select",
        clickPoint: asRecord(item.clickPoint || item.click_point) ? { ...(item.clickPoint || item.click_point) } : null,
        maskRef: readFirstString(item.maskRef, item.mask_ref) || null,
        bounds: normalizeBounds(item.bounds),
        confidence: clamp(item.confidence, 0, 1),
        rank: Math.max(1, Number(item.rank) || index + 1),
        cycleGroupId: readFirstString(item.cycleGroupId, item.cycle_group_id) || null,
        isActive:
          String(activeRegionCandidateId || "").trim() !== ""
            ? readFirstString(item.id, item.regionCandidateId, item.region_candidate_id) === String(activeRegionCandidateId || "").trim()
            : Boolean(item.isActive ?? item.is_active),
      })),
    selectedImageIds: selected,
    cachedImageAnalyses: analyses,
    chosenRegionCandidate: chosenRegionCandidate ? { ...chosenRegionCandidate } : null,
    accountMemorySummary: accountMemorySummary && typeof accountMemorySummary === "object" ? { ...accountMemorySummary } : null,
  };
}

export function buildDesignReviewPlannerPrompt(request = {}) {
  const normalized = asRecord(request) || {};
  const slotCount = clamp(normalized.slotCount, 2, 3);
  const identityHints = Array.isArray(normalized.imageIdentityHints)
    ? normalized.imageIdentityHints
        .filter((entry) => entry && typeof entry === "object")
        .slice(0, 4)
        .map((entry) => ({
          imageId: readFirstString(entry?.imageId) || null,
          role: readFirstString(entry?.role) || "reference",
          subject: clampText(entry?.subject, 60) || null,
          summary: clampText(entry?.summary, 90) || null,
          subjectTags: uniqueStrings(entry?.subjectTags || [], { limit: 3 }),
        }))
    : [];
  const promptSections = [
    "View the canvas image and visible annotations only.",
    "An action is a concrete visual edit the editor could apply to the image.",
    "Write actions as short edit intents, not advice, critique, or conversation.",
    "Make previewBrief and applyBrief specific, positive, and verb-first.",
    "Use concise effect statements, not rationale essays.",
    "Use the whole visible canvas as context, not just the local annotation area.",
    "Treat annotations and the chosen region candidate as focus hints, not crop-only constraints.",
    "Use image identity hints when they exist so subjects are named concretely; do not say second image or reference image generically.",
    "Prefer edits that can plausibly route through the normal execution layer later.",
    `Return ${slotCount} ranked proposals as JSON only.`,
  ];
  if (identityHints.length) {
    promptSections.push(
      JSON.stringify(
        {
          imageIdentityHints: identityHints,
        },
        null,
        2
      )
    );
  }
  promptSections.push(
    JSON.stringify(
      {
        proposals: [
          {
            label: "2-5 word edit title",
            imageId: "target image id",
            targetRegion: {
              markIds: ["optional annotation ids"],
              regionCandidateId: "optional region candidate id",
              bounds: { x: 0, y: 0, width: 0, height: 0 },
            },
            actionType: "short edit intent like remove_object, brighten_area, simplify_background",
            why: "short reason if needed",
            previewBrief: "short verb-first effect statement",
            applyBrief: "short verb-first sentence describing the exact edit",
            negativeConstraints: ["short thing to preserve"],
          },
        ],
      },
      null,
      2
    )
  );
  return promptSections.join("\n\n");
}

export function buildUploadAnalysisPrompt({
  imageId = null,
  imagePath = null,
  priorSummary = null,
} = {}) {
  const payload = {
    imageId: readFirstString(imageId) || null,
    imagePath: readFirstString(imagePath) || null,
    priorSummary: clampText(priorSummary, 280) || null,
    requestedShape: {
      summary: "one compact sentence",
      subjectTags: ["short subject tags"],
      styleTags: ["short style tags"],
      useCaseTags: ["likely use-case patterns"],
      actionBiases: ["action types that seem likely for later review"],
      regionHints: [
        {
          label: "region name",
          reason: "why it matters",
          bounds: { x: 0, y: 0, width: 0, height: 0 },
        },
      ],
    },
  };
  return [
    "Analyze this uploaded image for later design-review ranking only.",
    "Return JSON only. Keep the output compact and descriptive.",
    JSON.stringify(payload, null, 2),
  ].join("\n\n");
}

export function buildDesignReviewPreviewPrompt({ request = {}, proposal = {} } = {}) {
  const normalizedRequest = asRecord(request) || {};
  const normalizedProposal = asRecord(proposal) || {};
  const negativeConstraints = uniqueStrings(
    normalizedProposal.negativeConstraints || normalizedProposal.negative_constraints || [],
    { limit: 8 }
  );
  const payload = {
    requestId: normalizedRequest.requestId || null,
    imageId: normalizedProposal.imageId || normalizedRequest.primaryImageId || null,
    label: clampText(normalizedProposal.label, 90),
    actionType: clampText(normalizedProposal.actionType, 96),
    why: clampText(normalizedProposal.why, 220),
    previewBrief: clampText(normalizedProposal.previewBrief, 240),
    applyBrief: clampText(normalizedProposal.applyBrief, 220),
    negativeConstraints,
  };
  return [
    "Render a low-resolution visual preview for this Juggernaut proposal.",
    "Preserve composition unless the proposal explicitly reframes it.",
    "Treat negativeConstraints as hard limits.",
    JSON.stringify(payload, null, 2),
  ].join("\n\n");
}

function buildDesignReviewApplyRequestSnapshot(request = {}) {
  const normalized = asRecord(request) || {};
  const visibleCanvasContext = asRecord(normalized.visibleCanvasContext) || {};
  const chosenRegionCandidate = asRecord(normalized.chosenRegionCandidate) || null;
  return {
    requestId: readFirstString(normalized.requestId) || null,
    sessionId: readFirstString(normalized.sessionId) || null,
    primaryImageId: readFirstString(normalized.primaryImageId, visibleCanvasContext.activeImageId) || null,
    imageIdsInView: uniqueStrings(normalized.imageIdsInView || [], { limit: 12 }),
    selectedImageIds: uniqueStrings(normalized.selectedImageIds || [], { limit: 8 }),
    markIds: uniqueStrings(normalized.markIds || [], { limit: 8 }),
    activeRegionCandidateId: readFirstString(normalized.activeRegionCandidateId) || null,
    selectionState: readFirstString(normalized.selectionState) || "none",
    visibleCanvasContext: {
      runDir: readFirstString(visibleCanvasContext.runDir) || null,
      canvasMode: readFirstString(visibleCanvasContext.canvasMode) || null,
      imageCount:
        Number.isFinite(Number(visibleCanvasContext.imageCount)) && Number(visibleCanvasContext.imageCount) >= 0
          ? Number(visibleCanvasContext.imageCount)
          : null,
      activeImageId: readFirstString(visibleCanvasContext.activeImageId) || null,
    },
    chosenRegionCandidate: chosenRegionCandidate
      ? {
          id: readFirstString(
            chosenRegionCandidate.id,
            chosenRegionCandidate.regionCandidateId,
            chosenRegionCandidate.region_candidate_id
          ) || null,
          imageId: readFirstString(chosenRegionCandidate.imageId, chosenRegionCandidate.image_id) || null,
          bounds: normalizeBounds(chosenRegionCandidate.bounds),
        }
      : null,
  };
}

export function buildDesignReviewApplyPrompt({ request = {}, proposal = {} } = {}) {
  const normalizedProposal = asRecord(proposal) || {};
  const negativeConstraints = uniqueStrings(
    normalizedProposal.negativeConstraints || normalizedProposal.negative_constraints || [],
    { limit: 8 }
  );
  const payload = {
    requestSnapshot: buildDesignReviewApplyRequestSnapshot(request),
    proposal: {
      label: clampText(normalizedProposal.label, 90),
      actionType: clampText(normalizedProposal.actionType, 96),
      applyBrief: clampText(normalizedProposal.applyBrief, 320),
      targetRegion: normalizeTargetRegion(normalizedProposal.targetRegion || normalizedProposal.target_region || {}),
      negativeConstraints,
    },
  };
  return [
    "Apply this accepted Juggernaut design-review proposal to exactly one editable image.",
    "Edit only targetImage.",
    "Use referenceImages[] as guidance only and do not modify or return separate outputs for them.",
    "Return exactly one final rendered image for targetImage.",
    "Treat negativeConstraints as hard requirements.",
    JSON.stringify(payload, null, 2),
  ].join("\n\n");
}

export function buildDesignReviewApplyRequest({
  request = {},
  proposal = {},
  targetImage = null,
  referenceImages = [],
  outputPath = "",
  provider = "google",
  model = DESIGN_REVIEW_FINAL_APPLY_MODEL,
} = {}) {
  const normalizedRequest = asRecord(request) || {};
  const normalizedProposal = asRecord(proposal) || {};
  const requestedModel = readFirstString(model) || DESIGN_REVIEW_FINAL_APPLY_MODEL;
  const normalizedModel = normalizeDesignReviewApplyModel(requestedModel);
  const { ordered: visibleImages, byId: visibleImagesById } = normalizeVisibleCanvasApplyImages(normalizedRequest);
  const target = normalizeApplyImage(targetImage, {
    fallbackImageId: readFirstString(normalizedProposal.imageId, normalizedRequest.primaryImageId) || null,
    visibleImagesById,
  });
  const referenceImageList = collectApplyReferenceImages({
    referenceImages,
    visibleImages,
    visibleImagesById,
    target,
  });
  return {
    schemaVersion: DESIGN_REVIEW_APPLY_REQUEST_SCHEMA,
    kind: "apply",
    provider: readFirstString(provider) || "google",
    requestId: readFirstString(normalizedRequest.requestId) || null,
    sessionId: readFirstString(normalizedRequest.sessionId) || null,
    proposalId: readFirstString(normalizedProposal.proposalId) || null,
    requestedModel,
    normalizedModel,
    model: requestedModel,
    prompt: buildDesignReviewApplyPrompt({
      request: normalizedRequest,
      proposal: normalizedProposal,
    }),
    targetImage: target,
    referenceImages: referenceImageList,
    outputPath: readFirstString(outputPath) || null,
  };
}

function stripJsonFences(raw = "") {
  let text = String(raw || "").trim();
  if (!text) return "";
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?/i, "").trim();
    text = text.replace(/```$/i, "").trim();
  }
  return text;
}

function extractBalancedJson(raw = "") {
  const text = String(raw || "");
  const results = [];
  const stack = [];
  let start = -1;
  let quote = "";
  let escaped = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = "";
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "{" || ch === "[") {
      if (!stack.length) start = i;
      stack.push(ch);
      continue;
    }
    if (ch !== "}" && ch !== "]") continue;
    const open = stack[stack.length - 1];
    if ((open === "{" && ch === "}") || (open === "[" && ch === "]")) {
      stack.pop();
      if (!stack.length && start >= 0) {
        results.push(text.slice(start, i + 1));
        start = -1;
      }
    } else {
      stack.length = 0;
      start = -1;
    }
  }
  return results;
}

function parseJsonLoose(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  const candidates = [text, stripJsonFences(text), ...extractBalancedJson(text)];
  const seen = new Set();
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    const attempts = [value, value.replace(/,\s*([}\]])/g, "$1")];
    for (const attempt of attempts) {
      try {
        return JSON.parse(attempt);
      } catch {
        // continue
      }
    }
  }
  return null;
}

function normalizeActionType(raw = "") {
  const normalized = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return normalized || "custom_edit";
}

function normalizeNegativeConstraints(raw = []) {
  return uniqueStrings(Array.isArray(raw) ? raw : String(raw || "").split(/\n+/), { limit: 8 }).map((entry) =>
    clampText(entry, 120)
  );
}

function normalizeProposal(rawProposal = {}, request = {}, { index = 0 } = {}) {
  const raw = asRecord(rawProposal) || {};
  const imageId =
    readFirstString(raw.imageId, raw.image_id, request.primaryImageId, request.selectedImageIds?.[0]) || null;
  const label = clampText(readFirstString(raw.label, raw.title, raw.name) || `Proposal ${index + 1}`, 80);
  const actionType = normalizeActionType(
    readFirstString(raw.actionType, raw.action_type, raw.actionIntent, raw.action_intent, raw.capability)
  );
  const capability = KNOWN_ACTION_TYPES[actionType] || null;
  const targetRegion = normalizeTargetRegion(raw.targetRegion || raw.target_region || {});
  if (!targetRegion.markIds.length && Array.isArray(request.markIds) && request.markIds.length) {
    targetRegion.markIds = uniqueStrings(request.markIds.slice(0, 6));
  }
  if (!targetRegion.regionCandidateId && request.activeRegionCandidateId) {
    targetRegion.regionCandidateId = String(request.activeRegionCandidateId);
  }
  const why = clampText(readFirstString(raw.why, raw.rationale, raw.reason), 160);
  const previewBrief = normalizeProposalEffectStatement(
    readFirstString(raw.previewBrief, raw.preview_brief, raw.previewPrompt),
    140
  );
  const applyBrief = normalizeProposalEffectStatement(
    readFirstString(raw.applyBrief, raw.apply_brief, raw.applyPrompt),
    180
  );
  const negativeConstraints = normalizeNegativeConstraints(raw.negativeConstraints || raw.negative_constraints || []);
  return {
    schemaVersion: DESIGN_REVIEW_PROPOSAL_SCHEMA,
    proposalId:
      readFirstString(raw.proposalId, raw.proposal_id, raw.id) || `${request.requestId || "review"}:proposal:${index + 1}`,
    requestId: request.requestId || null,
    imageId,
    label,
    title: label,
    actionType,
    capability,
    actionIntent: actionType,
    targetRegion,
    rationaleCodes: uniqueStrings(raw.rationaleCodes || raw.rationale_codes || raw.reasonCodes || [], { limit: 6 }),
    why,
    previewBrief,
    applyBrief,
    negativeConstraints,
    rank: Math.max(1, Number(raw.rank) || index + 1),
    status: "preview_pending",
  };
}

export function parseDesignReviewPlannerResponse(raw, request = {}) {
  const parsed = parseJsonLoose(raw);
  const source = asRecord(parsed) || {};
  const rawProposals = Array.isArray(source.proposals)
    ? source.proposals
    : Array.isArray(source.items)
      ? source.items
      : Array.isArray(parsed)
        ? parsed
        : [];
  const proposals = rawProposals
    .map((proposal, index) => normalizeProposal(proposal, request, { index }))
    .filter((proposal) => proposal.label && proposal.actionType)
    .slice(0, clamp(request.slotCount, 2, 3));
  return {
    ok: proposals.length > 0,
    proposals,
    rawParsed: parsed,
  };
}

export function createDesignReviewPreviewJob({
  request = {},
  proposal = {},
  rank = 1,
  status = "queued",
  outputPreviewRef = null,
  failureReason = null,
} = {}) {
  const proposalId = readFirstString(proposal.proposalId) || nowId("proposal");
  return {
    schemaVersion: DESIGN_REVIEW_PREVIEW_JOB_SCHEMA,
    previewJobId: `${proposalId}:preview:${rank}`,
    proposalId,
    renderer: DESIGN_REVIEW_PREVIEW_MODEL,
    planner: DESIGN_REVIEW_PLANNER_MODEL,
    inputImageId: readFirstString(proposal.imageId, request.primaryImageId) || null,
    rank: Math.max(1, Number(rank) || 1),
    status: readFirstString(status) || "queued",
    outputPreviewRef: readFirstString(outputPreviewRef) || null,
    failureReason: readFirstString(failureReason) || null,
  };
}

export function createDesignReviewSkeletonSlots({
  request = {},
  slotCount = DESIGN_REVIEW_DEFAULT_SLOT_COUNT,
} = {}) {
  const count = clamp(slotCount, 2, 3);
  return Array.from({ length: count }, (_, index) => {
    const previewJob = createDesignReviewPreviewJob({
      request,
      proposal: {
        proposalId: `${request.requestId || "review"}:skeleton:${index + 1}`,
        imageId: request.primaryImageId || null,
      },
      rank: index + 1,
      status: "queued",
    });
    return {
      slotId: `${request.requestId || "review"}:slot:${index + 1}`,
      rank: index + 1,
      status: "skeleton",
      proposal: null,
      previewJob,
      outputPreviewRef: null,
      error: null,
    };
  });
}
