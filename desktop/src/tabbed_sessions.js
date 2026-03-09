export const TABBED_SESSIONS_BRIDGE_KEY = "__JUGGERNAUT_TABS__";
export const TABBED_SESSIONS_CHANGED_EVENT = "juggernaut:tabs-changed";

function normalizeTabId(value = "") {
  return String(value || "").trim();
}

function clampInsertIndex(index, length) {
  const normalized = Number(index);
  if (!Number.isFinite(normalized)) return Math.max(0, length);
  return Math.max(0, Math.min(length, Math.trunc(normalized)));
}

function cloneTabSummary(tab, activeTabId) {
  const tabId = normalizeTabId(tab?.tabId || tab?.id);
  return {
    tabId,
    label: String(tab?.label || tabId || "Run"),
    runDir: tab?.runDir ? String(tab.runDir) : null,
    active: tabId === activeTabId,
    busy: Boolean(tab?.busy),
    createdAt: Number(tab?.createdAt) || 0,
    updatedAt: Number(tab?.updatedAt) || 0,
  };
}

export function createTabbedSessionsStore({ onChange = null } = {}) {
  let tabsOrder = [];
  const tabsById = new Map();
  let activeTabId = null;
  const listeners = new Set();

  function snapshot() {
    return {
      tabsOrder: tabsOrder.slice(),
      activeTabId,
      tabs: listTabs(),
    };
  }

  function notify(detail = {}) {
    const next = {
      ...snapshot(),
      ...detail,
    };
    if (typeof onChange === "function") {
      onChange(next);
    }
    for (const listener of listeners) {
      listener(next);
    }
    return next;
  }

  function listTabs() {
    return tabsOrder.map((tabId) => cloneTabSummary(tabsById.get(tabId), activeTabId)).filter((tab) => tab.tabId);
  }

  function getTab(tabId) {
    const normalized = normalizeTabId(tabId);
    if (!normalized) return null;
    return tabsById.get(normalized) || null;
  }

  function upsertTab(tab, { activate = false, index = tabsOrder.length } = {}) {
    const tabId = normalizeTabId(tab?.tabId || tab?.id);
    if (!tabId) {
      throw new Error("tabId is required");
    }
    const existing = tabsById.get(tabId) || null;
    const now = Date.now();
    const next = {
      ...(existing || {}),
      ...(tab && typeof tab === "object" ? tab : {}),
      tabId,
      createdAt: Number(existing?.createdAt) || now,
      updatedAt: now,
    };
    tabsById.set(tabId, next);
    if (!existing) {
      const insertAt = clampInsertIndex(index, tabsOrder.length);
      tabsOrder = tabsOrder.slice();
      tabsOrder.splice(insertAt, 0, tabId);
    }
    if (activate || (!activeTabId && tabsOrder.includes(tabId))) {
      activeTabId = tabId;
    }
    notify({
      type: existing ? "update" : "insert",
      tabId,
    });
    return next;
  }

  function setActiveTab(tabId) {
    const normalized = normalizeTabId(tabId);
    if (!normalized || !tabsById.has(normalized)) return null;
    activeTabId = normalized;
    notify({
      type: "activate",
      tabId: normalized,
    });
    return tabsById.get(normalized) || null;
  }

  function closeTab(tabId, { activateNeighbor = true } = {}) {
    const normalized = normalizeTabId(tabId);
    if (!normalized || !tabsById.has(normalized)) return null;
    const closed = tabsById.get(normalized) || null;
    tabsById.delete(normalized);
    const index = tabsOrder.indexOf(normalized);
    tabsOrder = tabsOrder.filter((id) => id !== normalized);
    if (activeTabId === normalized) {
      if (activateNeighbor && tabsOrder.length) {
        const fallbackIndex = Math.max(0, Math.min(index, tabsOrder.length - 1));
        activeTabId = tabsOrder[fallbackIndex] || null;
      } else {
        activeTabId = null;
      }
    }
    notify({
      type: "close",
      tabId: normalized,
    });
    return {
      closed,
      nextActiveId: activeTabId,
    };
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    listener(snapshot());
    return () => {
      listeners.delete(listener);
    };
  }

  return {
    get activeTabId() {
      return activeTabId;
    },
    get tabsById() {
      return tabsById;
    },
    get tabsOrder() {
      return tabsOrder;
    },
    closeTab,
    getTab,
    listTabs,
    setActiveTab,
    snapshot,
    subscribe,
    upsertTab,
  };
}
