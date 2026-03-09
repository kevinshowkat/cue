import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
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

function buildReviewApplyHarness({
  activeTabId = "tab-a",
  pendingRequestId = "review-1",
  pendingSessionKey = "tab:tab-a",
  targetPath = "/tmp/source.png",
} = {}) {
  const state = {
    activeTabId,
    runDir: "/runs/a",
    communication: {
      proposalTray: {
        requestId: pendingRequestId,
      },
    },
    designReviewApply: {
      status: "running",
      sessionKey: pendingSessionKey,
      tabId: pendingSessionKey.startsWith("tab:") ? pendingSessionKey.slice(4) : activeTabId,
      requestId: pendingRequestId,
      proposalId: "proposal-1",
      targetImageId: "img-1",
      referenceImageIds: ["img-2"],
      proposal: {
        proposalId: "proposal-1",
        label: "Swap background",
        actionType: "background_replace",
      },
      request: {
        requestId: pendingRequestId,
        sessionId: pendingSessionKey.replace(/^tab:/, ""),
        primaryImageId: "img-1",
        visibleCanvasContext: {
          images: [
            { id: "img-1", path: targetPath },
            { id: "img-2", path: "/tmp/ref.png" },
          ],
        },
      },
    },
    imagesById: new Map([
      [
        "img-1",
        {
          id: "img-1",
          path: targetPath,
          receiptPath: "/tmp/old-receipt.json",
          kind: "upload",
          source: "upload",
          label: "Hero",
          timelineNodeId: "tl-1",
        },
      ],
    ]),
    lastCostLatency: null,
  };
  const cloneToolRuntimeValue = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
  const asRecord = instantiateFunction("asRecord");
  const readFirstString = instantiateFunction("readFirstString");
  const readFirstNumber = instantiateFunction("readFirstNumber");
  const uniqueStringList = instantiateFunction("uniqueStringList", { readFirstString, Set });
  const createFreshDesignReviewApplyState = instantiateFunction("createFreshDesignReviewApplyState");
  const cloneDesignReviewApplyState = instantiateFunction("cloneDesignReviewApplyState", {
    asRecord,
    readFirstString,
    readFirstNumber,
    uniqueStringList,
    cloneToolRuntimeValue,
    createFreshDesignReviewApplyState,
  });
  const currentDesignReviewApplySessionKey = instantiateFunction("currentDesignReviewApplySessionKey", {
    readFirstString,
    state,
  });
  const designReviewApplyActionLabel = instantiateFunction("designReviewApplyActionLabel", {
    readFirstString,
  });
  const normalizeDesignReviewApplyEventDetail = instantiateFunction("normalizeDesignReviewApplyEventDetail", {
    asRecord,
    cloneToolRuntimeValue,
    cloneDesignReviewApplyState,
    readFirstString,
    readFirstNumber,
    uniqueStringList,
    currentDesignReviewApplySessionKey,
    state,
  });
  const designReviewApplyEventMatchesActiveTab = instantiateFunction("designReviewApplyEventMatchesActiveTab", {
    cloneDesignReviewApplyState,
    currentDesignReviewApplySessionKey,
    readFirstString,
    state,
  });
  const updateDesignReviewApplyCostLatency = instantiateFunction("updateDesignReviewApplyCostLatency", {
    readFirstString,
    readFirstNumber,
    state,
  });

  const receiptCalls = [];
  const replaceCalls = [];
  const timelineCalls = [];
  const clearCalls = [];
  const statusCalls = [];
  const toastCalls = [];
  const topMetricCalls = [];
  let processActionQueueCalls = 0;

  const clearDesignReviewApplyState = ({ capture = true, publish = true } = {}) => {
    clearCalls.push({ capture, publish });
    state.designReviewApply = createFreshDesignReviewApplyState();
    return state.designReviewApply;
  };
  const writeDesignReviewApplyReceipt = async (payload = {}) => {
    receiptCalls.push(payload);
    return "/runs/a/receipt-review-apply.json";
  };
  const replaceImageInPlace = async (targetId, options = {}) => {
    replaceCalls.push({ targetId, options });
    const item = state.imagesById.get(targetId);
    if (item) {
      item.path = options.path;
      item.receiptPath = options.receiptPath;
      item.kind = options.kind;
      item.label = options.label;
    }
    return true;
  };
  const recordTimelineNode = (payload = {}) => {
    timelineCalls.push(payload);
    return "tl-2";
  };
  const ingestTopMetricsFromReceiptPath = async (...args) => {
    topMetricCalls.push(args);
  };
  const setStatus = (message, isError = false) => {
    statusCalls.push({ message, isError });
  };
  const showToast = (message, kind, duration) => {
    toastCalls.push({ message, kind, duration });
  };
  const processActionQueue = async () => {
    processActionQueueCalls += 1;
  };

  const applyAcceptedDesignReviewOutput = instantiateFunction("applyAcceptedDesignReviewOutput", {
    cloneDesignReviewApplyState,
    normalizeDesignReviewApplyEventDetail,
    designReviewApplyEventMatchesActiveTab,
    readFirstString,
    designReviewApplyActionLabel,
    writeDesignReviewApplyReceipt,
    replaceImageInPlace,
    recordTimelineNode,
    updateDesignReviewApplyCostLatency,
    ingestTopMetricsFromReceiptPath,
    clearDesignReviewApplyState,
    setStatus,
    showToast,
    processActionQueue,
    basename,
    state,
    removeFile: async () => {},
    DESIGN_REVIEW_APPLY_SOURCE: "design_review_apply",
  });

  return {
    state,
    receiptCalls,
    replaceCalls,
    timelineCalls,
    clearCalls,
    statusCalls,
    toastCalls,
    topMetricCalls,
    get processActionQueueCalls() {
      return processActionQueueCalls;
    },
    applyAcceptedDesignReviewOutput,
  };
}

test("review apply success replaces the target image in place and records a timeline-backed receipt", async () => {
  const harness = buildReviewApplyHarness();

  const ok = await harness.applyAcceptedDesignReviewOutput({
    phase: "succeeded",
    sessionKey: "tab:tab-a",
    requestId: "review-1",
    proposal: {
      proposalId: "proposal-1",
      label: "Swap background",
      actionType: "background_replace",
    },
    request: {
      requestId: "review-1",
      sessionId: "tab-a",
      primaryImageId: "img-1",
      visibleCanvasContext: {
        images: [
          { id: "img-1", path: "/tmp/source.png" },
          { id: "img-2", path: "/tmp/ref.png" },
        ],
      },
    },
    targetImageId: "img-1",
    referenceImageIds: ["img-2"],
    outputPath: "/tmp/out.png",
    provider: "google",
    requestedModel: "gemini-nano-banana-2",
    normalizedModel: "gemini-nano-banana-2",
    cost_total_usd: 0.12,
    latency_per_image_s: 3.4,
  });

  assert.equal(ok, true);
  assert.equal(harness.receiptCalls.length, 1);
  assert.equal(harness.receiptCalls[0].targetImageId, "img-1");
  assert.deepEqual(harness.receiptCalls[0].referenceImageIds, ["img-2"]);
  assert.equal(harness.replaceCalls.length, 1);
  assert.equal(harness.replaceCalls[0].targetId, "img-1");
  assert.equal(harness.replaceCalls[0].options.path, "/tmp/out.png");
  assert.equal(harness.replaceCalls[0].options.label, "Hero");
  assert.equal(harness.timelineCalls.length, 1);
  assert.deepEqual(harness.timelineCalls[0].parents, ["tl-1"]);
  assert.equal(harness.timelineCalls[0].imageId, "img-1");
  assert.equal(harness.state.imagesById.get("img-1")?.source, "design_review_apply");
  assert.equal(harness.state.imagesById.get("img-1")?.timelineNodeId, "tl-2");
  assert.equal(harness.state.lastCostLatency?.provider, "google");
  assert.equal(harness.state.lastCostLatency?.model, "gemini-nano-banana-2");
  assert.equal(harness.clearCalls.length, 1);
  assert.equal(harness.topMetricCalls.length, 1);
  assert.equal(harness.processActionQueueCalls, 1);
  assert.deepEqual(harness.statusCalls.at(-1), { message: "Engine: ready", isError: false });
  assert.deepEqual(harness.toastCalls.at(-1), {
    message: "Swap background applied.",
    kind: "tip",
    duration: 2200,
  });
});

test("review apply completion events for another tab are ignored", async () => {
  const harness = buildReviewApplyHarness({
    activeTabId: "tab-b",
    pendingRequestId: "review-b",
    pendingSessionKey: "tab:tab-b",
  });

  const ok = await harness.applyAcceptedDesignReviewOutput({
    phase: "succeeded",
    sessionKey: "tab:tab-a",
    requestId: "review-a",
    targetImageId: "img-1",
    outputPath: "/tmp/out.png",
  });

  assert.equal(ok, false);
  assert.equal(harness.receiptCalls.length, 0);
  assert.equal(harness.replaceCalls.length, 0);
  assert.equal(harness.timelineCalls.length, 0);
  assert.equal(harness.clearCalls.length, 0);
  assert.equal(harness.processActionQueueCalls, 0);
  assert.equal(harness.state.imagesById.get("img-1")?.path, "/tmp/source.png");
});

test("canvas runtime binds the unified review-apply lifecycle event", () => {
  assert.match(app, /window\.addEventListener\(DESIGN_REVIEW_APPLY_EVENT,\s*\(event\)\s*=>\s*\{/);
  assert.match(app, /const phase = readFirstString\(detail\?\.phase,\s*detail\?\.status\)\.toLowerCase\(\);/);
  assert.match(app, /if \(phase === "started"[\s\S]*markDesignReviewApplyRunning\(detail\);/);
  assert.match(app, /if \(phase === "succeeded"[\s\S]*void applyAcceptedDesignReviewOutput\(detail\);/);
  assert.match(app, /if \(phase === "failed"[\s\S]*handleDesignReviewApplyFailure\(detail\);/);
  assert.match(app, /bindDesignReviewApplyRuntimeBridge\(\);/);
});
