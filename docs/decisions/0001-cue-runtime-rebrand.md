# 0001: Canonicalize The Rust Runtime As Cue

## Status

Accepted

## Context

The Rust runtime and desktop seam were still split between public `Cue` branding and internal `brood-*` crate, binary, path, and schema names. That made the codebase harder to navigate, and it forced contributors to remember which names were historical versus canonical.

## Decision

- Canonical Rust workspace crates are `cue-cli`, `cue-engine`, and `cue-contracts`.
- Canonical native binary is `cue-rs`.
- Canonical desktop resource path is `desktop/src-tauri/resources/cue-rs`.
- Canonical user data roots are `~/.cue` and `~/cue_runs`.
- Canonical persisted identifiers use `cue.*` or `cue_*`.
- One migration window remains where legacy `brood` names are still readable through compatibility aliases and fallback readers.

## Consequences

- New code, docs, env vars, resources, and emitted identifiers should use `cue` names only.
- Readers that must ingest old artifacts should normalize `brood` inputs to canonical `cue` forms immediately after parsing.
- Historical references to the upstream `../brood` repo remain valid when they describe provenance rather than current product naming.
