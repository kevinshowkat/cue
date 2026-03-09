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
  assert.match(bootstrap, /width:\s*min\(360px,\s*calc\(100vw - 40px\)\);/);
  assert.match(bootstrap, /min-width:\s*280px;/);
  assert.match(bootstrap, /renderCommunicationTrayDetails/);
  assert.match(bootstrap, /communication-proposal-tray-title/);
  assert.doesNotMatch(bootstrap, /design-review-tray/);
});

test("design review bootstrap keeps tray chrome minimal and removes debug/meta affordances", () => {
  assert.match(bootstrap, /const REVIEW_DEBUG_MODAL_ID = "design-review-debug-modal"/);
  assert.match(bootstrap, /head\.querySelector\("\.design-review-runtime-meta"\)\?\.remove\(\);/);
  assert.match(bootstrap, /head\.querySelector\("\.design-review-runtime-head-actions"\)\?\.remove\(\);/);
  assert.doesNotMatch(bootstrap, /debug\.textContent = "Debug Payload"/);
  assert.doesNotMatch(bootstrap, /meta\.textContent =/);
});

test("design review bootstrap dispatches structured apply events and routes tray accepts through the runtime apply path", () => {
  assert.match(bootstrap, /const REVIEW_APPLY_EVENT = "juggernaut:design-review-apply"/);
  assert.match(bootstrap, /const runDesignReviewApply = createDesignReviewApplyRunner\(providerRouter\)/);
  assert.match(bootstrap, /new CustomEvent\(REVIEW_APPLY_EVENT,\s*\{\s*detail,/s);
  assert.match(bootstrap, /const syncRuntimeReviewState = \(runtimeState = null, nextState = null\) =>/);
  assert.match(bootstrap, /const reviewState =[\s\S]*runtimeState\.lastReviewState[\s\S]*pipeline\.getState\(\)/);
  assert.match(bootstrap, /pipeline\.acceptProposal\(proposalId,\s*\{[\s\S]*reviewState,/s);
  assert.match(bootstrap, /void pipeline\.applyProposal\(proposalId,\s*\{[\s\S]*reviewState,[\s\S]*onStateChange:/s);
});

test("design review bootstrap makes proposal cards directly clickable for apply", () => {
  assert.match(bootstrap, /function slotCanAcceptProposal\(slot = null, requestApplyLocked = false\)/);
  assert.match(bootstrap, /card\.classList\.toggle\("is-actionable", canAcceptSlot\)/);
  assert.match(bootstrap, /card\.tabIndex = canAcceptSlot \? 0 : -1/);
  assert.match(bootstrap, /card\.addEventListener\("click", \(\) => \{\s*handleAccept\(\);/s);
  assert.match(bootstrap, /card\.addEventListener\("keydown", \(event\) => \{\s*if \(event\.key !== "Enter" && event\.key !== " "\) return;/s);
  assert.match(bootstrap, /hint\.textContent = "Click anywhere on this proposal to apply\.";/);
  assert.match(bootstrap, /accept\.addEventListener\("click", \(event\) => \{\s*event\.stopPropagation\(\);/s);
  assert.match(bootstrap, /: "Apply";/);
  assert.doesNotMatch(bootstrap, /"Apply via Runtime"/);
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
