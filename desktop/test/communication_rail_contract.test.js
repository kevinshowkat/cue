import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "src", "index.html"), "utf8");
const css = readFileSync(join(here, "..", "src", "styles.css"), "utf8");
const app = readFileSync(join(here, "..", "src", "canvas_app.js"), "utf8");
const domSource = readFileSync(join(here, "..", "src", "app", "dom.js"), "utf8");
const shellBridgeSource = readFileSync(
  join(here, "..", "src", "app", "shell_bridges.js"),
  "utf8"
);
const tabSessionStateSource = readFileSync(join(here, "..", "src", "app", "tab_session_state.js"), "utf8");
const tabStripUiSource = readFileSync(join(here, "..", "src", "app", "tab_strip_ui.js"), "utf8");

test("communication rail markup exposes bottom rail tools and proposal tray scaffold", () => {
  assert.match(html, /id="communication-proposal-tray"/);
  assert.match(html, /id="communication-proposal-tray"[\s\S]*aria-label="Design Review"/);
  assert.match(html, /class="communication-proposal-tray-title">Design Review</);
  assert.match(html, /id="communication-proposal-slot-list"/);
  assert.match(html, /id="communication-proposal-tray-close"/);
  assert.match(html, /id="communication-shell"[\s\S]*id="communication-rail"[^>]*aria-label="Communication rail"/);
  assert.match(html, /id="communication-tool-marker"[\s\S]*class="communication-tool communication-tool-marker"/);
  assert.match(html, /id="communication-tool-protect"[\s\S]*class="communication-tool communication-tool-protect"/);
  assert.match(html, /id="communication-tool-magic-select"[\s\S]*class="communication-tool communication-tool-magic-select"/);
  assert.match(html, /id="communication-tool-stamp"[\s\S]*class="communication-tool communication-tool-stamp"/);
  assert.match(html, /id="communication-tool-eraser"[\s\S]*class="communication-tool communication-tool-eraser"/);
  assert.match(html, /id="communication-tool-marker"[\s\S]*class="communication-icon communication-icon-marker"/);
  assert.match(html, /id="communication-tool-protect"[\s\S]*class="communication-icon communication-icon-protect"/);
  assert.match(html, /id="communication-tool-magic-select"[\s\S]*class="communication-icon communication-icon-magic-select"/);
  assert.match(html, /id="communication-tool-stamp"[\s\S]*class="communication-icon communication-icon-stamp"/);
  assert.match(html, /id="communication-tool-eraser"[\s\S]*class="communication-icon communication-icon-eraser"/);
  assert.match(html, /id="communication-tool-marker"[\s\S]*viewBox="0 0 24 48"/);
  assert.match(html, /id="communication-tool-protect"[\s\S]*viewBox="0 0 24 48"/);
  assert.match(html, /id="communication-tool-magic-select"[\s\S]*viewBox="0 0 24 48"/);
  assert.match(html, /id="communication-tool-stamp"[\s\S]*viewBox="0 0 24 48"/);
  assert.match(html, /id="communication-tool-eraser"[\s\S]*viewBox="0 0 24 48"/);
  assert.match(html, /id="communication-stamp-picker"/);
  assert.match(html, /id="communication-stamp-picker-title"/);
  assert.match(html, /id="communication-stamp-picker-subtitle"/);
  assert.match(html, /id="communication-stamp-intent-list"/);
  assert.match(html, /data-stamp-intent="fix"/);
  assert.match(html, /data-stamp-intent="move"/);
  assert.match(html, /data-stamp-intent="remove"/);
  assert.match(html, /data-stamp-intent="replace"/);
  assert.match(html, /data-stamp-intent="custom"/);
  assert.match(html, /id="communication-stamp-custom-panel"/);
  assert.match(html, /id="communication-stamp-custom-input"/);
  assert.match(html, /id="communication-stamp-custom-cancel"/);
  assert.match(html, /id="communication-stamp-custom-submit"/);
  assert.doesNotMatch(html, /id="communication-tool-make-space"/);
});

test("communication rail markup includes a canvas-local cursor host for the selected tool svg", () => {
  assert.match(html, /id="communication-canvas-cursor"[^>]*aria-hidden="true"/);
  assert.match(html, /id="communication-canvas-cursor"[\s\S]*id="communication-canvas-cursor-art"/);
});

test("communication rail css anchors a partially submerged pouch rail at the bottom and keeps the proposal tray floating", () => {
  assert.match(css, /\.communication-shell\s*\{/);
  assert.match(
    css,
    /\.communication-shell\s*\{[\s\S]*bottom:\s*calc\(var\(--jg-system-strip-bottom\)\s*\+\s*var\(--jg-system-strip-height\)\s*\+\s*var\(--jg-system-strip-gap\)\)/
  );
  assert.match(css, /\.communication-shell\s*\{[\s\S]*width:\s*var\(--jg-communication-shell-width\)/);
  assert.match(css, /\.communication-rail\s*\{/);
  assert.match(css, /\.communication-rail\s*\{[\s\S]*height:\s*214px/);
  assert.match(css, /\.communication-rail\s*\{[\s\S]*align-items:\s*flex-start/);
  assert.match(css, /\.communication-rail::before\s*\{/);
  assert.match(css, /\.communication-rail::before\s*\{[\s\S]*inset:\s*74px 16px 18px/);
  assert.match(css, /\.communication-rail::after\s*\{[\s\S]*inset:\s*124px 8px 10px/);
  assert.match(css, /\.communication-rail::after\s*\{[\s\S]*clip-path:\s*polygon\(/);
  assert.match(css, /\.communication-tool\s*\{[\s\S]*height:\s*188px/);
  assert.match(css, /\.communication-tool\s*\{[\s\S]*min-height:\s*188px/);
  assert.match(css, /\.communication-tool svg\s*\{[\s\S]*width:\s*56px[\s\S]*height:\s*336px/);
  assert.match(
    css,
    /\.communication-tool svg\s*\{[\s\S]*drop-shadow\(0 0 16px var\(--communication-tool-accent\)\)[\s\S]*drop-shadow\(0 2px 0 rgba\(255,\s*255,\s*255,\s*0\.24\)\)/
  );
  assert.doesNotMatch(
    css,
    /\.communication-tool svg\s*\{[\s\S]*drop-shadow\(0 14px 18px rgba\(18,\s*31,\s*46,\s*0\.18\)\)/
  );
  assert.doesNotMatch(
    css,
    /\.communication-tool:hover svg\s*\{[\s\S]*drop-shadow\(0 24px 28px rgba\(18,\s*31,\s*46,\s*0\.18\)\)/
  );
  assert.doesNotMatch(
    css,
    /\.communication-tool\.is-active svg\s*\{[\s\S]*drop-shadow\(0 26px 30px rgba\(18,\s*31,\s*46,\s*0\.18\)\)/
  );
  assert.match(css, /\.communication-shell\s*\{[\s\S]*width:\s*var\(--jg-communication-shell-width\)/);
  assert.match(css, /\.communication-rail\s*\{[\s\S]*justify-content:\s*center/);
  assert.match(css, /\.communication-rail\s*\{[\s\S]*gap:\s*2px/);
  assert.match(css, /\.communication-tool\s*\{[\s\S]*width:\s*70px[\s\S]*min-width:\s*70px/);
  assert.match(css, /\.communication-tool-label\s*\{\s*display:\s*none;\s*\}/);
  assert.match(css, /\.communication-tool\.communication-tool-stamp\s*\{/);
  assert.match(css, /\.communication-tool\.communication-tool-stamp svg\s*\{/);
  assert.match(css, /\.communication-stamp-picker-orbit\s*\{/);
  assert.match(css, /\.communication-stamp-picker-core\s*\{/);
  assert.match(css, /\.communication-stamp-picker\s*\{[\s\S]*pointer-events:\s*auto/);
  assert.match(css, /\.communication-stamp-picker\[data-picker-mode="custom"\]\s*\{/);
  assert.match(css, /\.communication-stamp-intent-list\s*\{/);
  assert.match(css, /\.communication-stamp-intent\s*\{/);
  assert.match(css, /\.communication-stamp-intent\.is-selected\s*\{/);
  assert.match(css, /\.communication-stamp-custom-panel\s*\{/);
  assert.match(css, /\.communication-stamp-custom-input\s*\{/);
  assert.match(css, /\.communication-stamp-custom-action\s*\{/);
  assert.doesNotMatch(css, /\.communication-tool\.communication-tool-make-space/);
  assert.match(css, /\.communication-proposal-tray\s*\{/);
  assert.match(css, /\.communication-proposal-slot\.is-skeleton::before\s*\{/);
});

test("communication rail css and app wiring keep the selected tool svg as a rotated on-canvas cursor", () => {
  assert.match(css, /\.communication-canvas-cursor\s*\{/);
  assert.match(css, /\.communication-canvas-cursor\.is-visible\s*\{/);
  assert.match(css, /\.communication-canvas-cursor-art\s*\{[\s\S]*--communication-canvas-cursor-angle:\s*225deg/);
  assert.doesNotMatch(css, /--communication-canvas-cursor-local-tilt:\s*-8deg/);
  assert.doesNotMatch(css, /--communication-canvas-cursor-local-tilt:\s*-10deg/);
  assert.doesNotMatch(css, /--communication-canvas-cursor-local-tilt:\s*-5deg/);
  assert.doesNotMatch(css, /--communication-canvas-cursor-local-tilt:\s*-2deg/);
  assert.doesNotMatch(css, /--communication-canvas-cursor-local-tilt:\s*10deg/);
  assert.match(css, /\.communication-canvas-cursor-art\s*\{[\s\S]*width:\s*30\.375px[\s\S]*height:\s*60\.75px/);
  assert.match(css, /\.communication-canvas-cursor-art\s*\{[\s\S]*translate\(var\(--communication-canvas-cursor-forward-x\), var\(--communication-canvas-cursor-forward-y\)\)/);
  assert.match(css, /\.communication-canvas-cursor\[data-tool="marker"\] \.communication-canvas-cursor-art/);
  assert.match(css, /\.communication-canvas-cursor\[data-tool="protect"\] \.communication-canvas-cursor-art/);
  assert.match(css, /\.communication-canvas-cursor\[data-tool="magic_select"\] \.communication-canvas-cursor-art/);
  assert.match(css, /\.communication-canvas-cursor\[data-tool="stamp"\] \.communication-canvas-cursor-art/);
  assert.match(css, /\.communication-canvas-cursor\[data-tool="eraser"\] \.communication-canvas-cursor-art/);
  assert.match(app, /const COMMUNICATION_CANVAS_CURSOR_FORWARD_SHIFT_CSS = Object\.freeze\(\{ x: -10, y: 8 \}\);/);
  assert.match(app, /function communicationCanvasCursorMarkup\(toolId = ""\) \{/);
  assert.match(app, /function syncCommunicationCanvasCursor\(\) \{/);
  assert.match(app, /overlay\.style\.cursor = visible \? "none" : requestedCursor;/);
  assert.match(domSource, /\["communicationCanvasCursor", "communication-canvas-cursor"\]/);
  assert.match(domSource, /\["communicationCanvasCursorArt", "communication-canvas-cursor-art"\]/);
  assert.match(app, /communicationCursor:\s*\{[\s\S]*requestedCursor:\s*"default"/);
  assert.match(app, /updateCommunicationCanvasCursorState\(pCss, \{ inside: true \}\);/);
});

test("communication state is tab-local and design review is exposed through the shell bridge", () => {
  assert.match(app, /function createFreshCommunicationState\(\) \{/);
  assert.match(app, /communication:\s*createFreshCommunicationState\(\)/);
  assert.match(app, /selection:\s*null/);
  assert.match(tabSessionStateSource, /next\.communication =[\s\S]*createFreshCommunicationState\(\);/);
  assert.match(tabSessionStateSource, /state\.communication =[\s\S]*createFreshCommunicationState\(\);/);
  assert.match(app, /function buildJuggernautShellContext\(\) \{[\s\S]*activeTabId:\s*state\.activeTabId \|\| null,/);
  assert.match(shellBridgeSource, /getCommunicationReviewPayload\(meta = \{\}\)/);
  assert.match(shellBridgeSource, /requestDesignReview\(meta = \{\}\)/);
  assert.match(shellBridgeSource, /communicationReview:\s*\{[\s\S]*getPayload\(meta = \{\}\)/);
  assert.match(app, /COMMUNICATION_REVIEW_REQUESTED_EVENT/);
  assert.match(app, /resolvedTarget:\s*resolveCommunicationReviewTarget\(\)/);
});

test("communication input layer retains semantic highlight, stamp, and dormant make-space behavior while reusing marker and magic-select behavior", () => {
  assert.match(app, /COMMUNICATION_TOOL_IDS = Object\.freeze\(\["marker", "protect", "magic_select", "stamp", "make_space", "eraser"\]\)/);
  assert.match(app, /COMMUNICATION_TOOL_BEHAVIOR = Object\.freeze\(\{/);
  assert.match(app, /COMMUNICATION_POINTER_KINDS = Object\.freeze\(\{/);
  assert.match(app, /function handleCommunicationCanvasPointerDown\(event, p, pCss\) \{/);
  assert.equal((app.match(/handleCommunicationCanvasPointerDown\(event, p, pCss\)/g) || []).length, 3);
  assert.match(app, /const behaviorTool = communicationBehaviorToolId\(communicationTool\);/);
  assert.match(app, /if \(behaviorTool === "eraser"\) \{/);
  assert.match(app, /if \(behaviorTool === "stamp"\) \{/);
  assert.match(app, /openCommunicationStampPickerAtPoint\(p, pCss, communicationImageId\);/);
  assert.match(
    app,
    /function beginCommunicationMarkerStroke\(event, p, pCss, communicationImageId = null(?:, markKind = "freehand_marker")?\) \{/
  );
  assert.match(app, /state\.pointer\.kind = COMMUNICATION_POINTER_KINDS\.MARKER;/);
  assert.match(app, /function beginCommunicationMagicSelectStroke\(event, p, pCss, communicationImageId = null\) \{/);
  assert.match(app, /state\.pointer\.kind = COMMUNICATION_POINTER_KINDS\.MAGIC_SELECT;/);
  assert.match(app, /function requestCommunicationDesignReview\(\{ source = "titlebar" \} = \{\}\) \{/);
  assert.match(app, /function triggerCommunicationDesignReviewFromTitlebar\(\{ source = "titlebar" \} = \{\}\) \{/);
  assert.match(tabStripUiSource, /els\.sessionTabDesignReview\.addEventListener\("click",\s*\(\)\s*=>\s*\{/);
  assert.match(app, /onDesignReviewClick:\s*\(\)\s*=>\s*\{[\s\S]*triggerCommunicationDesignReviewFromTitlebar\(\{ source: "titlebar" \}\);/);
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
  assert.match(
    app,
    /const markKind = String\(draft\?\.kind \|\| ""\)\.trim\(\)\.toLowerCase\(\) === "freehand_protect"[\s\S]*"freehand_marker";/
  );
  assert.match(app, /kind:\s*markKind/);
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
