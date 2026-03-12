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
    goalContract: {
      schemaVersion: "juggernaut.agent_runner_goal_contract.v1",
      goalSummary: "Keep the subject visible while removing background clutter.",
      goalType: "general_visual_transform",
      hardRequirements: {
        entities: [{ name: "subject", minVisibleCount: 1, requiredVisible: true }],
        objects: [],
        interactions: [],
        sceneCues: [],
        preserve: ["subject intact"],
      },
      softIntents: ["cleaner background"],
      forbiddenShortcuts: ["subject_removal"],
      unknownPhrases: [],
      stopRules: ["The subject must remain visible."],
      compileConfidence: 0.88,
    },
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
  assert.equal(summary.goalContract.raw.hardRequirements.entities[0].name, "subject");
  assert.equal(summary.canvas.visibleImages[0].rectCss.left, 112);
  assert.equal(summary.canvas.marks[0].id, "mark-1");
  assert.equal(summary.canvas.subjectSelections.activeImageHasRegionSelection, false);
  assert.deepEqual(summary.availableActions.directAffordances, ["remove_people", "polish", "relight"]);
  assert.equal(summary.availableActions.seededToolGuidance.cut_out.requiresSubjectRegion, true);
  assert.equal(summary.review.proposals[0].proposalId, "prop-1");
  assert.equal(summary.sessionTools[0].toolId, "soft-contrast");
});

test("agent runner planner prompt carries the single-step JSON contract and compact context", () => {
  const prompt = buildAgentRunnerPlannerPrompt({
    goal: "Make room on the right for copy.",
    goalContract: {
      schemaVersion: "juggernaut.agent_runner_goal_contract.v1",
      goalSummary: "Create visible open space on the right side for copy.",
      goalType: "placement",
      hardRequirements: {
        entities: [],
        objects: [],
        interactions: [],
        sceneCues: ["open room on the right"],
        preserve: [],
      },
      softIntents: [],
      forbiddenShortcuts: ["minor_crop_only"],
      unknownPhrases: [],
      stopRules: ["The right side must visibly have room for copy."],
      compileConfidence: 0.93,
    },
    shellSnapshot: {
      singleImageRail: {
        visibleJobs: [
          {
            jobId: "remove",
            enabled: true,
            requiresSelection: true,
          },
          {
            jobId: "cut_out",
            enabled: false,
            requiresSelection: true,
            disabledReason: "capability_unavailable",
          },
        ],
      },
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
  assert.match(prompt, /The first visual input is the current rendered visible canvas view, including visible marks and overlays\./);
  assert.match(prompt, /Any additional visual inputs are visible source images for detail only; use the rendered canvas view to reason about the next step\./);
  assert.match(prompt, /A compiled goal contract may appear in Context JSON\. Treat hard requirements there as completion constraints, not optional style cues\./);
  assert.match(prompt, /"type": "set_active_image" \| "set_selected_images" \| "marker_stroke"/);
  assert.match(prompt, /Only choose invoke_seeded_tool when toolId is listed in availableActions\.seededTools\./);
  assert.match(prompt, /For cut_out, first create a real subject region on the active source image/);
  assert.match(prompt, /cut_out requires a real Magic Select or lasso region on that active image before it can run\./);
  assert.match(prompt, /remove erases the selected region from the active image\. It is destructive cleanup, not subject extraction\./);
  assert.match(prompt, /Never use remove to isolate or prepare a source subject for compositing into another image\. Use cut_out for that\./);
  assert.match(prompt, /remove deletes the selected content from that active image and must not be used to extract a reusable subject\./);
  assert.match(prompt, /Design Review is goal-agnostic\. It sees only the visible canvas plus visible marks and Magic Select regions, not hidden intent\./);
  assert.match(prompt, /Before request_design_review, use marks and\/or Magic Select when composition, placement, interaction, pose, or source-vs-target intent needs to be made explicit on-canvas\./);
  assert.match(prompt, /For cross-image composites, mark the source subject and the destination area before request_design_review when placement matters\./);
  assert.match(prompt, /For request_design_review summaries, do not restate the user goal, inferred scene, or hidden intent\./);
  assert.match(prompt, /If goalContract\.hardRequirements exist, do not treat palette shifts, props, uniforms, or single-subject styling as sufficient/);
  assert.match(prompt, /Export or stop only when the visible canvas satisfies the hard requirements in goalContract/);
  assert.match(prompt, /"goal":\s*"Make room on the right for copy\."/);
  assert.match(prompt, /"goalContract":\s*\{/);
});

test("agent runner context summary only exposes enabled seeded tools from the shell affordance snapshot", () => {
  const summary = buildAgentRunnerContextSummary({
    shellSnapshot: {
      activeImageId: "img-target",
      selectedImageIds: ["img-target"],
      singleImageRail: {
        visibleJobs: [
          {
            jobId: "remove",
            enabled: true,
            requiresSelection: true,
            reasonCodes: ["targeted_cleanup"],
          },
          {
            jobId: "cut_out",
            enabled: false,
            requiresSelection: true,
            disabledReason: "capability_unavailable",
            reasonCodes: ["capability_unavailable"],
          },
          {
            jobId: "variants",
            enabled: true,
            requiresSelection: true,
            reasonCodes: ["identity_preserving"],
          },
        ],
      },
    },
  });

  assert.deepEqual(summary.availableActions.seededTools, ["remove", "variants"]);
  assert.deepEqual(summary.availableActions.seededToolStates, [
    {
      toolId: "remove",
      enabled: true,
      requiresSelection: true,
      disabledReason: null,
      reasonCodes: ["targeted_cleanup"],
    },
    {
      toolId: "cut_out",
      enabled: false,
      requiresSelection: true,
      disabledReason: "capability_unavailable",
      reasonCodes: ["capability_unavailable"],
    },
    {
      toolId: "variants",
      enabled: true,
      requiresSelection: true,
      disabledReason: null,
      reasonCodes: ["identity_preserving"],
    },
  ]);
  assert.deepEqual(summary.canvas.subjectSelections, {
    imageIds: [],
    activeImageHasRegionSelection: false,
  });
  assert.deepEqual(summary.availableActions.seededToolGuidance.cut_out, {
    requiresActiveImage: true,
    requiresSubjectRegion: true,
    acceptedRegionSources: ["magic_select_region", "lasso_region"],
    effect: "extract the selected subject into a reusable cutout",
    agentPreferredSetupActions: ["marker_stroke", "magic_select_click"],
    ifDisabledReasonIsSelectionRequired: "Create a subject region on the active source image first.",
  });
  assert.deepEqual(summary.availableActions.seededToolGuidance.remove, {
    requiresActiveImage: true,
    requiresSubjectRegion: true,
    effect: "erase the selected content from the active image",
    doNotUseFor: ["subject extraction", "preparing a source subject for compositing"],
    ifGoalNeedsReusableSubject: "Use cut_out instead of remove.",
  });
  assert.deepEqual(summary.availableActions.reviewGuidance, {
    goalAgnostic: true,
    seesVisibleCanvasOnly: true,
    usesVisibleAnnotationsOnly: true,
    preferredPrepActions: ["set_active_image", "set_selected_images", "marker_stroke", "magic_select_click"],
    markBeforeReviewFor: [
      "source_vs_target_disambiguation",
      "subject_placement",
      "interaction_or_pose",
      "destination_area",
    ],
  });
  assert.equal(summary.shell.singleImageRail.visibleJobs[1].toolId, "cut_out");
});

test("agent runner plan parser accepts selection, direct-affordance, and percent-based observable actions", () => {
  const selection = parseAgentRunnerPlanResponse(
    JSON.stringify({
      status: "continue",
      summary: "Select the source and target images first.",
      action: {
        type: "set_selected_images",
        imageIds: ["img-source", "img-target"],
        activeImageId: "img-target",
      },
    })
  );

  assert.equal(selection.action.type, "set_selected_images");
  assert.deepEqual(selection.action.imageIds, ["img-source", "img-target"]);
  assert.equal(selection.action.activeImageId, "img-target");

  const direct = parseAgentRunnerPlanResponse(
    JSON.stringify({
      status: "continue",
      summary: "Polish the active image first.",
      action: {
        type: "invoke_direct_affordance",
        toolId: "polish",
        imageId: "img-target",
        params: {
          intensity: 0.58,
        },
      },
    })
  );

  assert.equal(direct.action.type, "invoke_direct_affordance");
  assert.equal(direct.action.toolId, "polish");
  assert.equal(direct.action.imageId, "img-target");
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

test("agent runner plan parser sanitizes request design review summaries to visible-state wording", () => {
  const review = parseAgentRunnerPlanResponse(
    JSON.stringify({
      status: "continue",
      summary: "Request design review now that both subjects are selected and combat intent has been marked on-canvas.",
      action: {
        type: "request_design_review",
      },
    })
  );

  assert.equal(review.action.type, "request_design_review");
  assert.equal(
    review.summary,
    "Request design review using only the visible canvas, marks, Magic Select regions, and current selections."
  );
  assert.equal(
    review.raw.summary,
    "Request design review using only the visible canvas, marks, Magic Select regions, and current selections."
  );
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
  assert.deepEqual(requests[0].images, [{ imageId: "img-1", path: "/tmp/img-1.png" }]);
  assert.equal(result.plan.action.type, "marker_stroke");
  assert.equal(result.plan.action.imageId, "img-1");
});
