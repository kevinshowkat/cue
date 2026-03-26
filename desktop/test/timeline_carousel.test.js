import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

function extractFunctionSource(name) {
  const markers = [`async function ${name}(`, `function ${name}(`];
  const start = markers
    .map((marker) => app.indexOf(marker))
    .find((index) => index >= 0);
  assert.notEqual(start, undefined, `Could not find function ${name}`);
  const signatureStart = app.indexOf("(", start);
  assert.notEqual(signatureStart, -1, `Could not find signature for ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (parenDepth === 0 && char === "{") {
      bodyStart = index;
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `Could not find body for ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    const char = app[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract function ${name}`);
}

function instantiateFunction(name, deps = {}) {
  const source = extractFunctionSource(name);
  const keys = Object.keys(deps);
  const values = Object.values(deps);
  return new Function(...keys, `return (${source});`)(...values);
}

function syncStripSiblings(strip) {
  for (let index = 0; index < strip.children.length; index += 1) {
    strip.children[index].nextSibling = strip.children[index + 1] || null;
  }
  strip.firstChild = strip.children[0] || null;
}

function createFakeTimelineCard(nodeId, structureKey) {
  return {
    className: "timeline-card",
    dataset: {
      nodeId,
      structureKey,
    },
    parentNode: null,
    nextSibling: null,
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
        return this.children.filter((child) => child.className === "timeline-empty");
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

test("timeline carousel target left advances by carousel pages and clamps to the strip bounds", () => {
  const timelineCarouselAnchors = instantiateFunction("timelineCarouselAnchors");
  const timelineCarouselTargetLeft = instantiateFunction("timelineCarouselTargetLeft", {
    timelineCarouselAnchors,
    TIMELINE_CAROUSEL_PAGE_RATIO: 0.82,
  });
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

  assert.equal(timelineCarouselTargetLeft(strip, 1), 180);

  strip.scrollLeft = 180;
  assert.equal(timelineCarouselTargetLeft(strip, 1), 280);

  strip.scrollLeft = 280;
  assert.equal(timelineCarouselTargetLeft(strip, -1), 120);
});

test("timeline carousel anchors include the start and final clamped edge", () => {
  const timelineCarouselAnchors = instantiateFunction("timelineCarouselAnchors");
  const strip = {
    clientWidth: 200,
    scrollWidth: 420,
    querySelectorAll() {
      return [{ offsetLeft: 0 }, { offsetLeft: 80 }, { offsetLeft: 160 }, { offsetLeft: 320 }];
    },
  };

  assert.deepEqual(timelineCarouselAnchors(strip), [0, 80, 160, 220]);
});

test("timeline carousel direction state exposes left/right arrow availability at the strip edges", () => {
  const timelineCarouselDirectionState = instantiateFunction("timelineCarouselDirectionState", {
    TIMELINE_CAROUSEL_EDGE_EPSILON_PX: 4,
  });
  const strip = {
    clientWidth: 180,
    scrollWidth: 420,
    scrollLeft: 0,
  };

  assert.deepEqual(timelineCarouselDirectionState(strip), {
    hasOverflow: true,
    currentLeft: 0,
    maxScroll: 240,
    canPageLeft: false,
    canPageRight: true,
  });

  strip.scrollLeft = 120;
  assert.deepEqual(timelineCarouselDirectionState(strip), {
    hasOverflow: true,
    currentLeft: 120,
    maxScroll: 240,
    canPageLeft: true,
    canPageRight: true,
  });

  strip.scrollLeft = 240;
  assert.deepEqual(timelineCarouselDirectionState(strip), {
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
  const timelineDetailText = instantiateFunction("timelineDetailText", {
    state,
    currentTimelineHeadNode: () => headNode,
    timelineNodeSummary: (node) => `${node.action} · ${node.label}`,
  });

  assert.equal(timelineDetailText(headNode), "Import · A.jpg");

  state.timelinePreviewNodeId = "tl-2";
  assert.equal(timelineDetailText(headNode), "Change to · Mark · A.jpg");

  state.timelinePreviewNodeId = "tl-1";
  assert.equal(timelineDetailText(headNode), "Current state · Import · A.jpg");
});

test("timeline detail text is empty when no head node exists", () => {
  const timelineDetailText = instantiateFunction("timelineDetailText", {
    state: {
      timelinePreviewNodeId: null,
      timelineNodesById: new Map(),
    },
    currentTimelineHeadNode: () => null,
    timelineNodeSummary: () => "unused",
  });

  assert.equal(timelineDetailText(null), "");
});

test("rebuildTimelineStrip preserves existing cards when a new timeline node appends", () => {
  const firstCard = createFakeTimelineCard("tl-1", "tl-1:k1");
  const secondCard = createFakeTimelineCard("tl-2", "tl-2:k2");
  const strip = createFakeTimelineStrip([firstCard, secondCard]);
  const buildCalls = [];
  const rebuildTimelineStrip = instantiateFunction("rebuildTimelineStrip", {
    els: { timelineStrip: strip },
    buildTimelineCard: (node) => {
      buildCalls.push(node.nodeId);
      return createFakeTimelineCard(node.nodeId, `${node.nodeId}:${node.key}`);
    },
    timelineNodeStructureKey: (node) => `${node.nodeId}:${node.key}`,
    syncTimelineCarouselOverflow: () => true,
    scheduleTimelineCarouselChromeSync: () => {},
    state: { lastTimelineCenteredNodeId: "tl-2" },
  });

  const changed = rebuildTimelineStrip(
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
  assert.deepEqual(buildCalls, ["tl-3"]);
});

test("rebuildTimelineStrip switches the tray into centered empty mode with only the empty copy", () => {
  const strip = createFakeTimelineStrip();
  const shell = {
    classList: createFakeClassList(),
  };
  const rebuildTimelineStrip = instantiateFunction("rebuildTimelineStrip", {
    els: { timelineShell: shell, timelineStrip: strip },
    scheduleTimelineCarouselChromeSync: () => {},
    state: { lastTimelineCenteredNodeId: "tl-2" },
    document: {
      createElement(tagName) {
        assert.equal(tagName, "div");
        return {
          className: "",
          textContent: "",
          dataset: {},
          parentNode: null,
          nextSibling: null,
          remove() {
            if (this.parentNode) this.parentNode.removeChild(this);
          },
        };
      },
    },
  });

  const changed = rebuildTimelineStrip([], null);

  assert.equal(changed, true);
  assert.equal(shell.classList.contains("is-empty"), true);
  assert.equal(strip.classList.contains("is-empty"), true);
  assert.equal(strip.children.length, 1);
  assert.equal(strip.children[0].className, "timeline-empty muted");
  assert.equal(strip.children[0].textContent, "Your timeline appears after your first edit.");
});
