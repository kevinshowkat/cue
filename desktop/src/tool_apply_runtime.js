import {
  buildLocalToolEditPlan,
  buildLocalToolReceiptStep,
  listSupportedLocalToolOperations,
  renderLocalToolEditCanvas,
} from "./local_tool_edits.js";
import {
  buildSingleImageCapabilityDisabledMessage,
  buildSingleImageCapabilityReceiptStep,
  normalizeSingleImageCapabilityRequest,
  resolveSingleImageCapabilityAvailability,
} from "./single_image_capability_routing.js";

export const TOOL_APPLY_BRIDGE_EVENT = "juggernaut:apply-tool";
export const TOOL_APPLY_BRIDGE_SUCCESS_EVENT = "juggernaut:tool-applied";
export const TOOL_APPLY_BRIDGE_FAILURE_EVENT = "juggernaut:tool-apply-failed";

const TOOL_APPLY_BRIDGE_HANDLER_KEY = "__juggernautToolApplyBridgeHandler";

function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
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

function resolveRequestEnvelope(request = {}) {
  const raw = asRecord(request) || {};
  const tool = asRecord(raw.tool) || (looksLikeToolRecord(raw) ? raw : null);
  const selection = asRecord(raw.selection);
  const target = asRecord(raw.target);
  return { raw, tool, selection, target };
}

function supportedOperationListText() {
  return listSupportedLocalToolOperations()
    .map((item) => item.id)
    .join(", ");
}

function defaultNormalizeErrorMessage(error) {
  const text = String(error?.message || error || "Tool apply failed")
    .replace(/\s+/g, " ")
    .trim();
  return text || "Tool apply failed";
}

function toolIdFromRequest(request = {}) {
  const { raw, tool } = resolveRequestEnvelope(request);
  return (
    readFirstString(tool?.id, tool?.toolId, tool?.jobId, raw.toolId, raw.tool_id, raw.jobId, raw.job_id, looksLikeToolRecord(raw) ? "" : raw.id) ||
    null
  );
}

function resolveSelectedImageIds(request = {}, activeImageId = "") {
  const { raw, selection, target } = resolveRequestEnvelope(request);
  const ids = [];
  for (const candidate of [
    raw.selectedImageIds,
    raw.selected_image_ids,
    selection?.selectedImageIds,
    selection?.selected_image_ids,
    target?.selectedImageIds,
    target?.selected_image_ids,
  ]) {
    for (const value of Array.isArray(candidate) ? candidate : []) {
      const imageId = readFirstString(value);
      if (!imageId || ids.includes(imageId)) continue;
      ids.push(imageId);
    }
  }
  const activeId = readFirstString(
    raw.selectedImageId,
    raw.selected_image_id,
    raw.activeImageId,
    raw.active_image_id,
    selection?.activeId,
    selection?.active_id,
    target?.activeImageId,
    target?.active_image_id,
    activeImageId
  );
  if (activeId && !ids.includes(activeId)) ids.push(activeId);
  return ids;
}

async function maybeResolve(value, ...args) {
  if (typeof value === "function") return value(...args);
  return value;
}

function normalizeCapabilityAvailabilityMap(capability, rawValue) {
  const record = asRecord(rawValue);
  if (!record) {
    if (rawValue == null) return rawValue;
    return {
      [capability]: rawValue,
    };
  }
  if (Object.prototype.hasOwnProperty.call(record, capability)) return record;
  return {
    [capability]: record,
  };
}

export function resolveToolApplyTargetImageId(
  request = {},
  { activeImageId = "", hasImageId = null, getImageById = null } = {}
) {
  const { raw, tool, selection, target } = resolveRequestEnvelope(request);
  const candidates = [
    raw.imageId,
    raw.image_id,
    raw.selectedImageId,
    raw.selected_image_id,
    raw.activeImageId,
    raw.active_image_id,
    raw.targetImageId,
    raw.target_image_id,
    raw.targetId,
    raw.target_id,
    tool?.imageId,
    tool?.image_id,
    tool?.targetImageId,
    tool?.target_image_id,
    selection?.activeId,
    selection?.active_id,
    target?.activeImageId,
    target?.active_image_id,
    Array.isArray(target?.selectedImageIds) ? target.selectedImageIds[0] : "",
    Array.isArray(target?.selected_image_ids) ? target.selected_image_ids[0] : "",
    activeImageId,
  ];
  for (const candidate of candidates) {
    const imageId = readFirstString(candidate);
    if (!imageId) continue;
    if (typeof hasImageId === "function") {
      if (hasImageId(imageId)) return imageId;
      continue;
    }
    if (typeof getImageById === "function") {
      if (getImageById(imageId)) return imageId;
      continue;
    }
    return imageId;
  }
  return "";
}

export function buildToolApplyFailureResult(
  request = {},
  error,
  { imageId = null, normalizeErrorMessage = defaultNormalizeErrorMessage, extras = null } = {}
) {
  const normalize = typeof normalizeErrorMessage === "function" ? normalizeErrorMessage : defaultNormalizeErrorMessage;
  return {
    ok: false,
    imageId: imageId ? String(imageId) : null,
    toolId: toolIdFromRequest(request),
    outputPath: null,
    receiptStep: null,
    error: normalize(error),
    ...(extras && typeof extras === "object" ? extras : {}),
  };
}

async function applySingleImageCapabilityRequest(request = {}, route, host = {}) {
  const activeImageId = typeof host.getActiveImageId === "function" ? host.getActiveImageId() : "";
  const imageId = resolveToolApplyTargetImageId(request, {
    activeImageId,
    hasImageId: host.hasImageId,
    getImageById: host.getImageById,
  });
  const selectedImageIds = resolveSelectedImageIds(request, activeImageId);
  const target = imageId && typeof host.getImageById === "function" ? host.getImageById(imageId) : null;

  const rawCapabilityAvailability = await maybeResolve(host.getCapabilityAvailability, route.capability, {
    route,
    request,
    imageId,
    target,
  });
  const availability = resolveSingleImageCapabilityAvailability(route, {
    activeImageId,
    selectedImageIds,
    busy: await maybeResolve(host.isBusy, {
      route,
      request,
      imageId,
      target,
    }),
    mode:
      (await maybeResolve(host.getExecutionMode, {
        route,
        request,
        imageId,
        target,
      })) ||
      host.mode ||
      host.runtimeMode ||
      "",
    image: target,
    capabilityAvailability:
      rawCapabilityAvailability != null
        ? normalizeCapabilityAvailabilityMap(route.capability, rawCapabilityAvailability)
        : typeof host.executeCapability === "function"
          ? { [route.capability]: true }
          : null,
    capabilityExecutorAvailable: typeof host.executeCapability === "function",
    reasonCodes: route.reasonCodes,
  });

  if (!availability?.enabled) {
    return buildToolApplyFailureResult(
      request,
      new Error(buildSingleImageCapabilityDisabledMessage(route, availability)),
      {
        imageId,
        normalizeErrorMessage: host.normalizeErrorMessage,
        extras: {
          jobId: route.jobId,
          capability: route.capability,
          disabledReason: availability?.disabledReason || "capability_unavailable",
        },
      }
    );
  }

  if (!imageId) {
    return buildToolApplyFailureResult(
      request,
      new Error("Tool apply requires one selected image."),
      {
        imageId,
        normalizeErrorMessage: host.normalizeErrorMessage,
        extras: {
          jobId: route.jobId,
          capability: route.capability,
          disabledReason: "selection_required",
        },
      }
    );
  }

  let applyStarted = false;
  try {
    if (activeImageId && activeImageId !== imageId && typeof host.setActiveImage === "function") {
      await host.setActiveImage(imageId);
    }

    if (!target?.path) {
      throw new Error("Selected image is unavailable for tool apply.");
    }

    if (typeof host.ensureRun === "function") {
      await host.ensureRun();
    }

    if (typeof host.beginApply === "function") {
      await host.beginApply(route, { imageId, target });
      applyStarted = true;
    }

    if (typeof host.executeCapability !== "function") {
      throw new Error("Capability executor is unavailable.");
    }

    const artifact = await host.executeCapability({
      request,
      route,
      imageId,
      target,
      selection: {
        activeImageId: imageId,
        selectedImageIds,
      },
    });

    const outputPath = readFirstString(artifact?.outputPath, artifact?.imagePath);
    if (!outputPath) {
      throw new Error("Capability apply did not produce an output artifact.");
    }

    const result = {
      ok: true,
      imageId: readFirstString(artifact?.imageId, imageId),
      toolId: route.jobId,
      outputPath,
      receiptStep: buildSingleImageCapabilityReceiptStep(route, {
        outputPath,
        receiptPath: artifact?.receiptPath || null,
      }),
      jobId: route.jobId,
      capability: route.capability,
    };

    if (typeof host.afterApply === "function") {
      await host.afterApply({ result, plan: route, artifact, imageId, target });
    }

    return result;
  } catch (error) {
    if (typeof host.reportError === "function") {
      await host.reportError(error, { imageId, plan: route });
    }
    return buildToolApplyFailureResult(request, error, {
      imageId,
      normalizeErrorMessage: host.normalizeErrorMessage,
      extras: {
        jobId: route.jobId,
        capability: route.capability,
      },
    });
  } finally {
    if (applyStarted && typeof host.endApply === "function") {
      await host.endApply();
    }
  }
}

async function applyDeterministicLocalToolRequest(request = {}, host = {}) {
  const plan = buildLocalToolEditPlan(request);
  const activeImageId = typeof host.getActiveImageId === "function" ? host.getActiveImageId() : "";
  const imageId = resolveToolApplyTargetImageId(request, {
    activeImageId,
    hasImageId: host.hasImageId,
    getImageById: host.getImageById,
  });

  if (!plan) {
    return buildToolApplyFailureResult(
      request,
      new Error(`Unsupported tool operation. Supported operations: ${supportedOperationListText()}.`),
      { imageId, normalizeErrorMessage: host.normalizeErrorMessage }
    );
  }

  if (!imageId) {
    return buildToolApplyFailureResult(request, new Error("Tool apply requires one selected image."), {
      imageId,
      normalizeErrorMessage: host.normalizeErrorMessage,
    });
  }

  let applyStarted = false;
  try {
    if (activeImageId && activeImageId !== imageId && typeof host.setActiveImage === "function") {
      await host.setActiveImage(imageId);
    }

    const target = typeof host.getImageById === "function" ? host.getImageById(imageId) : null;
    if (!target?.path) {
      throw new Error("Selected image is unavailable for tool apply.");
    }

    if (typeof host.ensureRun === "function") {
      await host.ensureRun();
    }

    if (typeof host.beginApply === "function") {
      await host.beginApply(plan, { imageId, target });
      applyStarted = true;
    }

    let image = target.img || null;
    if (!image) {
      if (typeof host.loadTargetImage !== "function") {
        throw new Error("Image loader is unavailable for tool apply.");
      }
      image = await host.loadTargetImage(target, imageId);
    }
    if (!image) {
      throw new Error("Failed to load the selected image.");
    }

    const canvas = renderLocalToolEditCanvas(image, plan, {
      createCanvas: host.createCanvas,
    });

    if (typeof host.saveCanvasArtifact !== "function") {
      throw new Error("Artifact writer is unavailable for tool apply.");
    }

    const artifact = await host.saveCanvasArtifact(canvas, {
      imageId,
      operation: `tool_${plan.operation}`,
      label: plan.label,
      meta: {
        source: "tool_runtime",
        tool_id: plan.toolId || null,
        tool_name: plan.toolName || plan.label,
        tool_source: plan.source || null,
        tool_kind: plan.kind || null,
        operation: plan.operation,
        params: {
          ...plan.params,
        },
      },
      replaceActive: true,
      targetId: imageId,
    });

    const outputPath = readFirstString(artifact?.outputPath, artifact?.imagePath);
    if (!outputPath) {
      throw new Error("Tool apply did not produce an output artifact.");
    }

    const result = {
      ok: true,
      imageId: readFirstString(artifact?.imageId, imageId),
      toolId: plan.toolId || null,
      outputPath,
      receiptStep: buildLocalToolReceiptStep(plan, {
        outputPath,
        receiptPath: artifact?.receiptPath || null,
      }),
    };

    if (typeof host.afterApply === "function") {
      await host.afterApply({ result, plan, artifact, imageId, target });
    }

    return result;
  } catch (error) {
    if (typeof host.reportError === "function") {
      await host.reportError(error, { imageId, plan });
    }
    return buildToolApplyFailureResult(request, error, {
      imageId,
      normalizeErrorMessage: host.normalizeErrorMessage,
    });
  } finally {
    if (applyStarted && typeof host.endApply === "function") {
      await host.endApply();
    }
  }
}

export async function applyToolRuntimeRequest(request = {}, host = {}) {
  const capabilityRoute = normalizeSingleImageCapabilityRequest(request);
  if (capabilityRoute) {
    return applySingleImageCapabilityRequest(request, capabilityRoute, host);
  }
  return applyDeterministicLocalToolRequest(request, host);
}

export function dispatchToolApplyBridgeEvent(
  type,
  detail,
  {
    windowObj = typeof window !== "undefined" ? window : null,
    CustomEventCtor = typeof CustomEvent === "function" ? CustomEvent : null,
  } = {}
) {
  if (!windowObj || typeof windowObj.dispatchEvent !== "function") return false;
  if (typeof CustomEventCtor !== "function") return false;
  windowObj.dispatchEvent(new CustomEventCtor(type, { detail }));
  return true;
}

export function installToolApplyBridge({
  windowObj = typeof window !== "undefined" ? window : null,
  CustomEventCtor = typeof CustomEvent === "function" ? CustomEvent : null,
  applyToolRuntimeEdit,
} = {}) {
  if (!windowObj || typeof applyToolRuntimeEdit !== "function") return null;

  const previousHandler = windowObj[TOOL_APPLY_BRIDGE_HANDLER_KEY];
  if (typeof previousHandler === "function" && typeof windowObj.removeEventListener === "function") {
    windowObj.removeEventListener(TOOL_APPLY_BRIDGE_EVENT, previousHandler);
  }

  windowObj.juggernautApplyTool = (request = {}) => applyToolRuntimeEdit(request);
  windowObj.__juggernautApplyTool = windowObj.juggernautApplyTool;

  const handler = async (event) => {
    const result = await applyToolRuntimeEdit(event?.detail || {});
    dispatchToolApplyBridgeEvent(result?.ok ? TOOL_APPLY_BRIDGE_SUCCESS_EVENT : TOOL_APPLY_BRIDGE_FAILURE_EVENT, result, {
      windowObj,
      CustomEventCtor,
    });
    return result;
  };

  windowObj[TOOL_APPLY_BRIDGE_HANDLER_KEY] = handler;
  if (typeof windowObj.addEventListener === "function") {
    windowObj.addEventListener(TOOL_APPLY_BRIDGE_EVENT, handler);
  }
  return {
    handler,
  };
}
