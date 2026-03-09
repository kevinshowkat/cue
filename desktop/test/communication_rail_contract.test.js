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
  assert.match(html, /id="communication-proposal-tray"[\s\S]*aria-label="Try edits"/);
  assert.match(html, /class="communication-proposal-tray-title">Try Edits</);
  assert.match(html, /id="communication-proposal-slot-list"/);
  assert.match(html, /id="communication-proposal-tray-close"/);
  assert.match(html, /id="communication-rail"[^>]*aria-label="Communication rail"/);
  assert.match(html, /id="communication-tool-marker"/);
  assert.match(html, /id="communication-tool-magic-select"/);
  assert.match(html, /id="communication-tool-eraser"/);
  assert.match(html, /id="communication-tool-marker"[\s\S]*d="M12 2\.9 15\.65 6\.55 14\.15 8\.05 14\.9 19\.3H9\.1l\.75-11\.25z"/);
});

test("communication rail css anchors the rail at the bottom and keeps the proposal tray floating", () => {
  assert.match(css, /\.communication-rail\s*\{/);
  assert.match(css, /\.communication-rail\s*\{[\s\S]*bottom:\s*22px/);
  assert.match(css, /\.communication-tool svg\s*\{[\s\S]*width:\s*32px[\s\S]*height:\s*32px/);
  assert.match(css, /\.communication-tool\.is-active::after\s*\{/);
  assert.match(css, /\.communication-proposal-tray\s*\{/);
  assert.match(css, /\.communication-proposal-slot\.is-skeleton::before\s*\{/);
});

test("communication state is tab-local and design review is exposed through the shell bridge", () => {
  assert.match(app, /function createFreshCommunicationState\(\) \{/);
  assert.match(app, /communication:\s*createFreshCommunicationState\(\)/);
  assert.match(app, /selection:\s*null/);
  assert.match(app, /next\.communication =[\s\S]*createFreshCommunicationState\(\);/);
  assert.match(app, /state\.communication =[\s\S]*createFreshCommunicationState\(\);/);
  assert.match(app, /function buildJuggernautShellContext\(\) \{[\s\S]*activeTabId:\s*state\.activeTabId \|\| null,/);
  assert.match(app, /getCommunicationReviewPayload\(meta = \{\}\)/);
  assert.match(app, /requestDesignReview\(meta = \{\}\)/);
  assert.match(app, /communicationReview:\s*\{[\s\S]*getPayload\(meta = \{\}\)/);
  assert.match(app, /COMMUNICATION_REVIEW_REQUESTED_EVENT/);
  assert.match(app, /resolvedTarget:\s*resolveCommunicationReviewTarget\(\)/);
});

test("communication input layer intercepts marker, magic select, eraser, and titlebar review", () => {
  assert.match(app, /COMMUNICATION_POINTER_KINDS = Object\.freeze\(\{/);
  assert.match(app, /function handleCommunicationCanvasPointerDown\(event, p, pCss\) \{/);
  assert.equal((app.match(/handleCommunicationCanvasPointerDown\(event, p, pCss\)/g) || []).length, 3);
  assert.match(app, /if \(communicationTool === "eraser"\) \{/);
  assert.match(app, /function beginCommunicationMarkerStroke\(event, p, pCss, communicationImageId = null\) \{/);
  assert.match(app, /state\.pointer\.kind = COMMUNICATION_POINTER_KINDS\.MARKER;/);
  assert.match(app, /function beginCommunicationMagicSelectStroke\(event, p, pCss, communicationImageId = null\) \{/);
  assert.match(app, /state\.pointer\.kind = COMMUNICATION_POINTER_KINDS\.MAGIC_SELECT;/);
  assert.match(app, /function requestCommunicationDesignReview\(\{ source = "titlebar" \} = \{\}\) \{/);
  assert.match(app, /els\.sessionTabDesignReview\.addEventListener\("click", \(\) => \{/);
  assert.match(app, /function triggerCommunicationDesignReviewFromTitlebar\(\{ source = "titlebar" \} = \{\}\) \{/);
  assert.match(app, /triggerCommunicationDesignReviewFromTitlebar\(\{ source: "titlebar" \}\);/);
});

test("communication marker keeps the draft in screen space, commits canvas marks, and renders a smoothed freehand path", () => {
  assert.match(app, /canvasMarks:\s*\[\]/);
  assert.match(app, /screenPoints:\s*\[/);
  assert.match(app, /if \(typeof event\.getCoalescedEvents === "function"\) \{/);
  assert.match(app, /const committedPoints = communicationCommittedPointsFromDraft\(draft\);/);
  assert.match(app, /coordinateSpace:\s*"canvas_overlay"/);
  assert.match(app, /state\.communication\.canvasMarks = communicationCanvasMarks\(\)\.concat\(next\);/);
  assert.match(app, /kind:\s*"freehand_marker"/);
  assert.match(app, /function traceCommunicationMarkPath\(octx, points = \[\]\) \{/);
  assert.match(app, /octx\.quadraticCurveTo\(/);
  assert.doesNotMatch(app, /Math\.PI \/ 7/);
  assert.doesNotMatch(app, /kind:\s*"freehand_arrow"/);
});

test("communication marker interception happens before move or pan branches", () => {
  const multiHandleIndex = app.indexOf("if (handleCommunicationCanvasPointerDown(event, p, pCss)) {");
  const multiMoveIndex = app.indexOf("let hit = hitTestMulti(p);", multiHandleIndex);
  const singleHandleIndex = app.lastIndexOf("if (handleCommunicationCanvasPointerDown(event, p, pCss)) {");
  const singleTransformIndex = app.indexOf("const transformUiHit = hitTestActiveImageTransformUi(p);", singleHandleIndex);

  assert.ok(multiHandleIndex >= 0);
  assert.ok(multiMoveIndex > multiHandleIndex);
  assert.ok(singleHandleIndex >= 0);
  assert.ok(singleTransformIndex > singleHandleIndex);
});
