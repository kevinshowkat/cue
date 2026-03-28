# Agent Quickstart

Use this when you need a high-confidence starting path quickly.

## Task 0: Check Intake Status

- Read `docs/agent_intake_status.md`
- Read `docs/agent_intake_roundtrip.sample.json`
- Read `agent-intake.json`

Expected output:

- intake mode is classified as `healthy` or `degraded`
- if degraded, the fallback sequence is explicit

## Task 1: Change Agent Run Planning Or Goal Evaluation

- Read `docs/agent-runtime.md`
- Read `docs/agent-affordances.json`
- Read `desktop/src/agent_runner_runtime.js`
- Read `desktop/src/agent_runner_goal_contract.js`
- Read `desktop/test/agent_runner_runtime.test.js`
- Read `desktop/test/agent_runner_goal_contract.test.js`

Run:

- `cd desktop && npm test`
- `cd desktop && npm run build`

## Task 2: Change Visible Prep, Observable Automation, Or Magic Select

- Read `desktop/src/agent_observable_driver.js`
- Read `desktop/src/magic_select_runtime.js`
- Read `desktop/src/canvas_app.js`
- Read `desktop/src/juggernaut_shell/rail.js`
- Read `docs/local-magic-select-runtime.md`

Run:

- `cd desktop && npm test`
- `cd desktop/src-tauri && cargo check`

## Task 3: Change Single-Image Routing, Direct Affordances, Or Create Tool

- Read `desktop/src/single_image_capability_routing.js`
- Read `desktop/src/tool_runtime.js`
- Read `desktop/src/juggernaut_shell/rail.js`
- Read `desktop/src/design_review_contract.js`
- Read `docs/legacy-internals.md`

Run:

- `cd desktop && npm test`
- `cd desktop && npm run build`
- `cd desktop/src-tauri && cargo check`

## Task 4: Documentation Or Release Surface

- Read `README.md`
- Read `CONTRIBUTING.md`
- Read `RELEASING.md`
- Read `llms.txt`
- Read `llms-full.txt`
- Read `agent-intake.json`
- Read `docs/README.md`
- Read `docs/asset-provenance.md`
- Read `docs/agent-runtime.md`
- Read `docs/agent-workflow-prd.md`
- Read `docs/agent-affordances.json`

Run:

- `./scripts/check_agent_entrypoints.py`
