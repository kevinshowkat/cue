import test from "node:test";
import assert from "node:assert/strict";

import {
  createTimelineUi,
  timelineActionKey,
  timelineCardStateForNode,
  timelineNodeAriaLabel,
  timelineNodeSummary,
} from "../src/app/timeline_ui.js";

function createFakeClassList(initialValues = []) {
  const values = new Set(initialValues);
  return {
    add(...tokens) {
      for (const token of tokens) values.add(token);
    },
    remove(...tokens) {
      for (const token of tokens) values.delete(token);
    },
    contains(token) {
      return values.has(token);
    },
    toggle(token, force) {
      if (force === true) {
        values.add(token);
        return true;
      }
      if (force === false) {
        values.delete(token);
        return false;
      }
      if (values.has(token)) {
        values.delete(token);
        return false;
      }
      values.add(token);
      return true;
    },
  };
}

function syncStripSiblings(strip) {
  for (let index = 0; index < strip.children.length; index += 1) {
    strip.children[index].nextSibling = strip.children[index + 1] || null;
  }
  strip.firstChild = strip.children[0] || null;
}

function createFakeTimelineCard(nodeId, structureKey) {
  const attributes = new Map();
  return {
    className: "timeline-card",
    dataset: {
      nodeId,
      structureKey,
    },
    parentNode: null,
    nextSibling: null,
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    getAttribute(name) {
      return attributes.get(name) || null;
    },
    remove() {
      if (this.parentNode) this.parentNode.removeChild(this);
    },
  };
}

function createFakeTimelineStrip(initialChildren = []) {
  const strip = {
    classList: createFakeClassList(),
    children: [],
    firstChild: null,
    appendChild(node) {
      return this.insertBefore(node, null);
    },
    insertBefore(node, referenceNode) {
      if (node.parentNode === this) {
        const currentIndex = this.children.indexOf(node);
        if (currentIndex >= 0) this.children.splice(currentIndex, 1);
      } else if (node.parentNode?.removeChild) {
        node.parentNode.removeChild(node);
      }
      const index = referenceNode ? this.children.indexOf(referenceNode) : -1;
      const insertIndex = index >= 0 ? index : this.children.length;
      this.children.splice(insertIndex, 0, node);
      node.parentNode = this;
      syncStripSiblings(this);
      return node;
    },
    removeChild(node) {
      const index = this.children.indexOf(node);
      if (index >= 0) this.children.splice(index, 1);
      node.parentNode = null;
      node.nextSibling = null;
      syncStripSiblings(this);
      return node;
    },
    replaceChild(nextNode, previousNode) {
      const index = this.children.indexOf(previousNode);
      assert.notEqual(index, -1);
      if (nextNode.parentNode === this) {
        const nextIndex = this.children.indexOf(nextNode);
        if (nextIndex >= 0) this.children.splice(nextIndex, 1);
      } else if (nextNode.parentNode?.removeChild) {
        nextNode.parentNode.removeChild(nextNode);
      }
      this.children.splice(index, 1, nextNode);
      previousNode.parentNode = null;
      previousNode.nextSibling = null;
      nextNode.parentNode = this;
      syncStripSiblings(this);
      return previousNode;
    },
    replaceChildren(...nodes) {
      for (const child of this.children) {
        child.parentNode = null;
        child.nextSibling = null;
      }
      this.children = [];
      this.firstChild = null;
      for (const node of nodes) this.appendChild(node);
    },
    querySelectorAll(selector) {
      if (selector === ".timeline-card[data-node-id]") {
        return this.children.filter((child) => child.className === "timeline-card" && child.dataset?.nodeId);
      }
      if (selector === ".timeline-empty") {
        return this.children.filter((child) => child.className === "timeline-empty muted");
      }
      return [];
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
  };
  for (const child of initialChildren) strip.appendChild(child);
  return strip;
}

function createFakeElement(tagName) {
  const attributes = new Map();
  return {
    tagName,
    className: "",
    classList: createFakeClassList(),
    dataset: {},
    children: [],
    parentNode: null,
    nextSibling: null,
    textContent: "",
    innerHTML: "",
    title: "",
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    getAttribute(name) {
      return attributes.get(name) || null;
    },
    remove() {
      if (this.parentNode?.removeChild) this.parentNode.removeChild(this);
    },
  };
}

function makeTimelineUi({
  state = {},
  els = {},
  timelineSortedNodes = () => [],
  currentTimelineHeadNode = () => null,
  timelineNodeSummary = (node) => String(node?.action || node?.label || "State"),
  timelineNodeLabel = (node) => String(node?.label || node?.action || "Timeline"),
  timelineNodeAriaLabel = (node, { current = false, future = false, historical = false } = {}) => {
    const pieces = [timelineNodeSummary(node)];
    if (current) pieces.push("Current state");
    else if (historical) pieces.push("Historical state");
    else if (future) pieces.push("Future state");
    return pieces.join(". ");
  },
  timelineCardStateForNode = (node, headNode = null) => {
    const headNodeId = String(headNode?.nodeId || "").trim() || null;
    const headSeq = Math.max(0, Number(headNode?.seq) || 0);
    const current = headNodeId === String(node?.nodeId || "").trim();
    const future = !current && Math.max(0, Number(node?.seq) || 0) > headSeq;
    const historical = !current && !future;
    return {
      current,
      future,
      historical,
      inactive: !current,
    };
  },
  timelineActionKey = (action = "state") => String(action || "").trim().toLowerCase() || "state",
  timelineCardGlyphMarkup = () => "",
  timelineNodeStructureKey = (node = null) => String(node?.structureKey || `${node?.nodeId || ""}:${node?.key || ""}`),
  document = null,
  ensureImageUrl = async () => null,
  THUMB_PLACEHOLDER_SRC = "placeholder",
} = {}) {
  state.timelineOpen = "timelineOpen" in state ? state.timelineOpen : true;
  state.timelinePreviewNodeId = state.timelinePreviewNodeId ?? null;
  state.timelineNodesById = state.timelineNodesById instanceof Map ? state.timelineNodesById : new Map();
  state.timelineCarouselWheel =
    state.timelineCarouselWheel && typeof state.timelineCarouselWheel === "object"
      ? state.timelineCarouselWheel
      : { delta: 0, lastAt: 0 };
  state.timelineCarouselChromeFrame = Number(state.timelineCarouselChromeFrame) || 0;
  state.timelineSuppressClickUntil = Number(state.timelineSuppressClickUntil) || 0;
  state.lastTimelineCenteredNodeId = state.lastTimelineCenteredNodeId ?? null;
  state.timelineVersion = Number(state.timelineVersion) || 0;
  state.timelineLatestNodeId = state.timelineLatestNodeId ?? null;
  state.timelineNextSeq = Number(state.timelineNextSeq) || 1;
  return createTimelineUi({
    state,
    els,
    timelineSortedNodes,
    currentTimelineHeadNode,
    timelineNodeSummary,
    timelineNodeLabel,
    timelineNodeAriaLabel,
    timelineCardStateForNode,
    timelineActionKey,
    timelineCardGlyphMarkup,
    timelineNodeStructureKey,
    THUMB_PLACEHOLDER_SRC,
    ensureImageUrl,
    document,
  });
}

test("timeline carousel target left advances by carousel pages and clamps to the strip bounds", () => {
  const ui = makeTimelineUi();
  const cards = [0, 60, 120, 180, 240, 300, 360].map((offsetLeft, index) => ({
    offsetLeft,
    dataset: { nodeId: `tl-${index + 1}` },
  }));
  const strip = {
    clientWidth: 180,
    scrollWidth: 460,
    scrollLeft: 0,
    querySelectorAll(selector) {
      assert.equal(selector, ".timeline-card[data-node-id]");
      return cards;
    },
  };

  assert.equal(ui.timelineCarouselTargetLeft(strip, 1), 180);

  strip.scrollLeft = 180;
  assert.equal(ui.timelineCarouselTargetLeft(strip, 1), 280);

  strip.scrollLeft = 280;
  assert.equal(ui.timelineCarouselTargetLeft(strip, -1), 120);
});

test("timeline carousel anchors include the start and final clamped edge", () => {
  const ui = makeTimelineUi();
  const strip = {
    clientWidth: 200,
    scrollWidth: 420,
    querySelectorAll() {
      return [{ offsetLeft: 0 }, { offsetLeft: 80 }, { offsetLeft: 160 }, { offsetLeft: 320 }];
    },
  };

  assert.deepEqual(ui.timelineCarouselAnchors(strip), [0, 80, 160, 220]);
});

test("timeline carousel direction state exposes left/right arrow availability at the strip edges", () => {
  const ui = makeTimelineUi();
  const strip = {
    clientWidth: 180,
    scrollWidth: 420,
    scrollLeft: 0,
  };

  assert.deepEqual(ui.timelineCarouselDirectionState(strip), {
    hasOverflow: true,
    currentLeft: 0,
    maxScroll: 240,
    canPageLeft: false,
    canPageRight: true,
  });

  strip.scrollLeft = 120;
  assert.deepEqual(ui.timelineCarouselDirectionState(strip), {
    hasOverflow: true,
    currentLeft: 120,
    maxScroll: 240,
    canPageLeft: true,
    canPageRight: true,
  });

  strip.scrollLeft = 240;
  assert.deepEqual(ui.timelineCarouselDirectionState(strip), {
    hasOverflow: true,
    currentLeft: 240,
    maxScroll: 240,
    canPageLeft: true,
    canPageRight: false,
  });
});

test("timeline detail text previews hovered target states and falls back to the current head", () => {
  const state = {
    timelinePreviewNodeId: null,
    timelineNodesById: new Map([
      ["tl-1", { nodeId: "tl-1", action: "Import", label: "A.jpg" }],
      ["tl-2", { nodeId: "tl-2", action: "Mark", label: "A.jpg" }],
    ]),
  };
  const headNode = { nodeId: "tl-1", action: "Import", label: "A.jpg" };
  const ui = makeTimelineUi({
    state,
    currentTimelineHeadNode: () => headNode,
    timelineNodeSummary: (node) => `${node.action === "Import" ? "Imported" : "Marked"} ${node.label}`,
  });

  assert.equal(ui.timelineDetailText(headNode), "Imported A.jpg");

  state.timelinePreviewNodeId = "tl-2";
  assert.equal(ui.timelineDetailText(headNode), "Preview change: Marked A.jpg");

  state.timelinePreviewNodeId = "tl-1";
  assert.equal(ui.timelineDetailText(headNode), "Current state: Imported A.jpg");
});

test("timeline shelf summary uses guidance when expanded and latest-state detail when collapsed", () => {
  const state = { timelineOpen: true };
  const nodes = [{ nodeId: "tl-1" }, { nodeId: "tl-2" }];
  const headNode = { nodeId: "tl-2", action: "Moved", label: "A.jpg" };
  const ui = makeTimelineUi({
    state,
    timelineNodeSummary: (node) => `${node.action} ${node.label}`,
  });

  assert.equal(ui.timelineShelfSummaryText(nodes, headNode), "2 states · Select a state to rewind");
  assert.equal(ui.timelineShelfSummaryText(nodes, headNode, { timelineOpen: false }), "2 states · Moved A.jpg");
});

test("syncTimelineDockVisibility restores the dock after tab-switch suspension", () => {
  const state = { timelineOpen: true };
  const timelineDock = {
    classList: createFakeClassList(["hidden"]),
  };
  const timelineShell = {
    classList: createFakeClassList(["is-collapsed"]),
  };
  const timelineBody = {
    hidden: true,
    ariaHidden: "true",
    setAttribute(name, value) {
      if (name === "aria-hidden") this.ariaHidden = value;
    },
  };
  const timelineToggle = {
    title: "",
    attributes: new Map(),
    setAttribute(name, value) {
      this.attributes.set(name, value);
    },
  };
  const timelineToggleLabel = { textContent: "" };
  const timelineToggleSummary = { textContent: "" };
  const els = {
    timelineDock,
    timelineShell,
    timelineBody,
    timelineToggle,
    timelineToggleLabel,
    timelineToggleSummary,
  };
  const headNode = { nodeId: "tl-1", action: "Moved", label: "A.jpg" };
  const nodes = [headNode];
  const ui = makeTimelineUi({
    state,
    els,
    timelineSortedNodes: () => nodes,
    currentTimelineHeadNode: () => headNode,
    timelineNodeSummary: (node) => `${node.action} ${node.label}`,
  });

  assert.equal(ui.syncTimelineDockVisibility(), true);
  assert.equal(timelineDock.classList.contains("hidden"), false);
  assert.equal(timelineDock.classList.contains("is-collapsed"), false);
  assert.equal(timelineShell.classList.contains("is-collapsed"), false);
  assert.equal(timelineBody.hidden, false);
  assert.equal(timelineBody.ariaHidden, "false");
  assert.equal(timelineToggle.attributes.get("aria-expanded"), "true");
  assert.equal(timelineToggleLabel.textContent, "History");
  assert.equal(timelineToggleSummary.textContent, "1 state · Select a state to rewind");
});

test("timeline detail text is empty when no head node exists", () => {
  const ui = makeTimelineUi({
    state: {
      timelinePreviewNodeId: null,
      timelineNodesById: new Map(),
    },
    currentTimelineHeadNode: () => null,
    timelineNodeSummary: () => "unused",
  });

  assert.equal(ui.timelineDetailText(null), "");
});

test("timeline module classifies result and transform actions for card glyphs", () => {
  assert.equal(timelineActionKey("Prompt Generate"), "result");
  assert.equal(timelineActionKey("Move"), "move");
  assert.equal(timelineActionKey("", "annotation"), "mark");
});

test("timeline node summary renders import history as readable prose", () => {
  assert.equal(
    timelineNodeSummary({
      action: "Import",
      label: "spongebob.webp",
      imageIds: ["img-1"],
    }),
    "Imported spongebob.webp (1 image)"
  );
});

test("timeline node summary treats canvas image counts as context for transforms", () => {
  assert.equal(
    timelineNodeSummary({
      action: "Move",
      label: "squidward.jpeg",
      imageIds: ["img-1", "img-2", "img-3", "img-4"],
    }),
    "Moved squidward.jpeg in a 4-image canvas"
  );
});

test("timeline module exposes current and future card state in its aria labels", () => {
  const headNode = { nodeId: "tl-2", seq: 2, action: "Move", label: "B.png" };
  const currentState = timelineCardStateForNode({ nodeId: "tl-2", seq: 2 }, headNode);
  const futureState = timelineCardStateForNode({ nodeId: "tl-3", seq: 3 }, headNode);

  assert.deepEqual(currentState, {
    current: true,
    future: false,
    historical: false,
    inactive: false,
  });
  assert.deepEqual(futureState, {
    current: false,
    future: true,
    historical: false,
    inactive: true,
  });
  assert.equal(
    timelineNodeAriaLabel(
      { action: "Move", label: "B.png", imageIds: ["img-1", "img-2"] },
      { current: true }
    ),
    "Moved B.png in a 2-image canvas. Current state"
  );
});

test("rebuildTimelineStrip preserves existing cards when a new timeline node appends", () => {
  const firstCard = createFakeTimelineCard("tl-1", "tl-1:k1");
  const secondCard = createFakeTimelineCard("tl-2", "tl-2:k2");
  const strip = createFakeTimelineStrip([firstCard, secondCard]);
  const builtButtons = [];
  const ui = makeTimelineUi({
    els: { timelineStrip: strip },
    state: { lastTimelineCenteredNodeId: "tl-2" },
    timelineNodeStructureKey: (node) => `${node.nodeId}:${node.key}`,
    document: {
      createElement(tagName) {
        const element = createFakeElement(tagName);
        if (tagName === "button") builtButtons.push(element);
        return element;
      },
    },
  });

  const changed = ui.rebuildTimelineStrip(
    [
      { nodeId: "tl-1", key: "k1" },
      { nodeId: "tl-2", key: "k2" },
      { nodeId: "tl-3", key: "k3" },
    ],
    { nodeId: "tl-3" }
  );

  assert.equal(changed, true);
  assert.deepEqual(strip.children.map((child) => child.dataset.nodeId), ["tl-1", "tl-2", "tl-3"]);
  assert.equal(strip.children[0], firstCard);
  assert.equal(strip.children[1], secondCard);
  assert.equal(builtButtons.length, 1);
});

test("rebuildTimelineStrip switches the tray into centered empty mode with only the empty copy", () => {
  const strip = createFakeTimelineStrip();
  const shell = {
    classList: createFakeClassList(),
  };
  const ui = makeTimelineUi({
    els: { timelineShell: shell, timelineStrip: strip },
    state: { lastTimelineCenteredNodeId: "tl-2" },
    document: {
      createElement(tagName) {
        assert.equal(tagName, "div");
        return createFakeElement(tagName);
      },
    },
  });

  const changed = ui.rebuildTimelineStrip([], null);

  assert.equal(changed, true);
  assert.equal(shell.classList.contains("is-empty"), true);
  assert.equal(strip.classList.contains("is-empty"), true);
  assert.equal(strip.children.length, 1);
  assert.equal(strip.children[0].className, "timeline-empty muted");
  assert.equal(strip.children[0].textContent, "Your timeline appears here after you upload your first image.");
});
