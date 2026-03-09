import { convertFileSrc } from "@tauri-apps/api/tauri";
import { exists, readBinaryFile, readTextFile, writeBinaryFile } from "@tauri-apps/api/fs";
import { join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/tauri";

import { buildDesignReviewRequest } from "./design_review_contract.js";
import {
  createDesignReviewMemoryStore,
  readDesignReviewAccountMemory,
  summarizeDesignReviewAccountMemory,
} from "./design_review_memory.js";
import { createDesignReviewPipeline } from "./design_review_pipeline.js";
import { createDesignReviewProviderRouter } from "./design_review_provider_router.js";
import {
  createImageHashKey,
  createUploadAnalysisCacheStore,
} from "./design_review_upload_analysis.js";
import { invokeDesignReviewProviderRequest } from "./design_review_backend.js";

const REVIEW_TRAY_ID = "design-review-tray";
const REVIEW_CONSENT_ID = "design-review-consent";
const REVIEW_STYLE_ID = "design-review-style";
const VISUAL_PROMPT_FILENAME = "visual_prompt.json";
const REVIEW_STATE_EVENT = "juggernaut:design-review-state";
const REVIEW_ACCEPT_EVENT = "juggernaut:design-review-accept";
const REVIEW_UPLOAD_ANALYSIS_EVENT = "juggernaut:upload-analysis-updated";

function browserStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore access failures.
  }
  const fallback = new Map();
  return {
    getItem(key) {
      return fallback.has(key) ? fallback.get(key) : null;
    },
    setItem(key, value) {
      fallback.set(key, value);
    },
  };
}

function clampText(value, maxLen = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
}

function shellSnapshot() {
  const shell = typeof window !== "undefined" ? window.__JUGGERNAUT_SHELL__ : null;
  if (!shell || typeof shell.getCanvasSnapshot !== "function") return null;
  try {
    return shell.getCanvasSnapshot();
  } catch {
    return null;
  }
}

async function hashImageRecord(image = {}, pathHashCache = new Map()) {
  const path = String(image?.path || image?.imagePath || "").trim();
  if (!path) return null;
  if (pathHashCache.has(path)) return pathHashCache.get(path);
  const bytes = await readBinaryFile(path);
  const hash = await createImageHashKey({
    imageBytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
  });
  pathHashCache.set(path, hash);
  return hash;
}

async function lookupCachedAnalyses(images = [], uploadAnalysisCache = null, pathHashCache = null) {
  const out = [];
  for (const image of Array.isArray(images) ? images : []) {
    try {
      const hash = await hashImageRecord(image, pathHashCache);
      if (!hash) continue;
      const cached = uploadAnalysisCache?.get ? uploadAnalysisCache.get(hash) : null;
      if (cached) out.push(cached);
    } catch {
      // Ignore per-image lookup failures so review can proceed.
    }
  }
  return out;
}

async function readVisualPrompt(runDir = "") {
  const normalizedRunDir = String(runDir || "").trim();
  if (!normalizedRunDir) return null;
  try {
    const filePath = await join(normalizedRunDir, VISUAL_PROMPT_FILENAME);
    if (!(await exists(filePath))) return null;
    return JSON.parse(await readTextFile(filePath));
  } catch {
    return null;
  }
}

async function captureVisibleCanvasRef(runDir = "") {
  const normalizedRunDir = String(runDir || "").trim();
  if (!normalizedRunDir) return null;
  const canvases = [
    document.getElementById("work-canvas"),
    document.getElementById("effects-canvas"),
    document.getElementById("overlay-canvas"),
  ].filter(Boolean);
  const source = canvases.find((canvas) => Number(canvas?.width) > 0 && Number(canvas?.height) > 0);
  if (!source) return null;
  const composite = document.createElement("canvas");
  composite.width = source.width;
  composite.height = source.height;
  const ctx = composite.getContext("2d");
  if (!ctx) return null;
  for (const canvas of canvases) {
    if (!canvas || !canvas.width || !canvas.height) continue;
    ctx.drawImage(canvas, 0, 0, composite.width, composite.height);
  }
  const blob = await new Promise((resolve) => composite.toBlob(resolve, "image/png"));
  if (!blob) return null;
  const buffer = await blob.arrayBuffer();
  const outputPath = await join(normalizedRunDir, `design-review-visible-${Date.now()}.png`);
  await writeBinaryFile(outputPath, new Uint8Array(buffer));
  return outputPath;
}

function ensureReviewStyle() {
  if (document.getElementById(REVIEW_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = REVIEW_STYLE_ID;
  style.textContent = `
#${REVIEW_TRAY_ID} {
  position: fixed;
  top: 78px;
  right: 22px;
  width: min(380px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border-radius: 22px;
  border: 1px solid rgba(244, 193, 88, 0.28);
  background:
    linear-gradient(180deg, rgba(24, 29, 35, 0.96), rgba(13, 16, 21, 0.94)),
    radial-gradient(circle at top right, rgba(244, 193, 88, 0.18), transparent 42%);
  box-shadow: 0 20px 52px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(18px);
  color: rgba(244, 247, 250, 0.96);
  z-index: 110;
}
#${REVIEW_TRAY_ID}.hidden,
#${REVIEW_CONSENT_ID}.hidden {
  display: none !important;
}
.design-review-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.design-review-title {
  font-size: 13px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(244, 193, 88, 0.92);
}
.design-review-meta {
  font-size: 11px;
  color: rgba(194, 202, 212, 0.72);
}
.design-review-close,
.design-review-action,
.design-review-consent button {
  border: 0;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
}
.design-review-close {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(244, 247, 250, 0.88);
}
.design-review-slots {
  display: grid;
  gap: 10px;
}
.design-review-slot {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 12px;
  padding: 10px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.035);
}
.design-review-thumb {
  width: 88px;
  height: 88px;
  border-radius: 12px;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(34, 44, 58, 0.95), rgba(17, 21, 28, 0.9)),
    radial-gradient(circle at 30% 20%, rgba(244, 193, 88, 0.22), transparent 48%);
  position: relative;
}
.design-review-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.design-review-thumb::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  pointer-events: none;
}
.design-review-thumb.is-skeleton::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.12), transparent);
  transform: translateX(-100%);
  animation: design-review-shimmer 1.3s linear infinite;
}
.design-review-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.design-review-status {
  align-self: flex-start;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(238, 242, 247, 0.78);
}
.design-review-slot[data-status="ready"] .design-review-status {
  background: rgba(104, 211, 145, 0.16);
  color: rgba(166, 245, 193, 0.96);
}
.design-review-slot[data-status="failed"] .design-review-status {
  background: rgba(255, 116, 116, 0.18);
  color: rgba(255, 196, 196, 0.96);
}
.design-review-label {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
}
.design-review-why,
.design-review-error {
  font-size: 12px;
  line-height: 1.45;
  color: rgba(214, 222, 231, 0.78);
}
.design-review-error {
  color: rgba(255, 196, 196, 0.92);
}
.design-review-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.design-review-action {
  background: rgba(244, 193, 88, 0.16);
  color: rgba(255, 230, 179, 0.98);
}
.design-review-consent {
  position: fixed;
  top: 124px;
  right: 22px;
  width: min(340px, calc(100vw - 32px));
  padding: 14px;
  border-radius: 18px;
  background: rgba(14, 18, 23, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.24);
  color: rgba(235, 240, 246, 0.92);
  z-index: 111;
}
.design-review-consent-copy {
  font-size: 12px;
  line-height: 1.45;
  color: rgba(214, 222, 231, 0.84);
  margin-bottom: 10px;
}
.design-review-consent-actions {
  display: flex;
  gap: 8px;
}
.design-review-consent-allow {
  background: rgba(104, 211, 145, 0.18);
  color: rgba(175, 246, 197, 0.98);
}
.design-review-consent-deny {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(235, 240, 246, 0.9);
}
@keyframes design-review-shimmer {
  100% {
    transform: translateX(100%);
  }
}
`;
  document.head.appendChild(style);
}

function ensureTrayUi() {
  ensureReviewStyle();
  let root = document.getElementById(REVIEW_TRAY_ID);
  if (root) return root;
  root = document.createElement("section");
  root.id = REVIEW_TRAY_ID;
  root.className = "hidden";
  root.innerHTML = `
    <div class="design-review-head">
      <div>
        <div class="design-review-title">Design Review</div>
        <div class="design-review-meta" id="design-review-meta">Idle</div>
      </div>
      <button type="button" class="design-review-close" data-design-review-close="1">Close</button>
    </div>
    <div class="design-review-slots" id="design-review-slots"></div>
  `;
  document.body.appendChild(root);
  root.querySelector("[data-design-review-close]")?.addEventListener("click", () => {
    root.classList.add("hidden");
  });
  return root;
}

function ensureConsentUi() {
  ensureReviewStyle();
  let root = document.getElementById(REVIEW_CONSENT_ID);
  if (root) return root;
  root = document.createElement("section");
  root.id = REVIEW_CONSENT_ID;
  root.className = "design-review-consent hidden";
  root.innerHTML = `
    <div class="design-review-title">Cloud Analysis</div>
    <div class="design-review-consent-copy">
      Allow background upload analysis to improve review ranking and region hints. This is opportunistic only and never blocks Design review.
    </div>
    <div class="design-review-consent-actions">
      <button type="button" class="design-review-consent-allow" data-review-consent="allow">Allow</button>
      <button type="button" class="design-review-consent-deny" data-review-consent="deny">Not Now</button>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function slotStatusLabel(status = "") {
  if (status === "ready") return "Ready";
  if (status === "failed") return "Failed";
  if (status === "preview_running") return "Rendering";
  if (status === "preview_pending") return "Queued";
  if (status === "planning") return "Planning";
  return "Loading";
}

function renderTrayState(state = {}, onAccept = null) {
  const tray = ensureTrayUi();
  const meta = tray.querySelector("#design-review-meta");
  const slotsRoot = tray.querySelector("#design-review-slots");
  if (!slotsRoot) return;
  const slots = Array.isArray(state?.slots) ? state.slots : [];
  if (!slots.length && String(state?.status || "idle") === "idle") {
    tray.classList.add("hidden");
    return;
  }
  tray.classList.remove("hidden");
  if (meta) {
    meta.textContent = state?.request?.primaryImageId
      ? `${String(state.status || "idle").replace(/_/g, " ")} · ${state.request.primaryImageId}`
      : String(state?.status || "idle").replace(/_/g, " ");
  }
  slotsRoot.innerHTML = "";
  for (const slot of slots) {
    const card = document.createElement("article");
    card.className = "design-review-slot";
    card.dataset.status = String(slot?.status || "skeleton");
    const thumb = document.createElement("div");
    thumb.className = `design-review-thumb${slot?.status === "ready" ? "" : " is-skeleton"}`;
    if (slot?.outputPreviewRef) {
      const img = document.createElement("img");
      img.src = convertFileSrc(slot.outputPreviewRef);
      img.alt = "";
      thumb.classList.remove("is-skeleton");
      thumb.appendChild(img);
    }
    const copy = document.createElement("div");
    copy.className = "design-review-copy";
    const status = document.createElement("div");
    status.className = "design-review-status";
    status.textContent = slotStatusLabel(slot?.status);
    const label = document.createElement("div");
    label.className = "design-review-label";
    label.textContent = clampText(slot?.proposal?.label || `Proposal ${slot?.rank || 1}`, 92);
    const why = document.createElement("div");
    why.className = slot?.error ? "design-review-error" : "design-review-why";
    why.textContent = clampText(slot?.error || slot?.proposal?.why || "Preparing action-first review preview.", 220);
    copy.appendChild(status);
    copy.appendChild(label);
    copy.appendChild(why);
    if (slot?.proposal && (slot?.status === "ready" || slot?.status === "failed")) {
      const actions = document.createElement("div");
      actions.className = "design-review-actions";
      const accept = document.createElement("button");
      accept.type = "button";
      accept.className = "design-review-action";
      accept.textContent = slot?.status === "ready" ? "Apply via Runtime" : "Accept Intent";
      accept.addEventListener("click", () => {
        if (typeof onAccept === "function") onAccept(slot.proposal);
      });
      actions.appendChild(accept);
      copy.appendChild(actions);
    }
    card.appendChild(thumb);
    card.appendChild(copy);
    slotsRoot.appendChild(card);
  }
}

export async function installDesignReviewBootstrap() {
  if (typeof window === "undefined" || window.__JUGGERNAUT_REVIEW__) return window.__JUGGERNAUT_REVIEW__ || null;

  const storage = browserStorage();
  const memoryStore = createDesignReviewMemoryStore({
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => storage.setItem(key, value),
  });
  const uploadAnalysisCache = createUploadAnalysisCacheStore(storage);
  const providerRouter = createDesignReviewProviderRouter({
    requestProvider: invokeDesignReviewProviderRequest,
    getKeyStatus: () => invoke("get_key_status"),
  });
  const pathHashCache = new Map();
  const runtimeState = {
    regionCandidates: [],
    activeRegionCandidateId: null,
    warmupSeenPaths: new Set(),
    warmupBusy: false,
  };

  const pipeline = createDesignReviewPipeline({
    providerRouter,
    memoryStore,
    uploadAnalysisCache,
    hashImage: (image) => hashImageRecord(image, pathHashCache),
  });

  const consentUi = ensureConsentUi();
  const setConsent = async (value) => {
    uploadAnalysisCache.setConsent(value);
    consentUi.classList.add("hidden");
    if (value === "granted") {
      const snapshot = shellSnapshot();
      if (snapshot?.images?.length) {
        void pipeline.warmUploadAnalysis(snapshot.images, {
          consent: "granted",
          onUpdate: (entry) => {
            window.dispatchEvent(new CustomEvent(REVIEW_UPLOAD_ANALYSIS_EVENT, { detail: entry }));
          },
        });
      }
    }
    return value;
  };

  consentUi.querySelector('[data-review-consent="allow"]')?.addEventListener("click", () => {
    void setConsent("granted");
  });
  consentUi.querySelector('[data-review-consent="deny"]')?.addEventListener("click", () => {
    void setConsent("denied");
  });

  const acceptProposal = (proposal) => {
    const memory = pipeline.acceptProposal(proposal?.proposalId, {
      stylePatterns:
        proposal?.negativeConstraints?.filter((entry) => /style|tone|lighting|material/i.test(String(entry || ""))) || [],
      useCasePatterns: [proposal?.actionType].filter(Boolean),
    });
    window.dispatchEvent(
      new CustomEvent(REVIEW_ACCEPT_EVENT, {
        detail: {
          proposal,
          memory,
        },
      })
    );
  };

  pipeline.subscribe((state) => {
    renderTrayState(state, acceptProposal);
    window.dispatchEvent(
      new CustomEvent(REVIEW_STATE_EVENT, {
        detail: state,
      })
    );
  });

  async function maybeShowConsentPrompt(snapshot = null) {
    const consent = uploadAnalysisCache.getConsent();
    if (consent !== "unset") {
      consentUi.classList.add("hidden");
      return;
    }
    const shell = snapshot || shellSnapshot();
    if (!shell?.images?.length) {
      consentUi.classList.add("hidden");
      return;
    }
    consentUi.classList.remove("hidden");
  }

  async function warmupUploadAnalyses() {
    if (runtimeState.warmupBusy) return;
    const snapshot = shellSnapshot();
    if (!snapshot?.images?.length) return;
    await maybeShowConsentPrompt(snapshot);
    if (uploadAnalysisCache.getConsent() !== "granted") return;
    runtimeState.warmupBusy = true;
    try {
      const fresh = snapshot.images.filter((image) => {
        const path = String(image?.path || "").trim();
        if (!path) return false;
        if (runtimeState.warmupSeenPaths.has(path)) return false;
        runtimeState.warmupSeenPaths.add(path);
        return true;
      });
      if (!fresh.length) return;
      await pipeline.warmUploadAnalysis(fresh, {
        consent: "granted",
        onUpdate: (entry) => {
          window.dispatchEvent(new CustomEvent(REVIEW_UPLOAD_ANALYSIS_EVENT, { detail: entry }));
        },
      });
    } finally {
      runtimeState.warmupBusy = false;
    }
  }

  async function startReviewFromShell() {
    const snapshot = shellSnapshot();
    if (!snapshot?.images?.length) {
      renderTrayState(
        {
          status: "failed",
          request: null,
          slots: [
            {
              rank: 1,
              status: "failed",
              proposal: {
                label: "No image on canvas",
                why: "Upload one image before running Design review.",
              },
              error: "Upload one image before running Design review.",
            },
          ],
        },
        acceptProposal
      );
      return null;
    }
    const visualPrompt = await readVisualPrompt(snapshot.runDir);
    const visibleCanvasRef = await captureVisibleCanvasRef(snapshot.runDir);
    const cachedImageAnalyses = await lookupCachedAnalyses(snapshot.images, uploadAnalysisCache, pathHashCache);
    const memorySummary = summarizeDesignReviewAccountMemory(readDesignReviewAccountMemory(memoryStore));
    void warmupUploadAnalyses();
    const request = buildDesignReviewRequest({
      shellContext: snapshot,
      visibleCanvasRef,
      visualPrompt,
      regionCandidates: runtimeState.regionCandidates,
      activeRegionCandidateId: runtimeState.activeRegionCandidateId,
      selectedImageIds: snapshot.selectedImageIds,
      cachedImageAnalyses,
      accountMemorySummary: memorySummary,
    });
    try {
      return await pipeline.startReview({ request });
    } catch (error) {
      renderTrayState(
        {
          status: "failed",
          request,
          slots: [
            {
              rank: 1,
              status: "failed",
              proposal: {
                label: "Review failed",
                why: clampText(error?.message || error || "Design review failed to start.", 220),
              },
              error: clampText(error?.message || error || "Design review failed to start.", 220),
            },
          ],
        },
        acceptProposal
      );
      throw error;
    }
  }

  document.addEventListener(
    "click",
    (event) => {
      const button = event.target?.closest?.("#session-tab-design-review");
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void startReviewFromShell();
    },
    true
  );

  window.addEventListener("juggernaut:shell-ready", () => {
    void warmupUploadAnalyses();
  });
  window.setInterval(() => {
    void warmupUploadAnalyses();
  }, 2500);

  const bridge = {
    getState: () => pipeline.getState(),
    subscribe: (listener) => pipeline.subscribe(listener),
    startReviewFromShell,
    setRegionCandidates(regionCandidates = [], activeRegionCandidateId = null) {
      runtimeState.regionCandidates = Array.isArray(regionCandidates) ? regionCandidates.slice() : [];
      runtimeState.activeRegionCandidateId = activeRegionCandidateId ? String(activeRegionCandidateId) : null;
      return {
        regionCandidates: runtimeState.regionCandidates.slice(),
        activeRegionCandidateId: runtimeState.activeRegionCandidateId,
      };
    },
    setActiveRegionCandidateId(value = null) {
      runtimeState.activeRegionCandidateId = value ? String(value) : null;
      return runtimeState.activeRegionCandidateId;
    },
    getUploadAnalysisConsent() {
      return uploadAnalysisCache.getConsent();
    },
    async setUploadAnalysisConsent(value = "denied") {
      return setConsent(value);
    },
  };

  window.__JUGGERNAUT_REVIEW__ = bridge;
  return bridge;
}

void installDesignReviewBootstrap();
