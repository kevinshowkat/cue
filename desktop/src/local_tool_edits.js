const DEFAULT_INTENSITY = 1;

const RAW_LOCAL_TOOL_OPERATION_SPECS = Object.freeze([
  {
    id: "grayscale",
    label: "Grayscale",
    aliases: ["grayscale", "mono", "monochrome", "black white", "black and white"],
  },
  {
    id: "invert",
    label: "Invert",
    aliases: ["invert", "negative"],
  },
  {
    id: "sepia",
    label: "Sepia",
    aliases: ["sepia", "warm", "vintage", "retro"],
  },
  {
    id: "brighten",
    label: "Brighten",
    aliases: ["brighten", "lighten", "exposure", "lift"],
  },
  {
    id: "contrast",
    label: "Contrast",
    aliases: ["contrast", "clarity", "pop"],
  },
]);

const LOCAL_TOOL_OPERATION_SPECS = Object.freeze(
  Object.fromEntries(RAW_LOCAL_TOOL_OPERATION_SPECS.map((spec) => [spec.id, spec]))
);

const LOCAL_TOOL_ALIAS_LOOKUP = new Map();
for (const spec of RAW_LOCAL_TOOL_OPERATION_SPECS) {
  for (const alias of [spec.id, ...(Array.isArray(spec.aliases) ? spec.aliases : [])]) {
    const key = normalizeKey(alias);
    if (!key) continue;
    LOCAL_TOOL_ALIAS_LOOKUP.set(key, spec.id);
  }
}

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function clamp01(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number <= 0) return 0;
  if (number >= 1) return 1;
  return number;
}

function clamp255(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  if (number <= 0) return 0;
  if (number >= 255) return 255;
  return number;
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_:/.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readFirstString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function looksLikeToolRecord(value) {
  const record = asRecord(value);
  if (!record) return false;
  return ["id", "name", "source", "kind", "operation", "params"].some((key) =>
    Object.prototype.hasOwnProperty.call(record, key)
  );
}

function resolveRequestTool(request = {}) {
  const raw = asRecord(request) || {};
  const nestedTool = asRecord(raw.tool);
  const tool = nestedTool || (looksLikeToolRecord(raw) ? raw : null);
  return { raw, tool };
}

function resolveOperation(value) {
  const normalized = normalizeKey(value);
  if (!normalized) return "";
  const direct = LOCAL_TOOL_ALIAS_LOOKUP.get(normalized);
  if (direct) return direct;
  for (const spec of RAW_LOCAL_TOOL_OPERATION_SPECS) {
    for (const alias of spec.aliases) {
      if (normalized.includes(normalizeKey(alias))) return spec.id;
    }
  }
  return "";
}

function collectParams(raw, tool) {
  const merged = {};
  for (const candidate of [tool?.params, raw?.params]) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    Object.assign(merged, candidate);
  }
  for (const key of ["intensity", "amount", "strength", "level", "value"]) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && merged[key] === undefined) {
      merged[key] = raw[key];
    }
  }
  return merged;
}

function normalizeIntensity(params = {}) {
  const raw = [params.intensity, params.amount, params.strength, params.level, params.value].find((value) =>
    Number.isFinite(Number(value))
  );
  return clamp01(raw, DEFAULT_INTENSITY);
}

function resolvePlan(planOrRequest = {}, params = null) {
  if (typeof planOrRequest === "string") {
    return buildLocalToolEditPlan({
      tool: {
        operation: planOrRequest,
        params: asRecord(params) || {},
      },
    });
  }
  const record = asRecord(planOrRequest);
  if (
    record &&
    typeof record.operation === "string" &&
    record.params &&
    typeof record.params === "object" &&
    Object.prototype.hasOwnProperty.call(record, "toolId")
  ) {
    return record;
  }
  return buildLocalToolEditPlan(record || {});
}

function defaultCreateCanvas() {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    throw new Error("Canvas document is unavailable.");
  }
  return document.createElement("canvas");
}

export function listSupportedLocalToolOperations() {
  return RAW_LOCAL_TOOL_OPERATION_SPECS.map((spec) => ({
    id: spec.id,
    label: spec.label,
  }));
}

export function normalizeLocalToolApplyRequest(request = {}) {
  const { raw, tool } = resolveRequestTool(request);
  if (!tool) return null;
  const operation = resolveOperation(readFirstString(tool.operation, raw.operation, tool.name, raw.name));
  if (!operation) return null;
  const spec = LOCAL_TOOL_OPERATION_SPECS[operation];
  const params = collectParams(raw, tool);
  return {
    id: readFirstString(tool.id, raw.toolId, raw.tool_id) || null,
    name: readFirstString(tool.name, raw.toolName, raw.tool_name, spec.label) || spec.label,
    source: readFirstString(tool.source, raw.source, "local") || "local",
    kind: readFirstString(tool.kind, raw.kind, "raster") || "raster",
    operation,
    params: {
      intensity: normalizeIntensity(params),
    },
  };
}

export function buildLocalToolEditPlan(request = {}) {
  const tool = normalizeLocalToolApplyRequest(request);
  if (!tool) return null;
  const spec = LOCAL_TOOL_OPERATION_SPECS[tool.operation];
  return {
    tool,
    toolId: tool.id || null,
    toolName: tool.name || spec.label,
    operation: tool.operation,
    label: spec.label,
    source: tool.source || "local",
    kind: tool.kind || "raster",
    params: {
      intensity: clamp01(tool.params?.intensity, DEFAULT_INTENSITY),
    },
  };
}

export function buildLocalToolReceiptStep(plan, { outputPath = null, receiptPath = null } = {}) {
  const resolvedPlan = resolvePlan(plan);
  if (!resolvedPlan) return null;
  return {
    kind: "local_raster_edit",
    source: "tool_runtime",
    toolId: resolvedPlan.toolId || null,
    toolName: resolvedPlan.toolName || resolvedPlan.label,
    operation: resolvedPlan.operation,
    params: {
      ...resolvedPlan.params,
    },
    outputPath: outputPath ? String(outputPath) : null,
    receiptPath: receiptPath ? String(receiptPath) : null,
  };
}

export function applyDeterministicRasterEdit(imageDataLike, planOrOperation, params = null) {
  const plan = resolvePlan(planOrOperation, params);
  if (!plan) throw new Error("Unsupported local tool operation.");
  const sourceData = imageDataLike?.data;
  if (!sourceData || !ArrayBuffer.isView(sourceData)) {
    throw new Error("Image data is unavailable for local edit.");
  }

  const nextData = new Uint8ClampedArray(sourceData);
  const intensity = clamp01(plan.params?.intensity, DEFAULT_INTENSITY);

  for (let index = 0; index < nextData.length; index += 4) {
    let red = nextData[index];
    let green = nextData[index + 1];
    let blue = nextData[index + 2];
    const alpha = nextData[index + 3];
    if (alpha <= 0) continue;

    if (plan.operation === "grayscale") {
      const gray = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      red = lerp(red, gray, intensity);
      green = lerp(green, gray, intensity);
      blue = lerp(blue, gray, intensity);
    } else if (plan.operation === "invert") {
      red = lerp(red, 255 - red, intensity);
      green = lerp(green, 255 - green, intensity);
      blue = lerp(blue, 255 - blue, intensity);
    } else if (plan.operation === "sepia") {
      const sepiaRed = 0.393 * red + 0.769 * green + 0.189 * blue;
      const sepiaGreen = 0.349 * red + 0.686 * green + 0.168 * blue;
      const sepiaBlue = 0.272 * red + 0.534 * green + 0.131 * blue;
      red = lerp(red, sepiaRed, intensity);
      green = lerp(green, sepiaGreen, intensity);
      blue = lerp(blue, sepiaBlue, intensity);
    } else if (plan.operation === "brighten") {
      const boost = 0.18 + 0.32 * intensity;
      red += (255 - red) * boost;
      green += (255 - green) * boost;
      blue += (255 - blue) * boost;
    } else if (plan.operation === "contrast") {
      const factor = 1 + 0.6 * intensity;
      red = 128 + (red - 128) * factor;
      green = 128 + (green - 128) * factor;
      blue = 128 + (blue - 128) * factor;
    }

    nextData[index] = clamp255(red);
    nextData[index + 1] = clamp255(green);
    nextData[index + 2] = clamp255(blue);
  }

  return {
    width: Number(imageDataLike?.width) || 0,
    height: Number(imageDataLike?.height) || 0,
    data: nextData,
  };
}

export function renderLocalToolEditCanvas(image, planOrRequest = {}, { createCanvas = defaultCreateCanvas } = {}) {
  const plan = resolvePlan(planOrRequest);
  if (!plan) throw new Error("Unsupported local tool operation.");
  const width = Math.max(1, Number(image?.naturalWidth || image?.width) || 0);
  const height = Math.max(1, Number(image?.naturalHeight || image?.height) || 0);
  if (!width || !height) {
    throw new Error("Selected image is not ready for local tool application.");
  }

  const canvas = createCanvas();
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (
    !context ||
    typeof context.drawImage !== "function" ||
    typeof context.getImageData !== "function" ||
    typeof context.putImageData !== "function"
  ) {
    throw new Error("2D canvas context is unavailable.");
  }

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const next = applyDeterministicRasterEdit(imageData, plan);
  imageData.data.set(next.data);
  context.putImageData(imageData, 0, 0);
  return canvas;
}
