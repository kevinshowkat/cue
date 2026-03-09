export const TOOL_MANIFEST_SCHEMA = "juggernaut.tool_manifest.v1";
export const TOOL_INVOCATION_SCHEMA = "juggernaut.tool_invocation.v1";
export const TOOL_INVOCATION_EVENT = "juggernaut:tool-invoked";
export const TOOL_RUNTIME_BRIDGE_KEY = "__JUGGERNAUT_TOOL_RUNTIME__";

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
  const activeId = normalizeText(activeImageId);
  const selection = [];
  for (const id of Array.isArray(selectedImageIds) ? selectedImageIds : []) {
    const key = normalizeText(id);
    if (!key || selection.includes(key)) continue;
    selection.push(key);
  }
  if (activeId && !selection.includes(activeId)) selection.push(activeId);
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
    },
    target: {
      activeImageId: activeId || null,
      selectedImageIds: selection,
    },
    execution: cloneJson(normalizedManifest.execution),
    inputContract: cloneJson(normalizedManifest.inputContract),
    receipt: {
      manifestSchema: normalizedManifest.schema,
      reproducible: Boolean(normalizedManifest.receipt?.reproducible),
      include: cloneJson(normalizedManifest.receipt?.include || []),
    },
    failureBehavior: cloneJson(normalizedManifest.failureBehavior),
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

