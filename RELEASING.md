# Releasing Cue

Cue currently ships as source plus a macOS GitHub Release.

## Run The Release Check

```bash
./scripts/release_check.sh
```

`./scripts/release_check.sh` now starts by running the verification queue for the macOS screenshot-polish baseline:

```bash
node scripts/rewrite_verification_queue.mjs run --group release-check
```

The DMG-backed macOS smoke gate remains a separate proof step:

```bash
node scripts/rewrite_verification_queue.mjs run smoke.macos_clean_machine --dmg-path /absolute/path/Cue.dmg
```

The canonical smoke artifact output path is:

```text
outputs/verification/smoke.macos_clean_machine/smoke.log
```

## Make Sure Versions Match

- [desktop/package.json](desktop/package.json)
- [desktop/src-tauri/tauri.conf.json](desktop/src-tauri/tauri.conf.json)
- [desktop/src-tauri/Cargo.toml](desktop/src-tauri/Cargo.toml)

## What The Publish Workflow Does

Pushing a tag such as `v0.2.5` runs the publish workflow. It:

- runs the clean-machine macOS smoke check
- builds the signed and notarized macOS DMG
- attaches the DMG to a draft GitHub Release

Main files:

- [`.github/workflows/publish.yml`](.github/workflows/publish.yml)
- [`.github/workflows/desktop-clean-machine-smoke.yml`](.github/workflows/desktop-clean-machine-smoke.yml)
- [`scripts/rewrite_verification_queue.mjs`](scripts/rewrite_verification_queue.mjs)
- [`scripts/macos_clean_machine_smoke.sh`](scripts/macos_clean_machine_smoke.sh)
- [`scripts/release_check.sh`](scripts/release_check.sh)

## Required Secrets

Release token:

- `CUE_RELEASE_TOKEN`
- `BROOD_RELEASE_TOKEN` still works as a temporary compatibility fallback

Apple signing and notarization:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

## Release Steps

1. Update the three version files.
2. Update [CHANGELOG.md](CHANGELOG.md).
3. Run `./scripts/release_check.sh`.
4. Commit the release change.
5. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
6. Wait for the publish workflow to finish.
7. Confirm the draft release includes the Cue DMG.

## Current Notes

- the packaged native engine resource still uses the internal name `brood-rs`
- a few schemas and storage keys still use older internal names listed in [docs/legacy-internals.md](docs/legacy-internals.md)
- Homebrew is intentionally out of scope for the first public launch
