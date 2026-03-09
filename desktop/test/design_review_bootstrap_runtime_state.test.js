import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bootstrapPath = join(here, "..", "src", "design_review_bootstrap.js");
const bootstrap = readFileSync(bootstrapPath, "utf8");

function extractFunctionSource(name) {
  const markers = [`export function ${name}(`, `function ${name}(`];
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
      status: "previewing",
      slots: [{ status: "preview_running" }],
    }),
    true
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

test("review bootstrap seeds a pending runtime tray before async review work starts", () => {
  assert.match(
    bootstrap,
    /syncRuntimeReviewState\(\s*runtimeState,\s*createPendingRuntimeReviewState\(runtimeState\.activeRequestId\)\s*\)/
  );
});
