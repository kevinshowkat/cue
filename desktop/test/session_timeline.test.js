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
      { nodeId: "tl-000003", seq: 3, action: "Mark", visualMode: "icon", snapshot: nodeSnapshot },
      { nodeId: "tl-000001", seq: 1, action: "Import", visualMode: "thumbnail", snapshot: nodeSnapshot },
      { nodeId: "tl-000002", seq: 2, action: "Move", visualMode: "icon", snapshot: nodeSnapshot },
    ],
  });

  assert.equal(payload.schema, "cue.timeline.v1");
  assert.equal(payload.run_id, "run");
  assert.equal(payload.head_node_id, "tl-000002");
  assert.equal("visual_mode" in payload.nodes[0], false);
  assert.equal(payload.nodes[0].snapshot_ref.kind, "inline");

  const restored = deserializeSessionTimeline(payload);

  assert.equal(restored.schema, "cue.timeline.v1");
  assert.equal(restored.runId, "run");
  assert.equal(restored.runDir, null);
  assert.equal(restored.headNodeId, "tl-000002");
  assert.equal(restored.latestNodeId, "tl-000003");
  assert.equal(restored.nextSeq, 4);
  assert.deepEqual(
    restored.nodes.map((node) => node.nodeId),
    ["tl-000001", "tl-000002", "tl-000003"]
  );
  assert.equal(restored.nodes[0].visualMode, "thumbnail");
  assert.equal(resolveSessionTimelineHeadNode(restored)?.nodeId, "tl-000002");
});

test("timeline deserialization still accepts legacy payloads", () => {
  const restored = deserializeSessionTimeline({
    schemaVersion: 1,
    runDir: "/tmp/run",
    headNodeId: "tl-000001",
    latestNodeId: "tl-000001",
    nextSeq: 2,
    nodes: [
      {
        nodeId: "tl-000001",
        seq: 1,
        action: "Import",
        snapshot: captureSessionTimelineSnapshot({
          images: [{ id: "img-a", path: "/tmp/run/a.png", label: "A" }],
          selectedIds: ["img-a"],
          activeId: "img-a",
        }),
      },
    ],
  });

  assert.equal(restored.runDir, "/tmp/run");
  assert.equal(restored.runId, "run");
  assert.equal(restored.nodes[0].nodeId, "tl-000001");
});

test("timeline serialization purges snapshot-less legacy nodes from canonical writes", () => {
  const payload = serializeSessionTimeline({
    runDir: "/tmp/run",
    headNodeId: "tl-000001",
    latestNodeId: "tl-000001",
    nextSeq: 2,
    nodes: [
      {
        nodeId: "tl-000001",
        seq: 1,
        action: "Import",
        visualMode: "thumbnail",
        previewPath: "/tmp/run/a.png",
        snapshot: null,
      },
    ],
  });

  assert.equal(payload.nodes.length, 0);
  assert.equal(payload.head_node_id, null);
  assert.equal(payload.latest_node_id, null);
  assert.equal(payload.next_seq, 2);

  const restored = deserializeSessionTimeline(payload);
  assert.equal(restored.nodes.length, 0);
  assert.equal(restored.headNodeId, null);
  assert.equal(restored.latestNodeId, null);
});

test("timeline deserialization still accepts legacy snapshot-less nodes on read", () => {
  const restored = deserializeSessionTimeline({
    schema: "cue.timeline.v1",
    version: 1,
    run_id: "run",
    head_node_id: "tl-000001",
    latest_node_id: "tl-000001",
    next_seq: 2,
    updated_at: "2026-04-01T00:00:00.000Z",
    nodes: [
      {
        node_id: "tl-000001",
        seq: 1,
        created_at: "2026-04-01T00:00:00.000Z",
        kind: "image_result",
        action: "Import",
        label: "a.png",
        detail: null,
        parents: [],
        image_ids: ["img-a"],
        preview_image_id: "img-a",
        preview_path: "/tmp/run/a.png",
        receipt_paths: [],
      },
    ],
  });

  assert.equal(restored.nodes.length, 1);
  assert.equal(restored.nodes[0].snapshot, null);
  assert.equal(restored.nodes[0].visualMode, "thumbnail");
});
