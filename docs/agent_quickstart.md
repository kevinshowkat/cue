# Integration Quickstart

Use this file when an external tool wants a fast starting point.

## Step 1

Check whether optional intake is available:

- `docs/agent_intake_status.md`
- `docs/agent_intake_roundtrip.sample.json`
- `agent-intake.json`

## Common Starting Points

Desktop behavior:

- `desktop/src/canvas_app.js`
- `desktop/src/index.html`
- `docs/desktop.md`

Native runtime and events:

- `rust_engine/crates/brood-cli/src/main.rs`
- `rust_engine/crates/brood-engine/src/lib.rs`
- `rust_engine/crates/brood-contracts/src/events.rs`

Release and docs:

- `README.md`
- `CONTRIBUTING.md`
- `RELEASING.md`
- `docs/README.md`

## Useful Checks

- `cd desktop && npm test`
- `cd desktop && npm run build`
- `cd desktop/src-tauri && cargo check`
- `./scripts/check_agent_entrypoints.py`
