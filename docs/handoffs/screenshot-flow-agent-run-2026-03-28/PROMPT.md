You are doing a local research synthesis and evaluation-design pass for Cue's screenshot flow.

Use the checked-out repo as the source of truth. Do not start from generic product assumptions, do not browse the public internet unless the user explicitly asks, and do not optimize for a broad market survey. This task is about extracting the screenshot-specific product goals already stored locally in the repo, then converting them into a repeatable Agent Run goal set and an analysis plan for emergent behavior across many runs.

## Context

Cue is a text-free-first, image-first desktop design workstation. The current app slice is single-image-first and already supports:

- importing an image into a session tab
- scoping edits with communication tools on the canvas
- running `Design Review`
- accepting a proposal to apply a real in-place image change
- exporting with reproducible receipts

The immediate product question is not "what image editor could Cue become in general?" It is:

- what screenshot-centric jobs the current product is actually aiming to solve
- which concrete screenshot goals we should feed into `Agent Run`
- what repeated-run evidence would teach us how to improve Cue for that specific screenshot use case

## Primary Local Sources To Read

Read these first:

- `AGENTS.md`
- `README.md`
- `PRD.md`
- `docs/desktop.md`
- `docs/market/los-angeles-game-dev-use-cases.md`
- `docs/agent-runtime.md`
- `docs/agent-workflow-prd.md`
- `docs/benchmark-playbook.md`
- `docs/features/design-review-proposal-preview-images/README.md`

Then search the repo for additional Markdown files mentioning terms like:

- `screenshot`
- `HUD`
- `UI polish`
- `safe-area`
- `accessibility`
- `captured frame`
- `review/apply`
- `receipt`
- `Agent Run`

Only pull in extra docs that materially sharpen the screenshot-flow interpretation.

## Product Interpretation You Should Pressure-Test

One local document is especially important:

- `docs/market/los-angeles-game-dev-use-cases.md`

That memo argues the best next execution-fit wedge for Cue is:

- `Screenshot-first HUD/UI polish between designer and engineer`

The same memo frames the current game-team workflow as:

- `capture screen -> mark it up in one tool -> discuss it in another -> rebuild it somewhere else -> hand it to engineering`

And it argues Cue is already organized around:

- `one real frame -> visual marks -> review proposals -> applied change -> receipt`

Do not accept that thesis blindly. Verify whether the rest of the repo actually supports it, contradicts it, or narrows it further.

## Your Job

Produce an evidence-backed handoff that does three things:

1. Extract the concrete screenshot-use-case goals already implied by the repo.
2. Turn those goals into a repeatable `Agent Run` scenario library.
3. Define how repeated runs should be analyzed so we can learn emergent product behavior and use that to improve Cue for screenshot-first work.

## Constraints

- Stay grounded in the current shipped slice, not the eventual dream product.
- Prefer screenshot flows that are executable today or are one step away from today's surfaces.
- Separate current capabilities from future requirements.
- Keep the analysis focused on single-image-first screenshot work.
- Do not recommend chat-centric workflows as the main path.
- Respect the product rule that reproducibility and receipts matter for every meaningful run.

## Required Deliverables

Produce both of these artifacts:

1. `docs/handoffs/screenshot-flow-agent-run-2026-03-28/REPORT.md`
2. `docs/handoffs/screenshot-flow-agent-run-2026-03-28/agent_run_goals.json`

## REPORT.md Structure

Use this exact structure:

### 1. Executive Summary
- State the screenshot-specific wedge Cue is actually positioned to own right now.
- Say whether the repo evidence supports, narrows, or weakens the `screenshot-first HUD/UI polish` thesis.

### 2. Evidence Map
For each source you relied on:
- path
- what it contributes
- whether it describes:
  - current shipped behavior
  - near-term product intent
  - broader strategic direction

### 3. Screenshot Use-Case Inventory
List the concrete screenshot jobs the repo is trying to solve.

For each use case, include:
- short name
- user role
- input artifact
- desired output
- why Cue is better than the incumbent workflow
- which current app surfaces support it now
- what is still missing
- source references

This section should distinguish clearly between:
- executable now
- partially supported now
- future-facing only

### 4. Current Critical Path In The App
Describe the current screenshot flow as it exists in the product today.

At minimum, map:
- import
- communication/scoping
- design review
- apply
- compare/history if relevant
- export
- receipts / run artifacts

Be concrete about where the app is already strong and where the user still falls out of the intended screenshot workflow.

### 5. Agent Run Goal Library
Define a goal set that can be dropped into `Agent Run`.

Group goals into a few categories such as:
- HUD/UI polish
- readability / safe-area / accessibility triage
- implementation-ready handoff
- repeatable screenshot cleanup patterns

For each goal, include:
- `goal_id`
- exact `goal_text` written as a paste-ready Agent Run instruction
- scenario category
- screenshot context
- hard constraints to preserve
- success criteria
- likely best starting tool or flow
- expected stopping condition
- whether the goal is:
  - current-fit
  - stretch-fit
  - future-only

### 6. Repeated-Run Evaluation Plan
Define how to run the goal library repeatedly and what to learn from it.

Include:
- recommended scenario count
- how many runs per scenario
- when to branch versus re-run the same goal
- what artifacts to capture from each run
- what should be scored manually versus automatically

### 7. Emergent Behavior Framework
This is the core of the assignment.

Describe what emergent behaviors we should look for across many runs, such as:
- routing patterns that work better than expected
- repeated failure modes on certain screenshot classes
- excessive review/apply churn
- weak communication-tool affordances
- export/handoff breakdowns
- goal classes where the agent stops too early or too late
- cases where receipts are insufficient to explain success or failure
- recurring patterns that should become shortcuts/tools

For each emergent-behavior category, include:
- signal
- evidence source
- likely product interpretation
- suggested product follow-up

### 8. Instrumentation Gaps
List the missing logs, receipts, annotations, or evaluation fields that would make the repeated-run analysis materially more useful.

Be specific about:
- run artifacts
- receipts
- action traces
- branch comparison data
- accept/reject outcomes
- export outcomes

### 9. Prioritized Product Improvements
Recommend the highest-leverage improvements for this screenshot wedge only.

Prioritize changes that would help:
- screenshot-first HUD/UI polish
- screenshot-native review/apply confidence
- engineering handoff quality
- repeatability across similar frames
- emergent-behavior learning from Agent Run

### 10. Appendix: Source Quotes And Goal Seeds
- Include a compact list of the exact repo passages that most strongly shaped the recommendation.
- Keep quotes short and source-cited by file path.

## agent_run_goals.json Contract

Write a JSON array.

Each element must follow this shape:

```json
{
  "goal_id": "hud_polish_top_right_badge",
  "goal_text": "Use design review to improve the top-right badge placement on this screenshot while preserving gameplay-critical content, then export a PSD.",
  "category": "hud_ui_polish",
  "current_fit": "current-fit",
  "input_type": "single_screenshot",
  "constraints": [
    "preserve gameplay-critical content",
    "stay on the exact captured frame",
    "produce an implementation-ready result"
  ],
  "success_criteria": [
    "approved direction is clear on the original frame",
    "result can be exported with receipt",
    "change is explainable to engineering"
  ],
  "recommended_start": "marker_then_design_review",
  "recommended_stop": "after one approved applied direction plus export",
  "source_refs": [
    "docs/market/los-angeles-game-dev-use-cases.md",
    "docs/desktop.md"
  ]
}
```

Use categories that make sense for the screenshot wedge. Include only goals that are grounded in the repo evidence.

## Quality Bar

A good answer will not just restate the PRD. It will connect:

- the strategic screenshot wedge
- the actual app flow we have now
- the exact Agent Run goals we should test
- the evidence we need to collect
- the product changes that repeated runs are likely to expose

The final output should be useful enough that a teammate can:

1. take `agent_run_goals.json`
2. run those goals repeatedly through the current app
3. inspect receipts and run artifacts
4. recognize meaningful emergent behavior
5. decide what to improve next for Cue's screenshot-first workflow
