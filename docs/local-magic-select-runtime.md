# Local Magic Select Runtime

This document replaces the removed private runbook with the public contract surface needed to maintain Cue's local Magic Select path.

Contract: `juggernaut.magic_select.local.prepared.v1`

Browser-side helpers:

- `prepareLocalMagicSelectImage`
- `runWarmLocalMagicSelectClick`
- `releaseLocalMagicSelectImage`
- `evictLocalMagicSelectImage`

Native command names:

- `prepare_local_magic_select_image`
- `run_local_magic_select_warm_click`
- `release_local_magic_select_image`

Prepared-runtime action names:

- `magic_select_prepare`
- `magic_select_warm_click`
- `magic_select_release`

Prepared runtime responses must preserve:

- `preparedImageId`
- `preparedImage`
- `warnings`
- `details` when present

The prepared-image flow exists so repeated clicks on the same image can reuse a deterministic local prep step instead of recomputing the runtime state for every interaction.
