import { getJuggernautRailIconSvg } from "./generated/rail_icon_registry.js";

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

const RAIL_LABELS = Object.freeze({
  upload: "Upload",
  select: "Select",
  cut_out: "Cut Out",
  remove: "Remove",
  new_background: "New Background",
  reframe: "Reframe",
  variants: "Variants",
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

export const SINGLE_IMAGE_RAIL_INVENTORY = Object.freeze([
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
]);

function reframeIconSvg() {
  return `<svg class="tool-icon tool-icon-reframe" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M7 5.4h4.3" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M7 5.4V9.7" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M17 18.6h-4.3" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M17 18.6v-4.3" />
  <rect fill="currentColor" fill-opacity="0.14" x="8.65" y="8.15" width="6.7" height="7.7" rx="1.6" />
  <rect fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" x="8.65" y="8.15" width="6.7" height="7.7" rx="1.6" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M17 5.4h-4.3" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M17 5.4V9.7" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M7 18.6h4.3" />
  <path fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" d="M7 18.6v-4.3" />
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
  return SINGLE_IMAGE_RAIL_INVENTORY.find((item) => item.key === key) || SEEDED_JOB_LIBRARY[key] || null;
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
  if (button.toolId === "upload") return "Upload an image";
  if (button.toolId === "select") return "Select a region on the active image";
  return button.label || button.toolId || "Tool";
}

function buttonMetaAriaLabel(button) {
  if (button.disabledReason) return buttonMetaTitle(button);
  if (button.toolId === "upload") return "Upload image";
  if (button.toolId === "select") return "Select region";
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
      slotKey: "anchor-upload",
      slotKind: "anchor",
      toolId: "upload",
      actionKey: "upload",
      label: "Upload",
      hotkey: buttonHotkey(0),
      disabled: false,
      disabledReason: "",
      selected: false,
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
      running: false,
      iconSvg: railIconSvg("select_subject"),
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
      toolId: job.jobId,
      actionKey: job.jobId,
      label: job.label,
      hotkey: buttonHotkey(index + 2),
      disabled: !job.enabled,
      disabledReason: job.enabled ? "" : normalizeDisabledReason(job.disabledReason),
      selected: false,
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

  return {
    contractName: SINGLE_IMAGE_RAIL_CONTRACT,
    adapter,
    rankedJobs: baseJobs,
    visibleDynamicJobs,
    buttons: anchors.concat(dynamicButtons),
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
}

function syncButtonClasses(toolEl, button) {
  toolEl.className = "tool juggernaut-tool juggernaut-rail-button";
  toolEl.classList.toggle("juggernaut-rail-anchor", button.slotKind === "anchor");
  toolEl.classList.toggle("juggernaut-rail-suggestion", button.slotKind === "dynamic");
  toolEl.classList.toggle("selected", Boolean(button.selected));
  toolEl.classList.toggle("depressed", Boolean(button.running));
}

function syncButtonContent(toolEl, button) {
  const html = `${button.iconSvg}<span class="tool-hint" aria-hidden="true">${button.hotkey}</span>`;
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
  toolEl.addEventListener("click", (event) => {
    const button = toolEl.__juggernautRailButton;
    const onPress = root.__juggernautRailOnPress;
    if (typeof onPress === "function" && button && !button.disabled) {
      onPress(button, event);
    }
  });
  return toolEl;
}

export function renderJuggernautRail(root, { buttons = [], onPress } = {}) {
  if (!root) return;
  root.__juggernautRailOnPress = typeof onPress === "function" ? onPress : null;
  root.dataset.railContract = SINGLE_IMAGE_RAIL_CONTRACT;

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
}

export function getSingleImageRailLabel(toolId = "") {
  return railLabel(toolId);
}
