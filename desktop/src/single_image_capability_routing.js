import { resolveActionProvenance } from "./action_provenance.js";

export const SINGLE_IMAGE_RAIL_CONTRACT = "single-image-rail-v1";

export const SINGLE_IMAGE_DISABLED_REASONS = Object.freeze([
  "selection_required",
  "busy",
  "unsupported_image",
  "unavailable_in_current_mode",
  "capability_unavailable",
]);

export const SINGLE_IMAGE_EXECUTION_TYPES = Object.freeze({
  MODEL_BACKED: "model_backed",
  LOCAL_FIRST: "local_first",
});

const LOCAL_RUNTIME_RESOLUTION_ORDER = Object.freeze([
  "installed_pack_manifest",
  "cue_home_env",
  "cue_env",
  "legacy_env",
]);

export const SINGLE_IMAGE_ROUTE_PROFILES = Object.freeze({
  MODEL_CAPABILITY_ONLY: Object.freeze({
    id: "model_capability_only",
    defaultExecutionKind: "model_capability",
    localOperation: null,
    fallbackExecutionKind: null,
    routingStrategy: "provider_only",
    localRuntimeTarget: null,
    runtimeResolutionOrder: Object.freeze([]),
  }),
  REMOVE_PEOPLE_MODEL: Object.freeze({
    id: "remove_people_model",
    defaultExecutionKind: "model_capability",
    localOperation: null,
    fallbackExecutionKind: null,
    routingStrategy: "provider_only",
    localRuntimeTarget: null,
    runtimeResolutionOrder: Object.freeze([]),
  }),
  POLISH_LOCAL_FIRST: Object.freeze({
    id: "polish_local_first",
    defaultExecutionKind: "local_edit",
    localOperation: "polish",
    fallbackExecutionKind: "model_capability",
    routingStrategy: "local_first_with_model_fallback",
    localRuntimeTarget: "single_image_local_edit",
    runtimeResolutionOrder: LOCAL_RUNTIME_RESOLUTION_ORDER,
    baselinePlatform: "macos",
    windowsStatus: "secondary",
  }),
  RELIGHT_LOCAL_FIRST: Object.freeze({
    id: "relight_local_first",
    defaultExecutionKind: "local_edit",
    localOperation: "relight",
    fallbackExecutionKind: "model_capability",
    routingStrategy: "local_first_with_model_fallback",
    localRuntimeTarget: "single_image_local_edit",
    runtimeResolutionOrder: LOCAL_RUNTIME_RESOLUTION_ORDER,
    baselinePlatform: "macos",
    windowsStatus: "secondary",
  }),
});

const RAW_SINGLE_IMAGE_CAPABILITY_SPECS = Object.freeze([
  Object.freeze({
    jobId: "cut_out",
    label: "Cut Out",
    capability: "subject_isolation",
    requiresSelection: true,
    stickyKey: "single-image-rail:cut_out",
    surface: "rail",
    executionType: SINGLE_IMAGE_EXECUTION_TYPES.MODEL_BACKED,
    routeProfile: SINGLE_IMAGE_ROUTE_PROFILES.MODEL_CAPABILITY_ONLY.id,
    executionKind: "model_capability",
    aliases: Object.freeze(["cut_out", "select_subject"]),
  }),
  Object.freeze({
    jobId: "remove",
    label: "Remove",
    capability: "targeted_remove",
    requiresSelection: true,
    stickyKey: "single-image-rail:remove",
    surface: "rail",
    executionType: SINGLE_IMAGE_EXECUTION_TYPES.MODEL_BACKED,
    routeProfile: SINGLE_IMAGE_ROUTE_PROFILES.MODEL_CAPABILITY_ONLY.id,
    executionKind: "model_capability",
    aliases: Object.freeze(["remove", "cleanup"]),
  }),
  Object.freeze({
    jobId: "new_background",
    label: "New Background",
    capability: "background_replace",
    requiresSelection: true,
    stickyKey: "single-image-rail:new_background",
    surface: "rail",
    executionType: SINGLE_IMAGE_EXECUTION_TYPES.MODEL_BACKED,
    routeProfile: SINGLE_IMAGE_ROUTE_PROFILES.MODEL_CAPABILITY_ONLY.id,
    executionKind: "model_capability",
    aliases: Object.freeze(["new_background", "background_swap"]),
  }),
  Object.freeze({
    jobId: "reframe",
    label: "Reframe",
    capability: "crop_or_outpaint",
    requiresSelection: true,
    stickyKey: "single-image-rail:reframe",
    surface: "rail",
    executionType: SINGLE_IMAGE_EXECUTION_TYPES.MODEL_BACKED,
    routeProfile: SINGLE_IMAGE_ROUTE_PROFILES.MODEL_CAPABILITY_ONLY.id,
    executionKind: "model_capability",
    aliases: Object.freeze(["reframe"]),
  }),
  Object.freeze({
    jobId: "variants",
    label: "Variants",
    capability: "identity_preserving_variation",
    requiresSelection: true,
    stickyKey: "single-image-rail:variants",
    surface: "rail",
    executionType: SINGLE_IMAGE_EXECUTION_TYPES.MODEL_BACKED,
    routeProfile: SINGLE_IMAGE_ROUTE_PROFILES.MODEL_CAPABILITY_ONLY.id,
    executionKind: "model_capability",
    aliases: Object.freeze(["variants", "variations"]),
  }),
]);

const RAW_SINGLE_IMAGE_DIRECT_AFFORDANCE_SPECS = Object.freeze([
  Object.freeze({
    jobId: "remove_people",
    label: "Remove People",
    capability: "people_removal",
    requiresSelection: false,
    stickyKey: "single-image-direct:remove_people",
    surface: "direct",
    executionType: SINGLE_IMAGE_EXECUTION_TYPES.MODEL_BACKED,
    routeProfile: SINGLE_IMAGE_ROUTE_PROFILES.REMOVE_PEOPLE_MODEL.id,
    executionKind: "model_capability",
    aliases: Object.freeze(["remove_people", "remove people", "no_people", "erase_people"]),
  }),
  Object.freeze({
    jobId: "polish",
    label: "Polish",
    capability: "image_polish",
    requiresSelection: false,
    stickyKey: "single-image-direct:polish",
    surface: "direct",
    executionType: SINGLE_IMAGE_EXECUTION_TYPES.LOCAL_FIRST,
    routeProfile: SINGLE_IMAGE_ROUTE_PROFILES.POLISH_LOCAL_FIRST.id,
    executionKind: "local_edit",
    aliases: Object.freeze(["polish", "enhance", "clean_up", "cleanup_finish"]),
  }),
  Object.freeze({
    jobId: "relight",
    label: "Relight",
    capability: "image_relight",
    requiresSelection: false,
    stickyKey: "single-image-direct:relight",
    surface: "direct",
    executionType: SINGLE_IMAGE_EXECUTION_TYPES.LOCAL_FIRST,
    routeProfile: SINGLE_IMAGE_ROUTE_PROFILES.RELIGHT_LOCAL_FIRST.id,
    executionKind: "local_edit",
    aliases: Object.freeze(["relight", "re_light", "lighting", "exposure_fix"]),
  }),
]);

const ROUTE_PROFILES_BY_ID = new Map(
  Object.values(SINGLE_IMAGE_ROUTE_PROFILES).map((profile) => [profile.id, profile])
);

function resolveRouteProfile(routeProfile) {
  const key = normalizeText(routeProfile);
  return ROUTE_PROFILES_BY_ID.get(key) || SINGLE_IMAGE_ROUTE_PROFILES.MODEL_CAPABILITY_ONLY;
}

function buildLocalRuntimeDescriptor(routeProfile, runtimeState = null) {
  if (!routeProfile.localRuntimeTarget) return null;
  const normalizedState = asRecord(runtimeState);
  const descriptor = {
    target: routeProfile.localRuntimeTarget,
    resolutionOrder: Array.isArray(routeProfile.runtimeResolutionOrder)
      ? routeProfile.runtimeResolutionOrder.slice()
      : [],
    baselinePlatform: readFirstString(
      normalizedState?.baselinePlatform,
      routeProfile.baselinePlatform
    ) || null,
    windowsStatus: readFirstString(
      normalizedState?.windowsStatus,
      routeProfile.windowsStatus
    ) || null,
  };
  const available = coerceBoolean(normalizedState?.available, null);
  if (available != null) descriptor.available = available;
  const disabledReason = normalizeDisabledReason(normalizedState?.disabledReason || normalizedState?.reason);
  if (disabledReason) descriptor.disabledReason = disabledReason;
  const packId = readFirstString(normalizedState?.packId, normalizedState?.pack_id);
  if (packId) descriptor.packId = packId;
  const packVersion = readFirstString(normalizedState?.packVersion, normalizedState?.pack_version);
  if (packVersion) descriptor.packVersion = packVersion;
  const resolutionSource = readFirstString(
    normalizedState?.resolutionSource,
    normalizedState?.resolution_source
  );
  if (resolutionSource) descriptor.resolutionSource = resolutionSource;
  return descriptor;
}

function buildPublicSpec(spec) {
  const routeProfile = resolveRouteProfile(spec.routeProfile);
  return Object.freeze({
    jobId: spec.jobId,
    label: spec.label,
    capability: spec.capability,
    requiresSelection: spec.requiresSelection,
    stickyKey: spec.stickyKey,
    surface: spec.surface || "rail",
    executionType: spec.executionType || SINGLE_IMAGE_EXECUTION_TYPES.MODEL_BACKED,
    routeProfile: routeProfile.id,
    executionKind: routeProfile.defaultExecutionKind,
    localOperation: routeProfile.localOperation || null,
    fallbackExecutionKind: routeProfile.fallbackExecutionKind || null,
    routingStrategy: routeProfile.routingStrategy || "provider_only",
    localRuntime: buildLocalRuntimeDescriptor(routeProfile),
    provenance: resolveActionProvenance({
      executionType: spec.executionType || SINGLE_IMAGE_EXECUTION_TYPES.MODEL_BACKED,
      executionKind: routeProfile.defaultExecutionKind,
      capability: spec.capability,
    }),
  });
}

export const SINGLE_IMAGE_CAPABILITY_MAP = Object.freeze(
  Object.fromEntries(
    RAW_SINGLE_IMAGE_CAPABILITY_SPECS.map((spec) => [
      spec.jobId,
      buildPublicSpec(spec),
    ])
  )
);

export const SINGLE_IMAGE_DIRECT_AFFORDANCE_MAP = Object.freeze(
  Object.fromEntries(
    RAW_SINGLE_IMAGE_DIRECT_AFFORDANCE_SPECS.map((spec) => [
      spec.jobId,
      buildPublicSpec(spec),
    ])
  )
);

export const SINGLE_IMAGE_AFFORDANCE_MAP = Object.freeze({
  ...SINGLE_IMAGE_CAPABILITY_MAP,
  ...SINGLE_IMAGE_DIRECT_AFFORDANCE_MAP,
});

const CAPABILITY_SPECS_BY_JOB = new Map(
  Object.values(SINGLE_IMAGE_AFFORDANCE_MAP).map((spec) => [spec.jobId, spec])
);

const CAPABILITY_SPECS_BY_CAPABILITY = new Map(
  Object.values(SINGLE_IMAGE_AFFORDANCE_MAP).map((spec) => [spec.capability, spec])
);

const CAPABILITY_SPECS_BY_ALIAS = new Map();
for (const spec of [...RAW_SINGLE_IMAGE_CAPABILITY_SPECS, ...RAW_SINGLE_IMAGE_DIRECT_AFFORDANCE_SPECS]) {
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

function normalizeTextList(values = []) {
  const next = [];
  for (const value of Array.isArray(values) ? values : [values]) {
    const text = normalizeText(value);
    if (!text || next.includes(text)) continue;
    next.push(text);
  }
  return next;
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

function normalizeLocalRuntimeState(value, fallback = null) {
  const fallbackRecord = asRecord(fallback) || {};
  const fallbackAvailable = coerceBoolean(fallbackRecord.available, null);
  if (typeof value === "boolean") {
    return {
      available: value,
      disabledReason: value ? null : "capability_unavailable",
      packId: readFirstString(fallbackRecord.packId, fallbackRecord.pack_id) || null,
      packVersion: readFirstString(fallbackRecord.packVersion, fallbackRecord.pack_version) || null,
      resolutionSource:
        readFirstString(fallbackRecord.resolutionSource, fallbackRecord.resolution_source) || null,
      resolutionOrder: normalizeTextList(
        fallbackRecord.resolutionOrder || fallbackRecord.resolution_order || []
      ),
      baselinePlatform:
        readFirstString(fallbackRecord.baselinePlatform, fallbackRecord.baseline_platform) || null,
      windowsStatus:
        readFirstString(fallbackRecord.windowsStatus, fallbackRecord.windows_status) || null,
    };
  }
  if (typeof value === "string") {
    const normalized = normalizeText(value).toLowerCase();
    const available = coerceBoolean(normalized, fallbackAvailable);
    return {
      available,
      disabledReason:
        normalizeDisabledReason(normalized) || (available === false ? "capability_unavailable" : null),
      packId: readFirstString(fallbackRecord.packId, fallbackRecord.pack_id) || null,
      packVersion: readFirstString(fallbackRecord.packVersion, fallbackRecord.pack_version) || null,
      resolutionSource:
        readFirstString(fallbackRecord.resolutionSource, fallbackRecord.resolution_source) || null,
      resolutionOrder: normalizeTextList(
        fallbackRecord.resolutionOrder || fallbackRecord.resolution_order || []
      ),
      baselinePlatform:
        readFirstString(fallbackRecord.baselinePlatform, fallbackRecord.baseline_platform) || null,
      windowsStatus:
        readFirstString(fallbackRecord.windowsStatus, fallbackRecord.windows_status) || null,
    };
  }
  const record = asRecord(value);
  if (!record) {
    return {
      available: fallbackAvailable,
      disabledReason:
        normalizeDisabledReason(fallbackRecord.disabledReason || fallbackRecord.reason) || null,
      packId: readFirstString(fallbackRecord.packId, fallbackRecord.pack_id) || null,
      packVersion: readFirstString(fallbackRecord.packVersion, fallbackRecord.pack_version) || null,
      resolutionSource:
        readFirstString(fallbackRecord.resolutionSource, fallbackRecord.resolution_source) || null,
      resolutionOrder: normalizeTextList(
        fallbackRecord.resolutionOrder || fallbackRecord.resolution_order || []
      ),
      baselinePlatform:
        readFirstString(fallbackRecord.baselinePlatform, fallbackRecord.baseline_platform) || null,
      windowsStatus:
        readFirstString(fallbackRecord.windowsStatus, fallbackRecord.windows_status) || null,
    };
  }
  const disabledReason = normalizeDisabledReason(record.disabledReason || record.reason);
  return {
    available:
      coerceBoolean(record.available, coerceBoolean(record.enabled, fallbackAvailable)) ??
      fallbackAvailable,
    disabledReason,
    packId: readFirstString(record.packId, record.pack_id, fallbackRecord.packId, fallbackRecord.pack_id) || null,
    packVersion:
      readFirstString(
        record.packVersion,
        record.pack_version,
        fallbackRecord.packVersion,
        fallbackRecord.pack_version
      ) || null,
    resolutionSource:
      readFirstString(
        record.resolutionSource,
        record.resolution_source,
        fallbackRecord.resolutionSource,
        fallbackRecord.resolution_source
      ) || null,
    resolutionOrder: normalizeTextList(
      record.resolutionOrder ||
        record.resolution_order ||
        fallbackRecord.resolutionOrder ||
        fallbackRecord.resolution_order ||
        []
    ),
    baselinePlatform:
      readFirstString(
        record.baselinePlatform,
        record.baseline_platform,
        fallbackRecord.baselinePlatform,
        fallbackRecord.baseline_platform
      ) || null,
    windowsStatus:
      readFirstString(
        record.windowsStatus,
        record.windows_status,
        fallbackRecord.windowsStatus,
        fallbackRecord.windows_status
      ) || null,
  };
}

function normalizeMode(value = "") {
  const mode = normalizeKey(value);
  if (!mode) return "";
  if (["local", "local_only", "offline", "no_network", "airgapped"].includes(mode)) return "local_only";
  return mode;
}

function requestTargetsSubRegion(params = {}) {
  const scope = normalizeKey(readFirstString(params.scope, params.targetScope, params.regionScope, params.applyTo));
  if (!scope) return false;
  return !["global", "full_image", "entire_image", "image", "frame", "whole_image", "auto"].includes(scope);
}

function requestHasPrompt(params = {}) {
  return Boolean(readFirstString(params.prompt, params.editPrompt, params.selectionPrompt, params.rewritePrompt));
}

function requestNeedsDirectionalRelight(params = {}) {
  const direction = normalizeKey(readFirstString(params.lightDirection, params.direction, params.lightSource, params.shadowDirection));
  if (direction && !["ambient", "global", "auto", "soft"].includes(direction)) return true;
  return Number.isFinite(Number(params.lightAngle));
}

function requestNeedsModelFallback(spec, params = {}, context = {}) {
  if (coerceBoolean(context.forceModel ?? params.forceModel, false)) return true;
  if (spec.executionType !== SINGLE_IMAGE_EXECUTION_TYPES.LOCAL_FIRST) return false;
  if (requestTargetsSubRegion(params)) return true;
  if (spec.jobId === "polish") {
    return coerceBoolean(params.reconstruct, false) || coerceBoolean(params.heal, false) || requestHasPrompt(params);
  }
  if (spec.jobId === "relight") {
    return requestNeedsDirectionalRelight(params) || requestHasPrompt(params);
  }
  return false;
}

function resolveLocalRuntimeState(spec, context = {}) {
  if (spec.executionType !== SINGLE_IMAGE_EXECUTION_TYPES.LOCAL_FIRST) return null;
  const routeProfile = resolveRouteProfile(spec.routeProfile);
  const fallback = buildLocalRuntimeDescriptor(routeProfile);
  for (const registry of [
    context.localRuntimeAvailability,
    context.localRuntimeStates,
    context.localRuntime,
  ]) {
    const record = asRecord(registry);
    if (!record) {
      if (registry != null && registry === context.localRuntime) {
        return normalizeLocalRuntimeState(registry, fallback);
      }
      continue;
    }
    for (const key of [
      spec.jobId,
      spec.capability,
      routeProfile.localOperation,
      routeProfile.localRuntimeTarget,
    ]) {
      const normalizedKey = normalizeText(key);
      if (!normalizedKey) continue;
      if (Object.prototype.hasOwnProperty.call(record, normalizedKey)) {
        return normalizeLocalRuntimeState(record[normalizedKey], fallback);
      }
    }
    if (registry === context.localRuntime) {
      return normalizeLocalRuntimeState(registry, fallback);
    }
  }
  if (context.localExecutorAvailable != null) {
    return normalizeLocalRuntimeState(
      { available: coerceBoolean(context.localExecutorAvailable, null) },
      fallback
    );
  }
  const embeddedRuntime = asRecord(spec.localRuntime);
  if (embeddedRuntime) {
    return normalizeLocalRuntimeState(embeddedRuntime, fallback);
  }
  return normalizeLocalRuntimeState(null, fallback);
}

function resolvedExecutionKindForSpec(spec, params = {}, context = {}) {
  const routeProfile = resolveRouteProfile(spec.routeProfile);
  const explicitExecutionKind = readFirstString(context.executionKind, context.execution?.kind);
  const mode = normalizeMode(context.mode || context.runtimeMode || context.executionMode);
  const localRuntime = resolveLocalRuntimeState(spec, context);

  if (explicitExecutionKind === "model_capability") return "model_capability";
  if (explicitExecutionKind === "local_edit" && routeProfile.localOperation) return "local_edit";
  if (
    spec.executionType === SINGLE_IMAGE_EXECUTION_TYPES.LOCAL_FIRST &&
    routeProfile.fallbackExecutionKind &&
    localRuntime?.available === false &&
    mode !== "local_only"
  ) {
    return routeProfile.fallbackExecutionKind;
  }
  if (
    spec.executionType === SINGLE_IMAGE_EXECUTION_TYPES.LOCAL_FIRST &&
    routeProfile.fallbackExecutionKind &&
    requestNeedsModelFallback(spec, params, context)
  ) {
    return routeProfile.fallbackExecutionKind;
  }
  return routeProfile.defaultExecutionKind;
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

function resolveSubjectSelectionAvailable(context = {}) {
  for (const candidate of [
    context.subjectSelectionAvailable,
    context.subject_selection_available,
    context.regionSelectionActive,
    context.region_selection_active,
    context.selection?.subjectSelectionAvailable,
    context.selection?.subject_selection_available,
    context.selection?.regionSelectionActive,
    context.selection?.region_selection_active,
    context.target?.subjectSelectionAvailable,
    context.target?.subject_selection_available,
    context.target?.regionSelectionActive,
    context.target?.region_selection_active,
  ]) {
    const value = coerceBoolean(candidate, null);
    if (value != null) return value;
  }
  return false;
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

export function listSingleImageDirectAffordances() {
  return Object.values(SINGLE_IMAGE_DIRECT_AFFORDANCE_MAP).map((spec) => ({ ...spec }));
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

export function resolveSingleImageAffordanceRoute(value = {}, context = {}) {
  const raw = asRecord(value) || {};
  const execution = asRecord(raw.execution);
  const tool = asRecord(raw.tool);
  const nestedRoute = asRecord(raw.route);
  const spec = resolveSingleImageCapabilityJob(value);
  if (!spec) return null;

  const params = cloneJson(asRecord(execution?.params) || asRecord(raw.params) || {});
  const executionKind = resolvedExecutionKindForSpec(spec, params, {
    ...context,
    execution,
    executionKind: readFirstString(execution?.kind, raw.executionKind, raw.kind),
    mode: context.mode || raw.mode || raw.runtimeMode || raw.executionMode,
  });
  const routeProfile = resolveRouteProfile(spec.routeProfile);
  const localRuntime = resolveLocalRuntimeState(spec, {
    ...context,
    localRuntime:
      context.localRuntime ||
      raw.localRuntime ||
      execution?.localRuntime ||
      tool?.localRuntime ||
      nestedRoute?.localRuntime ||
      null,
  });

  return {
    ...spec,
    executionKind,
    routeProfile: routeProfile.id,
    localOperation: routeProfile.localOperation || null,
    fallbackExecutionKind: routeProfile.fallbackExecutionKind || null,
    routingStrategy:
      readFirstString(
        raw.routingStrategy,
        execution?.routingStrategy,
        tool?.routingStrategy,
        nestedRoute?.routingStrategy
      ) ||
      routeProfile.routingStrategy ||
      spec.routingStrategy ||
      "provider_only",
    localRuntime: buildLocalRuntimeDescriptor(routeProfile, localRuntime),
    params,
    confidence: clamp01(raw.confidence ?? asRecord(raw.rail)?.confidence, 0),
    reasonCodes: normalizeReasonCodes(raw.reasonCodes || asRecord(raw.rail)?.reasonCodes || []),
    provenance: spec.provenance,
  };
}

export function resolveSingleImageCapabilityAvailability(jobOrEntry, context = {}) {
  const route = resolveSingleImageAffordanceRoute(jobOrEntry, context);
  if (!route) return null;

  const selectionCount = resolveSelectionCount(context);
  const subjectSelectionAvailable = resolveSubjectSelectionAvailable(context);
  const mode = normalizeMode(context.mode || context.runtimeMode || context.executionMode);
  const capabilityState = resolveCapabilityState(route.capability, context);
  const localRuntime = resolveLocalRuntimeState(route, context);
  const reasonCodes = normalizeReasonCodes(context.reasonCodes || []);
  const usesLocalExecution = route.executionKind === "local_edit";

  let disabledReason = null;
  if (route.capability === "subject_isolation" && route.requiresSelection && !subjectSelectionAvailable) {
    disabledReason = "selection_required";
  } else if (route.requiresSelection && selectionCount <= 0) {
    disabledReason = "selection_required";
  } else if (coerceBoolean(context.busy, false)) {
    disabledReason = "busy";
  } else if (imageBlocksCapability(route.capability, context) || capabilityState.imageUnsupported) {
    disabledReason = "unsupported_image";
  } else if (!usesLocalExecution && (mode === "local_only" || capabilityState.modeUnavailable)) {
    disabledReason = "unavailable_in_current_mode";
  } else if (!usesLocalExecution && capabilityState.disabledReason) {
    disabledReason = capabilityState.disabledReason;
  } else if (usesLocalExecution && coerceBoolean(context.localExecutorAvailable, true) === false) {
    disabledReason = "capability_unavailable";
  } else if (!usesLocalExecution && (capabilityState.available === false || capabilityState.available == null)) {
    disabledReason = "capability_unavailable";
  }

  const availability = {
    jobId: route.jobId,
    label: route.label,
    capability: route.capability,
    requiresSelection: route.requiresSelection,
    enabled: !disabledReason,
    disabledReason,
    reasonCodes: disabledReason ? mergeReasonCodes(reasonCodes, [disabledReason]) : reasonCodes,
    stickyKey: route.stickyKey,
    provenance: route.provenance,
  };
  if (route.surface === "direct") {
    availability.executionType = route.executionType;
    availability.executionKind = route.executionKind;
    availability.routeProfile = route.routeProfile;
    availability.routingStrategy = route.routingStrategy;
    availability.localOperation = route.localOperation || null;
    availability.localRuntime = buildLocalRuntimeDescriptor(resolveRouteProfile(route.routeProfile), localRuntime);
  }
  return availability;
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
      provenance: job.provenance,
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
  const operation = readFirstString(execution?.operation, tool?.operation, raw.operation);
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
  const route = resolveSingleImageAffordanceRoute({
    jobId: explicitJobId,
    capability: explicitCapability,
    label: raw.label || tool?.label || tool?.name,
    execution,
    executionKind,
    params: asRecord(execution?.params) || asRecord(raw.params) || {},
    stickyKey: rail?.stickyKey,
    confidence: raw.confidence ?? rail?.confidence,
    reasonCodes: raw.reasonCodes || rail?.reasonCodes || [],
  }, raw);
  if (!route) return null;

  const matchesContract = contract === SINGLE_IMAGE_RAIL_CONTRACT;
  const matchesExecutionKind = executionKind === "model_capability";
  const hasExplicitCapability = Boolean(explicitCapability);
  if (!matchesContract && !matchesExecutionKind && !hasExplicitCapability) {
    return null;
  }
  if (executionKind === "local_edit" && operation) {
    return null;
  }
  if (route.executionKind !== "model_capability") {
    return null;
  }

  return {
    ...route,
    contract: SINGLE_IMAGE_RAIL_CONTRACT,
  };
}

export function buildSingleImageCapabilityReceiptStep(jobOrRequest, { outputPath = null, receiptPath = null } = {}) {
  const route = normalizeSingleImageCapabilityRequest(jobOrRequest) || resolveSingleImageAffordanceRoute(jobOrRequest);
  if (!route) return null;
  const step = {
    kind: "model_capability_edit",
    source: "tool_runtime",
    jobId: route.jobId,
    toolId: route.jobId,
    toolName: route.label,
    capability: route.capability,
    outputPath: outputPath ? String(outputPath) : null,
    receiptPath: receiptPath ? String(receiptPath) : null,
  };
  if (route.surface === "direct") {
    step.executionType = route.executionType;
    step.routeProfile = route.routeProfile;
    if (route.routingStrategy) step.routingStrategy = route.routingStrategy;
    if (route.localRuntime) step.localRuntime = cloneJson(route.localRuntime);
  }
  return step;
}

export function buildSingleImageCapabilityDisabledMessage(jobOrRequest, availability = null) {
  const route = normalizeSingleImageCapabilityRequest(jobOrRequest) || resolveSingleImageAffordanceRoute(jobOrRequest);
  const disabledReason = normalizeDisabledReason(availability?.disabledReason) || "capability_unavailable";
  const label = route?.label || "This action";
  if (disabledReason === "selection_required") {
    if (route?.capability === "subject_isolation") {
      return `${label} needs a lasso or Magic Select region first.`;
    }
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
