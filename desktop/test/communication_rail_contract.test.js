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
  assert.match(html, /id="communication-proposal-tray"[\s\S]*aria-label="Design Review"/);
  assert.match(html, /class="communication-proposal-tray-title">Design Review</);
  assert.match(html, /id="communication-proposal-slot-list"/);
  assert.match(html, /id="communication-proposal-tray-close"/);
  assert.match(html, /id="communication-rail"[^>]*aria-label="Communication rail"/);
  assert.match(html, /id="communication-tool-marker"[\s\S]*class="communication-tool communication-tool-marker"/);
  assert.match(html, /id="communication-tool-protect"[\s\S]*class="communication-tool communication-tool-protect"/);
  assert.match(html, /id="communication-tool-magic-select"[\s\S]*class="communication-tool communication-tool-magic-select"/);
  assert.match(html, /id="communication-tool-make-space"[\s\S]*class="communication-tool communication-tool-make-space"/);
  assert.match(html, /id="communication-tool-eraser"[\s\S]*class="communication-tool communication-tool-eraser"/);
  assert.match(html, /id="communication-tool-marker"[\s\S]*class="communication-icon communication-icon-marker"/);
  assert.match(html, /id="communication-tool-protect"[\s\S]*class="communication-icon communication-icon-protect"/);
  assert.match(html, /id="communication-tool-magic-select"[\s\S]*class="communication-icon communication-icon-magic-select"/);
  assert.match(html, /id="communication-tool-make-space"[\s\S]*class="communication-icon communication-icon-make-space"/);
  assert.match(html, /id="communication-tool-eraser"[\s\S]*class="communication-icon communication-icon-eraser"/);
  assert.match(html, /id="communication-tool-marker"[\s\S]*viewBox="0 0 24 48"/);
  assert.match(html, /id="communication-tool-protect"[\s\S]*viewBox="0 0 24 48"/);
  assert.match(html, /id="communication-tool-magic-select"[\s\S]*viewBox="0 0 24 48"/);
  assert.match(html, /id="communication-tool-make-space"[\s\S]*viewBox="0 0 24 48"/);
  assert.match(html, /id="communication-tool-eraser"[\s\S]*viewBox="0 0 24 48"/);
});

test("communication rail css anchors a partially submerged pouch rail at the bottom and keeps the proposal tray floating", () => {
  assert.match(css, /\.communication-rail\s*\{/);
  assert.match(css, /\.communication-rail\s*\{[\s\S]*bottom:\s*-56px/);
  assert.match(css, /\.communication-rail\s*\{[\s\S]*height:\s*214px/);
  assert.match(css, /\.communication-rail\s*\{[\s\S]*align-items:\s*flex-start/);
  assert.match(css, /\.communication-rail::before\s*\{/);
  assert.match(css, /\.communication-rail::before\s*\{[\s\S]*inset:\s*74px 16px 18px/);
  assert.match(css, /\.communication-rail::after\s*\{[\s\S]*inset:\s*124px 8px 10px/);
  assert.match(css, /\.communication-rail::after\s*\{[\s\S]*clip-path:\s*polygon\(/);
  assert.match(css, /\.communication-tool\s*\{[\s\S]*height:\s*188px/);
  assert.match(css, /\.communication-tool\s*\{[\s\S]*min-height:\s*188px/);
  assert.match(css, /\.communication-tool svg\s*\{[\s\S]*width:\s*60px[\s\S]*height:\s*352px/);
  assert.match(css, /\.communication-tool-label\s*\{[\s\S]*position:\s*absolute[\s\S]*bottom:\s*70px/);
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

test("communication input layer supports semantic protect and make-space tools while reusing marker and magic-select behavior", () => {
  assert.match(app, /COMMUNICATION_TOOL_IDS = Object\.freeze\(\["marker", "protect", "magic_select", "make_space", "eraser"\]\)/);
  assert.match(app, /COMMUNICATION_TOOL_BEHAVIOR = Object\.freeze\(\{/);
  assert.match(app, /COMMUNICATION_POINTER_KINDS = Object\.freeze\(\{/);
  assert.match(app, /function handleCommunicationCanvasPointerDown\(event, p, pCss\) \{/);
  assert.equal((app.match(/handleCommunicationCanvasPointerDown\(event, p, pCss\)/g) || []).length, 3);
  assert.match(app, /const behaviorTool = communicationBehaviorToolId\(communicationTool\);/);
  assert.match(app, /if \(behaviorTool === "eraser"\) \{/);
  assert.match(app, /function beginCommunicationMarkerStroke\(event, p, pCss, communicationImageId = null\) \{/);
  assert.match(app, /state\.pointer\.kind = COMMUNICATION_POINTER_KINDS\.MARKER;/);
  assert.match(app, /function beginCommunicationMagicSelectStroke\(event, p, pCss, communicationImageId = null\) \{/);
  assert.match(app, /state\.pointer\.kind = COMMUNICATION_POINTER_KINDS\.MAGIC_SELECT;/);
  assert.match(app, /function requestCommunicationDesignReview\(\{ source = "titlebar" \} = \{\}\) \{/);
  assert.match(app, /els\.sessionTabDesignReview\.addEventListener\("click", \(\) => \{/);
  assert.match(app, /function triggerCommunicationDesignReviewFromTitlebar\(\{ source = "titlebar" \} = \{\}\) \{/);
  assert.match(app, /triggerCommunicationDesignReviewFromTitlebar\(\{ source: "titlebar" \}\);/);
});

test("communication marker keeps the draft in screen space, commits viewport-aware marks, and renders a smoothed freehand path", () => {
  assert.match(app, /canvasMarks:\s*\[\]/);
  assert.match(app, /screenPoints:\s*\[/);
  assert.match(app, /if \(typeof event\.getCoalescedEvents === "function"\) \{/);
  assert.match(app, /const committedPoints = communicationCommittedPointsFromDraft\(draft\);/);
  assert.match(app, /coordinateSpace:\s*"canvas_overlay"/);
  assert.match(app, /coordinateSpace:\s*"image"/);
  assert.match(app, /state\.communication\.marksByImageId\.set\(imageBucketId, existing\.concat\(mark\)\);/);
  assert.match(app, /coordinateSpace:\s*"canvas_world"/);
  assert.match(app, /state\.communication\.canvasMarks = communicationCanvasMarks\(\)\.concat\(mark\);/);
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
