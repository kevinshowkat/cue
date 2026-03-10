import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AGENT_RUNNER_DEFAULT_MAX_STEPS,
  AGENT_RUNNER_MAX_STEPS_LIMIT,
  buildAgentRunnerContextSummary,
  buildAgentRunnerPlannerPrompt,
  createAgentRunnerPlanner,
  parseAgentRunnerPlanResponse,
  summarizeAgentRunnerAction,
} from "../src/agent_runner_runtime.js";

test("agent runner context summary keeps the visible canvas compact and action-oriented", () => {
  const summary = buildAgentRunnerContextSummary({
    goal: "Remove the background clutter and keep the subject intact before export.",
    shellSnapshot: {
      activeTabId: "tab-1",
      runDir: "/tmp/run-1",
      canvasMode: "multi",
      imageCount: 1,
      activeImageId: "img-1",
      selectedImageIds: ["img-1"],
      communicationReview: {
        canvas: {
          sizeCss: { width: 1280, height: 880 },
          visibleImages: [
            {
              id: "img-1",
              label: "Hero",
              active: true,
              selected: true,
              rectCss: {
                left: 112.2,
                top: 94.6,
                width: 640,
                height: 420,
                rotateDeg: 3.1,
                skewXDeg: 0,
              },
            },
          ],
        },
        communication: {
          tool: "marker",
          marks: [
            {
              id: "mark-1",
              imageId: "img-1",
              coordinateSpace: "image",
              bounds: { x: 18, y: 30, width: 90, height: 42 },
            },
          ],
          regionSelections: [],
        },
      },
    },
    reviewState: {
      status: "ready",
      proposals: [
        {
          proposalId: "prop-1",
          label: "Remove background clutter",
          actionType: "targeted_remove",
          imageId: "img-1",
          why: "The lower-right background is distracting.",
        },
      ],
    },
    sessionTools: [
      {
        toolId: "soft-contrast",
        label: "Soft Contrast",
        execution: {
          operation: "contrast",
          kind: "local_edit",
        },
      },
    ],
    recentLog: [
      {
        kind: "success",
        message: "Marker stroke complete.",
        actionType: "marker_stroke",
        ok: true,
      },
    ],
  });

  assert.equal(summary.goal, "Remove the background clutter and keep the subject intact before export.");
  assert.equal(summary.canvas.visibleImages[0].rectCss.left, 112);
  assert.equal(summary.canvas.marks[0].id, "mark-1");
  assert.deepEqual(summary.availableActions.directAffordances, ["remove_people", "polish", "relight"]);
  assert.equal(summary.review.proposals[0].proposalId, "prop-1");
  assert.equal(summary.sessionTools[0].toolId, "soft-contrast");
});

test("agent runner planner prompt carries the single-step JSON contract and compact context", () => {
  const prompt = buildAgentRunnerPlannerPrompt({
    goal: "Make room on the right for copy.",
    shellSnapshot: {
      communicationReview: {
        canvas: {
          visibleImages: [
            {
              id: "img-7",
              rectCss: { left: 20, top: 30, width: 320, height: 240 },
            },
          ],
        },
        communication: {
          marks: [],
          regionSelections: [],
        },
      },
    },
  });

  assert.match(prompt, /You are the planner for Juggernaut Agent Run\./);
  assert.match(prompt, /Return JSON only\./);
  assert.match(prompt, /"type": "marker_stroke" \| "magic_select_click"/);
  assert.match(prompt, /"goal":\s*"Make room on the right for copy\."/);
});

test("agent runner plan parser accepts direct-affordance and percent-based observable actions", () => {
  const direct = parseAgentRunnerPlanResponse(
    JSON.stringify({
      status: "continue",
      summary: "Polish the active image first.",
      action: {
        type: "invoke_direct_affordance",
        toolId: "polish",
        params: {
          intensity: 0.58,
        },
      },
    })
  );

  assert.equal(direct.action.type, "invoke_direct_affordance");
  assert.equal(direct.action.toolId, "polish");
  assert.equal(direct.action.params.intensity, 0.58);
  assert.equal(summarizeAgentRunnerAction(direct.action), "Run polish");

  const marker = parseAgentRunnerPlanResponse(
    JSON.stringify({
      status: "continue",
      summary: "Mark the distraction first.",
      action: {
        type: "marker_stroke",
        imageId: "img-1",
        pointsPct: [
          { x: 0.1, y: 0.2 },
          { x: 0.3, y: 0.25 },
        ],
      },
    })
  );

  assert.equal(marker.action.type, "marker_stroke");
  assert.equal(marker.action.imageId, "img-1");
  assert.equal(marker.action.pointsPct.length, 2);
});

test("agent runner planner reuses the design-review router and returns a parsed next step", async () => {
  const requests = [];
  const planner = createAgentRunnerPlanner({
    requestProvider: async (request) => {
      requests.push(request);
      return {
        text: JSON.stringify({
          status: "continue",
          summary: "Mark the distraction first.",
          action: {
            type: "marker_stroke",
            imageId: "img-1",
            pointsPct: [
              { x: 0.18, y: 0.24 },
              { x: 0.31, y: 0.28 },
            ],
          },
        }),
      };
    },
    getKeyStatus: async () => ({
      openai: true,
    }),
  });

  const result = await planner.plan({
    goal: "Remove the clutter around the bottle.",
    shellSnapshot: {
      communicationReview: {
        canvas: {
          visibleImages: [
            {
              id: "img-1",
              path: "/tmp/img-1.png",
              rectCss: { left: 10, top: 20, width: 300, height: 220 },
            },
          ],
        },
        communication: {
          marks: [],
          regionSelections: [],
        },
      },
    },
    images: [{ imageId: "img-1", path: "/tmp/img-1.png" }],
    requestId: "agent-runner-1",
  });

  assert.equal(planner.plannerOptions[0].id, "auto");
  assert.equal(AGENT_RUNNER_DEFAULT_MAX_STEPS, 8);
  assert.equal(AGENT_RUNNER_MAX_STEPS_LIMIT, 24);
  assert.equal(requests[0].kind, "planner");
  assert.equal(requests[0].provider, "openai");
  assert.equal(result.plan.action.type, "marker_stroke");
  assert.equal(result.plan.action.imageId, "img-1");
});
