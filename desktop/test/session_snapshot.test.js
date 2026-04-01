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
    seq: 1,
    imageId: "img-a",
    label: "Node A",
    visualMode: "thumbnail",
    previewPath: "/tmp/run/img-a.png",
    snapshot: {
      active_image_id: "img-a",
      selected_image_ids: ["img-a"],
      images: [{ image_id: "img-a", path: "/tmp/run/img-a.png", label: "A" }],
      canvas: {
        mode: "multi",
        view: { scale: 1, offset_x: 0, offset_y: 0 },
        multi_view: { scale: 1, offset_x: 0, offset_y: 0 },
      },
      overlays: {
        communication: {
          tool: null,
          marks_by_image_id: { __juggernautSerializedType: "map", entries: [] },
          canvas_marks: [],
          stamps_by_image_id: { __juggernautSerializedType: "map", entries: [] },
          canvas_stamps: [],
          stamp_picker: null,
          region_proposals_by_image_id: { __juggernautSerializedType: "map", entries: [] },
          review_history: [],
          last_anchor: null,
          proposal_tray: null,
          canvas_layout: {
            image_palette_seed: 0,
            freeform_rects: { __juggernautSerializedType: "map", entries: [] },
            freeform_z_order: ["img-a"],
            multi_rects: { __juggernautSerializedType: "map", entries: [] },
          },
          annotate_box: null,
          circles_by_image_id: { __juggernautSerializedType: "map", entries: [] },
          active_circle: null,
          session_tools: [],
          active_custom_tool_id: null,
          last_action: null,
          last_tip_text: null,
          last_director_text: null,
          last_director_meta: null,
          last_cost_latency: null,
          label_manual: false,
          review_flow_state: "",
          forked_from_tab_id: null,
        },
        selection: null,
      },
    },
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

  assert.equal(payload.schema, "cue.session.v1");
  assert.equal(payload.run_id, "run");
  assert.equal(payload.tab_label, "Saved Session");
  assert.equal(payload.state.active_image_id, "img-a");
  assert.equal(payload.timeline.head_node_id, "node-a");
  assert.equal("nodes" in payload.timeline, false);

  const restored = deserializeSessionSnapshot(payload);

  assert.equal(restored.schema, "cue.session.v1");
  assert.equal(restored.runId, "run");
  assert.equal(restored.label, "Saved Session");
  assert.ok(restored.session.imagesById instanceof Map);
  assert.equal(restored.session.imagesById.get("img-a"), restored.session.images[0]);
  assert.equal(restored.session.images[0].img, null);
  assert.deepEqual(restored.session.selectedIds, ["img-a"]);
  assert.equal(restored.session.activeId, "img-a");
  assert.deepEqual(restored.session.freeformZOrder, ["img-a"]);
  assert.equal(restored.session.timelineNodes.length, 0);
  assert.ok(restored.session.timelineNodesById instanceof Map);
  assert.equal(restored.session.timelineNodesById.size, 0);
  assert.equal(restored.session.timelineHeadNodeId, "node-a");
  assert.equal(restored.session.timelineLatestNodeId, "node-a");
  assert.equal(restored.session.timelineNextSeq, 2);
  assert.equal(restored.session.timelineOpen, true);
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

test("session snapshot still rehydrates legacy juggernaut documents", () => {
  const restored = deserializeSessionSnapshot({
    schema: "juggernaut.session_snapshot.v1",
    version: 1,
    label: "Legacy Session",
    session: {
      images: [{ id: "img-a", path: "/tmp/run/img-a.png", label: "A" }],
      selectedIds: ["img-a"],
      activeId: "img-a",
    },
  });

  assert.equal(restored.schema, "juggernaut.session_snapshot.v1");
  assert.equal(restored.label, "Legacy Session");
  assert.equal(restored.session.activeId, "img-a");
  assert.ok(restored.session.imagesById instanceof Map);
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
