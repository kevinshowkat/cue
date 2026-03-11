import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildAgentRunnerEvaluationPrompt,
  parseAgentRunnerEvaluationResponse,
} from "../src/agent_runner_evaluation.js";

test("agent runner evaluation prompt emphasizes visible outcome over setup effort", () => {
  const prompt = buildAgentRunnerEvaluationPrompt({
    goal: "make aragorn and lebron locked in combat",
    finishReason: "max_steps_reached",
    stepCount: 8,
    lastPlan: {
      summary: "Need design guidance for arranging the extracted figures into a convincing combat composition.",
    },
    visibleImages: [
      { id: "img-a", label: "aragorn.png", active: false, selected: false },
      { id: "img-b", label: "lebron.png", active: true, selected: true },
    ],
    recentLog: [
      {
        kind: "action",
        actionType: "request_design_review",
        message: "Request design review using only the visible canvas, marks, Magic Select regions, and current selections.",
        ok: true,
      },
    ],
  });

  assert.match(prompt, /Judge only what is visibly present on the canvas image\./);
  assert.match(prompt, /Do not give credit for setup work, hidden intent, apparent effort, or reasonable intermediate steps\./);
  assert.match(prompt, /If the requested interaction, composition, pose, or placement is still missing, penalize heavily\./);
  assert.match(prompt, /Do not suggest direct image edits or next visual fixes\./);
  assert.match(prompt, /uxSuggestions are for clarifying the app UX, controls, feedback, or visible workflow\./);
  assert.match(prompt, /agentSuggestions are for clarifying tool labels, tool descriptions, disabled reasons, planner guidance, or agent affordances\./);
  assert.match(prompt, /"goal": "make aragorn and lebron locked in combat"/);
  assert.match(prompt, /"finishReason": "max_steps_reached"/);
  assert.match(prompt, /"label": "lebron\.png"/);
  assert.match(prompt, /"recentActivity": \[/);
  assert.match(prompt, /"actionType": "request_design_review"/);
});

test("agent runner evaluation parser accepts fenced JSON and normalizes the score", () => {
  const parsed = parseAgentRunnerEvaluationResponse(
    [
      "```json",
      JSON.stringify({
        score: 81.6,
        goalAchieved: false,
        verdict: "The figures are present, but the combat interaction is not convincing yet.",
        strengths: ["Both figures are visible."],
        misses: ["They are not visibly locked in combat."],
        uxSuggestions: ["Clarify in the app that Design Review only uses visible marks and selections for spatial goals."],
        agentSuggestions: ["Make the tool and planner guidance emphasize that cut outs still need a visible composite/apply step afterward."],
      }),
      "```",
    ].join("\n"),
    { goal: "make aragorn and lebron locked in combat" }
  );

  assert.equal(parsed.schemaVersion, "agent-runner-evaluation-v2");
  assert.equal(parsed.goal, "make aragorn and lebron locked in combat");
  assert.equal(parsed.score, 82);
  assert.equal(parsed.goalAchieved, false);
  assert.equal(parsed.verdict, "The figures are present, but the combat interaction is not convincing yet.");
  assert.deepEqual(parsed.strengths, ["Both figures are visible."]);
  assert.deepEqual(parsed.misses, ["They are not visibly locked in combat."]);
  assert.deepEqual(parsed.uxSuggestions, [
    "Clarify in the app that Design Review only uses visible marks and selections for spatial goals.",
  ]);
  assert.deepEqual(parsed.agentSuggestions, [
    "Make the tool and planner guidance emphasize that cut outs still need a visible composite/apply step afterward.",
  ]);
  assert.deepEqual(parsed.suggestions, [
    "Clarify in the app that Design Review only uses visible marks and selections for spatial goals.",
    "Make the tool and planner guidance emphasize that cut outs still need a visible composite/apply step afterward.",
  ]);
});

test("agent runner evaluation parser rejects responses without a numeric score", () => {
  assert.throws(
    () =>
      parseAgentRunnerEvaluationResponse(
        JSON.stringify({
          verdict: "No score here.",
        })
      ),
    /did not return a numeric score/
  );
});
