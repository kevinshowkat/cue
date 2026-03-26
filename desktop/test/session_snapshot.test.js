import test from "node:test";
import assert from "node:assert/strict";

import {
  deserializeSessionSnapshot,
  serializeSessionSnapshot,
} from "../src/session_snapshot.js";

test("session snapshot round-trips maps and rebuilds session indexes", () => {
  const sharedImage = {
    id: "img-a",
    path: "/tmp/run/img-a.png",
    label: "A",
    img: new URL("https://example.com/a.png"),
  };
  const sharedNode = {
    nodeId: "node-a",
    imageId: "img-a",
    label: "Node A",
  };
  const payload = serializeSessionSnapshot({
    label: "Saved Session",
    session: {
      runDir: "/tmp/run",
      eventsPath: "/tmp/run/events.jsonl",
      images: [sharedImage],
      imagesById: new Map([["img-a", sharedImage]]),
      selectedIds: ["img-a", "img-a", "missing"],
      activeId: "missing",
      freeformZOrder: ["missing", "img-a"],
      timelineNodes: [sharedNode],
      timelineNodesById: new Map([["node-a", sharedNode]]),
      timelineHeadNodeId: "node-a",
      timelineLatestNodeId: "node-a",
      timelineNextSeq: 2,
      screenshotPolishMeta: {
        sourceFrame: {
          id: "img-a",
          path: "/tmp/run/img-a.png",
          label: "Checkout",
        },
        platformTarget: "ios",
        screenName: "Checkout",
        resolution: {
          width: 1170,
          height: 2532,
        },
      },
      communication: {
        marksByImageId: new Map([["img-a", [{ id: "mark-a" }]]]),
        stampsByImageId: new Map([["img-a", [{ id: "stamp-a", intentId: "fix", imageId: "img-a" }]]]),
        canvasStamps: [{ id: "stamp-canvas", intentId: "custom", label: "Headline", instruction: "Headline", imageId: null }],
        stampPicker: { open: true, targetImageId: "img-a" },
      },
      sessionTools: [
        {
          toolId: "mono",
          label: "Mono",
          shortLabel: "Mono",
          description: "Convert the active image to grayscale.",
          execution: {
            kind: "local_edit",
            operation: "grayscale",
            params: { amount: 1 },
          },
        },
      ],
      toolRegistry: {
        list() {
          return [];
        },
      },
      eventsDecoder: new TextDecoder("utf-8"),
    },
  });

  const restored = deserializeSessionSnapshot(payload);

  assert.equal(restored.schema, "juggernaut.session_snapshot.v1");
  assert.equal(restored.label, "Saved Session");
  assert.ok(restored.session.imagesById instanceof Map);
  assert.equal(restored.session.imagesById.get("img-a"), restored.session.images[0]);
  assert.equal(restored.session.images[0].img, null);
  assert.deepEqual(restored.session.selectedIds, ["img-a"]);
  assert.equal(restored.session.activeId, "img-a");
  assert.deepEqual(restored.session.freeformZOrder, ["img-a"]);
  assert.ok(restored.session.timelineNodesById instanceof Map);
  assert.equal(restored.session.timelineNodesById.get("node-a"), restored.session.timelineNodes[0]);
  assert.equal(restored.session.timelineHeadNodeId, "node-a");
  assert.equal(restored.session.timelineLatestNodeId, "node-a");
  assert.equal(restored.session.timelineNextSeq, 2);
  assert.equal(restored.session.timelineOpen, true);
  assert.deepEqual(restored.session.screenshotPolishMeta, {
    sourceFrame: {
      id: "img-a",
      path: "/tmp/run/img-a.png",
      label: "Checkout",
    },
    platformTarget: "ios",
    screenName: "Checkout",
    resolution: {
      width: 1170,
      height: 2532,
    },
  });
  assert.ok(restored.session.communication.marksByImageId instanceof Map);
  assert.ok(restored.session.communication.stampsByImageId instanceof Map);
  assert.equal(restored.session.communication.stampsByImageId.get("img-a")?.[0]?.intentId, "fix");
  assert.equal(restored.session.communication.canvasStamps?.[0]?.intentId, "custom");
  assert.equal(restored.session.communication.canvasStamps?.[0]?.label, "Headline");
  assert.equal(restored.session.communication.stampPicker?.open, true);
  assert.equal(restored.session.sessionTools[0].toolId, "mono");
  assert.equal(typeof restored.session.toolRegistry.list, "function");
  assert.ok(restored.session.eventsDecoder instanceof TextDecoder);
});

test("session snapshot keeps older payloads compatible when screenshot metadata is absent", () => {
  const restored = deserializeSessionSnapshot({
    schema: "juggernaut.session_snapshot.v1",
    version: 1,
    savedAt: "2026-03-26T00:00:00.000Z",
    session: {
      images: [],
      timelineNodes: [],
    },
  });

  assert.equal(restored.session.screenshotPolishMeta, null);
  assert.equal(restored.session.timelineOpen, true);
});

test("session snapshot rejects unsupported schemas", () => {
  assert.throws(
    () =>
      deserializeSessionSnapshot({
        schema: "wrong.schema",
        session: {},
      }),
    /Unsupported session snapshot schema/
  );
});
