import { test } from "node:test";
import assert from "node:assert/strict";

import {
  TABBED_SESSIONS_BRIDGE_KEY,
  TABBED_SESSIONS_CHANGED_EVENT,
  createTabbedSessionsStore,
} from "../src/tabbed_sessions.js";

test("tabbed session store maintains ordered tabs and active tab selection", () => {
  const seen = [];
  const store = createTabbedSessionsStore({
    onChange(snapshot) {
      seen.push({
        type: snapshot.type,
        activeTabId: snapshot.activeTabId,
        tabs: snapshot.tabs.map((tab) => tab.tabId),
      });
    },
  });

  store.upsertTab({ tabId: "tab-a", label: "A", runDir: "/tmp/a" }, { activate: true });
  store.upsertTab({ tabId: "tab-b", label: "B", runDir: "/tmp/b" });

  assert.deepEqual(store.listTabs().map((tab) => tab.tabId), ["tab-a", "tab-b"]);
  assert.equal(store.activeTabId, "tab-a");

  store.setActiveTab("tab-b");

  assert.equal(store.activeTabId, "tab-b");
  assert.equal(store.listTabs()[1].active, true);

  const closed = store.closeTab("tab-b");
  assert.equal(closed?.nextActiveId, "tab-a");
  assert.equal(store.activeTabId, "tab-a");
  assert.equal(seen.at(-1)?.type, "close");
});

test("tabbed session store subscriptions receive the current snapshot and later updates", () => {
  const store = createTabbedSessionsStore();
  const received = [];

  const unsubscribe = store.subscribe((snapshot) => {
    received.push({
      activeTabId: snapshot.activeTabId,
      tabsOrder: snapshot.tabsOrder.slice(),
    });
  });

  store.upsertTab({ tabId: "tab-a", label: "A", runDir: "/tmp/a" }, { activate: true });
  store.upsertTab({ tabId: "tab-b", label: "B", runDir: "/tmp/b" });

  unsubscribe();
  store.setActiveTab("tab-b");

  assert.deepEqual(received[0], { activeTabId: null, tabsOrder: [] });
  assert.deepEqual(received[1], { activeTabId: "tab-a", tabsOrder: ["tab-a"] });
  assert.deepEqual(received[2], { activeTabId: "tab-a", tabsOrder: ["tab-a", "tab-b"] });
  assert.equal(received.length, 3);
});

test("tabbed session bridge constants remain stable", () => {
  assert.equal(TABBED_SESSIONS_BRIDGE_KEY, "__JUGGERNAUT_TABS__");
  assert.equal(TABBED_SESSIONS_CHANGED_EVENT, "juggernaut:tabs-changed");
});
