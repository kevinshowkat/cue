# Cue

Cue is an open source desktop app for image-first design work. The current public release is verified on macOS and includes source plus a macOS DMG.

<p align="left">
  <img src="media/features/readme/cue_readme_fast.gif" alt="Cue demo" width="640" />
</p>

## What It Does

- open multiple session tabs in one window
- import images into a shared canvas
- make direct edits and use design review suggestions
- save reusable tools
- export PSD, PNG, JPG, WEBP, or TIFF with a receipt

## Current Status

- Verified today: macOS clone, tests, build, and packaging
- Public release scope: source plus a macOS GitHub Release
- Roadmap: Windows and Linux parity, richer editable export, and fewer legacy internal names

## Run From Source

```bash
./scripts/dev_desktop.sh
```

## Release Check

```bash
./scripts/release_check.sh
```

This runs the desktop tests, frontend build, Rust checks, Tauri packaging, and DMG checksum output.

## Start Here

- [Product overview](PRD.md)
- [Repository workflow](AGENTS.md)
- [Contributing](CONTRIBUTING.md)
- [Release guide](RELEASING.md)
- [Docs index](docs/README.md)

## Known Limits

- Public verification is strongest on macOS.
- Current exports are flattened rather than fully editable layered files.
- Some internal crate and resource names still use older `brood` or `juggernaut` identifiers.

## License

Apache License 2.0. See [LICENSE](LICENSE).
