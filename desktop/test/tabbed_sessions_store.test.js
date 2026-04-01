import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SESSION_TAB_SCHEMA_VERSION,
  TABBED_SESSIONS_BRIDGE_KEY,
  TABBED_SESSIONS_CHANGED_EVENT,
  createTabbedSessionsStore,
} from "../src/tabbed_sessions.js";

test("tabbed session store maintains ordered tabs and active tab selection", () => {
  const seen = [];
  const tabBSession = { id: "session-b" };
  const store = createTabbedSessionsStore({
    onChange(snapshot) {
      seen.push({
        type: snapshot.type,
        activeTabId: snapshot.activeTabId,
        tabs: snapshot.tabs.map((tab) => ({
          schemaVersion: tab.schemaVersion,
          tabId: tab.tabId,
          title: tab.title,
          isActive: tab.isActive,
          isBusy: tab.isBusy,
          isDirty: tab.isDirty,
          busy: tab.busy,
          dirty: tab.dirty,
          thumbnailPath: tab.thumbnailPath,
          canClose: tab.canClose,
        })),
      });
    },
  });

  store.upsertTab(
    { tabId: "tab-a", label: "A", runDir: "/tmp/a", busy: false, dirty: true, thumbnailPath: "/tmp/a.png" },
    { activate: true }
  );
  store.upsertTab({ tabId: "tab-b", label: "B", runDir: "/tmp/b", session: tabBSession }, { activate: false });

  assert.deepEqual(store.listTabs().map((tab) => tab.tabId), ["tab-a", "tab-b"]);
  assert.equal(store.activeTabId, "tab-a");
  assert.deepEqual(store.listTabs()[0], {
    schemaVersion: SESSION_TAB_SCHEMA_VERSION,
    tabId: "tab-a",
    title: "A",
    label: "A",
    runDir: "/tmp/a",
    active: true,
    isActive: true,
    busy: false,
    isBusy: false,
    dirty: true,
    isDirty: true,
    thumbnailPath: "/tmp/a.png",
    canClose: true,
    createdAt: store.listTabs()[0].createdAt,
    updatedAt: store.listTabs()[0].updatedAt,
  });
  assert.equal("session" in store.listTabs()[1], false);
  assert.equal(store.getTab("tab-b")?.session, tabBSession);

  store.setActiveTab("tab-b");

  assert.equal(store.activeTabId, "tab-b");
  assert.equal(store.listTabs()[1].active, true);
  assert.equal(store.listTabs()[1].isActive, true);

  const closed = store.closeTab("tab-b");
  assert.equal(closed?.nextActiveId, "tab-a");
  assert.equal(store.activeTabId, "tab-a");
  assert.equal(seen.at(-1)?.type, "close");
  assert.equal(seen[0]?.tabs[0]?.dirty, true);
  assert.equal(seen[1]?.tabs[1]?.thumbnailPath, null);
  assert.equal(store.listTabs()[0]?.canClose, false);
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

test("tabbed session store supports cheap metadata updates without replacing the session payload", () => {
  const session = { id: "session-a", images: [{ id: "img-a" }] };
  const store = createTabbedSessionsStore();

  store.upsertTab(
    {
      tabId: "tab-a",
      title: "Run A",
      runDir: "/runs/a",
      session,
      dirty: false,
      thumbnailPath: null,
    },
    { activate: true }
  );
  store.upsertTab({ tabId: "tab-b", label: "Run B", runDir: "/runs/b" });

  const before = store.getTab("tab-a");
  store.updateTabMeta("tab-a", {
    title: "Run Alpha",
  });
  store.setTabBusy("tab-a", true);
  store.markTabDirty("tab-a", true);
  store.setTabThumbnailPath("tab-a", "/runs/a/thumb.png");
  store.setTabCanClose("tab-a", false);
  store.updateTabMetadata("tab-a", {
    isBusy: true,
    isDirty: true,
    thumbnailPath: "/runs/a/thumb.png",
  });

  const after = store.getTab("tab-a");
  const listed = store.listTabs()[0];

  assert.equal(after, before);
  assert.equal(after?.session, session);
  assert.deepEqual(listed, {
    schemaVersion: SESSION_TAB_SCHEMA_VERSION,
    tabId: "tab-a",
    title: "Run Alpha",
    label: "Run Alpha",
    runDir: "/runs/a",
    active: true,
    isActive: true,
    busy: true,
    isBusy: true,
    dirty: true,
    isDirty: true,
    thumbnailPath: "/runs/a/thumb.png",
    canClose: false,
    createdAt: listed.createdAt,
    updatedAt: listed.updatedAt,
  });
  assert.equal(store.listTabs()[1]?.canClose, true);
});

test("tabbed session snapshots stay metadata-only and do not touch session or capture getters", () => {
  let sessionReads = 0;
  let captureReads = 0;
  const store = createTabbedSessionsStore();
  const tab = {
    tabId: "tab-a",
    label: "Run A",
    runDir: "/runs/a",
    dirty: true,
  };

  Object.defineProperty(tab, "session", {
    enumerable: true,
    configurable: true,
    get() {
      sessionReads += 1;
      throw new Error("session should not be read for tab metadata publication");
    },
  });
  Object.defineProperty(tab, "captureSession", {
    enumerable: true,
    configurable: true,
    get() {
      captureReads += 1;
      throw new Error("captureSession should not be read for tab metadata publication");
    },
  });

  assert.doesNotThrow(() => {
    store.upsertTab(tab, { activate: true });
    store.listTabs();
    store.snapshot();
  });

  const received = [];
  const unsubscribe = store.subscribe((snapshot) => {
    received.push(snapshot.tabs.map((entry) => ({ ...entry })));
  });
  unsubscribe();

  assert.equal(sessionReads, 0);
  assert.equal(captureReads, 0);
  assert.deepEqual(received, [
    [
      {
        schemaVersion: SESSION_TAB_SCHEMA_VERSION,
        tabId: "tab-a",
        title: "Run A",
        label: "Run A",
        runDir: "/runs/a",
        active: true,
        isActive: true,
        busy: false,
        isBusy: false,
        dirty: true,
        isDirty: true,
        thumbnailPath: null,
        canClose: false,
        createdAt: received[0][0].createdAt,
        updatedAt: received[0][0].updatedAt,
      },
    ],
  ]);
});

test("payload-only tab updates do not churn cached metadata snapshots", () => {
  let notifications = 0;
  const store = createTabbedSessionsStore({
    onChange() {
      notifications += 1;
    },
  });

  store.upsertTab(
    {
      tabId: "tab-a",
      label: "Run A",
      runDir: "/runs/a",
      session: { id: "session-a" },
    },
    { activate: true }
  );

  const listBefore = store.listTabs();
  const snapshotBefore = store.snapshot();
  const versionBefore = store.metadataVersion;
  const notificationsBefore = notifications;

  const updated = store.upsertTab({
    tabId: "tab-a",
    session: { id: "session-b" },
    captureSession() {
      throw new Error("metadata reads should not require payload capture");
    },
  });

  assert.equal(updated?.session?.id, "session-b");
  assert.equal(store.metadataVersion, versionBefore);
  assert.equal(store.listTabs(), listBefore);
  assert.equal(store.snapshot(), snapshotBefore);
  assert.equal(notifications, notificationsBefore);
});

test("live tab metadata writes invalidate cached summaries without touching the session payload", () => {
  const session = { id: "session-a" };
  const store = createTabbedSessionsStore();

  store.upsertTab(
    {
      tabId: "tab-a",
      label: "Run A",
      runDir: "/runs/a",
      session,
    },
    { activate: true }
  );

  const before = store.listTabs();
  const record = store.getTab("tab-a");
  record.title = "Run Alpha";

  const after = store.listTabs();

  assert.notEqual(after, before);
  assert.equal(after[0]?.title, "Run Alpha");
  assert.equal(after[0]?.label, "Run Alpha");
  assert.equal(record?.session, session);
});

test("spreading a live record still honors explicit legacy metadata overrides", () => {
  const store = createTabbedSessionsStore();

  const record = store.upsertTab(
    {
      tabId: "tab-a",
      label: "Run A",
      runDir: "/runs/a",
      busy: true,
      dirty: true,
    },
    { activate: true }
  );

  store.upsertTab({
    ...record,
    label: "Run Alpha",
    busy: false,
    dirty: false,
  });

  assert.deepEqual(store.listTabs()[0], {
    schemaVersion: SESSION_TAB_SCHEMA_VERSION,
    tabId: "tab-a",
    title: "Run Alpha",
    label: "Run Alpha",
    runDir: "/runs/a",
    active: true,
    isActive: true,
    busy: false,
    isBusy: false,
    dirty: false,
    isDirty: false,
    thumbnailPath: null,
    canClose: false,
    createdAt: store.listTabs()[0].createdAt,
    updatedAt: store.listTabs()[0].updatedAt,
  });
});

test("tabbed session bridge constants remain stable", () => {
  assert.equal(TABBED_SESSIONS_BRIDGE_KEY, "__JUGGERNAUT_TABS__");
  assert.equal(TABBED_SESSIONS_CHANGED_EVENT, "juggernaut:tabs-changed");
});
