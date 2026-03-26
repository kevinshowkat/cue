import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

function extractFunctionSource(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => app.indexOf(marker))
    .find((index) => index >= 0);
  assert.notEqual(start, undefined, `Could not find function ${name}`);
  const signatureStart = app.indexOf("(", start);
  assert.notEqual(signatureStart, -1, `Could not find signature for ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth === 0 && char === "{") {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `Could not find body for ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return app.slice(start, index + 1);
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

test("requestCommunicationDesignReview primes immediate communication-tray state and dispatches the canvas payload", () => {
  const trayCalls = [];
  const eventCalls = [];
  let suppressed = 0;
  const buttonAnchor = {
    kind: "titlebar_button",
    role: "design_review_button",
    trayPlacement: "below",
    canvasOverlayBounds: {
      x0: 640,
      y0: -32,
      w: 120,
      h: 36,
    },
  };
  const requestCommunicationDesignReview = instantiateFunction("requestCommunicationDesignReview", {
    state: {
      communication: {
        reviewRequestSeq: 0,
        lastReviewRequestedAt: 0,
        proposalTray: {
          visible: false,
          requestId: null,
        },
      },
    },
    resolveCommunicationReviewAnchor: () => ({ kind: "mark", x: 120, y: 88 }),
    designReviewButtonTrayAnchor: () => buttonAnchor,
    shouldPinCommunicationReviewTrayToTitlebar: (source = "") =>
      ["titlebar_pointer", "agent_runner", "bridge", "bridge_nested", "titlebar", "titlebar_keyboard"].includes(source),
    showToast: () => {
      throw new Error("requestCommunicationDesignReview should not toast when an anchor exists");
    },
    suppressBootstrapDesignReviewTray: () => {
      suppressed += 1;
      return true;
    },
    createFreshCommunicationState: () => ({
      proposalTray: {
        visible: false,
        requestId: null,
      },
    }),
    buildCommunicationReviewPendingSlots: () => [
      { status: "preparing", title: "Preparing review context" },
      { status: "planning", title: "Planning actions" },
      { status: "planning", title: "Preparing proposals" },
    ],
    setCommunicationProposalTray: (next, meta) => {
      trayCalls.push({ next, meta });
      return next;
    },
    buildCommunicationReviewPayload: ({ requestId, source }) => ({
      requestId,
      source,
      communication: {
        marks: [{ id: "mark-1" }],
      },
    }),
    dispatchJuggernautShellEvent: (name, detail) => {
      eventCalls.push({ name, detail });
    },
    COMMUNICATION_REVIEW_REQUESTED_EVENT: "juggernaut:design-review-requested",
  });

  const result = requestCommunicationDesignReview({ source: "titlebar_pointer" });

  assert.equal(result.ok, true);
  assert.equal(result.deduped, false);
  assert.equal(suppressed, 1);
  assert.equal(trayCalls.length, 1);
  assert.deepEqual(trayCalls[0].next.anchor, buttonAnchor);
  assert.deepEqual(
    trayCalls[0].next.slots.map((slot) => slot.status),
    ["preparing", "planning", "planning"]
  );
  assert.equal(trayCalls[0].meta.render, false);
  assert.equal(trayCalls[0].meta.dispatch, false);
  assert.equal(trayCalls[0].meta.requestRender, false);
  assert.equal(eventCalls.length, 1);
  assert.equal(eventCalls[0].name, "juggernaut:design-review-requested");
  assert.equal(eventCalls[0].detail.context.requestId, result.requestId);
  assert.equal(eventCalls[0].detail.context.source, "titlebar_pointer");
});

test("communication tray stays pinned below the titlebar button while its width changes", () => {
  const trayEl = {
    classList: {
      contains() {
        return false;
      },
      toggle() {},
    },
    style: {},
    dataset: {},
    offsetWidth: 220,
    offsetHeight: 120,
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const communicationTrayAnchorPlacement = instantiateFunction("communicationTrayAnchorPlacement");
  const state = {
    communication: {
      proposalTray: {
        anchorLockCss: null,
        anchorLockSignature: "",
      },
    },
  };
  const positionCommunicationProposalTrayElement = instantiateFunction("positionCommunicationProposalTrayElement", {
    state,
    els: {
      canvasWrap: { clientWidth: 900, clientHeight: 600 },
      brandStrip: {
        getBoundingClientRect: () => ({ bottom: 46 }),
      },
    },
    clamp,
    communicationTrayAnchorPlacement,
    clearCommunicationProposalTrayAnchorLock: (tray = null) => {
      if (!tray || typeof tray !== "object") return tray || null;
      tray.anchorLockCss = null;
      tray.anchorLockSignature = "";
      return tray;
    },
    communicationProposalTrayAnchorLockSignature: () => "titlebar:below:900:600",
    communicationTrayAnchorPinnedToTitlebar: (anchor = null) =>
      String(anchor?.kind || "").trim().toLowerCase() === "titlebar_button",
    designReviewButtonTrayAnchor: () => ({
      kind: "titlebar_button",
      trayPlacement: "below",
      canvasOverlayBounds: {
        x0: 710,
        y0: -24,
        w: 140,
        h: 36,
      },
    }),
    communicationAnchorCanvasCss: () => ({ x: 780, y: -6 }),
  });
  const anchor = {
    kind: "titlebar_button",
    trayPlacement: "below",
    canvasOverlayBounds: {
      x0: 710,
      y0: -24,
      w: 140,
      h: 36,
    },
  };

  positionCommunicationProposalTrayElement(trayEl, anchor, { x: 780, y: -6 });
  assert.equal(trayEl.dataset.anchorPlacement, "below");
  assert.equal(trayEl.style.left, "668px");
  assert.equal(trayEl.style.top, "45px");
  assert.deepEqual(state.communication.proposalTray.anchorLockCss, { x: 668, y: 45 });

  trayEl.offsetWidth = 160;
  positionCommunicationProposalTrayElement(trayEl, anchor, { x: 780, y: -6 });

  assert.equal(trayEl.style.left, "668px");
  assert.equal(trayEl.style.top, "45px");
});

test("communication tray drops below the fixed timeline band instead of overlapping it", () => {
  const trayEl = {
    classList: {
      contains() {
        return false;
      },
      toggle() {},
    },
    style: {},
    dataset: {},
    offsetWidth: 220,
    offsetHeight: 180,
  };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const communicationTrayAnchorPlacement = instantiateFunction("communicationTrayAnchorPlacement");
  const state = {
    communication: {
      proposalTray: {
        anchorLockCss: null,
        anchorLockSignature: "",
      },
    },
  };
  const positionCommunicationProposalTrayElement = instantiateFunction("positionCommunicationProposalTrayElement", {
    state,
    els: {
      canvasWrap: { clientWidth: 900, clientHeight: 600 },
      brandStrip: {
        getBoundingClientRect: () => ({ bottom: 46 }),
      },
    },
    clamp,
    communicationTrayAnchorPlacement,
    clearCommunicationProposalTrayAnchorLock: (tray = null) => {
      if (!tray || typeof tray !== "object") return tray || null;
      tray.anchorLockCss = null;
      tray.anchorLockSignature = "";
      return tray;
    },
    communicationProposalTrayAnchorLockSignature: () => "titlebar:below:900:600",
    communicationTrayAnchorPinnedToTitlebar: (anchor = null) =>
      String(anchor?.kind || "").trim().toLowerCase() === "titlebar_button",
    designReviewButtonTrayAnchor: () => ({
      kind: "titlebar_button",
      trayPlacement: "below",
      canvasOverlayBounds: {
        x0: 710,
        y0: -24,
        w: 140,
        h: 36,
      },
    }),
    communicationAnchorCanvasCss: () => ({ x: 780, y: -6 }),
    timelineDockCollisionBoundsCss: () => ({
      left: 24,
      top: 0,
      right: 700,
      bottom: 104,
      width: 676,
      height: 104,
    }),
    DESIGN_REVIEW_TIMELINE_CLEARANCE_PX: 14,
  });
  const anchor = {
    kind: "titlebar_button",
    trayPlacement: "below",
    canvasOverlayBounds: {
      x0: 710,
      y0: -24,
      w: 140,
      h: 36,
    },
  };

  positionCommunicationProposalTrayElement(trayEl, anchor, { x: 780, y: -6 });

  assert.equal(trayEl.style.left, "668px");
  assert.equal(trayEl.style.top, "118px");
  assert.deepEqual(state.communication.proposalTray.anchorLockCss, { x: 668, y: 118 });
});

test("bootstrap review-state sync keeps the communication tray authoritative and hides the fixed bootstrap tray", () => {
  const trayCalls = [];
  let suppressed = 0;
  const syncCommunicationProposalTrayFromReviewState = instantiateFunction(
    "syncCommunicationProposalTrayFromReviewState",
    {
      suppressBootstrapDesignReviewTray: () => {
        suppressed += 1;
        return true;
      },
      state: {
        communication: {
          proposalTray: {
            visible: true,
            requestId: "req-7",
            anchor: { kind: "mark", x: 44, y: 55 },
          },
        },
      },
      createFreshCommunicationState: () => ({
        proposalTray: {
          visible: false,
          requestId: null,
          anchor: null,
        },
      }),
      resolveCommunicationReviewAnchor: () => ({ kind: "fallback" }),
      buildCommunicationProposalSlotsFromReviewState: (reviewState) => [
        { slotId: "slot-1", status: reviewState.status || "planning" },
      ],
      setCommunicationProposalTray: (next, meta) => {
        trayCalls.push({ next, meta });
        return next;
      },
    }
  );

  syncCommunicationProposalTrayFromReviewState(
    {
      status: "planning",
      slots: [],
    },
    { source: "design_review_bootstrap_state" }
  );

  assert.equal(suppressed, 1);
  assert.equal(trayCalls.length, 1);
  assert.equal(trayCalls[0].next.requestId, "req-7");
  assert.equal(trayCalls[0].meta.source, "design_review_bootstrap_state");
});

test("titlebar Design review primes the communication tray before bootstrap review work starts", () => {
  assert.match(app, /function suppressNextDesignReviewTitlebarClick\(\) \{/);
  assert.match(app, /function startBootstrapDesignReview\(request = null,\s*\{ source = "titlebar" \} = \{\}\) \{/);
  assert.match(app, /function triggerCommunicationDesignReviewFromTitlebar\(\{ source = "titlebar" \} = \{\}\) \{/);
  assert.match(app, /function communicationTrayAnchorPinnedToTitlebar\(anchor = null\) \{/);
  assert.match(app, /function shouldPinCommunicationReviewTrayToTitlebar\(source = ""\) \{/);
  assert.match(app, /if \(normalizedSource === "agent_runner"\) return true;/);
  assert.match(app, /els\.sessionTabDesignReview\.addEventListener\("pointerup",\s*\(event\)\s*=>\s*\{/);
  assert.match(app, /suppressNextDesignReviewTitlebarClick\(\);\s*triggerCommunicationDesignReviewFromTitlebar\(\{ source: "titlebar_pointer" \}\);/);
  assert.match(app, /els\.sessionTabDesignReview\.addEventListener\("keydown",\s*\(event\)\s*=>\s*\{/);
  assert.match(app, /triggerCommunicationDesignReviewFromTitlebar\(\{ source: "titlebar_keyboard" \}\);/);
  assert.match(app, /triggerCommunicationDesignReviewFromTitlebar\(\{ source: "titlebar" \}\);/);
  assert.match(app, /const pinToTitlebar = shouldPinCommunicationReviewTrayToTitlebar\(source\);/);
  assert.match(app, /!communicationTrayAnchorPinnedToTitlebar\(state\.communication\?\.proposalTray\?\.anchor\)/);
  assert.match(app, /window\.addEventListener\(DESIGN_REVIEW_BOOTSTRAP_STATE_EVENT,\s*\(event\)\s*=>\s*\{/);
});

test("explicit engine-backed actions still guard themselves with ensureEngineSpawned", () => {
  assert.match(app, /const ok = await ensureEngineSpawned\(\{ reason: `\$\{actionLabel\} apply` \}\);/);
  assert.match(app, /const okEngine = await ensureEngineSpawned\(\{ reason: "extract dna" \}\);/);
  assert.match(app, /const okEngine = await ensureEngineSpawned\(\{ reason: "soul leech" \}\);/);
  assert.match(app, /const ok = await ensureEngineSpawned\(\{ reason: "variations" \}\);/);
});
