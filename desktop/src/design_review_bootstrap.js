import { convertFileSrc } from "@tauri-apps/api/tauri";
import { readBinaryFile, writeBinaryFile } from "@tauri-apps/api/fs";
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
  createUploadAnalysisWarmupController,
} from "./design_review_upload_analysis.js";
import { invokeDesignReviewProviderRequest } from "./design_review_backend.js";

const REVIEW_CONSENT_ID = "design-review-consent";
const REVIEW_DEBUG_MODAL_ID = "design-review-debug-modal";
const REVIEW_STYLE_ID = "design-review-style";
const REVIEW_STATE_EVENT = "juggernaut:design-review-state";
const REVIEW_ACCEPT_EVENT = "juggernaut:design-review-accept";
const REVIEW_APPLY_EVENT = "juggernaut:design-review-apply";
const REVIEW_UPLOAD_ANALYSIS_EVENT = "juggernaut:upload-analysis-updated";
const COMMUNICATION_REVIEW_REQUESTED_EVENT = "juggernaut:design-review-requested";
const COMMUNICATION_PROPOSAL_TRAY_EVENT = "juggernaut:communication-proposal-tray-changed";
const EDIT_PROPOSALS_LABEL = "Try Edits";

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

function clampText(value, maxLen = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
}

function normalizeBounds(raw = null) {
  const record = asRecord(raw);
  if (!record) return null;
  const x = Number(record.x);
  const y = Number(record.y);
  const width = Number(record.width ?? record.w);
  const height = Number(record.height ?? record.h);
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return {
    x,
    y,
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

function numericTimeToIso(value = null) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric).toISOString();
  }
  return new Date().toISOString();
}

function shellBridge() {
  return typeof window !== "undefined" ? window.__JUGGERNAUT_SHELL__ || null : null;
}

function shellSnapshot() {
  const shell = shellBridge();
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

function createDesignReviewApplyRunner(providerRouter = null) {
  return async ({
    request = {},
    proposal = {},
    sessionKey = null,
    targetImageId = null,
    referenceImageIds = [],
    targetImage = null,
    referenceImages = [],
    outputPath = "",
  } = {}) => {
    const normalizedTargetImage = targetImage && typeof targetImage === "object" ? { ...targetImage } : null;
    const normalizedTargetImagePath = readFirstString(
      normalizedTargetImage?.path,
      normalizedTargetImage?.imagePath
    );
    const normalizedReferenceImages = (Array.isArray(referenceImages) ? referenceImages : [])
      .map((image) => (image && typeof image === "object" ? { ...image } : null))
      .filter(Boolean)
      .map((image) => ({
        ...image,
        imageId: readFirstString(image?.id, image?.imageId, image?.image_id) || null,
        path: readFirstString(image?.path, image?.imagePath) || null,
      }))
      .filter((image) => image.path);

    if (!providerRouter || typeof providerRouter.runApply !== "function") {
      const error = new Error(`${EDIT_PROPOSALS_LABEL} apply handler is unavailable.`);
      error.debugInfo = {
        source: "design_review_bootstrap",
        route: {
          kind: "apply",
        },
        requestId: readFirstString(request?.requestId) || null,
        sessionKey: readFirstString(sessionKey) || null,
        proposal,
        request,
        targetImageId: readFirstString(targetImageId) || null,
        targetImagePath: normalizedTargetImagePath || null,
        referenceImageIds: Array.isArray(referenceImageIds) ? referenceImageIds.slice() : [],
        referenceImagePaths: normalizedReferenceImages.map((image) => image.path),
        outputPath: readFirstString(outputPath) || null,
      };
      throw error;
    }

    return providerRouter.runApply({
      request,
      proposal,
      sessionKey: readFirstString(sessionKey) || null,
      targetImageId: readFirstString(targetImageId) || null,
      referenceImageIds: Array.isArray(referenceImageIds) ? referenceImageIds.slice() : [],
      targetImage: normalizedTargetImagePath
        ? {
            ...normalizedTargetImage,
            imageId:
              readFirstString(
                normalizedTargetImage?.id,
                normalizedTargetImage?.imageId,
                normalizedTargetImage?.image_id,
                targetImageId
              ) || null,
            path: normalizedTargetImagePath,
          }
        : null,
      referenceImages: normalizedReferenceImages,
      outputPath: readFirstString(outputPath) || null,
    });
  };
}

function ensureReviewStyle() {
  if (document.getElementById(REVIEW_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = REVIEW_STYLE_ID;
  style.textContent = `
#${REVIEW_CONSENT_ID}.hidden {
  display: none !important;
}
#${REVIEW_CONSENT_ID} {
  position: fixed;
  top: 84px;
  right: 18px;
  width: min(332px, calc(100vw - 32px));
  padding: 14px;
  border-radius: 20px;
  border: 1px solid rgba(202, 211, 221, 0.92);
  background:
    radial-gradient(circle at top right, rgba(255, 145, 92, 0.12), transparent 42%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 249, 252, 0.96));
  box-shadow:
    0 18px 42px rgba(20, 28, 38, 0.12),
    0 1px 0 rgba(255, 255, 255, 0.82) inset;
  backdrop-filter: blur(18px) saturate(1.12);
  z-index: 120;
}
#${REVIEW_CONSENT_ID} .design-review-consent-title {
  font-family: "IBM Plex Mono", monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(108, 74, 32, 0.88);
}
#${REVIEW_CONSENT_ID} .design-review-consent-copy {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.45;
  color: rgba(58, 72, 88, 0.82);
}
#${REVIEW_CONSENT_ID} .design-review-consent-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
#${REVIEW_CONSENT_ID} button {
  border: 0;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
}
#${REVIEW_CONSENT_ID} .design-review-consent-allow {
  background: rgba(28, 118, 242, 0.92);
  color: rgba(255, 255, 255, 0.98);
}
#${REVIEW_CONSENT_ID} .design-review-consent-deny {
  background: rgba(223, 229, 235, 0.92);
  color: rgba(46, 61, 79, 0.82);
}
#${REVIEW_DEBUG_MODAL_ID}.hidden {
  display: none !important;
}
#${REVIEW_DEBUG_MODAL_ID} {
  position: fixed;
  inset: 0;
  z-index: 145;
  display: grid;
  place-items: center;
  background: rgba(14, 20, 28, 0.38);
  backdrop-filter: blur(8px);
}
#${REVIEW_DEBUG_MODAL_ID} .design-review-debug-panel {
  width: min(760px, calc(100vw - 32px));
  max-height: min(78vh, 900px);
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 22px;
  border: 1px solid rgba(203, 212, 222, 0.94);
  background:
    radial-gradient(240px 140px at 12% -6%, rgba(255, 149, 92, 0.10), transparent 60%),
    radial-gradient(240px 148px at 104% 8%, rgba(94, 161, 255, 0.10), transparent 62%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.985), rgba(246, 249, 252, 0.972));
  box-shadow:
    0 26px 68px rgba(18, 28, 40, 0.22),
    0 1px 0 rgba(255, 255, 255, 0.86) inset;
}
#${REVIEW_DEBUG_MODAL_ID} .design-review-debug-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
#${REVIEW_DEBUG_MODAL_ID} .design-review-debug-title {
  font-family: "IBM Plex Mono", monospace;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(82, 98, 118, 0.88);
}
#${REVIEW_DEBUG_MODAL_ID} .design-review-debug-close {
  border: 0;
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: rgba(233, 238, 244, 0.92);
  color: rgba(60, 77, 98, 0.82);
}
#${REVIEW_DEBUG_MODAL_ID} .design-review-debug-body {
  overflow: auto;
  border-radius: 16px;
  background: rgba(15, 23, 34, 0.96);
  box-shadow: inset 0 0 0 1px rgba(52, 69, 88, 0.62);
}
#${REVIEW_DEBUG_MODAL_ID} pre {
  margin: 0;
  padding: 14px;
  font-family: "IBM Plex Mono", monospace;
  font-size: 11px;
  line-height: 1.5;
  color: rgba(226, 236, 247, 0.96);
  white-space: pre-wrap;
  word-break: break-word;
}
#communication-proposal-tray.is-design-review-runtime {
  width: min(360px, calc(100vw - 40px));
  min-width: 280px;
  overflow: hidden;
  border-color: rgba(203, 212, 222, 0.94);
  background:
    radial-gradient(220px 126px at 18% -6%, rgba(255, 149, 92, 0.10), transparent 62%),
    radial-gradient(220px 132px at 104% 10%, rgba(94, 161, 255, 0.10), transparent 66%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.985), rgba(246, 249, 252, 0.972));
  box-shadow:
    0 22px 56px rgba(18, 28, 40, 0.14),
    0 1px 0 rgba(255, 255, 255, 0.86) inset;
  backdrop-filter: blur(22px) saturate(1.15);
}
#communication-proposal-tray.is-design-review-runtime.is-collapsed {
  padding: 10px;
}
#communication-proposal-tray.is-design-review-runtime::after {
  border-right-color: rgba(203, 212, 222, 0.94);
  border-bottom-color: rgba(203, 212, 222, 0.94);
}
#communication-proposal-tray.is-design-review-runtime .communication-proposal-tray-head {
  align-items: flex-start;
  margin-bottom: 12px;
}
#communication-proposal-tray.is-design-review-runtime.is-collapsed .communication-proposal-tray-head {
  margin-bottom: 8px;
}
#communication-proposal-tray.is-design-review-runtime .communication-proposal-tray-title {
  color: rgba(72, 84, 102, 0.9);
}
#communication-proposal-tray.is-design-review-runtime .communication-proposal-tray-close {
  border-radius: 999px;
  padding: 4px 10px;
  background: rgba(233, 238, 244, 0.84);
  color: rgba(60, 77, 98, 0.78);
}
.design-review-runtime-head {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1 1 auto;
}
#communication-proposal-tray.is-design-review-runtime.is-collapsed .communication-proposal-slot-list {
  gap: 6px;
}
#communication-proposal-tray.is-design-review-runtime.is-collapsed .communication-proposal-slot {
  padding: 8px 10px;
  border-radius: 12px;
}
#communication-proposal-tray.is-design-review-runtime.is-collapsed .design-review-runtime-card {
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
}
#communication-proposal-tray.is-design-review-runtime.is-collapsed .design-review-runtime-media {
  display: none;
}
#communication-proposal-tray.is-design-review-runtime.is-collapsed .design-review-runtime-copy {
  gap: 4px;
}
#communication-proposal-tray.is-design-review-runtime.is-collapsed .design-review-runtime-title {
  font-size: 13px;
  line-height: 1.24;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#communication-proposal-tray.is-design-review-runtime.is-collapsed .design-review-runtime-why,
#communication-proposal-tray.is-design-review-runtime.is-collapsed .design-review-runtime-hint,
#communication-proposal-tray.is-design-review-runtime.is-collapsed .design-review-runtime-actions {
  display: none;
}
.design-review-runtime-meta {
  font-size: 11px;
  color: rgba(86, 101, 121, 0.74);
}
.design-review-runtime-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.design-review-runtime-head-debug {
  border: 0;
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  background: rgba(233, 238, 244, 0.96);
  color: rgba(61, 78, 98, 0.84);
}
.design-review-runtime-card {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.communication-proposal-slot.is-actionable {
  cursor: pointer;
}
.communication-proposal-slot.is-actionable:hover {
  border-color: rgba(28, 118, 242, 0.22);
  box-shadow: 0 16px 28px rgba(17, 31, 48, 0.12);
}
.communication-proposal-slot.is-actionable:focus-visible {
  outline: 2px solid rgba(28, 118, 242, 0.52);
  outline-offset: 2px;
}
.design-review-runtime-media {
  position: relative;
  width: 76px;
  height: 76px;
  border-radius: 12px;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(247, 250, 253, 0.96), rgba(231, 237, 243, 0.98)),
    radial-gradient(circle at 30% 22%, rgba(94, 161, 255, 0.12), transparent 44%);
  box-shadow: inset 0 0 0 1px rgba(203, 212, 222, 0.9);
}
.design-review-runtime-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.design-review-runtime-media.is-skeleton::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.68), rgba(255, 255, 255, 0));
  transform: translateX(-120%);
  animation: communication-slot-shimmer 1.35s linear infinite;
}
.design-review-runtime-copy {
  display: grid;
  gap: 7px;
  min-width: 0;
}
.design-review-runtime-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.design-review-runtime-label {
  font-family: "IBM Plex Mono", monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(110, 125, 145, 0.76);
}
.design-review-runtime-status {
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(226, 232, 238, 0.96);
  color: rgba(77, 92, 112, 0.76);
}
.communication-proposal-slot[data-review-status="ready"] .design-review-runtime-status {
  background: rgba(166, 238, 200, 0.46);
  color: rgba(38, 118, 76, 0.9);
}
.communication-proposal-slot[data-review-status="apply_running"] .design-review-runtime-status {
  background: rgba(208, 229, 255, 0.92);
  color: rgba(36, 95, 180, 0.9);
}
.communication-proposal-slot[data-review-status="apply_succeeded"] .design-review-runtime-status {
  background: rgba(166, 238, 200, 0.64);
  color: rgba(38, 118, 76, 0.92);
}
.communication-proposal-slot[data-review-status="failed"] .design-review-runtime-status {
  background: rgba(255, 218, 218, 0.9);
  color: rgba(162, 49, 49, 0.92);
}
.communication-proposal-slot[data-review-status="apply_failed"] .design-review-runtime-status {
  background: rgba(255, 218, 218, 0.96);
  color: rgba(162, 49, 49, 0.94);
}
.design-review-runtime-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.32;
  color: rgba(24, 38, 56, 0.94);
}
.design-review-runtime-why {
  font-size: 12px;
  line-height: 1.42;
  color: rgba(72, 90, 111, 0.8);
}
.design-review-runtime-hint {
  font-size: 11px;
  line-height: 1.35;
  color: rgba(28, 118, 242, 0.82);
}
.design-review-runtime-why.is-error {
  color: rgba(158, 56, 56, 0.92);
}
.design-review-runtime-actions {
  display: flex;
  justify-content: flex-start;
}
.design-review-runtime-action {
  border: 0;
  border-radius: 999px;
  padding: 7px 11px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  background: rgba(28, 118, 242, 0.92);
  color: rgba(255, 255, 255, 0.98);
}
.design-review-runtime-action:disabled {
  cursor: default;
  opacity: 0.58;
}
.design-review-runtime-action.design-review-runtime-action-secondary {
  background: rgba(233, 238, 244, 0.96);
  color: rgba(61, 78, 98, 0.84);
}
`;
  document.head.appendChild(style);
}

function ensureConsentUi() {
  ensureReviewStyle();
  let root = document.getElementById(REVIEW_CONSENT_ID);
  if (root) return root;
  root = document.createElement("section");
  root.id = REVIEW_CONSENT_ID;
  root.className = "hidden";
  root.innerHTML = `
    <div class="design-review-consent-title">Cloud Analysis</div>
    <div class="design-review-consent-copy">
      Allow background upload analysis to improve ranking and region hints. This stays opportunistic and never blocks ${EDIT_PROPOSALS_LABEL}.
    </div>
    <div class="design-review-consent-actions">
      <button type="button" class="design-review-consent-allow" data-review-consent="allow">Allow</button>
      <button type="button" class="design-review-consent-deny" data-review-consent="deny">Not Now</button>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function stringifyReviewDebugPayload(payload = null) {
  try {
    return JSON.stringify(payload, null, 2);
  } catch (error) {
    return JSON.stringify(
      {
        failure: "Could not serialize review debug payload.",
        error: readFirstString(error?.message, error) || null,
      },
      null,
      2
    );
  }
}

function ensureReviewDebugModal() {
  ensureReviewStyle();
  let root = document.getElementById(REVIEW_DEBUG_MODAL_ID);
  if (root) return root;
  root = document.createElement("section");
  root.id = REVIEW_DEBUG_MODAL_ID;
  root.className = "hidden";
  root.innerHTML = `
    <div class="design-review-debug-panel" role="dialog" aria-modal="true" aria-labelledby="${REVIEW_DEBUG_MODAL_ID}-title">
      <div class="design-review-debug-head">
        <div class="design-review-debug-title" id="${REVIEW_DEBUG_MODAL_ID}-title">Review Debug Payload</div>
        <button type="button" class="design-review-debug-close" data-review-debug-close="1">Close</button>
      </div>
      <div class="design-review-debug-body">
        <pre class="design-review-debug-json"></pre>
      </div>
    </div>
  `;
  const close = () => {
    root.classList.add("hidden");
  };
  root.addEventListener("click", (event) => {
    if (event.target === root) close();
  });
  root.querySelector('[data-review-debug-close="1"]')?.addEventListener("click", close);
  document.body.appendChild(root);
  return root;
}

function openReviewDebugModal(payload = null) {
  const root = ensureReviewDebugModal();
  const pre = root.querySelector(".design-review-debug-json");
  if (pre) pre.textContent = stringifyReviewDebugPayload(payload);
  root.classList.remove("hidden");
  return root;
}

function normalizeVisibleImages(shellContext = {}, reviewPayload = {}) {
  const shellImages = Array.isArray(shellContext?.images) ? shellContext.images : [];
  const reviewImages = Array.isArray(reviewPayload?.canvas?.visibleImages)
    ? reviewPayload.canvas.visibleImages
    : [];
  if (!reviewImages.length) {
    return shellImages.map((image) => ({ ...image }));
  }
  const shellById = new Map(
    shellImages
      .map((image) => [String(image?.id || "").trim(), image])
      .filter(([id]) => Boolean(id))
  );
  return reviewImages.map((image) => {
    const id = String(image?.id || "").trim();
    const shellImage = shellById.get(id) || {};
    return {
      ...shellImage,
      ...image,
      id,
      path: readFirstString(image?.path, shellImage?.path) || null,
      label: readFirstString(image?.label, shellImage?.label) || "Untitled",
      width: Number(image?.width ?? shellImage?.width) || null,
      height: Number(image?.height ?? shellImage?.height) || null,
      active: Boolean(image?.active ?? shellImage?.active),
      selected: Boolean(image?.selected ?? shellImage?.selected),
      rectCss: asRecord(image?.rectCss) ? { ...image.rectCss } : null,
    };
  });
}

function normalizeCommunicationMarks(reviewPayload = {}) {
  const marks = Array.isArray(reviewPayload?.communication?.marks)
    ? reviewPayload.communication.marks
    : [];
  const communicationTool = readFirstString(reviewPayload?.communication?.tool) || "marker";
  return marks
    .map((mark) => {
      const id = readFirstString(mark?.id);
      if (!id) return null;
      return {
        id,
        imageId: readFirstString(mark?.imageId, mark?.sourceImageId) || null,
        kind: readFirstString(mark?.kind, mark?.type) || "freehand_marker",
        coordinateSpace: readFirstString(mark?.coordinateSpace) || "canvas_overlay",
        colorToken: readFirstString(mark?.colorToken, mark?.color) || "signal-red",
        createdAt: numericTimeToIso(mark?.createdAt),
        createdByTool: communicationTool,
        transient: true,
        points: Array.isArray(mark?.points)
          ? mark.points.map((point) => ({
              x: Number(point?.x) || 0,
              y: Number(point?.y) || 0,
            }))
          : [],
        bounds: normalizeBounds(mark?.bounds),
      };
    })
    .filter(Boolean);
}

function normalizeCommunicationRegionCandidates(reviewPayload = {}) {
  const groups = Array.isArray(reviewPayload?.communication?.regionSelections)
    ? reviewPayload.communication.regionSelections
    : [];
  const regionCandidates = [];
  let activeRegionCandidateId = null;
  groups.forEach((group, groupIndex) => {
    const imageId = readFirstString(group?.imageId) || null;
    const cycleGroupId =
      readFirstString(group?.chosenCandidateId) ||
      `${imageId || "canvas"}:cycle:${groupIndex + 1}`;
    const candidates = Array.isArray(group?.candidates) ? group.candidates : [];
    candidates.forEach((candidate, candidateIndex) => {
      const id =
        readFirstString(candidate?.id) || `${cycleGroupId}:candidate:${candidateIndex + 1}`;
      const next = {
        id,
        imageId,
        source: "magic_select",
        clickPoint: asRecord(group?.anchor) ? { ...group.anchor } : null,
        maskRef: null,
        bounds: normalizeBounds(candidate?.bounds),
        confidence: Number(candidate?.confidence) || 0,
        rank: candidateIndex + 1,
        cycleGroupId,
        isActive: Boolean(candidate?.active),
      };
      if (next.isActive && !activeRegionCandidateId) {
        activeRegionCandidateId = next.id;
      }
      regionCandidates.push(next);
    });
  });
  return {
    regionCandidates,
    activeRegionCandidateId,
  };
}

export function buildDesignReviewRequestFromCommunication({
  shellContext = {},
  reviewPayload = {},
  visibleCanvasRef = null,
  cachedImageAnalyses = [],
  accountMemorySummary = null,
} = {}) {
  const communicationReview = asRecord(reviewPayload?.communication) || null;
  const visibleImages = normalizeVisibleImages(shellContext, reviewPayload);
  const selectedImageIds = Array.isArray(reviewPayload?.canvas?.selectedImageIds)
    ? reviewPayload.canvas.selectedImageIds.map((value) => String(value || "").trim()).filter(Boolean)
    : Array.isArray(shellContext?.selectedImageIds)
      ? shellContext.selectedImageIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
  const marks = normalizeCommunicationMarks(reviewPayload);
  const { regionCandidates, activeRegionCandidateId } =
    normalizeCommunicationRegionCandidates(reviewPayload);
  const normalizedShellContext = {
    ...shellContext,
    runDir: readFirstString(reviewPayload?.runDir, shellContext?.runDir) || null,
    activeTabId: readFirstString(reviewPayload?.tabId, shellContext?.activeTabId) || null,
    canvasMode: readFirstString(reviewPayload?.canvas?.mode, shellContext?.canvasMode) || "single",
    imageCount: visibleImages.length || Number(shellContext?.imageCount) || 0,
    activeImageId:
      readFirstString(reviewPayload?.canvas?.activeImageId, shellContext?.activeImageId) || null,
    selectedImageIds,
    regionSelectionActive: Boolean(activeRegionCandidateId || shellContext?.regionSelectionActive),
    images: visibleImages,
  };
  const request = buildDesignReviewRequest({
    shellContext: normalizedShellContext,
    visibleCanvasRef,
    visualPrompt: {
      canvas: {
        mode: normalizedShellContext.canvasMode,
        active_image_id: normalizedShellContext.activeImageId,
      },
      images: visibleImages,
      marks,
    },
    regionCandidates,
    activeRegionCandidateId,
    selectedImageIds,
    focusInputs: communicationReview?.focusInputs || communicationReview?.focus_inputs || [],
    protectedRegions: communicationReview?.protectedRegions || communicationReview?.protected_regions || [],
    reservedSpaceIntent:
      communicationReview?.reservedSpaceIntent ||
      communicationReview?.reserved_space_intent ||
      communicationReview?.reservedSpaces ||
      communicationReview?.reserved_spaces ||
      null,
    reviewTool: readFirstString(communicationReview?.tool) || null,
    cachedImageAnalyses,
    accountMemorySummary,
    requestId: readFirstString(reviewPayload?.requestId) || null,
    sessionId:
      readFirstString(reviewPayload?.tabId, reviewPayload?.runDir, normalizedShellContext.activeTabId) ||
      null,
  });
  return {
    ...request,
    marks,
    regionCandidates,
    activeRegionCandidateId,
    communicationReview: communicationReview
      ? {
          ...communicationReview,
          tool: readFirstString(communicationReview.tool) || null,
          focusInputs: Array.isArray(request.focusInputs)
            ? JSON.parse(JSON.stringify(request.focusInputs))
            : [],
          protectedRegions: Array.isArray(request.protectedRegions)
            ? JSON.parse(JSON.stringify(request.protectedRegions))
            : [],
          reservedSpaceIntent: request.reservedSpaceIntent
            ? JSON.parse(JSON.stringify(request.reservedSpaceIntent))
            : null,
          latestAnchor: asRecord(communicationReview.latestAnchor)
            ? { ...communicationReview.latestAnchor }
            : null,
          resolvedTarget: asRecord(communicationReview.resolvedTarget)
            ? { ...communicationReview.resolvedTarget }
            : null,
        }
      : null,
    visibleCanvasContext: {
      ...request.visibleCanvasContext,
      reviewSource: readFirstString(reviewPayload?.source) || "communication_review",
    },
  };
}

function slotStatusLabel(status = "") {
  if (status === "ready") return "Ready";
  if (status === "apply_running") return "Applying";
  if (status === "apply_succeeded") return "Applied";
  if (status === "apply_failed") return "Apply Failed";
  if (status === "failed") return "Failed";
  if (status === "preview_running") return "Rendering";
  if (status === "preview_pending") return "Queued";
  if (status === "planning") return "Planning";
  return "Loading";
}

function proposalEffectText(proposal = {}) {
  return clampText(
    readFirstString(proposal?.previewBrief, proposal?.applyBrief, proposal?.why) ||
      "Make a focused visual change.",
    104
  );
}

function slotSummaryText(slot = {}) {
  if (slot?.status === "apply_running") {
    return "Applying to the target image.";
  }
  if (slot?.status === "apply_succeeded") {
    return "Applied to the target image.";
  }
  if (slot?.status === "apply_failed") {
    return clampText(slot?.apply?.error || slot?.error || "The final edit could not be rendered.", 120);
  }
  if (slot?.error) {
    return clampText(slot.error, 120);
  }
  return proposalEffectText(slot?.proposal);
}

function shouldCollapseReviewTray(state = {}) {
  const status = readFirstString(state?.status).toLowerCase();
  if (["preparing", "planning", "previewing", "apply_running"].includes(status)) {
    return true;
  }
  if (["ready", "failed", "apply_failed", "apply_succeeded"].includes(status)) {
    return false;
  }
  const slots = Array.isArray(state?.slots) ? state.slots : [];
  if (!slots.length) return false;
  const hasTerminalSlot = slots.some((slot) =>
    ["ready", "failed", "apply_failed", "apply_succeeded"].includes(
      readFirstString(slot?.status).toLowerCase()
    )
  );
  if (hasTerminalSlot) return false;
  return slots.some((slot) =>
    ["planning", "preview_pending", "preview_running", "apply_running"].includes(
      readFirstString(slot?.status).toLowerCase()
    )
  );
}

function createPendingRuntimeReviewState(requestId = null) {
  const normalizedRequestId = readFirstString(requestId) || null;
  return {
    status: "planning",
    request: {
      requestId: normalizedRequestId,
    },
    slots: [
      {
        rank: 1,
        status: "planning",
        proposal: {
          label: "Map the edit",
        },
      },
      {
        rank: 2,
        status: "preview_pending",
        proposal: {
          label: "Queue options",
        },
      },
      {
        rank: 3,
        status: "preview_pending",
        proposal: {
          label: "Render previews",
        },
      },
    ],
  };
}

function collectReviewDebugPayload(state = {}) {
  const slots = Array.isArray(state?.slots) ? state.slots : [];
  const failedSlots = slots
    .filter((slot) =>
      ["failed", "apply_failed"].includes(String(slot?.status || "")) &&
      (slot?.apply?.debugInfo || slot?.debugInfo)
    )
    .map((slot, index) => ({
      rank: Number(slot?.rank) || index + 1,
      label: readFirstString(slot?.proposal?.label, slot?.proposal?.title) || `Proposal ${index + 1}`,
      failureStage: slot?.status === "apply_failed" ? "apply" : "preview",
      error: readFirstString(slot?.error) || null,
      debugInfo: JSON.parse(JSON.stringify(slot?.apply?.debugInfo || slot?.debugInfo)),
    }));
  const applyFailure =
    state?.lastApplyEvent?.status === "apply_failed" && state?.lastApplyEvent?.debugInfo
      ? JSON.parse(JSON.stringify(state.lastApplyEvent))
      : null;
  if (!failedSlots.length && !state?.plannerDebugInfo && !applyFailure) return null;
  return {
    requestId: readFirstString(state?.request?.requestId) || null,
    status: readFirstString(state?.status) || null,
    reviewRequest: state?.request && typeof state.request === "object" ? JSON.parse(JSON.stringify(state.request)) : null,
    plannerDebugInfo: state?.plannerDebugInfo ? JSON.parse(JSON.stringify(state.plannerDebugInfo)) : null,
    applyFailure,
    failedSlots,
  };
}

function communicationTraySlotStatus(status = "") {
  if (status === "ready" || status === "apply_succeeded") return "ready";
  if (status === "failed" || status === "apply_failed") return "failed";
  return "skeleton";
}

function clampTrayIntoCanvasWrap(tray = null) {
  const trayEl = tray || communicationTrayRoot();
  const wrap = document.getElementById("canvas-wrap");
  if (!trayEl || !wrap) return false;
  const width = Number(trayEl.offsetWidth) || 0;
  const height = Number(trayEl.offsetHeight) || 0;
  if (!width || !height) return false;
  const maxX = Math.max(12, (Number(wrap.clientWidth) || 0) - width - 12);
  const maxY = Math.max(12, (Number(wrap.clientHeight) || 0) - height - 18);
  const currentX = Number.parseFloat(trayEl.style.left || "0");
  const currentY = Number.parseFloat(trayEl.style.top || "0");
  const clampedX = Math.min(maxX, Math.max(12, Number.isFinite(currentX) ? currentX : 12));
  const clampedY = Math.min(maxY, Math.max(12, Number.isFinite(currentY) ? currentY : 12));
  trayEl.style.left = `${Math.round(clampedX)}px`;
  trayEl.style.top = `${Math.round(clampedY)}px`;
  return true;
}

export function mapDesignReviewStateToCommunicationTray(state = {}) {
  const slots = Array.isArray(state?.slots) ? state.slots : [];
  const focusInputs = Array.isArray(state?.request?.focusInputs) ? state.request.focusInputs : [];
  const protectedRegions = Array.isArray(state?.request?.protectedRegions) ? state.request.protectedRegions : [];
  const reservedSpaceAreas = Array.isArray(state?.request?.reservedSpaceIntent?.areas)
    ? state.request.reservedSpaceIntent.areas
    : [];
  return {
    requestId: readFirstString(state?.request?.requestId) || null,
    status: readFirstString(state?.status) || "idle",
    reviewTool: readFirstString(state?.request?.reviewTool) || null,
    focusInputCount: focusInputs.length,
    protectedRegionCount: protectedRegions.length,
    reservedSpaceAreaCount: reservedSpaceAreas.length,
    slots: slots.map((slot, index) => ({
      focusInputCount: Array.isArray(slot?.proposal?.focusInputs) ? slot.proposal.focusInputs.length : 0,
      protectedRegionCount: Array.isArray(slot?.proposal?.protectedRegions)
        ? slot.proposal.protectedRegions.length
        : 0,
      reservedSpaceAreaCount: Array.isArray(slot?.proposal?.reservedSpaceIntent?.areas)
        ? slot.proposal.reservedSpaceIntent.areas.length
        : 0,
      preserveProtectedRegions:
        slot?.proposal?.preserveProtectedRegions === true ||
        Boolean(slot?.proposal?.protectedRegions?.length),
      preserveReservedSpace:
        slot?.proposal?.preserveReservedSpace === true ||
        Boolean(slot?.proposal?.reservedSpaceIntent?.areas?.length),
      slotId: readFirstString(slot?.slotId) || `design-review-slot-${index + 1}`,
      status: communicationTraySlotStatus(slot?.status),
      label: `Proposal ${Number(slot?.rank) || index + 1}`,
      title: clampText(
        slot?.proposal?.label ||
          slot?.proposal?.title ||
          (slot?.status === "failed" ? "Review failed" : "Review warming up"),
        92
      ),
      copy: slotSummaryText(slot),
      imageId: readFirstString(slot?.proposal?.imageId) || null,
      actionType: readFirstString(slot?.proposal?.actionType) || null,
      targetRegionId: readFirstString(slot?.proposal?.targetRegion?.regionCandidateId) || null,
      previewStatus: readFirstString(slot?.previewJob?.status) || null,
    })),
  };
}

function communicationTrayRoot() {
  return document.getElementById("communication-proposal-tray");
}

function communicationTraySlotList() {
  return document.getElementById("communication-proposal-slot-list");
}

function slotCanAcceptProposal(slot = null, requestApplyLocked = false) {
  if (!slot?.proposal) return false;
  const status = String(slot?.status || "");
  if (status === "apply_running" || status === "apply_succeeded") return false;
  return !requestApplyLocked;
}

function renderCommunicationTrayDetails(state = {}, onAccept = null) {
  ensureReviewStyle();
  const tray = communicationTrayRoot();
  const list = communicationTraySlotList();
  if (!tray || !list) return;
  const collapsed = shouldCollapseReviewTray(state);
  tray.classList.add("is-design-review-runtime");
  tray.classList.toggle("is-collapsed", collapsed);
  tray.dataset.reviewStatus = readFirstString(state?.status) || "idle";

  const head = tray.querySelector(".communication-proposal-tray-head");
  const title = tray.querySelector(".communication-proposal-tray-title");
  if (title) title.textContent = EDIT_PROPOSALS_LABEL;
  if (head) {
    let headGroup = head.querySelector(".design-review-runtime-head");
    if (!headGroup) {
      headGroup = document.createElement("div");
      headGroup.className = "design-review-runtime-head";
      if (title?.parentElement === head) {
        head.prepend(headGroup);
      } else {
        head.prepend(headGroup);
      }
    }
    if (title && title.parentElement !== headGroup) {
      headGroup.appendChild(title);
    }
    head.querySelector(".design-review-runtime-meta")?.remove();
    head.querySelector(".design-review-runtime-head-actions")?.remove();
  }

  const slots = Array.isArray(state?.slots) ? state.slots : [];
  const requestApplyLocked = Boolean(
    readFirstString(state?.activeApply?.requestId) &&
    readFirstString(state?.activeApply?.requestId) ===
      readFirstString(state?.request?.requestId)
  );
  const slotEntries = slots.map((slot, index) => ({ index, slot }));
  const activeApplyProposalId = readFirstString(state?.activeApply?.proposalId);
  let visibleSlotEntries = slotEntries;
  if (collapsed && readFirstString(state?.status).toLowerCase() === "apply_running") {
    const applyingEntries = activeApplyProposalId
      ? slotEntries.filter(
          ({ slot }) => readFirstString(slot?.proposal?.proposalId) === activeApplyProposalId
        )
      : [];
    const runningEntries = slotEntries.filter(
      ({ slot }) => readFirstString(slot?.status).toLowerCase() === "apply_running"
    );
    visibleSlotEntries = applyingEntries.length
      ? applyingEntries
      : runningEntries.length
        ? runningEntries
        : slotEntries;
  }
  const fragment = document.createDocumentFragment();
  visibleSlotEntries.forEach(({ slot, index }) => {
    const card = document.createElement("div");
    const canAcceptSlot = slotCanAcceptProposal(slot, requestApplyLocked);
    card.className = "communication-proposal-slot";
    card.dataset.slotIndex = String(index);
    card.setAttribute("role", "listitem");
    card.dataset.reviewStatus = readFirstString(slot?.status) || "skeleton";
    card.classList.toggle("is-actionable", canAcceptSlot);
    card.tabIndex = canAcceptSlot ? 0 : -1;
    card.classList.toggle(
      "is-skeleton",
      !["ready", "failed", "apply_running", "apply_succeeded", "apply_failed"].includes(
        String(slot?.status || "")
      )
    );
    card.classList.toggle(
      "is-failed",
      ["failed", "apply_failed"].includes(String(slot?.status || ""))
    );
    const handleAccept = () => {
      if (!canAcceptSlot) return;
      if (typeof onAccept === "function") onAccept(slot.proposal);
    };
    if (canAcceptSlot) {
      card.addEventListener("click", () => {
        handleAccept();
      });
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        handleAccept();
      });
    }

    const layout = document.createElement("div");
    layout.className = "design-review-runtime-card";

    const media = document.createElement("div");
    media.className = "design-review-runtime-media";
    if (slot?.outputPreviewRef) {
      const img = document.createElement("img");
      img.src = convertFileSrc(slot.outputPreviewRef);
      img.alt = "";
      media.appendChild(img);
    } else {
      media.classList.add("is-skeleton");
    }

    const copy = document.createElement("div");
    copy.className = "design-review-runtime-copy";

    const row = document.createElement("div");
    row.className = "design-review-runtime-row";

    const label = document.createElement("div");
    label.className = "design-review-runtime-label";
    label.textContent = `Proposal ${Number(slot?.rank) || index + 1}`;

    const status = document.createElement("div");
    status.className = "design-review-runtime-status";
    status.textContent = slotStatusLabel(slot?.status);

    row.append(label, status);

    const titleNode = document.createElement("div");
    titleNode.className = "design-review-runtime-title";
    titleNode.textContent = clampText(
      slot?.proposal?.label || slot?.proposal?.title || `Proposal ${index + 1}`,
      92
    );

    const why = document.createElement("div");
    why.className = `design-review-runtime-why${slot?.error ? " is-error" : ""}`;
    why.textContent = slotSummaryText(slot);

    copy.append(row, titleNode, why);

    if (slot?.proposal) {
      const actions = document.createElement("div");
      actions.className = "design-review-runtime-actions";
      const accept = document.createElement("button");
      accept.type = "button";
      accept.className = "design-review-runtime-action";
      accept.textContent =
        slot?.status === "apply_running"
          ? "Applying…"
          : slot?.status === "apply_succeeded"
            ? "Applied"
            : slot?.status === "apply_failed"
              ? "Retry Apply"
              : "Apply";
      accept.disabled =
        !canAcceptSlot;
      accept.addEventListener("click", (event) => {
        event.stopPropagation();
        if (accept.disabled) return;
        handleAccept();
      });
      actions.appendChild(accept);
      copy.appendChild(actions);
    }

    layout.append(media, copy);
    card.appendChild(layout);
    fragment.appendChild(card);
  });
  list.replaceChildren(fragment);
  requestAnimationFrame(() => {
    if (String(tray.dataset.anchorKind || "").trim().toLowerCase() === "titlebar_button") return;
    clampTrayIntoCanvasWrap(tray);
  });
}

function activeTrayAnchor(reviewPayload = {}, fallbackAnchor = null) {
  return (
    (asRecord(reviewPayload?.communication?.proposalTray?.anchor) && {
      ...reviewPayload.communication.proposalTray.anchor,
    }) ||
    (asRecord(reviewPayload?.communication?.latestAnchor) && {
      ...reviewPayload.communication.latestAnchor,
    }) ||
    (asRecord(fallbackAnchor) ? { ...fallbackAnchor } : null)
  );
}

export function resolveDesignReviewRuntimeSessionKey({
  shellContext = {},
  reviewPayload = {},
  request = {},
  state = {},
  detail = {},
} = {}) {
  const context = asRecord(shellContext) || asRecord(detail?.context) || {};
  const payload = asRecord(reviewPayload) || {};
  const reviewRequest = asRecord(request) || asRecord(state?.request) || {};
  const activeTabId = readFirstString(
    payload?.tabId,
    context?.activeTabId
  );
  if (activeTabId) return `tab:${activeTabId}`;
  const runDir = readFirstString(
    payload?.runDir,
    reviewRequest?.visibleCanvasContext?.runDir,
    context?.runDir
  );
  if (runDir) return `run:${runDir}`;
  const sessionId = readFirstString(reviewRequest?.sessionId);
  if (sessionId) return `session:${sessionId}`;
  const requestId = readFirstString(reviewRequest?.requestId, detail?.requestId);
  if (requestId) return `request:${requestId}`;
  return "";
}

export function createFreshDesignReviewRuntimeState(sessionKey = "") {
  return {
    sessionKey: readFirstString(sessionKey) || null,
    lastCommunicationPayload: null,
    lastReviewState: null,
    lastTrayAnchor: null,
    activeRequestId: null,
    warmupTimer: null,
  };
}

export function createDesignReviewRuntimeRegistry() {
  const runtimeStateBySession = new Map();
  const requestToSessionKey = new Map();

  const normalizeTabId = (value = "") => {
    const normalized = readFirstString(value);
    return normalized.startsWith("tab:") ? normalized.slice(4) : normalized;
  };

  const stateForSession = (sessionKey = "", { create = true } = {}) => {
    const normalizedSessionKey = readFirstString(sessionKey);
    if (!normalizedSessionKey) return null;
    let runtimeState = runtimeStateBySession.get(normalizedSessionKey) || null;
    if (!runtimeState && create) {
      runtimeState = createFreshDesignReviewRuntimeState(normalizedSessionKey);
      runtimeStateBySession.set(normalizedSessionKey, runtimeState);
    }
    if (runtimeState && !runtimeState.sessionKey) {
      runtimeState.sessionKey = normalizedSessionKey;
    }
    return runtimeState;
  };

  const rememberRequest = (requestId = "", sessionKey = "") => {
    const normalizedRequestId = readFirstString(requestId);
    const normalizedSessionKey = readFirstString(sessionKey);
    if (!normalizedRequestId || !normalizedSessionKey) return null;
    requestToSessionKey.set(normalizedRequestId, normalizedSessionKey);
    const runtimeState = stateForSession(normalizedSessionKey);
    if (runtimeState) {
      runtimeState.activeRequestId = normalizedRequestId;
    }
    return normalizedSessionKey;
  };

  const sessionKeyForContext = (context = {}) =>
    resolveDesignReviewRuntimeSessionKey({
      shellContext: context,
    });

  const trayEventMatchesRuntimeState = (runtimeState = null, detail = {}) => {
    if (!runtimeState?.lastReviewState) return false;
    const normalizedDetail = asRecord(detail) || {};
    const tray = asRecord(normalizedDetail?.tray) || {};
    const context = asRecord(normalizedDetail?.context) || {};
    const request = asRecord(runtimeState.lastReviewState?.request) || {};
    const runtimeRequestId = readFirstString(
      runtimeState.activeRequestId,
      request?.requestId
    );
    const trayRequestId = readFirstString(tray?.requestId, normalizedDetail?.requestId);
    if (trayRequestId && runtimeRequestId && trayRequestId !== runtimeRequestId) {
      return false;
    }
    const eventTabId = normalizeTabId(context?.activeTabId);
    const runtimeTabId = normalizeTabId(
      readFirstString(
        runtimeState.sessionKey?.startsWith("tab:") ? runtimeState.sessionKey.slice(4) : "",
        runtimeState.lastCommunicationPayload?.tabId,
        request?.visibleCanvasContext?.activeTabId,
        request?.sessionId
      )
    );
    if (eventTabId && runtimeTabId && eventTabId !== runtimeTabId) {
      return false;
    }
    const eventRunDir = readFirstString(context?.runDir);
    const runtimeRunDir = readFirstString(
      runtimeState.sessionKey?.startsWith("run:") ? runtimeState.sessionKey.slice(4) : "",
      runtimeState.lastCommunicationPayload?.runDir,
      request?.visibleCanvasContext?.runDir
    );
    if (eventRunDir && runtimeRunDir && eventRunDir !== runtimeRunDir) {
      return false;
    }
    return true;
  };

  const runtimeStateForReviewState = (reviewState = {}) => {
    const requestId = readFirstString(reviewState?.request?.requestId);
    const sessionKey =
      (requestId && requestToSessionKey.get(requestId)) ||
      resolveDesignReviewRuntimeSessionKey({
        request: reviewState?.request,
        state: reviewState,
      });
    if (!sessionKey) return null;
    const runtimeState = stateForSession(sessionKey);
    runtimeState.lastReviewState = reviewState && typeof reviewState === "object" ? reviewState : null;
    if (requestId) {
      rememberRequest(requestId, sessionKey);
    }
    return runtimeState;
  };

  const runtimeStateForActiveTrayEvent = (detail = {}) => {
    const normalizedDetail = asRecord(detail) || {};
    const tray = asRecord(normalizedDetail?.tray) || {};
    if (tray.visible === false) return null;
    const trayRequestId = readFirstString(tray?.requestId, normalizedDetail?.requestId);
    const requestSessionKey = trayRequestId ? requestToSessionKey.get(trayRequestId) : "";
    const requestRuntimeState = stateForSession(requestSessionKey, { create: false });
    if (requestRuntimeState?.lastReviewState) {
      return trayEventMatchesRuntimeState(requestRuntimeState, normalizedDetail)
        ? requestRuntimeState
        : null;
    }
    const contextSessionKey = sessionKeyForContext(normalizedDetail?.context);
    if (!contextSessionKey) return null;
    const runtimeState = stateForSession(contextSessionKey, { create: false });
    if (!runtimeState?.lastReviewState) return null;
    if (!trayEventMatchesRuntimeState(runtimeState, normalizedDetail)) {
      return null;
    }
    return runtimeState;
  };

  return {
    stateForSession,
    rememberRequest,
    sessionKeyForContext,
    runtimeStateForReviewState,
    runtimeStateForActiveTrayEvent,
  };
}

function clearCommunicationTrayReviewDetails() {
  const tray = communicationTrayRoot();
  if (!tray) return false;
  tray.classList.remove("is-design-review-runtime");
  tray.classList.remove("is-collapsed");
  tray.dataset.reviewStatus = "idle";
  const head = tray.querySelector(".communication-proposal-tray-head");
  const title = tray.querySelector(".communication-proposal-tray-title");
  const headGroup = head?.querySelector(".design-review-runtime-head") || null;
  const headActions = head?.querySelector(".design-review-runtime-head-actions") || null;
  if (title && headGroup && title.parentElement === headGroup && head) {
    head.prepend(title);
  }
  if (title) title.textContent = EDIT_PROPOSALS_LABEL;
  headGroup?.remove();
  headActions?.remove();
  return true;
}

function syncCommunicationTray(runtimeState, state = {}, onAccept = null) {
  const trayState = mapDesignReviewStateToCommunicationTray(state);
  const shell = shellBridge();
  const anchor = activeTrayAnchor(
    runtimeState.lastCommunicationPayload,
    runtimeState.lastTrayAnchor
  );
  runtimeState.lastTrayAnchor = anchor || runtimeState.lastTrayAnchor || null;
  renderCommunicationTrayDetails(state, (proposal) => {
    if (typeof onAccept === "function") onAccept(proposal, runtimeState);
  });
  if (shell && typeof shell.showCommunicationProposalTray === "function" && trayState.requestId) {
    shell.showCommunicationProposalTray({
      visible: true,
      requestId: trayState.requestId,
      source: "review_runtime",
      anchor: runtimeState.lastTrayAnchor,
      slots: trayState.slots,
    });
  }
}

function renderReviewFailure(
  runtimeState,
  request = null,
  errorMessage = `${EDIT_PROPOSALS_LABEL} failed.`,
  onAccept = null,
  debugInfo = null
) {
  const failureRequest =
    (request && typeof request === "object" && { ...request }) ||
    (runtimeState?.activeRequestId || runtimeState?.sessionKey
      ? {
          requestId: runtimeState?.activeRequestId || null,
          sessionId: runtimeState?.sessionKey || null,
        }
      : null);
  const nextState = {
    status: "failed",
    request: failureRequest,
    slots: [
      {
        rank: 1,
        status: "failed",
        proposal: {
          label: "Review failed",
          why: clampText(errorMessage, 220),
        },
        error: clampText(errorMessage, 220),
        debugInfo: debugInfo && typeof debugInfo === "object" ? JSON.parse(JSON.stringify(debugInfo)) : null,
      },
    ],
  };
  runtimeState.lastReviewState = nextState;
  syncCommunicationTray(runtimeState, nextState, onAccept);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(REVIEW_STATE_EVENT, {
        detail: nextState,
      })
    );
  }
  return nextState;
}

export async function installDesignReviewBootstrap() {
  if (typeof window === "undefined" || window.__JUGGERNAUT_REVIEW__) {
    return window.__JUGGERNAUT_REVIEW__ || null;
  }

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
  const runtimeRegistry = createDesignReviewRuntimeRegistry();
  const runDesignReviewApply = createDesignReviewApplyRunner(providerRouter);

  const pipeline = createDesignReviewPipeline({
    providerRouter,
    memoryStore,
    uploadAnalysisCache,
    hashImage: (image) => hashImageRecord(image, pathHashCache),
    runApply: runDesignReviewApply,
    onApplyEvent: (detail) => {
      window.dispatchEvent(
        new CustomEvent(REVIEW_APPLY_EVENT, {
          detail,
        })
      );
    },
  });

  const warmupController = createUploadAnalysisWarmupController({
    cacheStore: uploadAnalysisCache,
    hashImage: (image) => hashImageRecord(image, pathHashCache),
    analyzeImage: ({ image, prompt }) =>
      providerRouter.runUploadAnalysis({
        image,
        prompt,
      }),
    onUpdate: (entry) => {
      window.dispatchEvent(new CustomEvent(REVIEW_UPLOAD_ANALYSIS_EVENT, { detail: entry }));
    },
  });

  const consentUi = ensureConsentUi();

  const maybeShowConsentPrompt = (snapshot = null) => {
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
  };

  const warmUploadAnalyses = async (snapshot = null) => {
    const shell = snapshot || shellSnapshot();
    if (!shell?.images?.length) return [];
    maybeShowConsentPrompt(shell);
    if (uploadAnalysisCache.getConsent() !== "granted") return [];
    return warmupController.warmImages(shell.images, {
      consent: "granted",
    });
  };

  const clearWarmupTimer = (runtimeState = null) => {
    if (!runtimeState?.warmupTimer) return;
    window.clearTimeout(runtimeState.warmupTimer);
    runtimeState.warmupTimer = null;
  };

  const queueWarmup = ({ snapshot = null, delayMs = 140, sessionKey = "" } = {}) => {
    const shell = snapshot || shellSnapshot();
    const resolvedSessionKey =
      readFirstString(sessionKey) ||
      resolveDesignReviewRuntimeSessionKey({
        shellContext: shell,
      });
    if (!resolvedSessionKey) return false;
    const runtimeState = runtimeRegistry.stateForSession(resolvedSessionKey);
    clearWarmupTimer(runtimeState);
    runtimeState.warmupTimer = window.setTimeout(() => {
      runtimeState.warmupTimer = null;
      const nextShell = snapshot || shellSnapshot();
      const activeSessionKey = resolveDesignReviewRuntimeSessionKey({
        shellContext: nextShell,
      });
      if (activeSessionKey !== resolvedSessionKey) return;
      void warmUploadAnalyses(nextShell);
    }, Math.max(0, Number(delayMs) || 0));
    return true;
  };

  const setConsent = async (value) => {
    uploadAnalysisCache.setConsent(value);
    consentUi.classList.add("hidden");
    if (value === "granted") {
      queueWarmup({ delayMs: 0 });
    }
    return value;
  };

  consentUi.querySelector('[data-review-consent="allow"]')?.addEventListener("click", () => {
    void setConsent("granted");
  });
  consentUi.querySelector('[data-review-consent="deny"]')?.addEventListener("click", () => {
    void setConsent("denied");
  });

  let acceptProposal = () => null;

  const syncRuntimeReviewState = (runtimeState = null, nextState = null) => {
    if (!runtimeState || !nextState || typeof nextState !== "object") {
      if (typeof window !== "undefined" && nextState && typeof nextState === "object") {
        window.dispatchEvent(
          new CustomEvent(REVIEW_STATE_EVENT, {
            detail: nextState,
          })
        );
      }
      return nextState;
    }
    runtimeState.lastReviewState = nextState;
    runtimeState.activeRequestId =
      readFirstString(nextState?.request?.requestId, runtimeState?.activeRequestId) || null;
    if (runtimeState.activeRequestId && runtimeState.sessionKey) {
      runtimeRegistry.rememberRequest(runtimeState.activeRequestId, runtimeState.sessionKey);
    }
    const activeSessionKey = runtimeRegistry.sessionKeyForContext(shellSnapshot());
    if (
      runtimeState.sessionKey === activeSessionKey &&
      runtimeState.activeRequestId &&
      readFirstString(nextState?.request?.requestId) === runtimeState.activeRequestId
    ) {
      syncCommunicationTray(runtimeState, nextState, acceptProposal);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(REVIEW_STATE_EVENT, {
          detail: nextState,
        })
      );
    }
    return nextState;
  };

  acceptProposal = (proposal, runtimeState = null) => {
    const reviewState =
      (runtimeState?.lastReviewState && typeof runtimeState.lastReviewState === "object"
        ? JSON.parse(JSON.stringify(runtimeState.lastReviewState))
        : pipeline.getState()) || {};
    const proposalId = readFirstString(proposal?.proposalId);
    const requestId =
      readFirstString(
        proposal?.requestId,
        reviewState?.request?.requestId,
        runtimeState?.activeRequestId,
        runtimeState?.lastReviewState?.request?.requestId
      ) || null;
    if (!proposalId || !requestId) return null;
    if (
      requestId &&
      readFirstString(reviewState?.activeApply?.requestId) === requestId &&
      readFirstString(reviewState?.activeApply?.status) === "running"
    ) {
      return null;
    }
    const memory = pipeline.acceptProposal(proposalId, {
      stylePatterns:
        proposal?.negativeConstraints?.filter((entry) =>
          /style|tone|lighting|material/i.test(String(entry || ""))
        ) || [],
      useCasePatterns: [proposal?.actionType].filter(Boolean),
      reviewState,
    });
    window.dispatchEvent(
      new CustomEvent(REVIEW_ACCEPT_EVENT, {
        detail: {
          proposal,
          memory,
          requestId,
          sessionKey: runtimeState?.sessionKey || null,
        },
      })
    );
    void pipeline.applyProposal(proposalId, {
      sessionKey: runtimeState?.sessionKey || null,
      reviewState,
      onStateChange: (nextState) => {
        syncRuntimeReviewState(runtimeState, nextState);
      },
    });
  };

  pipeline.subscribe((state) => {
    const runtimeState = runtimeRegistry.runtimeStateForReviewState(state);
    syncRuntimeReviewState(runtimeState, state);
  });

  const startReviewFromCommunication = async (detail = {}) => {
    const reviewPayload =
      asRecord(detail?.context) ||
      shellBridge()?.getCommunicationReviewPayload?.({
        requestId: detail?.requestId || null,
        source: detail?.source || "bridge_fallback",
      }) ||
      null;
    const snapshot = shellSnapshot();
    const sessionKey = resolveDesignReviewRuntimeSessionKey({
      shellContext: snapshot,
      reviewPayload,
      detail,
    });
    const runtimeState =
      runtimeRegistry.stateForSession(sessionKey || `request:${readFirstString(detail?.requestId)}`);
    runtimeState.lastCommunicationPayload = reviewPayload;
    runtimeState.lastTrayAnchor = activeTrayAnchor(reviewPayload, runtimeState.lastTrayAnchor);
    runtimeState.activeRequestId =
      readFirstString(detail?.requestId, reviewPayload?.requestId) || runtimeState.activeRequestId;
    runtimeRegistry.rememberRequest(runtimeState.activeRequestId, runtimeState.sessionKey);
    if (runtimeState.activeRequestId) {
      syncRuntimeReviewState(
        runtimeState,
        createPendingRuntimeReviewState(runtimeState.activeRequestId)
      );
    }

    if (!snapshot?.images?.length) {
      return renderReviewFailure(
        runtimeState,
        null,
        `Upload one image before opening ${EDIT_PROPOSALS_LABEL}.`,
        acceptProposal
      );
    }

    queueWarmup({ snapshot, delayMs: 0, sessionKey: runtimeState.sessionKey });
    const cachedImageAnalyses = await lookupCachedAnalyses(
      snapshot.images,
      uploadAnalysisCache,
      pathHashCache
    );
    const memorySummary = summarizeDesignReviewAccountMemory(
      readDesignReviewAccountMemory(memoryStore)
    );
    const visibleCanvasRef = await captureVisibleCanvasRef(
      readFirstString(reviewPayload?.runDir, snapshot.runDir)
    );
    const request = buildDesignReviewRequestFromCommunication({
      shellContext: snapshot,
      reviewPayload: reviewPayload || {
        requestId: detail?.requestId || null,
        source: detail?.source || "bridge_fallback",
      },
      visibleCanvasRef,
      cachedImageAnalyses,
      accountMemorySummary: memorySummary,
    });
    runtimeRegistry.rememberRequest(request?.requestId, runtimeState.sessionKey);

    try {
      return await pipeline.startReview({ request });
    } catch (error) {
      return renderReviewFailure(
        runtimeState,
        request,
        error?.message || error || `${EDIT_PROPOSALS_LABEL} failed to start.`,
        acceptProposal,
        error?.debugInfo || null
      );
    }
  };

  window.addEventListener(COMMUNICATION_REVIEW_REQUESTED_EVENT, (event) => {
    const detail = asRecord(event?.detail) || {};
    void startReviewFromCommunication(detail);
  });
  window.addEventListener(COMMUNICATION_PROPOSAL_TRAY_EVENT, (event) => {
    const runtimeState = runtimeRegistry.runtimeStateForActiveTrayEvent(event?.detail);
    if (!runtimeState?.lastReviewState) {
      clearCommunicationTrayReviewDetails();
      return;
    }
    renderCommunicationTrayDetails(runtimeState.lastReviewState, (proposal) => {
      acceptProposal(proposal, runtimeState);
    });
  });
  window.addEventListener(
    "drop",
    () => {
      queueWarmup({ delayMs: 180 });
    },
    true
  );
  window.addEventListener(
    "paste",
    () => {
      queueWarmup({ delayMs: 180 });
    },
    true
  );
  document.addEventListener(
    "change",
    (event) => {
      const target = event?.target;
      const isFileInput =
        Boolean(target?.matches?.('input[type="file"]')) ||
        String(target?.type || "").toLowerCase() === "file";
      if (!isFileInput) return;
      queueWarmup({ delayMs: 120 });
    },
    true
  );

  const bridge = {
    getState: () => {
      const activeSessionKey = runtimeRegistry.sessionKeyForContext(shellSnapshot());
      return (
        runtimeRegistry.stateForSession(activeSessionKey, { create: false })?.lastReviewState ||
        pipeline.getState()
      );
    },
    subscribe: (listener) => pipeline.subscribe(listener),
    startReviewFromShell(meta = {}) {
      return shellBridge()?.requestDesignReview?.(meta) || null;
    },
    startReviewFromCommunication,
    getUploadAnalysisConsent() {
      return uploadAnalysisCache.getConsent();
    },
    async setUploadAnalysisConsent(value = "denied") {
      return setConsent(value);
    },
    queueWarmup(meta = {}) {
      queueWarmup(meta);
      return true;
    },
  };

  window.__JUGGERNAUT_REVIEW__ = bridge;
  return bridge;
}

void installDesignReviewBootstrap();
