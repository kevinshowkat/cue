# Cue

Cue is an image-first desktop design workstation built around a text-free-first editing loop. The current app centers on session tabs, a shared canvas, design review/apply, in-session tool creation, reproducible receipts, and exportable results.

## Current Product State

The repo currently supports this Mac-verified workflow:

1. create, open, save, close, and fork session tabs in one shared window
2. import images by left-rail `Upload`, `File > Import Photos...`, or drag-drop
3. use left-rail single-image actions and right-rail communication tools to scope edits
4. run `Design Review` proposals and accept a real in-place single-image apply
5. preview or create reusable tools in-session
6. inspect tab-local history and export PSD, PNG, JPG, WEBP, or TIFF with receipts

Brood-derived multi-image and token workflows still exist in the runtime, but the main Cue slice remains single-image-first.

## Status

- Desktop shell: Tauri
- Verified locally: macOS build, test, and DMG generation
- Release target: same core feature set across macOS, Windows, and Linux
- Current gaps: native `.ai` and `.fig` round-trip, richer PSD layering fidelity, cross-platform verification, and final release automation polish

## Run From Source

```bash
./scripts/dev_desktop.sh
```

## Release Check

Run the canonical packaging verification before tagging a release:

```bash
./scripts/release_check.sh
```

That script runs desktop tests, frontend build, Rust checks, a Tauri DMG build, and prints checksums for produced DMG artifacts.

## Repo Entry Points

- Product definition: [PRD.md](/Users/mainframe/Desktop/projects/Juggernaut/PRD.md)
- Agent workflow rules: [AGENTS.md](/Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md)
- Docs index: [docs/README.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/README.md)
- Current desktop behavior: [docs/desktop.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/desktop.md)
- Visual timeline contract: [docs/features/visual-timeline/README.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/features/visual-timeline/README.md)
- Shell/tool/export bridge notes: [docs/features/shell-canvas-integration.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/features/shell-canvas-integration.md)
- PSD export slice: [docs/psd-export-slice.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/psd-export-slice.md)
- Multi-agent sprint runbooks: [docs/runbooks/README.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/README.md)
- Changelog: [CHANGELOG.md](/Users/mainframe/Desktop/projects/Juggernaut/CHANGELOG.md)

## Known Limitations

- PSD, PNG, JPG, WEBP, and TIFF exports are all flattened for the current slice.
- The native engine binary and some environment paths still use legacy `brood` naming internally during the transition.
- Current automation, packaging, and smoke coverage are strongest on macOS.

## License

Apache License 2.0. See [LICENSE](/Users/mainframe/Desktop/projects/Juggernaut/LICENSE).
