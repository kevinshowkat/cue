import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "src", "index.html"), "utf8");
const css = readFileSync(join(here, "..", "src", "styles.css"), "utf8");
const app = readFileSync(join(here, "..", "src", "canvas_app.js"), "utf8");

test("communication rail markup exposes bottom rail tools and proposal tray scaffold", () => {
  assert.match(html, /id="communication-proposal-tray"/);
  assert.match(html, /id="communication-proposal-slot-list"/);
  assert.match(html, /id="communication-proposal-tray-close"/);
  assert.match(html, /id="communication-rail"[^>]*aria-label="Communication rail"/);
  assert.match(html, /id="communication-tool-marker"/);
  assert.match(html, /id="communication-tool-magic-select"/);
  assert.match(html, /id="communication-tool-eraser"/);
});

test("communication rail css anchors the rail at the bottom and keeps the proposal tray floating", () => {
  assert.match(css, /\.communication-rail\s*\{/);
  assert.match(css, /\.communication-rail\s*\{[\s\S]*bottom:\s*22px/);
  assert.match(css, /\.communication-tool\.is-active::after\s*\{/);
  assert.match(css, /\.communication-proposal-tray\s*\{/);
  assert.match(css, /\.communication-proposal-slot\.is-skeleton::before\s*\{/);
});

test("communication state is tab-local and design review is exposed through the shell bridge", () => {
  assert.match(app, /function createFreshCommunicationState\(\) \{/);
  assert.match(app, /communication:\s*createFreshCommunicationState\(\),\s*selection:/);
  assert.match(app, /next\.communication =[\s\S]*createFreshCommunicationState\(\);/);
  assert.match(app, /state\.communication =[\s\S]*createFreshCommunicationState\(\);/);
  assert.match(app, /getCommunicationReviewPayload\(meta = \{\}\)/);
  assert.match(app, /requestDesignReview\(meta = \{\}\)/);
  assert.match(app, /communicationReview:\s*\{[\s\S]*getPayload\(meta = \{\}\)/);
  assert.match(app, /COMMUNICATION_REVIEW_REQUESTED_EVENT/);
});

test("communication input layer intercepts marker, magic select, eraser, and titlebar review", () => {
  assert.match(app, /COMMUNICATION_POINTER_KINDS = Object\.freeze\(\{/);
  assert.match(app, /if \(communicationTool === "eraser"\) \{/);
  assert.match(app, /state\.pointer\.kind = COMMUNICATION_POINTER_KINDS\.MARKER;/);
  assert.match(app, /state\.pointer\.kind = COMMUNICATION_POINTER_KINDS\.MAGIC_SELECT;/);
  assert.match(app, /function requestCommunicationDesignReview\(\{ source = "titlebar" \} = \{\}\) \{/);
  assert.match(app, /els\.sessionTabDesignReview\.addEventListener\("click", \(\) => \{/);
  assert.match(app, /requestCommunicationDesignReview\(\{ source: "titlebar" \}\);/);
});
