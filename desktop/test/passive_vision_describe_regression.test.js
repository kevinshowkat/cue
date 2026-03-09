import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

function loadNamedFunctionSource(name) {
  const pattern = new RegExp(
    `function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n\\n(?:async\\s+)?function\\s+`,
    "m"
  );
  const match = app.match(pattern);
  assert.ok(match, `${name} function not found`);
  return match[0].replace(/\n\n(?:async\s+)?function\s+[\s\S]*$/, "").trim();
}

function instantiateFunction(name, deps = {}) {
  const source = loadNamedFunctionSource(name);
  const keys = Object.keys(deps);
  const values = Object.values(deps);
  return new Function(...keys, `return (${source});`)(...values);
}

test("passive scheduleVisionDescribe leaves upload-time vision work unscheduled when the engine is absent", () => {
  const state = {
    ptySpawned: false,
    images: [{ path: "/tmp/upload.png", visionDesc: null }],
  };
  const describeQueue = [];
  const describeQueued = new Set();
  const describeForceRefresh = new Set();
  let processCalls = 0;
  const scheduleVisionDescribe = instantiateFunction("scheduleVisionDescribe", {
    state,
    allowVisionDescribe: () => true,
    allowVisionDescribeInCurrentMode: () => true,
    describeHasInFlight: () => false,
    describeQueued,
    describeQueue,
    describeForceRefresh,
    syncDescribePendingPath: () => {
      throw new Error("passive describe should not sync a queue when the engine is absent");
    },
    getActiveImage: () => null,
    renderHudReadout: () => {
      throw new Error("passive describe should not render HUD state when the engine is absent");
    },
    processDescribeQueue: () => {
      processCalls += 1;
    },
  });

  const scheduled = scheduleVisionDescribe("/tmp/upload.png", {
    priority: true,
    fallback: true,
  });

  assert.equal(scheduled, false);
  assert.deepEqual(describeQueue, []);
  assert.equal(describeQueued.size, 0);
  assert.equal(describeForceRefresh.size, 0);
  assert.equal(processCalls, 0);
});

test("processDescribeQueue clears passive work instead of spawning a vision engine", () => {
  const calls = [];
  const processDescribeQueue = instantiateFunction("processDescribeQueue", {
    describeInFlightOrder: [],
    DESCRIBE_MAX_IN_FLIGHT: 2,
    state: {
      actionQueueActive: false,
      ptySpawned: false,
    },
    isEngineBusy: () => false,
    allowVisionDescribe: () => true,
    resetDescribeQueue: (opts) => calls.push(opts),
    describeQueue: ["/tmp/upload.png"],
  });

  processDescribeQueue();

  assert.deepEqual(calls, [{ clearPending: true }]);
  assert.doesNotMatch(loadNamedFunctionSource("processDescribeQueue"), /ensureEngineSpawned\(\{ reason: "vision" \}\)/);
});

test("_completeDescribeInFlight no longer toasts passive vision failures", () => {
  assert.doesNotMatch(loadNamedFunctionSource("_completeDescribeInFlight"), /showToast\(errorMessage,\s*"error"/);
});
