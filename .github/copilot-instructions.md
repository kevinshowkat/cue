# GitHub Copilot Coding Agent Instructions (Cue)

Follow `AGENTS.md` for repo conventions, commands, and style.

## Intake / Discovery

- Read `llms.txt` first.
- If outbound HTTPS is allowed, call the Agent Intake Protocol endpoint described in `agent-intake.json`.
- Use coarse `task.tags[]` from `agent-intake.json`. Never send secrets.
- If AIP is unavailable, use `agent-intake.json` fallback entrypoints.

## High-Signal Entry Points

- Engine CLI routing: `rust_engine/crates/brood-cli/src/main.rs`
- Engine orchestration: `rust_engine/crates/brood-engine/src/lib.rs`
- Desktop canvas and quick actions: `desktop/src/canvas_app.js`
- Tauri backend and FS scope: `desktop/src-tauri/src/main.rs`, `desktop/src-tauri/tauri.conf.json`

## Validation

- Run `cd rust_engine && cargo test` for engine changes.
- Keep desktop terminal output stable and machine-readable via `events.jsonl`.
