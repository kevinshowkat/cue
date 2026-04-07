import test from "node:test";
import assert from "node:assert/strict";

import { createSessionTabRenameRuntime } from "../src/app/tab_rename_runtime.js";
import { createSessionTabStripUi } from "../src/app/tab_strip_ui.js";

function datasetKeyFromAttribute(name = "") {
  return String(name || "")
    .replace(/^data-/, "")
    .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function createClassList(node) {
  return {
    add(...tokens) {
      for (const token of tokens) {
        if (!token) continue;
        node._classTokens.add(token);
      }
      node._syncClassName();
    },
    remove(...tokens) {
      for (const token of tokens) {
        node._classTokens.delete(token);
      }
      node._syncClassName();
    },
    contains(token) {
      return node._classTokens.has(token);
    },
    toggle(token, force) {
      if (force === true) {
        node._classTokens.add(token);
        node._syncClassName();
        return true;
      }
      if (force === false) {
        node._classTokens.delete(token);
        node._syncClassName();
        return false;
      }
      if (node._classTokens.has(token)) {
        node._classTokens.delete(token);
        node._syncClassName();
        return false;
      }
      node._classTokens.add(token);
      node._syncClassName();
      return true;
    },
  };
}

function matchesSimpleSelector(node, selector = "") {
  const trimmed = String(selector || "").trim();
  if (!trimmed) return false;
  const classMatch = trimmed.match(/^\.([a-zA-Z0-9_-]+)/);
  if (classMatch && !node.classList.contains(classMatch[1])) return false;
  const dataMatch = trimmed.match(/\[data-([a-z0-9-]+)="([^"]*)"\]/i);
  if (dataMatch) {
    const key = datasetKeyFromAttribute(`data-${dataMatch[1]}`);
    if (String(node.dataset?.[key] || "") !== dataMatch[2]) return false;
  }
  if (!classMatch && !dataMatch) return false;
  return true;
}

function findDescendants(root, selector) {
  const matches = [];
  const visit = (node) => {
    for (const child of node.children || []) {
      if (matchesSimpleSelector(child, selector)) matches.push(child);
      visit(child);
    }
  };
  visit(root);
  return matches;
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = String(tagName || "div").toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.parentElement = null;
    this.dataset = {};
    this.attributes = {};
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.type = "";
    this.maxLength = 0;
    this.placeholder = "";
    this.spellcheck = true;
    this.autocomplete = "";
    this.tabIndex = 0;
    this.title = "";
    this.innerHTML = "";
    this.textContent = "";
    this._classTokens = new Set();
    this._className = "";
    this.classList = createClassList(this);
    this.listeners = new Map();
    Object.defineProperty(this, "className", {
      get: () => this._className,
      set: (value) => {
        this._classTokens = new Set(
          String(value || "")
            .split(/\s+/)
            .filter(Boolean)
        );
        this._syncClassName();
      },
      enumerable: true,
      configurable: true,
    });
  }

  _syncClassName() {
    this._className = [...this._classTokens].join(" ");
  }

  _attach(child) {
    if (!child) return child;
    if (child.parentNode?.removeChild) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  append(...children) {
    for (const child of children) {
      if (!child) continue;
      if (child.isFragment) {
        for (const nested of child.children) this._attach(nested);
        continue;
      }
      this._attach(child);
    }
  }

  appendChild(child) {
    return this._attach(child);
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    child.parentElement = null;
    return child;
  }

  replaceChildren(...children) {
    for (const child of this.children) {
      child.parentNode = null;
      child.parentElement = null;
    }
    this.children = [];
    this.append(...children);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (String(name).startsWith("data-")) {
      this.dataset[datasetKeyFromAttribute(name)] = String(value);
    }
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  dispatchEvent(event = {}) {
    const payload = {
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this.propagationStopped = true;
      },
      ...event,
    };
    if (!payload.target) payload.target = this;
    payload.currentTarget = this;
    for (const handler of this.listeners.get(payload.type) || []) {
      handler(payload);
    }
    return true;
  }

  contains(node) {
    let current = node;
    while (current) {
      if (current === this) return true;
      current = current.parentNode;
    }
    return false;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (matchesSimpleSelector(current, selector)) return current;
      current = current.parentNode;
    }
    return null;
  }

  querySelectorAll(selector = "") {
    const parts = String(selector || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return [];
    let contexts = [this];
    for (const part of parts) {
      contexts = contexts.flatMap((context) => findDescendants(context, part));
      if (!contexts.length) break;
    }
    return contexts;
  }

  querySelector(selector = "") {
    return this.querySelectorAll(selector)[0] || null;
  }

  focus() {
    this.focused = true;
  }

  select() {
    this.selected = true;
  }

  getBoundingClientRect() {
    return {
      width: Number(this._rectWidth) || 0,
    };
  }
}

function createFakeDocument() {
  return {
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    createDocumentFragment() {
      return {
        isFragment: true,
        children: [],
        append(...children) {
          for (const child of children) {
            if (!child) continue;
            this.children.push(child);
          }
        },
        appendChild(child) {
          if (!child) return child;
          this.children.push(child);
          return child;
        },
      };
    },
  };
}

function createEvent(type, overrides = {}) {
  return {
    type,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
    ...overrides,
  };
}

function createHarness() {
  const documentObj = createFakeDocument();
  const els = {
    sessionTabStrip: documentObj.createElement("div"),
    sessionTabList: documentObj.createElement("div"),
    timelineToggle: documentObj.createElement("button"),
    sessionTabNew: documentObj.createElement("button"),
    sessionTabFork: documentObj.createElement("button"),
    sessionTabDesignReview: documentObj.createElement("button"),
  };
  const tabs = [
    { tabId: "tab-a", title: "Tab A", runDir: "/runs/a", busy: false },
    { tabId: "tab-b", title: "Tab B", runDir: "/runs/b", busy: false },
  ];
  const records = new Map(
    tabs.map((tab) => [
      tab.tabId,
      {
        tabId: tab.tabId,
        label: tab.title,
        labelManual: false,
        automaticLabel: `Auto ${tab.tabId}`,
        runDir: tab.runDir,
        session: {
          label: tab.title,
          labelManual: false,
        },
      },
    ])
  );

  let activeTabId = "tab-a";
  let subscriber = null;
  const metadataCalls = [];
  const calls = {
    activate: [],
    close: [],
    timeline: 0,
    newSession: 0,
    fork: 0,
    reviewPointer: 0,
    reviewKeyboard: 0,
    reviewClick: 0,
    bump: [],
    toasts: [],
  };

  const snapshot = () => ({
    tabsOrder: tabs.map((tab) => tab.tabId),
    activeTabId,
    tabs: tabs.map((tab) => ({
      ...tab,
      active: tab.tabId === activeTabId,
      busy: Boolean(tab.busy),
    })),
  });

  let ui = null;
  const renameRuntime = createSessionTabRenameRuntime({
    renameState: {
      tabId: null,
      draft: "",
      focusRequested: false,
      lockedWidth: 0,
    },
    getActiveTabId: () => activeTabId,
    getTabById: (tabId) => records.get(tabId) || null,
    getDisplayLabel: (record, fallback) => String(record?.label || fallback || ""),
    defaultUntitledTitle: "Untitled Canvas",
    maxTitleLength: 40,
    normalizeTitleInput: (value, maxLen = 40) =>
      String(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLen),
    automaticLabelForRecord: (record, fallback) => String(record?.automaticLabel || fallback || ""),
    renderSessionTabStrip: () => ui.renderSessionTabStrip(),
    updateTabMetadata: (tabId, metadata) => {
      metadataCalls.push({ tabId, metadata });
      subscriber?.(snapshot());
    },
    getTabListElement: () => els.sessionTabList,
  });

  ui = createSessionTabStripUi({
    documentObj,
    els,
    listTabs: () => snapshot().tabs,
    subscribeTabs: (listener) => {
      subscriber = listener;
      return () => {
        subscriber = null;
      };
    },
    buildTabSummary: (tab, totalTabs) => {
      const record = records.get(tab?.tabId) || null;
      const reviewFlowState = String(record?.reviewFlowState || "").trim();
      return {
        tabId: String(tab?.tabId || ""),
        title: String(record?.label || tab?.title || ""),
        runDir: String(tab?.runDir || ""),
        isForked: Boolean(record?.forkedFromTabId),
        isActive: Boolean(tab?.active),
        isBusy: Boolean(tab?.busy),
        isDirty: false,
        canClose: totalTabs > 1,
        reviewFlowState,
        reviewFlowLabel: reviewFlowState || "",
        showReviewSpinner: reviewFlowState === "planning" || reviewFlowState === "applying",
        isRenaming: String(renameRuntime.state.tabId || "") === String(tab?.tabId || ""),
      };
    },
    renameRuntime,
    normalizeTitleInput: (value, maxLen = 40) =>
      String(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLen),
    maxTitleLength: 40,
    defaultUntitledTitle: "Untitled Canvas",
    getPlaceholderLabel: () => "No session yet",
    activateTab: async (tabId) => {
      calls.activate.push(tabId);
    },
    closeTab: async (tabId) => {
      calls.close.push(tabId);
    },
    bumpInteraction: (options) => {
      calls.bump.push(options);
    },
    showToast: (message, kind, duration) => {
      calls.toasts.push({ message, kind, duration });
    },
    onTimelineToggle: () => {
      calls.timeline += 1;
    },
    onNewSession: () => {
      calls.newSession += 1;
    },
    onForkSession: () => {
      calls.fork += 1;
    },
    onDesignReviewPointer: () => {
      calls.reviewPointer += 1;
    },
    onDesignReviewKeyboard: () => {
      calls.reviewKeyboard += 1;
    },
    onDesignReviewClick: () => {
      calls.reviewClick += 1;
    },
  });

  return {
    documentObj,
    els,
    tabs,
    records,
    renameRuntime,
    ui,
    metadataCalls,
    calls,
    setActiveTabId(nextTabId) {
      activeTabId = String(nextTabId || "");
    },
  };
}

test("tab strip ui routes title clicks, close clicks, and shell actions through injected callbacks", async () => {
  const harness = createHarness();
  harness.ui.installSessionTabStripUi();

  const activeItem = harness.els.sessionTabList.querySelector('.session-tab-item[data-tab-id="tab-a"]');
  activeItem._rectWidth = 217;

  const inactiveTitle = harness.els.sessionTabList.querySelector('.session-tab-item[data-tab-id="tab-b"] .session-tab-title');
  harness.els.sessionTabList.dispatchEvent(createEvent("click", { target: inactiveTitle }));
  await Promise.resolve();
  assert.deepEqual(harness.calls.activate, ["tab-b"]);

  const activeTitle = harness.els.sessionTabList.querySelector('.session-tab-item[data-tab-id="tab-a"] .session-tab-title');
  harness.els.sessionTabList.dispatchEvent(createEvent("click", { target: activeTitle }));
  assert.equal(harness.renameRuntime.state.tabId, "tab-a");

  const renameItem = harness.els.sessionTabList.querySelector('.session-tab-item[data-tab-id="tab-a"]');
  assert.equal(renameItem.style.width, "217px");
  const renameInput = renameItem.querySelector(".session-tab-title-input");
  assert.equal(renameInput.focused, true);
  assert.equal(renameInput.selected, true);

  const closeButton = harness.els.sessionTabList.querySelector('.session-tab-item[data-tab-id="tab-b"] .session-tab-close');
  harness.els.sessionTabList.dispatchEvent(createEvent("click", { target: closeButton }));
  await Promise.resolve();
  assert.deepEqual(harness.calls.close, ["tab-b"]);

  harness.els.timelineToggle.dispatchEvent(createEvent("click"));
  harness.els.sessionTabNew.dispatchEvent(createEvent("click"));
  harness.els.sessionTabFork.dispatchEvent(createEvent("click"));
  harness.els.sessionTabDesignReview.dispatchEvent(createEvent("pointerup", { button: 0 }));
  harness.els.sessionTabDesignReview.dispatchEvent(createEvent("keydown", { key: "Enter" }));
  harness.els.sessionTabDesignReview.dispatchEvent(createEvent("click"));

  assert.equal(harness.calls.timeline, 1);
  assert.equal(harness.calls.newSession, 1);
  assert.equal(harness.calls.fork, 1);
  assert.equal(harness.calls.reviewPointer, 1);
  assert.equal(harness.calls.reviewKeyboard, 1);
  assert.equal(harness.calls.reviewClick, 1);
});

test("inline rename normalizes draft input, cancels on Escape, and auto-labels on blur when emptied", () => {
  const harness = createHarness();
  harness.ui.installSessionTabStripUi();

  const activeItem = harness.els.sessionTabList.querySelector('.session-tab-item[data-tab-id="tab-a"]');
  activeItem._rectWidth = 212;

  let activeTitle = harness.els.sessionTabList.querySelector('.session-tab-item[data-tab-id="tab-a"] .session-tab-title');
  harness.els.sessionTabList.dispatchEvent(createEvent("click", { target: activeTitle }));

  let input = harness.els.sessionTabList.querySelector('.session-tab-item[data-tab-id="tab-a"] .session-tab-title-input');
  input.value = "  Renamed   Canvas   ";
  input.dispatchEvent(createEvent("input"));
  assert.equal(harness.renameRuntime.state.draft, "Renamed Canvas");

  input.dispatchEvent(createEvent("keydown", { key: "Escape" }));
  assert.equal(harness.renameRuntime.state.tabId, null);
  assert.equal(harness.records.get("tab-a").label, "Tab A");

  const reopenedItem = harness.els.sessionTabList.querySelector('.session-tab-item[data-tab-id="tab-a"]');
  reopenedItem._rectWidth = 212;
  activeTitle = harness.els.sessionTabList.querySelector('.session-tab-item[data-tab-id="tab-a"] .session-tab-title');
  harness.els.sessionTabList.dispatchEvent(createEvent("click", { target: activeTitle }));

  input = harness.els.sessionTabList.querySelector('.session-tab-item[data-tab-id="tab-a"] .session-tab-title-input');
  input.value = "   ";
  input.dispatchEvent(createEvent("input"));
  input.dispatchEvent(createEvent("blur"));

  assert.equal(harness.records.get("tab-a").labelManual, false);
  assert.equal(harness.records.get("tab-a").label, "Auto tab-a");
  assert.equal(harness.records.get("tab-a").session.label, "Auto tab-a");
  assert.equal(harness.records.get("tab-a").session.labelManual, false);
  assert.equal(harness.renameRuntime.state.tabId, null);
  assert.equal(harness.metadataCalls.length, 1);

  const renderedTitle = harness.els.sessionTabList.querySelector('.session-tab-item[data-tab-id="tab-a"] .session-tab-title');
  assert.equal(renderedTitle?.textContent, "Auto tab-a");
});
