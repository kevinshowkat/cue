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

test("review bootstrap runtime registry keeps tray state isolated by active tab", () => {
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

  const registry = createDesignReviewRuntimeRegistry();
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
