# Legacy Internals

Cue's public name is standardized, but several internals still use older identifiers. These are tracked here so we can keep the public surface clean without forcing a risky deep rename before launch.

## Remaining Internal Names

- Rust workspace crates: `brood-cli`, `brood-engine`, `brood-contracts`
- Native packaged engine resource: `brood-rs`
- Default config and run directories still support legacy paths such as `~/.brood` and `~/brood_runs`
- Deprecated environment aliases beginning with `BROOD_`
- Internal schema ids beginning with `brood.`
- Internal shell/export module names beginning with `juggernaut`

## Migration Policy

- Public docs, workflows, release assets, and user-facing strings should say Cue.
- Code can keep legacy internal identifiers where renaming would add avoidable launch risk.
- New public configuration should prefer `CUE_*` names first and fall back to `BROOD_*` compatibility aliases.
