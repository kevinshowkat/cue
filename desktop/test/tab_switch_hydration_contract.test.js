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

test("tab switching keeps the visual swap on the fast path and defers hydration work", () => {
  const activateTabSource = extractFunctionSource("activateTab");
  const attachSource = extractFunctionSource("attachActiveTabRuntime");
  const scheduleSource = extractFunctionSource("scheduleTabHydration");

  assert.match(scheduleSource, /requestAnimationFrame\(\(\) => \{/);
  assert.match(scheduleSource, /setTimeout\(\(\) => \{/);
  assert.match(scheduleSource, /requestIdleCallback/);
  assert.match(
    activateTabSource,
    /bindTabSessionToState\(target\.session\);[\s\S]*tabbedSessions\.setActiveTab\(normalized\);[\s\S]*publishActiveTabVisibleState\(\);[\s\S]*const hydration = scheduleTabHydration\(normalized, reason, \{ spawnEngine \}\);/
  );
  assert.match(
    attachSource,
    /renderFilmstrip\(\);[\s\S]*chooseSpawnNodes\(\);[\s\S]*renderTimeline\(\);[\s\S]*await syncActiveRunPtyBinding\(\{ useCache: true \}\);[\s\S]*startEventsPolling\(\);/
  );
});

test("deferred tab hydration uses a token guard so stale async work cannot complete after a newer switch", () => {
  const attachSource = extractFunctionSource("attachActiveTabRuntime");
  const scheduleSource = extractFunctionSource("scheduleTabHydration");
  const guardMatches = attachSource.match(/currentTabHydrationMatches\(normalizedTabId, hydrationToken\)/g) || [];

  assert.match(app, /const hydrationToken = \+\+tabHydrationToken;/);
  assert.match(scheduleSource, /attachActiveTabRuntime\(\{[\s\S]*hydrationToken,[\s\S]*\}\)/);
  assert.ok(guardMatches.length >= 4, "expected repeated hydration token guards in attachActiveTabRuntime");
});

test("tab switching does not perform immediate visual-prompt writes, PTY probes, or deferred-ui rebuilds on the click path", () => {
  const activateTabSource = extractFunctionSource("activateTab");
  const attachSource = extractFunctionSource("attachActiveTabRuntime");

  assert.equal(activateTabSource.includes("scheduleVisualPromptWrite"), false);
  assert.equal(activateTabSource.includes("syncActiveRunPtyBinding"), false);
  assert.equal(activateTabSource.includes("startEventsPolling"), false);
  assert.equal(activateTabSource.includes('invoke("get_pty_status")'), false);
  assert.equal(activateTabSource.includes("renderFilmstrip"), false);
  assert.equal(activateTabSource.includes("renderTimeline"), false);
  assert.equal(activateTabSource.includes("renderQuickActions"), false);
  assert.equal(attachSource.includes("scheduleVisualPromptWrite"), false);
});

test("tab hydration renders quick actions through chooseSpawnNodes without a duplicate direct render in attachActiveTabRuntime", () => {
  const attachSource = extractFunctionSource("attachActiveTabRuntime");
  const chooseSpawnNodesSource = extractFunctionSource("chooseSpawnNodes");

  assert.equal(attachSource.includes("renderQuickActions"), false);
  assert.match(attachSource, /renderFilmstrip\(\);[\s\S]*chooseSpawnNodes\(\);[\s\S]*renderSessionApiCallsReadout\(\);/);
  assert.ok((chooseSpawnNodesSource.match(/renderQuickActions\(\);/g) || []).length >= 1);
});

test("create and open paths rely on activateTab's single hydration schedule instead of scheduling their own follow-up hydrations", () => {
  const createRunSource = extractFunctionSource("createRun");
  const openExistingRunSource = extractFunctionSource("openExistingRun");

  assert.equal(createRunSource.includes("scheduleTabHydration"), false);
  assert.equal(openExistingRunSource.includes("scheduleTabHydration"), false);
  assert.match(
    createRunSource,
    /const result = await activateTab\(tabId, \{ spawnEngine: true, reason: "new_run_tab" \}\);[\s\S]*if \(result\?\.hydration\) await result\.hydration;/
  );
  assert.match(
    openExistingRunSource,
    /const activation = await activateTab\(tabId, \{ spawnEngine: false, reason: "open_run_tab" \}\);[\s\S]*if \(activation\?\.hydration\) await activation\.hydration;/
  );
});
