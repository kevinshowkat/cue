# Local Magic Select Runtime

This note keeps the local prepared Magic Select path consistent across the app, tests, and benchmark tooling.

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

The prepared-image flow exists so repeated clicks on the same image can reuse a deterministic local prep step instead of recomputing state every time.
