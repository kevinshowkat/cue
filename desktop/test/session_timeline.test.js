import test from "node:test";
import assert from "node:assert/strict";

import {
  captureSessionTimelineSnapshot,
  deserializeSessionTimeline,
  resolveSessionTimelineHeadNode,
  restoreSessionTimelineSnapshot,
  serializeSessionTimeline,
} from "../src/session_timeline.js";

test("timeline snapshots round-trip committed canvas session state", () => {
  const imageA = {
    id: "img-a",
    path: "/tmp/run/a.png",
    label: "A",
    img: new URL("https://example.com/a.png"),
  };
  const imageB = {
    id: "img-b",
    path: "/tmp/run/b.png",
    label: "B",
    img: new URL("https://example.com/b.png"),
  };
  const snapshot = captureSessionTimelineSnapshot({
    label: "Run A",
    labelManual: true,
    images: [imageA, imageB],
    imagesById: new Map([
      ["img-a", imageA],
      ["img-b", imageB],
    ]),
    activeId: "img-b",
    selectedIds: ["img-a", "img-b"],
    imagePaletteSeed: 3,
    canvasMode: "multi",
    freeformRects: new Map([["img-a", { x: 10, y: 20, w: 30, h: 40 }]]),
    freeformZOrder: ["img-b", "img-a"],
    multiRects: new Map([["img-b", { x: 1, y: 2, w: 3, h: 4 }]]),
    communication: {
      tool: "marker",
      markDraft: { id: "draft" },
      marksByImageId: new Map([["img-a", [{ id: "mark-1" }]]]),
      canvasMarks: [{ id: "canvas-mark-1" }],
      stampsByImageId: new Map([["img-a", [{ id: "stamp-1", intentId: "fix", imageId: "img-a" }]]]),
      canvasStamps: [{ id: "stamp-canvas-1", intentId: "custom", label: "Headline", instruction: "Headline" }],
      stampPicker: { open: true, targetImageId: "img-a" },
      regionProposalsByImageId: new Map([["img-a", { imageId: "img-a", activeCandidateIndex: 0 }]]),
      lastAnchor: { kind: "mark", imageId: "img-a" },
      proposalTray: { visible: true, requestId: "req-1" },
    },
    selection: { points: [{ x: 1, y: 2 }] },
    annotateBox: { imageId: "img-a", x0: 1, y0: 2, x1: 3, y1: 4 },
    circlesByImageId: new Map([["img-a", [{ id: "circle-1", imageId: "img-a", r: 24 }]]]),
    activeCircle: { id: "circle-1", imageId: "img-a" },
    sessionTools: [
      {
        toolId: "mono",
        label: "Mono",
        shortLabel: "Mono",
        description: "Convert to grayscale.",
        execution: {
          kind: "local_edit",
          operation: "grayscale",
        },
      },
    ],
    activeCustomToolId: "mono",
    lastAction: "Move",
    lastTipText: "Tip text",
  });

  const restored = restoreSessionTimelineSnapshot(snapshot, {
    runDir: "/tmp/run",
    eventsPath: "/tmp/run/events.jsonl",
  });

  assert.equal(restored.runDir, "/tmp/run");
  assert.equal(restored.eventsPath, "/tmp/run/events.jsonl");
  assert.equal(restored.imagesById.get("img-a"), restored.images[0]);
  assert.equal(restored.images[0].img, null);
  assert.deepEqual(restored.selectedIds, ["img-a", "img-b"]);
  assert.equal(restored.activeId, "img-b");
  assert.ok(restored.freeformRects instanceof Map);
  assert.ok(restored.multiRects instanceof Map);
  assert.ok(restored.communication.marksByImageId instanceof Map);
  assert.equal(restored.communication.markDraft, null);
  assert.ok(restored.communication.stampsByImageId instanceof Map);
  assert.equal(restored.communication.stampsByImageId.get("img-a")?.[0]?.intentId, "fix");
  assert.equal(restored.communication.canvasStamps?.[0]?.intentId, "custom");
  assert.equal(restored.communication.canvasStamps?.[0]?.label, "Headline");
  assert.equal(restored.communication.stampPicker?.open, true);
  assert.ok(restored.circlesByImageId instanceof Map);
  assert.equal(restored.sessionTools[0].toolId, "mono");
  assert.equal(restored.activeCustomToolId, "mono");
  assert.equal(restored.timelineOpen, true);
});

test("timeline serialization preserves head selection and chronological ordering", () => {
  const nodeSnapshot = captureSessionTimelineSnapshot({
    images: [],
    imagesById: new Map(),
    activeId: null,
    selectedIds: [],
  });

  const payload = serializeSessionTimeline({
    runDir: "/tmp/run",
    headNodeId: "tl-000002",
    latestNodeId: "tl-000003",
    nextSeq: 4,
    nodes: [
      { nodeId: "tl-000003", seq: 3, action: "Mark", snapshot: nodeSnapshot },
      { nodeId: "tl-000001", seq: 1, action: "Import", snapshot: nodeSnapshot },
      { nodeId: "tl-000002", seq: 2, action: "Move", snapshot: nodeSnapshot },
    ],
  });

  const restored = deserializeSessionTimeline(payload);

  assert.equal(restored.runDir, "/tmp/run");
  assert.equal(restored.headNodeId, "tl-000002");
  assert.equal(restored.latestNodeId, "tl-000003");
  assert.equal(restored.nextSeq, 4);
  assert.deepEqual(
    restored.nodes.map((node) => node.nodeId),
    ["tl-000001", "tl-000002", "tl-000003"]
  );
  assert.equal(resolveSessionTimelineHeadNode(restored)?.nodeId, "tl-000002");
});
