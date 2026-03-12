import { getJuggernautRailIconSvg } from "./generated/rail_icon_registry.js";
import { buildSingleImageDirectAffordanceInvocation, buildSingleImageRailInvocation } from "../tool_runtime.js";

export const SINGLE_IMAGE_RAIL_CONTRACT = "single-image-rail-v1";
export const SINGLE_IMAGE_RAIL_DYNAMIC_SLOT_COUNT = 3;
export const SINGLE_IMAGE_RAIL_ALLOWED_DISABLED_REASONS = Object.freeze([
  "selection_required",
  "busy",
  "unsupported_image",
  "unavailable_in_current_mode",
  "capability_unavailable",
]);
export const SINGLE_IMAGE_RAIL_MOCK_ADAPTER = Object.freeze({
  id: "single-image-rail-local-mock-v1",
  kind: "local_mock",
  mock: true,
});

const DISABLED_REASON_SET = new Set(SINGLE_IMAGE_RAIL_ALLOWED_DISABLED_REASONS);
const DEFAULT_DYNAMIC_ORDER = Object.freeze([
  "cut_out",
  "remove",
  "new_background",
  "reframe",
  "variants",
]);
const SHELL_DIRECT_AFFORDANCE_ORDER = Object.freeze(["remove_people", "polish", "relight"]);
const COMMUNICATION_TOOL_EVENT = "juggernaut:communication-state-changed";

const RAIL_LABELS = Object.freeze({
  move: "Move",
  upload: "Upload",
  select: "Select",
  cut_out: "Cut Out",
  remove: "Remove",
  new_background: "New Background",
  reframe: "Reframe",
  variants: "Variants",
  protect: "Protect",
  make_space: "Make Space",
  remove_people: "Remove People",
  polish: "Polish",
  relight: "Relight",
});

const SEEDED_JOB_LIBRARY = Object.freeze({
  cut_out: Object.freeze({
    jobId: "cut_out",
    label: "Cut Out",
    capability: "subject_isolation",
    requiresSelection: false,
    stickyKey: "cut_out",
    iconId: "select_subject",
  }),
  remove: Object.freeze({
    jobId: "remove",
    label: "Remove",
    capability: "targeted_remove",
    requiresSelection: true,
    stickyKey: "remove",
    iconId: "cleanup",
  }),
  new_background: Object.freeze({
    jobId: "new_background",
    label: "New Background",
    capability: "background_replace",
    requiresSelection: false,
    stickyKey: "new_background",
    iconId: "background_swap",
  }),
  reframe: Object.freeze({
    jobId: "reframe",
    label: "Reframe",
    capability: "crop_or_outpaint",
    requiresSelection: false,
    stickyKey: "reframe",
    iconId: "reframe",
  }),
  variants: Object.freeze({
    jobId: "variants",
    label: "Variants",
    capability: "identity_preserving_variation",
    requiresSelection: false,
    stickyKey: "variants",
    iconId: "variations",
  }),
});
const SHELL_AFFORDANCE_LIBRARY = Object.freeze({
  protect: Object.freeze({
    jobId: "protect",
    label: "Protect",
    requiresSelection: false,
    iconId: "protect",
    communicationTool: "marker",
    localUtility: true,
  }),
  make_space: Object.freeze({
    jobId: "make_space",
    label: "Make Space",
    requiresSelection: false,
    iconId: "make_space",
    communicationTool: "magic_select",
    localUtility: true,
  }),
  remove_people: Object.freeze({
    jobId: "remove_people",
    label: "Remove People",
    capability: "people_removal",
    requiresSelection: false,
    iconId: "remove_people",
    runtimeJobId: "remove",
    stickyKey: "single-image-direct:remove_people",
    localUtility: false,
  }),
  polish: Object.freeze({
    jobId: "polish",
    label: "Polish",
    capability: "image_polish",
    requiresSelection: false,
    iconId: "polish",
    stickyKey: "single-image-direct:polish",
    localUtility: true,
  }),
  relight: Object.freeze({
    jobId: "relight",
    label: "Relight",
    capability: "image_relight",
    requiresSelection: false,
    iconId: "relight",
    stickyKey: "single-image-direct:relight",
    localUtility: true,
  }),
});

export const SINGLE_IMAGE_RAIL_INVENTORY = Object.freeze([
  Object.freeze({ key: "move", label: "Move", kind: "anchor", requiresSelection: false }),
  Object.freeze({ key: "upload", label: "Upload", kind: "anchor", requiresSelection: false }),
  Object.freeze({ key: "select", label: "Select", kind: "anchor", requiresSelection: false }),
  ...Object.values(SEEDED_JOB_LIBRARY).map((job) =>
    Object.freeze({
      key: job.jobId,
      label: job.label,
      kind: "job",
      capability: job.capability,
      requiresSelection: job.requiresSelection,
      stickyKey: job.stickyKey,
    })
  ),
  ...SHELL_DIRECT_AFFORDANCE_ORDER.map((toolId) => SHELL_AFFORDANCE_LIBRARY[toolId]).map((tool) =>
    Object.freeze({
      key: tool.jobId,
      label: tool.label,
      kind: "affordance",
      capability: tool.capability,
      requiresSelection: tool.requiresSelection,
      stickyKey: tool.stickyKey || tool.jobId,
    })
  ),
]);

function reframeIconSvg() {
  return `<svg class="tool-icon tool-icon-reframe" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <rect fill="currentColor" fill-opacity="0.14" x="8.2" y="7.2" width="7.6" height="8.6" rx="1.7" />
  <rect fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" x="8.2" y="7.2" width="7.6" height="8.6" rx="1.7" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M5.2 8.85V5.6h3.25" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M18.8 8.85V5.6h-3.25" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M5.2 15.15v3.25h3.25" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M18.8 15.15v3.25h-3.25" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M10.65 12l-1.55 1.55 1.55 1.55" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M13.35 15.1l1.55-1.55L13.35 12" />
</svg>`;
}

function railIconSvg(iconId = "") {
  if (iconId === "reframe") return reframeIconSvg();
  return getJuggernautRailIconSvg(iconId);
}

function railLabel(toolId = "") {
  return RAIL_LABELS[String(toolId || "").trim()] || String(toolId || "").trim() || "Tool";
}

export function getSingleImageRailItem(toolId = "") {
  const key = String(toolId || "").trim();
  if (!key) return null;
  return SINGLE_IMAGE_RAIL_INVENTORY.find((item) => item.key === key) || SEEDED_JOB_LIBRARY[key] || SHELL_AFFORDANCE_LIBRARY[key] || null;
}

function normalizeConfidence(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function normalizeReasonCodes(value) {
  return Array.isArray(value)
    ? value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
}

function normalizeDisabledReason(value = "") {
  const key = String(value || "").trim();
  return DISABLED_REASON_SET.has(key) ? key : "";
}

function normalizeRankedJob(raw = {}, index = 0) {
  const sourceId = String(raw?.jobId || "").trim();
  const seed = SEEDED_JOB_LIBRARY[sourceId];
  if (!seed) return null;
  const disabledReason = normalizeDisabledReason(raw?.disabledReason);
  const enabled =
    raw?.enabled === false
      ? false
      : disabledReason
        ? false
        : true;
  return {
    jobId: seed.jobId,
    label: String(raw?.label || seed.label).trim() || seed.label,
    capability: String(raw?.capability || seed.capability).trim() || seed.capability,
    requiresSelection: raw?.requiresSelection == null ? seed.requiresSelection : Boolean(raw.requiresSelection),
    enabled,
    disabledReason: enabled ? "" : disabledReason,
    confidence: normalizeConfidence(raw?.confidence, Math.max(0.2, 0.82 - index * 0.1)),
    reasonCodes: normalizeReasonCodes(raw?.reasonCodes),
    stickyKey: String(raw?.stickyKey || seed.stickyKey || seed.jobId).trim() || seed.jobId,
    iconId: seed.iconId,
    mock: Boolean(raw?.mock),
  };
}

function dynamicPlaceholder(jobId) {
  const seed = SEEDED_JOB_LIBRARY[jobId];
  return {
    jobId: seed.jobId,
    label: seed.label,
    capability: seed.capability,
    requiresSelection: seed.requiresSelection,
    enabled: false,
    disabledReason: "capability_unavailable",
    confidence: 0,
    reasonCodes: ["placeholder"],
    stickyKey: seed.stickyKey,
    iconId: seed.iconId,
    mock: true,
  };
}

function disabledReasonText(reason, label) {
  const name = String(label || "This tool").trim() || "This tool";
  if (reason === "selection_required") return `${name} requires a selection first.`;
  if (reason === "busy") return `${name} is unavailable while another action is running.`;
  if (reason === "unsupported_image") return `${name} is unavailable for the current image.`;
  if (reason === "unavailable_in_current_mode") return `${name} is unavailable in the current mode.`;
  if (reason === "capability_unavailable") return `${name} is scaffolded but not connected yet.`;
  return name;
}

function buttonMetaTitle(button) {
  if (button.disabledReason) return disabledReasonText(button.disabledReason, button.label);
  if (button.toolId === "move") return "Move and arrange images";
  if (button.toolId === "upload") return "Upload an image";
  if (button.toolId === "select") return "Select a region on the active image";
  if (button.toolId === "protect") return "Protect an area from edits";
  if (button.toolId === "make_space") return "Reserve or create room in an area";
  if (button.toolId === "remove_people") return "Remove people from the active image";
  if (button.toolId === "polish") return "Polish the active image";
  if (button.toolId === "relight") return "Relight the active image";
  return button.label || button.toolId || "Tool";
}

function buttonMetaAriaLabel(button) {
  if (button.disabledReason) return buttonMetaTitle(button);
  if (button.toolId === "move") return "Move image";
  if (button.toolId === "upload") return "Upload image";
  if (button.toolId === "select") return "Select region";
  if (button.toolId === "protect") return "Protect region";
  if (button.toolId === "make_space") return "Make space";
  if (button.toolId === "remove_people") return "Remove people";
  return button.label || button.toolId || "Tool";
}

function buttonHotkey(index) {
  return String(index + 1);
}

function buildAnchorButtons({
  hasImage = false,
  activeToolId = "",
} = {}) {
  return [
    {
      slotKey: "anchor-move",
      slotKind: "anchor",
      toolId: "move",
      actionKey: "move",
      label: "Move",
      hotkey: "",
      disabled: false,
      disabledReason: "",
      selected: String(activeToolId || "").trim() === "move",
      toggleable: true,
      running: false,
      iconSvg: railIconSvg("move"),
      title: "Move and arrange images",
      ariaLabel: "Move image",
    },
    {
      slotKey: "anchor-upload",
      slotKind: "anchor",
      toolId: "upload",
      actionKey: "upload",
      label: "Upload",
      hotkey: buttonHotkey(0),
      disabled: false,
      disabledReason: "",
      selected: false,
      toggleable: false,
      running: false,
      iconSvg: railIconSvg("upload"),
      title: "Upload an image",
      ariaLabel: "Upload image",
    },
    {
      slotKey: "anchor-select",
      slotKind: "anchor",
      toolId: "select",
      actionKey: "select",
      label: "Select",
      hotkey: buttonHotkey(1),
      disabled: !hasImage,
      disabledReason: hasImage ? "" : "unavailable_in_current_mode",
      selected: String(activeToolId || "").trim() === "select",
      toggleable: true,
      running: false,
      iconSvg: railIconSvg("select_region"),
      title: hasImage ? "Select a region on the active image" : "Upload an image before selecting",
      ariaLabel: hasImage ? "Select region" : "Upload an image before selecting",
    },
  ];
}

function enabledStateWorsened(previous = {}, next = {}) {
  return Boolean(previous?.enabled) && !Boolean(next?.enabled);
}

function fillDynamicSlots(dynamic = []) {
  const used = new Set(dynamic.map((entry) => entry.jobId));
  const out = dynamic.slice(0, SINGLE_IMAGE_RAIL_DYNAMIC_SLOT_COUNT);
  for (const jobId of DEFAULT_DYNAMIC_ORDER) {
    if (out.length >= SINGLE_IMAGE_RAIL_DYNAMIC_SLOT_COUNT) break;
    if (used.has(jobId)) continue;
    out.push(dynamicPlaceholder(jobId));
    used.add(jobId);
  }
  return out.slice(0, SINGLE_IMAGE_RAIL_DYNAMIC_SLOT_COUNT);
}

function chooseVisibleDynamicJobs({ candidates = [], previousVisibleJobs = [] } = {}) {
  const normalizedCandidates = candidates.filter(Boolean);
  const byStickyKey = new Map(normalizedCandidates.map((entry) => [entry.stickyKey || entry.jobId, entry]));
  const preserved = [];
  const preservedJobIds = new Set();

  for (const previous of Array.isArray(previousVisibleJobs) ? previousVisibleJobs : []) {
    const stickyKey = String(previous?.stickyKey || previous?.jobId || "").trim();
    if (!stickyKey) continue;
    const next = byStickyKey.get(stickyKey);
    if (!next) continue;
    if (enabledStateWorsened(previous, next)) continue;
    if (preservedJobIds.has(next.jobId)) continue;
    preserved.push(next);
    preservedJobIds.add(next.jobId);
    if (preserved.length >= SINGLE_IMAGE_RAIL_DYNAMIC_SLOT_COUNT) break;
  }

  const ordered = preserved.slice();
  const remainingCandidates = normalizedCandidates.filter((candidate) => !preservedJobIds.has(candidate.jobId));
  const prioritizedCandidates = remainingCandidates
    .filter((candidate) => candidate.enabled)
    .concat(remainingCandidates.filter((candidate) => !candidate.enabled));
  for (const candidate of prioritizedCandidates) {
    if (ordered.length >= SINGLE_IMAGE_RAIL_DYNAMIC_SLOT_COUNT) break;
    ordered.push(candidate);
    preservedJobIds.add(candidate.jobId);
  }

  return fillDynamicSlots(ordered);
}

function buildDynamicButtons(dynamicJobs = [], { runningToolId = "" } = {}) {
  return fillDynamicSlots(dynamicJobs).map((job, index) => {
    const button = {
      slotKey: `dynamic-${index}`,
      slotKind: "dynamic",
      groupStart: index === 0,
      toolId: job.jobId,
      actionKey: job.jobId,
      label: job.label,
      hotkey: buttonHotkey(index + 2),
      disabled: !job.enabled,
      disabledReason: job.enabled ? "" : normalizeDisabledReason(job.disabledReason),
      selected: false,
      toggleable: false,
      running: String(runningToolId || "").trim() === job.jobId,
      iconSvg: railIconSvg(job.iconId || job.jobId),
      title: "",
      ariaLabel: "",
      capability: job.capability,
      confidence: job.confidence,
      reasonCodes: job.reasonCodes,
      requiresSelection: job.requiresSelection,
      stickyKey: job.stickyKey,
      mock: Boolean(job.mock),
    };
    button.title = buttonMetaTitle(button);
    button.ariaLabel = buttonMetaAriaLabel(button);
    return button;
  });
}

function browserWindow() {
  return typeof window !== "undefined" && window ? window : null;
}

function currentShellBridge() {
  const win = browserWindow();
  const bridge = win?.__JUGGERNAUT_SHELL__;
  return bridge && typeof bridge === "object" ? bridge : null;
}

function currentShellState() {
  const win = browserWindow();
  const state = win?.__juggernautShellState;
  return state && typeof state === "object" ? state : null;
}

function currentCommunicationState() {
  const bridge = currentShellBridge();
  if (typeof bridge?.communicationReview?.getState === "function") {
    try {
      const state = bridge.communicationReview.getState();
      if (state && typeof state === "object") return state;
    } catch {
      // ignore
    }
  }
  const state = bridge?.communicationReview?.state;
  return state && typeof state === "object" ? state : null;
}

function currentCommunicationToolId() {
  return String(currentCommunicationState()?.tool || "").trim();
}

function currentShellSnapshot() {
  const bridge = currentShellBridge();
  if (typeof bridge?.getCanvasSnapshot === "function") {
    try {
      const snapshot = bridge.getCanvasSnapshot();
      if (snapshot && typeof snapshot === "object") return snapshot;
    } catch {
      // ignore
    }
  }

  const state = currentShellState();
  if (!state) return null;
  const selectedImage = state.selectedImage
    ? {
        id: state.selectedImage.id || state.selectedImageId || null,
        path: state.selectedImage.path || null,
        width: state.selectedImage.width || null,
        height: state.selectedImage.height || null,
        active: true,
        selected: true,
      }
    : null;
  return {
    activeImageId: state.selectedImageId || null,
    selectedImageIds: Array.isArray(state.selectedImageIds) ? state.selectedImageIds.slice(0, 3) : [],
    canvasMode: "single",
    images: selectedImage ? [selectedImage] : [],
  };
}

function normalizeSelectedImageIds(snapshot = {}) {
  const ids = [];
  for (const value of Array.isArray(snapshot?.selectedImageIds) ? snapshot.selectedImageIds : []) {
    const id = String(value || "").trim();
    if (!id || ids.includes(id)) continue;
    ids.push(id);
  }
  const activeId = String(snapshot?.activeImageId || "").trim();
  if (activeId && !ids.includes(activeId)) ids.push(activeId);
  return ids.slice(0, 3);
}

function activeImageFromSnapshot(snapshot = {}) {
  const activeId = String(snapshot?.activeImageId || "").trim();
  const image = (Array.isArray(snapshot?.images) ? snapshot.images : []).find(
    (entry) => String(entry?.id || "").trim() === activeId
  );
  if (!image) return null;
  return {
    id: activeId,
    path: String(image?.path || "").trim() || null,
    width: Number(image?.width) || null,
    height: Number(image?.height) || null,
    supported: true,
  };
}

function directCapabilityAvailability(toolId = "") {
  if (toolId === "remove_people") {
    return {
      people_removal: { available: true },
    };
  }
  if (toolId === "polish") {
    return {
      image_polish: { available: true },
    };
  }
  if (toolId === "relight") {
    return {
      image_relight: { available: true },
    };
  }
  return {};
}

function buildShellAffordanceRuntimeContext({ hasImage = false, busy = false } = {}) {
  const snapshot = currentShellSnapshot() || {};
  const activeImage = activeImageFromSnapshot(snapshot);
  return {
    activeImageId: String(snapshot?.activeImageId || "").trim() || null,
    selectedImageIds: normalizeSelectedImageIds(snapshot),
    mode: String(snapshot?.canvasMode || "").trim() || "single",
    image: activeImage,
    hasImage: Boolean(hasImage && activeImage?.id),
    busy: Boolean(busy),
    applyRuntimeReady: typeof browserWindow()?.juggernautApplyTool === "function",
  };
}

function legacyRemovePeopleInvocation(runtimeContext = {}) {
  return buildSingleImageRailInvocation("remove", {
    activeImageId: runtimeContext.activeImageId,
    selectedImageIds: runtimeContext.selectedImageIds,
    source: "juggernaut_shell_affordance",
    trigger: "click",
    requestId: `juggernaut-shell-remove-people-${Date.now()}`,
    confidence: 1,
    reasonCodes: ["shell_affordance", "canonical_remove_people"],
    busy: runtimeContext.busy,
    mode: runtimeContext.mode,
    image: runtimeContext.image,
    capabilityAvailability: {
      targeted_remove: { available: true },
    },
    capabilityExecutorAvailable: true,
  });
}

function directInvocationForTool(toolId, runtimeContext = {}) {
  if (toolId === "remove_people") {
    return legacyRemovePeopleInvocation(runtimeContext);
  }
  return buildSingleImageDirectAffordanceInvocation(toolId, {
    activeImageId: runtimeContext.activeImageId,
    selectedImageIds: runtimeContext.selectedImageIds,
    source: "juggernaut_shell_affordance",
    trigger: "click",
    requestId: `juggernaut-shell-${toolId}-${Date.now()}`,
    params: {},
    busy: runtimeContext.busy,
    mode: runtimeContext.mode,
    image: runtimeContext.image,
    capabilityAvailability: directCapabilityAvailability(toolId),
    capabilityExecutorAvailable: true,
    localExecutorAvailable: true,
  });
}

function directAffordanceButton(seed, index, { hasImage = false, busy = false } = {}) {
  const runtimeContext = buildShellAffordanceRuntimeContext({ hasImage, busy });
  const disabledReason = !runtimeContext.hasImage
    ? "unavailable_in_current_mode"
    : !runtimeContext.applyRuntimeReady
      ? "capability_unavailable"
      : normalizeDisabledReason(directInvocationForTool(seed.jobId, runtimeContext)?.availability?.disabledReason);
  const button = {
    slotKey: `direct-${index}`,
    slotKind: "direct",
    groupStart: index === 0,
    toolId: seed.jobId,
    actionKey: seed.jobId,
    label: seed.label,
    hotkey: "",
    disabled: Boolean(disabledReason),
    disabledReason: disabledReason || "",
    selected: false,
    toggleable: false,
    running: false,
    iconSvg: railIconSvg(seed.iconId),
    title: "",
    ariaLabel: "",
    capability: seed.capability,
    stickyKey: seed.stickyKey,
    localUtility: Boolean(seed.localUtility),
    invoke: async () => {
      const apply = browserWindow()?.juggernautApplyTool;
      if (typeof apply !== "function") return false;
      return apply(directInvocationForTool(seed.jobId, buildShellAffordanceRuntimeContext({ hasImage: true, busy: false })));
    },
  };
  button.title = buttonMetaTitle(button);
  button.ariaLabel = buttonMetaAriaLabel(button);
  return button;
}

function buildAffordanceButtons({ hasImage = false, busy = false } = {}) {
  const directButtons = SHELL_DIRECT_AFFORDANCE_ORDER.map((toolId, index) =>
    directAffordanceButton(SHELL_AFFORDANCE_LIBRARY[toolId], index, { hasImage, busy })
  );
  return directButtons;
}

export function getSingleImageRailMockRankedJobs({
  hasImage = false,
  hasRegionSelection = false,
  busy = false,
  toolHookReady = false,
} = {}) {
  let order = DEFAULT_DYNAMIC_ORDER.slice();
  if (hasRegionSelection) {
    order = ["remove", "cut_out", "new_background", "reframe", "variants"];
  } else if (hasImage) {
    order = ["cut_out", "new_background", "variants", "reframe", "remove"];
  }

  return order.map((jobId, index) => {
    const seed = SEEDED_JOB_LIBRARY[jobId];
    let enabled = Boolean(hasImage && toolHookReady);
    let disabledReason = "";
    const reasonCodes = ["mock_ranked_job"];

    if (!hasImage) {
      enabled = false;
      disabledReason = "unavailable_in_current_mode";
      reasonCodes.push("no_image");
    } else if (busy) {
      enabled = false;
      disabledReason = "busy";
      reasonCodes.push("busy");
    } else if (!toolHookReady) {
      enabled = false;
      disabledReason = "capability_unavailable";
      reasonCodes.push("tool_hook_missing");
    } else if (seed.requiresSelection && !hasRegionSelection) {
      enabled = false;
      disabledReason = "selection_required";
      reasonCodes.push("selection_missing");
    }

    return normalizeRankedJob(
      {
        jobId: seed.jobId,
        label: seed.label,
        capability: seed.capability,
        requiresSelection: seed.requiresSelection,
        enabled,
        disabledReason,
        confidence: Math.max(0.2, 0.88 - index * 0.12),
        reasonCodes,
        stickyKey: seed.stickyKey,
        mock: true,
      },
      index
    );
  });
}

export function buildSingleImageRailButtons({
  hasImage = false,
  hasRegionSelection = false,
  activeToolId = "",
  runningToolId = "",
  toolHookReady = false,
  busy = false,
  rankedJobs = [],
  previousVisibleJobs = [],
  rerank = true,
  adapter = SINGLE_IMAGE_RAIL_MOCK_ADAPTER,
} = {}) {
  const anchors = buildAnchorButtons({ hasImage, activeToolId });
  const baseJobs = Array.isArray(rankedJobs) && rankedJobs.length
    ? rankedJobs.map((job, index) => normalizeRankedJob(job, index)).filter(Boolean)
    : getSingleImageRailMockRankedJobs({
        hasImage,
        hasRegionSelection,
        busy,
        toolHookReady,
      });

  const visibleDynamicJobs = rerank
    ? chooseVisibleDynamicJobs({
        candidates: baseJobs,
        previousVisibleJobs,
      })
    : fillDynamicSlots(previousVisibleJobs.length ? previousVisibleJobs : baseJobs);
  const dynamicButtons = buildDynamicButtons(visibleDynamicJobs, { runningToolId });
  const affordanceButtons = buildAffordanceButtons({ hasImage, busy });

  return {
    contractName: SINGLE_IMAGE_RAIL_CONTRACT,
    adapter,
    rankedJobs: baseJobs,
    visibleDynamicJobs,
    buttons: anchors.concat(dynamicButtons, affordanceButtons),
  };
}

function setButtonData(toolEl, button) {
  toolEl.dataset.key = String(button.actionKey || button.toolId || "").trim();
  toolEl.dataset.toolId = String(button.toolId || "").trim();
  toolEl.dataset.toolKey = String(button.toolId || "").trim();
  toolEl.dataset.slotKey = String(button.slotKey || "").trim();
  toolEl.dataset.slotKind = String(button.slotKind || "").trim();
  toolEl.dataset.hotkey = String(button.hotkey || "").trim();
  toolEl.dataset.disabledReason = String(button.disabledReason || "").trim();
  toolEl.dataset.capability = String(button.capability || "").trim();
  toolEl.dataset.stickyKey = String(button.stickyKey || "").trim();
  toolEl.dataset.mock = button.mock ? "true" : "false";
  toolEl.dataset.groupStart = button.groupStart ? "true" : "false";
}

function syncButtonClasses(toolEl, button) {
  toolEl.className = "tool juggernaut-tool juggernaut-rail-button";
  toolEl.classList.toggle("juggernaut-rail-anchor", button.slotKind === "anchor");
  toolEl.classList.toggle("juggernaut-rail-suggestion", button.slotKind !== "anchor");
  toolEl.classList.toggle("is-group-start", Boolean(button.groupStart));
  toolEl.classList.toggle("selected", Boolean(button.selected));
  toolEl.classList.toggle("depressed", Boolean(button.running));
  toolEl.classList.toggle("is-local-utility", Boolean(button.localUtility));
}

function syncButtonContent(toolEl, button) {
  const html = `${button.iconSvg}`;
  if (toolEl.__juggernautRailHtml !== html) {
    toolEl.innerHTML = html;
    toolEl.__juggernautRailHtml = html;
  }
}

function ensureRailButton(root, slotKey) {
  const existing = root.querySelector(`button[data-slot-key="${slotKey}"]`);
  if (existing) return existing;
  const toolEl = document.createElement("button");
  toolEl.type = "button";
  toolEl.className = "tool juggernaut-tool juggernaut-rail-button";
  toolEl.addEventListener("pointerdown", (event) => {
    if (Number(event?.button) !== 0) return;
    if (toolEl.disabled) return;
    if (toolEl.__juggernautRailPressReleaseTimer) {
      clearTimeout(toolEl.__juggernautRailPressReleaseTimer);
      toolEl.__juggernautRailPressReleaseTimer = null;
    }
    toolEl.classList.add("is-pressing");
  });
  const scheduleRailPressRelease = (delayMs = 0) => {
    if (toolEl.__juggernautRailPressReleaseTimer) {
      clearTimeout(toolEl.__juggernautRailPressReleaseTimer);
      toolEl.__juggernautRailPressReleaseTimer = null;
    }
    const win = browserWindow();
    if (delayMs > 0 && win && typeof win.setTimeout === "function") {
      toolEl.__juggernautRailPressReleaseTimer = win.setTimeout(() => {
        toolEl.__juggernautRailPressReleaseTimer = null;
        toolEl.classList.remove("is-pressing");
      }, delayMs);
      return;
    }
    toolEl.classList.remove("is-pressing");
  };
  toolEl.addEventListener("pointerup", () => {
    scheduleRailPressRelease(140);
  });
  toolEl.addEventListener("pointercancel", () => {
    scheduleRailPressRelease();
  });
  toolEl.addEventListener("blur", () => {
    scheduleRailPressRelease();
  });
  toolEl.addEventListener("click", (event) => {
    const button = toolEl.__juggernautRailButton;
    if (button && !button.disabled && typeof button.invoke === "function") {
      Promise.resolve(button.invoke({ button, event, root })).catch((error) => {
        console.error("Juggernaut shell affordance failed:", error);
      });
      scheduleRailPressRelease(160);
      return;
    }
    const onPress = root.__juggernautRailOnPress;
    if (typeof onPress === "function" && button && !button.disabled) {
      onPress(button, event);
    }
    scheduleRailPressRelease(160);
  });
  return toolEl;
}

function syncExternalRailState(root) {
  if (!root) return;
  const communicationTool = currentCommunicationToolId();
  for (const button of Array.from(root.querySelectorAll("button[data-tool-id]"))) {
    const toolId = String(button?.dataset?.toolId || "").trim();
    const isSelected =
      (toolId === "protect" && communicationTool === "marker") ||
      (toolId === "make_space" && communicationTool === "magic_select");
    if (toolId === "protect" || toolId === "make_space") {
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    }
  }
}

function bindExternalRailState(root) {
  if (!root || root.__juggernautRailExternalStateBound) return;
  root.__juggernautRailExternalStateBound = true;
  const win = browserWindow();
  if (!win || typeof win.addEventListener !== "function") return;
  const sync = () => syncExternalRailState(root);
  root.__juggernautRailExternalStateSync = sync;
  win.addEventListener(COMMUNICATION_TOOL_EVENT, sync);
}

export function renderJuggernautRail(root, { buttons = [], onPress } = {}) {
  if (!root) return;
  root.__juggernautRailOnPress = typeof onPress === "function" ? onPress : null;
  root.dataset.railContract = SINGLE_IMAGE_RAIL_CONTRACT;
  const chromeRoot = root.closest?.(".juggernaut-shell-chrome");
  if (chromeRoot?.style?.setProperty) {
    chromeRoot.style.setProperty("--jg-primary-rail-button-count", String((Array.isArray(buttons) ? buttons.length : 0) || 0));
  }
  bindExternalRailState(root);

  const nextSlotKeys = new Set();
  let cursor = root.firstElementChild;

  for (const button of Array.isArray(buttons) ? buttons : []) {
    const slotKey = String(button?.slotKey || "").trim();
    if (!slotKey) continue;
    nextSlotKeys.add(slotKey);
    const toolEl = ensureRailButton(root, slotKey);
    toolEl.__juggernautRailButton = button;
    syncButtonClasses(toolEl, button);
    setButtonData(toolEl, button);
    syncButtonContent(toolEl, button);
    toolEl.title = String(button.title || button.label || button.toolId || "").trim();
    toolEl.setAttribute("aria-label", String(button.ariaLabel || button.label || button.toolId || "").trim());
    if (button.toggleable) {
      toolEl.setAttribute("aria-pressed", button.selected ? "true" : "false");
    } else {
      toolEl.removeAttribute("aria-pressed");
    }
    toolEl.disabled = Boolean(button.disabled);

    if (cursor !== toolEl) {
      root.insertBefore(toolEl, cursor || null);
    } else {
      cursor = cursor.nextElementSibling;
    }
    if (cursor === toolEl) cursor = cursor.nextElementSibling;
  }

  for (const child of Array.from(root.children)) {
    const slotKey = String(child?.dataset?.slotKey || "").trim();
    if (!slotKey || nextSlotKeys.has(slotKey)) continue;
    child.remove();
  }
  syncExternalRailState(root);
}

export function getSingleImageRailLabel(toolId = "") {
  return railLabel(toolId);
}
