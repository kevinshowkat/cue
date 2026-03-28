# Agent Quickstart

Use this when you need a high-confidence starting path quickly.

## Task 0: Check Intake Status

- Read `docs/agent_intake_status.md`
- Read `docs/agent_intake_roundtrip.sample.json`
- Read `agent-intake.json`

Expected output:

- intake mode is classified as `healthy` or `degraded`
- if degraded, the fallback sequence is explicit

## Task 1: Add Or Modify A Desktop Ability

- Read `desktop/src/canvas_app.js`
- Read `rust_engine/crates/brood-cli/src/main.rs`
- Read `docs/legacy-internals.md`

Run:

- `cd desktop && npm test`
- `cd rust_engine && cargo test`

## Task 2: Change Event Schema Or Run-Artifact Behavior

- Read `rust_engine/crates/brood-contracts/src/events.rs`
- Read `rust_engine/crates/brood-engine/src/lib.rs`
- Read `docs/desktop.md`
- Read `docs/legacy-internals.md`

Run:

- `cd rust_engine && cargo test`
- `cd desktop && npm test`

## Task 3: Diagnose Desktop File Import Or FS Scope

- Read `desktop/src-tauri/tauri.conf.json`
- Read `desktop/src-tauri/src/main.rs`
- Read `README.md`

Run:

- `./scripts/dev_desktop.sh`
- `cd desktop/src-tauri && cargo check`

## Task 4: Documentation Or Release Surface

- Read `README.md`
- Read `CONTRIBUTING.md`
- Read `RELEASING.md`
- Read `docs/README.md`
- Read `docs/asset-provenance.md`

Run:

- `./scripts/check_agent_entrypoints.py`
