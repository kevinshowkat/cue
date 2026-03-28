# Cue Agent Runtime Guide

This document describes the agent surface that exists in the public Cue repo today.

Companion files:

- [agent-workflow-prd.md](agent-workflow-prd.md)
- [agent-affordances.json](agent-affordances.json)
- [local-magic-select-runtime.md](local-magic-select-runtime.md)

## What Exists Today

- Goal contract compiler: turns a freeform goal into hard requirements, soft intents, and stop rules.
- Agent Run planner: returns exactly one next action as JSON.
- Observable driver: lower-level visible-canvas actions for replay and automation.
- Single-image routing: seeded tools and direct affordances for the active image.
- Design Review: proposal request and accepted-proposal apply.
- Create Tool: deterministic local manifest preview and registration.
- Export: `psd`, `png`, `jpg`, `webp`, and `tiff`.

## Current Agent Run Action Contract

Selection:

- `set_active_image`
- `set_selected_images`

Visible prep:

- `marker_stroke`
- `magic_select_click`
- `eraser_stroke`

Review:

- `request_design_review`
- `accept_review_proposal`

Image actions:

- `invoke_seeded_tool`
  - supported `toolId`: `cut_out`, `remove`, `new_background`, `reframe`, `variants`
- `invoke_direct_affordance`
  - supported `toolId`: `remove_people`, `polish`, `relight`

Tool creation:

- `preview_create_tool`
- `create_tool`
- `invoke_custom_tool`

Output and control:

- `export`
- `stop`

## Important Runtime Constraints

- Agent Run plans one bounded next step at a time.
- `set_selected_images` accepts 1 to 3 visible image ids.
- `cut_out` requires a real subject region on the active image before it can run.
- `remove` is destructive cleanup. Do not use it to extract a reusable subject.
- Design Review sees only the visible canvas, visible marks, visible region selections, and current image selection.
- `set_active_image`, `set_selected_images`, `marker_stroke`, `magic_select_click`, and `eraser_stroke` are discounted prep actions in the action budget, but they still count.
- `export` defaults to `psd` when format is omitted.

## Observable Driver vs Agent Run

The lower-level observable driver supports a slightly broader surface than Agent Run:

- `marker_stroke`
- `protect_stroke`
- `magic_select_click`
- `stamp_click`
- `make_space_click`
- `eraser_stroke`

Agent Run currently exposes only `marker_stroke`, `magic_select_click`, and `eraser_stroke` directly. Use the lower-level observable driver only when you are integrating replay, automation, or visible-canvas tooling below the planner layer.

## Source Of Truth Files

- Planner and action parsing: `desktop/src/agent_runner_runtime.js`
- Goal contract compile and stop checks: `desktop/src/agent_runner_goal_contract.js`
- Observable driver bridge: `desktop/src/agent_observable_driver.js`
- Single-image capability routing: `desktop/src/single_image_capability_routing.js`
- Tool manifest runtime: `desktop/src/tool_runtime.js`
- Design Review schemas and model choices: `desktop/src/design_review_contract.js`
- Main shell wiring: `desktop/src/juggernaut_shell/rail.js`, `desktop/src/canvas_app.js`

## Validation Files

- `desktop/test/agent_runner_runtime.test.js`
- `desktop/test/agent_runner_goal_contract.test.js`
- `desktop/test/agent_observable_driver.test.js`
- `desktop/test/magic_select_runtime.test.js`

## Legacy Naming Note

Some internal schema ids, events, and packaged resources still use legacy `brood` or `juggernaut` names. Treat [legacy-internals.md](legacy-internals.md) as the allowlist for those temporary names.
