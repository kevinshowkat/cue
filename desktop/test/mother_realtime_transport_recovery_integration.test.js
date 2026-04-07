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

test("Mother realtime recovery: retry decision is wired before hard failure", () => {
  assert.match(intentEventsSource, /nextMotherRealtimeIntentFailureAction\(\{/);
  assert.match(intentEventsSource, /if \(retryDecision\.action === "retry"\) \{/);
  assert.match(intentEventsSource, /const retried = await motherV2RetryRealtimeIntentTransport\(\{/);
  assert.match(intentEventsSource, /if \(retried\) \{\s*setStatus\("Mother: retrying realtime intent…"\);[\s\S]*return;/);
  assert.match(
    intentEventsSource,
    /\(\{\s*motherIdleLatest:\s*motherIdle,\s*matchMotherLatest:\s*matchMother,\s*motherRequestIdLatest:\s*motherRequestId,\s*\}\s*=\s*resolveActiveMotherRealtimeFailureTarget\(\)\);[\s\S]*if \(!matchIntent && !matchAmbient && !matchMother\) return;/
  );
  assert.match(app, /const workerTimeoutMs = Math\.max\(ms, MOTHER_V2_INTENT_RT_WORKER_TIMEOUT_MS\);/);
  assert.match(app, /elapsedMs \+ MOTHER_V2_INTENT_RT_TIMEOUT_DEFER_GRACE_MS < workerTimeoutMs/);
  assert.match(app, /kind:\s*"intent_realtime_retry_deferred"/);
  assert.match(app, /motherV2ArmRealtimeIntentTimeout\(\{ timeoutMs: deferMs \}\);/);
  assert.match(intentEventsSource, /if \(retryDecision\.retryable && retryDecision\.action === "fail"\) \{/);
  assert.match(intentEventsSource, /kind:\s*"intent_realtime_retry_exhausted"/);
  assert.match(intentEventsSource, /motherIdleHandleGenerationFailed\(`Mother realtime intent failed\. \${msg}`\);/);
});

test("Mother realtime source kind recognizes provider tags as realtime", () => {
  assert.match(
    app,
    /function motherV2IntentSourceKind\(source = ""\) \{[\s\S]*realtimeSourceSupported\(raw\)[\s\S]*raw\.startsWith\("openai_realtime"\) \|\| raw\.startsWith\("gemini_flash"\)[\s\S]*return "realtime";/
  );
});

test("Mother confirm path clears stale pending realtime intent request before drafting", () => {
  assert.match(app, /function motherV2ClearPendingIntentRequest\(\{ reason = "intent_request_cleared", clearBusy = true \} = \{\}\)/);
  assert.match(app, /motherV2ClearPendingIntentRequest\(\{ reason: "confirm_takeover" \}\);/);
  assert.match(app, /if \(String\(latest\.phase \|\| ""\) !== MOTHER_IDLE_STATES\.INTENT_HYPOTHESIZING\) return null;/);
});

test("Mother intent setup cleanup prevents orphaned pending latch on reject/cancel", () => {
  assert.match(
    app,
    /function motherV2ClearIntentAndDrafts\(\{ removeFiles = false \} = \{\}\) \{[\s\S]*idle\.pendingIntent = false;[\s\S]*clearTimeout\(idle\.pendingIntentTimeout\);[\s\S]*idle\.pendingIntentTimeout = null;/
  );
  assert.match(
    app,
    /if \(current && current\.pendingIntent && !String\(current\.pendingIntentRequestId \|\| ""\)\.trim\(\)\) \{[\s\S]*motherV2ClearPendingIntentRequest\(\{[\s\S]*reason: "intent_request_exit_orphaned",[\s\S]*clearBusy: true,[\s\S]*\}\);/
  );
});
