export const MAGIC_SELECT_LOCAL_RUNTIME_CONTRACT = "juggernaut.magic_select.local.v1";

const MAGIC_SELECT_DEFAULT_SETTINGS = Object.freeze({
  maskThreshold: 127,
  maxContourPoints: 256,
});

function readFirstString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function normalizeInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.max(0, Math.round(fallback));
  return Math.max(0, Math.round(parsed));
}

function normalizePoint(point = null, label = "point") {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`${label} requires finite x and y values`);
  }
  return {
    x: normalizeInteger(x),
    y: normalizeInteger(y),
  };
}

function normalizeSettings(settings = {}) {
  const maskThreshold = Math.max(
    1,
    Math.min(255, normalizeInteger(settings?.maskThreshold, MAGIC_SELECT_DEFAULT_SETTINGS.maskThreshold))
  );
  const maxContourPoints = Math.max(
    16,
    Math.min(4096, normalizeInteger(settings?.maxContourPoints, MAGIC_SELECT_DEFAULT_SETTINGS.maxContourPoints))
  );
  return {
    maskThreshold,
    maxContourPoints,
  };
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function normalizeMaskRef(maskRef = null) {
  const path = readFirstString(maskRef?.path);
  const sha256 = readFirstString(maskRef?.sha256);
  if (!path || !sha256) {
    throw new Error("Magic Select result is missing maskRef.path or maskRef.sha256");
  }
  return {
    path,
    sha256,
    width: Math.max(1, normalizeInteger(maskRef?.width, 1)),
    height: Math.max(1, normalizeInteger(maskRef?.height, 1)),
    format: readFirstString(maskRef?.format, "png"),
  };
}

function normalizeBounds(bounds = null) {
  const x = Number(bounds?.x);
  const y = Number(bounds?.y);
  const w = Number(bounds?.w);
  const h = Number(bounds?.h);
  if (![x, y, w, h].every(Number.isFinite)) {
    throw new Error("Magic Select result is missing candidate bounds");
  }
  return {
    x: normalizeInteger(x),
    y: normalizeInteger(y),
    w: Math.max(1, normalizeInteger(w, 1)),
    h: Math.max(1, normalizeInteger(h, 1)),
  };
}

function normalizeContourPoints(candidate = null) {
  const raw = Array.isArray(candidate?.contourPoints)
    ? candidate.contourPoints
    : Array.isArray(candidate?.polygon)
      ? candidate.polygon
      : [];
  const contourPoints = raw.map((point, index) => normalizePoint(point, `candidate.contourPoints[${index}]`));
  if (contourPoints.length < 3) {
    throw new Error("Magic Select result must include at least three contour points");
  }
  return contourPoints;
}

function normalizeCandidate(candidate = null) {
  const id = readFirstString(candidate?.id);
  if (!id) throw new Error("Magic Select result is missing candidate.id");
  const contourPoints = normalizeContourPoints(candidate);
  return {
    id,
    label: readFirstString(candidate?.label, "Magic Select"),
    bounds: normalizeBounds(candidate?.bounds),
    contourPoints,
    polygon: contourPoints.map((point) => ({ ...point })),
    maskRef: normalizeMaskRef(candidate?.maskRef),
    confidence: Number.isFinite(Number(candidate?.confidence))
      ? Math.max(0, Math.min(1, Number(candidate.confidence)))
      : 1,
    source: readFirstString(candidate?.source, "local_model:mobile_sam_vit_t"),
  };
}

function normalizeRuntimeError(error) {
  const message = readFirstString(error?.message, error);
  const normalized = new Error(message || "Local Magic Select failed.");
  normalized.code = readFirstString(error?.code, "local_magic_select_failed");
  normalized.nonDestructive = true;
  return normalized;
}

async function invokeLocalMagicSelectCommand(command, payload) {
  const tauri = await import("@tauri-apps/api/tauri");
  return tauri.invoke(command, payload);
}

export async function runLocalMagicSelectClick(
  {
    imageId = "",
    imagePath = "",
    runDir = null,
    stableSourceRef = null,
    clickAnchor = null,
    source = "canvas_magic_select",
    settings = {},
    invokeFn = invokeLocalMagicSelectCommand,
  } = {}
) {
  const normalizedImageId = readFirstString(imageId);
  if (!normalizedImageId) throw new Error("runLocalMagicSelectClick requires imageId");
  const normalizedImagePath = readFirstString(imagePath);
  if (!normalizedImagePath) throw new Error("runLocalMagicSelectClick requires imagePath");
  const normalizedSource = readFirstString(source, "canvas_magic_select");
  const normalizedAnchor = normalizePoint(clickAnchor, "clickAnchor");
  const normalizedSettings = normalizeSettings(settings);
  const payload = {
    imageId: normalizedImageId,
    imagePath: normalizedImagePath,
    runDir: readFirstString(runDir) || null,
    stableSourceRef: readFirstString(stableSourceRef) || null,
    clickAnchor: normalizedAnchor,
    source: normalizedSource,
    settings: normalizedSettings,
  };

  let raw = null;
  try {
    raw = await invokeFn("run_local_magic_select_click", { request: payload });
  } catch (error) {
    throw normalizeRuntimeError(error);
  }

  const candidate = normalizeCandidate(raw?.candidate ?? raw?.group?.candidates?.[0]);
  const warnings = Array.isArray(raw?.warnings) ? raw.warnings.map((value) => String(value)) : [];
  const group = {
    imageId: normalizedImageId,
    anchor: normalizePoint(raw?.group?.anchor ?? normalizedAnchor, "group.anchor"),
    candidates: Array.isArray(raw?.group?.candidates) && raw.group.candidates.length
      ? raw.group.candidates.map((entry) => normalizeCandidate(entry))
      : [candidate],
    activeCandidateIndex: 0,
    chosenCandidateId: readFirstString(raw?.group?.chosenCandidateId, candidate.id) || candidate.id,
    updatedAt: Number.isFinite(Number(raw?.group?.updatedAt)) ? Number(raw.group.updatedAt) : Date.now(),
    reproducibility: cloneJson(raw?.group?.reproducibility ?? raw?.receipt?.reproducibility ?? null),
    warnings,
  };

  return {
    ok: raw?.ok !== false,
    contract: readFirstString(raw?.contract, MAGIC_SELECT_LOCAL_RUNTIME_CONTRACT),
    action: "magic_select_click",
    imageId: normalizedImageId,
    candidate,
    group,
    receipt: cloneJson(raw?.receipt ?? null),
    warnings,
  };
}
