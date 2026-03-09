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
import { TABBED_SESSIONS_CHANGED_EVENT } from "./tabbed_sessions.js";

const REVIEW_CONSENT_ID = "design-review-consent";
const REVIEW_STYLE_ID = "design-review-style";
const REVIEW_STATE_EVENT = "juggernaut:design-review-state";
const REVIEW_ACCEPT_EVENT = "juggernaut:design-review-accept";
const REVIEW_UPLOAD_ANALYSIS_EVENT = "juggernaut:upload-analysis-updated";
const COMMUNICATION_REVIEW_REQUESTED_EVENT = "juggernaut:design-review-requested";
const COMMUNICATION_PROPOSAL_TRAY_EVENT = "juggernaut:communication-proposal-tray-changed";

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
#communication-proposal-tray.is-design-review-runtime {
  width: min(388px, calc(100vw - 34px));
  min-width: 296px;
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
#communication-proposal-tray.is-design-review-runtime::after {
  border-right-color: rgba(203, 212, 222, 0.94);
  border-bottom-color: rgba(203, 212, 222, 0.94);
}
#communication-proposal-tray.is-design-review-runtime .communication-proposal-tray-head {
  align-items: flex-start;
  margin-bottom: 12px;
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
}
.design-review-runtime-meta {
  font-size: 11px;
  color: rgba(86, 101, 121, 0.74);
}
.design-review-runtime-card {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
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
.communication-proposal-slot[data-review-status="failed"] .design-review-runtime-status {
  background: rgba(255, 218, 218, 0.9);
  color: rgba(162, 49, 49, 0.92);
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
      Allow background upload analysis to improve review ranking and region hints. This stays opportunistic and never blocks Design review.
    </div>
    <div class="design-review-consent-actions">
      <button type="button" class="design-review-consent-allow" data-review-consent="allow">Allow</button>
      <button type="button" class="design-review-consent-deny" data-review-consent="deny">Not Now</button>
    </div>
  `;
  document.body.appendChild(root);
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
        createdByTool: "marker",
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
    communicationReview: asRecord(reviewPayload?.communication)
      ? {
          ...reviewPayload.communication,
          latestAnchor: asRecord(reviewPayload.communication.latestAnchor)
            ? { ...reviewPayload.communication.latestAnchor }
            : null,
          resolvedTarget: asRecord(reviewPayload.communication.resolvedTarget)
            ? { ...reviewPayload.communication.resolvedTarget }
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
  if (status === "failed") return "Failed";
  if (status === "preview_running") return "Rendering";
  if (status === "preview_pending") return "Queued";
  if (status === "planning") return "Planning";
  return "Loading";
}

function slotSummaryText(slot = {}) {
  return clampText(
    slot?.error || slot?.proposal?.why || "Waiting for planner and previews.",
    220
  );
}

export function mapDesignReviewStateToCommunicationTray(state = {}) {
  const slots = Array.isArray(state?.slots) ? state.slots : [];
  return {
    requestId: readFirstString(state?.request?.requestId) || null,
    status: readFirstString(state?.status) || "idle",
    slots: slots.map((slot, index) => ({
      slotId: readFirstString(slot?.slotId) || `design-review-slot-${index + 1}`,
      status:
        slot?.status === "ready"
          ? "ready"
          : slot?.status === "failed"
            ? "failed"
            : "skeleton",
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

function renderCommunicationTrayDetails(state = {}, onAccept = null) {
  ensureReviewStyle();
  const tray = communicationTrayRoot();
  const list = communicationTraySlotList();
  if (!tray || !list) return;
  tray.classList.add("is-design-review-runtime");
  tray.dataset.reviewStatus = readFirstString(state?.status) || "idle";

  const head = tray.querySelector(".communication-proposal-tray-head");
  const title = tray.querySelector(".communication-proposal-tray-title");
  if (title) title.textContent = "Design Review";
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
    let meta = head.querySelector(".design-review-runtime-meta");
    if (!meta) {
      meta = document.createElement("div");
      meta.className = "design-review-runtime-meta";
      headGroup.appendChild(meta);
    }
    const imageId = readFirstString(state?.request?.primaryImageId);
    meta.textContent = imageId
      ? `${slotStatusLabel(state?.status)} · ${imageId}`
      : slotStatusLabel(state?.status);
  }

  const slots = Array.isArray(state?.slots) ? state.slots : [];
  const cards = Array.from(list.children);
  slots.forEach((slot, index) => {
    const card = cards[index];
    if (!card) return;
    card.dataset.reviewStatus = readFirstString(slot?.status) || "skeleton";
    card.classList.toggle("is-skeleton", !["ready", "failed"].includes(String(slot?.status || "")));
    card.classList.toggle("is-failed", String(slot?.status || "") === "failed");
    card.replaceChildren();

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

    if (slot?.proposal && (slot?.status === "ready" || slot?.status === "failed")) {
      const actions = document.createElement("div");
      actions.className = "design-review-runtime-actions";
      const accept = document.createElement("button");
      accept.type = "button";
      accept.className = "design-review-runtime-action";
      accept.textContent = slot?.status === "ready" ? "Apply via Runtime" : "Accept Intent";
      accept.addEventListener("click", () => {
        if (typeof onAccept === "function") onAccept(slot.proposal);
      });
      actions.appendChild(accept);
      copy.appendChild(actions);
    }

    layout.append(media, copy);
    card.appendChild(layout);
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

function syncCommunicationTray(runtimeState, state = {}, onAccept = null) {
  const trayState = mapDesignReviewStateToCommunicationTray(state);
  const shell = shellBridge();
  const anchor = activeTrayAnchor(
    runtimeState.lastCommunicationPayload,
    runtimeState.lastTrayAnchor
  );
  if (shell && typeof shell.showCommunicationProposalTray === "function" && trayState.requestId) {
    runtimeState.lastTrayAnchor = anchor || runtimeState.lastTrayAnchor || null;
    shell.showCommunicationProposalTray({
      visible: true,
      requestId: trayState.requestId,
      source: "review_runtime",
      anchor: runtimeState.lastTrayAnchor,
      slots: trayState.slots,
    });
  }
  renderCommunicationTrayDetails(state, onAccept);
}

function renderReviewFailure(runtimeState, request = null, errorMessage = "Design review failed.", onAccept = null) {
  const nextState = {
    status: "failed",
    request,
    slots: [
      {
        rank: 1,
        status: "failed",
        proposal: {
          label: "Review failed",
          why: clampText(errorMessage, 220),
        },
        error: clampText(errorMessage, 220),
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
  const runtimeState = {
    lastCommunicationPayload: null,
    lastReviewState: null,
    lastTrayAnchor: null,
    activeRequestId: null,
    warmupTimer: null,
  };

  const pipeline = createDesignReviewPipeline({
    providerRouter,
    memoryStore,
    uploadAnalysisCache,
    hashImage: (image) => hashImageRecord(image, pathHashCache),
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

  const queueWarmup = ({ snapshot = null, delayMs = 140 } = {}) => {
    if (runtimeState.warmupTimer) {
      window.clearTimeout(runtimeState.warmupTimer);
      runtimeState.warmupTimer = null;
    }
    runtimeState.warmupTimer = window.setTimeout(() => {
      runtimeState.warmupTimer = null;
      void warmUploadAnalyses(snapshot);
    }, Math.max(0, Number(delayMs) || 0));
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

  const acceptProposal = (proposal) => {
    const memory = pipeline.acceptProposal(proposal?.proposalId, {
      stylePatterns:
        proposal?.negativeConstraints?.filter((entry) =>
          /style|tone|lighting|material/i.test(String(entry || ""))
        ) || [],
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
    runtimeState.lastReviewState = state;
    if (runtimeState.activeRequestId && readFirstString(state?.request?.requestId) === runtimeState.activeRequestId) {
      syncCommunicationTray(runtimeState, state, acceptProposal);
    }
    window.dispatchEvent(
      new CustomEvent(REVIEW_STATE_EVENT, {
        detail: state,
      })
    );
  });

  const startReviewFromCommunication = async (detail = {}) => {
    const reviewPayload =
      asRecord(detail?.context) ||
      shellBridge()?.getCommunicationReviewPayload?.({
        requestId: detail?.requestId || null,
        source: detail?.source || "bridge_fallback",
      }) ||
      null;
    runtimeState.lastCommunicationPayload = reviewPayload;
    runtimeState.lastTrayAnchor = activeTrayAnchor(reviewPayload, runtimeState.lastTrayAnchor);
    runtimeState.activeRequestId =
      readFirstString(detail?.requestId, reviewPayload?.requestId) || runtimeState.activeRequestId;

    const snapshot = shellSnapshot();
    if (!snapshot?.images?.length) {
      return renderReviewFailure(
        runtimeState,
        null,
        "Upload one image before running Design review.",
        acceptProposal
      );
    }

    queueWarmup({ snapshot, delayMs: 0 });
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

    try {
      return await pipeline.startReview({ request });
    } catch (error) {
      return renderReviewFailure(
        runtimeState,
        request,
        error?.message || error || "Design review failed to start.",
        acceptProposal
      );
    }
  };

  window.addEventListener(COMMUNICATION_REVIEW_REQUESTED_EVENT, (event) => {
    const detail = asRecord(event?.detail) || {};
    void startReviewFromCommunication(detail);
  });
  window.addEventListener(COMMUNICATION_PROPOSAL_TRAY_EVENT, () => {
    if (runtimeState.lastReviewState) {
      renderCommunicationTrayDetails(runtimeState.lastReviewState, acceptProposal);
    }
  });
  window.addEventListener("juggernaut:shell-ready", () => {
    queueWarmup({ delayMs: 0 });
  });
  window.addEventListener(TABBED_SESSIONS_CHANGED_EVENT, () => {
    queueWarmup({ delayMs: 40 });
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
  window.addEventListener("focus", () => {
    queueWarmup({ delayMs: 160 });
  });
  document.addEventListener(
    "change",
    () => {
      queueWarmup({ delayMs: 120 });
    },
    true
  );

  const bridge = {
    getState: () => pipeline.getState(),
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
