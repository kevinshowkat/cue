export const MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT = "juggernaut.magic_select.local.prepared.v1";
export const MAGIC_SELECT_LEGACY_LOCAL_RUNTIME_CONTRACT = "juggernaut.magic_select.local.v1";
export const MAGIC_SELECT_LOCAL_RUNTIME_CONTRACT = MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT;
export const MAGIC_SELECT_LOCAL_PACK_ID = "cue.magic-select";
export const MAGIC_SELECT_LOCAL_PRIMARY_MODEL_ID = "mobile_sam_vit_t";
export const MAGIC_SELECT_RUNTIME_RESOLUTION_ORDER = Object.freeze([
  "installed_pack_manifest",
  "cue_home_env",
  "cue_env",
  "legacy_env",
]);
export const MAGIC_SELECT_RUN_LAYOUT = Object.freeze({
  sessionDocument: "session.json",
  legacySessionDocument: "juggernaut-session.json",
  timelineDocument: "session-timeline.json",
  eventsLog: "events.jsonl",
  artifactsDir: "artifacts",
  receiptsDir: "receipts",
});

import {
  DESKTOP_MODEL_PACK_ACTIONS,
  DESKTOP_MODEL_PACK_INSTALL_CONTRACT,
  buildDesktopModelPackInstallRequest,
  installDesktopModelPack,
} from "./canvas_protocol.js";

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

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

function normalizeStringList(values = null, fallback = null) {
  const next = [];
  for (const value of Array.isArray(values) ? values : Array.isArray(fallback) ? fallback : []) {
    const text = readFirstString(value);
    if (!text || next.includes(text)) continue;
    next.push(text);
  }
  return next;
}

function joinRunPath(basePath = "", leaf = "") {
  const base = readFirstString(basePath);
  const name = readFirstString(leaf);
  if (!base || !name) return "";
  if (base.endsWith("/") || base.endsWith("\\")) return `${base}${name}`;
  return `${base}${base.includes("\\") ? "\\" : "/"}${name}`;
}

export function buildMagicSelectRunPaths(runDir = "") {
  const normalizedRunDir = readFirstString(runDir);
  if (!normalizedRunDir) return null;
  return {
    runDir: normalizedRunDir,
    sessionPath: joinRunPath(normalizedRunDir, MAGIC_SELECT_RUN_LAYOUT.sessionDocument),
    legacySessionPath: joinRunPath(normalizedRunDir, MAGIC_SELECT_RUN_LAYOUT.legacySessionDocument),
    timelinePath: joinRunPath(normalizedRunDir, MAGIC_SELECT_RUN_LAYOUT.timelineDocument),
    eventsPath: joinRunPath(normalizedRunDir, MAGIC_SELECT_RUN_LAYOUT.eventsLog),
    artifactsDir: joinRunPath(normalizedRunDir, MAGIC_SELECT_RUN_LAYOUT.artifactsDir),
    receiptsDir: joinRunPath(normalizedRunDir, MAGIC_SELECT_RUN_LAYOUT.receiptsDir),
  };
}

export function normalizeMagicSelectRuntimeResolution(resolution = null, fallback = {}) {
  const record = asRecord(resolution);
  const pack = asRecord(record?.pack);
  const model = asRecord(record?.model);
  const helper = asRecord(record?.helper);
  const fallbackRecord = asRecord(fallback) || {};
  const resolutionOrder = normalizeStringList(record?.resolutionOrder, MAGIC_SELECT_RUNTIME_RESOLUTION_ORDER);
  const runtime = readFirstString(
    record?.runtime,
    record?.runtimeKind,
    fallbackRecord?.runtime,
    fallbackRecord?.runtimeKind,
    fallbackRecord?.runtime_kind
  );
  const runtimeId = readFirstString(
    record?.runtimeId,
    record?.runtime_id,
    fallbackRecord?.runtimeId,
    fallbackRecord?.runtime_id
  );
  const imageHash = readFirstString(
    record?.imageHash,
    record?.image_hash,
    fallbackRecord?.imageHash,
    fallbackRecord?.image_hash
  );
  const modelId = readFirstString(
    record?.modelId,
    record?.model_id,
    model?.id,
    fallbackRecord?.modelId,
    fallbackRecord?.model_id
  );
  const modelRevision = readFirstString(
    record?.modelRevision,
    record?.model_revision,
    model?.revision,
    fallbackRecord?.modelRevision,
    fallbackRecord?.model_revision
  );
  const modelPath = readFirstString(
    record?.modelPath,
    record?.model_path,
    model?.path,
    fallbackRecord?.modelPath,
    fallbackRecord?.model_path
  );
  const helperPath = readFirstString(
    record?.helperPath,
    record?.helper_path,
    helper?.path,
    fallbackRecord?.helperPath,
    fallbackRecord?.helper_path
  );
  const packId = readFirstString(
    record?.packId,
    record?.pack_id,
    record?.modelPackId,
    record?.model_pack_id,
    pack?.id,
    fallbackRecord?.packId,
    fallbackRecord?.pack_id,
    fallbackRecord?.modelPackId,
    fallbackRecord?.model_pack_id
  );
  const packVersion = readFirstString(
    record?.packVersion,
    record?.pack_version,
    record?.modelPackVersion,
    record?.model_pack_version,
    pack?.version,
    fallbackRecord?.packVersion,
    fallbackRecord?.pack_version,
    fallbackRecord?.modelPackVersion,
    fallbackRecord?.model_pack_version
  );
  const manifestPath = readFirstString(
    record?.manifestPath,
    record?.manifest_path,
    pack?.manifestPath,
    pack?.manifest_path,
    fallbackRecord?.manifestPath,
    fallbackRecord?.manifest_path
  );
  const modelAssetSha256 = readFirstString(
    record?.modelAssetSha256,
    record?.model_asset_sha256,
    model?.sha256,
    fallbackRecord?.modelAssetSha256,
    fallbackRecord?.model_asset_sha256
  );
  const modelInstallSource = readFirstString(
    record?.modelInstallSource,
    record?.model_install_source,
    record?.installSource,
    record?.install_source,
    fallbackRecord?.modelInstallSource,
    fallbackRecord?.model_install_source,
    fallbackRecord?.installSource,
    fallbackRecord?.install_source
  );
  const entitlementMode = readFirstString(
    record?.entitlementMode,
    record?.entitlement_mode,
    fallbackRecord?.entitlementMode,
    fallbackRecord?.entitlement_mode
  );
  const resolutionSource = readFirstString(
    record?.resolutionSource,
    record?.resolution_source,
    record?.resolver,
    fallbackRecord?.resolutionSource,
    fallbackRecord?.resolution_source
  );

  if (
    !runtime &&
    !runtimeId &&
    !imageHash &&
    !modelId &&
    !modelRevision &&
    !modelPath &&
    !helperPath &&
    !packId &&
    !packVersion &&
    !manifestPath &&
    !modelAssetSha256 &&
    !modelInstallSource &&
    !entitlementMode &&
    !resolutionSource
  ) {
    return null;
  }

  const normalized = {
    resolutionOrder,
  };
  if (resolutionSource) normalized.resolutionSource = resolutionSource;
  if (runtime) normalized.runtime = runtime;
  if (runtimeId) normalized.runtimeId = runtimeId;
  if (imageHash) normalized.imageHash = imageHash;
  if (modelId) normalized.modelId = modelId;
  if (modelRevision) normalized.modelRevision = modelRevision;
  if (modelPath) normalized.modelPath = modelPath;
  if (helperPath) normalized.helperPath = helperPath;
  if (packId) normalized.packId = packId;
  if (packVersion) normalized.packVersion = packVersion;
  if (manifestPath) normalized.manifestPath = manifestPath;
  if (modelAssetSha256) normalized.modelAssetSha256 = modelAssetSha256;
  if (modelInstallSource) normalized.modelInstallSource = modelInstallSource;
  if (entitlementMode) normalized.entitlementMode = entitlementMode;
  return normalized;
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

function mergeWarnings(...warningSets) {
  return [...new Set(warningSets.flatMap((warnings) => normalizeWarnings(warnings)))];
}

function normalizeTimestamp(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeInstalledPackMetadata(hostInstall = null, fallback = {}) {
  const pack = hostInstall?.pack && typeof hostInstall.pack === "object" ? hostInstall.pack : null;
  const resolution = hostInstall?.resolution && typeof hostInstall.resolution === "object" ? hostInstall.resolution : null;
  const resolutionSource =
    readFirstString(
      resolution?.resolutionSource,
      fallback?.resolutionSource,
      fallback?.runtimeResolution?.resolutionSource
    ) || null;
  const resolutionOrder = normalizeStringList(
    resolution?.resolutionOrder,
    fallback?.resolutionOrder ?? fallback?.runtimeResolution?.resolutionOrder
  );
  return {
    runtime: readFirstString(resolution?.runtime, fallback?.runtime) || null,
    runtimeId: readFirstString(resolution?.runtimeId, fallback?.runtimeId) || null,
    modelId: readFirstString(resolution?.modelId, fallback?.modelId) || null,
    modelRevision: readFirstString(resolution?.modelRevision, fallback?.modelRevision) || null,
    modelPackId: readFirstString(pack?.packId, resolution?.packId, fallback?.modelPackId, fallback?.packId) || null,
    modelPackVersion:
      readFirstString(pack?.packVersion, resolution?.packVersion, fallback?.modelPackVersion, fallback?.packVersion) || null,
    modelAssetSha256: readFirstString(resolution?.modelAssetSha256, fallback?.modelAssetSha256) || null,
    modelInstallSource: readFirstString(resolution?.modelInstallSource, fallback?.modelInstallSource) || null,
    entitlementMode: readFirstString(resolution?.entitlementMode, fallback?.entitlementMode) || null,
    manifestPath: readFirstString(pack?.manifestPath, resolution?.manifestPath, fallback?.manifestPath) || null,
    modelPath: readFirstString(resolution?.modelPath, fallback?.modelPath) || null,
    helperPath: readFirstString(resolution?.helperPath, fallback?.helperPath) || null,
    resolutionSource,
    resolutionOrder,
    runtimeResolution:
      resolutionSource || resolutionOrder.length
        ? {
            resolutionSource,
            resolutionOrder,
          }
        : null,
  };
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
  const runDir =
    readFirstString(
      preparedImage?.runDir,
      preparedImage?.session?.runDir,
      preparedImage?.run?.runDir,
      fallback?.runDir,
      fallback?.session?.runDir,
      fallback?.run?.runDir
    ) || null;
  const stableSourceRef =
    readFirstString(
      preparedImage?.stableSourceRef,
      preparedImage?.stable_source_ref,
      preparedImage?.session?.stableSourceRef,
      preparedImage?.run?.stableSourceRef,
      fallback?.stableSourceRef,
      fallback?.stable_source_ref,
      fallback?.session?.stableSourceRef,
      fallback?.run?.stableSourceRef
    ) || null;
  const settings = normalizeSettings(preparedImage?.settings ?? fallback?.settings ?? {});
  const reproducibility = cloneJson(preparedImage?.reproducibility ?? fallback?.reproducibility ?? null);
  const runtimeResolution = normalizeMagicSelectRuntimeResolution(
    preparedImage?.runtimeResolution ?? preparedImage?.runtime_resolution ?? preparedImage?.packResolution,
    {
      runtime: readFirstString(preparedImage?.runtime, fallback?.runtime, reproducibility?.runtime),
      runtimeId: readFirstString(
        preparedImage?.runtimeId,
        preparedImage?.runtime_id,
        fallback?.runtimeId,
        fallback?.runtime_id,
        reproducibility?.runtime_id
      ),
      imageHash: readFirstString(
        preparedImage?.imageHash,
        preparedImage?.image_hash,
        fallback?.imageHash,
        fallback?.image_hash,
        reproducibility?.imageHash,
        reproducibility?.image_hash
      ),
      modelId: readFirstString(
        preparedImage?.modelId,
        preparedImage?.model_id,
        fallback?.modelId,
        fallback?.model_id,
        reproducibility?.modelId,
        reproducibility?.model_id
      ),
      modelRevision: readFirstString(
        preparedImage?.modelRevision,
        preparedImage?.model_revision,
        fallback?.modelRevision,
        fallback?.model_revision,
        reproducibility?.modelRevision,
        reproducibility?.model_revision
      ),
      modelPath: readFirstString(
        preparedImage?.modelPath,
        preparedImage?.model_path,
        fallback?.modelPath,
        fallback?.model_path
      ),
      helperPath: readFirstString(
        preparedImage?.helperPath,
        preparedImage?.helper_path,
        fallback?.helperPath,
        fallback?.helper_path
      ),
      packId: readFirstString(
        preparedImage?.modelPackId,
        preparedImage?.model_pack_id,
        fallback?.modelPackId,
        fallback?.model_pack_id,
        reproducibility?.modelPackId,
        reproducibility?.model_pack_id
      ),
      packVersion: readFirstString(
        preparedImage?.modelPackVersion,
        preparedImage?.model_pack_version,
        fallback?.modelPackVersion,
        fallback?.model_pack_version,
        reproducibility?.modelPackVersion,
        reproducibility?.model_pack_version
      ),
      manifestPath: readFirstString(
        preparedImage?.manifestPath,
        preparedImage?.manifest_path,
        fallback?.manifestPath,
        fallback?.manifest_path
      ),
      modelAssetSha256: readFirstString(
        preparedImage?.modelAssetSha256,
        preparedImage?.model_asset_sha256,
        fallback?.modelAssetSha256,
        fallback?.model_asset_sha256,
        reproducibility?.modelAssetSha256,
        reproducibility?.model_asset_sha256
      ),
      modelInstallSource: readFirstString(
        preparedImage?.modelInstallSource,
        preparedImage?.model_install_source,
        fallback?.modelInstallSource,
        fallback?.model_install_source,
        reproducibility?.modelInstallSource,
        reproducibility?.model_install_source
      ),
      entitlementMode: readFirstString(
        preparedImage?.entitlementMode,
        preparedImage?.entitlement_mode,
        fallback?.entitlementMode,
        fallback?.entitlement_mode,
        reproducibility?.entitlementMode,
        reproducibility?.entitlement_mode
      ),
      resolutionSource: readFirstString(
        preparedImage?.resolutionSource,
        preparedImage?.resolution_source,
        fallback?.resolutionSource,
        fallback?.resolution_source
      ),
    }
  );
  const resolutionSource =
    readFirstString(
      preparedImage?.resolutionSource,
      preparedImage?.resolution_source,
      fallback?.resolutionSource,
      fallback?.resolution_source,
      preparedImage?.runtimeResolution?.resolutionSource,
      preparedImage?.runtime_resolution?.resolutionSource,
      fallback?.runtimeResolution?.resolutionSource,
      fallback?.runtime_resolution?.resolutionSource,
      runtimeResolution?.resolutionSource
    ) || null;
  const resolutionOrder = normalizeStringList(
    preparedImage?.resolutionOrder ??
      preparedImage?.runtimeResolution?.resolutionOrder ??
      preparedImage?.runtime_resolution?.resolutionOrder,
    fallback?.resolutionOrder ??
      fallback?.runtimeResolution?.resolutionOrder ??
      fallback?.runtime_resolution?.resolutionOrder ??
      runtimeResolution?.resolutionOrder
  );
  const normalizedRuntimeResolution =
    preparedImage?.runtimeResolution && typeof preparedImage.runtimeResolution === "object"
      ? {
          ...runtimeResolution,
          resolutionSource:
            readFirstString(
              preparedImage.runtimeResolution?.resolutionSource,
              resolutionSource,
              runtimeResolution?.resolutionSource
            ) || null,
          resolutionOrder: normalizeStringList(
            preparedImage.runtimeResolution?.resolutionOrder,
            resolutionOrder.length ? resolutionOrder : runtimeResolution?.resolutionOrder
          ),
        }
      : runtimeResolution ??
        (resolutionSource || resolutionOrder.length
          ? {
              resolutionSource,
              resolutionOrder,
            }
          : null);
  return {
    id,
    imageId,
    imagePath: imagePath || null,
    runDir,
    runPaths: cloneJson(preparedImage?.runPaths ?? fallback?.runPaths ?? buildMagicSelectRunPaths(runDir)),
    stableSourceRef,
    source: readFirstString(preparedImage?.source, fallback?.source, "canvas_magic_select"),
    settings,
    resolutionSource,
    resolutionOrder,
    preparedAt: normalizeTimestamp(preparedImage?.preparedAt, normalizeTimestamp(fallback?.preparedAt, Date.now())),
    lastUsedAt: normalizeTimestamp(preparedImage?.lastUsedAt, normalizeTimestamp(fallback?.lastUsedAt, null)),
    expiresAt: normalizeTimestamp(preparedImage?.expiresAt, normalizeTimestamp(fallback?.expiresAt, null)),
    useCount:
      preparedImage?.useCount != null || fallback?.useCount != null
        ? normalizeInteger(preparedImage?.useCount ?? fallback?.useCount, 0)
        : 0,
    runtime: readFirstString(normalizedRuntimeResolution?.runtime) || null,
    runtimeId: readFirstString(normalizedRuntimeResolution?.runtimeId) || null,
    imageHash: readFirstString(normalizedRuntimeResolution?.imageHash) || null,
    modelId: readFirstString(normalizedRuntimeResolution?.modelId) || null,
    modelRevision: readFirstString(normalizedRuntimeResolution?.modelRevision) || null,
    modelPath: readFirstString(normalizedRuntimeResolution?.modelPath) || null,
    helperPath: readFirstString(normalizedRuntimeResolution?.helperPath) || null,
    modelPackId: readFirstString(normalizedRuntimeResolution?.packId) || null,
    modelPackVersion: readFirstString(normalizedRuntimeResolution?.packVersion) || null,
    manifestPath: readFirstString(normalizedRuntimeResolution?.manifestPath) || null,
    modelAssetSha256: readFirstString(normalizedRuntimeResolution?.modelAssetSha256) || null,
    modelInstallSource: readFirstString(normalizedRuntimeResolution?.modelInstallSource) || null,
    entitlementMode: readFirstString(normalizedRuntimeResolution?.entitlementMode) || null,
    runtimeResolution: normalizedRuntimeResolution,
    reproducibility,
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

function resolveRunDirInput({ runDir = null, session = null, run = null } = {}) {
  return (
    readFirstString(
      runDir,
      session?.runDir,
      session?.run_dir,
      session?.paths?.runDir,
      session?.paths?.run_dir,
      run?.runDir,
      run?.run_dir
    ) || null
  );
}

function resolveStableSourceRefInput(
  { stableSourceRef = null, sourceReceiptPath = null, session = null, run = null } = {}
) {
  return (
    readFirstString(
      stableSourceRef,
      sourceReceiptPath,
      session?.stableSourceRef,
      session?.stable_source_ref,
      run?.stableSourceRef,
      run?.stable_source_ref
    ) || null
  );
}

async function ensureLocalMagicSelectPackInstalled({
  invokeFn = invokeLocalMagicSelectCommand,
  source = "magic_select_runtime",
} = {}) {
  const request = buildDesktopModelPackInstallRequest({
    packId: MAGIC_SELECT_LOCAL_PACK_ID,
    source,
    allowExisting: false,
  });
  try {
    return await installDesktopModelPack(invokeFn, request);
  } catch (error) {
    throw normalizeRuntimeError(error, {
      code: "local_magic_select_pack_install_failed",
      contract: DESKTOP_MODEL_PACK_INSTALL_CONTRACT,
      action: DESKTOP_MODEL_PACK_ACTIONS.INSTALL,
      details: {
        message:
          readFirstString(error?.message, error?.error, error) ||
          "Magic Select local model pack install failed.",
      },
    });
  }
}

function normalizeDirectClickRequest(
  {
    imageId = "",
    imagePath = "",
    runDir = null,
    stableSourceRef = null,
    sourceReceiptPath = null,
    session = null,
    run = null,
    clickAnchor = null,
    source = "canvas_magic_select",
    settings = {},
  } = {}
) {
  const normalizedImageId = readFirstString(imageId);
  if (!normalizedImageId) throw new Error("runLocalMagicSelectClick requires imageId");
  const normalizedImagePath = readFirstString(imagePath);
  if (!normalizedImagePath) throw new Error("runLocalMagicSelectClick requires imagePath");
  const normalizedRunDir = resolveRunDirInput({ runDir, session, run });
  if (!normalizedRunDir) {
    throw new Error("runLocalMagicSelectClick requires runDir or session.runDir");
  }
  const normalizedStableSourceRef = resolveStableSourceRefInput({
    stableSourceRef,
    sourceReceiptPath,
    session,
    run,
  });
  if (!normalizedStableSourceRef) {
    throw new Error("runLocalMagicSelectClick requires stableSourceRef");
  }
  return {
    imageId: normalizedImageId,
    imagePath: normalizedImagePath,
    runDir: normalizedRunDir,
    stableSourceRef: normalizedStableSourceRef,
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
    sourceReceiptPath = null,
    session = null,
    run = null,
    source = "canvas_magic_select",
    settings = {},
  } = {}
) {
  const normalizedImageId = readFirstString(imageId);
  if (!normalizedImageId) throw new Error("prepareLocalMagicSelectImage requires imageId");
  const normalizedImagePath = readFirstString(imagePath);
  if (!normalizedImagePath) throw new Error("prepareLocalMagicSelectImage requires imagePath");
  const normalizedRunDir = resolveRunDirInput({ runDir, session, run });
  if (!normalizedRunDir) {
    throw new Error("prepareLocalMagicSelectImage requires runDir or session.runDir");
  }
  const normalizedStableSourceRef = resolveStableSourceRefInput({
    stableSourceRef,
    sourceReceiptPath,
    session,
    run,
  });
  if (!normalizedStableSourceRef) {
    throw new Error("prepareLocalMagicSelectImage requires stableSourceRef");
  }
  return {
    imageId: normalizedImageId,
    imagePath: normalizedImagePath,
    runDir: normalizedRunDir,
    stableSourceRef: normalizedStableSourceRef,
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
    runDir = null,
    hostInstall = null,
  } = {}
) {
  maybeThrowRuntimeFailure(raw, {
    code,
    contract,
    action,
    imageId,
    preparedImageId: preparedImage?.id,
  });
  const installMetadata = normalizeInstalledPackMetadata(hostInstall, preparedImage ?? {});
  const warnings = mergeWarnings(hostInstall?.warnings, raw?.warnings);
  const normalizedPreparedImage =
    raw?.preparedImage || raw?.preparedImageId || preparedImage
      ? normalizePreparedImage(
          raw?.preparedImage,
          {
            id: readFirstString(raw?.preparedImageId, preparedImage?.id),
            imageId,
            imagePath: preparedImage?.imagePath,
            runDir: preparedImage?.runDir || runDir,
            runPaths: preparedImage?.runPaths ?? buildMagicSelectRunPaths(preparedImage?.runDir || runDir),
            stableSourceRef: preparedImage?.stableSourceRef,
            source: preparedImage?.source,
            settings: preparedImage?.settings,
            runtime: preparedImage?.runtime ?? installMetadata.runtime,
            runtimeId: preparedImage?.runtimeId ?? installMetadata.runtimeId,
            imageHash: preparedImage?.imageHash,
            modelId: preparedImage?.modelId ?? installMetadata.modelId,
            modelRevision: preparedImage?.modelRevision ?? installMetadata.modelRevision,
            modelPackId: preparedImage?.modelPackId ?? installMetadata.modelPackId,
            modelPackVersion: preparedImage?.modelPackVersion ?? installMetadata.modelPackVersion,
            modelAssetSha256: preparedImage?.modelAssetSha256 ?? installMetadata.modelAssetSha256,
            modelInstallSource: preparedImage?.modelInstallSource ?? installMetadata.modelInstallSource,
            entitlementMode: preparedImage?.entitlementMode ?? installMetadata.entitlementMode,
            manifestPath: preparedImage?.manifestPath ?? installMetadata.manifestPath,
            modelPath: preparedImage?.modelPath ?? installMetadata.modelPath,
            helperPath: preparedImage?.helperPath ?? installMetadata.helperPath,
            resolutionSource: preparedImage?.resolutionSource ?? installMetadata.resolutionSource,
            resolutionOrder: preparedImage?.resolutionOrder ?? installMetadata.resolutionOrder,
            runtimeResolution: preparedImage?.runtimeResolution ?? installMetadata.runtimeResolution,
            preparedAt: preparedImage?.preparedAt,
            lastUsedAt: preparedImage?.lastUsedAt,
            expiresAt: preparedImage?.expiresAt,
            useCount: preparedImage?.useCount,
            reproducibility: raw?.preparedImage?.reproducibility ?? preparedImage?.reproducibility ?? raw?.receipt?.reproducibility,
            warnings: mergeWarnings(raw?.preparedImage?.warnings, preparedImage?.warnings, warnings),
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

function normalizePreparedImageResult(raw, request, hostInstall = null) {
  maybeThrowRuntimeFailure(raw, {
    code: "local_magic_select_prepare_failed",
    contract: MAGIC_SELECT_LOCAL_PREPARED_RUNTIME_CONTRACT,
    action: MAGIC_SELECT_ACTIONS.prepare,
    imageId: request.imageId,
  });
  const installMetadata = normalizeInstalledPackMetadata(hostInstall);
  const warnings = mergeWarnings(hostInstall?.warnings, raw?.warnings);
  const preparedImage = normalizePreparedImage(
    raw?.preparedImage,
    {
      id: readFirstString(raw?.preparedImageId, raw?.id),
      imageId: request.imageId,
      imagePath: request.imagePath,
      runDir: request.runDir,
      runPaths: buildMagicSelectRunPaths(request.runDir),
      stableSourceRef: request.stableSourceRef,
      source: request.source,
      settings: request.settings,
      runtime: installMetadata.runtime,
      runtimeId: installMetadata.runtimeId,
      modelId: installMetadata.modelId,
      modelRevision: installMetadata.modelRevision,
      modelPackId: installMetadata.modelPackId,
      modelPackVersion: installMetadata.modelPackVersion,
      modelAssetSha256: installMetadata.modelAssetSha256,
      modelInstallSource: installMetadata.modelInstallSource,
      entitlementMode: installMetadata.entitlementMode,
      manifestPath: installMetadata.manifestPath,
      modelPath: installMetadata.modelPath,
      helperPath: installMetadata.helperPath,
      resolutionSource: installMetadata.resolutionSource,
      resolutionOrder: installMetadata.resolutionOrder,
      runtimeResolution: installMetadata.runtimeResolution,
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
    sourceReceiptPath = null,
    session = null,
    run = null,
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
    sourceReceiptPath,
    session,
    run,
    source,
    settings,
  });

  const hostInstall = await ensureLocalMagicSelectPackInstalled({
    invokeFn,
    source: payload.source,
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

  return normalizePreparedImageResult(raw, payload, hostInstall);
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
    sourceReceiptPath = null,
    session = null,
    run = null,
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
    sourceReceiptPath,
    session,
    run,
    clickAnchor,
    source,
    settings,
  });

  const hostInstall = await ensureLocalMagicSelectPackInstalled({
    invokeFn,
    source: payload.source,
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
    runDir: payload.runDir,
    hostInstall,
  });
}
