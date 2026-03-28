import {
  DESIGN_REVIEW_UPLOAD_ANALYSIS_SCHEMA,
  buildUploadAnalysisPrompt,
  parseDesignReviewPlannerResponse,
} from "./design_review_contract.js";

export const DESIGN_REVIEW_UPLOAD_ANALYSIS_CONSENT_KEY = "juggernaut.design_review.upload_analysis_consent.v1";
export const DESIGN_REVIEW_UPLOAD_ANALYSIS_CACHE_KEY = "juggernaut.design_review.upload_analysis_cache.v1";

function clampText(value, maxLen = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
}

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

function uniqueStrings(values = [], { limit = Infinity } = {}) {
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = String(value || "").trim();
    if (!text || out.includes(text)) continue;
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function createFallbackStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
  };
}

function normalizeConsent(raw = "") {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "granted" || value === "denied") return value;
  return "unset";
}

function normalizeCacheRecord(raw = null) {
  const source = asRecord(raw) || {};
  const entries = {};
  for (const [key, value] of Object.entries(source.entries || source)) {
    const hash = String(key || "").trim();
    const record = asRecord(value);
    if (!hash || !record) continue;
    entries[hash] = {
      schemaVersion: DESIGN_REVIEW_UPLOAD_ANALYSIS_SCHEMA,
      hash,
      imagePath: readFirstString(record.imagePath, record.image_path) || null,
      imageId: readFirstString(record.imageId, record.image_id) || null,
      analysisRef: readFirstString(record.analysisRef, record.analysis_ref) || `analysis/${hash}.json`,
      summary: clampText(record.summary, 220) || null,
      subjectTags: uniqueStrings(record.subjectTags || record.subject_tags || [], { limit: 8 }),
      styleTags: uniqueStrings(record.styleTags || record.style_tags || [], { limit: 8 }),
      useCaseTags: uniqueStrings(record.useCaseTags || record.use_case_tags || [], { limit: 8 }),
      actionBiases: uniqueStrings(record.actionBiases || record.action_biases || [], { limit: 8 }),
      regionHints: Array.isArray(record.regionHints || record.region_hints)
        ? (record.regionHints || record.region_hints).filter((entry) => entry && typeof entry === "object").map((entry) => ({ ...entry }))
        : [],
      createdAt: readFirstString(record.createdAt, record.created_at) || null,
      updatedAt: readFirstString(record.updatedAt, record.updated_at) || null,
    };
  }
  return entries;
}

function parseCacheJson(raw = "") {
  try {
    const parsed = JSON.parse(String(raw || ""));
    return normalizeCacheRecord(parsed);
  } catch {
    return {};
  }
}

export function createUploadAnalysisCacheStore(storage = null) {
  const adapter = storage && typeof storage.getItem === "function" && typeof storage.setItem === "function" ? storage : createFallbackStorage();
  const readCache = () => parseCacheJson(adapter.getItem(DESIGN_REVIEW_UPLOAD_ANALYSIS_CACHE_KEY));
  const writeCache = (entries) => {
    adapter.setItem(DESIGN_REVIEW_UPLOAD_ANALYSIS_CACHE_KEY, JSON.stringify({ entries }));
    return entries;
  };
  return {
    getConsent() {
      return normalizeConsent(adapter.getItem(DESIGN_REVIEW_UPLOAD_ANALYSIS_CONSENT_KEY));
    },
    setConsent(value) {
      const normalized = normalizeConsent(value);
      adapter.setItem(DESIGN_REVIEW_UPLOAD_ANALYSIS_CONSENT_KEY, normalized);
      return normalized;
    },
    readCache,
    writeCache,
    get(hash) {
      const entries = readCache();
      return entries[String(hash || "").trim()] || null;
    },
    put(hash, value) {
      const normalizedHash = String(hash || "").trim();
      if (!normalizedHash) return null;
      const entries = readCache();
      entries[normalizedHash] = {
        schemaVersion: DESIGN_REVIEW_UPLOAD_ANALYSIS_SCHEMA,
        hash: normalizedHash,
        ...(entries[normalizedHash] || {}),
        ...(value && typeof value === "object" ? value : {}),
        analysisRef:
          readFirstString(value?.analysisRef, value?.analysis_ref, entries[normalizedHash]?.analysisRef) || `analysis/${normalizedHash}.json`,
        updatedAt: new Date().toISOString(),
      };
      if (!entries[normalizedHash].createdAt) entries[normalizedHash].createdAt = entries[normalizedHash].updatedAt;
      writeCache(entries);
      return { ...entries[normalizedHash] };
    },
  };
}

function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(bytes) {
  const cryptoApi = globalThis.crypto?.subtle;
  if (!cryptoApi || typeof cryptoApi.digest !== "function") {
    throw new Error("WebCrypto digest is unavailable.");
  }
  const digest = await cryptoApi.digest("SHA-256", bytes);
  return bufferToHex(digest);
}

export async function createImageHashKey({ imageBytes = null, imagePath = "" } = {}) {
  if (imageBytes instanceof Uint8Array) {
    return sha256Hex(imageBytes);
  }
  const path = readFirstString(imagePath);
  if (!path) throw new Error("createImageHashKey requires image bytes or an image path.");
  const encoder = new TextEncoder();
  return sha256Hex(encoder.encode(path));
}

export function normalizeUploadAnalysisResult(raw = {}, { hash = null, imagePath = null, imageId = null } = {}) {
  let source = asRecord(raw) || {};
  const hasStructuredFields = Boolean(
    source.summary ||
      source.caption ||
      source.description ||
      source.subjectTags ||
      source.subject_tags ||
      source.styleTags ||
      source.style_tags
  );
  if (!hasStructuredFields) {
    try {
      const parsed = JSON.parse(String(raw?.text || raw?.outputText || raw || ""));
      source = asRecord(parsed) || {};
    } catch {
      source = asRecord(raw) || {};
    }
  }
  const proposalParse = parseDesignReviewPlannerResponse(JSON.stringify(source.proposals ? source : { proposals: [] }), {
    requestId: "upload-analysis-normalize",
    primaryImageId: imageId,
    slotCount: 3,
  });
  const regionHints =
    Array.isArray(source.regionHints || source.region_hints)
      ? (source.regionHints || source.region_hints).filter((entry) => entry && typeof entry === "object")
      : proposalParse.proposals
          .filter((proposal) => proposal?.targetRegion?.bounds || proposal?.targetRegion?.regionCandidateId)
          .map((proposal) => ({
            label: proposal.label,
            reason: proposal.why,
            bounds: proposal.targetRegion?.bounds || null,
          }));
  return {
    schemaVersion: DESIGN_REVIEW_UPLOAD_ANALYSIS_SCHEMA,
    hash: readFirstString(hash, source.hash) || null,
    imagePath: readFirstString(imagePath, source.imagePath, source.image_path) || null,
    imageId: readFirstString(imageId, source.imageId, source.image_id) || null,
    analysisRef: readFirstString(source.analysisRef, source.analysis_ref, hash ? `analysis/${hash}.json` : "") || null,
    summary: clampText(source.summary || source.caption || source.description, 220) || null,
    subjectTags: uniqueStrings(source.subjectTags || source.subject_tags || [], { limit: 8 }),
    styleTags: uniqueStrings(source.styleTags || source.style_tags || [], { limit: 8 }),
    useCaseTags: uniqueStrings(source.useCaseTags || source.use_case_tags || [], { limit: 8 }),
    actionBiases: uniqueStrings(source.actionBiases || source.action_biases || [], { limit: 8 }),
    regionHints: regionHints.map((entry) => ({ ...entry })),
    createdAt: readFirstString(source.createdAt, source.created_at) || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function scheduleOpportunisticUploadAnalysis({
  image = {},
  consent = null,
  cacheStore = null,
  hashImage = null,
  analyzeImage = null,
  inFlightByHash = null,
  onUpdate = null,
} = {}) {
  const normalizedConsent = normalizeConsent(
    consent == null ? cacheStore?.getConsent?.() : consent
  );
  if (normalizedConsent !== "granted") {
    return {
      started: false,
      status: normalizedConsent === "denied" ? "denied" : "consent_required",
      hash: null,
      promise: Promise.resolve(null),
    };
  }
  if (typeof analyzeImage !== "function") {
    return {
      started: false,
      status: "analyzer_unavailable",
      hash: null,
      promise: Promise.resolve(null),
    };
  }
  const imageRecord = asRecord(image) || {};
  const hash =
    typeof hashImage === "function"
      ? await hashImage(imageRecord)
      : await createImageHashKey({
          imageBytes: imageRecord.bytes || null,
          imagePath: imageRecord.path || imageRecord.imagePath || "",
        });
  const cached = cacheStore?.get ? cacheStore.get(hash) : null;
  if (cached) {
    return {
      started: false,
      status: "cached",
      hash,
      promise: Promise.resolve(cached),
    };
  }
  const sharedInFlight =
    inFlightByHash instanceof Map ? inFlightByHash.get(hash) || null : null;
  if (sharedInFlight) {
    return {
      started: false,
      status: "in_flight",
      hash,
      promise: sharedInFlight,
    };
  }
  const promise = Promise.resolve()
    .then(() =>
      analyzeImage({
        image: imageRecord,
        prompt: buildUploadAnalysisPrompt({
          imageId: imageRecord.id || imageRecord.imageId,
          imagePath: imageRecord.path || imageRecord.imagePath,
        }),
        hash,
      })
    )
    .then((result) => {
      const normalized = normalizeUploadAnalysisResult(result, {
        hash,
        imagePath: imageRecord.path || imageRecord.imagePath || null,
        imageId: imageRecord.id || imageRecord.imageId || null,
      });
      const stored = cacheStore?.put ? cacheStore.put(hash, normalized) : normalized;
      if (typeof onUpdate === "function") onUpdate(stored);
      return stored;
    })
    .catch((error) => {
      const failure = {
        schemaVersion: DESIGN_REVIEW_UPLOAD_ANALYSIS_SCHEMA,
        hash,
        imagePath: readFirstString(imageRecord.path, imageRecord.imagePath) || null,
        imageId: readFirstString(imageRecord.id, imageRecord.imageId) || null,
        analysisRef: `analysis/${hash}.json`,
        error: clampText(error?.message || error || "upload_analysis_failed", 220),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (typeof onUpdate === "function") onUpdate(failure);
      return failure;
    })
    .finally(() => {
      if (inFlightByHash instanceof Map) {
        inFlightByHash.delete(hash);
      }
    });
  if (inFlightByHash instanceof Map) {
    inFlightByHash.set(hash, promise);
  }
  return {
    started: true,
    status: "queued",
    hash,
    promise,
  };
}

function imageWarmupKey(image = {}) {
  return readFirstString(image?.path, image?.imagePath, image?.id, image?.imageId);
}

export function createUploadAnalysisWarmupController({
  cacheStore = null,
  hashImage = null,
  analyzeImage = null,
  onUpdate = null,
} = {}) {
  const warmedImageKeys = new Set();
  const inFlightByHash = new Map();

  return {
    get warmedImageKeys() {
      return new Set(warmedImageKeys);
    },
    reset() {
      warmedImageKeys.clear();
      inFlightByHash.clear();
    },
    async warmImages(images = [], { consent = null } = {}) {
      const scheduled = [];
      for (const image of Array.isArray(images) ? images : []) {
        const imageKey = imageWarmupKey(image);
        if (!imageKey || warmedImageKeys.has(imageKey)) continue;
        const next = await scheduleOpportunisticUploadAnalysis({
          image,
          consent,
          cacheStore,
          hashImage,
          analyzeImage,
          inFlightByHash,
          onUpdate,
        });
        if (
          next?.started ||
          next?.status === "cached" ||
          next?.status === "in_flight"
        ) {
          warmedImageKeys.add(imageKey);
        }
        scheduled.push(next);
      }
      return scheduled;
    },
  };
}
