import { test } from "node:test";
import assert from "node:assert/strict";

import { createSessionTabStripUi } from "../src/app/tab_strip_ui.js";

function createMockElement() {
  const listeners = new Map();
  return {
    dataset: {},
    listeners,
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    contains() {
      return false;
    },
  };
}

test("tab strip install still binds titlebar actions when the initial render and subscription fail", () => {
  const calls = [];
  const consoleCalls = [];
  const els = {
    sessionTabStrip: createMockElement(),
    sessionTabList: createMockElement(),
    timelineToggle: createMockElement(),
    sessionTabNew: createMockElement(),
    sessionTabFork: createMockElement(),
    sessionTabDesignReview: createMockElement(),
  };

  const tabStripUi = createSessionTabStripUi({
    documentObj: {},
    consoleObj: {
      error(...args) {
        consoleCalls.push(args);
      },
    },
    els,
    listTabs() {
      throw new Error("listTabs failed");
    },
    subscribeTabs() {
      throw new Error("subscribe failed");
    },
    onTimelineToggle() {
      calls.push("timeline");
    },
    onNewSession() {
      calls.push("new");
    },
    onForkSession() {
      calls.push("fork");
    },
    onDesignReviewPointer() {
      calls.push("review:pointer");
    },
    onDesignReviewKeyboard() {
      calls.push("review:keyboard");
    },
    onDesignReviewClick() {
      calls.push("review:click");
    },
  });

  tabStripUi.installSessionTabStripUi();

  els.timelineToggle.listeners.get("click")?.();
  els.sessionTabNew.listeners.get("click")?.();
  els.sessionTabFork.listeners.get("click")?.();
  els.sessionTabDesignReview.listeners.get("pointerup")?.({ button: 0 });
  els.sessionTabDesignReview.listeners.get("keydown")?.({ key: "Enter" });
  els.sessionTabDesignReview.listeners.get("click")?.();

  assert.deepEqual(calls, [
    "timeline",
    "new",
    "fork",
    "review:pointer",
    "review:keyboard",
    "review:click",
  ]);
  assert.deepEqual(consoleCalls.map((entry) => entry[0]), [
    "Cue tab strip render failed during install:",
    "Cue tab strip subscription failed during install:",
  ]);
  assert.match(String(consoleCalls[0][1]?.message || ""), /listTabs failed/);
  assert.match(String(consoleCalls[1][1]?.message || ""), /subscribe failed/);
});
