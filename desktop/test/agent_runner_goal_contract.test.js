import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AGENT_RUNNER_GOAL_CHECK_SCHEMA_VERSION,
  AGENT_RUNNER_GOAL_CONTRACT_MODEL,
  AGENT_RUNNER_GOAL_CONTRACT_SCHEMA_VERSION,
  buildAgentRunnerGoalCheckPrompt,
  buildAgentRunnerGoalContractPrompt,
  createAgentRunnerGoalContractCompiler,
  parseAgentRunnerGoalCheckResponse,
  parseAgentRunnerGoalContractResponse,
} from "../src/agent_runner_goal_contract.js";

test("agent runner goal contract prompt separates hard requirements from soft intents", () => {
  const prompt = buildAgentRunnerGoalContractPrompt({
    goal: "make lebron play aragorn in basketball but keep it goofy",
    shellSnapshot: {
      images: [
        { id: "img-a", label: "aragorn.jpg", active: true, selected: true },
        { id: "img-b", label: "lebron.jpg", active: false, selected: false },
      ],
    },
  });

  assert.match(prompt, /compiling a user's Cue Agent Run goal into a compact visual goal contract/i);
  assert.match(prompt, /Hard requirements must be objectively checkable on the visible canvas\./);
  assert.match(prompt, /Soft intents are style, tone, humor, era, or vibe instructions/);
  assert.match(prompt, /Prefer sparse contracts\. If the goal is mostly vibes, keep hardRequirements light\./);
  assert.match(prompt, /"goal": "make lebron play aragorn in basketball but keep it goofy"/);
  assert.match(prompt, /"visibleImageHints": \[/);
  assert.match(prompt, /"goalType":/);
  assert.match(prompt, /"forbiddenShortcuts": \[/);
});

test("agent runner goal contract parser normalizes entities, interaction, and soft intent fields", () => {
  const parsed = parseAgentRunnerGoalContractResponse(
    JSON.stringify({
      goalSummary: "LeBron James and Aragorn visibly playing against each other in basketball.",
      goalType: "competition",
      hardRequirements: {
        entities: [
          { name: "LeBron James", role: "primary", minVisibleCount: 1, requiredVisible: true },
          { name: "Aragorn", role: "secondary", minVisibleCount: 1, requiredVisible: true },
        ],
        objects: [{ name: "basketball", minVisibleCount: 1, requiredVisible: true }],
        interactions: [
          {
            type: "playing_against",
            description: "LeBron James and Aragorn are visibly playing basketball against each other.",
            participants: ["LeBron James", "Aragorn"],
            sport: "basketball",
            mustBeVisible: true,
          },
        ],
        sceneCues: ["basketball game"],
        preserve: ["keep both characters recognizable"],
      },
      softIntents: ["goofy", "high energy"],
      forbiddenShortcuts: ["style_only", "single_subject_only"],
      unknownPhrases: ["play"],
      compileConfidence: 0.91,
    }),
    { goal: "make lebron play aragorn in basketball but keep it goofy" }
  );

  assert.equal(parsed.schemaVersion, AGENT_RUNNER_GOAL_CONTRACT_SCHEMA_VERSION);
  assert.equal(parsed.goalType, "competition");
  assert.equal(parsed.hardRequirements.entities.length, 2);
  assert.equal(parsed.hardRequirements.entities[0].name, "LeBron James");
  assert.equal(parsed.hardRequirements.objects[0].name, "basketball");
  assert.equal(parsed.hardRequirements.interactions[0].sport, "basketball");
  assert.deepEqual(parsed.softIntents, ["goofy", "high energy"]);
  assert.deepEqual(parsed.forbiddenShortcuts, ["style_only", "single_subject_only"]);
  assert.equal(parsed.compileConfidence, 0.91);
});

test("agent runner goal check prompt uses the compiled hard requirements as the stop contract", () => {
  const prompt = buildAgentRunnerGoalCheckPrompt({
    goal: "make lebron play aragorn in basketball but keep it goofy",
    goalContract: {
      goalSummary: "LeBron James and Aragorn visibly playing against each other in basketball.",
      goalType: "competition",
      hardRequirements: {
        entities: [
          { name: "LeBron James", minVisibleCount: 1, requiredVisible: true },
          { name: "Aragorn", minVisibleCount: 1, requiredVisible: true },
        ],
        objects: [{ name: "basketball", minVisibleCount: 1, requiredVisible: true }],
        interactions: [
          {
            type: "playing_against",
            description: "LeBron James and Aragorn are visibly playing basketball against each other.",
            participants: ["LeBron James", "Aragorn"],
            sport: "basketball",
            mustBeVisible: true,
          },
        ],
        sceneCues: ["basketball game"],
        preserve: [],
      },
      softIntents: ["goofy"],
      forbiddenShortcuts: ["style_only"],
      unknownPhrases: [],
      stopRules: ["Both named people must be visible."],
      compileConfidence: 0.9,
    },
    visibleImages: [
      { id: "img-a", label: "aragorn.jpg", active: true, selected: true },
      { id: "img-b", label: "lebron.jpg", active: false, selected: false },
    ],
    recentLog: [{ kind: "info", message: "Applied a Lakers jersey.", actionType: "accept_review_proposal" }],
  });

  assert.match(prompt, /Hard requirements are strict\./);
  assert.match(prompt, /Soft intents are non-blocking quality signals\./);
  assert.match(prompt, /Style cues, props, palette shifts, uniforms, or single-subject restyling do not satisfy a missing named entity or missing interaction/);
  assert.match(prompt, /"goalContract": \{/);
  assert.match(prompt, /"allowStop": false/);
});

test("agent runner goal check parser normalizes missing and satisfied hard requirements", () => {
  const parsed = parseAgentRunnerGoalCheckResponse(
    JSON.stringify({
      allowStop: false,
      summary: "LeBron James is still missing from the visible canvas.",
      missingHardRequirements: ["LeBron James visibly present", "basketball interaction visible"],
      satisfiedHardRequirements: ["Aragorn visibly present"],
      confidence: 0.86,
    })
  );

  assert.equal(parsed.schemaVersion, AGENT_RUNNER_GOAL_CHECK_SCHEMA_VERSION);
  assert.equal(parsed.allowStop, false);
  assert.deepEqual(parsed.missingHardRequirements, [
    "LeBron James visibly present",
    "basketball interaction visible",
  ]);
  assert.deepEqual(parsed.satisfiedHardRequirements, ["Aragorn visibly present"]);
  assert.equal(parsed.confidence, 0.86);
});

test("agent runner goal contract compiler uses first-class goal-contract and goal-check provider kinds", async () => {
  const requests = [];
  const compiler = createAgentRunnerGoalContractCompiler({
    requestProvider: async (request) => {
      requests.push(request);
      if (request.kind === "goal_contract") {
        return {
          text: JSON.stringify({
            goalSummary: "LeBron James and Aragorn visibly playing against each other in basketball.",
            goalType: "competition",
            hardRequirements: {
              entities: [
                { name: "LeBron James", minVisibleCount: 1, requiredVisible: true },
                { name: "Aragorn", minVisibleCount: 1, requiredVisible: true },
              ],
              interactions: [
                {
                  type: "playing_against",
                  description: "LeBron James and Aragorn are visibly playing basketball against each other.",
                  participants: ["LeBron James", "Aragorn"],
                  sport: "basketball",
                  mustBeVisible: true,
                },
              ],
            },
            softIntents: ["goofy"],
            forbiddenShortcuts: ["style_only"],
            unknownPhrases: [],
            compileConfidence: 0.94,
          }),
        };
      }
      return {
        text: JSON.stringify({
          allowStop: false,
          summary: "LeBron James is still missing from the visible canvas.",
          missingHardRequirements: ["LeBron James visibly present"],
          satisfiedHardRequirements: ["Aragorn visibly present"],
          confidence: 0.84,
        }),
      };
    },
    getKeyStatus: async () => ({
      openai: true,
      openrouter: true,
    }),
  });

  const compiled = await compiler.compile({
    goal: "make lebron play aragorn in basketball but keep it goofy",
    requestId: "goal-contract-1",
  });
  const checked = await compiler.checkStop({
    goal: "make lebron play aragorn in basketball but keep it goofy",
    goalContract: compiled.goalContract,
    image: { path: "/tmp/visible.png" },
    requestId: "goal-check-1",
  });

  assert.equal(requests[0].kind, "goal_contract");
  assert.equal(requests[0].provider, "openai");
  assert.equal(requests[0].model, AGENT_RUNNER_GOAL_CONTRACT_MODEL);
  assert.equal(requests[1].kind, "goal_check");
  assert.deepEqual(requests[1].images, [{ path: "/tmp/visible.png" }]);
  assert.equal(compiled.goalContract.goalType, "competition");
  assert.equal(checked.verdict.allowStop, false);
});
