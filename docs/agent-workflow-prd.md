# Cue Agent Workflow PRD

Status: public implementation note
Last updated: 2026-03-28
Document owner: product / founding team

## Purpose

This document explains the agent workflow that is actually implemented in the public Cue repo. It does not define a larger future API surface that has not shipped.

## Current Product Statement

Cue Agent Workflow is a constrained visual runtime. An agent can compile a goal, inspect the visible canvas summary, choose one bounded next action, use visible prep tools when needed, request or accept Design Review, run existing image actions, create a local custom tool, and export the result.

## Shipped In The Current Public Slice

- Goal contract compile and stop-check flow.
- Agent Run planner that returns one JSON action at a time.
- Visible prep through `marker_stroke`, `magic_select_click`, and `eraser_stroke`.
- Seeded single-image actions: `cut_out`, `remove`, `new_background`, `reframe`, `variants`.
- Direct affordances: `remove_people`, `polish`, `relight`.
- Design Review request and accepted-proposal apply.
- Local Create Tool preview and registration.
- Export in `psd`, `png`, `jpg`, `webp`, and `tiff`.

## Current Runtime Loop

1. Compile the user goal into a goal contract.
2. Summarize the visible canvas, selected images, marks, region selections, review state, session tools, and action budget.
3. Ask the planner for exactly one next action.
4. Execute that action through the existing runtime.
5. Re-check visible progress and either continue, export, or stop.

## What This Public Slice Does Not Yet Expose

- A generic `observe` / `mutate` / `review` API with public method names.
- Agent-native tab branching, checkpoint, revert, or compare-tab APIs.
- Planner-controlled `protect_stroke`, `stamp_click`, or `make_space_click`.
- A broad filesystem or network authority surface for agents.
- A promise that every lower-level runtime helper is stable enough to document as a public contract.

## Design Review Role

Design Review is the planning surface for ambiguous or multi-step edits. It is not unrestricted chat and it does not silently apply changes. In the current slice it sees only what is visible on the canvas plus the visible prep signals already placed there.

## Observable Driver Role

Cue also exposes a lower-level observable driver for replay and automation. That layer supports `protect_stroke`, `stamp_click`, and `make_space_click` in addition to the Agent Run prep actions, but those lower-level actions are not yet part of the planner contract.

## Current Source Of Truth Files

- `desktop/src/agent_runner_runtime.js`
- `desktop/src/agent_runner_goal_contract.js`
- `desktop/src/agent_observable_driver.js`
- `desktop/src/single_image_capability_routing.js`
- `desktop/src/tool_runtime.js`
- `desktop/src/design_review_contract.js`

## Direction

Future expansion should promote proven runtime actions into the planner contract one by one. Do not treat the old broader workflow language as a shipped public API.
