export const SINGLE_IMAGE_RAIL_CONTRACT = "single-image-rail-v1";

export const SINGLE_IMAGE_DISABLED_REASONS = Object.freeze([
  "selection_required",
  "busy",
  "unsupported_image",
  "unavailable_in_current_mode",
  "capability_unavailable",
]);

const RAW_SINGLE_IMAGE_CAPABILITY_SPECS = Object.freeze([
  Object.freeze({
    jobId: "cut_out",
    label: "Cut Out",
    capability: "subject_isolation",
    requiresSelection: true,
    stickyKey: "single-image-rail:cut_out",
    executionKind: "model_capability",
    aliases: Object.freeze(["cut_out", "select_subject"]),
  }),
  Object.freeze({
    jobId: "remove",
    label: "Remove",
    capability: "targeted_remove",
    requiresSelection: true,
    stickyKey: "single-image-rail:remove",
    executionKind: "model_capability",
    aliases: Object.freeze(["remove", "cleanup"]),
  }),
  Object.freeze({
    jobId: "new_background",
    label: "New Background",
    capability: "background_replace",
    requiresSelection: true,
    stickyKey: "single-image-rail:new_background",
    executionKind: "model_capability",
    aliases: Object.freeze(["new_background", "background_swap"]),
  }),
  Object.freeze({
    jobId: "reframe",
    label: "Reframe",
    capability: "crop_or_outpaint",
    requiresSelection: true,
    stickyKey: "single-image-rail:reframe",
    executionKind: "model_capability",
    aliases: Object.freeze(["reframe"]),
  }),
  Object.freeze({
    jobId: "variants",
    label: "Variants",
    capability: "identity_preserving_variation",
    requiresSelection: true,
    stickyKey: "single-image-rail:variants",
    executionKind: "model_capability",
    aliases: Object.freeze(["variants", "variations"]),
  }),
]);

export const SINGLE_IMAGE_CAPABILITY_MAP = Object.freeze(
  Object.fromEntries(
    RAW_SINGLE_IMAGE_CAPABILITY_SPECS.map((spec) => [
      spec.jobId,
      Object.freeze({
        jobId: spec.jobId,
        label: spec.label,
        capability: spec.capability,
        requiresSelection: spec.requiresSelection,
        stickyKey: spec.stickyKey,
        executionKind: spec.executionKind,
      }),
    ])
  )
);

const CAPABILITY_SPECS_BY_JOB = new Map(
  Object.values(SINGLE_IMAGE_CAPABILITY_MAP).map((spec) => [spec.jobId, spec])
);

const CAPABILITY_SPECS_BY_CAPABILITY = new Map(
  Object.values(SINGLE_IMAGE_CAPABILITY_MAP).map((spec) => [spec.capability, spec])
);

const CAPABILITY_SPECS_BY_ALIAS = new Map();
for (const spec of RAW_SINGLE_IMAGE_CAPABILITY_SPECS) {
  for (const alias of spec.aliases) {
    CAPABILITY_SPECS_BY_ALIAS.set(normalizeKey(alias), CAPABILITY_SPECS_BY_JOB.get(spec.jobId));
  }
}

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeKey(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function readFirstString(...values) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return "";
}

function clamp01(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number <= 0) return 0;
  if (number >= 1) return 1;
  return number;
}

function normalizeReasonCodes(reasonCodes = []) {
  const next = [];
  for (const value of Array.isArray(reasonCodes) ? reasonCodes : [reasonCodes]) {
    const code = normalizeText(value);
    if (!code || next.includes(code)) continue;
    next.push(code);
  }
  return next;
}

function normalizeDisabledReason(value = "") {
  const reason = normalizeText(value);
  return SINGLE_IMAGE_DISABLED_REASONS.includes(reason) ? reason : null;
}

function coerceBoolean(value, fallback = null) {
  if (typeof value === "boolean") return value;
  if (value == null) return fallback;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (["true", "yes", "1", "enabled", "available"].includes(normalized)) return true;
    if (["false", "no", "0", "disabled", "unavailable"].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeMode(value = "") {
  const mode = normalizeKey(value);
  if (!mode) return "";
  if (["local", "local_only", "offline", "no_network", "airgapped"].includes(mode)) return "local_only";
  return mode;
}

function resolveSelectionCount(context = {}) {
  const explicitCount = Number(context.selectionCount);
  if (Number.isFinite(explicitCount) && explicitCount >= 0) return explicitCount;

  const ids = [];
  for (const candidate of [
    context.selectedImageIds,
    context.selected_image_ids,
    context.selection?.selectedImageIds,
    context.selection?.selected_image_ids,
    context.target?.selectedImageIds,
    context.target?.selected_image_ids,
  ]) {
    for (const value of Array.isArray(candidate) ? candidate : []) {
      const imageId = normalizeText(value);
      if (!imageId || ids.includes(imageId)) continue;
      ids.push(imageId);
    }
  }

  const activeId = readFirstString(
    context.activeImageId,
    context.selectedImageId,
    context.selection?.activeId,
    context.selection?.active_id,
    context.target?.activeImageId,
    context.target?.active_image_id
  );
  if (activeId && !ids.includes(activeId)) ids.push(activeId);

  const explicitHasSelection = coerceBoolean(context.hasSelection, null);
  if (explicitHasSelection === true) return Math.max(ids.length, 1);
  if (explicitHasSelection === false) return 0;
  return ids.length;
}

function imageBlocksCapability(capability, context = {}) {
  if (coerceBoolean(context.unsupportedImage, false)) return true;

  const unsupportedCapabilities = [];
  for (const candidate of [context.unsupportedCapabilities, context.image?.unsupportedCapabilities, context.activeImage?.unsupportedCapabilities]) {
    for (const value of Array.isArray(candidate) ? candidate : []) {
      const normalized = normalizeText(value);
      if (normalized) unsupportedCapabilities.push(normalized);
    }
  }
  if (unsupportedCapabilities.includes(capability)) return true;

  const image = asRecord(context.image) || asRecord(context.activeImage) || asRecord(context.target);
  if (!image) return false;
  if (coerceBoolean(image.unsupported, false)) return true;
  if (coerceBoolean(image.supported, true) === false) return true;

  const capabilityFlags = asRecord(image.capabilities);
  if (capabilityFlags && coerceBoolean(capabilityFlags[capability], true) === false) {
    return true;
  }
  return false;
}

function normalizeCapabilityState(value) {
  if (typeof value === "boolean") {
    return {
      available: value,
      disabledReason: value ? null : "capability_unavailable",
      modeUnavailable: false,
      imageUnsupported: false,
    };
  }
  if (typeof value === "string") {
    const normalized = normalizeText(value).toLowerCase();
    if (normalized === "available" || normalized === "enabled") {
      return {
        available: true,
        disabledReason: null,
        modeUnavailable: false,
        imageUnsupported: false,
      };
    }
    const disabledReason = normalizeDisabledReason(normalized) || "capability_unavailable";
    return {
      available: false,
      disabledReason,
      modeUnavailable: disabledReason === "unavailable_in_current_mode",
      imageUnsupported: disabledReason === "unsupported_image",
    };
  }
  const record = asRecord(value);
  if (!record) {
    return {
      available: null,
      disabledReason: null,
      modeUnavailable: false,
      imageUnsupported: false,
    };
  }
  const disabledReason = normalizeDisabledReason(record.disabledReason || record.reason);
  return {
    available: coerceBoolean(record.available, coerceBoolean(record.enabled, null)),
    disabledReason,
    modeUnavailable:
      coerceBoolean(record.modeUnavailable, null) ??
      (coerceBoolean(record.availableInCurrentMode, null) === false),
    imageUnsupported:
      coerceBoolean(record.imageUnsupported, null) ??
      (coerceBoolean(record.supportedImage, null) === false),
  };
}

function resolveCapabilityState(capability, context = {}) {
  for (const registry of [context.capabilityAvailability, context.capabilities, context.capabilityStates]) {
    const record = asRecord(registry);
    if (!record) continue;
    if (Object.prototype.hasOwnProperty.call(record, capability)) {
      return normalizeCapabilityState(record[capability]);
    }
  }
  if (context.capabilityState != null) {
    return normalizeCapabilityState(context.capabilityState);
  }
  if (coerceBoolean(context.capabilityExecutorAvailable, false)) {
    return normalizeCapabilityState(true);
  }
  return normalizeCapabilityState(null);
}

function mergeReasonCodes(base = [], additions = []) {
  return normalizeReasonCodes([...(Array.isArray(base) ? base : [base]), ...(Array.isArray(additions) ? additions : [additions])]);
}

export function listSingleImageCapabilityJobs() {
  return Object.values(SINGLE_IMAGE_CAPABILITY_MAP).map((spec) => ({ ...spec }));
}

export function resolveSingleImageCapabilityJob(value = {}) {
  if (typeof value === "string") {
    const key = normalizeKey(value);
    return CAPABILITY_SPECS_BY_JOB.get(key) || CAPABILITY_SPECS_BY_CAPABILITY.get(value) || CAPABILITY_SPECS_BY_ALIAS.get(key) || null;
  }

  const record = asRecord(value) || {};
  const jobId = readFirstString(record.jobId, record.job_id, record.toolId, record.tool_id, record.toolKey, record.tool_key);
  const capability = readFirstString(record.capability, record.capabilityId, record.capability_id);
  const stickyKey = readFirstString(record.stickyKey, record.sticky_key);
  const alias = readFirstString(record.label, record.name, stickyKey);

  return (
    CAPABILITY_SPECS_BY_JOB.get(normalizeKey(jobId)) ||
    CAPABILITY_SPECS_BY_CAPABILITY.get(capability) ||
    CAPABILITY_SPECS_BY_ALIAS.get(normalizeKey(alias)) ||
    null
  );
}

export function resolveSingleImageCapabilityAvailability(jobOrEntry, context = {}) {
  const job = resolveSingleImageCapabilityJob(jobOrEntry);
  if (!job) return null;

  const selectionCount = resolveSelectionCount(context);
  const mode = normalizeMode(context.mode || context.runtimeMode || context.executionMode);
  const capabilityState = resolveCapabilityState(job.capability, context);
  const reasonCodes = normalizeReasonCodes(context.reasonCodes || []);

  let disabledReason = null;
  if (job.requiresSelection && selectionCount <= 0) {
    disabledReason = "selection_required";
  } else if (coerceBoolean(context.busy, false)) {
    disabledReason = "busy";
  } else if (imageBlocksCapability(job.capability, context) || capabilityState.imageUnsupported) {
    disabledReason = "unsupported_image";
  } else if (mode === "local_only" || capabilityState.modeUnavailable) {
    disabledReason = "unavailable_in_current_mode";
  } else if (capabilityState.disabledReason) {
    disabledReason = capabilityState.disabledReason;
  } else if (capabilityState.available === false || capabilityState.available == null) {
    disabledReason = "capability_unavailable";
  }

  return {
    jobId: job.jobId,
    label: job.label,
    capability: job.capability,
    requiresSelection: job.requiresSelection,
    enabled: !disabledReason,
    disabledReason,
    reasonCodes: disabledReason ? mergeReasonCodes(reasonCodes, [disabledReason]) : reasonCodes,
    stickyKey: job.stickyKey,
  };
}

export function buildSingleImageRailJobEntries(rankedJobs = [], context = {}) {
  const inputByJobId = new Map();
  for (const entry of Array.isArray(rankedJobs) ? rankedJobs : []) {
    const record = asRecord(entry);
    if (!record) continue;
    const job = resolveSingleImageCapabilityJob(record);
    if (!job || inputByJobId.has(job.jobId)) continue;
    inputByJobId.set(job.jobId, record);
  }

  return listSingleImageCapabilityJobs().map((job) => {
    const ranked = inputByJobId.get(job.jobId) || {};
    const availability = resolveSingleImageCapabilityAvailability(job, {
      ...context,
      reasonCodes: ranked.reasonCodes,
    });
    return {
      jobId: job.jobId,
      label: job.label,
      capability: job.capability,
      requiresSelection: job.requiresSelection,
      enabled: Boolean(availability?.enabled),
      disabledReason: availability?.disabledReason || null,
      confidence: clamp01(ranked.confidence, 0),
      reasonCodes: availability?.reasonCodes || [],
      stickyKey: job.stickyKey,
    };
  });
}

export function normalizeSingleImageCapabilityRequest(request = {}) {
  const raw = asRecord(request) || {};
  const execution = asRecord(raw.execution);
  const tool = asRecord(raw.tool);
  const rail = asRecord(raw.rail);
  const contract = readFirstString(raw.contract, raw.contractName, rail?.contract);
  const executionKind = readFirstString(execution?.kind, tool?.executionKind, raw.executionKind);
  const explicitCapability = readFirstString(
    raw.capability,
    raw.capability_id,
    execution?.capability,
    execution?.capability_id,
    tool?.capability
  );
  const explicitJobId = readFirstString(
    raw.jobId,
    raw.job_id,
    raw.toolId,
    raw.tool_id,
    execution?.jobId,
    execution?.job_id,
    tool?.jobId,
    tool?.toolId,
    raw.label
  );
  const job = resolveSingleImageCapabilityJob({
    jobId: explicitJobId,
    capability: explicitCapability,
    label: raw.label || tool?.label || tool?.name,
    stickyKey: rail?.stickyKey,
  });
  if (!job) return null;

  const matchesContract = contract === SINGLE_IMAGE_RAIL_CONTRACT;
  const matchesExecutionKind = executionKind === "model_capability";
  const hasExplicitCapability = Boolean(explicitCapability);
  if (!matchesContract && !matchesExecutionKind && !hasExplicitCapability) {
    return null;
  }

  return {
    ...job,
    contract: SINGLE_IMAGE_RAIL_CONTRACT,
    executionKind: "model_capability",
    params: cloneJson(asRecord(execution?.params) || asRecord(raw.params) || {}),
    confidence: clamp01(raw.confidence ?? rail?.confidence, 0),
    reasonCodes: normalizeReasonCodes(raw.reasonCodes || rail?.reasonCodes || []),
  };
}

export function buildSingleImageCapabilityReceiptStep(jobOrRequest, { outputPath = null, receiptPath = null } = {}) {
  const route = normalizeSingleImageCapabilityRequest(jobOrRequest) || resolveSingleImageCapabilityJob(jobOrRequest);
  if (!route) return null;
  return {
    kind: "model_capability_edit",
    source: "tool_runtime",
    jobId: route.jobId,
    toolId: route.jobId,
    toolName: route.label,
    capability: route.capability,
    outputPath: outputPath ? String(outputPath) : null,
    receiptPath: receiptPath ? String(receiptPath) : null,
  };
}

export function buildSingleImageCapabilityDisabledMessage(jobOrRequest, availability = null) {
  const route = normalizeSingleImageCapabilityRequest(jobOrRequest) || resolveSingleImageCapabilityJob(jobOrRequest);
  const disabledReason = normalizeDisabledReason(availability?.disabledReason) || "capability_unavailable";
  const label = route?.label || "This action";
  if (disabledReason === "selection_required") {
    return `Select an image before using ${label}.`;
  }
  if (disabledReason === "busy") {
    return `${label} is unavailable while another image action is running.`;
  }
  if (disabledReason === "unsupported_image") {
    return `${label} is not supported for the current image.`;
  }
  if (disabledReason === "unavailable_in_current_mode") {
    return `${label} is unavailable in the current mode.`;
  }
  return `${label} is unavailable right now.`;
}
