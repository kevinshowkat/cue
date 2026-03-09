# Juggernaut

Juggernaut is an image-first desktop design workstation built around a text-free editing loop: import images to a canvas, create custom tools, apply those tools deterministically when possible, and export reproducible assets.

## Current Vertical Slice

The repo currently supports this launch path:

1. import one or more images onto the canvas
2. create a custom tool from a short description
3. apply a deterministic local edit to the selected image
4. export a flattened PSD with a receipt trail

The shell has been reset toward a lighter, more premium desktop design-tool feel, with custom left-rail iconography and reduced default telemetry noise.

## Status

- Desktop shell: Tauri
- Verified locally: macOS build, test, and DMG generation
- Release target: same core feature set across macOS, Windows, and Linux
- Not finished yet: native `.ai` and `.fig` round-trip, full 3D authoring, marketplace discovery, and final release automation polish

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
- Desktop shell notes: [docs/desktop.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/desktop.md)
- PSD export slice: [docs/psd-export-slice.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/psd-export-slice.md)
- Multi-agent sprint runbooks: [docs/runbooks/README.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/README.md)

## Known Limitations

- PSD export is still flattened for the current slice.
- The native engine binary and some environment paths still use legacy `brood` naming internally during the transition.
- Current automation and smoke coverage are strongest on macOS.

## License

Apache License 2.0. See [LICENSE](/Users/mainframe/Desktop/projects/Juggernaut/LICENSE).
