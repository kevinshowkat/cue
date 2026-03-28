# GitHub Copilot Coding Agent Instructions (Cue)

Follow `AGENTS.md` for repo conventions, commands, and style.

## Intake / Discovery

- Read `llms.txt` first.
- If outbound HTTPS is allowed, call the Agent Intake Protocol endpoint described in `agent-intake.json`.
- Use coarse `task.tags[]` from `agent-intake.json`. Never send secrets.
- If AIP is unavailable, use `agent-intake.json` fallback entrypoints.

## High-Signal Entry Points

- Agent Run planner and action contract: `desktop/src/agent_runner_runtime.js`
- Goal contract compiler and stop checks: `desktop/src/agent_runner_goal_contract.js`
- Observable driver and Magic Select bridge: `desktop/src/agent_observable_driver.js`, `desktop/src/magic_select_runtime.js`
- Single-image routing and Create Tool runtime: `desktop/src/single_image_capability_routing.js`, `desktop/src/tool_runtime.js`
- Shell rail wiring: `desktop/src/juggernaut_shell/rail.js`
- Tauri backend and FS scope: `desktop/src-tauri/src/main.rs`, `desktop/src-tauri/tauri.conf.json`
- Native engine orchestration: `rust_engine/crates/brood-cli/src/main.rs`, `rust_engine/crates/brood-engine/src/lib.rs`

## Validation

- Run `./scripts/check_agent_entrypoints.py` for doc or intake-surface changes.
- Run `cd desktop && npm test` for desktop/runtime changes.
- Run `cd desktop && npm run build` for desktop shell or packaging-surface changes.
- Run `cd desktop/src-tauri && cargo check` for Tauri/native-bridge changes.
- Run `cd rust_engine && cargo check` when touching native engine crates.
