export const TABBED_SESSIONS_BRIDGE_KEY = "__JUGGERNAUT_TABS__";
export const TABBED_SESSIONS_CHANGED_EVENT = "juggernaut:tabs-changed";

const TAB_METADATA_FIELDS = [
  "tabId",
  "label",
  "runDir",
  "busy",
  "dirty",
  "thumbnailPath",
  "canClose",
  "createdAt",
  "updatedAt",
];
const TAB_METADATA_KEYS = new Set(TAB_METADATA_FIELDS);
const TAB_META_STATE = Symbol("tab-meta-state");

function normalizeTabId(value = "") {
  return String(value || "").trim();
}

function clampInsertIndex(index, length) {
  const normalized = Number(index);
  if (!Number.isFinite(normalized)) return Math.max(0, length);
  return Math.max(0, Math.min(length, Math.trunc(normalized)));
}

function getObjectDescriptors(object) {
  return object && typeof object === "object" ? Object.getOwnPropertyDescriptors(object) : {};
}

function readDescriptorValue(object, descriptors, key) {
  const descriptor = descriptors[key];
  if (!descriptor) return { found: false, value: undefined };
  if (Object.prototype.hasOwnProperty.call(descriptor, "value")) {
    return { found: true, value: descriptor.value };
  }
  return { found: true, value: object?.[key] };
}

function normalizeTabLabel(value, tabId) {
  return String(value || tabId || "Run");
}

function normalizeTabRunDir(value) {
  return value ? String(value) : null;
}

function normalizeTabThumbnailPath(value) {
  return value ? String(value) : null;
}

function normalizeTabCanClose(value) {
  return value !== false;
}

function normalizeTabTimestamp(value, fallback) {
  return Number(value) || fallback;
}

function createTabMetaState(tabId) {
  return {
    tabId,
    label: normalizeTabLabel("", tabId),
    runDir: null,
    busy: false,
    dirty: false,
    thumbnailPath: null,
    canClose: true,
    createdAt: 0,
    updatedAt: 0,
  };
}

function cloneTabSummary(tab, activeTabId, totalTabs) {
  const meta = tab?.[TAB_META_STATE] || null;
  const tabId = normalizeTabId(meta?.tabId || tab?.tabId || tab?.id);
  return {
    tabId,
    label: normalizeTabLabel(meta?.label || tab?.label, tabId),
    runDir: normalizeTabRunDir(meta?.runDir || tab?.runDir),
    active: tabId === activeTabId,
    busy: Boolean(meta?.busy ?? tab?.busy),
    dirty: Boolean(meta?.dirty ?? tab?.dirty),
    thumbnailPath: normalizeTabThumbnailPath(meta?.thumbnailPath ?? tab?.thumbnailPath),
    canClose: totalTabs > 1 && normalizeTabCanClose(meta?.canClose ?? tab?.canClose),
    createdAt: normalizeTabTimestamp(meta?.createdAt ?? tab?.createdAt, 0),
    updatedAt: normalizeTabTimestamp(meta?.updatedAt ?? tab?.updatedAt, 0),
  };
}

function applyTabPayload(record, input, descriptors) {
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key === "id" || key === "active" || TAB_METADATA_KEYS.has(key)) continue;
    Object.defineProperty(record, key, descriptor);
  }
}

function applyTabMetadata(record, input, descriptors, { tabId, now, isInsert = false }) {
  const meta = record?.[TAB_META_STATE] || createTabMetaState(tabId);
  const label = readDescriptorValue(input, descriptors, "label");
  const runDir = readDescriptorValue(input, descriptors, "runDir");
  const busy = readDescriptorValue(input, descriptors, "busy");
  const dirty = readDescriptorValue(input, descriptors, "dirty");
  const thumbnailPath = readDescriptorValue(input, descriptors, "thumbnailPath");
  const canClose = readDescriptorValue(input, descriptors, "canClose");
  const createdAt = readDescriptorValue(input, descriptors, "createdAt");
  const updatedAt = readDescriptorValue(input, descriptors, "updatedAt");
  const hasMetadataPatch =
    label.found ||
    runDir.found ||
    busy.found ||
    dirty.found ||
    thumbnailPath.found ||
    canClose.found ||
    createdAt.found ||
    updatedAt.found;
  const next = {
    ...meta,
    tabId,
    label: label.found ? normalizeTabLabel(label.value, tabId) : normalizeTabLabel(meta.label, tabId),
    runDir: runDir.found ? normalizeTabRunDir(runDir.value) : normalizeTabRunDir(meta.runDir),
    busy: busy.found ? Boolean(busy.value) : Boolean(meta.busy),
    dirty: dirty.found ? Boolean(dirty.value) : Boolean(meta.dirty),
    thumbnailPath: thumbnailPath.found ? normalizeTabThumbnailPath(thumbnailPath.value) : normalizeTabThumbnailPath(meta.thumbnailPath),
    canClose: canClose.found ? normalizeTabCanClose(canClose.value) : normalizeTabCanClose(meta.canClose),
    createdAt: createdAt.found
      ? normalizeTabTimestamp(createdAt.value, now)
      : normalizeTabTimestamp(meta.createdAt, isInsert ? now : 0),
    updatedAt: updatedAt.found
      ? normalizeTabTimestamp(updatedAt.value, now)
      : isInsert
        ? now
        : hasMetadataPatch
          ? now
          : normalizeTabTimestamp(meta.updatedAt, 0),
  };
  let changed = false;
  for (const key of TAB_METADATA_FIELDS) {
    if (meta[key] === next[key]) continue;
    meta[key] = next[key];
    changed = true;
  }
  return changed;
}

export function createTabbedSessionsStore({ onChange = null } = {}) {
  let tabsOrder = [];
  const tabsById = new Map();
  let activeTabId = null;
  const listeners = new Set();
  let metadataVersion = 0;
  let cachedTabsVersion = -1;
  let cachedTabs = Object.freeze([]);
  let cachedSnapshotVersion = -1;
  let cachedSnapshot = Object.freeze({
    tabsOrder: Object.freeze([]),
    activeTabId: null,
    tabs: cachedTabs,
  });

  function invalidateMetadataCache() {
    metadataVersion += 1;
    cachedTabsVersion = -1;
    cachedSnapshotVersion = -1;
  }

  function ensureTabRecord(tabId) {
    const normalized = normalizeTabId(tabId);
    if (!normalized) return null;
    let record = tabsById.get(normalized) || null;
    if (record) return record;
    record = {};
    const meta = createTabMetaState(normalized);
    Object.defineProperty(record, TAB_META_STATE, {
      value: meta,
      configurable: false,
      enumerable: false,
      writable: false,
    });
    Object.defineProperty(record, "tabId", {
      enumerable: true,
      configurable: true,
      get() {
        return meta.tabId;
      },
    });
    for (const key of TAB_METADATA_FIELDS.filter((field) => field !== "tabId")) {
      Object.defineProperty(record, key, {
        enumerable: true,
        configurable: true,
        get() {
          return meta[key];
        },
        set(value) {
          let nextValue = value;
          if (key === "label") nextValue = normalizeTabLabel(value, meta.tabId);
          if (key === "runDir") nextValue = normalizeTabRunDir(value);
          if (key === "busy" || key === "dirty") nextValue = Boolean(value);
          if (key === "thumbnailPath") nextValue = normalizeTabThumbnailPath(value);
          if (key === "canClose") nextValue = normalizeTabCanClose(value);
          if (key === "createdAt" || key === "updatedAt") {
            nextValue = normalizeTabTimestamp(value, key === "updatedAt" ? Date.now() : 0);
          }
          if (meta[key] === nextValue) return;
          meta[key] = nextValue;
          if (key !== "createdAt" && key !== "updatedAt") {
            meta.updatedAt = Date.now();
          }
          invalidateMetadataCache();
        },
      });
    }
    tabsById.set(normalized, record);
    return record;
  }

  function snapshot() {
    if (cachedSnapshotVersion === metadataVersion) return cachedSnapshot;
    cachedSnapshot = Object.freeze({
      tabsOrder: Object.freeze(tabsOrder.slice()),
      activeTabId,
      tabs: listTabs(),
    });
    cachedSnapshotVersion = metadataVersion;
    return cachedSnapshot;
  }

  function notify(detail = {}) {
    const base = snapshot();
    const next = Object.keys(detail).length ? { ...base, ...detail } : base;
    if (typeof onChange === "function") {
      onChange(next);
    }
    for (const listener of listeners) {
      listener(next);
    }
    return next;
  }

  function listTabs() {
    if (cachedTabsVersion === metadataVersion) return cachedTabs;
    const totalTabs = tabsOrder.length;
    cachedTabs = Object.freeze(
      tabsOrder.map((tabId) => Object.freeze(cloneTabSummary(tabsById.get(tabId), activeTabId, totalTabs))).filter((tab) => tab.tabId)
    );
    cachedTabsVersion = metadataVersion;
    return cachedTabs;
  }

  function getTab(tabId) {
    const normalized = normalizeTabId(tabId);
    if (!normalized) return null;
    return tabsById.get(normalized) || null;
  }

  function upsertTab(tab, { activate = false, index = tabsOrder.length } = {}) {
    const descriptors = getObjectDescriptors(tab);
    const tabIdInput = readDescriptorValue(tab, descriptors, "tabId");
    const legacyIdInput = readDescriptorValue(tab, descriptors, "id");
    const tabId = normalizeTabId(tabIdInput.value || legacyIdInput.value);
    if (!tabId) {
      throw new Error("tabId is required");
    }
    let record = tabsById.get(tabId) || null;
    const existing = Boolean(record);
    const now = Date.now();
    if (!record) {
      record = ensureTabRecord(tabId);
      const insertAt = clampInsertIndex(index, tabsOrder.length);
      tabsOrder = tabsOrder.slice();
      tabsOrder.splice(insertAt, 0, tabId);
    }
    applyTabPayload(record, tab, descriptors);
    let changed = applyTabMetadata(record, tab, descriptors, { tabId, now, isInsert: !existing });
    if (activate || (!activeTabId && tabsOrder.includes(tabId))) {
      if (activeTabId !== tabId) {
        const previous = activeTabId ? tabsById.get(activeTabId) || null : null;
        const previousMeta = previous?.[TAB_META_STATE] || null;
        const nextMeta = record?.[TAB_META_STATE] || null;
        if (previousMeta) previousMeta.updatedAt = now;
        if (nextMeta) nextMeta.updatedAt = now;
        changed = true;
      }
      activeTabId = tabId;
    }
    if (changed || !existing) {
      invalidateMetadataCache();
    }
    if (!changed && existing) {
      return record;
    }
    notify({
      type: existing ? "update" : "insert",
      tabId,
    });
    return record;
  }

  function updateTabMeta(tabId, metadata = {}) {
    const normalized = normalizeTabId(tabId);
    if (!normalized || !tabsById.has(normalized)) return null;
    const record = tabsById.get(normalized) || null;
    const descriptors = getObjectDescriptors(metadata);
    const changed = applyTabMetadata(record, metadata, descriptors, {
      tabId: normalized,
      now: Date.now(),
      isInsert: false,
    });
    if (!changed) return record;
    invalidateMetadataCache();
    notify({
      type: "metadata",
      tabId: normalized,
    });
    return record;
  }

  function updateTabMetadata(tabId, metadata = {}) {
    return updateTabMeta(tabId, metadata);
  }

  function markTabDirty(tabId, dirty) {
    return updateTabMeta(tabId, { dirty: Boolean(dirty) });
  }

  function setTabBusy(tabId, busy) {
    return updateTabMeta(tabId, { busy: Boolean(busy) });
  }

  function setTabThumbnailPath(tabId, path) {
    return updateTabMeta(tabId, { thumbnailPath: path ? String(path) : null });
  }

  function setTabCanClose(tabId, canClose) {
    return updateTabMeta(tabId, { canClose: normalizeTabCanClose(canClose) });
  }

  function setActiveTab(tabId) {
    const normalized = normalizeTabId(tabId);
    if (!normalized || !tabsById.has(normalized)) return null;
    if (activeTabId === normalized) return tabsById.get(normalized) || null;
    const now = Date.now();
    if (activeTabId && tabsById.has(activeTabId)) {
      const previousMeta = tabsById.get(activeTabId)?.[TAB_META_STATE] || null;
      if (previousMeta) previousMeta.updatedAt = now;
    }
    activeTabId = normalized;
    const next = tabsById.get(normalized) || null;
    const nextMeta = next?.[TAB_META_STATE] || null;
    if (nextMeta) nextMeta.updatedAt = now;
    invalidateMetadataCache();
    notify({
      type: "activate",
      tabId: normalized,
    });
    return next;
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
    if (activeTabId && tabsById.has(activeTabId)) {
      const nextMeta = tabsById.get(activeTabId)?.[TAB_META_STATE] || null;
      if (nextMeta) nextMeta.updatedAt = Date.now();
    }
    invalidateMetadataCache();
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
    get metadataVersion() {
      return metadataVersion;
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
    setTabBusy,
    setTabCanClose,
    setTabThumbnailPath,
    markTabDirty,
    snapshot,
    subscribe,
    updateTabMeta,
    updateTabMetadata,
    upsertTab,
  };
}
