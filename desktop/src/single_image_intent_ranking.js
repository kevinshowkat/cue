export const SINGLE_IMAGE_RAIL_CONTRACT = "single-image-rail-v1";

export const SINGLE_IMAGE_RAIL_SEEDED_JOBS = Object.freeze([
  Object.freeze({
    jobId: "cut_out",
    label: "Cut Out",
    capability: "subject_isolation",
    requiresSelection: true,
  }),
  Object.freeze({
    jobId: "remove",
    label: "Remove",
    capability: "targeted_remove",
    requiresSelection: true,
  }),
  Object.freeze({
    jobId: "new_background",
    label: "New Background",
    capability: "background_replace",
    requiresSelection: false,
  }),
  Object.freeze({
    jobId: "reframe",
    label: "Reframe",
    capability: "crop_or_outpaint",
    requiresSelection: false,
  }),
  Object.freeze({
    jobId: "variants",
    label: "Variants",
    capability: "identity_preserving_variation",
    requiresSelection: false,
  }),
]);

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

function round4(value) {
  return Math.round(clamp01(value) * 10000) / 10000;
}

function booleanishScore(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  return clamp01(value);
}

function maxScore(...values) {
  let best = 0;
  for (const value of values) best = Math.max(best, booleanishScore(value));
  return best;
}

function toPositiveInt(value, fallback = 0) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function normalizeRecentSuccessKeys(value) {
  const out = [];
  const seen = new Set();
  const list = Array.isArray(value) ? value : [];
  for (const entry of list) {
    const keys = [];
    if (typeof entry === "string") {
      keys.push(entry);
    } else if (entry && typeof entry === "object") {
      if (entry.success === false || entry.ok === false) continue;
      if (entry.jobId) keys.push(entry.jobId);
      if (entry.capability) keys.push(entry.capability);
    }
    for (const rawKey of keys) {
      const key = String(rawKey || "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

function historyBoost(job, recentSuccessKeys) {
  if (!Array.isArray(recentSuccessKeys) || !recentSuccessKeys.length) return 0;
  let best = 0;
  for (let idx = 0; idx < recentSuccessKeys.length; idx += 1) {
    const key = recentSuccessKeys[idx];
    if (key !== job.jobId && key !== job.capability) continue;
    const boost = idx === 0 ? 0.12 : idx === 1 ? 0.08 : 0.05;
    if (boost > best) best = boost;
  }
  return best;
}

function normalizeCapabilityAvailability(context = {}) {
  const availability = {};
  const mapLike =
    context.capabilityAvailability && typeof context.capabilityAvailability === "object"
      ? context.capabilityAvailability
      : null;
  const availableCapabilities = new Set(
    (Array.isArray(context.availableCapabilities) ? context.availableCapabilities : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );

  for (const job of SINGLE_IMAGE_RAIL_SEEDED_JOBS) {
    let explicit = null;
    if (mapLike) {
      if (Object.prototype.hasOwnProperty.call(mapLike, job.jobId)) explicit = mapLike[job.jobId];
      else if (Object.prototype.hasOwnProperty.call(mapLike, job.capability)) explicit = mapLike[job.capability];
    }
    if (explicit == null && availableCapabilities.size) {
      explicit = availableCapabilities.has(job.capability) || availableCapabilities.has(job.jobId);
    }
    availability[job.jobId] = explicit == null ? true : Boolean(explicit);
  }

  return availability;
}

function normalizeContext(input = {}) {
  const activeImage = input.activeImage && typeof input.activeImage === "object" ? input.activeImage : {};
  const semanticHints =
    input.semanticHints && typeof input.semanticHints === "object"
      ? input.semanticHints
      : activeImage.semanticHints && typeof activeImage.semanticHints === "object"
        ? activeImage.semanticHints
        : activeImage.hints && typeof activeImage.hints === "object"
          ? activeImage.hints
          : {};
  const geometryHints =
    input.geometryHints && typeof input.geometryHints === "object"
      ? input.geometryHints
      : activeImage.geometryHints && typeof activeImage.geometryHints === "object"
        ? activeImage.geometryHints
        : activeImage.geometry && typeof activeImage.geometry === "object"
          ? activeImage.geometry
          : {};
  const selection = input.selection && typeof input.selection === "object" ? input.selection : {};

  const imageCount = toPositiveInt(
    input.imageCount ?? input.images?.length ?? (activeImage && Object.keys(activeImage).length ? 1 : 0),
    0
  );
  const hasActiveImage = Boolean(
    input.hasActiveImage ??
      activeImage.present ??
      activeImage.available ??
      activeImage.id ??
      activeImage.path ??
      imageCount === 1
  );
  const selectionPresent = Boolean(
    input.selectionPresent ??
      selection.present ??
      selection.bounds ??
      ((selection.count ?? input.selectionCount ?? 0) > 0)
  );
  const mode = String(input.mode ?? input.canvasMode ?? "single").trim().toLowerCase() || "single";
  const supportedImage = !(
    input.supportedImage === false ||
    activeImage.supported === false ||
    activeImage.unsupported === true
  );

  return {
    imageCount,
    hasActiveImage,
    selectionPresent,
    mode,
    busy: Boolean(input.busy ?? input.isBusy ?? input.pending),
    supportedImage,
    capabilityAvailability: normalizeCapabilityAvailability(input),
    recentSuccessKeys: normalizeRecentSuccessKeys(
      input.recentSuccessfulJobHistory ?? input.recentSuccessfulJobs ?? input.recentSuccessfulJobIds ?? []
    ),
    signals: {
      portrait: maxScore(semanticHints.portrait),
      person: maxScore(semanticHints.person, semanticHints.human),
      group: maxScore(semanticHints.group, semanticHints.people),
      product: maxScore(semanticHints.product, semanticHints.object),
      screenshot: maxScore(semanticHints.screenshot, semanticHints.ui),
      transparency: maxScore(activeImage.transparencyHint, semanticHints.transparency, activeImage.hasTransparency),
      isolated: maxScore(activeImage.isolationHint, semanticHints.isolated, semanticHints.isolation),
      backgroundBusy: maxScore(semanticHints.backgroundBusy, semanticHints.busyBackground, activeImage.backgroundBusy),
      needsReframe: maxScore(
        geometryHints.needsReframe,
        geometryHints.cropIssue,
        geometryHints.tightCrop,
        geometryHints.clippedSubject,
        geometryHints.offCenter,
        geometryHints.needsOutpaint
      ),
    },
  };
}

function inferDisabledReason(job, context) {
  if (context.imageCount !== 1 || !context.hasActiveImage || context.mode.includes("multi")) {
    return "unavailable_in_current_mode";
  }
  if (context.busy) return "busy";
  if (!context.supportedImage) return "unsupported_image";
  if (!context.capabilityAvailability[job.jobId]) return "capability_unavailable";
  if (job.requiresSelection && !context.selectionPresent) return "selection_required";
  return null;
}

function scoreJob(job, context) {
  const { signals, selectionPresent, recentSuccessKeys } = context;
  const heroSubject = Math.max(signals.portrait, signals.person, signals.product);
  const personSubject = Math.max(signals.portrait, signals.person);
  const isolationReady = Math.max(signals.transparency, signals.isolated);
  const repeatedSuccessBoost = historyBoost(job, recentSuccessKeys);

  if (job.jobId === "cut_out") {
    return round4(
      0.34 +
        0.22 * heroSubject +
        0.1 * signals.product +
        0.09 * (selectionPresent ? 1 : 0) +
        0.08 * signals.backgroundBusy -
        0.28 * isolationReady -
        0.18 * signals.isolated -
        0.12 * (selectionPresent ? 0 : signals.group) -
        0.4 * signals.screenshot +
        repeatedSuccessBoost
    );
  }

  if (job.jobId === "remove") {
    return round4(
      0.22 +
        0.52 * (selectionPresent ? 1 : 0) +
        0.2 * signals.group +
        0.12 * signals.screenshot +
        0.05 * signals.backgroundBusy +
        repeatedSuccessBoost
    );
  }

  if (job.jobId === "new_background") {
    return round4(
      0.46 +
        0.28 * signals.product +
        0.18 * personSubject +
        0.22 * isolationReady +
        0.18 * signals.backgroundBusy +
        0.06 * (selectionPresent ? 1 : 0) -
        0.14 * signals.group -
        0.44 * signals.screenshot +
        repeatedSuccessBoost
    );
  }

  if (job.jobId === "reframe") {
    return round4(
      0.44 +
        0.38 * signals.needsReframe +
        0.1 * signals.product +
        0.08 * signals.portrait +
        0.18 * signals.screenshot +
        0.04 * isolationReady +
        repeatedSuccessBoost
    );
  }

  return round4(
    0.48 +
      0.18 * personSubject +
      0.14 * signals.product +
      0.08 * isolationReady +
      0.04 * signals.group -
      0.26 * signals.screenshot +
      repeatedSuccessBoost
  );
}

function buildReasonCodes(job, context, confidence, disabledReason) {
  const reasonCodes = [];
  const { signals, selectionPresent, imageCount, hasActiveImage, mode, busy, recentSuccessKeys } = context;
  const push = (code, when = true) => {
    if (!when || reasonCodes.includes(code)) return;
    reasonCodes.push(code);
  };

  push("single_image_mode", imageCount === 1 && hasActiveImage && !mode.includes("multi"));
  push("active_image_present", hasActiveImage);
  push("selection_present", selectionPresent);
  push("selection_missing", !selectionPresent);
  push("selection_sensitive", job.requiresSelection);
  push("portrait_hint", signals.portrait >= 0.35);
  push("person_hint", signals.person >= 0.35);
  push("group_hint", signals.group >= 0.35);
  push("product_hint", signals.product >= 0.35);
  push("screenshot_hint", signals.screenshot >= 0.35);
  push("transparency_hint", signals.transparency >= 0.35);
  push("isolation_hint", signals.isolated >= 0.35);
  push("background_busy_hint", signals.backgroundBusy >= 0.35);
  push("crop_issue_hint", signals.needsReframe >= 0.35);
  push(
    "history_repeat_success",
    recentSuccessKeys.includes(job.jobId) || recentSuccessKeys.includes(job.capability)
  );
  push("already_isolated", job.jobId === "cut_out" && Math.max(signals.transparency, signals.isolated) >= 0.7);
  push("group_without_selection", job.jobId === "cut_out" && !selectionPresent && signals.group >= 0.45);
  push("generic_fallback", confidence <= 0.55);
  push(`disabled_${disabledReason}`, Boolean(disabledReason));
  push("busy_gate", busy && disabledReason === "busy");

  return reasonCodes;
}

function stickyKeyFor(job) {
  return `${SINGLE_IMAGE_RAIL_CONTRACT}:${job.jobId}`;
}

export function rankSingleImageIntentJobs(input = {}) {
  const context = normalizeContext(input);
  const rankedJobs = SINGLE_IMAGE_RAIL_SEEDED_JOBS.map((job, seedIndex) => {
    const disabledReason = inferDisabledReason(job, context);
    const confidence = scoreJob(job, context);
    const enabled = disabledReason == null;
    return {
      jobId: job.jobId,
      label: job.label,
      capability: job.capability,
      requiresSelection: job.requiresSelection,
      enabled,
      disabledReason,
      confidence,
      reasonCodes: buildReasonCodes(job, context, confidence, disabledReason),
      stickyKey: stickyKeyFor(job),
      _sortEnabled: enabled ? 1 : 0,
      _sortConfidence: confidence,
      _seedIndex: seedIndex,
    };
  });

  rankedJobs.sort((a, b) => {
    if (b._sortEnabled !== a._sortEnabled) return b._sortEnabled - a._sortEnabled;
    if (b._sortConfidence !== a._sortConfidence) return b._sortConfidence - a._sortConfidence;
    return a._seedIndex - b._seedIndex;
  });

  return {
    contractName: SINGLE_IMAGE_RAIL_CONTRACT,
    rankedJobs: rankedJobs.map(({ _sortEnabled, _sortConfidence, _seedIndex, ...job }) => job),
  };
}
