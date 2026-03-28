# Releasing Cue

The public release path is macOS-first. The repository ships source plus a GitHub Release with a Cue DMG.

## Pre-Release Check

Run this before tagging:

```bash
./scripts/release_check.sh
```

## Version Files

These versions must match:

- [desktop/package.json](desktop/package.json)
- [desktop/src-tauri/tauri.conf.json](desktop/src-tauri/tauri.conf.json)
- [desktop/src-tauri/Cargo.toml](desktop/src-tauri/Cargo.toml)

## GitHub Release Automation

Pushing a tag like `v0.2.5` runs the public publish workflow. It:

- runs the clean-machine macOS smoke flow
- builds the signed and notarized macOS DMG
- attaches the DMG to a draft GitHub Release

Relevant files:

- [`.github/workflows/publish.yml`](.github/workflows/publish.yml)
- [`.github/workflows/desktop-clean-machine-smoke.yml`](.github/workflows/desktop-clean-machine-smoke.yml)
- [`scripts/macos_clean_machine_smoke.sh`](scripts/macos_clean_machine_smoke.sh)
- [`scripts/release_check.sh`](scripts/release_check.sh)

## Secrets

Preferred release secret:

- `CUE_RELEASE_TOKEN`

Deprecated compatibility fallback:

- `BROOD_RELEASE_TOKEN`

Apple signing and notarization:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

## Release Steps

1. Bump the three version files.
2. Update [CHANGELOG.md](CHANGELOG.md).
3. Run `./scripts/release_check.sh`.
4. Commit the release change.
5. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
6. Wait for the `publish` workflow to finish.
7. Verify the draft release contains the Cue DMG.

## Current Caveats

- The packaged native engine resource is still staged internally as `brood-rs`.
- Some schemas, local-storage keys, and runtime internals still use legacy naming. Track the remaining items in [docs/legacy-internals.md](docs/legacy-internals.md).
- Homebrew is intentionally out of scope for the first public launch.
