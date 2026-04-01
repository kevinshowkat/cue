# Legacy Internals

Cue is the public product name. Some older internal names are still in the codebase for compatibility.

## Names Still In Use

- Rust crates: `brood-cli`, `brood-engine`, `brood-contracts`
- packaged native engine resource: `brood-rs`
- legacy config or run directories such as `~/.brood` and `~/brood_runs`
- deprecated environment aliases that start with `BROOD_`
- local Magic Select aliases that still start with `JUGGERNAUT_MAGIC_SELECT_`
- some schema ids that start with `brood.`
- some internal module names that start with `juggernaut`

## Rule

- user-facing docs, releases, and strings should say Cue
- prefer `CUE_*` configuration first and keep `BROOD_*` only as a compatibility fallback
