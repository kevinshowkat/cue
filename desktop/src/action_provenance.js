export const ACTION_PROVENANCE = Object.freeze({
  LOCAL_ONLY: "local_only",
  LOCAL_FIRST: "local_first",
  EXTERNAL_MODEL: "external_model",
});

const ACTION_PROVENANCE_LABELS = Object.freeze({
  [ACTION_PROVENANCE.LOCAL_ONLY]: "Local only",
  [ACTION_PROVENANCE.LOCAL_FIRST]: "Local first",
  [ACTION_PROVENANCE.EXTERNAL_MODEL]: "External model",
});

const ACTION_PROVENANCE_DESCRIPTIONS = Object.freeze({
  [ACTION_PROVENANCE.LOCAL_ONLY]: "Runs locally only.",
  [ACTION_PROVENANCE.LOCAL_FIRST]: "Runs locally first and may use an external model.",
  [ACTION_PROVENANCE.EXTERNAL_MODEL]: "Uses an external model call.",
});

function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedKey(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sentenceJoin(base = "", suffix = "") {
  const head = normalizeText(base);
  const tail = normalizeText(suffix);
  if (!head) return tail;
  if (!tail) return head;
  return /[.!?]$/.test(head) ? `${head} ${tail}` : `${head}. ${tail}`;
}

export function normalizeActionProvenance(value = "", fallback = "") {
  const key = normalizedKey(value);
  if (key === ACTION_PROVENANCE.LOCAL_ONLY) return ACTION_PROVENANCE.LOCAL_ONLY;
  if (key === ACTION_PROVENANCE.LOCAL_FIRST) return ACTION_PROVENANCE.LOCAL_FIRST;
  if (key === ACTION_PROVENANCE.EXTERNAL_MODEL) return ACTION_PROVENANCE.EXTERNAL_MODEL;
  return normalizeText(fallback) ? normalizeActionProvenance(fallback, "") : "";
}

export function resolveActionProvenance({
  provenance = "",
  executionType = "",
  executionKind = "",
  capability = "",
  localUtility = false,
  fallback = ACTION_PROVENANCE.LOCAL_ONLY,
} = {}) {
  const explicit = normalizeActionProvenance(provenance);
  if (explicit) return explicit;

  const normalizedExecutionType = normalizedKey(executionType);
  if (normalizedExecutionType === "local_first") return ACTION_PROVENANCE.LOCAL_FIRST;
  if (normalizedExecutionType === "model_backed") return ACTION_PROVENANCE.EXTERNAL_MODEL;

  const normalizedExecutionKind = normalizedKey(executionKind);
  if (normalizedExecutionKind === "local_edit" || normalizedExecutionKind === "local_manifest_builder") {
    return ACTION_PROVENANCE.LOCAL_ONLY;
  }
  if (normalizedExecutionKind === "model_capability") return ACTION_PROVENANCE.EXTERNAL_MODEL;

  if (localUtility === true) return ACTION_PROVENANCE.LOCAL_ONLY;
  if (normalizeText(capability)) return ACTION_PROVENANCE.EXTERNAL_MODEL;
  return normalizeActionProvenance(fallback, ACTION_PROVENANCE.LOCAL_ONLY);
}

export function actionProvenanceLabel(value = "") {
  const provenance = normalizeActionProvenance(value, ACTION_PROVENANCE.LOCAL_ONLY);
  return ACTION_PROVENANCE_LABELS[provenance] || ACTION_PROVENANCE_LABELS[ACTION_PROVENANCE.LOCAL_ONLY];
}

export function describeActionProvenance(value = "") {
  const provenance = normalizeActionProvenance(value, ACTION_PROVENANCE.LOCAL_ONLY);
  return ACTION_PROVENANCE_DESCRIPTIONS[provenance] || ACTION_PROVENANCE_DESCRIPTIONS[ACTION_PROVENANCE.LOCAL_ONLY];
}

export function appendActionProvenanceDescription(base = "", provenance = "") {
  return sentenceJoin(base, describeActionProvenance(provenance));
}

export function actionProvenanceHasModelCost(value = "") {
  const provenance = normalizeActionProvenance(value, ACTION_PROVENANCE.LOCAL_ONLY);
  return provenance === ACTION_PROVENANCE.LOCAL_FIRST || provenance === ACTION_PROVENANCE.EXTERNAL_MODEL;
}

export function renderActionProvenanceBadge(provenance = "", { className = "" } = {}) {
  const normalized = normalizeActionProvenance(provenance);
  if (!normalized) return "";
  const costBearing = actionProvenanceHasModelCost(normalized);
  if (!costBearing) return "";
  const affordanceClasses = [
    "action-provenance-affordance",
    `action-provenance-affordance--${normalized.replace(/_/g, "-")}`,
    "action-provenance-affordance--cost-bearing",
  ]
    .filter(Boolean)
    .join(" ");
  const dotClasses = [
    "action-provenance-model-dot",
    normalizeText(className),
  ]
    .filter(Boolean)
    .join(" ");
  return `<span class="${affordanceClasses}" data-provenance="${normalized}" aria-hidden="true"><span class="${dotClasses}" data-provenance="${normalized}"></span></span>`;
}
