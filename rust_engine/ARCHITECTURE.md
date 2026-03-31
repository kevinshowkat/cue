# Cue Rust Runtime Architecture

This workspace now uses `cue-*` as the canonical naming surface.

## Canonical Names

- Workspace crates: `cue-cli`, `cue-engine`, `cue-contracts`
- Canonical binary: `cue-rs`
- Canonical desktop resource: `desktop/src-tauri/resources/cue-rs`
- Canonical config dir: `~/.cue`
- Canonical run root: `~/cue_runs`

## Legacy Compatibility

The runtime still reads these legacy `brood` names for one migration window:

- binary alias: `brood-rs`
- config dir: `~/.brood`
- run root reads: `~/brood_runs`
- localStorage prefix: `brood.`
- schema IDs such as `brood.intent_icons` and `brood.mother.generate.v2`
- selected env vars with `BROOD_` prefixes when the `CUE_` equivalent is unset

All new writes should use `cue` names only.

## Crate Map

- `cue-cli`
  - Thin binary entrypoints in `src/main.rs` and `src/bin/brood_rs_compat.rs`
  - Main runtime logic currently lives in `src/lib.rs`
  - Owns chat loop, realtime sessions, observe/vision inference, planning payloads, recreate, and export flow
- `cue-engine`
  - Thin crate root in `src/lib.rs`
  - Runtime implementation currently lives in `src/runtime.rs`
  - Owns provider orchestration, plan preview, receipts, cache, summary, pricing, and artifact generation
- `cue-contracts`
  - Shared contract and persistence modules for chat parsing, events, model registry, receipts, cache, summary, and thread manifests

## Desktop Seam

The desktop still launches the Rust runtime through the CLI seam.

- Dev launch: `cargo run -p cue-cli -- chat ...`
- Packaged launch: bundled `cue-rs`
- Compatibility launch: `brood-rs` is still accepted as an alias during migration

## Migration Rules

- Prefer `CUE_*` env vars in new docs and tooling.
- When adding a new persisted key or schema, use `cue.*`.
- If a reader must accept legacy artifacts, normalize them to the canonical `cue` form immediately after parsing.
- Do not rename historical `../brood` provenance references that describe the upstream source repo path.
