# Juggernaut Agent Workflow PRD

Status: Draft v0.1  
Last updated: 2026-03-13  
Document owner: Product / founding team

## Purpose
Define a separate Juggernaut workflow where an LLM or agent uses the app runtime to help a user achieve a visual goal. This document does not replace the source-of-truth product definition in `PRD.md`. It defines an additional machine-operable workflow that must remain compatible with the primary image-first human workflow.

## Product Statement
Juggernaut Agent Workflow lets a user delegate a visual task to an LLM or agent that can inspect canvas state, request and evaluate design-review proposals, execute bounded edits, branch work in isolated tabs, compare outcomes against an explicit goal, and export final artifacts with reproducible receipts.

## Relationship To The Main PRD
- The main visible editing loop remains image-first and text-free-first for humans.
- Agent Workflow is a secondary operating mode, not a replacement shell.
- The same underlying runtime should serve human actions, direct tool calls, design-review apply, agent actions, and export.
- Provider and model names remain out of the main editing loop even when agent mode records them in receipts.

## Problem
Juggernaut already has a strong proposal-and-apply shape for human-driven editing, but it lacks a dedicated workflow for agents to:
- inspect state without mutating it
- operate against explicit user goals and constraints
- branch safely before committing edits
- use design review as a planning surface
- account for budget, latency, privacy mode, and provider routing
- quantify progress toward a target outcome

Without that workflow, an agent either behaves like a brittle UI clicker or bypasses core Juggernaut product surfaces such as design review, tabs, receipts, and export.

## Thesis
An agent should use Juggernaut as a constrained visual runtime, not as a generic chat wrapper and not as a raw bag of model endpoints. The runtime should expose observable state, bounded mutations, review/planning surfaces, route policies, checkpoints, and receipts so the agent can iteratively improve an outcome while preserving reproducibility and user control.

## Primary Outcome
Users can hand Juggernaut a goal such as "make this product shot feel premium and ready for a landing page" and let an agent:
1. inspect the current tab and goal packet
2. create focus hints if needed
3. invoke direct capabilities or request design review
4. branch to new tabs for speculative work
5. evaluate progress after each change
6. revert or promote the best branch
7. export the final artifact and receipt bundle

## Product Principles
- Runtime, not puppeteer: agents should call a stable action surface, not fake pointer events unless necessary.
- Visible-first in observable mode: when the goal is research or automated manual testing, agents should express focus through the same visible canvas tools humans use.
- Observe before mutate: read-only inspection must be separate from state-changing operations.
- Design review is planning: review proposes candidate edits; it does not silently apply them.
- Capability-first, provider-agnostic runtime: internal execution types stay stable even as provider/model choices change.
- Behavior-first affordances: agents should primarily learn what a tool does, not memorize an internal taxonomy.
- Branch safely: speculative work belongs in isolated tabs or checkpoints.
- Quantify progress: agents must be able to score whether a step moved closer to the user goal.
- Receipts everywhere: every non-trivial mutation and export must write structured provenance.

## Non-Goals
- Replacing the human-first primary workflow with a chat UI.
- Giving agents unrestricted filesystem or network authority through the editor.
- Exposing raw chain-of-thought or hidden planner reasoning as a product surface.
- Locking all agent behavior to the existing rail taxonomy forever.
- Requiring model-specific prompt engineering from end users.

## Definitions
- `goal packet`: structured description of desired outcome, constraints, budget, and output requirements
- `affordance`: agent-facing description of what an operation does and when to use it
- `execution type`: canonical internal runtime operation such as `background_replace`
- `route profile`: implementation policy that selects provider, model, prompt template, and params
- `review proposal`: action-first suggestion produced by design review for the current canvas state
- `checkpoint`: named reversible state boundary inside one tab
- `branch tab`: isolated run/tab used for speculative work
- `evaluation packet`: structured scorecard describing how close the current state is to the goal
- `observable agent mode`: runtime mode where agents must express scope and communication through visible canvas tools and overlays

## User Inputs
Agent Workflow starts with a `goal packet`:

```text
{
  schemaVersion: "agent-goal-packet-v1",
  goalId: "goal_123",
  summary: "Create a premium landing-page hero image from this product shot.",
  desiredOutputs: ["png", "psd"],
  mustPreserve: ["product identity", "aspect ratio"],
  shouldImprove: ["lighting", "background cleanliness", "visual hierarchy"],
  mustAvoid: ["changing product silhouette", "adding extra products"],
  budget: {
    maxUsd: 3.00,
    maxImageCalls: 8,
    maxPlannerCalls: 4
  },
  policy: {
    privacyMode: "connected",
    speedPreference: "balanced",
    branchPreference: "allow"
  }
}
```

## Agent Surface Model
Agent Workflow exposes 3 top-level surface types:
- `observe`: read-only state inspection and evaluation
- `mutate`: state-changing actions that modify a tab, create artifacts, or spend budget
- `review`: proposal generation and proposal acceptance through the existing design-review system

### Observe Surface
Observe calls must be side-effect free and safe to run repeatedly.

Minimum observe primitives:
- `get_tab_state(tabId)`
- `get_canvas_snapshot(tabId)`
- `get_canvas_items(tabId)`
- `get_selection_state(tabId)`
- `get_review_state(tabId)`
- `get_history(tabId)`
- `get_receipt(ref)`
- `get_workflow_priors(goalPacket, context)`
- `estimate_action(actionSpec)`
- `evaluate_goal_progress(tabId, goalPacket)`
- `compare_tabs(tabIds, goalPacket)`
- `list_affordances(context)`

## Mutate Surface
Mutate calls may change state, spend budget, or create artifacts.

Minimum mutate primitives:
- `create_tab()`
- `fork_tab(tabId)`
- `activate_tab(tabId)`
- `import_asset(tabId, assetRef)`
- `set_focus_hint(tabId, focusSpec)`
- `clear_focus_hints(tabId)`
- `create_tool(name, description, options)`
- `invoke_affordance(tabId, affordanceId, inputSpec)`
- `accept_review_proposal(tabId, proposalId, executionMode)`
- `create_checkpoint(tabId, label)`
- `revert_to_checkpoint(tabId, checkpointId)`
- `undo(tabId)`
- `redo(tabId)`
- `export_tab(tabId, format, options)`

## Observable Agent Mode
Agent Workflow should support an explicit `observable agent mode` for research, demos, and automated manual testing.

In this mode:
- agents must express focus and communication through visible canvas tools such as `Marker`, `Highlight`, `Magic Select`, and `Eraser`
- these actions must render real marks, region candidates, and tray anchors on the canvas
- tool use must flow through the same runtime state a human session would mutate
- the system should use stable tool-driver APIs instead of brittle raw OS-level pointer automation

Example observable tool-driver calls:
- `marker.stroke(points, brushSpec)`
- `highlight.stroke(points, brushSpec)`
- `magic_select.click(x, y)`
- `eraser.stroke(points, brushSpec)`

Dormant runtime-only compatibility to preserve for now:
- `make_space.click(x, y)`

If the runtime also supports higher-level semantic focus specs, observable mode should compile those specs into visible tool actions instead of bypassing the canvas.

Primary reasons for observable mode:
- study emergent agent behavior in a legible way
- exercise the real product surface during automated manual testing
- generate replayable traces and screenshots for regressions
- verify that review targeting, tray anchoring, undo, and apply flows still work from visible inputs

## Initial Agent-Operable Workflow Using The Current App
Before new agent-native tools exist, the workflow should operate over current Juggernaut surfaces.

### Direct Execution Affordances
Initial direct affordances map to the current seeded single-image jobs:
- `Cut Out`
- `Remove`
- `New Background`
- `Reframe`
- `Variants`

These should be exposed to agents primarily by behavioral descriptions, not only by internal capability IDs.

### Focus And Scoping Affordances
Initial focus affordances map to the current right-side communication rail:
- `Marker`
- `Highlight`
- `Magic Select`
- `Eraser`

These do not commit image edits by themselves. They define focus and scope for review or later execution.

`Make Space` remains a dormant runtime affordance in this phase, but it is not part of the current visible communication rail.

### Design Review
Initial proposal generation uses the current `Design review` flow:
- review consumes the visible canvas plus marks and region candidates
- review returns 2-3 ranked action-first proposals
- proposal acceptance routes through the normal execution layer
- final apply replaces the target image in place on the active tab

### Tool Creation
Initial tool creation should use the existing `Create Tool` runtime surface rather than a separate agent-only implementation.

Required behavior:
- the agent can preview a generated tool manifest before registering it
- the generated manifest resolves through the normal Juggernaut tool runtime
- the created tool appears in the current session tool dock
- receipts capture the draft, generated manifest, and local manifest-builder version

Initial constraints:
- `Create Tool` currently targets deterministic local-edit manifests for the current slice
- it should be used for reusable patterns, not as a backdoor for arbitrary provider-specific prompt injection

## Affordances Instead Of Intent Labels
Agent-facing tooling should not depend on a rigid "intent -> rail item" mapping. To encourage emergent tool use, affordances should be described by effect and usage pattern.

Example affordance manifest:

```text
{
  affordanceId: "remove",
  label: "Remove",
  whatItDoes: "Removes targeted content and plausibly fills the gap.",
  whenToUse: [
    "unwanted object",
    "small distraction",
    "cleanup in a marked region"
  ],
  whenNotToUse: [
    "whole-scene restyling",
    "major composition changes"
  ],
  requiresFocus: true,
  mutatesPixels: true,
  reversible: true,
  executionType: "targeted_remove",
  routeProfileId: "targeted_remove_default_v1"
}
```

Internal runtime contracts still keep canonical `executionType` values for routing, analytics, and receipts.

## Design Review In Agent Workflow
Design review is a core planning surface for agents.

### What Review Is
- an explicit proposal-generation step over current canvas state
- a way to convert ambiguous goals into executable candidate edits
- a route back into the normal execution layer

### What Review Is Not
- unrestricted freeform chat
- an auto-apply mechanism
- the only way an agent can act

### Agent Review Loop
1. observe tab state and current goal packet
2. create or refine focus hints if needed
3. request design review
4. inspect ranked proposals and preview states
5. score proposals against the goal packet
6. apply one proposal in place or in a branch tab
7. evaluate outcome and continue, revert, or promote

### Current Review Limitation
Current review guidance is narrow and mostly spatial:
- marks
- region candidates
- active/selected image context
- cached upload analysis and account memory bias

Agent Workflow should preserve those signals while adding machine-operable `focusSpec` and `goalPacket` guidance. In `observable agent mode`, those higher-level intents should still resolve into visible tool actions rather than bypassing the canvas.

## Tabs, Checkpoints, And Promotion
Tabs are the natural branch primitive for agent work.

Required behaviors:
- an agent may create a fresh tab for contained sub-work
- an agent may fork a tab before destructive or expensive edits
- branch tabs remain isolated until explicitly compared or promoted
- each tab may create named checkpoints
- revert should support both `undo` and checkpoint restore
- export may target the active winning tab only

Promotion behaviors:
- `keep_in_place`: continue working on the current tab
- `promote_branch`: declare one branch the winner for export
- `merge_selected_assets`: future scope, not required for initial v1

## Goal Evaluation
Agent Workflow needs explicit scoring surfaces, not just raw previews.

Evaluation should be task-specific rather than one universal "better image" score.

Minimum evaluator outputs:
- `goal_fit_score` from 0.0 to 1.0
- per-axis sub-scores such as `subject_preservation`, `background_cleanliness`, `composition_strength`
- `constraint_violations`
- `recommended_next_step`
- `confidence`

Evaluation may combine:
- deterministic checks
- image metadata checks
- model-based rubric scoring
- comparison against the original target asset

## Workflow Priors And Receipt Retrieval
Agent Workflow should let agents retrieve prior successful paths, not just isolated tool descriptions.

The core retrieval question is:
- given this goal
- given this current canvas state
- given these constraints and budget
- which past paths were most likely to end in a successful export

This is not a replacement for planning. It is a prior over likely-good workflows built from receipts, outcomes, and retained branch histories.

Minimum retrieval output:
- ranked prior workflows
- example step sequences
- linked receipt refs
- success rate or success confidence
- average cost and latency
- typical failure modes
- confidence that the prior applies to the current task

Example:

```text
{
  schemaVersion: "workflow-priors-v1",
  goalId: "goal_123",
  desiredExport: "psd",
  recommendedPaths: [
    {
      pathId: "path_01",
      steps: ["protect", "design_review", "accept_review_proposal", "export_psd"],
      successRate: 0.78,
      avgCostUsd: 1.12,
      avgLatencyS: 24,
      receiptRefs: ["receipt_a", "receipt_b"],
      caveats: ["works best for product-shot cleanup", "less reliable when background is already busy"]
    }
  ]
}
```

Success should be defined by more than file creation. A workflow prior should consider:
- export completion
- goal-fit score
- constraint preservation
- low retry or undo churn
- branch promotion or user acceptance
- reasonable cost and latency

Workflow priors must remain advisory. The runtime should preserve room for exploration instead of forcing agents into one historically popular path.

## Routing, Models, And Params
Execution types should remain provider-agnostic. They should not be defined by a model name.

### Execution Type
Examples:
- `subject_isolation`
- `targeted_remove`
- `background_replace`
- `crop_or_outpaint`
- `identity_preserving_variation`

### Route Profile
A route profile resolves an execution type into:
- provider
- model
- prompt builder
- params
- fallback chain
- privacy restrictions
- estimated cost/latency class

### Policy
The agent may express preferences such as:
- `fast`
- `balanced`
- `quality`
- `cheap`
- `local_only`
- `connected_only`

The runtime owns final route resolution.

### Receipts
Receipts must capture realized execution:
- execution type
- route profile id and version
- provider
- requested model
- normalized model
- provider params
- prompt template version
- artifact refs
- cost and latency

## Budgeting And Usage Accounting
Agent Workflow must support both estimated and actual usage.

### Preflight Estimate
Before expensive work, the agent can request:
- expected dollar cost range
- expected token range
- expected image-call count
- expected latency range
- privacy mode implications

### Actual Usage
After execution, receipts must log:
- planner token usage when available
- image-model call count
- provider cost when available
- wall-clock latency
- retry count

The same receipt corpus should support workflow-prior retrieval and export-success ranking.

## Safety And User Control
- Agents must not silently apply destructive edits without a reversible boundary.
- Agents must not overwrite exports without explicit instruction or versioned naming.
- Review proposals remain optional and explicit.
- Focus hints and communication overlays remain non-destructive.
- Connected-mode operations must respect consent and privacy mode.
- The user can interrupt, revert, or export at any safe boundary.
- Observable agent sessions should produce replayable action traces for debugging and regression analysis.

## V1 Scope
V1 Agent Workflow should support:
- single active tab observation
- branch tabs for speculative work
- direct invocation of current single-image affordances
- observable canvas-tool driving for `Marker`, `Highlight`, `Magic Select`, and `Eraser`
- design review request and proposal acceptance
- checkpoint creation and revert
- goal evaluation and tab comparison
- workflow-prior retrieval over past successful receipts
- export with receipt bundle
- route-policy preferences
- dormant runtime compatibility for `make_space` without advertising it in the visible rail

## V1 Acceptance Criteria
- An agent can inspect the current tab without mutating state.
- An agent can call one current direct affordance on a target tab.
- An agent can drive visible `Marker`, `Highlight`, `Magic Select`, and `Eraser` interactions through a stable tool-driver API.
- An agent can create spatial focus and request design review.
- An agent can receive structured proposals and choose one.
- An agent can accept a proposal in place or in a branch tab.
- An agent can evaluate whether the resulting image moved closer to the goal.
- An agent can retrieve similar successful workflow paths for the current goal and export target.
- An agent can revert a bad branch and promote a better branch.
- An export includes both output artifact and reproducibility receipt.
- Observable agent sessions can be replayed for automated manual testing and visual regression review.

## Open Questions
- Should semantic review guidance remain agent-only at first, or later be offered to humans too?
- How much raw provider/model detail should advanced agents be allowed to override?
- Should branch comparison be model-scored, human-scored, or hybrid by default?
- When a proposal depends on multiple images, when should the workflow fork automatically?
- Which evaluator axes are universal enough for reuse across most tasks?

## Near-Term Build Order
1. Add `goal packet` and `focusSpec` contracts.
2. Expose observe-only runtime state for tabs, canvas items, history, review, and receipts.
3. Wrap current seeded affordances and review apply behind agent-safe mutate calls.
4. Add observable tool-driver APIs for `Marker`, `Highlight`, `Magic Select`, and `Eraser` plus replay traces, while preserving dormant `make_space` runtime compatibility.
5. Add checkpoints and branch-tab compare/promote flows.
6. Add preflight cost estimation and post-run usage accounting.
7. Add evaluator packets for goal progress.
8. Add workflow-prior retrieval over successful receipts and promoted branches.
