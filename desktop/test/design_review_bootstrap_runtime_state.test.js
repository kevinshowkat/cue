import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildDesignReviewRequest } from "../src/design_review_contract.js";

const here = dirname(fileURLToPath(import.meta.url));
const bootstrapPath = join(here, "..", "src", "design_review_bootstrap.js");
const bootstrap = readFileSync(bootstrapPath, "utf8");

function extractFunctionSource(name) {
  const markers = [
    `export async function ${name}(`,
    `async function ${name}(`,
    `export function ${name}(`,
    `function ${name}(`,
  ];
  const start = markers
    .map((marker) => bootstrap.indexOf(marker))
    .find((index) => index >= 0);
  assert.notEqual(start, undefined, `Could not find function ${name}`);
  const signatureStart = bootstrap.indexOf("(", start);
  assert.notEqual(signatureStart, -1, `Could not find signature for ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < bootstrap.length; index += 1) {
    const char = bootstrap[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth === 0 && char === "{") {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `Could not find body for ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < bootstrap.length; index += 1) {
    const char = bootstrap[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return bootstrap.slice(start, index + 1).replace(/^export\s+/, "");
    }
  }
  throw new Error(`Could not extract function ${name}`);
}

function instantiateFunction(name, deps = {}) {
  const source = extractFunctionSource(name);
  const keys = Object.keys(deps);
  const values = Object.values(deps);
  return new Function(...keys, `return (${source});`)(...values);
}

function createRuntimeRegistry() {
  const asRecord = instantiateFunction("asRecord");
  const readFirstString = instantiateFunction("readFirstString");
  const normalizeReviewSurfaceUiState = instantiateFunction("normalizeReviewSurfaceUiState", {
    asRecord,
    readFirstString,
  });
  const resolveDesignReviewRuntimeSessionKey = instantiateFunction(
    "resolveDesignReviewRuntimeSessionKey",
    {
      asRecord,
      readFirstString,
    }
  );
  const createFreshDesignReviewRuntimeState = instantiateFunction(
    "createFreshDesignReviewRuntimeState",
    {
      readFirstString,
      normalizeReviewSurfaceUiState,
    }
  );
  const createDesignReviewRuntimeRegistry = instantiateFunction(
    "createDesignReviewRuntimeRegistry",
    {
      Map,
      asRecord,
      readFirstString,
      resolveDesignReviewRuntimeSessionKey,
      createFreshDesignReviewRuntimeState,
    }
  );

  return createDesignReviewRuntimeRegistry();
}

function createReviewStateSelector() {
  const asRecord = instantiateFunction("asRecord");
  const readFirstString = instantiateFunction("readFirstString");
  const resolveDesignReviewRuntimeSessionKey = instantiateFunction(
    "resolveDesignReviewRuntimeSessionKey",
    {
      asRecord,
      readFirstString,
    }
  );
  return instantiateFunction("selectDesignReviewStateForSession", {
    readFirstString,
    resolveDesignReviewRuntimeSessionKey,
  });
}

function seedRuntimeRegistry(registry) {
  registry.rememberRequest("review-a", "tab:tab-a");
  registry.rememberRequest("review-b", "tab:tab-b");

  registry.runtimeStateForReviewState({
    request: {
      requestId: "review-a",
      sessionId: "tab-a",
      visibleCanvasContext: {
        runDir: "/tmp/run-a",
      },
    },
    status: "planning",
  });
  registry.runtimeStateForReviewState({
    request: {
      requestId: "review-b",
      sessionId: "tab-b",
      visibleCanvasContext: {
        runDir: "/tmp/run-b",
      },
    },
    status: "ready",
  });
}

test("review bootstrap runtime registry keeps tray state isolated by active tab", () => {
  const registry = createRuntimeRegistry();
  seedRuntimeRegistry(registry);

  const activeTabA = registry.runtimeStateForActiveTrayEvent({
    context: {
      activeTabId: "tab-a",
      runDir: "/tmp/run-a",
    },
    tray: {
      visible: true,
      requestId: "review-a",
    },
  });
  const activeTabB = registry.runtimeStateForActiveTrayEvent({
    context: {
      activeTabId: "tab-b",
      runDir: "/tmp/run-b",
    },
    tray: {
      visible: true,
      requestId: "review-b",
    },
  });
  const mismatchedTab = registry.runtimeStateForActiveTrayEvent({
    context: {
      activeTabId: "tab-b",
      runDir: "/tmp/run-b",
    },
    tray: {
      visible: true,
      requestId: "review-a",
    },
  });

  assert.equal(activeTabA?.sessionKey, "tab:tab-a");
  assert.equal(activeTabA?.activeRequestId, "review-a");
  assert.equal(activeTabA?.lastReviewState?.status, "planning");
  assert.equal(activeTabB?.sessionKey, "tab:tab-b");
  assert.equal(activeTabB?.activeRequestId, "review-b");
  assert.equal(activeTabB?.lastReviewState?.status, "ready");
  assert.equal(mismatchedTab, null);
});

test("review bootstrap runtime registry resolves tray state from requestId mapping when shell tray context loses activeTabId", () => {
  const registry = createRuntimeRegistry();
  seedRuntimeRegistry(registry);

  const resolved = registry.runtimeStateForActiveTrayEvent({
    context: {
      runDir: "/tmp/run-a",
    },
    tray: {
      visible: true,
      requestId: "review-a",
    },
  });

  assert.equal(resolved?.sessionKey, "tab:tab-a");
  assert.equal(resolved?.activeRequestId, "review-a");
  assert.equal(resolved?.lastReviewState?.status, "planning");
});

test("review bootstrap runtime registry rejects tray events with a mismatched request and active tab", () => {
  const registry = createRuntimeRegistry();
  seedRuntimeRegistry(registry);

  const mismatched = registry.runtimeStateForActiveTrayEvent({
    context: {
      activeTabId: "tab-b",
      runDir: "/tmp/run-b",
    },
    tray: {
      visible: true,
      requestId: "review-a",
    },
  });

  assert.equal(mismatched, null);
});

test("review bootstrap state selector does not leak another tab's in-flight review into a fresh fork", () => {
  const selectDesignReviewStateForSession = createReviewStateSelector();
  const registry = createRuntimeRegistry();
  seedRuntimeRegistry(registry);

  const leaked = selectDesignReviewStateForSession({
    activeSessionKey: "tab:tab-fork",
    runtimeRegistry: registry,
    pipeline: {
      getState() {
        return {
          request: {
            requestId: "review-a",
            sessionId: "tab-a",
            visibleCanvasContext: {
              runDir: "/tmp/run-a",
            },
          },
          status: "planning",
        };
      },
    },
    shellContext: {
      activeTabId: "tab-fork",
      runDir: "/tmp/run-fork",
    },
  });

  assert.equal(leaked, null);
});

test("review bootstrap debug payload collector preserves apply failure details in the tray state", () => {
  const readFirstString = instantiateFunction("readFirstString");
  const collectReviewDebugPayload = instantiateFunction("collectReviewDebugPayload", {
    readFirstString,
  });

  const payload = collectReviewDebugPayload({
    request: {
      requestId: "review-apply-debug",
    },
    status: "apply_failed",
    slots: [
      {
        rank: 1,
        status: "apply_failed",
        proposal: {
          label: "Retouch product",
        },
        error: "The final edit could not be rendered.",
        apply: {
          debugInfo: {
            route: {
              kind: "apply",
              provider: "google",
            },
            providerRequest: {
              model: "gemini-3.1-flash-image-preview",
            },
          },
        },
      },
    ],
    lastApplyEvent: {
      status: "apply_failed",
      debugInfo: {
        route: {
          kind: "apply",
        },
      },
    },
  });

  assert.equal(payload.requestId, "review-apply-debug");
  assert.equal(payload.failedSlots[0].failureStage, "apply");
  assert.equal(payload.failedSlots[0].debugInfo?.route?.kind, "apply");
  assert.equal(
    payload.failedSlots[0].debugInfo?.providerRequest?.model,
    "gemini-3.1-flash-image-preview"
  );
  assert.equal(payload.applyFailure?.status, "apply_failed");
});

test("review bootstrap slot summaries prioritize compact effect statements for ready proposals", () => {
  const clampText = instantiateFunction("clampText");
  const readFirstString = instantiateFunction("readFirstString");
  const proposalEffectText = instantiateFunction("proposalEffectText", {
    clampText,
    readFirstString,
  });
  const slotSummaryText = instantiateFunction("slotSummaryText", {
    clampText,
    readFirstString,
    proposalEffectText,
  });

  const readyCopy = slotSummaryText({
    status: "ready",
    proposal: {
      why: "The backdrop feels too busy and the subject is getting lost in the scene.",
      previewBrief: "Lift the subject and simplify the backdrop with a clean, brighter wall treatment.",
      applyBrief: "Replace the background with a clean, brighter wall and keep the subject unchanged.",
    },
  });
  const applyingCopy = slotSummaryText({
    status: "apply_running",
    proposal: {
      previewBrief: "Lift the subject and simplify the backdrop.",
    },
  });

  assert.equal(
    readyCopy,
    "Lift the subject and simplify the backdrop with a clean, brighter wall treatment."
  );
  assert.equal(applyingCopy, "Applying to the target image.");
});

test("review bootstrap collapses the runtime tray only while review work is busy", () => {
  const readFirstString = instantiateFunction("readFirstString");
  const shouldCollapseReviewTray = instantiateFunction("shouldCollapseReviewTray", {
    readFirstString,
  });

  assert.equal(shouldCollapseReviewTray({ status: "planning", slots: [] }), true);
  assert.equal(
    shouldCollapseReviewTray({
      status: "planning",
      slots: [{ status: "planning" }],
    }),
    true
  );
  assert.equal(
    shouldCollapseReviewTray({
      status: "apply_running",
      slots: [{ status: "apply_running" }],
    }),
    false
  );
  assert.equal(
    shouldCollapseReviewTray({
      status: "ready",
      slots: [{ status: "ready" }],
    }),
    false
  );
  assert.equal(
    shouldCollapseReviewTray({
      status: "apply_failed",
      slots: [{ status: "apply_failed" }],
    }),
    false
  );
});

test("review bootstrap renders runtime tray details before shell positioning to avoid shell-to-runtime flicker", () => {
  const callOrder = [];
  const syncCommunicationTray = instantiateFunction("syncCommunicationTray", {
    mapDesignReviewStateToCommunicationTray: () => ({
      requestId: "review-1",
      slots: [{ slotId: "slot-1", status: "skeleton" }],
    }),
    shellBridge: () => ({
      showCommunicationProposalTray(payload) {
        callOrder.push(["show", payload]);
      },
    }),
    activeTrayAnchor: () => ({
      kind: "titlebar_button",
      trayPlacement: "below",
    }),
    renderCommunicationTrayDetails: (_state, onAccept) => {
      callOrder.push(["render"]);
      assert.equal(typeof onAccept, "function");
    },
  });

  const runtimeState = {
    lastCommunicationPayload: null,
    lastTrayAnchor: null,
  };
  syncCommunicationTray(runtimeState, {
    request: { requestId: "review-1" },
    status: "planning",
    slots: [],
  });

  assert.equal(callOrder[0][0], "render");
  assert.equal(callOrder[1][0], "show");
  assert.equal(runtimeState.lastTrayAnchor?.kind, "titlebar_button");
});

test("review bootstrap shows only the active proposal card while apply is running and keeps the full tray format", () => {
  const asRecord = instantiateFunction("asRecord");
  const readFirstString = instantiateFunction("readFirstString");
  const clampText = instantiateFunction("clampText");
  const normalizeBounds = instantiateFunction("normalizeBounds", {
    asRecord,
  });
  const proposalEffectText = instantiateFunction("proposalEffectText", {
    clampText,
    readFirstString,
  });
  const slotSummaryText = instantiateFunction("slotSummaryText", {
    clampText,
    readFirstString,
    proposalEffectText,
  });
  const slotStatusLabel = instantiateFunction("slotStatusLabel", {
    readFirstString,
  });
  const shouldCollapseReviewTray = instantiateFunction("shouldCollapseReviewTray", {
    readFirstString,
  });
  const slotCanAcceptProposal = instantiateFunction("slotCanAcceptProposal");
  const normalizeReviewSurfaceUiState = instantiateFunction("normalizeReviewSurfaceUiState", {
    asRecord,
    readFirstString,
  });
  const reviewSurfaceSlotEntries = instantiateFunction("reviewSurfaceSlotEntries", {
    readFirstString,
  });
  const reviewSurfaceImageCatalog = instantiateFunction("reviewSurfaceImageCatalog", {
    asRecord,
  });
  const resolveReviewProposalSourceImage = instantiateFunction("resolveReviewProposalSourceImage", {
    readFirstString,
    asRecord,
    reviewSurfaceImageCatalog,
  });
  const resolveReviewProposalMedia = instantiateFunction("resolveReviewProposalMedia", {
    asRecord,
    readFirstString,
    resolveReviewProposalSourceImage,
  });
  const resolveReviewOverlayRects = instantiateFunction("resolveReviewOverlayRects", {
    readFirstString,
    asRecord,
    normalizeBounds,
  });

  const createClassList = () => {
    const tokens = new Set();
    return {
      add(...names) {
        names.forEach((name) => tokens.add(String(name)));
      },
      remove(...names) {
        names.forEach((name) => tokens.delete(String(name)));
      },
      toggle(name, force) {
        if (force === undefined) {
          if (tokens.has(name)) tokens.delete(name);
          else tokens.add(name);
          return tokens.has(name);
        }
        if (force) tokens.add(name);
        else tokens.delete(name);
        return Boolean(force);
      },
      contains(name) {
        return tokens.has(name);
      },
    };
  };

  const createNode = (className = "") => {
    const node = {
      className,
      classList: createClassList(),
      dataset: {},
      attributes: {},
      style: {
        setProperty(name, value) {
          this[name] = value;
        },
      },
      children: [],
      textContent: "",
      disabled: false,
      listeners: {},
      parentElement: null,
      append(...children) {
        children.forEach((child) => {
          if (!child) return;
          child.parentElement = this;
          this.children.push(child);
        });
      },
      appendChild(child) {
        if (!child) return child;
        child.parentElement = this;
        this.children.push(child);
        return child;
      },
      prepend(child) {
        if (!child) return child;
        child.parentElement = this;
        this.children.unshift(child);
        return child;
      },
      insertBefore(child, before) {
        if (!child) return child;
        child.parentElement = this;
        const index = this.children.indexOf(before);
        if (index < 0) {
          this.children.push(child);
        } else {
          this.children.splice(index, 0, child);
        }
        return child;
      },
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      addEventListener(name, handler) {
        this.listeners[name] = handler;
      },
      dispatch(name, event = {}) {
        const handler = this.listeners[name];
        if (typeof handler === "function") {
          handler({
            preventDefault() {},
            stopPropagation() {},
            key: "",
            target: this,
            ...event,
          });
        }
      },
      remove() {
        this.removed = true;
      },
      querySelector(selector) {
        if (!selector.startsWith(".")) return null;
        const classToken = selector.slice(1);
        const search = (current) => {
          for (const child of current.children || []) {
            const names = String(child.className || "")
              .split(/\s+/)
              .filter(Boolean);
            if (names.includes(classToken)) return child;
            const nested = search(child);
            if (nested) return nested;
          }
          return null;
        };
        return search(this);
      },
      replaceChildren(...children) {
        if (children.length === 1 && children[0]?.isFragment) {
          this.children = children[0].children.slice();
          this.children.forEach((child) => {
            child.parentElement = this;
          });
          return;
        }
        this.children = children.filter(Boolean);
        this.children.forEach((child) => {
          child.parentElement = this;
        });
      },
    };
    if (className) node.classList.add(...className.split(/\s+/).filter(Boolean));
    return node;
  };

  const trayTitle = createNode("communication-proposal-tray-title");
  const trayHead = createNode("communication-proposal-tray-head");
  trayHead.appendChild(trayTitle);
  const tray = createNode("communication-proposal-tray");
  tray.dataset.anchorKind = "titlebar_button";
  tray.appendChild(trayHead);
  const list = createNode("communication-proposal-slot-list");
  tray.appendChild(list);
  const trayUiCalls = [];
  const shellBridge = () => ({
    setCommunicationProposalTrayUi(next) {
      trayUiCalls.push(next);
      return next;
    },
    hydrateCommunicationProposalTrayMedia() {
      return true;
    },
    communicationReview: {
      getState() {
        return {
          proposalTray: {
            ui: {
              selectedProposalId: "proposal-2",
              compareMode: "proposal",
              showSafeAreas: false,
            },
          },
        };
      },
    },
  });
  const updateReviewSurfaceUi = instantiateFunction("updateReviewSurfaceUi", {
    asRecord,
    normalizeReviewSurfaceUiState,
    shellBridge,
    renderCommunicationTrayDetails() {},
  });
  const resolveReviewSurfaceUi = instantiateFunction("resolveReviewSurfaceUi", {
    asRecord,
    readFirstString,
    normalizeReviewSurfaceUiState,
    reviewSurfaceSlotEntries,
    shellBridge,
  });

  const renderCommunicationTrayDetails = instantiateFunction("renderCommunicationTrayDetails", {
    document: {
      createDocumentFragment() {
        return {
          isFragment: true,
          children: [],
          appendChild(child) {
            if (!child) return child;
            child.parentElement = this;
            this.children.push(child);
            return child;
          },
        };
      },
      createElement() {
        return createNode();
      },
    },
    ensureReviewStyle() {},
    communicationTrayRoot: () => tray,
    communicationTraySlotList: () => list,
    shouldCollapseReviewTray,
    readFirstString,
    normalizeReviewSurfaceUiState,
    reviewSurfaceSlotEntries,
    resolveReviewProposalSourceImage,
    resolveReviewProposalMedia,
    resolveReviewOverlayRects,
    resolveReviewSurfaceUi,
    updateReviewSurfaceUi,
    shellBridge,
    EDIT_PROPOSALS_LABEL: "Design Review",
    slotCanAcceptProposal,
    clampText,
    slotStatusLabel,
    slotSummaryText,
    requestAnimationFrame: (callback) => callback(),
    clampTrayIntoCanvasWrap() {
      throw new Error("clamp should not run for a titlebar-anchored tray");
    },
  });

  renderCommunicationTrayDetails({
    status: "ready",
    request: {
      requestId: "review-1",
      primaryImageId: "img-1",
      reservedSpaceIntent: {
        areas: [
          {
            reservedSpaceId: "safe-1",
            imageId: "img-1",
            bounds: { x: 960, y: 72, width: 320, height: 180 },
          },
        ],
      },
      visibleCanvasContext: {
        images: [
          {
            id: "img-1",
            path: "/tmp/source-frame.png",
            width: 1440,
            height: 900,
          },
        ],
      },
    },
    activeApply: {
      requestId: "review-1",
      proposalId: "proposal-2",
      status: "running",
    },
    slots: [
      {
        rank: 1,
        status: "ready",
        proposal: {
          proposalId: "proposal-1",
          label: "Warm the lighting",
          previewBrief: "Shift the color temperature warmer.",
        },
      },
      {
        rank: 2,
        status: "apply_running",
        proposal: {
          proposalId: "proposal-2",
          label: "Swap the backdrop",
          previewBrief: "Replace the backdrop with a clean studio wall.",
          previewImagePath: "/tmp/proposal-2.png",
          preserveRegionIds: ["safe-1"],
          changedRegionBounds: { x: 160, y: 120, width: 720, height: 520 },
          rationaleCodes: ["copy_lane_available"],
        },
      },
      {
        rank: 3,
        status: "ready",
        proposal: {
          proposalId: "proposal-3",
          label: "Tighten the crop",
          previewBrief: "Crop closer around the subject.",
        },
      },
    ],
  });

  assert.equal(tray.classList.contains("is-collapsed"), false);
  assert.equal(Boolean(tray.querySelector(".design-review-runtime-stage")), true);
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].dataset.slotIndex, "1");
  assert.equal(list.children[0].classList.contains("is-selected"), true);
  assert.equal(list.children[0].querySelector(".design-review-runtime-title")?.textContent, "Swap the backdrop");
  const compareOriginal = tray
    .querySelector(".design-review-runtime-compare")
    ?.children.find?.((child) => child?.dataset?.reviewSurfaceMode === "original");
  const safeAreaToggle = tray
    .querySelector(".design-review-runtime-compare")
    ?.children.find?.((child) => child?.dataset?.reviewSurfaceSafeArea === "1");
  assert.equal(compareOriginal?.textContent, "Original");
  assert.equal(safeAreaToggle?.textContent, "Safe Area");
  compareOriginal?.dispatch("click");
  safeAreaToggle?.dispatch("click");
  assert.equal(trayUiCalls[0]?.compareMode, "original");
  assert.equal(trayUiCalls[1]?.showSafeAreas, true);
});

test("review bootstrap seeds a pending runtime tray before async review work starts", () => {
  assert.match(
    bootstrap,
    /syncRuntimeReviewState\(\s*runtimeState,\s*createPendingRuntimeReviewState\(runtimeState\.activeRequestId\)\s*\)/
  );
});

test("review bootstrap builds structured Highlight and Make Space focus contracts from communication payloads", () => {
  const asRecord = instantiateFunction("asRecord");
  const readFirstString = instantiateFunction("readFirstString");
  const normalizeBounds = instantiateFunction("normalizeBounds", {
    asRecord,
  });
  const numericTimeToIso = instantiateFunction("numericTimeToIso");
  const normalizeVisibleImages = instantiateFunction("normalizeVisibleImages", {
    readFirstString,
    asRecord,
  });
  const normalizeCommunicationMarks = instantiateFunction("normalizeCommunicationMarks", {
    readFirstString,
    numericTimeToIso,
    normalizeBounds,
  });
  const normalizeCommunicationRegionCandidates = instantiateFunction(
    "normalizeCommunicationRegionCandidates",
    {
      readFirstString,
      asRecord,
      normalizeBounds,
    }
  );
  const buildDesignReviewRequestFromCommunication = instantiateFunction(
    "buildDesignReviewRequestFromCommunication",
    {
      normalizeVisibleImages,
      normalizeCommunicationMarks,
      normalizeCommunicationRegionCandidates,
      readFirstString,
      asRecord,
      buildDesignReviewRequest,
    }
  );

  const request = buildDesignReviewRequestFromCommunication({
    shellContext: {
      activeImageId: "img-1",
      images: [{ id: "img-1", path: "/tmp/source.png", label: "Hero" }],
    },
    reviewPayload: {
      requestId: "review-focus-1",
      tabId: "tab-a",
      runDir: "/tmp/run-focus",
      canvas: {
        mode: "single",
        activeImageId: "img-1",
        visibleImages: [{ id: "img-1", path: "/tmp/source.png", label: "Hero" }],
        selectedImageIds: ["img-1"],
      },
      communication: {
        tool: "highlight",
        marks: [
          {
            id: "mark-highlight",
            kind: "freehand_protect",
            imageId: "img-1",
            bounds: { x: 12, y: 20, width: 64, height: 88 },
          },
        ],
        regionSelections: [
          {
            imageId: "img-1",
            chosenCandidateId: "region-protect",
            candidates: [
              {
                id: "region-protect",
                bounds: { x: 10, y: 18, w: 70, h: 92 },
                active: true,
              },
            ],
          },
        ],
        focusInputs: [
          {
            focusInputId: "focus-highlight-explicit",
            kind: "highlight",
            imageId: "img-1",
            markIds: ["mark-highlight"],
            bounds: { x: 12, y: 20, width: 64, height: 88 },
          },
          {
            focusInputId: "focus-space-explicit",
            kind: "make_space",
            imageId: "img-1",
            bounds: { x: 180, y: 22, width: 110, height: 96 },
          },
        ],
        reservedSpaceIntent: {
          reservedSpaceIntentId: "space-intent-explicit",
          areas: [
            {
              reservedSpaceId: "space-explicit",
              imageId: "img-1",
              bounds: { x: 180, y: 22, width: 110, height: 96 },
            },
          ],
        },
      },
    },
  });

  assert.equal(request.reviewTool, "highlight");
  assert.deepEqual(request.focusInputIds, ["focus-highlight-explicit", "focus-space-explicit"]);
  assert.deepEqual(request.protectedRegionIds, []);
  assert.deepEqual(request.reservedSpaceAreaIds, ["space-explicit"]);
  assert.equal(request.communicationReview?.tool, "highlight");
  assert.equal(request.communicationReview?.focusInputs?.length, 2);
  assert.equal(request.communicationReview?.reservedSpaceIntent?.areas?.length, 1);
});

test("review bootstrap tray payload exposes Protect and Make Space runtime counts", () => {
  const asRecord = instantiateFunction("asRecord");
  const readFirstString = instantiateFunction("readFirstString");
  const normalizeBounds = instantiateFunction("normalizeBounds", {
    asRecord,
  });
  const clampText = instantiateFunction("clampText");
  const proposalEffectText = instantiateFunction("proposalEffectText", {
    clampText,
    readFirstString,
  });
  const slotSummaryText = instantiateFunction("slotSummaryText", {
    clampText,
    readFirstString,
    proposalEffectText,
  });
  const communicationTraySlotStatus = instantiateFunction("communicationTraySlotStatus");
  const mapDesignReviewStateToCommunicationTray = instantiateFunction(
    "mapDesignReviewStateToCommunicationTray",
    {
      readFirstString,
      clampText,
      normalizeBounds,
      slotSummaryText,
      communicationTraySlotStatus,
    }
  );

  const tray = mapDesignReviewStateToCommunicationTray({
    request: {
      requestId: "review-focus-tray",
      reviewTool: "make_space",
      primaryImageId: "img-safe",
      focusInputs: [{ focusInputId: "focus-1" }, { focusInputId: "focus-2" }],
      protectedRegions: [{ protectedRegionId: "protected-1" }],
      reservedSpaceIntent: {
        areas: [{ reservedSpaceId: "space-1" }],
      },
      visibleCanvasContext: {
        images: [
          {
            id: "img-safe",
            path: "/tmp/safe-area-source.png",
            width: 1440,
            height: 900,
          },
        ],
      },
    },
    status: "ready",
    slots: [
      {
        rank: 1,
        status: "ready",
        proposal: {
          proposalId: "proposal-1",
          label: "Open space",
          previewImagePath: "/tmp/proposal-open-space.png",
          previewBrief: "Create room on the right.",
          changedRegionBounds: { x: 160, y: 120, width: 420, height: 300 },
          preserveRegionIds: ["protected-1", "space-1"],
          rationaleCodes: ["copy_lane_available", "subject_preserved"],
          focusInputs: [{ focusInputId: "focus-1" }, { focusInputId: "focus-2" }],
          protectedRegions: [{ protectedRegionId: "protected-1" }],
          reservedSpaceIntent: {
            areas: [{ reservedSpaceId: "space-1" }],
          },
        },
      },
    ],
  });

  assert.equal(tray.reviewTool, "make_space");
  assert.equal(tray.focusInputCount, 2);
  assert.equal(tray.protectedRegionCount, 1);
  assert.equal(tray.reservedSpaceAreaCount, 1);
  assert.equal(tray.slots[0].focusInputCount, 2);
  assert.equal(tray.slots[0].protectedRegionCount, 1);
  assert.equal(tray.slots[0].reservedSpaceAreaCount, 1);
  assert.equal(tray.slots[0].previewImagePath, "/tmp/proposal-open-space.png");
  assert.deepEqual(tray.slots[0].changedRegionBounds, { x: 160, y: 120, width: 420, height: 300 });
  assert.deepEqual(tray.slots[0].preserveRegionIds, ["protected-1", "space-1"]);
  assert.deepEqual(tray.slots[0].rationaleCodes, ["copy_lane_available", "subject_preserved"]);
  assert.equal("sourcePath" in tray.slots[0], false);
  assert.equal("compareAvailable" in tray.slots[0], false);
});

test("review bootstrap writes planner traces into the run directory", async () => {
  const asRecord = instantiateFunction("asRecord");
  const cloneJson = instantiateFunction("cloneJson");
  const readFirstString = instantiateFunction("readFirstString");
  const sanitizePlannerTraceSegment = instantiateFunction("sanitizePlannerTraceSegment", {
    readFirstString,
  });
  const designReviewPlannerTraceFilename = instantiateFunction("designReviewPlannerTraceFilename", {
    asRecord,
    readFirstString,
    sanitizePlannerTraceSegment,
  });
  const writes = [];
  const writeDesignReviewPlannerTrace = instantiateFunction("writeDesignReviewPlannerTrace", {
    asRecord,
    cloneJson,
    readFirstString,
    designReviewPlannerTraceFilename,
    join: async (...parts) => parts.join("/"),
    writeTextFile: async (path, text) => {
      writes.push({ path, text });
    },
  });

  const outPath = await writeDesignReviewPlannerTrace({
    requestId: "review planner 1",
    attemptId: "attempt:42",
    phase: "succeeded",
    startedAt: "2026-03-26T15:08:00.000Z",
    completedAt: "2026-03-26T15:08:02.000Z",
    request: {
      requestId: "review planner 1",
      visibleCanvasContext: {
        runDir: "/tmp/review-run",
      },
    },
    prompt: "Plan the next edit.",
    images: ["/tmp/review-visible.png"],
    rawText: "{\"proposals\":[]}",
    rankedProposals: [],
    plannerDebugInfo: {
      route: {
        provider: "openai",
      },
    },
  });

  assert.equal(outPath, "/tmp/review-run/design-review-planner-review_planner_1-attempt_42.json");
  assert.equal(writes.length, 1);
  const payload = JSON.parse(writes[0].text);
  assert.equal(payload.schemaVersion, "cue.design_review_planner_trace.v1");
  assert.equal(payload.phase, "succeeded");
  assert.equal(payload.prompt, "Plan the next edit.");
  assert.deepEqual(payload.images, ["/tmp/review-visible.png"]);
  assert.equal(payload.plannerDebugInfo?.route?.provider, "openai");
  assert.equal(payload.request?.visibleCanvasContext?.runDir, "/tmp/review-run");
});
