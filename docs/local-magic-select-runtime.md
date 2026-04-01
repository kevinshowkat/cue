# Local Magic Select Runtime

Cue has two Magic Select paths:

- local weights-backed segmentation, which gives the improved click behavior
- coarse fallback candidates, which show up as the blue rectangles when the local runtime is unavailable

## Quick Setup

Run these commands from the repo root:

```bash
./scripts/setup_local_magic_select.sh
./scripts/dev_desktop_magic_select.sh
```

By default, the setup script creates:

- `./.venv-magic-select` for the Python runtime
- `./.local/models/mobile_sam.pt` for the local MobileSAM weights

Preferred environment names:

- `CUE_MAGIC_SELECT_PYTHON`
- `CUE_MAGIC_SELECT_HELPER`
- `CUE_MAGIC_SELECT_MODEL_PATH`
- `CUE_MAGIC_SELECT_MODEL_ID`
- `CUE_MAGIC_SELECT_MODEL_REVISION`
- `CUE_MAGIC_SELECT_THREADS`
- `CUE_MAGIC_SELECT_IMAGE_CACHE_SIZE`

Legacy aliases that still work:

- `JUGGERNAUT_MAGIC_SELECT_PYTHON`
- `JUGGERNAUT_MAGIC_SELECT_HELPER`
- `JUGGERNAUT_MAGIC_SELECT_MODEL_PATH`
- `JUGGERNAUT_MAGIC_SELECT_MODEL_ID`
- `JUGGERNAUT_MAGIC_SELECT_MODEL_REVISION`
- `JUGGERNAUT_MAGIC_SELECT_THREADS`
- `JUGGERNAUT_MAGIC_SELECT_IMAGE_CACHE_SIZE`

## Runtime Contract

This note keeps the local prepared Magic Select path consistent across the app, tests, and benchmark tooling.

Contract: `juggernaut.magic_select.local.prepared.v1`

Baseline:

- Magic Select remains first-class and local-first.
- The current rewrite milestone is the macOS screenshot-polish baseline.
- Windows-specific runtime notes are secondary and must not block the macOS path.

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

Bridge-owned host install seam:

- `install_desktop_model_pack`
- request contract: `cue.desktop.model-pack.install.v1`
- action: `pack.install`
- first shipping pack id: `cue.magic-select`

Bridge-owned host status and update surface:

- `desktop_model_pack_status`
- request contract: `cue.desktop.model-pack.install.v1`
- status action: `pack.status`
- update contract: `cue.desktop.model-pack.update.v1`
- update event: `cue-desktop-model-pack-update`
- update kind: `model_pack`
- `pack.status` snapshots and `pack.install` progress both resolve to the same pack identity: `cue.magic-select`
- update payload publishes `pack.packId`, `pack.packVersion`, `pack.status`, `pack.manifestPath`, `pack.modelIds`, `pack.warnings`
- update payload publishes `progress.phase`, `progress.completedBytes`, `progress.totalBytes`, and `detail`

The local Magic Select JS runtime should call the Bridge-owned host install seam before
`prepare_local_magic_select_image` and `run_local_magic_select_click`. `Canvas` and
`Inference` should not install packs by reading `~/.cue` manifests directly.

Bridge and run-contract alignment:

- JS callers may provide the active run either as legacy top-level `runDir` or as bridge-style `session.runDir`.
- Prepared-image handles now retain the canonical run-path layout that matches the Domain contracts:
  - `session.json`
  - `juggernaut-session.json`
  - `session-timeline.json`
  - `events.jsonl`
  - `artifacts/`
  - `receipts/`
- New prepared and direct-click requests should carry a stable `runDir` plus `stableSourceRef` so receipts stay tied to a real Cue run instead of an ad hoc temp path.

Runtime-resolution policy:

- Preferred resolution order for local Magic Select is:
  1. installed pack manifest
  2. `~/.cue/.env`
  3. explicit `CUE_MAGIC_SELECT_*`
  4. legacy `JUGGERNAUT_MAGIC_SELECT_*`
- The first shipping pack id is `cue.magic-select`.
- The first planned model id stays `mobile_sam_vit_t`.
- The JS runtime should preserve optional host-provided resolution metadata rather than dropping it:
  - `runtime`
  - `runtimeId`
  - `imageHash`
  - `modelId`
  - `modelRevision`
  - `modelPackId`
  - `modelPackVersion`
  - `modelAssetSha256`
  - `modelInstallSource`
  - `entitlementMode`
  - `manifestPath`
  - `modelPath`
  - `helperPath`
  - `resolutionSource`
  - `resolutionOrder`

Prepared runtime responses must preserve:

- `preparedImageId`
- `preparedImage`
- `warnings`
- `details` when present

Prepared-image handles should also preserve host resolution provenance when Bridge provides it:

- `runDir`
- `runPaths`
- `runtime`
- `runtimeId`
- `imageHash`
- `modelId`
- `modelRevision`
- `modelPackId`
- `modelPackVersion`
- `modelAssetSha256`
- `modelInstallSource`
- `entitlementMode`
- `manifestPath`
- `modelPath`
- `helperPath`
- `resolutionSource`
- `resolutionOrder`
- `runtimeResolution`

The prepared-image flow exists so repeated clicks on the same image can reuse a deterministic local prep step instead of recomputing state every time.

## Canvas Consumer Contract

`Canvas` should treat the prepared Magic Select runtime as an owned local-runtime seam, not as ad hoc image cache state.

### Canonical prepare request

`Canvas` should call `prepareLocalMagicSelectImage` with this shape:

```json
{
  "imageId": "img_123",
  "imagePath": "/absolute/path/to/source.png",
  "session": {
    "runDir": "/Users/alice/cue_runs/run_123"
  },
  "sourceReceiptPath": "/Users/alice/cue_runs/run_123/receipts/import.json",
  "source": "communication_magic_select"
}
```

Rules:

- Prefer `session.runDir` over a top-level `runDir` when Canvas already has the Bridge-style session envelope.
- Always pass a stable source reference rooted in the current run. `sourceReceiptPath` is the preferred Canvas-side input alias.
- Do not prepare against a temp-only image without a real run directory.

### Canonical prepared-image handle

`Canvas` may cache the returned `preparedImage`, but it should only depend on these consumer-stable fields:

```json
{
  "id": "magic-select-prepared-123",
  "imageId": "img_123",
  "imagePath": "/absolute/path/to/source.png",
  "runDir": "/Users/alice/cue_runs/run_123",
  "runPaths": {
    "runDir": "/Users/alice/cue_runs/run_123",
    "sessionPath": "/Users/alice/cue_runs/run_123/session.json",
    "legacySessionPath": "/Users/alice/cue_runs/run_123/juggernaut-session.json",
    "timelinePath": "/Users/alice/cue_runs/run_123/session-timeline.json",
    "eventsPath": "/Users/alice/cue_runs/run_123/events.jsonl",
    "artifactsDir": "/Users/alice/cue_runs/run_123/artifacts",
    "receiptsDir": "/Users/alice/cue_runs/run_123/receipts"
  },
  "stableSourceRef": "/Users/alice/cue_runs/run_123/receipts/import.json",
  "source": "communication_magic_select",
  "settings": {
    "maskThreshold": 127,
    "maxContourPoints": 256
  },
  "preparedAt": 1712345678901,
  "lastUsedAt": 1712345679901,
  "expiresAt": 1712349279901,
  "useCount": 3,
  "warnings": [],
  "runtime": "local_magic_select_worker",
  "runtimeId": "tauri_mobile_sam_python_worker_cpu",
  "imageHash": "sha256:...",
  "modelId": "mobile_sam_vit_t",
  "modelRevision": "sha256:...",
  "modelPackId": "cue.magic-select",
  "modelPackVersion": "1.0.0",
  "modelAssetSha256": "sha256:...",
  "modelInstallSource": "cue_pack_manager",
  "entitlementMode": "paid_local_pack",
  "runtimeResolution": {
    "resolutionSource": "installed_pack_manifest",
    "resolutionOrder": [
      "installed_pack_manifest",
      "cue_home_env",
      "cue_env",
      "legacy_env"
    ]
  }
}
```

Rules:

- `Canvas` should key the prepared handle by `imageId` plus `runDir`.
- `Canvas` should invalidate and release the handle when either `imagePath` or `runDir` changes.
- `Canvas` should pass the whole `preparedImage` back into warm-click and release calls instead of reconstructing it.
- `Canvas` should treat all runtime-resolution and pack fields as pass-through provenance, not UI-owned state.

### Canonical warm-click response

`Canvas` should consume this result shape from `runWarmLocalMagicSelectClick` or `runLocalMagicSelectClick`:

```json
{
  "ok": true,
  "contract": "juggernaut.magic_select.local.prepared.v1",
  "action": "magic_select_warm_click",
  "imageId": "img_123",
  "candidate": {
    "id": "candidate_1",
    "label": "Magic Select",
    "bounds": { "x": 10, "y": 20, "w": 120, "h": 90 },
    "contourPoints": [{ "x": 10, "y": 20 }],
    "polygon": [{ "x": 10, "y": 20 }],
    "maskRef": {
      "path": "/Users/alice/cue_runs/run_123/artifacts/mask.png",
      "sha256": "sha256:...",
      "width": 120,
      "height": 90,
      "format": "png"
    },
    "confidence": 0.94,
    "source": "local_model:mobile_sam_vit_t"
  },
  "group": {
    "imageId": "img_123",
    "anchor": { "x": 42, "y": 80 },
    "candidates": [],
    "activeCandidateIndex": 0,
    "chosenCandidateId": "candidate_1",
    "updatedAt": 1712345679901,
    "reproducibility": {},
    "warnings": []
  },
  "receipt": {
    "path": "/Users/alice/cue_runs/run_123/receipts/magic-select.json",
    "reproducibility": {}
  },
  "warnings": [],
  "preparedImageId": "magic-select-prepared-123",
  "preparedImage": {}
}
```

Rules:

- `Canvas` should use `group` and `candidate` as the only deterministic selection payload.
- `Canvas` should copy `group.reproducibility` or `receipt.reproducibility` onto the communication region group without reinterpretation.
- On `magic_select_prepared_image_missing`, `magic_select_prepared_image_runtime_mismatch`, or stale run/image mismatches, `Canvas` should drop the cached handle and retry cold once.

### Canonical release request

`Canvas` should release with:

```json
{
  "preparedImage": { "id": "magic-select-prepared-123", "imageId": "img_123" },
  "imageId": "img_123",
  "reason": "canvas_closed"
}
```

Allowed `reason` values from the current Canvas behavior:

- `caller_release`
- `canvas_closed`
- `warm_click_failed`
- `prepare_task_stale`
- `run_dir_changed`
- `image_path_changed`

## Bridge Host Install Seam

Host-side local-pack installation is Bridge-owned. `Canvas` and `Inference` should not read `~/.cue` manifests or install indexes directly.

The needed Bridge seam is a typed host boundary, not PTY commands, file polling, or JS-side manifest parsing.

### Required Bridge contracts

```json
{
  "commandContract": "cue.desktop.host.command.v1",
  "updateContract": "cue.desktop.host.update.v1",
  "updateEvent": "cue-desktop-host-update"
}
```

### Required Bridge actions

`Bridge` should expose exactly these host actions first:

- `model_pack.status`
- `model_pack.install`
- `model_pack.remove`
- `model_pack.refresh`

### Canonical install request

```json
{
  "contract": "cue.desktop.host.command.v1",
  "requestId": "host-123",
  "action": "model_pack.install",
  "pack": {
    "packId": "cue.magic-select",
    "requestedVersion": "1.0.0"
  },
  "install": {
    "activationToken": "opaque-backend-token",
    "allowCachedEntitlement": true
  }
}
```

### Canonical status response or update payload

```json
{
  "contract": "cue.desktop.host.update.v1",
  "requestId": "host-123",
  "kind": "model_pack",
  "pack": {
    "packId": "cue.magic-select",
    "packVersion": "1.0.0",
    "status": "installed",
    "manifestPath": "/Users/alice/.cue/models/packs/cue.magic-select/1.0.0/manifest.json",
    "modelIds": ["mobile_sam_vit_t"],
    "warnings": []
  },
  "progress": {
    "phase": "installed",
    "completedBytes": 40321012,
    "totalBytes": 40321012
  }
}
```

Minimum statuses:

- `locked`
- `available`
- `installing`
- `installed`
- `update_available`
- `install_failed`

Minimum progress phases:

- `entitlement_check`
- `download`
- `verify`
- `install`
- `installed`

Boundary rules:

- `Bridge` owns resolution of `~/.cue/models/packs`, `state/model-pack-installs.json`, and entitlement cache state.
- `Inference` consumes only the typed pack status or install result metadata.
- `Canvas` consumes only install availability and progress state surfaced through `Bridge`.
- No new filesystem polling seam should be introduced for pack installation.

## Tools Routing Metadata Boundary

`Tools` should preserve routing metadata exactly, but it should not redefine inference semantics.

### Canonical routed metadata shape

This shape must survive through direct-affordance invocations, custom tool manifests, replay payloads, receipts, and Agent Run summaries:

```json
{
  "executionType": "local_first",
  "routeProfile": "polish_local_first",
  "routingStrategy": "local_first_with_model_fallback",
  "localRuntime": {
    "target": "single_image_local_edit",
    "resolutionOrder": [
      "installed_pack_manifest",
      "cue_home_env",
      "cue_env",
      "legacy_env"
    ],
    "available": true,
    "disabledReason": "capability_unavailable",
    "packId": "cue.magic-select",
    "packVersion": "1.0.0",
    "resolutionSource": "installed_pack_manifest",
    "baselinePlatform": "macos",
    "windowsStatus": "secondary"
  }
}
```

### Preservation rules

- `Inference` owns the enum values and the fallback policy.
- `Tools` must preserve `executionType`, `routeProfile`, `routingStrategy`, and `localRuntime` without renaming or collapsing them.
- `Tools` may copy this metadata into:
  - `tool`
  - `execution`
  - `route`
  - receipt or replay summaries
- `Tools` must not synthesize provider names, install paths, or new routing enums.
- `Tools` must not reinterpret `localRuntime.available` as proof that install is complete; only `Bridge` owns install truth.
- `Tools` may omit routed metadata only when the invocation is not a routed single-image capability or affordance.

### Current clean ownership split

- `Inference` owns the meaning of `routeProfile`, `routingStrategy`, `localRuntime.target`, and runtime-resolution order.
- `Tools` owns serialization and preservation of that metadata through manifests, invocations, replay, and receipts.
- `Canvas` owns passing current runtime availability into direct-affordance invocation builders once `Bridge` publishes host pack status.
