import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bootstrap = readFileSync(
  join(here, "..", "src", "design_review_bootstrap.js"),
  "utf8"
);

test("design review bootstrap follows the communication review request path instead of hijacking the titlebar button", () => {
  assert.match(
    bootstrap,
    /window\.addEventListener\(COMMUNICATION_REVIEW_REQUESTED_EVENT,\s*\(event\)\s*=>/
  );
  assert.match(bootstrap, /showCommunicationProposalTray/);
  assert.match(bootstrap, /buildDesignReviewRequestFromCommunication/);
  assert.doesNotMatch(bootstrap, /#session-tab-design-review/);
  assert.doesNotMatch(bootstrap, /setInterval\(/);
});

test("design review bootstrap keeps the integrated communication tray light and decorates it in place", () => {
  assert.match(bootstrap, /#communication-proposal-tray\.is-design-review-runtime/);
  assert.match(bootstrap, /renderCommunicationTrayDetails/);
  assert.match(bootstrap, /communication-proposal-tray-title/);
  assert.doesNotMatch(bootstrap, /design-review-tray/);
});

test("design review bootstrap exposes a failure debug payload modal from the communication tray", () => {
  assert.match(bootstrap, /const REVIEW_DEBUG_MODAL_ID = "design-review-debug-modal"/);
  assert.match(bootstrap, /function openReviewDebugModal\(payload = null\)/);
  assert.match(bootstrap, /debug\.textContent = "Debug Payload"/);
  assert.match(bootstrap, /slot\?\.status === "failed" && slot\?\.debugInfo/);
  assert.match(bootstrap, /const fragment = document\.createDocumentFragment\(\)/);
  assert.match(bootstrap, /list\.replaceChildren\(fragment\)/);
});

test("design review bootstrap keeps tab-local review runtime state instead of one shared tray state", () => {
  assert.match(bootstrap, /createDesignReviewRuntimeRegistry/);
  assert.match(bootstrap, /const runtimeStateBySession = new Map\(\)/);
  assert.match(bootstrap, /runtimeStateForActiveTrayEvent\(event\?\.detail\)/);
  assert.match(bootstrap, /clearCommunicationTrayReviewDetails\(\)/);
  assert.doesNotMatch(bootstrap, /const runtimeState = \{\s*lastCommunicationPayload:/);
});

test("design review bootstrap only schedules upload-analysis warmup on explicit review start or image-introducing events", () => {
  assert.doesNotMatch(bootstrap, /window\.addEventListener\("juggernaut:shell-ready"/);
  assert.doesNotMatch(bootstrap, /window\.addEventListener\("focus"/);
  assert.doesNotMatch(bootstrap, /TABBED_SESSIONS_CHANGED_EVENT/);
  assert.match(bootstrap, /target\?\.matches\?\.\('input\[type="file"\]'\)/);
  assert.match(bootstrap, /queueWarmup\(\{ snapshot, delayMs: 0, sessionKey: runtimeState\.sessionKey \}\)/);
  assert.match(bootstrap, /queueWarmup\(\{ delayMs: 120 \}\)/);
});
