const DESIGN_REVIEW_DEFAULT_SLOT_COUNT = 3;

export const DESIGN_REVIEW_REQUEST_SCHEMA = "design-review-request-v1";
export const DESIGN_REVIEW_PROPOSAL_SCHEMA = "design-review-proposal-v1";
export const DESIGN_REVIEW_APPLY_REQUEST_SCHEMA = "design-review-apply-request-v1";
export const DESIGN_REVIEW_ACCOUNT_MEMORY_SCHEMA = "design-review-account-memory-v1";
export const DESIGN_REVIEW_UPLOAD_ANALYSIS_SCHEMA = "design-review-upload-analysis-v1";
export const DESIGN_REVIEW_PLANNER_MODEL = "gpt-5.4";
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

function stableHash(value = "") {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function sanitizeProposalIdSegment(value = "", fallback = "proposal") {
  const normalized = readFirstString(value)
    .replace(/[^a-z0-9._:-]+/gi, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
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

function normalizeBoundsList(values = [], { limit = 6 } = {}) {
  const list = Array.isArray(values) ? values : values == null ? [] : [values];
  const out = [];
  const seen = new Set();
  for (const value of list) {
    const bounds = normalizeBounds(asRecord(value?.bounds) ? value.bounds : value);
    if (!bounds) continue;
    const key = `${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(bounds);
    if (out.length >= limit) break;
  }
  return out;
}

function normalizePathField(...values) {
  for (const value of values) {
    const direct = readFirstString(value);
    if (direct) return direct;
    const record = asRecord(value);
    const path = readFirstString(record?.path, record?.imagePath, record?.image_path);
    if (path) return path;
  }
  return "";
}

function normalizeCanvasRect(raw) {
  const rect = asRecord(raw);
  if (!rect) return null;
  const left = Number(rect.left ?? rect.x);
  const top = Number(rect.top ?? rect.y);
  const width = Number(rect.width ?? rect.w);
  const height = Number(rect.height ?? rect.h);
  if (![left, top, width, height].every(Number.isFinite)) return null;
  return {
    left,
    top,
    width: Math.max(1, width),
    height: Math.max(1, height),
    right: left + Math.max(1, width),
    bottom: top + Math.max(1, height),
  };
}

function pointInPolygon(point = null, polygon = []) {
  const px = Number(point?.x);
  const py = Number(point?.y);
  if (!Number.isFinite(px) || !Number.isFinite(py) || !Array.isArray(polygon) || polygon.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = Number(polygon[i]?.x) || 0;
    const yi = Number(polygon[i]?.y) || 0;
    const xj = Number(polygon[j]?.x) || 0;
    const yj = Number(polygon[j]?.y) || 0;
    const intersects =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / Math.max(0.000001, yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function segmentCross(a = null, b = null, c = null) {
  return (
    ((Number(b?.x) || 0) - (Number(a?.x) || 0)) * ((Number(c?.y) || 0) - (Number(a?.y) || 0)) -
    ((Number(b?.y) || 0) - (Number(a?.y) || 0)) * ((Number(c?.x) || 0) - (Number(a?.x) || 0))
  );
}

function pointOnSegment(point = null, start = null, end = null) {
  const cross = Math.abs(segmentCross(start, end, point));
  if (cross > 0.001) return false;
  const px = Number(point?.x) || 0;
  const py = Number(point?.y) || 0;
  const minX = Math.min(Number(start?.x) || 0, Number(end?.x) || 0) - 0.001;
  const maxX = Math.max(Number(start?.x) || 0, Number(end?.x) || 0) + 0.001;
  const minY = Math.min(Number(start?.y) || 0, Number(end?.y) || 0) - 0.001;
  const maxY = Math.max(Number(start?.y) || 0, Number(end?.y) || 0) + 0.001;
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

function segmentsIntersect(a1 = null, a2 = null, b1 = null, b2 = null) {
  const d1 = segmentCross(a1, a2, b1);
  const d2 = segmentCross(a1, a2, b2);
  const d3 = segmentCross(b1, b2, a1);
  const d4 = segmentCross(b1, b2, a2);
  if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) {
    if ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)) return true;
  }
  if (Math.abs(d1) <= 0.001 && pointOnSegment(b1, a1, a2)) return true;
  if (Math.abs(d2) <= 0.001 && pointOnSegment(b2, a1, a2)) return true;
  if (Math.abs(d3) <= 0.001 && pointOnSegment(a1, b1, b2)) return true;
  if (Math.abs(d4) <= 0.001 && pointOnSegment(a2, b1, b2)) return true;
  return false;
}

function pointInAxisAlignedRect(point = null, rect = null) {
  const normalizedRect = normalizeCanvasRect(rect);
  const px = Number(point?.x);
  const py = Number(point?.y);
  if (!normalizedRect || !Number.isFinite(px) || !Number.isFinite(py)) return false;
  return (
    px >= normalizedRect.left &&
    px <= normalizedRect.right &&
    py >= normalizedRect.top &&
    py <= normalizedRect.bottom
  );
}

function axisAlignedRectOverlapArea(a = null, b = null) {
  const rectA = normalizeCanvasRect(a);
  const rectB = normalizeCanvasRect(b);
  if (!rectA || !rectB) return 0;
  const overlapWidth = Math.max(0, Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left));
  const overlapHeight = Math.max(0, Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top));
  return overlapWidth * overlapHeight;
}

function segmentIntersectsAxisAlignedRect(start = null, end = null, rect = null) {
  const normalizedRect = normalizeCanvasRect(rect);
  if (!normalizedRect) return false;
  if (pointInAxisAlignedRect(start, normalizedRect) || pointInAxisAlignedRect(end, normalizedRect)) return true;
  const topLeft = { x: normalizedRect.left, y: normalizedRect.top };
  const topRight = { x: normalizedRect.right, y: normalizedRect.top };
  const bottomRight = { x: normalizedRect.right, y: normalizedRect.bottom };
  const bottomLeft = { x: normalizedRect.left, y: normalizedRect.bottom };
  return (
    segmentsIntersect(start, end, topLeft, topRight) ||
    segmentsIntersect(start, end, topRight, bottomRight) ||
    segmentsIntersect(start, end, bottomRight, bottomLeft) ||
    segmentsIntersect(start, end, bottomLeft, topLeft)
  );
}

function polylineFormsClosedLoop(points = [], bounds = null) {
  if (!Array.isArray(points) || points.length < 3) return false;
  const first = points[0];
  const last = points[points.length - 1];
  const normalizedBounds = normalizeCanvasRect(bounds);
  const threshold = normalizedBounds
    ? Math.max(18, Math.min(96, Math.min(normalizedBounds.width, normalizedBounds.height) * 0.35))
    : 36;
  return Math.hypot((Number(last?.x) || 0) - (Number(first?.x) || 0), (Number(last?.y) || 0) - (Number(first?.y) || 0)) <= threshold;
}

function polylineAxisAlignedRectOverlapScore(points = [], rect = null, bounds = null) {
  const normalizedRect = normalizeCanvasRect(rect);
  if (!normalizedRect || !Array.isArray(points) || !points.length) return 0;
  let score = 0;
  for (const point of points) {
    if (pointInAxisAlignedRect(point, normalizedRect)) score += 2;
  }
  for (let index = 1; index < points.length; index += 1) {
    if (segmentIntersectsAxisAlignedRect(points[index - 1], points[index], normalizedRect)) {
      score += 4;
    }
  }
  if (polylineFormsClosedLoop(points, bounds)) {
    const center = {
      x: normalizedRect.left + normalizedRect.width * 0.5,
      y: normalizedRect.top + normalizedRect.height * 0.5,
    };
    if (pointInPolygon(center, points)) score += 8;
  }
  if (score <= 0 && bounds) {
    score = axisAlignedRectOverlapArea(bounds, normalizedRect) > 0 ? 1 : 0;
  }
  return score;
}

function deriveHighlightImageIdsFromMark(mark = null, imagesInView = []) {
  const directImageIds = uniqueStrings(
    [readFirstString(mark?.imageId), readFirstString(mark?.sourceImageId)].filter(Boolean),
    { limit: 6 }
  );
  const normalizedPoints = Array.isArray(mark?.points)
    ? mark.points
        .map((point) => ({
          x: Number(point?.x),
          y: Number(point?.y),
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    : [];
  const normalizedBounds = normalizeCanvasRect(mark?.bounds);
  const coordinateSpace = readFirstString(mark?.coordinateSpace) || "canvas_overlay";
  if (coordinateSpace !== "canvas_overlay" && directImageIds.length) {
    return directImageIds;
  }
  const overlaps = [];
  for (const image of Array.isArray(imagesInView) ? imagesInView : []) {
    const imageId = readFirstString(image?.id, image?.imageId, image?.image_id) || null;
    const rectCss = normalizeCanvasRect(image?.rectCss);
    if (!imageId || !rectCss) continue;
    const score = polylineAxisAlignedRectOverlapScore(normalizedPoints, rectCss, normalizedBounds);
    if (score > 0) {
      overlaps.push({ imageId, score });
    }
  }
  overlaps.sort((left, right) => right.score - left.score);
  return uniqueStrings(
    [
      ...directImageIds,
      ...overlaps.map((entry) => entry.imageId),
    ],
    { limit: 6 }
  );
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

function visibleImageBoundsFromRequest(request = {}, imageId = "") {
  const normalizedImageId = readFirstString(imageId);
  if (!normalizedImageId) return null;
  const visibleCanvasContext = asRecord(request?.visibleCanvasContext) || {};
  const images = Array.isArray(visibleCanvasContext.images)
    ? visibleCanvasContext.images.filter((entry) => entry && typeof entry === "object")
    : [];
  const match =
    images.find(
      (entry) => readFirstString(entry?.id, entry?.imageId, entry?.image_id) === normalizedImageId
    ) || null;
  if (!match) return null;
  return (
    normalizeBounds(match.bounds) ||
    normalizeBounds({
      x: match?.rectCss?.x ?? match?.rectCss?.left,
      y: match?.rectCss?.y ?? match?.rectCss?.top,
      width: match?.rectCss?.width,
      height: match?.rectCss?.height,
    }) ||
    null
  );
}

function normalizeProposalPreviewImagePath(raw = {}) {
  const record = asRecord(raw) || {};
  return (
    normalizePathField(
      record.previewImagePath,
      record.preview_image_path,
      record.fullFramePreviewImagePath,
      record.full_frame_preview_image_path,
      record.previewImage,
      record.preview_image,
      record.fullFramePreview,
      record.full_frame_preview
    ) || null
  );
}

function normalizeProposalRationaleCodes(raw = {}) {
  const record = asRecord(raw) || {};
  const source =
    record.rationaleCodes ??
    record.rationale_codes ??
    record.reasonCodes ??
    record.reason_codes ??
    [];
  const values = Array.isArray(source) ? source : String(source || "").split(/[,\n]+/);
  return uniqueStrings(values, { limit: 6 });
}

function normalizeProposalPreserveRegionIds(raw = {}, focusContract = null) {
  const record = asRecord(raw) || {};
  return uniqueStrings(
    [
      ...(Array.isArray(record.preserveRegionIds) ? record.preserveRegionIds : []),
      ...(Array.isArray(record.preserve_region_ids) ? record.preserve_region_ids : []),
      ...(Array.isArray(record.preserveRegions)
        ? record.preserveRegions.map((entry) =>
            readFirstString(entry?.protectedRegionId, entry?.preserveRegionId, entry?.id)
          )
        : []),
      ...(Array.isArray(record.preserve_regions)
        ? record.preserve_regions.map((entry) =>
            readFirstString(entry?.protectedRegionId, entry?.preserveRegionId, entry?.id)
          )
        : []),
      ...protectedRegionIdsFromList(focusContract?.protectedRegions || []),
    ],
    { limit: 12 }
  );
}

function normalizeProposalChangedRegionBounds({
  raw = {},
  request = {},
  targetRegion = null,
  focusContract = null,
  imageId = null,
} = {}) {
  const record = asRecord(raw) || {};
  const explicit = normalizeBoundsList(
    record.changedRegionBounds ||
      record.changed_region_bounds ||
      record.changedRegions ||
      record.changed_regions ||
      [],
    { limit: 6 }
  );
  if (explicit.length) return explicit;
  const scopedTargetBounds = normalizeBoundsList(targetRegion?.bounds, { limit: 6 });
  if (scopedTargetBounds.length) return scopedTargetBounds;
  const focusBounds = normalizeBoundsList(
    Array.isArray(focusContract?.focusInputs)
      ? focusContract.focusInputs.map((entry) => entry?.bounds)
      : [],
    { limit: 6 }
  );
  if (focusBounds.length) return focusBounds;
  const chosenRegionBounds = normalizeBoundsList(request?.chosenRegionCandidate?.bounds, { limit: 6 });
  if (chosenRegionBounds.length) return chosenRegionBounds;
  return normalizeBoundsList(visibleImageBoundsFromRequest(request, imageId), { limit: 6 });
}

function buildStableProposalId({
  request = {},
  imageId = null,
  label = "",
  actionType = "",
  why = "",
  previewBrief = "",
  applyBrief = "",
  targetRegion = null,
  changedRegionBounds = [],
  preserveRegionIds = [],
  rationaleCodes = [],
} = {}) {
  const requestKey = sanitizeProposalIdSegment(request?.requestId, "review");
  const actionKey = sanitizeProposalIdSegment(actionType, "custom_edit");
  const fingerprint = stableHash(
    JSON.stringify({
      imageId: readFirstString(imageId) || null,
      label: clampText(label, 80) || null,
      actionType: readFirstString(actionType) || null,
      why: clampText(why, 160) || null,
      previewBrief: clampText(previewBrief, 140) || null,
      applyBrief: clampText(applyBrief, 180) || null,
      targetRegion: normalizeTargetRegion(targetRegion || {}),
      changedRegionBounds: normalizeBoundsList(changedRegionBounds, { limit: 6 }),
      preserveRegionIds: uniqueStrings(preserveRegionIds, { limit: 12 }),
      rationaleCodes: uniqueStrings(rationaleCodes, { limit: 6 }),
    })
  );
  return `${requestKey}:proposal:${actionKey}:${fingerprint}`;
}

function ensureUniqueProposalIds(proposals = []) {
  const used = new Set();
  return (Array.isArray(proposals) ? proposals : []).map((proposal, index) => {
    const baseId = readFirstString(proposal?.proposalId) || `proposal:${index + 1}`;
    if (!used.has(baseId)) {
      used.add(baseId);
      return proposal;
    }
    const disambiguator = stableHash(
      JSON.stringify({
        ...proposal,
        rank: null,
        status: null,
      })
    );
    let nextId = `${baseId}:${disambiguator}`;
    let counter = 2;
    while (used.has(nextId)) {
      nextId = `${baseId}:${disambiguator}:${counter}`;
      counter += 1;
    }
    used.add(nextId);
    return {
      ...proposal,
      proposalId: nextId,
    };
  });
}

function normalizeReviewTool(raw = "") {
  const normalized = readFirstString(raw)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (
    [
      "highlight",
      "highlighted",
      "highlight_region",
      "highlighted_region",
      "review_focus",
      "focus_region",
      "focus_area",
    ].includes(normalized)
  ) {
    return "highlight";
  }
  if (
    [
      "protect",
      "protected",
      "protect_region",
      "protected_region",
      "preserve_region",
    ].includes(normalized)
  ) {
    return "protect";
  }
  if (
    [
      "make_space",
      "make_space_here",
      "reserve_space",
      "reserved_space",
      "space",
      "open_space",
    ].includes(normalized)
  ) {
    return "make_space";
  }
  return normalized;
}

function normalizeFocusKind(rawKind = "", fallbackKind = "") {
  const normalized = normalizeReviewTool(rawKind) || normalizeReviewTool(fallbackKind);
  if (normalized === "highlight" || normalized === "protect" || normalized === "make_space") {
    return normalized;
  }
  return "";
}

function normalizedIdPart(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function focusBoundsSignature(bounds = null) {
  if (!bounds) return "";
  return [
    Math.round(Number(bounds.x) || 0),
    Math.round(Number(bounds.y) || 0),
    Math.round(Number(bounds.width) || 0),
    Math.round(Number(bounds.height) || 0),
  ].join("_");
}

function normalizeFocusArea(
  raw = {},
  {
    fallbackImageId = null,
    fallbackMarkIds = [],
    fallbackRegionCandidateId = null,
    fallbackBounds = null,
  } = {}
) {
  const record = asRecord(raw) || {};
  return {
    imageId:
      readFirstString(
        record.imageId,
        record.image_id,
        record.sourceImageId,
        record.source_image_id,
        record.targetRegion?.imageId,
        record.targetRegion?.image_id,
        fallbackImageId
      ) || null,
    markIds: uniqueStrings(
      [
        ...(Array.isArray(record.markIds) ? record.markIds : []),
        ...(Array.isArray(record.mark_ids) ? record.mark_ids : []),
        ...(Array.isArray(record.targetRegion?.markIds) ? record.targetRegion.markIds : []),
        ...(Array.isArray(record.targetRegion?.mark_ids) ? record.targetRegion.mark_ids : []),
        ...fallbackMarkIds,
      ],
      { limit: 6 }
    ),
    regionCandidateId:
      readFirstString(
        record.regionCandidateId,
        record.region_candidate_id,
        record.targetRegion?.regionCandidateId,
        record.targetRegion?.region_candidate_id,
        fallbackRegionCandidateId
      ) || null,
    bounds:
      normalizeBounds(
        record.bounds ||
          record.area ||
          record.region ||
          record.targetRegion?.bounds ||
          record.target_region?.bounds ||
          fallbackBounds
      ) || null,
  };
}

function hasFocusArea(area = {}) {
  return Boolean(
    readFirstString(area?.imageId) ||
      readFirstString(area?.regionCandidateId) ||
      (Array.isArray(area?.markIds) && area.markIds.length) ||
      area?.bounds
  );
}

function buildFocusContractId(prefix = "focus", kind = "", area = {}, index = 0) {
  const parts = [
    normalizedIdPart(kind),
    normalizedIdPart(area?.markIds?.[0]),
    normalizedIdPart(area?.regionCandidateId),
    normalizedIdPart(area?.imageId),
    normalizedIdPart(focusBoundsSignature(area?.bounds)),
  ].filter(Boolean);
  const suffix = parts.length ? parts.join(":") : String(Math.max(1, Number(index) + 1));
  return `${prefix}:${suffix}`;
}

function focusInstructionForKind(kind = "") {
  if (kind === "highlight") return "Focus the design review on this highlighted area.";
  if (kind === "protect") return "Do not change this region.";
  return "Reserve or create room here.";
}

function focusSemanticForKind(kind = "") {
  if (kind === "highlight") return "highlight_region";
  if (kind === "protect") return "protected_region";
  return "reserved_space";
}

function focusStrengthForKind(kind = "") {
  if (kind === "protect") return "hard";
  if (kind === "highlight") return "focus";
  return "prefer";
}

function normalizeMarkFocusKind(rawKind = "") {
  const normalized = readFirstString(rawKind).toLowerCase();
  if (normalized === "freehand_protect" || normalized === "freehand_highlight") {
    return "highlight";
  }
  return "";
}

function normalizeFocusInput(
  rawFocusInput = {},
  {
    reviewTool = "",
    fallbackImageId = null,
    fallbackMarkIds = [],
    fallbackRegionCandidateId = null,
    fallbackBounds = null,
    index = 0,
  } = {}
) {
  const record = asRecord(rawFocusInput) || {};
  const kind = normalizeFocusKind(
    readFirstString(record.kind, record.type, record.semantic, record.intent, record.tool),
    reviewTool
  );
  if (!kind) return null;
  const area = normalizeFocusArea(record, {
    fallbackImageId,
    fallbackMarkIds,
    fallbackRegionCandidateId,
    fallbackBounds,
  });
  if (!hasFocusArea(area)) return null;
  return {
    focusInputId:
      readFirstString(record.focusInputId, record.focus_input_id, record.id) ||
      buildFocusContractId("focus", kind, area, index),
    kind,
    semantic: focusSemanticForKind(kind),
    imageId: area.imageId,
    markIds: area.markIds,
    regionCandidateId: area.regionCandidateId,
    bounds: area.bounds,
    instruction: clampText(
      readFirstString(record.instruction, record.description) || focusInstructionForKind(kind),
      120
    ),
    sourceTool:
      normalizeReviewTool(readFirstString(record.sourceTool, record.source_tool, record.tool, reviewTool)) ||
      kind,
    strength: focusStrengthForKind(kind),
  };
}

function normalizeProtectedRegion(
  rawRegion = {},
  {
    fallbackImageId = null,
    fallbackMarkIds = [],
    fallbackRegionCandidateId = null,
    fallbackBounds = null,
    fallbackSourceTool = "protect",
    index = 0,
  } = {}
) {
  const record = asRecord(rawRegion) || {};
  const area = normalizeFocusArea(record, {
    fallbackImageId,
    fallbackMarkIds,
    fallbackRegionCandidateId,
    fallbackBounds,
  });
  if (!hasFocusArea(area)) return null;
  return {
    protectedRegionId:
      readFirstString(record.protectedRegionId, record.protected_region_id, record.id) ||
      buildFocusContractId("protected", "protect", area, index),
    focusInputId: readFirstString(record.focusInputId, record.focus_input_id) || null,
    imageId: area.imageId,
    markIds: area.markIds,
    regionCandidateId: area.regionCandidateId,
    bounds: area.bounds,
    instruction: clampText(
      readFirstString(record.instruction, record.description) || focusInstructionForKind("protect"),
      120
    ),
    sourceTool:
      normalizeReviewTool(
        readFirstString(record.sourceTool, record.source_tool, record.tool, fallbackSourceTool)
      ) || "protect",
  };
}

function normalizeReservedSpaceArea(
  rawArea = {},
  {
    fallbackImageId = null,
    fallbackMarkIds = [],
    fallbackRegionCandidateId = null,
    fallbackBounds = null,
    fallbackSourceTool = "make_space",
    index = 0,
  } = {}
) {
  const record = asRecord(rawArea) || {};
  const area = normalizeFocusArea(record, {
    fallbackImageId,
    fallbackMarkIds,
    fallbackRegionCandidateId,
    fallbackBounds,
  });
  if (!hasFocusArea(area)) return null;
  return {
    reservedSpaceId:
      readFirstString(record.reservedSpaceId, record.reserved_space_id, record.id) ||
      buildFocusContractId("reserved-space", "make_space", area, index),
    focusInputId: readFirstString(record.focusInputId, record.focus_input_id) || null,
    imageId: area.imageId,
    markIds: area.markIds,
    regionCandidateId: area.regionCandidateId,
    bounds: area.bounds,
    instruction: clampText(
      readFirstString(record.instruction, record.description) || focusInstructionForKind("make_space"),
      120
    ),
    sourceTool:
      normalizeReviewTool(
        readFirstString(record.sourceTool, record.source_tool, record.tool, fallbackSourceTool)
      ) || "make_space",
  };
}

function normalizeReservedSpaceIntent(
  rawIntent = null,
  {
    fallbackImageId = null,
    fallbackMarkIds = [],
    fallbackRegionCandidateId = null,
    fallbackBounds = null,
    fallbackSourceTool = "make_space",
  } = {}
) {
  const record = Array.isArray(rawIntent) ? { areas: rawIntent } : asRecord(rawIntent);
  if (!record) return null;
  const rawAreas = Array.isArray(record.areas)
    ? record.areas
    : Array.isArray(record.regions)
      ? record.regions
      : Array.isArray(record.reservedSpaces)
        ? record.reservedSpaces
        : Array.isArray(record.reserved_spaces)
          ? record.reserved_spaces
          : [
              record.area ||
              record.region ||
              record.bounds ||
              record.regionCandidateId ||
              record.region_candidate_id ||
              record.markIds ||
              record.mark_ids
                ? record
                : null,
            ].filter(Boolean);
  const areas = rawAreas
    .map((area, index) =>
      normalizeReservedSpaceArea(area, {
        fallbackImageId,
        fallbackMarkIds,
        fallbackRegionCandidateId,
        fallbackBounds,
        fallbackSourceTool,
        index,
      })
    )
    .filter(Boolean);
  if (!areas.length) return null;
  return {
    reservedSpaceIntentId:
      readFirstString(
        record.reservedSpaceIntentId,
        record.reserved_space_intent_id,
        record.id
      ) ||
      buildFocusContractId(
        "reserved-space-intent",
        "make_space",
        areas[0],
        0
      ),
    mode: "reserve_or_create_room",
    instruction: clampText(
      readFirstString(record.instruction, record.description) || focusInstructionForKind("make_space"),
      140
    ),
    primaryAreaId:
      readFirstString(record.primaryAreaId, record.primary_area_id, areas[0]?.reservedSpaceId) || null,
    areas,
  };
}

function uniqueBy(values = [], keyFor = () => "") {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    if (!value || typeof value !== "object") continue;
    const key = String(keyFor(value) || "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function focusInputKey(entry = {}) {
  if (hasFocusArea(entry)) {
    return [
      normalizeFocusKind(entry?.kind),
      readFirstString(entry?.imageId),
      uniqueStrings(entry?.markIds || [], { limit: 6 }).join(","),
      readFirstString(entry?.regionCandidateId),
      focusBoundsSignature(entry?.bounds),
    ].join("|");
  }
  return readFirstString(entry?.focusInputId);
}

function protectedRegionKey(entry = {}) {
  if (hasFocusArea(entry)) {
    return [
      readFirstString(entry?.imageId),
      uniqueStrings(entry?.markIds || [], { limit: 6 }).join(","),
      readFirstString(entry?.regionCandidateId),
      focusBoundsSignature(entry?.bounds),
    ].join("|");
  }
  return readFirstString(entry?.protectedRegionId);
}

function reservedSpaceAreaKey(entry = {}) {
  if (hasFocusArea(entry)) {
    return [
      readFirstString(entry?.imageId),
      uniqueStrings(entry?.markIds || [], { limit: 6 }).join(","),
      readFirstString(entry?.regionCandidateId),
      focusBoundsSignature(entry?.bounds),
    ].join("|");
  }
  return readFirstString(entry?.reservedSpaceId);
}

function mergeFocusInputs(...lists) {
  return uniqueBy(lists.flat(), focusInputKey);
}

function mergeProtectedRegions(...lists) {
  return uniqueBy(lists.flat(), protectedRegionKey);
}

function mergeReservedSpaceIntent(base = null, extra = null) {
  const baseAreas = Array.isArray(base?.areas) ? base.areas : [];
  const extraAreas = Array.isArray(extra?.areas) ? extra.areas : [];
  const areas = uniqueBy([...extraAreas, ...baseAreas], reservedSpaceAreaKey);
  if (!areas.length) return null;
  return {
    reservedSpaceIntentId:
      readFirstString(
        extra?.reservedSpaceIntentId,
        extra?.reserved_space_intent_id,
        base?.reservedSpaceIntentId,
        base?.reserved_space_intent_id
      ) ||
      buildFocusContractId("reserved-space-intent", "make_space", areas[0], 0),
    mode: "reserve_or_create_room",
    instruction: clampText(
      readFirstString(extra?.instruction, base?.instruction) || focusInstructionForKind("make_space"),
      140
    ),
    primaryAreaId:
      readFirstString(extra?.primaryAreaId, base?.primaryAreaId, areas[0]?.reservedSpaceId) || null,
    areas,
  };
}

function createFocusInputFromProtectedRegion(region = {}) {
  const normalized = normalizeProtectedRegion(region);
  if (!normalized) return null;
  return {
    focusInputId: normalized.focusInputId || `focus:${normalized.protectedRegionId}`,
    kind: "protect",
    semantic: "protected_region",
    imageId: normalized.imageId,
    markIds: normalized.markIds,
    regionCandidateId: normalized.regionCandidateId,
    bounds: normalized.bounds,
    instruction: normalized.instruction,
    sourceTool: normalized.sourceTool || "protect",
    strength: "hard",
  };
}

function createFocusInputFromReservedSpaceArea(area = {}) {
  const normalized = normalizeReservedSpaceArea(area);
  if (!normalized) return null;
  return {
    focusInputId: normalized.focusInputId || `focus:${normalized.reservedSpaceId}`,
    kind: "make_space",
    semantic: "reserved_space",
    imageId: normalized.imageId,
    markIds: normalized.markIds,
    regionCandidateId: normalized.regionCandidateId,
    bounds: normalized.bounds,
    instruction: normalized.instruction,
    sourceTool: normalized.sourceTool || "make_space",
    strength: "prefer",
  };
}

function deriveProtectedRegionsFromFocusInputs(focusInputs = []) {
  return mergeProtectedRegions(
    (Array.isArray(focusInputs) ? focusInputs : [])
      .filter((entry) => normalizeFocusKind(entry?.kind) === "protect")
      .map((entry, index) =>
        normalizeProtectedRegion(entry, {
          fallbackImageId: entry?.imageId || null,
          fallbackMarkIds: entry?.markIds || [],
          fallbackRegionCandidateId: entry?.regionCandidateId || null,
          fallbackBounds: entry?.bounds || null,
          fallbackSourceTool: entry?.sourceTool || "protect",
          index,
        })
      )
      .filter(Boolean)
  );
}

function deriveFocusInputsFromMarkedHighlights(marks = [], primaryImageId = null, imagesInView = []) {
  const inputs = [];
  (Array.isArray(marks) ? marks : []).forEach((mark, index) => {
    const kind = normalizeMarkFocusKind(readFirstString(mark?.kind, mark?.type));
    if (!kind) return;
    const markId = readFirstString(mark?.id);
    const bounds = normalizeBounds(mark?.bounds);
    const imageIds =
      kind === "highlight"
        ? deriveHighlightImageIdsFromMark(mark, imagesInView)
        : uniqueStrings(
            [readFirstString(mark?.imageId), readFirstString(mark?.sourceImageId)].filter(Boolean),
            { limit: 6 }
          );
    const scopedImageIds = imageIds.length
      ? imageIds
      : [readFirstString(mark?.imageId, mark?.sourceImageId, primaryImageId) || null];
    scopedImageIds.forEach((imageId, imageIndex) => {
      const input = normalizeFocusInput(
        {
          kind,
          tool: kind,
          sourceTool: kind,
          imageId,
          markIds: markId ? [markId] : [],
          bounds,
        },
        {
          reviewTool: kind,
          fallbackImageId: imageId,
          fallbackMarkIds: markId ? [markId] : [],
          fallbackBounds: bounds,
          index: index * 10 + imageIndex,
        }
      );
      if (input) inputs.push(input);
    });
  });
  return mergeFocusInputs(inputs);
}

function deriveReservedSpaceIntentFromFocusInputs(focusInputs = []) {
  const areas = (Array.isArray(focusInputs) ? focusInputs : [])
    .filter((entry) => normalizeFocusKind(entry?.kind) === "make_space")
    .map((entry, index) =>
      normalizeReservedSpaceArea(entry, {
        fallbackImageId: entry?.imageId || null,
        fallbackMarkIds: entry?.markIds || [],
        fallbackRegionCandidateId: entry?.regionCandidateId || null,
        fallbackBounds: entry?.bounds || null,
        fallbackSourceTool: entry?.sourceTool || "make_space",
        index,
      })
    )
    .filter(Boolean);
  if (!areas.length) return null;
  return {
    reservedSpaceIntentId: buildFocusContractId("reserved-space-intent", "make_space", areas[0], 0),
    mode: "reserve_or_create_room",
    instruction: focusInstructionForKind("make_space"),
    primaryAreaId: areas[0]?.reservedSpaceId || null,
    areas: uniqueBy(areas, reservedSpaceAreaKey),
  };
}

function deriveFocusInputsFromReviewToolFallback({
  reviewTool = "",
  marks = [],
  regionCandidates = [],
  activeRegionCandidateId = null,
  primaryImageId = null,
} = {}) {
  const kind = normalizeFocusKind(reviewTool);
  if (!kind) return [];
  const inputs = [];
  const normalizedMarks = Array.isArray(marks) ? marks : [];
  normalizedMarks.forEach((mark, index) => {
    const markId = readFirstString(mark?.id);
    const input = normalizeFocusInput(
      {
        kind,
        tool: kind,
        imageId: readFirstString(mark?.imageId, mark?.sourceImageId, primaryImageId) || null,
        markIds: markId ? [markId] : [],
        bounds: normalizeBounds(mark?.bounds),
      },
      {
        reviewTool: kind,
        fallbackImageId: readFirstString(mark?.imageId, mark?.sourceImageId, primaryImageId) || null,
        fallbackMarkIds: markId ? [markId] : [],
        fallbackBounds: normalizeBounds(mark?.bounds),
        index,
      }
    );
    if (input) inputs.push(input);
  });
  if (kind === "highlight") {
    return mergeFocusInputs(inputs);
  }
  const normalizedCandidates = (Array.isArray(regionCandidates) ? regionCandidates : []).filter(
    (candidate) => candidate && typeof candidate === "object"
  );
  const activeCandidates = normalizedCandidates.filter((candidate) => {
    const candidateId = readFirstString(
      candidate?.id,
      candidate?.regionCandidateId,
      candidate?.region_candidate_id
    );
    if (
      activeRegionCandidateId &&
      candidateId &&
      candidateId === readFirstString(activeRegionCandidateId)
    ) {
      return true;
    }
    return Boolean(candidate?.isActive ?? candidate?.is_active);
  });
  const regionFocusCandidates =
    activeCandidates.length > 0
      ? activeCandidates
      : normalizedCandidates.length === 1
        ? normalizedCandidates
        : [];
  regionFocusCandidates.forEach((candidate, index) => {
    const candidateId =
      readFirstString(candidate?.id, candidate?.regionCandidateId, candidate?.region_candidate_id) ||
      null;
    const input = normalizeFocusInput(
      {
        kind,
        tool: kind,
        imageId: readFirstString(candidate?.imageId, candidate?.image_id, primaryImageId) || null,
        regionCandidateId: candidateId,
        bounds: normalizeBounds(candidate?.bounds),
      },
      {
        reviewTool: kind,
        fallbackImageId: readFirstString(candidate?.imageId, candidate?.image_id, primaryImageId) || null,
        fallbackRegionCandidateId: candidateId,
        fallbackBounds: normalizeBounds(candidate?.bounds),
        index: normalizedMarks.length + index,
      }
    );
    if (input) inputs.push(input);
  });
  return mergeFocusInputs(inputs);
}

function normalizeDesignReviewFocusContract({
  focusInputs = [],
  protectedRegions = [],
  reservedSpaceIntent = null,
  reviewTool = "",
  marks = [],
  imagesInView = [],
  regionCandidates = [],
  activeRegionCandidateId = null,
  primaryImageId = null,
} = {}) {
  const normalizedReviewTool = normalizeReviewTool(reviewTool) || null;
  const normalizedFocusInputs = (Array.isArray(focusInputs) ? focusInputs : [])
    .map((entry, index) =>
      normalizeFocusInput(entry, {
        reviewTool: normalizedReviewTool,
        fallbackImageId: primaryImageId,
        index,
      })
    )
    .filter(Boolean);
  const normalizedProtectedRegions = (Array.isArray(protectedRegions) ? protectedRegions : [])
    .map((entry, index) =>
      normalizeProtectedRegion(entry, {
        fallbackImageId: primaryImageId,
        fallbackSourceTool: normalizedReviewTool || "protect",
        index,
      })
    )
    .filter(Boolean);
  const normalizedReservedSpaceIntent = normalizeReservedSpaceIntent(reservedSpaceIntent, {
    fallbackImageId: primaryImageId,
    fallbackSourceTool: normalizedReviewTool || "make_space",
  });
  let mergedFocusInputs = mergeFocusInputs(
    normalizedFocusInputs,
    deriveFocusInputsFromMarkedHighlights(marks, primaryImageId, imagesInView),
    normalizedProtectedRegions.map(createFocusInputFromProtectedRegion).filter(Boolean),
    (normalizedReservedSpaceIntent?.areas || []).map(createFocusInputFromReservedSpaceArea).filter(Boolean)
  );
  if (
    !mergedFocusInputs.length &&
    !normalizedProtectedRegions.length &&
    !(normalizedReservedSpaceIntent?.areas || []).length
  ) {
    mergedFocusInputs = deriveFocusInputsFromReviewToolFallback({
      reviewTool: normalizedReviewTool,
      marks,
      regionCandidates,
      activeRegionCandidateId,
      primaryImageId,
    });
  }
  return {
    reviewTool: normalizedReviewTool,
    focusInputs: mergedFocusInputs,
    protectedRegions: mergeProtectedRegions(
      normalizedProtectedRegions,
      deriveProtectedRegionsFromFocusInputs(mergedFocusInputs)
    ),
    reservedSpaceIntent: mergeReservedSpaceIntent(
      deriveReservedSpaceIntentFromFocusInputs(mergedFocusInputs),
      normalizedReservedSpaceIntent
    ),
  };
}

function highlightScopeImageIdsFromFocusInputs({
  reviewTool = "",
  focusInputs = [],
  imagesInView = [],
  selectedImageIds = [],
  primaryImageId = null,
} = {}) {
  const normalizedReviewTool = normalizeReviewTool(reviewTool) || null;
  const highlightImageIds = uniqueStrings(
    (Array.isArray(focusInputs) ? focusInputs : [])
      .filter((entry) => normalizeFocusKind(entry?.kind, normalizedReviewTool) === "highlight")
      .map((entry) => readFirstString(entry?.imageId))
      .filter(Boolean),
    { limit: 6 }
  );
  if (normalizedReviewTool !== "highlight" && !highlightImageIds.length) return [];
  if (!highlightImageIds.length) {
    return uniqueStrings(
      [
        ...(Array.isArray(selectedImageIds) ? selectedImageIds : []),
        readFirstString(primaryImageId) || null,
      ].filter(Boolean),
      { limit: 6 }
    );
  }
  const visibleImageIds = uniqueStrings(
    (Array.isArray(imagesInView) ? imagesInView : []).map((image) =>
      readFirstString(image?.id, image?.imageId, image?.image_id)
    ),
    { limit: 12 }
  );
  return uniqueStrings(
    [
      ...(Array.isArray(selectedImageIds) ? selectedImageIds : []).filter((imageId) =>
        highlightImageIds.includes(String(imageId || "").trim())
      ),
      highlightImageIds.includes(readFirstString(primaryImageId)) ? readFirstString(primaryImageId) : null,
      ...visibleImageIds.filter((imageId) => highlightImageIds.includes(imageId)),
      ...highlightImageIds,
    ].filter(Boolean),
    { limit: 6 }
  );
}

function resolveHighlightScopedPrimaryImageId({
  reviewTool = "",
  focusImageIds = [],
  imagesInView = [],
  selectedImageIds = [],
  primaryImageId = null,
} = {}) {
  const normalizedReviewTool = normalizeReviewTool(reviewTool) || null;
  const scopedIds = uniqueStrings(focusImageIds || [], { limit: 6 });
  const normalizedPrimaryImageId = readFirstString(primaryImageId) || null;
  if (normalizedReviewTool !== "highlight" || !scopedIds.length) return normalizedPrimaryImageId;
  if (normalizedPrimaryImageId && scopedIds.includes(normalizedPrimaryImageId)) {
    return normalizedPrimaryImageId;
  }
  const scopedSet = new Set(scopedIds);
  const activeScopedImageId = (Array.isArray(imagesInView) ? imagesInView : [])
    .find((image) => {
      const imageId = readFirstString(image?.id, image?.imageId, image?.image_id);
      return imageId && scopedSet.has(imageId) && Boolean(image?.active);
    });
  const selectedScopedImageId = (Array.isArray(selectedImageIds) ? selectedImageIds : []).find((imageId) =>
    scopedSet.has(String(imageId || "").trim())
  );
  const firstVisibleScopedImageId = (Array.isArray(imagesInView) ? imagesInView : [])
    .map((image) => readFirstString(image?.id, image?.imageId, image?.image_id))
    .find((imageId) => imageId && scopedSet.has(imageId));
  return (
    readFirstString(
      activeScopedImageId?.id,
      activeScopedImageId?.imageId,
      selectedScopedImageId,
      firstVisibleScopedImageId,
      scopedIds[0],
      normalizedPrimaryImageId
    ) || null
  );
}

function focusEntryMatchesImage(entry = {}, imageId = null) {
  const normalizedImageId = readFirstString(imageId);
  if (!normalizedImageId) return true;
  const entryImageId = readFirstString(entry?.imageId);
  return !entryImageId || entryImageId === normalizedImageId;
}

function filterFocusContractForImage(
  {
    focusInputs = [],
    protectedRegions = [],
    reservedSpaceIntent = null,
  } = {},
  imageId = null
) {
  const filteredFocusInputs = mergeFocusInputs(
    (Array.isArray(focusInputs) ? focusInputs : []).filter((entry) =>
      focusEntryMatchesImage(entry, imageId)
    )
  );
  const filteredProtectedRegions = mergeProtectedRegions(
    (Array.isArray(protectedRegions) ? protectedRegions : []).filter((entry) =>
      focusEntryMatchesImage(entry, imageId)
    )
  );
  const filteredReservedSpaceAreas = (Array.isArray(reservedSpaceIntent?.areas)
    ? reservedSpaceIntent.areas
    : []
  ).filter((entry) => focusEntryMatchesImage(entry, imageId));
  return {
    focusInputs: filteredFocusInputs,
    protectedRegions: filteredProtectedRegions,
    reservedSpaceIntent: filteredReservedSpaceAreas.length
      ? {
          reservedSpaceIntentId:
            readFirstString(
              reservedSpaceIntent?.reservedSpaceIntentId,
              reservedSpaceIntent?.reserved_space_intent_id
            ) || null,
          mode: "reserve_or_create_room",
          instruction:
            clampText(
              readFirstString(reservedSpaceIntent?.instruction) ||
                focusInstructionForKind("make_space"),
              140
            ) || focusInstructionForKind("make_space"),
          primaryAreaId:
            readFirstString(
              reservedSpaceIntent?.primaryAreaId,
              filteredReservedSpaceAreas[0]?.reservedSpaceId
            ) || null,
          areas: uniqueBy(filteredReservedSpaceAreas, reservedSpaceAreaKey),
        }
      : null,
  };
}

function resolveProposalFocusContract({ request = {}, proposal = {} } = {}) {
  const proposalImageId =
    readFirstString(proposal?.imageId, proposal?.image_id, request?.primaryImageId) || null;
  const scopedRequestContract = filterFocusContractForImage(
    {
      focusInputs: request?.focusInputs || [],
      protectedRegions: request?.protectedRegions || [],
      reservedSpaceIntent: request?.reservedSpaceIntent || null,
    },
    proposalImageId
  );
  const explicitProposalContract = normalizeDesignReviewFocusContract({
    focusInputs: proposal?.focusInputs || proposal?.focus_inputs || [],
    protectedRegions: proposal?.protectedRegions || proposal?.protected_regions || [],
    reservedSpaceIntent:
      proposal?.reservedSpaceIntent ||
      proposal?.reserved_space_intent ||
      proposal?.reservedSpaces ||
      proposal?.reserved_spaces ||
      null,
    reviewTool: request?.reviewTool || null,
    primaryImageId: proposalImageId,
  });
  return {
    reviewTool: explicitProposalContract.reviewTool || request?.reviewTool || null,
    focusInputs: mergeFocusInputs(
      scopedRequestContract.focusInputs,
      explicitProposalContract.focusInputs
    ),
    protectedRegions: mergeProtectedRegions(
      scopedRequestContract.protectedRegions,
      explicitProposalContract.protectedRegions
    ),
    reservedSpaceIntent: mergeReservedSpaceIntent(
      scopedRequestContract.reservedSpaceIntent,
      explicitProposalContract.reservedSpaceIntent
    ),
  };
}

function focusInputIdsFromList(focusInputs = []) {
  return uniqueStrings(
    (Array.isArray(focusInputs) ? focusInputs : []).map((entry) =>
      readFirstString(entry?.focusInputId)
    ),
    { limit: 12 }
  );
}

function protectedRegionIdsFromList(protectedRegions = []) {
  return uniqueStrings(
    (Array.isArray(protectedRegions) ? protectedRegions : []).map((entry) =>
      readFirstString(entry?.protectedRegionId)
    ),
    { limit: 12 }
  );
}

function reservedSpaceAreaIdsFromIntent(reservedSpaceIntent = null) {
  return uniqueStrings(
    (Array.isArray(reservedSpaceIntent?.areas) ? reservedSpaceIntent.areas : []).map((entry) =>
      readFirstString(entry?.reservedSpaceId)
    ),
    { limit: 12 }
  );
}

function buildDesignReviewFocusPromptPayload({
  focusInputs = [],
  protectedRegions = [],
  reservedSpaceIntent = null,
} = {}) {
  const payload = {};
  const normalizedFocusInputs = (Array.isArray(focusInputs) ? focusInputs : [])
    .slice(0, 6)
    .map((entry) => ({
      focusInputId: readFirstString(entry?.focusInputId) || null,
      kind: normalizeFocusKind(entry?.kind) || null,
      imageId: readFirstString(entry?.imageId) || null,
      markIds: uniqueStrings(entry?.markIds || [], { limit: 4 }),
      regionCandidateId: readFirstString(entry?.regionCandidateId) || null,
      bounds: normalizeBounds(entry?.bounds),
      instruction: clampText(entry?.instruction, 120) || null,
    }))
    .filter((entry) => entry.kind);
  const normalizedProtectedRegions = (Array.isArray(protectedRegions) ? protectedRegions : [])
    .slice(0, 4)
    .map((entry) => ({
      protectedRegionId: readFirstString(entry?.protectedRegionId) || null,
      imageId: readFirstString(entry?.imageId) || null,
      markIds: uniqueStrings(entry?.markIds || [], { limit: 4 }),
      regionCandidateId: readFirstString(entry?.regionCandidateId) || null,
      bounds: normalizeBounds(entry?.bounds),
      instruction: clampText(entry?.instruction, 120) || null,
    }))
    .filter((entry) => entry.protectedRegionId || entry.regionCandidateId || entry.markIds.length || entry.bounds);
  const normalizedReservedSpaceAreas = (Array.isArray(reservedSpaceIntent?.areas)
    ? reservedSpaceIntent.areas
    : []
  )
    .slice(0, 4)
    .map((entry) => ({
      reservedSpaceId: readFirstString(entry?.reservedSpaceId) || null,
      imageId: readFirstString(entry?.imageId) || null,
      markIds: uniqueStrings(entry?.markIds || [], { limit: 4 }),
      regionCandidateId: readFirstString(entry?.regionCandidateId) || null,
      bounds: normalizeBounds(entry?.bounds),
      instruction: clampText(entry?.instruction, 120) || null,
    }))
    .filter((entry) => entry.reservedSpaceId || entry.regionCandidateId || entry.markIds.length || entry.bounds);
  if (normalizedFocusInputs.length) payload.focusInputs = normalizedFocusInputs;
  if (normalizedProtectedRegions.length) payload.protectedRegions = normalizedProtectedRegions;
  if (normalizedReservedSpaceAreas.length) {
    payload.reservedSpaceIntent = {
      reservedSpaceIntentId:
        readFirstString(
          reservedSpaceIntent?.reservedSpaceIntentId,
          reservedSpaceIntent?.reserved_space_intent_id
        ) || null,
      mode: "reserve_or_create_room",
      instruction:
        clampText(
          readFirstString(reservedSpaceIntent?.instruction) || focusInstructionForKind("make_space"),
          140
        ) || focusInstructionForKind("make_space"),
      areas: normalizedReservedSpaceAreas,
    };
  }
  return Object.keys(payload).length ? payload : null;
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
  if (lower === "gemini nano banana 2" || lower === "nano banana 2" || lower === "gemini-nano-banana-2") {
    return DESIGN_REVIEW_FINAL_APPLY_MODEL;
  }
  const withoutModelsPrefix = lower.startsWith("models/") ? trimmed.slice("models/".length).trim() : trimmed;
  const withoutGooglePrefix =
    withoutModelsPrefix.toLowerCase().startsWith("google/")
      ? withoutModelsPrefix.slice("google/".length).trim()
      : withoutModelsPrefix;
  if (withoutGooglePrefix.toLowerCase() === "gemini-nano-banana-2") {
    return DESIGN_REVIEW_FINAL_APPLY_MODEL;
  }
  return withoutGooglePrefix || DESIGN_REVIEW_FINAL_APPLY_MODEL;
}

export function buildDesignReviewRequest({
  shellContext = {},
  visibleCanvasRef = null,
  visualPrompt = null,
  regionCandidates = [],
  activeRegionCandidateId = null,
  selectedImageIds = null,
  focusInputs = undefined,
  protectedRegions = undefined,
  reservedSpaceIntent = undefined,
  reviewTool = null,
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
  const requestedPrimaryImageId =
    readFirstString(shell.activeImageId, visual.canvas?.active_image_id, selected[0], imageIdsInView[0]) || null;
  const marks = Array.isArray(visual.marks) ? visual.marks.filter((item) => item && typeof item === "object") : [];
  const markIds = uniqueStrings(marks.map((item) => item.id), { limit: 16 });
  const chosenRegionCandidate = (Array.isArray(regionCandidates) ? regionCandidates : []).find(
    (candidate) => readFirstString(candidate?.id, candidate?.regionCandidateId, candidate?.region_candidate_id) === String(activeRegionCandidateId || "").trim()
  );
  const normalizedRegionCandidates = (Array.isArray(regionCandidates) ? regionCandidates : [])
    .filter((item) => item && typeof item === "object")
    .map((item, index) => ({
      id:
        readFirstString(item.id, item.regionCandidateId, item.region_candidate_id) ||
        `region_${index + 1}`,
      imageId: readFirstString(item.imageId, item.image_id, requestedPrimaryImageId) || null,
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
    }));
  const selectionState = selectionStateFromInputs({
    activeRegionCandidateId,
    regionSelectionActive: Boolean(shell.regionSelectionActive),
    selectedImageIds: selected,
  });
  const analyses = (Array.isArray(cachedImageAnalyses) ? cachedImageAnalyses : [])
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({ ...entry }));
  const firstAnalysisRef =
    readFirstString(uploadAnalysisRef, analyses[0]?.analysisRef, analyses[0]?.analysis_ref) || null;
  const normalizedRequestId = readFirstString(requestId) || nowId("review");
  const normalizedSessionId =
    readFirstString(sessionId, shell.activeTabId, shell.runDir ? `session:${shell.runDir}` : "") || normalizedRequestId;
  let reviewFocus = normalizeDesignReviewFocusContract({
    focusInputs:
      Array.isArray(focusInputs)
        ? focusInputs
        : Array.isArray(visual.focusInputs)
          ? visual.focusInputs
          : Array.isArray(visual.focus_inputs)
            ? visual.focus_inputs
            : Array.isArray(shell.focusInputs)
              ? shell.focusInputs
              : Array.isArray(shell.focus_inputs)
                ? shell.focus_inputs
                : [],
    protectedRegions:
      Array.isArray(protectedRegions)
        ? protectedRegions
        : Array.isArray(visual.protectedRegions)
          ? visual.protectedRegions
          : Array.isArray(visual.protected_regions)
            ? visual.protected_regions
            : Array.isArray(shell.protectedRegions)
              ? shell.protectedRegions
              : Array.isArray(shell.protected_regions)
                ? shell.protected_regions
                : [],
    reservedSpaceIntent:
      reservedSpaceIntent ??
      visual.reservedSpaceIntent ??
      visual.reserved_space_intent ??
      shell.reservedSpaceIntent ??
      shell.reserved_space_intent ??
      null,
    reviewTool:
      readFirstString(reviewTool, visual.reviewTool, visual.review_tool, shell.reviewTool, shell.review_tool) ||
      null,
    marks,
    imagesInView,
    regionCandidates: normalizedRegionCandidates,
    activeRegionCandidateId,
    primaryImageId: requestedPrimaryImageId,
  });
  let focusImageIds = highlightScopeImageIdsFromFocusInputs({
    reviewTool: reviewFocus.reviewTool,
    focusInputs: reviewFocus.focusInputs,
    imagesInView,
    selectedImageIds: selected,
    primaryImageId: requestedPrimaryImageId,
  });
  const scopedPrimaryImageId = resolveHighlightScopedPrimaryImageId({
    reviewTool: reviewFocus.reviewTool,
    focusImageIds,
    imagesInView,
    selectedImageIds: selected,
    primaryImageId: requestedPrimaryImageId,
  });
  if (
    reviewFocus.reviewTool === "highlight" &&
    scopedPrimaryImageId &&
    scopedPrimaryImageId !== requestedPrimaryImageId
  ) {
    reviewFocus = normalizeDesignReviewFocusContract({
      focusInputs:
        Array.isArray(focusInputs)
          ? focusInputs
          : Array.isArray(visual.focusInputs)
            ? visual.focusInputs
            : Array.isArray(visual.focus_inputs)
              ? visual.focus_inputs
              : Array.isArray(shell.focusInputs)
                ? shell.focusInputs
                : Array.isArray(shell.focus_inputs)
                  ? shell.focus_inputs
                  : [],
      protectedRegions:
        Array.isArray(protectedRegions)
          ? protectedRegions
          : Array.isArray(visual.protectedRegions)
            ? visual.protectedRegions
            : Array.isArray(visual.protected_regions)
              ? visual.protected_regions
              : Array.isArray(shell.protectedRegions)
                ? shell.protectedRegions
                : Array.isArray(shell.protected_regions)
                  ? shell.protected_regions
                  : [],
      reservedSpaceIntent:
        reservedSpaceIntent ??
        visual.reservedSpaceIntent ??
        visual.reserved_space_intent ??
        shell.reservedSpaceIntent ??
        shell.reserved_space_intent ??
        null,
      reviewTool:
        readFirstString(reviewTool, visual.reviewTool, visual.review_tool, shell.reviewTool, shell.review_tool) ||
        null,
      marks,
      imagesInView,
      regionCandidates: normalizedRegionCandidates,
      activeRegionCandidateId,
      primaryImageId: scopedPrimaryImageId,
    });
    focusImageIds = highlightScopeImageIdsFromFocusInputs({
      reviewTool: reviewFocus.reviewTool,
      focusInputs: reviewFocus.focusInputs,
      imagesInView,
      selectedImageIds: selected,
      primaryImageId: scopedPrimaryImageId,
    });
  }
  const primaryImageId = scopedPrimaryImageId || requestedPrimaryImageId;
  const imageIdentityHints = normalizeImageIdentityHints({
    imagesInView,
    cachedImageAnalyses: analyses,
    primaryImageId,
    selectedImageIds: selected,
  });
  const focusInputIds = focusInputIdsFromList(reviewFocus.focusInputs);
  const protectedRegionIds = protectedRegionIdsFromList(reviewFocus.protectedRegions);
  const reservedSpaceAreaIds = reservedSpaceAreaIdsFromIntent(reviewFocus.reservedSpaceIntent);

  return {
    schemaVersion: DESIGN_REVIEW_REQUEST_SCHEMA,
    requestId: normalizedRequestId,
    sessionId: normalizedSessionId,
    visibleCanvasRef: readFirstString(visibleCanvasRef) || null,
    imageIdsInView,
    primaryImageId,
    focusImageIds,
    markIds,
    activeRegionCandidateId: readFirstString(activeRegionCandidateId) || null,
    selectionState,
    trigger: readFirstString(trigger) || DESIGN_REVIEW_TRIGGER,
    reviewTool: reviewFocus.reviewTool,
    focusInputs: reviewFocus.focusInputs,
    focusInputIds,
    protectedRegions: reviewFocus.protectedRegions,
    protectedRegionIds,
    reservedSpaceIntent: reviewFocus.reservedSpaceIntent,
    reservedSpaceAreaIds,
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
    regionCandidates: normalizedRegionCandidates,
    selectedImageIds: selected,
    cachedImageAnalyses: analyses,
    chosenRegionCandidate: chosenRegionCandidate ? { ...chosenRegionCandidate } : null,
    accountMemorySummary: accountMemorySummary && typeof accountMemorySummary === "object" ? { ...accountMemorySummary } : null,
  };
}

export function buildDesignReviewPlannerPrompt(request = {}) {
  const normalized = asRecord(request) || {};
  const slotCount = clamp(normalized.slotCount, 2, 3);
  const focusImageIds = uniqueStrings(normalized.focusImageIds || [], { limit: 6 });
  const hasHighlightScope = focusImageIds.length > 0;
  const hasStampFocusInputs = (Array.isArray(normalized.focusInputs) ? normalized.focusInputs : []).some((entry) =>
    readFirstString(entry?.sourceTool, entry?.source_tool, entry?.tool).toLowerCase() === "stamp"
  );
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
  const scopedIdentityHints = hasHighlightScope
    ? identityHints.filter((entry) => focusImageIds.includes(readFirstString(entry?.imageId)))
    : identityHints;
  const focusPayload = buildDesignReviewFocusPromptPayload({
    focusInputs: normalized.focusInputs || [],
    protectedRegions: normalized.protectedRegions || [],
    reservedSpaceIntent: normalized.reservedSpaceIntent || null,
  });
  const promptSections = [
    "View the canvas image and visible annotations only.",
    "An action is a concrete visual edit the editor could apply to the image.",
    "Write actions as short edit intents, not advice, critique, or conversation.",
    "Make previewBrief and applyBrief specific, positive, and verb-first.",
    "Use concise effect statements, not rationale essays.",
    hasHighlightScope
      ? "When Highlight circles specific images, keep every proposal scoped to those highlighted images only."
      : "Use the whole visible canvas as context, not just the local annotation area.",
    hasHighlightScope
      ? "Ignore unrelated visible images outside reviewScope.imageIds unless a highlighted annotation explicitly overlaps them."
      : "Treat off-image and between-image annotations as valid relationship cues for linkage, movement, spacing, and placement between visible images.",
    hasHighlightScope
      ? "Treat off-image and between-image annotations as valid relationship cues for linkage, movement, spacing, and placement between scoped images."
      : null,
    "Treat annotations and the chosen region candidate as focus hints, not crop-only constraints.",
    "If annotations sketch missing scene elements or motion cues such as a hoop, arrow, dunk path, or destination box, treat them as instruction overlays for what the edited image should render, not as the finished result.",
    "Use image identity hints when they exist so subjects are named concretely; do not say second image or reference image generically.",
    "Prefer edits that can plausibly route through the normal execution layer later.",
    `Return ${slotCount} ranked proposals as JSON only.`,
  ];
  if (focusPayload?.protectedRegions?.length) {
    promptSections.push("Legacy protected-region inputs mean preserve those exact regions when present.");
  }
  if ((normalized.focusInputs || []).some((entry) => normalizeFocusKind(entry?.kind) === "highlight")) {
    promptSections.push("Highlight focus inputs mark the areas the design review should prioritize.");
  }
  if (hasStampFocusInputs) {
    promptSections.push(
      "Stamp focus inputs are short directive labels such as Fix, Move, Remove, Replace, or a custom typed note. Legacy sessions may also include Text Here or Logo Here stamps. Treat each stamp instruction as an explicit edit or placement request."
    );
  }
  if (focusPayload?.reservedSpaceIntent?.areas?.length) {
    promptSections.push("Make Space focus inputs mean reserve or create room there.");
  }
  if (scopedIdentityHints.length) {
    promptSections.push(
      JSON.stringify(
        {
          imageIdentityHints: scopedIdentityHints,
        },
        null,
        2
      )
    );
  }
  if (hasHighlightScope) {
    promptSections.push(
      JSON.stringify(
        {
          reviewScope: {
            mode: "highlight_image_scope",
            imageIds: focusImageIds,
          },
        },
        null,
        2
      )
    );
  }
  if (focusPayload) {
    promptSections.push(
      JSON.stringify(
        {
          reviewFocus: focusPayload,
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

function buildDesignReviewApplyRequestSnapshot(request = {}) {
  const normalized = asRecord(request) || {};
  const visibleCanvasContext = asRecord(normalized.visibleCanvasContext) || {};
  const chosenRegionCandidate = asRecord(normalized.chosenRegionCandidate) || null;
  const focusPayload = buildDesignReviewFocusPromptPayload({
    focusInputs: normalized.focusInputs || [],
    protectedRegions: normalized.protectedRegions || [],
    reservedSpaceIntent: normalized.reservedSpaceIntent || null,
  });
  return {
    requestId: readFirstString(normalized.requestId) || null,
    sessionId: readFirstString(normalized.sessionId) || null,
    primaryImageId: readFirstString(normalized.primaryImageId, visibleCanvasContext.activeImageId) || null,
    focusImageIds: uniqueStrings(normalized.focusImageIds || [], { limit: 8 }),
    imageIdsInView: uniqueStrings(normalized.imageIdsInView || [], { limit: 12 }),
    selectedImageIds: uniqueStrings(normalized.selectedImageIds || [], { limit: 8 }),
    markIds: uniqueStrings(normalized.markIds || [], { limit: 8 }),
    activeRegionCandidateId: readFirstString(normalized.activeRegionCandidateId) || null,
    selectionState: readFirstString(normalized.selectionState) || "none",
    reviewTool: normalizeReviewTool(normalized.reviewTool) || null,
    focusInputIds: focusInputIdsFromList(normalized.focusInputs || []),
    protectedRegionIds: protectedRegionIdsFromList(normalized.protectedRegions || []),
    reservedSpaceAreaIds: reservedSpaceAreaIdsFromIntent(normalized.reservedSpaceIntent || null),
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
    reviewFocus: focusPayload,
  };
}

export function buildDesignReviewApplyPrompt({ request = {}, proposal = {} } = {}) {
  const normalizedRequest = asRecord(request) || {};
  const normalizedProposal = asRecord(proposal) || {};
  const focusContract = resolveProposalFocusContract({
    request: normalizedRequest,
    proposal: normalizedProposal,
  });
  const negativeConstraints = uniqueStrings(
    normalizedProposal.negativeConstraints || normalizedProposal.negative_constraints || [],
    { limit: 8 }
  );
  const targetRegion = normalizeTargetRegion(
    normalizedProposal.targetRegion || normalizedProposal.target_region || {}
  );
  const changedRegionBounds = normalizeProposalChangedRegionBounds({
    raw: normalizedProposal,
    request: normalizedRequest,
    targetRegion,
    focusContract,
    imageId: readFirstString(normalizedProposal.imageId, normalizedRequest.primaryImageId) || null,
  });
  const preserveRegionIds = normalizeProposalPreserveRegionIds(normalizedProposal, focusContract);
  const rationaleCodes = normalizeProposalRationaleCodes(normalizedProposal);
  const payload = {
    requestSnapshot: buildDesignReviewApplyRequestSnapshot(normalizedRequest),
    proposal: {
      label: clampText(normalizedProposal.label, 90),
      actionType: clampText(normalizedProposal.actionType, 96),
      applyBrief: clampText(normalizedProposal.applyBrief, 320),
      targetRegion,
      previewImagePath: normalizeProposalPreviewImagePath(normalizedProposal),
      changedRegionBounds,
      preserveRegionIds,
      rationaleCodes,
      negativeConstraints,
      focusInputs: focusContract.focusInputs,
      protectedRegions: focusContract.protectedRegions,
      reservedSpaceIntent: focusContract.reservedSpaceIntent,
      preserveProtectedRegions: focusContract.protectedRegions.length > 0,
      preserveReservedSpace: Boolean(focusContract.reservedSpaceIntent?.areas?.length),
    },
  };
  return [
    "Apply this accepted Cue design-review proposal to exactly one editable image.",
    "Edit only targetImage.",
    "Preserve the targetImage framing and aspect ratio unless the proposal explicitly reframes or outpaints it.",
    "Use referenceImages[] as guidance only and do not modify or return separate outputs for them.",
    "Return exactly one final rendered image for targetImage.",
    "Treat negativeConstraints as hard requirements.",
    changedRegionBounds.length
      ? "Use changedRegionBounds as the intended edit area inside the full-frame targetImage."
      : null,
    focusContract.focusInputs.some((entry) => normalizeFocusKind(entry?.kind) === "highlight")
      ? "Keep the edit centered on highlighted focus inputs when they are present."
      : null,
    focusContract.protectedRegions.length ? "Treat protectedRegions as no-edit zones." : null,
    focusContract.reservedSpaceIntent?.areas?.length
      ? "When reservedSpaceIntent is present, preserve or create open room in those areas without altering protectedRegions."
      : null,
    JSON.stringify(payload, null, 2),
  ]
    .filter(Boolean)
    .join("\n\n");
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
  const focusContract = resolveProposalFocusContract({
    request: normalizedRequest,
    proposal: normalizedProposal,
  });
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
  const targetRegion = normalizeTargetRegion(
    normalizedProposal.targetRegion || normalizedProposal.target_region || {}
  );
  const previewImagePath = normalizeProposalPreviewImagePath(normalizedProposal);
  const changedRegionBounds = normalizeProposalChangedRegionBounds({
    raw: normalizedProposal,
    request: normalizedRequest,
    targetRegion,
    focusContract,
    imageId: readFirstString(normalizedProposal.imageId, normalizedRequest.primaryImageId) || null,
  });
  const preserveRegionIds = normalizeProposalPreserveRegionIds(normalizedProposal, focusContract);
  const rationaleCodes = normalizeProposalRationaleCodes(normalizedProposal);
  const proposalId =
    readFirstString(normalizedProposal.proposalId) ||
    buildStableProposalId({
      request: normalizedRequest,
      imageId: readFirstString(normalizedProposal.imageId, normalizedRequest.primaryImageId) || null,
      label: normalizedProposal.label,
      actionType: normalizedProposal.actionType,
      why: normalizedProposal.why,
      previewBrief: normalizedProposal.previewBrief,
      applyBrief: normalizedProposal.applyBrief,
      targetRegion,
      changedRegionBounds,
      preserveRegionIds,
      rationaleCodes,
    });
  return {
    schemaVersion: DESIGN_REVIEW_APPLY_REQUEST_SCHEMA,
    kind: "apply",
    provider: readFirstString(provider) || "google",
    requestId: readFirstString(normalizedRequest.requestId) || null,
    sessionId: readFirstString(normalizedRequest.sessionId) || null,
    proposalId,
    selectedProposalId: proposalId,
    requestedModel,
    normalizedModel,
    model: requestedModel,
    prompt: buildDesignReviewApplyPrompt({
      request: normalizedRequest,
      proposal: normalizedProposal,
    }),
    reviewTool: normalizeReviewTool(normalizedRequest.reviewTool) || null,
    focusInputs: focusContract.focusInputs,
    focusInputIds: focusInputIdsFromList(focusContract.focusInputs),
    protectedRegions: focusContract.protectedRegions,
    protectedRegionIds: protectedRegionIdsFromList(focusContract.protectedRegions),
    reservedSpaceIntent: focusContract.reservedSpaceIntent,
    reservedSpaceAreaIds: reservedSpaceAreaIdsFromIntent(focusContract.reservedSpaceIntent),
    preserveProtectedRegions: focusContract.protectedRegions.length > 0,
    preserveReservedSpace: Boolean(focusContract.reservedSpaceIntent?.areas?.length),
    previewImagePath,
    changedRegionBounds,
    preserveRegionIds,
    rationaleCodes,
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
  const scopedImageIds = uniqueStrings(request.focusImageIds || [], { limit: 8 });
  const requestedImageId =
    readFirstString(raw.imageId, raw.image_id, request.primaryImageId, request.selectedImageIds?.[0]) || null;
  const imageId =
    scopedImageIds.length && requestedImageId && !scopedImageIds.includes(requestedImageId)
      ? readFirstString(
          scopedImageIds.includes(readFirstString(request.primaryImageId)) ? request.primaryImageId : null,
          (Array.isArray(request.selectedImageIds) ? request.selectedImageIds : []).find((id) =>
            scopedImageIds.includes(String(id || "").trim())
          ),
          scopedImageIds[0],
          requestedImageId
        ) || null
      : requestedImageId;
  const focusContract = resolveProposalFocusContract({
    request,
    proposal: {
      ...raw,
      imageId,
    },
  });
  const focusInputIds = focusInputIdsFromList(focusContract.focusInputs);
  const protectedRegionIds = protectedRegionIdsFromList(focusContract.protectedRegions);
  const reservedSpaceAreaIds = reservedSpaceAreaIdsFromIntent(focusContract.reservedSpaceIntent);
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
  const previewImagePath = normalizeProposalPreviewImagePath(raw);
  const changedRegionBounds = normalizeProposalChangedRegionBounds({
    raw,
    request,
    targetRegion,
    focusContract,
    imageId,
  });
  const preserveRegionIds = normalizeProposalPreserveRegionIds(raw, focusContract);
  const rationaleCodes = normalizeProposalRationaleCodes(raw);
  return {
    schemaVersion: DESIGN_REVIEW_PROPOSAL_SCHEMA,
    proposalId:
      readFirstString(raw.proposalId, raw.proposal_id, raw.id) ||
      buildStableProposalId({
        request,
        imageId,
        label,
        actionType,
        why,
        previewBrief,
        applyBrief,
        targetRegion,
        changedRegionBounds,
        preserveRegionIds,
        rationaleCodes,
      }),
    requestId: request.requestId || null,
    imageId,
    label,
    title: label,
    actionType,
    capability,
    actionIntent: actionType,
    targetRegion,
    previewImagePath,
    changedRegionBounds,
    preserveRegionIds,
    rationaleCodes,
    why,
    previewBrief,
    applyBrief,
    negativeConstraints,
    reviewTool: focusContract.reviewTool || normalizeReviewTool(request.reviewTool) || null,
    focusInputs: focusContract.focusInputs,
    focusInputIds,
    protectedRegions: focusContract.protectedRegions,
    protectedRegionIds,
    reservedSpaceIntent: focusContract.reservedSpaceIntent,
    reservedSpaceAreaIds,
    preserveProtectedRegions: protectedRegionIds.length > 0,
    preserveReservedSpace: reservedSpaceAreaIds.length > 0,
    rank: Math.max(1, Number(raw.rank) || index + 1),
    status: "ready",
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
  const proposals = ensureUniqueProposalIds(
    rawProposals
      .map((proposal, index) => normalizeProposal(proposal, request, { index }))
      .filter((proposal) => proposal.label && proposal.actionType)
      .slice(0, clamp(request.slotCount, 2, 3))
  );
  return {
    ok: proposals.length > 0,
    proposals,
    rawParsed: parsed,
  };
}

export function createDesignReviewSkeletonSlots({
  request = {},
  slotCount = DESIGN_REVIEW_DEFAULT_SLOT_COUNT,
} = {}) {
  const count = clamp(slotCount, 2, 3);
  return Array.from({ length: count }, (_, index) => {
    return {
      slotId: `${request.requestId || "review"}:slot:${index + 1}`,
      rank: index + 1,
      status: "skeleton",
      proposal: null,
      error: null,
    };
  });
}
