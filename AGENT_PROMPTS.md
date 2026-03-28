# Compatibility Notes

This file stays in the repo because local checks still read it when verifying shared runtime names.

For normal work, start with:

- [AGENTS.md](AGENTS.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [docs/README.md](docs/README.md)

## Magic Select Prepared Runtime

If you change the local prepared runtime for Magic Select, keep these exact names in sync across `desktop/src/magic_select_runtime.js`, `desktop/src-tauri/src/main.rs`, `docs/local-magic-select-runtime.md`, and `scripts/benchmark_magic_select_runtime.py`.

- Contract: `juggernaut.magic_select.local.prepared.v1`
- Browser helpers: `prepareLocalMagicSelectImage`, `runWarmLocalMagicSelectClick`, `releaseLocalMagicSelectImage`, `evictLocalMagicSelectImage`
- Native commands: `prepare_local_magic_select_image`, `run_local_magic_select_warm_click`, `release_local_magic_select_image`
- Action names: `magic_select_prepare`, `magic_select_warm_click`, `magic_select_release`
