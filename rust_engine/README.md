# Rust Engine

This workspace contains Cue's native runtime.

## What Is Here

- the `brood-cli` command-line entrypoint
- runtime orchestration and event writing
- receipts and supporting contracts
- provider and routing code used by the desktop app

Some internal names still use older `brood` identifiers. Those are compatibility details, not the public product name.

## Common Commands

```bash
cd rust_engine
cargo test
cargo run -p brood-cli -- chat --out /tmp/brood-rs-run --events /tmp/brood-rs-run/events.jsonl
```
