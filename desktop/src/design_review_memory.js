import { DESIGN_REVIEW_ACCOUNT_MEMORY_SCHEMA } from "./design_review_contract.js";

export const DESIGN_REVIEW_ACCOUNT_MEMORY_STORAGE_KEY = "juggernaut.design_review.account_memory.v1";

function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

function clampText(value, maxLen = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
}

function toMapRecord(raw = {}) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const [key, value] of Object.entries(source)) {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) continue;
    const numeric = Math.max(0, Number(value) || 0);
    if (!numeric) continue;
    out[normalizedKey] = numeric;
  }
  return out;
}

function normalizePatternList(raw = []) {
  const out = [];
  const seen = new Set();
  for (const entry of Array.isArray(raw) ? raw : []) {
    const label =
      typeof entry === "string"
        ? clampText(entry, 96)
        : clampText(entry?.label || entry?.value || entry?.pattern, 96);
    if (!label) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({
      label,
      count: Math.max(1, Number(entry?.count) || 1),
    });
  }
  return out;
}

function freshMemory() {
  return {
    schemaVersion: DESIGN_REVIEW_ACCOUNT_MEMORY_SCHEMA,
    updatedAt: null,
    acceptedActionTypes: {},
    preferredStylePatterns: [],
    preferredUseCasePatterns: [],
  };
}

export function createDesignReviewMemoryStore({
  getItem = null,
  setItem = null,
} = {}) {
  const fallback = new Map();
  return {
    getItem(key) {
      if (typeof getItem === "function") return getItem(key);
      return fallback.has(key) ? fallback.get(key) : null;
    },
    setItem(key, value) {
      if (typeof setItem === "function") return setItem(key, value);
      fallback.set(key, value);
      return true;
    },
  };
}

export function readDesignReviewAccountMemory(store = null) {
  const raw = store?.getItem ? store.getItem(DESIGN_REVIEW_ACCOUNT_MEMORY_STORAGE_KEY) : null;
  if (!raw) return freshMemory();
  try {
    const parsed = JSON.parse(String(raw));
    return {
      schemaVersion: DESIGN_REVIEW_ACCOUNT_MEMORY_SCHEMA,
      updatedAt: parsed?.updatedAt ? String(parsed.updatedAt) : null,
      acceptedActionTypes: toMapRecord(parsed?.acceptedActionTypes),
      preferredStylePatterns: normalizePatternList(parsed?.preferredStylePatterns),
      preferredUseCasePatterns: normalizePatternList(parsed?.preferredUseCasePatterns),
    };
  } catch {
    return freshMemory();
  }
}

export function writeDesignReviewAccountMemory(store = null, memory = null) {
  if (!store?.setItem) return freshMemory();
  const normalized = {
    schemaVersion: DESIGN_REVIEW_ACCOUNT_MEMORY_SCHEMA,
    updatedAt: memory?.updatedAt ? String(memory.updatedAt) : new Date().toISOString(),
    acceptedActionTypes: toMapRecord(memory?.acceptedActionTypes),
    preferredStylePatterns: normalizePatternList(memory?.preferredStylePatterns),
    preferredUseCasePatterns: normalizePatternList(memory?.preferredUseCasePatterns),
  };
  store.setItem(DESIGN_REVIEW_ACCOUNT_MEMORY_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function incrementMapValue(record = {}, key = "", amount = 1) {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return { ...record };
  const next = { ...record };
  next[normalizedKey] = Math.max(0, Number(next[normalizedKey]) || 0) + Math.max(1, Number(amount) || 1);
  return next;
}

function incrementPatternBucket(list = [], label = "", amount = 1) {
  const normalizedLabel = clampText(label, 96);
  if (!normalizedLabel) return list.slice();
  const next = normalizePatternList(list);
  const existing = next.find((entry) => entry.label === normalizedLabel);
  if (existing) {
    existing.count += Math.max(1, Number(amount) || 1);
    return next;
  }
  next.push({
    label: normalizedLabel,
    count: Math.max(1, Number(amount) || 1),
  });
  return next;
}

export function summarizeDesignReviewAccountMemory(memory = null, { limit = 3, memoryRef = null } = {}) {
  const normalized = {
    ...freshMemory(),
    ...(memory && typeof memory === "object" ? memory : {}),
    acceptedActionTypes: toMapRecord(memory?.acceptedActionTypes),
    preferredStylePatterns: normalizePatternList(memory?.preferredStylePatterns),
    preferredUseCasePatterns: normalizePatternList(memory?.preferredUseCasePatterns),
  };
  const orderedActions = Object.entries(normalized.acceptedActionTypes)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, clamp(limit, 1, 6))
    .map(([actionType, count]) => ({ actionType, count }));
  const orderedStyles = normalized.preferredStylePatterns
    .slice()
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, clamp(limit, 1, 6));
  const orderedUseCases = normalized.preferredUseCasePatterns
    .slice()
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, clamp(limit, 1, 6));
  return {
    schemaVersion: DESIGN_REVIEW_ACCOUNT_MEMORY_SCHEMA,
    memoryRef: memoryRef || "memory/account_bias_v1.json",
    acceptedActionTypes: orderedActions,
    preferredStylePatterns: orderedStyles,
    preferredUseCasePatterns: orderedUseCases,
  };
}

export function recordAcceptedDesignReviewProposal(store = null, proposal = {}, { stylePatterns = [], useCasePatterns = [] } = {}) {
  const current = readDesignReviewAccountMemory(store);
  const actionType = String(proposal?.actionType || proposal?.action_type || "").trim();
  const next = {
    schemaVersion: DESIGN_REVIEW_ACCOUNT_MEMORY_SCHEMA,
    updatedAt: new Date().toISOString(),
    acceptedActionTypes: actionType ? incrementMapValue(current.acceptedActionTypes, actionType, 1) : { ...current.acceptedActionTypes },
    preferredStylePatterns: normalizePatternList(current.preferredStylePatterns),
    preferredUseCasePatterns: normalizePatternList(current.preferredUseCasePatterns),
  };
  for (const label of Array.isArray(stylePatterns) ? stylePatterns : []) {
    next.preferredStylePatterns = incrementPatternBucket(next.preferredStylePatterns, label, 1);
  }
  for (const label of Array.isArray(useCasePatterns) ? useCasePatterns : []) {
    next.preferredUseCasePatterns = incrementPatternBucket(next.preferredUseCasePatterns, label, 1);
  }
  return writeDesignReviewAccountMemory(store, next);
}

function tokenSetFromStrings(values = []) {
  const tokens = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const normalized = String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]+/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3);
    for (const token of normalized) tokens.add(token);
  }
  return tokens;
}

export function applyDesignReviewAccountMemoryBias(proposals = [], summary = null) {
  const memorySummary = summary && typeof summary === "object" ? summary : summarizeDesignReviewAccountMemory(null);
  const actionWeights = new Map(
    (Array.isArray(memorySummary.acceptedActionTypes) ? memorySummary.acceptedActionTypes : []).map((entry) => [
      String(entry?.actionType || "").trim(),
      Math.max(0, Number(entry?.count) || 0),
    ])
  );
  const styleTokens = tokenSetFromStrings(
    (Array.isArray(memorySummary.preferredStylePatterns) ? memorySummary.preferredStylePatterns : []).map((entry) => entry?.label)
  );
  const useCaseTokens = tokenSetFromStrings(
    (Array.isArray(memorySummary.preferredUseCasePatterns) ? memorySummary.preferredUseCasePatterns : []).map((entry) => entry?.label)
  );

  return (Array.isArray(proposals) ? proposals : [])
    .map((proposal, index) => {
      const actionType = String(proposal?.actionType || "").trim();
      const text = `${proposal?.label || ""} ${proposal?.why || ""} ${proposal?.previewBrief || ""}`.toLowerCase();
      let bias = 0;
      if (actionWeights.has(actionType)) {
        bias += Math.min(0.24, (actionWeights.get(actionType) || 0) * 0.06);
      }
      for (const token of styleTokens) {
        if (text.includes(token)) bias += 0.02;
      }
      for (const token of useCaseTokens) {
        if (text.includes(token)) bias += 0.02;
      }
      return {
        ...proposal,
        memoryBias: Number(bias.toFixed(4)),
        rank: Math.max(1, Number(proposal?.rank) || index + 1),
      };
    })
    .sort((a, b) => {
      const aScore = (1 - Math.min(0.99, (a.rank - 1) * 0.08)) + (a.memoryBias || 0);
      const bScore = (1 - Math.min(0.99, (b.rank - 1) * 0.08)) + (b.memoryBias || 0);
      if (bScore !== aScore) return bScore - aScore;
      return (a.rank || 0) - (b.rank || 0);
    })
    .map((proposal, index) => ({
      ...proposal,
      rank: index + 1,
    }));
}
