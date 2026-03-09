# Releasing Juggernaut

This repo currently packages Juggernaut as a signed and notarized macOS DMG via GitHub Releases. Windows and Linux remain release targets, but the automated shipping path here is still macOS-first.

## Canonical Local Release Check

Run this before tagging:

```bash
./scripts/release_check.sh
```

That script runs:

- `npm test`
- `node --check desktop/src/canvas_app.js`
- `npm run build`
- `cargo check`
- `npm run tauri build`
- DMG checksum output

## Release Automation

When you push a tag like `v0.2.5`, GitHub Actions will:

- run the macOS clean-machine smoke install flow
- build a signed/notarized macOS DMG
- stage the native Rust engine binary at `desktop/src-tauri/resources/brood-rs`
- attach the DMG to a draft GitHub Release
- attempt a Homebrew tap update

Relevant files:

- Workflow: [publish.yml](/Users/mainframe/Desktop/projects/Juggernaut/.github/workflows/publish.yml)
- Smoke workflow: [desktop-clean-machine-smoke.yml](/Users/mainframe/Desktop/projects/Juggernaut/.github/workflows/desktop-clean-machine-smoke.yml)
- Smoke script: [scripts/macos_clean_machine_smoke.sh](/Users/mainframe/Desktop/projects/Juggernaut/scripts/macos_clean_machine_smoke.sh)

## Required Version Bump

These versions must match:

- [desktop/package.json](/Users/mainframe/Desktop/projects/Juggernaut/desktop/package.json)
- [desktop/src-tauri/tauri.conf.json](/Users/mainframe/Desktop/projects/Juggernaut/desktop/src-tauri/tauri.conf.json)
- [desktop/src-tauri/Cargo.toml](/Users/mainframe/Desktop/projects/Juggernaut/desktop/src-tauri/Cargo.toml)

## GitHub Secrets

Preferred secret names:

- `JUGGERNAUT_RELEASE_TOKEN`
- `JUGGERNAUT_HOMEBREW_TAP_TOKEN`

Legacy fallback names still supported:

- `BROOD_RELEASE_TOKEN`
- `BROOD_HOMEBREW_TAP_TOKEN`

Apple signing/notarization secrets:

- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

## Release Checklist

1. Bump versions in the three files above.
2. Update [CHANGELOG.md](/Users/mainframe/Desktop/projects/Juggernaut/CHANGELOG.md).
3. Run `./scripts/release_check.sh`.
4. Commit the release changes.
5. Tag and push: `git tag vX.Y.Z` then `git push origin vX.Y.Z`.
6. Wait for the `publish` workflow to finish.
7. Verify the draft release contains a Juggernaut DMG.
8. Verify the Homebrew sync step if you are still using the legacy tap automation.

## Current Caveats

- The native engine binary still ships under the internal resource name `brood-rs`.
- Some Homebrew automation is still legacy-named while the app/product identity has moved to Juggernaut.
- The release pipeline now targets Juggernaut artifact naming, but the tap migration itself is still an operational follow-up.

## Notarization Notes

If notarization fails around `Contents/Resources/resources/brood-rs`, confirm:

- `APPLE_SIGNING_IDENTITY` was detected in CI
- [scripts/stage_rust_engine_binary.sh](/Users/mainframe/Desktop/projects/Juggernaut/scripts/stage_rust_engine_binary.sh) ran during the Tauri build
- the staged `brood-rs` resource was signed before notarization
