import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const intentEventsPath = join(here, "..", "src", "app", "event_handlers", "intent_events.js");
const app = readFileSync(appPath, "utf8");
const intentEventsSource = readFileSync(intentEventsPath, "utf8");

test("Ambient intent: edit triggers schedule background inference", () => {
  assert.match(
    app,
    /function scheduleAmbientIntentInference\(\{\s*immediate = false,\s*reason = null,\s*imageIds = \[\]\s*\} = \{\}\) \{\s*void immediate;\s*void reason;\s*void imageIds;\s*return false;\s*\}/
  );
  assert.equal((app.match(/scheduleAmbientIntentInference\(/g) || []).length, 1);
});

test("Ambient intent: viewport wheel/gesture handlers do not schedule inference", () => {
  const wheel = app.match(/const handleOverlayWheel = \(event\) => \{[\s\S]*?\n\s*\};/);
  assert.ok(wheel, "wheel handler not found");
  assert.doesNotMatch(wheel[0], /scheduleAmbientIntentInference\(/);

  const gesture = app.match(/const onGestureChange = \(event\) => \{[\s\S]*?const onGestureEnd = \(event\) => \{/);
  assert.ok(gesture, "gesture handlers not found");
  assert.doesNotMatch(gesture[0], /scheduleAmbientIntentInference\(/);
});

test("Ambient intent: realtime failures flow through ambient fallback", () => {
  assert.match(intentEventsSource, /applyAmbientIntentFallback\("parse_failed"/);
  assert.match(intentEventsSource, /applyAmbientIntentFallback\("failed"/);
});

test("Ambient intent: nudges are clickable and use larger visual sizing", () => {
  assert.doesNotMatch(app, /function hitTestAmbientIntentNudge\(/);
  assert.doesNotMatch(app, /function activateAmbientIntentNudge\(/);
  assert.match(
    app,
    /function renderAmbientIntentNudges\(octx, canvasW, canvasH\) \{\s*void octx;\s*void canvasW;\s*void canvasH;\s*const ambient = state\.intentAmbient;\s*if \(ambient\) ambient\.uiHits = \[\];\s*\}/
  );
});

test("Ambient intent: realtime event de-staling requires a matching active pending path", () => {
  assert.match(intentEventsSource, /const routing = classifyIntentIconsRouting\(\{/);
  assert.match(intentEventsSource, /const \{ matchAmbient, matchIntent, matchMother, ignoreReason \} = routing;/);
  assert.match(intentEventsSource, /if \(ignoreReason === "snapshot_path_mismatch" \|\| ignoreReason === "path_mismatch"\) \{/);
  assert.doesNotMatch(intentEventsSource, /const matchesAmbient = !path \|\| !ambient\?\.pendingPath \|\| path === ambient\.pendingPath/);
});

test("Ambient intent: allows specific realtime vision labels to replace bland early labels", () => {
  assert.match(app, /function shouldPreferIncomingVisionLabel\(/);
  assert.match(app, /function _compactVisionCaptionFragment\(/);
  assert.match(app, /function _visionLabelNameTokenCount\(/);
  assert.match(app, /VISION_LABEL_AUX_TOKENS = new Set\(\["is", "are", "was", "were"\]\)/);
  assert.match(app, /if \(existingGeneric && !incomingGeneric\) return true;/);
  assert.match(app, /if \(incomingNameTokens >= 2 && existingNameTokens < 2\) return true;/);
  assert.match(app, /if \(incomingScore > existingScore\) return true;/);
  assert.match(intentEventsSource, /const imageDescs = !isPartial \? extractIntentImageDescriptions\(parsed\) : \[\];/);
  assert.match(intentEventsSource, /const keepExplicitDescribe =[\s\S]*prevSource === "openai_realtime_describe" \|\| prevSource === "openai_vision"/);
  assert.match(intentEventsSource, /imgItem\.visionDesc = label;/);
  assert.match(intentEventsSource, /scheduleVisualPromptWrite\(\);[\s\S]*if \(getActiveImage\(\)\?\.id\) renderHudReadout\(\);/);
});

test("Ambient intent: missing realtime image_descriptions queues fallback describe", () => {
  assert.match(intentEventsSource, /const imageDescs = !isPartial \? extractIntentImageDescriptions\(parsed\) : \[\];/);
  assert.doesNotMatch(intentEventsSource, /function maybeScheduleVisionDescribeFallbackForAmbientRealtime\(/);
});

test("Ambient intent: empty vision hints are filtered before building realtime context", () => {
  assert.match(app, /function normalizeVisionHintForIntent\(/);
  assert.match(app, /if \(shouldBackfillVisionLabel\(label\)\) return null;/);
  assert.match(app, /function shouldBackfillVisionLabel\(/);
  assert.match(app, /return !label;/);
  assert.match(app, /const label = _normalizeVisionLabel\(labelRaw,\s*\{\s*maxChars:\s*REALTIME_VISION_LABEL_MAX_CHARS\s*\}\);/);
  assert.match(app, /vision_desc:\s*normalizeVisionHintForIntent\(image\.vision_desc,\s*\{\s*maxChars:\s*REALTIME_VISION_LABEL_MAX_CHARS\s*\}\)/);
  assert.match(app, /const visionDesc = normalizeVisionHintForIntent\(item\?\.visionDesc,\s*\{\s*maxChars:\s*REALTIME_VISION_LABEL_MAX_CHARS\s*\}\);/);
});

test("Ambient intent: proactive per-image describe scheduling stays fallback-gated", () => {
  assert.doesNotMatch(app, /function scheduleVisionDescribe\(/);
  assert.doesNotMatch(app, /scheduleVisionDescribe\(/);
});

test("Ambient intent: parse\/failure paths queue fallback describe for touched images", () => {
  assert.match(intentEventsSource, /applyAmbientIntentFallback\("parse_failed", \{ message: intentParseMessage \}\);/);
  assert.match(intentEventsSource, /applyAmbientIntentFallback\("failed", \{ message: msg, hardDisable \}\);/);
  assert.doesNotMatch(intentEventsSource, /maybeScheduleVisionDescribeFallbackForAmbientRealtime/);
});

test("Ambient nudge mapping: multi-canvas world->canvas conversion applies DPR", () => {
  assert.match(app, /x:\s*x \* dpr \* s \+ ox/);
  assert.match(app, /y:\s*y \* dpr \* s \+ oy/);
  assert.match(app, /w:\s*w \* dpr \* s/);
  assert.match(app, /h:\s*h \* dpr \* s/);
});
