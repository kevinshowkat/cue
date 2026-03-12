import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appPath = join(here, "..", "src", "canvas_app.js");
const app = readFileSync(appPath, "utf8");

test("agent runner uses a weighted action budget with discounted prep actions", () => {
  assert.match(app, /const AGENT_RUNNER_ACTION_BUDGET_COSTS = Object\.freeze\(\{/);
  assert.match(app, /set_active_image: 0\.25/);
  assert.match(app, /set_selected_images: 0\.25/);
  assert.match(app, /marker_stroke: 0\.5/);
  assert.match(app, /magic_select_click: 0\.5/);
  assert.match(app, /eraser_stroke: 0\.5/);
  assert.match(app, /Weighted action budget exhausted at \$\{formatAgentRunnerBudgetValue\(budgetUsed\)\} \/ \$\{formatAgentRunnerBudgetValue\(budgetLimit\)\}/);
  assert.match(app, /const maxAutoIterations = Math\.max\(1, Math\.ceil\(budgetLimit \/ AGENT_RUNNER_MIN_ACTION_BUDGET_COST\) \+ 1\);/);
});

test("agent runner reuses same-context design review instead of re-requesting it", () => {
  assert.match(app, /function resolveAgentRunnerReviewReuseState\(/);
  assert.match(app, /if \(reuseState\.goalMatchesCurrentGoal && reuseState\.contextMatchesVisiblePrep && reuseState\.requestId\)/);
  assert.match(app, /message: `Reused ready design review with \$\{Array\.isArray\(existingReviewState\?\.proposals\) \? existingReviewState\.proposals\.length : 0\} proposal/);
  assert.match(app, /budgetCostOverride: 0/);
  assert.match(app, /rememberAgentRunnerReviewReuseState\(runner, \{/);
});
