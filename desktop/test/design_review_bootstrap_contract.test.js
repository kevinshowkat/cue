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

test("design review bootstrap only schedules upload-analysis warmup on actual image-introducing events", () => {
  assert.doesNotMatch(bootstrap, /window\.addEventListener\("juggernaut:shell-ready"/);
  assert.doesNotMatch(bootstrap, /window\.addEventListener\("focus"/);
  assert.match(bootstrap, /target\?\.matches\?\.\('input\[type="file"\]'\)/);
  assert.match(bootstrap, /queueWarmup\(\{ delayMs: 120 \}\)/);
});
