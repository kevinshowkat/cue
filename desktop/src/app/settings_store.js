const MEMORY_KEY = "brood.memory";
const TEXT_MODEL_KEY = "brood.textModel";
const IMAGE_MODEL_KEY = "brood.imageModel";
const IMAGE_MODEL_DEFAULT_MIGRATION_KEY = "brood.imageModel.default.v2";
const RAIL_ICON_PACK_KEY = "juggernaut.railIconPack.v1";
const PROMPT_STRATEGY_MODE_KEY = "brood.promptStrategyMode.v1";
const PROMPT_REPEAT_FULL_KEY = "brood.promptRepeatFull.v1";
const INSTALL_TELEMETRY_OPT_IN_KEY = "brood.installTelemetry.optIn.v1";

function safeGetItem(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetItem(storage, key, value) {
  try {
    storage?.setItem?.(key, value);
  } catch {
    // ignore storage failures
  }
}

function normalizePromptStrategyMode(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "auto") return "auto";
  if (value === "baseline") return "baseline";
  return "tail";
}

function resolveImageModel({
  storage,
  defaultImageModel,
  legacyDefaultImageModel,
}) {
  const storedRaw = String(safeGetItem(storage, IMAGE_MODEL_KEY) || "").trim();
  const migrated = safeGetItem(storage, IMAGE_MODEL_DEFAULT_MIGRATION_KEY) === "1";
  if (!storedRaw) {
    if (!migrated) safeSetItem(storage, IMAGE_MODEL_DEFAULT_MIGRATION_KEY, "1");
    return defaultImageModel;
  }
  if (!migrated && storedRaw === legacyDefaultImageModel) {
    safeSetItem(storage, IMAGE_MODEL_KEY, defaultImageModel);
    safeSetItem(storage, IMAGE_MODEL_DEFAULT_MIGRATION_KEY, "1");
    return defaultImageModel;
  }
  if (!migrated) safeSetItem(storage, IMAGE_MODEL_DEFAULT_MIGRATION_KEY, "1");
  return storedRaw;
}

export function loadCanvasAppSettings({
  storage = globalThis.localStorage,
  normalizeRailIconPackId = (value) => String(value || "").trim(),
  defaultRailIconPackId = "",
  defaultTextModel = "gpt-5.2",
  defaultImageModel = "gemini-3-pro-image-preview",
  legacyDefaultImageModel = "gemini-2.5-flash-image",
} = {}) {
  return {
    memory: safeGetItem(storage, MEMORY_KEY) === "1",
    alwaysOnVision: false,
    railIconPack: normalizeRailIconPackId(safeGetItem(storage, RAIL_ICON_PACK_KEY) || defaultRailIconPackId),
    textModel: safeGetItem(storage, TEXT_MODEL_KEY) || defaultTextModel,
    imageModel: resolveImageModel({
      storage,
      defaultImageModel,
      legacyDefaultImageModel,
    }),
    promptStrategyMode: normalizePromptStrategyMode(safeGetItem(storage, PROMPT_STRATEGY_MODE_KEY) || "auto"),
    promptRepeatFull: safeGetItem(storage, PROMPT_REPEAT_FULL_KEY) === "1",
    installTelemetryOptIn: safeGetItem(storage, INSTALL_TELEMETRY_OPT_IN_KEY) === "1",
  };
}

export function createCanvasAppSettingsStore(options = {}) {
  const storage = options.storage || globalThis.localStorage;
  const normalizeRailIconPackId =
    typeof options.normalizeRailIconPackId === "function" ? options.normalizeRailIconPackId : (value) => String(value || "").trim();
  const defaultRailIconPackId = String(options.defaultRailIconPackId || "").trim();
  const defaultTextModel = String(options.defaultTextModel || "gpt-5.2").trim() || "gpt-5.2";
  const defaultImageModel = String(options.defaultImageModel || "gemini-3-pro-image-preview").trim() || "gemini-3-pro-image-preview";
  const legacyDefaultImageModel =
    String(options.legacyDefaultImageModel || "gemini-2.5-flash-image").trim() || "gemini-2.5-flash-image";
  let state = loadCanvasAppSettings({
    storage,
    normalizeRailIconPackId,
    defaultRailIconPackId,
    defaultTextModel,
    defaultImageModel,
    legacyDefaultImageModel,
  });
  const listeners = new Set();

  function emit() {
    for (const listener of listeners) {
      listener(state);
    }
  }

  function patch(nextPatch = {}) {
    state = {
      ...state,
      ...nextPatch,
    };
    emit();
    return state;
  }

  return {
    getState() {
      return state;
    },
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setMemory(value) {
      const next = Boolean(value);
      safeSetItem(storage, MEMORY_KEY, next ? "1" : "0");
      patch({ memory: next });
      return next;
    },
    setRailIconPack(value) {
      const next = normalizeRailIconPackId(value || defaultRailIconPackId);
      safeSetItem(storage, RAIL_ICON_PACK_KEY, next);
      patch({ railIconPack: next });
      return next;
    },
    setTextModel(value) {
      const next = String(value || "").trim() || defaultTextModel;
      safeSetItem(storage, TEXT_MODEL_KEY, next);
      patch({ textModel: next });
      return next;
    },
    setImageModel(value) {
      const next = String(value || "").trim() || defaultImageModel;
      safeSetItem(storage, IMAGE_MODEL_KEY, next);
      safeSetItem(storage, IMAGE_MODEL_DEFAULT_MIGRATION_KEY, "1");
      patch({ imageModel: next });
      return next;
    },
    setPromptStrategyMode(value) {
      const next = normalizePromptStrategyMode(value);
      safeSetItem(storage, PROMPT_STRATEGY_MODE_KEY, next);
      patch({ promptStrategyMode: next });
      return next;
    },
    setPromptRepeatFull(value) {
      const next = Boolean(value);
      safeSetItem(storage, PROMPT_REPEAT_FULL_KEY, next ? "1" : "0");
      patch({ promptRepeatFull: next });
      return next;
    },
    setInstallTelemetryOptIn(value) {
      const next = Boolean(value);
      safeSetItem(storage, INSTALL_TELEMETRY_OPT_IN_KEY, next ? "1" : "0");
      patch({ installTelemetryOptIn: next });
      return next;
    },
  };
}
