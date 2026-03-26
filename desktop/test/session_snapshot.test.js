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

test("session snapshot preserves screenshot-polish fork lineage and review trace state", () => {
  const image = {
    id: "img-hero",
    path: "/tmp/run/hero-before.png",
    label: "Hero",
    img: new URL("https://example.com/hero.png"),
  };
  const payload = serializeSessionSnapshot({
    label: "Approved Variant",
    session: {
      forkedFromTabId: "tab-root",
      reviewFlowState: "ready",
      runDir: "/tmp/run",
      eventsPath: "/tmp/run/events.jsonl",
      images: [image],
      imagesById: new Map([["img-hero", image]]),
      selectedIds: ["img-hero"],
      activeId: "img-hero",
      communication: {
        marksByImageId: new Map(),
        reviewHistory: [
          {
            reason: "review_apply_success",
            requestId: "review-7",
            selectedProposalId: "proposal-7",
            apply: {
              status: "succeeded",
              receiptPath: "/tmp/run/receipt-review-apply.json",
              outputPath: "/tmp/run/hero-approved.png",
              timelineNodeId: "tl-000002",
            },
            targetBefore: {
              id: "img-hero",
              path: "/tmp/run/hero-before.png",
            },
            targetAfter: {
              id: "img-hero",
              path: "/tmp/run/hero-approved.png",
            },
          },
        ],
        proposalTray: {
          visible: true,
          requestId: "review-live",
          source: "design_review_bootstrap_state",
          anchor: {
            kind: "titlebar_button",
            role: "design_review_button",
          },
          slots: [{ status: "apply_succeeded", title: "Swap background" }],
        },
      },
      designReviewApply: {
        status: "running",
        sessionKey: "tab:tab-approved",
        tabId: "tab-approved",
        requestId: "review-live",
        selectedProposalId: "proposal-live",
        targetImageId: "img-hero",
        referenceImageIds: ["img-ref-a", "img-ref-b"],
        outputPath: "/tmp/run/hero-approved.png",
        provider: "google",
        requestedModel: "gemini-2.5-flash-image",
        normalizedModel: "gemini-2.5-flash-image",
        costTotalUsd: 0.14,
        latencyPerImageS: 2.9,
        startedAt: 1000,
        completedAt: 0,
        proposal: {
          proposalId: "proposal-live",
          label: "Swap background",
          actionType: "background_replace",
          previewImagePath: "/tmp/run/review-preview-live.png",
          changedRegionBounds: { x: 64, y: 48, width: 640, height: 320 },
          preserveRegionIds: ["region-character"],
          rationaleCodes: ["mark_on_subject_edge", "background_separable"],
        },
        request: {
          requestId: "review-live",
          primaryImageId: "img-hero",
        },
      },
      sessionTools: [
        {
          toolId: "polish",
          label: "Polish",
          shortLabel: "Polish",
          description: "Polish the approved screenshot.",
          execution: {
            kind: "local_edit",
            operation: "polish",
          },
        },
      ],
      toolRegistry: {
        list() {
          return [];
        },
      },
    },
  });

  const restored = deserializeSessionSnapshot(payload);

  assert.equal(restored.label, "Approved Variant");
  assert.equal(restored.session.forkedFromTabId, "tab-root");
  assert.equal(restored.session.reviewFlowState, "ready");
  assert.equal(restored.session.activeId, "img-hero");
  assert.equal(restored.session.communication.reviewHistory[0].reason, "review_apply_success");
  assert.equal(restored.session.communication.reviewHistory[0].selectedProposalId, "proposal-7");
  assert.equal(
    restored.session.communication.reviewHistory[0].apply.receiptPath,
    "/tmp/run/receipt-review-apply.json"
  );
  assert.equal(
    restored.session.communication.reviewHistory[0].targetAfter.path,
    "/tmp/run/hero-approved.png"
  );
  assert.equal(restored.session.communication.proposalTray.visible, true);
  assert.equal(restored.session.communication.proposalTray.requestId, "review-live");
  assert.equal(
    restored.session.communication.proposalTray.source,
    "design_review_bootstrap_state"
  );
  assert.equal(restored.session.designReviewApply.status, "running");
  assert.equal(restored.session.designReviewApply.selectedProposalId, "proposal-live");
  assert.deepEqual(restored.session.designReviewApply.referenceImageIds, ["img-ref-a", "img-ref-b"]);
  assert.equal(restored.session.designReviewApply.provider, "google");
  assert.equal(restored.session.designReviewApply.normalizedModel, "gemini-2.5-flash-image");
  assert.equal(restored.session.designReviewApply.costTotalUsd, 0.14);
  assert.equal(
    restored.session.designReviewApply.proposal.previewImagePath,
    "/tmp/run/review-preview-live.png"
  );
  assert.deepEqual(restored.session.designReviewApply.proposal.changedRegionBounds, {
    x: 64,
    y: 48,
    width: 640,
    height: 320,
  });
  assert.deepEqual(restored.session.designReviewApply.proposal.preserveRegionIds, ["region-character"]);
  assert.deepEqual(restored.session.designReviewApply.proposal.rationaleCodes, [
    "mark_on_subject_edge",
    "background_separable",
  ]);
  assert.equal(restored.session.sessionTools[0].toolId, "polish");
  assert.equal(typeof restored.session.toolRegistry.list, "function");
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
