export const MAGIC_SELECT_LOCAL_RUNTIME_CONTRACT = "juggernaut.magic_select.local.v1";
export const MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT = "juggernaut.magic_select.local.prepared.v1";

const MAGIC_SELECT_DEFAULT_SETTINGS = Object.freeze({
  maskThreshold: 127,
  maxContourPoints: 256,
});

const MAGIC_SELECT_ACTIONS = Object.freeze({
  click: "magic_select_click",
  prepare: "magic_select_prepare",
  warmClick: "magic_select_warm_click",
  release: "magic_select_release",
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

function normalizeWarnings(warnings = []) {
  return Array.isArray(warnings) ? warnings.map((value) => String(value)) : [];
}

function normalizeTimestamp(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function normalizePreparedImage(
  preparedImage = null,
  fallback = {},
  { requireImagePath = false } = {}
) {
  const id = readFirstString(
    preparedImage?.id,
    preparedImage?.preparedImageId,
    fallback?.id,
    fallback?.preparedImageId
  );
  if (!id) throw new Error("Magic Select prepared image is missing id");
  const imageId = readFirstString(preparedImage?.imageId, fallback?.imageId);
  if (!imageId) throw new Error("Magic Select prepared image is missing imageId");
  const imagePath = readFirstString(preparedImage?.imagePath, fallback?.imagePath);
  if (requireImagePath && !imagePath) {
    throw new Error("Magic Select prepared image is missing imagePath");
  }
  const settings = normalizeSettings(preparedImage?.settings ?? fallback?.settings ?? {});
  return {
    id,
    imageId,
    imagePath: imagePath || null,
    runDir: readFirstString(preparedImage?.runDir, fallback?.runDir) || null,
    stableSourceRef: readFirstString(preparedImage?.stableSourceRef, fallback?.stableSourceRef) || null,
    source: readFirstString(preparedImage?.source, fallback?.source, "canvas_magic_select"),
    settings,
    preparedAt: normalizeTimestamp(preparedImage?.preparedAt, normalizeTimestamp(fallback?.preparedAt, Date.now())),
    lastUsedAt: normalizeTimestamp(preparedImage?.lastUsedAt, normalizeTimestamp(fallback?.lastUsedAt, null)),
    expiresAt: normalizeTimestamp(preparedImage?.expiresAt, normalizeTimestamp(fallback?.expiresAt, null)),
    useCount:
      preparedImage?.useCount != null || fallback?.useCount != null
        ? normalizeInteger(preparedImage?.useCount ?? fallback?.useCount, 0)
        : 0,
    reproducibility: cloneJson(preparedImage?.reproducibility ?? fallback?.reproducibility ?? null),
    warnings: normalizeWarnings(preparedImage?.warnings ?? fallback?.warnings),
  };
}

function normalizeRuntimeError(error, defaults = {}) {
  const message = readFirstString(error?.message, error?.error, error);
  const normalized = new Error(message || "Local Magic Select failed.");
  normalized.code = readFirstString(error?.code, defaults?.code, "local_magic_select_failed");
  normalized.nonDestructive = true;
  const contract = readFirstString(error?.contract, defaults?.contract);
  const action = readFirstString(error?.action, defaults?.action);
  const imageId = readFirstString(error?.imageId, defaults?.imageId);
  const preparedImageId = readFirstString(
    error?.preparedImageId,
    error?.preparedImage?.id,
    defaults?.preparedImageId
  );
  const warnings = normalizeWarnings(error?.warnings ?? defaults?.warnings);
  const details = cloneJson(error?.details ?? defaults?.details ?? null);
  if (contract) normalized.contract = contract;
  if (action) normalized.action = action;
  if (imageId) normalized.imageId = imageId;
  if (preparedImageId) normalized.preparedImageId = preparedImageId;
  if (warnings.length) normalized.warnings = warnings;
  if (details != null) normalized.details = details;
  return normalized;
}

async function invokeLocalMagicSelectCommand(command, payload) {
  const tauri = await import("@tauri-apps/api/tauri");
  return tauri.invoke(command, payload);
}

function normalizeDirectClickRequest(
  {
    imageId = "",
    imagePath = "",
    runDir = null,
    stableSourceRef = null,
    clickAnchor = null,
    source = "canvas_magic_select",
    settings = {},
  } = {}
) {
  const normalizedImageId = readFirstString(imageId);
  if (!normalizedImageId) throw new Error("runLocalMagicSelectClick requires imageId");
  const normalizedImagePath = readFirstString(imagePath);
  if (!normalizedImagePath) throw new Error("runLocalMagicSelectClick requires imagePath");
  return {
    imageId: normalizedImageId,
    imagePath: normalizedImagePath,
    runDir: readFirstString(runDir) || null,
    stableSourceRef: readFirstString(stableSourceRef) || null,
    clickAnchor: normalizePoint(clickAnchor, "clickAnchor"),
    source: readFirstString(source, "canvas_magic_select"),
    settings: normalizeSettings(settings),
  };
}

function normalizePreparedImageRequest(
  {
    imageId = "",
    imagePath = "",
    runDir = null,
    stableSourceRef = null,
    source = "canvas_magic_select",
    settings = {},
  } = {}
) {
  const normalizedImageId = readFirstString(imageId);
  if (!normalizedImageId) throw new Error("prepareLocalMagicSelectImage requires imageId");
  const normalizedImagePath = readFirstString(imagePath);
  if (!normalizedImagePath) throw new Error("prepareLocalMagicSelectImage requires imagePath");
  return {
    imageId: normalizedImageId,
    imagePath: normalizedImagePath,
    runDir: readFirstString(runDir) || null,
    stableSourceRef: readFirstString(stableSourceRef) || null,
    source: readFirstString(source, "canvas_magic_select"),
    settings: normalizeSettings(settings),
  };
}

function normalizeWarmClickRequest(
  {
    preparedImageId = "",
    preparedImage = null,
    imageId = "",
    clickAnchor = null,
    source = "",
  } = {}
) {
  const normalizedPreparedImageId = readFirstString(preparedImageId, preparedImage?.id);
  if (!normalizedPreparedImageId) {
    throw new Error("runWarmLocalMagicSelectClick requires preparedImageId or preparedImage.id");
  }
  const normalizedImageId = readFirstString(imageId, preparedImage?.imageId);
  if (!normalizedImageId) throw new Error("runWarmLocalMagicSelectClick requires imageId or preparedImage.imageId");
  const normalizedSource = readFirstString(source, preparedImage?.source, "canvas_magic_select");
  const normalizedPreparedImage = preparedImage
    ? normalizePreparedImage(
        preparedImage,
        {
          id: normalizedPreparedImageId,
          imageId: normalizedImageId,
          source: normalizedSource,
        },
        { requireImagePath: false }
      )
    : null;
  return {
    preparedImageId: normalizedPreparedImageId,
    imageId: normalizedImageId,
    clickAnchor: normalizePoint(clickAnchor, "clickAnchor"),
    source: normalizedSource,
    preparedImage: normalizedPreparedImage,
  };
}

function normalizeReleaseRequest(
  {
    preparedImageId = "",
    preparedImage = null,
    imageId = "",
    reason = "caller_release",
  } = {}
) {
  const normalizedPreparedImageId = readFirstString(preparedImageId, preparedImage?.id);
  if (!normalizedPreparedImageId) {
    throw new Error("releaseLocalMagicSelectImage requires preparedImageId or preparedImage.id");
  }
  const normalizedImageId = readFirstString(imageId, preparedImage?.imageId) || null;
  return {
    preparedImageId: normalizedPreparedImageId,
    imageId: normalizedImageId,
    reason: readFirstString(reason, "caller_release"),
  };
}

function maybeThrowRuntimeFailure(raw, defaults = {}) {
  if (raw?.ok === false || raw?.error) {
    throw normalizeRuntimeError(raw?.error ?? raw, {
      code: defaults?.code,
      contract: readFirstString(raw?.contract, defaults?.contract),
      action: readFirstString(raw?.action, defaults?.action),
      imageId: readFirstString(raw?.imageId, defaults?.imageId),
      preparedImageId: readFirstString(raw?.preparedImageId, raw?.preparedImage?.id, defaults?.preparedImageId),
      warnings: raw?.warnings ?? defaults?.warnings,
      details: raw?.details ?? defaults?.details,
    });
  }
}

function normalizeGroup(raw, fallbackImageId, fallbackAnchor) {
  const candidate = normalizeCandidate(raw?.candidate ?? raw?.group?.candidates?.[0]);
  const candidates =
    Array.isArray(raw?.group?.candidates) && raw.group.candidates.length
      ? raw.group.candidates.map((entry) => normalizeCandidate(entry))
      : [candidate];
  const activeCandidateIndexRaw = Number(raw?.group?.activeCandidateIndex);
  const activeCandidateIndex =
    Number.isFinite(activeCandidateIndexRaw) && activeCandidateIndexRaw >= 0 && activeCandidateIndexRaw < candidates.length
      ? Math.round(activeCandidateIndexRaw)
      : 0;
  return {
    candidate: candidates[activeCandidateIndex] ?? candidate,
    group: {
      imageId: readFirstString(raw?.group?.imageId, fallbackImageId) || fallbackImageId,
      anchor: normalizePoint(raw?.group?.anchor ?? fallbackAnchor, "group.anchor"),
      candidates,
      activeCandidateIndex,
      chosenCandidateId:
        readFirstString(raw?.group?.chosenCandidateId, candidates[activeCandidateIndex]?.id, candidate.id) || candidate.id,
      updatedAt: Number.isFinite(Number(raw?.group?.updatedAt)) ? Number(raw.group.updatedAt) : Date.now(),
      reproducibility: cloneJson(raw?.group?.reproducibility ?? raw?.receipt?.reproducibility ?? null),
      warnings: normalizeWarnings(raw?.warnings),
    },
  };
}

function normalizeClickResult(
  raw,
  {
    contract = MAGIC_SELECT_LOCAL_RUNTIME_CONTRACT,
    action = MAGIC_SELECT_ACTIONS.click,
    code = "local_magic_select_failed",
    imageId,
    clickAnchor,
    preparedImage = null,
  } = {}
) {
  maybeThrowRuntimeFailure(raw, {
    code,
    contract,
    action,
    imageId,
    preparedImageId: preparedImage?.id,
  });
  const warnings = normalizeWarnings(raw?.warnings);
  const normalizedPreparedImage =
    raw?.preparedImage || raw?.preparedImageId || preparedImage
      ? normalizePreparedImage(
          raw?.preparedImage,
          {
            id: readFirstString(raw?.preparedImageId, preparedImage?.id),
            imageId,
            imagePath: preparedImage?.imagePath,
            runDir: preparedImage?.runDir,
            stableSourceRef: preparedImage?.stableSourceRef,
            source: preparedImage?.source,
            settings: preparedImage?.settings,
            preparedAt: preparedImage?.preparedAt,
            lastUsedAt: preparedImage?.lastUsedAt,
            expiresAt: preparedImage?.expiresAt,
            useCount: preparedImage?.useCount,
            reproducibility: raw?.preparedImage?.reproducibility ?? preparedImage?.reproducibility ?? raw?.receipt?.reproducibility,
            warnings: raw?.preparedImage?.warnings ?? preparedImage?.warnings ?? warnings,
          },
          { requireImagePath: false }
        )
      : null;
  const normalized = normalizeGroup(raw, imageId, clickAnchor);
  const result = {
    ok: raw?.ok !== false,
    contract: readFirstString(raw?.contract, contract),
    action: readFirstString(raw?.action, action),
    imageId,
    candidate: normalized.candidate,
    group: normalized.group,
    receipt: cloneJson(raw?.receipt ?? null),
    warnings,
  };
  if (normalizedPreparedImage) {
    result.preparedImageId = normalizedPreparedImage.id;
    result.preparedImage = normalizedPreparedImage;
  }
  return result;
}

function normalizePreparedImageResult(raw, request) {
  maybeThrowRuntimeFailure(raw, {
    code: "local_magic_select_prepare_failed",
    contract: MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT,
    action: MAGIC_SELECT_ACTIONS.prepare,
    imageId: request.imageId,
  });
  const warnings = normalizeWarnings(raw?.warnings);
  const preparedImage = normalizePreparedImage(
    raw?.preparedImage,
    {
      id: readFirstString(raw?.preparedImageId, raw?.id),
      imageId: request.imageId,
      imagePath: request.imagePath,
      runDir: request.runDir,
      stableSourceRef: request.stableSourceRef,
      source: request.source,
      settings: request.settings,
      preparedAt: raw?.preparedAt,
      lastUsedAt: raw?.lastUsedAt,
      expiresAt: raw?.expiresAt,
      useCount: raw?.useCount,
      reproducibility: raw?.reproducibility ?? raw?.receipt?.reproducibility ?? null,
      warnings,
    },
    { requireImagePath: true }
  );
  return {
    ok: raw?.ok !== false,
    contract: readFirstString(raw?.contract, MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT),
    action: readFirstString(raw?.action, MAGIC_SELECT_ACTIONS.prepare),
    imageId: request.imageId,
    preparedImageId: preparedImage.id,
    preparedImage,
    receipt: cloneJson(raw?.receipt ?? null),
    warnings,
  };
}

function normalizeReleaseResult(raw, request) {
  maybeThrowRuntimeFailure(raw, {
    code: "local_magic_select_release_failed",
    contract: MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT,
    action: MAGIC_SELECT_ACTIONS.release,
    imageId: request.imageId,
    preparedImageId: request.preparedImageId,
  });
  const preparedImageId = readFirstString(raw?.preparedImageId, request.preparedImageId);
  if (!preparedImageId) throw new Error("Magic Select release result is missing preparedImageId");
  return {
    ok: raw?.ok !== false,
    contract: readFirstString(raw?.contract, MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT),
    action: readFirstString(raw?.action, MAGIC_SELECT_ACTIONS.release),
    imageId: readFirstString(raw?.imageId, request.imageId) || null,
    preparedImageId,
    released: raw?.released !== false,
    evicted: raw?.evicted === true || raw?.released === true,
    warnings: normalizeWarnings(raw?.warnings),
  };
}

export async function prepareLocalMagicSelectImage(
  {
    imageId = "",
    imagePath = "",
    runDir = null,
    stableSourceRef = null,
    source = "canvas_magic_select",
    settings = {},
    invokeFn = invokeLocalMagicSelectCommand,
  } = {}
) {
  const payload = normalizePreparedImageRequest({
    imageId,
    imagePath,
    runDir,
    stableSourceRef,
    source,
    settings,
  });

  let raw = null;
  try {
    raw = await invokeFn("prepare_local_magic_select_image", { request: payload });
  } catch (error) {
    throw normalizeRuntimeError(error, {
      code: "local_magic_select_prepare_failed",
      contract: MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT,
      action: MAGIC_SELECT_ACTIONS.prepare,
      imageId: payload.imageId,
    });
  }

  return normalizePreparedImageResult(raw, payload);
}

export async function runWarmLocalMagicSelectClick(
  {
    preparedImageId = "",
    preparedImage = null,
    imageId = "",
    clickAnchor = null,
    source = "",
    invokeFn = invokeLocalMagicSelectCommand,
  } = {}
) {
  const payload = normalizeWarmClickRequest({
    preparedImageId,
    preparedImage,
    imageId,
    clickAnchor,
    source,
  });

  let raw = null;
  try {
    raw = await invokeFn("run_local_magic_select_warm_click", {
      request: {
        preparedImageId: payload.preparedImageId,
        imageId: payload.imageId,
        clickAnchor: payload.clickAnchor,
        source: payload.source,
      },
    });
  } catch (error) {
    throw normalizeRuntimeError(error, {
      code: "local_magic_select_warm_click_failed",
      contract: MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT,
      action: MAGIC_SELECT_ACTIONS.warmClick,
      imageId: payload.imageId,
      preparedImageId: payload.preparedImageId,
    });
  }

  return normalizeClickResult(raw, {
    contract: MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT,
    action: MAGIC_SELECT_ACTIONS.warmClick,
    code: "local_magic_select_warm_click_failed",
    imageId: payload.imageId,
    clickAnchor: payload.clickAnchor,
    preparedImage: payload.preparedImage ?? {
      id: payload.preparedImageId,
      imageId: payload.imageId,
      source: payload.source,
    },
  });
}

export async function releaseLocalMagicSelectImage(
  {
    preparedImageId = "",
    preparedImage = null,
    imageId = "",
    reason = "caller_release",
    invokeFn = invokeLocalMagicSelectCommand,
  } = {}
) {
  const payload = normalizeReleaseRequest({
    preparedImageId,
    preparedImage,
    imageId,
    reason,
  });

  let raw = null;
  try {
    raw = await invokeFn("release_local_magic_select_image", { request: payload });
  } catch (error) {
    throw normalizeRuntimeError(error, {
      code: "local_magic_select_release_failed",
      contract: MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT,
      action: MAGIC_SELECT_ACTIONS.release,
      imageId: payload.imageId,
      preparedImageId: payload.preparedImageId,
    });
  }

  return normalizeReleaseResult(raw, payload);
}

export const evictLocalMagicSelectImage = releaseLocalMagicSelectImage;

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
  const payload = normalizeDirectClickRequest({
    imageId,
    imagePath,
    runDir,
    stableSourceRef,
    clickAnchor,
    source,
    settings,
  });

  let raw = null;
  try {
    raw = await invokeFn("run_local_magic_select_click", { request: payload });
  } catch (error) {
    throw normalizeRuntimeError(error, {
      code: "local_magic_select_failed",
      contract: MAGIC_SELECT_LOCAL_RUNTIME_CONTRACT,
      action: MAGIC_SELECT_ACTIONS.click,
      imageId: payload.imageId,
    });
  }

  return normalizeClickResult(raw, {
    contract: MAGIC_SELECT_LOCAL_RUNTIME_CONTRACT,
    action: MAGIC_SELECT_ACTIONS.click,
    code: "local_magic_select_failed",
    imageId: payload.imageId,
    clickAnchor: payload.clickAnchor,
  });
}
