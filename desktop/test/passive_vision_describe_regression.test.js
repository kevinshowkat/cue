import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const engineRuntimePath = join(here, "..", "src", "app", "engine_runtime.js");
const runProvisioningPath = join(here, "..", "src", "app", "run_provisioning.js");
const app = readFileSync(appPath, "utf8");
const engineRuntimeSource = readFileSync(engineRuntimePath, "utf8");
const runProvisioningSource = readFileSync(runProvisioningPath, "utf8");

function extractFunctionSource(name, source = app) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => source.indexOf(marker))
    .find((index) => index >= 0);
  assert.notEqual(start, undefined, `Could not find function ${name}`);
  const signatureStart = source.indexOf("(", start);
  assert.notEqual(signatureStart, -1, `Could not find signature for ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth === 0 && char === "{") {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `Could not find body for ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }
  throw new Error(`Could not extract function ${name}`);
}

test("passive describe helpers are removed from canvas_app.js", () => {
  for (const name of [
    "scheduleVisionDescribe",
    "scheduleVisionDescribeBurst",
    "scheduleVisionDescribeAll",
    "processDescribeQueue",
    "_completeDescribeInFlight",
    "allowVisionDescribe",
    "allowVisionDescribeInCurrentMode",
  ]) {
    assert.equal(app.includes(`function ${name}(`), false, `${name} should be deleted`);
    assert.equal(app.includes(`async function ${name}(`), false, `${name} should be deleted`);
  }
});

test("upload/open/focus/switch hooks stay passive and do not auto-start the engine", () => {
  const passiveOnlyFns = [
    "addImage",
    "importLocalPathsAtCanvasPoint",
    "openExistingRun",
    "setActiveImage",
    "setCanvasMode",
    "replaceImageInPlace",
    "spawnEngine",
    "motherV2VisionReadyForIntent",
  ];
  for (const name of passiveOnlyFns) {
    const source = extractFunctionSource(
      name,
      name === "spawnEngine" ? engineRuntimeSource : name === "openExistingRun" ? runProvisioningSource : app
    );
    assert.doesNotMatch(source, /scheduleVisionDescribe(All|Burst)?\(/, `${name} should not schedule passive describe`);
    assert.doesNotMatch(source, /scheduleAlwaysOnVision\(/, `${name} should not schedule always-on vision`);
    assert.doesNotMatch(source, /scheduleAmbientIntentInference\(/, `${name} should not schedule ambient inference`);
  }

  for (const name of [
    "addImage",
    "importLocalPathsAtCanvasPoint",
    "openExistingRun",
    "setActiveImage",
    "setCanvasMode",
    "replaceImageInPlace",
  ]) {
    assert.doesNotMatch(
      extractFunctionSource(name, name === "openExistingRun" ? runProvisioningSource : app),
      /ensureEngineSpawned\(/,
      `${name} should not auto-start the engine`
    );
  }
});

test("normal upload flow stays free of passive vision toasts", () => {
  const importSource = extractFunctionSource("importLocalPathsAtCanvasPoint");
  assert.doesNotMatch(importSource, /showToast\([^)]*(vision|describe)/i);
});
