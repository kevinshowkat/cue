import {
  SINGLE_IMAGE_EXECUTION_TYPES,
  SINGLE_IMAGE_RAIL_CONTRACT,
  resolveSingleImageAffordanceRoute,
  resolveSingleImageCapabilityAvailability,
  resolveSingleImageCapabilityJob,
} from "./single_image_capability_routing.js";
import {
  ACTION_PROVENANCE,
  resolveActionProvenance,
} from "./action_provenance.js";

export const TOOL_MANIFEST_SCHEMA = "juggernaut.tool_manifest.v1";
export const TOOL_INVOCATION_SCHEMA = "juggernaut.tool_invocation.v1";
export const TOOL_INVOCATION_EVENT = "juggernaut:tool-invoked";
export const TOOL_RUNTIME_BRIDGE_KEY = "__JUGGERNAUT_TOOL_RUNTIME__";
export const CREATE_TOOL_AFFORDANCE_ID = "create_tool";
export const CREATE_TOOL_INVOCATION_CONTRACT = "juggernaut.create_tool.v1";
export const CREATE_TOOL_EXECUTION_TYPE = "tool_manifest_generation";
export const CREATE_TOOL_ROUTE_PROFILE = "create_tool_local_manifest_builder_v1";

export { ACTION_PROVENANCE } from "./action_provenance.js";

export {
  SINGLE_IMAGE_AFFORDANCE_MAP,
  SINGLE_IMAGE_CAPABILITY_MAP,
  SINGLE_IMAGE_DIRECT_AFFORDANCE_MAP,
  SINGLE_IMAGE_DISABLED_REASONS,
  SINGLE_IMAGE_EXECUTION_TYPES,
  SINGLE_IMAGE_RAIL_CONTRACT,
  SINGLE_IMAGE_ROUTE_PROFILES,
  buildSingleImageRailJobEntries,
  listSingleImageCapabilityJobs,
  listSingleImageDirectAffordances,
  normalizeSingleImageCapabilityRequest,
  resolveSingleImageAffordanceRoute,
  resolveSingleImageCapabilityAvailability,
} from "./single_image_capability_routing.js";

const TOOL_GENERATOR_ID = "juggernaut.local_manifest_builder.v1";
const DEFAULT_VISIBLE_TOOL_LIMIT = 3;

const TOOL_LIBRARY = Object.freeze([
  Object.freeze({
    matcherId: "grayscale",
    label: "Mono",
    shortLabel: "Mono",
    glyph: "mono",
    summary: "Convert the active image to grayscale.",
    keywords: Object.freeze(["grayscale", "greyscale", "black and white", "b&w", "mono", "monochrome"]),
    execution: Object.freeze({
      kind: "local_edit",
      operation: "grayscale",
      params: Object.freeze({ amount: 1 }),
    }),
  }),
  Object.freeze({
    matcherId: "sepia",
    label: "Sepia",
    shortLabel: "Sepia",
    glyph: "sepia",
    summary: "Apply a warm sepia tone to the active image.",
    keywords: Object.freeze(["sepia", "vintage", "retro", "aged", "film"]),
    execution: Object.freeze({
      kind: "local_edit",
      operation: "sepia",
      params: Object.freeze({ amount: 0.72 }),
    }),
  }),
  Object.freeze({
    matcherId: "invert",
    label: "Invert",
    shortLabel: "Invert",
    glyph: "invert",
    summary: "Invert the active image colors.",
    keywords: Object.freeze(["invert", "negative", "xray", "solarize"]),
    execution: Object.freeze({
      kind: "local_edit",
      operation: "invert",
      params: Object.freeze({ amount: 1 }),
    }),
  }),
  Object.freeze({
    matcherId: "blur",
    label: "Blur",
    shortLabel: "Blur",
    glyph: "blur",
    summary: "Soften the active image with a blur pass.",
    keywords: Object.freeze(["blur", "soften", "soft focus", "dreamy", "haze"]),
    execution: Object.freeze({
      kind: "local_edit",
      operation: "blur",
      params: Object.freeze({ radius: 4 }),
    }),
  }),
  Object.freeze({
    matcherId: "brightness_up",
    label: "Brighten",
    shortLabel: "Bright",
    glyph: "brightness",
    summary: "Lift brightness on the active image.",
    keywords: Object.freeze(["brighten", "brighter", "lighten", "lighter", "exposure", "lift"]),
    execution: Object.freeze({
      kind: "local_edit",
      operation: "brightness",
      params: Object.freeze({ amount: 0.18 }),
    }),
  }),
  Object.freeze({
    matcherId: "brightness_down",
    label: "Darken",
    shortLabel: "Dark",
    glyph: "shadow",
    summary: "Reduce brightness on the active image.",
    keywords: Object.freeze(["darken", "darker", "moody", "dim", "shadow"]),
    execution: Object.freeze({
      kind: "local_edit",
      operation: "brightness",
      params: Object.freeze({ amount: -0.18 }),
    }),
  }),
  Object.freeze({
    matcherId: "contrast",
    label: "Contrast",
    shortLabel: "Punch",
    glyph: "contrast",
    summary: "Increase contrast on the active image.",
    keywords: Object.freeze(["contrast", "punch", "crisp", "pop", "clarity"]),
    execution: Object.freeze({
      kind: "local_edit",
      operation: "contrast",
      params: Object.freeze({ amount: 0.24 }),
    }),
  }),
  Object.freeze({
    matcherId: "saturation_up",
    label: "Vibrance",
    shortLabel: "Vibrant",
    glyph: "saturation",
    summary: "Boost color saturation on the active image.",
    keywords: Object.freeze(["vibrant", "vibrance", "saturate", "saturated", "colorful", "rich color"]),
    execution: Object.freeze({
      kind: "local_edit",
      operation: "saturation",
      params: Object.freeze({ amount: 0.28 }),
    }),
  }),
  Object.freeze({
    matcherId: "saturation_down",
    label: "Muted",
    shortLabel: "Muted",
    glyph: "muted",
    summary: "Reduce color saturation on the active image.",
    keywords: Object.freeze(["desaturate", "desaturated", "muted", "wash out", "soft color"]),
    execution: Object.freeze({
      kind: "local_edit",
      operation: "saturation",
      params: Object.freeze({ amount: -0.34 }),
    }),
  }),
  Object.freeze({
    matcherId: "flip_horizontal",
    label: "Mirror",
    shortLabel: "Mirror",
    glyph: "mirror",
    summary: "Flip the active image horizontally.",
    keywords: Object.freeze(["mirror", "flip horizontal", "flip left right", "left right", "reflect"]),
    execution: Object.freeze({
      kind: "local_edit",
      operation: "flip_horizontal",
      params: Object.freeze({}),
    }),
  }),
]);

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function stableMatchText(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function slugifyToolId(value = "") {
  const base = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "custom-tool";
}

function deriveToolLabel({ name = "", description = "", fallbackLabel = "Custom Tool" } = {}) {
  const explicit = normalizeText(name);
  if (explicit) return explicit;
  const firstLine = normalizeText(String(description || "").split(/\n+/)[0] || "");
  if (!firstLine) return fallbackLabel;
  const clipped = firstLine.length > 28 ? `${firstLine.slice(0, 27).trimEnd()}…` : firstLine;
  return clipped
    .split(/\s+/)
    .slice(0, 4)
    .join(" ");
}

function deriveShortLabel(label = "", fallback = "Tool") {
  const words = normalizeText(label).split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  if (words.length === 1) return words[0].slice(0, 8);
  return words
    .slice(0, 2)
    .map((part) => part.slice(0, 4))
    .join(" ");
}

function normalizeSelectionTarget({ activeImageId = null, selectedImageIds = [] } = {}) {
  const activeId = normalizeText(activeImageId);
  const selection = [];
  for (const id of Array.isArray(selectedImageIds) ? selectedImageIds : []) {
    const key = normalizeText(id);
    if (!key || selection.includes(key)) continue;
    selection.push(key);
  }
  if (activeId && !selection.includes(activeId)) selection.push(activeId);
  return {
    activeId,
    selection,
  };
}

function nextUniqueToolId(baseId = "custom-tool", existingIds = []) {
  const used = new Set((Array.isArray(existingIds) ? existingIds : []).map((id) => String(id || "").trim()).filter(Boolean));
  if (!used.has(baseId)) return baseId;
  let index = 2;
  while (used.has(`${baseId}-${index}`)) {
    index += 1;
  }
  return `${baseId}-${index}`;
}

function bestToolMatch(text = "") {
  const normalized = stableMatchText(text);
  if (!normalized) return TOOL_LIBRARY.find((entry) => entry.matcherId === "contrast") || TOOL_LIBRARY[0];
  let best = null;
  for (const candidate of TOOL_LIBRARY) {
    let score = 0;
    for (const keyword of candidate.keywords) {
      if (normalized.includes(stableMatchText(keyword))) score += stableMatchText(keyword).split(" ").length;
    }
    if (!best || score > best.score) {
      best = { candidate, score };
    }
  }
  if (best?.score > 0) return best.candidate;
  if (/\bdramatic\b|\bpunchy\b|\bstrong\b/.test(normalized)) {
    return TOOL_LIBRARY.find((entry) => entry.matcherId === "contrast") || TOOL_LIBRARY[0];
  }
  return TOOL_LIBRARY.find((entry) => entry.matcherId === "brightness_up") || TOOL_LIBRARY[0];
}

export function inferToolDefinition({ name = "", description = "" } = {}) {
  const normalizedDescription = normalizeText(description);
  if (!normalizedDescription) {
    throw new Error("Describe the tool first.");
  }
  const matched = bestToolMatch(`${name} ${normalizedDescription}`);
  const label = deriveToolLabel({
    name,
    description,
    fallbackLabel: matched?.label || "Custom Tool",
  });
  return {
    matched,
    label,
    shortLabel: deriveShortLabel(label, matched?.shortLabel || "Tool"),
    description: normalizedDescription,
  };
}

export function normalizeToolManifest(raw = {}, { existingIds = [] } = {}) {
  const description = normalizeText(raw?.description || raw?.prompt || "");
  const inferred = inferToolDefinition({
    name: raw?.label || raw?.name || "",
    description,
  });
  const execution = raw?.execution && typeof raw.execution === "object" ? raw.execution : inferred.matched.execution;
  const baseId = slugifyToolId(raw?.toolId || raw?.id || inferred.label);
  const toolId = nextUniqueToolId(baseId, existingIds);
  const createdAt = raw?.origin?.createdAt || raw?.createdAt || new Date().toISOString();
  const manifest = {
    schema: TOOL_MANIFEST_SCHEMA,
    version: 1,
    toolId,
    label: inferred.label,
    shortLabel: normalizeText(raw?.shortLabel || inferred.shortLabel).slice(0, 18) || inferred.shortLabel,
    description,
    origin: {
      kind: "user_generated",
      generator: TOOL_GENERATOR_ID,
      createdAt,
    },
    display: {
      glyph: normalizeText(raw?.display?.glyph || inferred.matched?.glyph || "spark"),
      surface: "custom_tool_dock",
    },
    inputContract: {
      requiresActiveImage: true,
      minImages: Math.max(1, Number(raw?.inputContract?.minImages) || 1),
      maxImages: Math.max(1, Number(raw?.inputContract?.maxImages) || 1),
      acceptedTarget: "active_image",
    },
    outputContract: {
      kind: "image_mutation",
      target: "active_image",
      previewable: true,
    },
    execution: {
      kind: String(execution?.kind || "local_edit"),
      operation: String(execution?.operation || inferred.matched.execution.operation || "contrast"),
      params: cloneJson(execution?.params || inferred.matched.execution.params || {}),
    },
    provenance: resolveActionProvenance({
      executionKind: execution?.kind || inferred.matched.execution.kind,
    }),
    receipt: {
      include: ["tool_manifest", "tool_invocation", "selection", "execution"],
      reproducible: true,
    },
    failureBehavior: {
      kind: "toast",
      message: `${inferred.label} could not be applied.`,
    },
  };
  return manifest;
}

export function generateToolManifest({ name = "", description = "", existingIds = [] } = {}) {
  return normalizeToolManifest(
    {
      label: name,
      description,
    },
    { existingIds }
  );
}

export function buildToolInvocation(
  manifest,
  {
    activeImageId = null,
    selectedImageIds = [],
    source = "custom_tool_dock",
    trigger = "click",
    requestId = "",
  } = {}
) {
  const normalizedManifest = normalizeToolManifest(manifest);
  const { activeId, selection } = normalizeSelectionTarget({ activeImageId, selectedImageIds });
  return {
    schema: TOOL_INVOCATION_SCHEMA,
    requestId: normalizeText(requestId) || `tool-${Date.now()}`,
    issuedAt: new Date().toISOString(),
    source: normalizeText(source) || "custom_tool_dock",
    trigger: normalizeText(trigger) || "click",
    tool: {
      toolId: normalizedManifest.toolId,
      label: normalizedManifest.label,
      version: normalizedManifest.version,
      executionKind: normalizedManifest.execution.kind,
      provenance: normalizedManifest.provenance || ACTION_PROVENANCE.LOCAL_ONLY,
    },
    target: {
      activeImageId: activeId || null,
      selectedImageIds: selection,
    },
    execution: cloneJson(normalizedManifest.execution),
    provenance: normalizedManifest.provenance || ACTION_PROVENANCE.LOCAL_ONLY,
    inputContract: cloneJson(normalizedManifest.inputContract),
    receipt: {
      manifestSchema: normalizedManifest.schema,
      reproducible: Boolean(normalizedManifest.receipt?.reproducible),
      include: cloneJson(normalizedManifest.receipt?.include || []),
    },
    failureBehavior: cloneJson(normalizedManifest.failureBehavior),
  };
}

export function buildCreateToolInvocation(
  {
    name = "",
    description = "",
    existingIds = [],
    source = "create_tool_panel",
    trigger = "click",
    requestId = "",
  } = {}
) {
  const normalizedName = normalizeText(name);
  const normalizedDescription = normalizeText(description);
  const normalizedExistingIds = Array.isArray(existingIds)
    ? existingIds.map((id) => normalizeText(id)).filter(Boolean)
    : [];
  const generatedManifest = generateToolManifest({
    name: normalizedName,
    description: normalizedDescription,
    existingIds: normalizedExistingIds,
  });

  return {
    contract: CREATE_TOOL_INVOCATION_CONTRACT,
    schema: TOOL_INVOCATION_SCHEMA,
    requestId: normalizeText(requestId) || `tool-${Date.now()}`,
    issuedAt: new Date().toISOString(),
    source: normalizeText(source) || "create_tool_panel",
    trigger: normalizeText(trigger) || "click",
    jobId: CREATE_TOOL_AFFORDANCE_ID,
    label: "Create Tool",
    tool: {
      toolId: CREATE_TOOL_AFFORDANCE_ID,
      jobId: CREATE_TOOL_AFFORDANCE_ID,
      label: "Create Tool",
      version: 1,
      executionKind: "local_manifest_builder",
      executionType: CREATE_TOOL_EXECUTION_TYPE,
      routeProfile: CREATE_TOOL_ROUTE_PROFILE,
      surface: "custom_tool_dock",
      provenance: ACTION_PROVENANCE.LOCAL_ONLY,
    },
    draft: {
      name: normalizedName,
      description: normalizedDescription,
    },
    generatedManifest,
    execution: {
      kind: "local_manifest_builder",
      generator: TOOL_GENERATOR_ID,
      executionType: CREATE_TOOL_EXECUTION_TYPE,
      routeProfile: CREATE_TOOL_ROUTE_PROFILE,
      params: {
        existingIds: normalizedExistingIds,
      },
    },
    provenance: ACTION_PROVENANCE.LOCAL_ONLY,
    inputContract: {
      requiresDescription: true,
      acceptsOptionalName: true,
      target: "session_tool_registry",
    },
    outputContract: {
      kind: "tool_manifest",
      target: "session_tool_registry",
      previewable: true,
      visibleInDock: true,
    },
    receipt: {
      manifestSchema: TOOL_MANIFEST_SCHEMA,
      reproducible: true,
      include: ["tool_draft", "tool_manifest", "tool_generator"],
    },
    failureBehavior: {
      kind: "toast",
      message: "Create Tool could not build a manifest.",
    },
  };
}

export function createInSessionToolRegistry(initialTools = []) {
  const toolsById = new Map();
  const orderedIds = [];

  function register(rawTool) {
    const manifest = normalizeToolManifest(rawTool, { existingIds: orderedIds });
    if (!toolsById.has(manifest.toolId)) orderedIds.push(manifest.toolId);
    toolsById.set(manifest.toolId, manifest);
    return cloneJson(manifest);
  }

  function createFromDescription({ name = "", description = "" } = {}) {
    const manifest = generateToolManifest({ name, description, existingIds: orderedIds });
    return register(manifest);
  }

  function get(toolId) {
    const key = normalizeText(toolId);
    if (!key) return null;
    return cloneJson(toolsById.get(key) || null);
  }

  function list() {
    return orderedIds.map((id) => cloneJson(toolsById.get(id))).filter(Boolean);
  }

  function visible({ limit = DEFAULT_VISIBLE_TOOL_LIMIT } = {}) {
    const count = Math.max(0, Number(limit) || 0);
    return orderedIds
      .slice(-count)
      .reverse()
      .map((id) => cloneJson(toolsById.get(id)))
      .filter(Boolean);
  }

  for (const item of Array.isArray(initialTools) ? initialTools : []) {
    register(item);
  }

  return {
    register,
    createFromDescription,
    get,
    list,
    visible,
    size() {
      return orderedIds.length;
    },
  };
}

function buildSingleImageAffordanceToolDescriptor(route) {
  return {
    toolId: route.jobId,
    jobId: route.jobId,
    label: route.label,
    version: 1,
    executionKind: route.executionKind,
    executionType: route.executionType,
    capability: route.capability,
    routeProfile: route.routeProfile,
    requiresSelection: route.requiresSelection,
    surface: route.surface || "direct",
    provenance: route.provenance,
  };
}

function buildSingleImageAffordanceExecutionDescriptor(route) {
  if (route.executionKind === "local_edit") {
    return {
      kind: "local_edit",
      operation: route.localOperation,
      capability: route.capability,
      jobId: route.jobId,
      executionType: route.executionType,
      routeProfile: route.routeProfile,
      params: cloneJson(route.params || {}),
      provenance: resolveActionProvenance({
        executionKind: "local_edit",
      }),
    };
  }
  return {
    kind: "model_capability",
    capability: route.capability,
    jobId: route.jobId,
    executionType: route.executionType,
    routeProfile: route.routeProfile,
    params: cloneJson(route.params || {}),
    provenance: resolveActionProvenance({
      executionKind: "model_capability",
    }),
  };
}

export function buildSingleImageRailInvocation(
  jobOrId,
  {
    activeImageId = null,
    selectedImageIds = [],
    subjectSelectionAvailable = false,
    source = "single_image_rail",
    trigger = "click",
    requestId = "",
    confidence = 0,
    reasonCodes = [],
    busy = false,
    mode = "",
    image = null,
    capabilityAvailability = null,
    capabilityExecutorAvailable = false,
  } = {}
) {
  const job = resolveSingleImageCapabilityJob(jobOrId);
  if (!job) {
    throw new Error(`Unknown single-image rail job: ${String(jobOrId || "").trim() || "(empty)"}`);
  }

  const { activeId, selection } = normalizeSelectionTarget({ activeImageId, selectedImageIds });
  const availability = resolveSingleImageCapabilityAvailability(job, {
    activeImageId: activeId,
    selectedImageIds: selection,
    subjectSelectionAvailable,
    busy,
    mode,
    image,
    capabilityAvailability,
    capabilityExecutorAvailable,
    reasonCodes,
  });

  return {
    contract: SINGLE_IMAGE_RAIL_CONTRACT,
    schema: TOOL_INVOCATION_SCHEMA,
    requestId: normalizeText(requestId) || `tool-${Date.now()}`,
    issuedAt: new Date().toISOString(),
    source: normalizeText(source) || "single_image_rail",
    trigger: normalizeText(trigger) || "click",
    jobId: job.jobId,
    label: job.label,
    capability: job.capability,
    stickyKey: job.stickyKey,
    provenance: job.provenance || ACTION_PROVENANCE.EXTERNAL_MODEL,
    tool: {
      toolId: job.jobId,
      jobId: job.jobId,
      label: job.label,
      version: 1,
      executionKind: "model_capability",
      capability: job.capability,
      requiresSelection: job.requiresSelection,
      provenance: job.provenance || ACTION_PROVENANCE.EXTERNAL_MODEL,
    },
    target: {
      activeImageId: activeId || null,
      selectedImageIds: selection,
    },
    selection: {
      activeId: activeId || null,
      selectedImageIds: selection,
      subjectSelectionAvailable: Boolean(subjectSelectionAvailable),
    },
    execution: {
      kind: "model_capability",
      capability: job.capability,
      jobId: job.jobId,
      params: {},
      provenance: ACTION_PROVENANCE.EXTERNAL_MODEL,
    },
    inputContract: {
      requiresActiveImage: job.requiresSelection,
      minImages: job.requiresSelection ? 1 : 0,
      maxImages: 1,
      acceptedTarget: "active_image",
    },
    receipt: {
      manifestSchema: SINGLE_IMAGE_RAIL_CONTRACT,
      reproducible: true,
      include: ["capability", "selection", "execution"],
    },
    failureBehavior: {
      kind: "toast",
      message: `${job.label} could not be applied.`,
    },
    availability,
    rail: {
      contract: SINGLE_IMAGE_RAIL_CONTRACT,
      confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
      reasonCodes: availability?.reasonCodes || [],
      stickyKey: job.stickyKey,
      provenance: job.provenance || ACTION_PROVENANCE.EXTERNAL_MODEL,
    },
  };
}

export function buildSingleImageDirectAffordanceInvocation(
  affordanceOrId,
  {
    activeImageId = null,
    selectedImageIds = [],
    source = "single_image_direct_affordance",
    trigger = "click",
    requestId = "",
    params = {},
    reasonCodes = [],
    busy = false,
    mode = "",
    image = null,
    capabilityAvailability = null,
    capabilityExecutorAvailable = false,
    localExecutorAvailable = true,
  } = {}
) {
  const route = resolveSingleImageAffordanceRoute(
    {
      jobId: affordanceOrId,
      params,
      reasonCodes,
    },
    {
      mode,
      forceModel: params?.forceModel,
    }
  );
  if (!route || route.surface !== "direct") {
    throw new Error(`Unknown single-image direct affordance: ${String(affordanceOrId || "").trim() || "(empty)"}`);
  }

  const { activeId, selection } = normalizeSelectionTarget({ activeImageId, selectedImageIds });
  const availability = resolveSingleImageCapabilityAvailability(
    {
      ...route,
      params: cloneJson(params),
    },
    {
      activeImageId: activeId,
      selectedImageIds: selection,
      busy,
      mode,
      image,
      capabilityAvailability,
      capabilityExecutorAvailable,
      localExecutorAvailable,
      reasonCodes,
      forceModel: params?.forceModel,
    }
  );

  return {
    contract: SINGLE_IMAGE_RAIL_CONTRACT,
    schema: TOOL_INVOCATION_SCHEMA,
    requestId: normalizeText(requestId) || `tool-${Date.now()}`,
    issuedAt: new Date().toISOString(),
    source: normalizeText(source) || "single_image_direct_affordance",
    trigger: normalizeText(trigger) || "click",
    jobId: route.jobId,
    label: route.label,
    capability: route.capability,
    surface: route.surface,
    executionType: route.executionType,
    routeProfile: route.routeProfile,
    stickyKey: route.stickyKey,
    provenance: route.provenance,
    tool: buildSingleImageAffordanceToolDescriptor(route),
    target: {
      activeImageId: activeId || null,
      selectedImageIds: selection,
    },
    selection: {
      activeId: activeId || null,
      selectedImageIds: selection,
    },
    execution: buildSingleImageAffordanceExecutionDescriptor({
      ...route,
      params: cloneJson(params),
    }),
    inputContract: {
      requiresActiveImage: true,
      minImages: 1,
      maxImages: 1,
      acceptedTarget: "active_image",
    },
    receipt: {
      manifestSchema: SINGLE_IMAGE_RAIL_CONTRACT,
      reproducible: true,
      include: ["capability", "selection", "execution", "route_profile"],
    },
    failureBehavior: {
      kind: "toast",
      message: `${route.label} could not be applied.`,
    },
    availability,
    route: {
      executionType: route.executionType,
      profile: route.routeProfile,
      executionKind: route.executionKind,
      localOperation: route.localOperation || null,
      fallbackExecutionKind:
        route.executionType === SINGLE_IMAGE_EXECUTION_TYPES.LOCAL_FIRST ? "model_capability" : null,
      provenance: route.provenance,
    },
  };
}
