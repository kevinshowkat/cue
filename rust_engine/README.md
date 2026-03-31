# Rust Engine Scaffold

This workspace is the starting point for the Cue engine rewrite in Rust.

The canonical crate names are now `cue-cli`, `cue-contracts`, and `cue-engine`. The workspace still ships a `brood-rs` binary alias for one release so older desktop launch paths and scripts remain readable during migration.

Current scope:
- `cue-rs` CLI entrypoint for native `chat`, `run`, `recreate`, `export`.
- Native Rust contract modules (ported from Python) for:
  - chat intent parsing
  - event writing (`events.jsonl`)
  - thread manifests
  - receipts
  - summary payloads
  - cache store
  - feedback writer
  - model/provider selection primitives
- Parity-focused unit tests for these contracts.

See also:
- [`ARCHITECTURE.md`](/Users/mainframe/Desktop/projects/Juggernaut/rust_engine/ARCHITECTURE.md)

## Dev usage

```bash
cd rust_engine
cargo test
cargo run -p cue-cli -- chat --out /tmp/cue-rs-run --events /tmp/cue-rs-run/events.jsonl
```

Native dryrun execution example:

```bash
cargo run -p cue-cli -- run --prompt "boat" --out /tmp/cue-rs-native --image-model dryrun-image-1
```
