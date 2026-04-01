export const DESKTOP_EVENT_TYPES = Object.freeze({
  PLAN_PREVIEW: "plan_preview",
  VERSION_CREATED: "version_created",
  MOTHER_INTENT_INFERRED: "mother_intent_inferred",
  MOTHER_INTENT_INFER_FAILED: "mother_intent_infer_failed",
  MOTHER_PROMPT_COMPILED: "mother_prompt_compiled",
  MOTHER_PROMPT_COMPILE_FAILED: "mother_prompt_compile_failed",
  ARTIFACT_CREATED: "artifact_created",
  GENERATION_FAILED: "generation_failed",
  COST_LATENCY_UPDATE: "cost_latency_update",
  CANVAS_CONTEXT: "canvas_context",
  CANVAS_CONTEXT_FAILED: "canvas_context_failed",
  INTENT_ICONS: "intent_icons",
  INTENT_ICONS_FAILED: "intent_icons_failed",
  IMAGE_DESCRIPTION: "image_description",
  IMAGE_DNA_EXTRACTED: "image_dna_extracted",
  IMAGE_DNA_EXTRACTED_FAILED: "image_dna_extracted_failed",
  IMAGE_SOUL_EXTRACTED: "image_soul_extracted",
  IMAGE_SOUL_EXTRACTED_FAILED: "image_soul_extracted_failed",
  TRIPLET_RULE: "triplet_rule",
  TRIPLET_RULE_FAILED: "triplet_rule_failed",
  TRIPLET_ODD_ONE_OUT: "triplet_odd_one_out",
  TRIPLET_ODD_ONE_OUT_FAILED: "triplet_odd_one_out_failed",
  RECREATE_PROMPT_INFERRED: "recreate_prompt_inferred",
  RECREATE_ITERATION_UPDATE: "recreate_iteration_update",
  RECREATE_DONE: "recreate_done",
});

export const DESKTOP_SESSION_COMMAND_CONTRACT = "cue.desktop.session.command.v1";
export const DESKTOP_SESSION_UPDATE_CONTRACT = "cue.desktop.session.update.v1";
export const DESKTOP_SESSION_UPDATE_EVENT = "cue-desktop-session-update";

export const DESKTOP_SESSION_ACTIONS = Object.freeze({
  START: "session.start",
  DISPATCH: "session.dispatch",
  STATUS: "session.status",
  STOP: "session.stop",
});

export const DESKTOP_SESSION_DISPATCH_KINDS = Object.freeze({
  LEGACY_COMMAND: "legacy_command",
  LEGACY_PROMPT: "legacy_prompt",
});

export const DESKTOP_SESSION_UPDATE_KINDS = Object.freeze({
  STATUS: "status",
  EVENT: "event",
});

export const DESKTOP_MODEL_PACK_INSTALL_CONTRACT = "cue.desktop.model-pack.install.v1";
export const DESKTOP_MODEL_PACK_UPDATE_CONTRACT = "cue.desktop.model-pack.update.v1";
export const DESKTOP_MODEL_PACK_UPDATE_EVENT = "cue-desktop-model-pack-update";

export const DESKTOP_MODEL_PACK_ACTIONS = Object.freeze({
  STATUS: "pack.status",
  INSTALL: "pack.install",
});

export const DESKTOP_MODEL_PACK_UPDATE_KINDS = Object.freeze({
  MODEL_PACK: "model_pack",
});

export const PTY_COMMANDS = Object.freeze({
  TEXT_MODEL: "/text_model",
  IMAGE_MODEL: "/image_model",
  DESCRIBE: "/describe",
  USE: "/use",
  CANVAS_CONTEXT_RT_START: "/canvas_context_rt_start",
  CANVAS_CONTEXT_RT_STOP: "/canvas_context_rt_stop",
  CANVAS_CONTEXT_RT: "/canvas_context_rt",
  INTENT_RT_START: "/intent_rt_start",
  INTENT_RT_STOP: "/intent_rt_stop",
  INTENT_RT: "/intent_rt",
  INTENT_RT_MOTHER_START: "/intent_rt_mother_start",
  INTENT_RT_MOTHER_STOP: "/intent_rt_mother_stop",
  INTENT_RT_MOTHER: "/intent_rt_mother",
  INTENT_INFER: "/intent_infer",
  PROMPT_COMPILE: "/prompt_compile",
  MOTHER_GENERATE: "/mother_generate",
  RECAST: "/recast",
  RECREATE: "/recreate",
  BLEND: "/blend",
  SWAP_DNA: "/swap_dna",
  BRIDGE: "/bridge",
  EXTRACT_DNA: "/extract_dna",
  SOUL_LEECH: "/soul_leech",
  EXTRACT_RULE: "/extract_rule",
  ODD_ONE_OUT: "/odd_one_out",
  TRIFORCE: "/triforce",
});

const LEGACY_COMMAND_NAMES = new Set(Object.values(PTY_COMMANDS));
let desktopSessionRequestSeq = 0;

function nextDesktopSessionRequestId() {
  desktopSessionRequestSeq += 1;
  return `cue-session-${Date.now()}-${desktopSessionRequestSeq}`;
}

function nextDesktopPackRequestId() {
  desktopSessionRequestSeq += 1;
  return `cue-pack-${Date.now()}-${desktopSessionRequestSeq}`;
}

export function quoteForPtyArg(value) {
  const raw = String(value || "");
  const escaped = raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function buildPtyCommand(command, argsText = "") {
  const cmd = String(command || "").trim();
  const args = String(argsText || "");
  return `${cmd}${args ? ` ${args}` : ""}\n`;
}

export function parseLegacyPtyLine(data) {
  const raw = String(data || "").replace(/\r/g, "");
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("parseLegacyPtyLine requires a non-empty command line");
  }
  if (!trimmed.startsWith("/")) {
    return {
      kind: DESKTOP_SESSION_DISPATCH_KINDS.LEGACY_PROMPT,
      prompt: trimmed,
      raw: trimmed,
    };
  }
  const firstSpace = trimmed.indexOf(" ");
  const command = firstSpace >= 0 ? trimmed.slice(0, firstSpace) : trimmed;
  const argsText = firstSpace >= 0 ? trimmed.slice(firstSpace + 1).trim() : "";
  return {
    kind: DESKTOP_SESSION_DISPATCH_KINDS.LEGACY_COMMAND,
    command,
    argsText,
    recognized: LEGACY_COMMAND_NAMES.has(command),
    raw: trimmed,
  };
}

function buildSessionCommandEnvelope(action, runDir, payload = {}) {
  const normalizedRunDir = String(runDir || "").trim();
  if (!normalizedRunDir) {
    throw new Error("Desktop session bridge requires a runDir");
  }
  return {
    contract: DESKTOP_SESSION_COMMAND_CONTRACT,
    requestId: nextDesktopSessionRequestId(),
    action,
    session: {
      runDir: normalizedRunDir,
    },
    ...payload,
  };
}

export function buildDesktopSessionStartRequest({
  runDir,
  memoryEnabled = false,
  textModel = null,
  imageModel = null,
  activeImagePath = null,
} = {}) {
  return buildSessionCommandEnvelope(DESKTOP_SESSION_ACTIONS.START, runDir, {
    launch: {
      memoryEnabled: Boolean(memoryEnabled),
      textModel: textModel ? String(textModel) : null,
      imageModel: imageModel ? String(imageModel) : null,
      activeImagePath: activeImagePath ? String(activeImagePath) : null,
    },
  });
}

export function buildDesktopSessionDispatchRequest({ runDir, data } = {}) {
  return buildSessionCommandEnvelope(DESKTOP_SESSION_ACTIONS.DISPATCH, runDir, {
    command: parseLegacyPtyLine(data),
  });
}

export function buildDesktopSessionStatusRequest({ runDir } = {}) {
  return buildSessionCommandEnvelope(DESKTOP_SESSION_ACTIONS.STATUS, runDir);
}

export function buildDesktopSessionStopRequest({ runDir } = {}) {
  return buildSessionCommandEnvelope(DESKTOP_SESSION_ACTIONS.STOP, runDir);
}

export function buildDesktopModelPackInstallRequest({
  packId,
  source = "desktop_runtime",
  allowExisting = true,
} = {}) {
  const normalizedPackId = String(packId || "").trim();
  if (!normalizedPackId) {
    throw new Error("Desktop model-pack install requires a packId");
  }
  return {
    contract: DESKTOP_MODEL_PACK_INSTALL_CONTRACT,
    requestId: nextDesktopPackRequestId(),
    action: DESKTOP_MODEL_PACK_ACTIONS.INSTALL,
    pack: {
      packId: normalizedPackId,
    },
    options: {
      source: String(source || "desktop_runtime"),
      allowExisting: allowExisting !== false,
    },
  };
}

export function buildDesktopModelPackStatusRequest({ packId } = {}) {
  const normalizedPackId = String(packId || "").trim();
  if (!normalizedPackId) {
    throw new Error("Desktop model-pack status requires a packId");
  }
  return {
    contract: DESKTOP_MODEL_PACK_INSTALL_CONTRACT,
    requestId: nextDesktopPackRequestId(),
    action: DESKTOP_MODEL_PACK_ACTIONS.STATUS,
    pack: {
      packId: normalizedPackId,
    },
  };
}

export function startDesktopSession(invokeFn, request) {
  return invokeFn("desktop_session_start", { request });
}

export function dispatchDesktopSessionCommand(invokeFn, request) {
  return invokeFn("desktop_session_dispatch", { request });
}

export function readDesktopSessionStatus(invokeFn, request) {
  return invokeFn("desktop_session_status", { request });
}

export function stopDesktopSession(invokeFn, request) {
  return invokeFn("desktop_session_stop", { request });
}

export function installDesktopModelPack(invokeFn, request) {
  return invokeFn("install_desktop_model_pack", { request });
}

export function readDesktopModelPackStatus(invokeFn, request) {
  return invokeFn("desktop_model_pack_status", { request });
}

export function writePty(invokeFn, data, { runDir } = {}) {
  const request = buildDesktopSessionDispatchRequest({ runDir, data });
  return dispatchDesktopSessionCommand(invokeFn, request);
}

export function sendPtyCommand(invokeFn, command, argsText = "", { runDir } = {}) {
  return writePty(invokeFn, buildPtyCommand(command, argsText), { runDir });
}

export function unwrapDesktopSessionUpdate(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.contract !== DESKTOP_SESSION_UPDATE_CONTRACT) return null;
  const runDir = String(payload?.session?.runDir || "").trim();
  if (!runDir) return null;
  const kind = String(payload.kind || "").trim();
  if (!kind) return null;
  return {
    contract: payload.contract,
    kind,
    runDir,
    requestId: payload.requestId ? String(payload.requestId) : null,
    launch: payload.launch && typeof payload.launch === "object" ? { ...payload.launch } : null,
    runtime: payload.runtime && typeof payload.runtime === "object" ? { ...payload.runtime } : null,
    detail: payload.detail ? String(payload.detail) : null,
    event: payload.event && typeof payload.event === "object" ? payload.event : null,
  };
}

export function unwrapDesktopModelPackUpdate(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.contract !== DESKTOP_MODEL_PACK_UPDATE_CONTRACT) return null;
  const kind = String(payload.kind || "").trim();
  if (kind !== DESKTOP_MODEL_PACK_UPDATE_KINDS.MODEL_PACK) return null;
  const packId = String(payload?.pack?.packId || "").trim();
  if (!packId) return null;
  return {
    contract: payload.contract,
    requestId: payload.requestId ? String(payload.requestId) : null,
    kind,
    pack: payload.pack && typeof payload.pack === "object" ? { ...payload.pack } : null,
    progress: payload.progress && typeof payload.progress === "object" ? { ...payload.progress } : null,
    detail: payload.detail ? String(payload.detail) : null,
  };
}
