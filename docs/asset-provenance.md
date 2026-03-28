# Asset Provenance

This file records which bundled assets were kept for the public repo and which asset groups were removed before open-sourcing.

## Removed Before Public Launch

The following content was removed from the publishable tree because redistribution rights were unclear or the assets were not necessary for the public launch:

- `images/**`
- `media/**` except for the documented README demo asset below
- `docs/handoffs/**`
- `docs/assets/**`

## Retained In Public Tree

The public repo keeps only assets required for the application shell, onboarding, or documented product behavior under `desktop/src/assets/**`.

Current retained categories:

- app branding assets used by the shipped desktop shell
- bundled onboarding media used directly by the app
- generated rail icon packs used by the desktop UI
- the trimmed product demo GIF shipped at `media/features/readme/cue_readme_fast.gif` for README use

## Maintainer Rule

Do not add third-party or unclear-provenance sample media to the public tree unless redistribution rights are explicit and documented in this file.
