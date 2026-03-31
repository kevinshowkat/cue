# Cue Local Model Packs Implementation Plan

## Purpose

Define a concrete `Cue` implementation for monetizing local model weights such as Magic Select while preserving:

- local-first execution after install
- deterministic reproducibility for model-backed actions
- a simple fixed-fee purchase story
- clean future extension to additional local model packs

This plan assumes the business model is a one-time per-developer fee to unlock a local model pack download. After install, the feature should run offline on that machine without repeated login prompts or per-launch checks.

## Product Shape

### User-Facing Offer

`Cue` sells installable local model packs instead of shipping premium weights inside the app bundle.

Initial pack examples:

- `Cue Magic Select Pack`
- `Cue Vision Pack`
- `Cue Studio Pack`

Suggested launch sequence:

1. Ship one pack first: `Cue Magic Select Pack`.
2. Reuse the same entitlement and install substrate for future weights.
3. Keep the free app usable without the pack.

### What The User Sees

If the user invokes a locked tool:

- `Cue` shows an install sheet instead of a hard error.
- The sheet explains what the pack unlocks, price, size, and offline behavior.
- The user purchases once, installs once, and then the tool runs locally.

If the pack is already installed:

- the tool launches directly
- no shell env setup is required
- no repeated paywall prompt is shown

### Product Constraints

- This is licensed distribution, not perfect DRM.
- Once a model file is installed locally, determined copying cannot be fully prevented.
- The value proposition is convenience, packaging, updates, entitlement sync, and official support.
- If a future model requires strict access control, that model must stay server-side.

## Goals

- Remove manual env/export setup from the normal user path.
- Make local premium model install feel first-party inside `Cue`.
- Keep model versioning explicit so run receipts remain reproducible.
- Support offline use after a successful install.
- Keep the design generic enough to support more packs without inventing a second system.

## Non-Goals

- Perfect local DRM
- Per-launch online license checks
- Shipping premium weights inside the base app bundle
- Auto-upgrading model versions without user consent
- Storing payment or account secrets in run receipts

## High-Level Architecture

`Cue` should introduce a `Local Model Pack Manager` in the Tauri layer.

Responsibilities:

- query installed packs
- query entitlement state
- download pack manifests
- verify signatures and hashes
- install pack assets into `~/.cue`
- expose runtime resolution for tools such as Magic Select

Primary layers:

1. Desktop UI
2. Tauri commands
3. Pack manager service
4. Entitlement API
5. CDN/object storage for pack payloads
6. Local installed pack registry under `~/.cue`

## UI Plan

### Settings Surface

Add `Settings > Local Models`.

Each pack card should show:

- pack name
- short capability summary
- status: `Locked`, `Available`, `Installed`, `Update available`, `Install failed`
- installed version, if present
- disk size
- one-time price
- install or remove action

### Tool Entry Surface

When a tool depends on a missing premium pack:

- keep the tool visible
- show a compact `Unlock` or `Install` affordance
- explain that execution is local after install

For Magic Select specifically:

- if pack installed: run current local flow
- if pack not installed: show `Unlock Magic Select`
- if install is in progress: show progress and disable duplicate requests
- if install failed: show retry plus the failure reason

### Purchase And Install Sheet

Minimum contents:

- pack name
- one-line capability summary
- price
- file size
- supported platforms
- offline-after-install statement
- deterministic receipt statement
- install button

Suggested call to action:

- `Unlock And Install`

### Update UX

If a newer pack version exists:

- keep current installed version usable
- offer a clear `Update` action
- never switch versions silently
- explain that future runs will record the new model revision

## Entitlement Schema

Entitlements should be machine-activatable but not embedded in run receipts.

Suggested signed entitlement payload:

```json
{
  "schema_version": 1,
  "entitlement_id": "entl_01JXYZ...",
  "account_id": "acct_01JXYZ...",
  "pack_id": "cue.magic-select",
  "license_type": "one_time_per_developer",
  "status": "active",
  "granted_at": "2026-03-31T22:00:00Z",
  "expires_at": null,
  "seat_limit": 2,
  "activation_id": "act_01JXYZ...",
  "machine_binding": {
    "machine_fingerprint": "sha256:...",
    "platform": "macos"
  },
  "allowed_versions": ">=1.0.0 <2.0.0",
  "signature": {
    "alg": "ed25519",
    "key_id": "cue-entitlements-2026-01",
    "sig": "base64..."
  }
}
```

Rules:

- `Cue` should validate the signature locally.
- `Cue` should cache the entitlement locally after first activation.
- Offline use should continue as long as the cached entitlement is valid for the installed pack.
- A revoked entitlement should block future installs and updates, not retroactively break existing receipt history.

Suggested Tauri-side local entitlement record:

```json
{
  "schema_version": 1,
  "pack_id": "cue.magic-select",
  "activation_id": "act_01JXYZ...",
  "status": "active",
  "granted_at": "2026-03-31T22:00:00Z",
  "last_validated_at": "2026-03-31T22:02:00Z",
  "entitlement_sha256": "sha256:...",
  "installed_version": "1.0.0"
}
```

## Pack Manifest Schema

Each downloadable pack should include a signed manifest separate from the entitlement.

Suggested manifest:

```json
{
  "schema_version": 1,
  "pack_id": "cue.magic-select",
  "pack_version": "1.0.0",
  "display_name": "Cue Magic Select Pack",
  "runtime_kind": "local_python_worker",
  "models": [
    {
      "model_id": "mobile_sam_vit_t",
      "model_revision": "sha256:6dbb90523a35",
      "entry_path": "models/mobile_sam.pt",
      "sha256": "6dbb90523a35...",
      "bytes": 40321012
    }
  ],
  "helper": {
    "kind": "bundled_repo_helper",
    "relative_path": "scripts/magic_select_mobile_sam.py"
  },
  "minimum_app_version": "0.2.4",
  "supported_platforms": [
    "macos-aarch64",
    "macos-x86_64",
    "windows-x86_64",
    "linux-x86_64"
  ],
  "signature": {
    "alg": "ed25519",
    "key_id": "cue-packs-2026-01",
    "sig": "base64..."
  }
}
```

Rules:

- The manifest is what the runtime trusts for installed pack metadata.
- The manifest must pin exact hashes.
- The manifest must pin exact model revision strings used in receipts.
- The manifest must be immutable once released.

## On-Disk Layout

Canonical layout under the user home directory:

```text
~/.cue/
  licenses/
    cue.magic-select.entitlement.json
    cue.vision.entitlement.json
  models/
    packs/
      cue.magic-select/
        1.0.0/
          manifest.json
          models/
            mobile_sam.pt
      cue.vision/
        1.0.0/
          manifest.json
          models/
            vision-core.safetensors
  state/
    model-packs-lock.json
    model-pack-installs.json
  cache/
    pack-downloads/
      cue.magic-select-1.0.0.zip
```

Conventions:

- only one active installed version per pack at first launch of this system
- older versions may remain on disk until user cleanup is implemented
- `state/model-pack-installs.json` is the quick lookup index for installed packs
- the manifest on disk is the source of truth for runtime resolution

Suggested install index:

```json
{
  "schema_version": 1,
  "packs": {
    "cue.magic-select": {
      "status": "installed",
      "active_version": "1.0.0",
      "installed_at": "2026-03-31T22:05:00Z",
      "manifest_path": "/Users/alice/.cue/models/packs/cue.magic-select/1.0.0/manifest.json"
    }
  }
}
```

## Download And Install Flow

### End-To-End Flow

1. User clicks `Unlock And Install`.
2. `Cue` opens checkout or account confirmation.
3. Backend returns a signed entitlement.
4. `Cue` requests the signed pack manifest.
5. `Cue` downloads the pack archive from object storage/CDN.
6. `Cue` verifies archive checksum.
7. `Cue` unpacks into a temporary install directory.
8. `Cue` verifies each file hash against the manifest.
9. `Cue` atomically moves the pack into `~/.cue/models/packs/...`.
10. `Cue` writes the local install index.
11. `Cue` refreshes tool availability in the UI.

### Tauri Commands

Suggested command surface:

- `list_model_packs`
- `get_model_pack_status`
- `begin_model_pack_checkout`
- `activate_model_pack_entitlement`
- `install_model_pack`
- `remove_model_pack`
- `refresh_model_pack_entitlements`

Suggested install request:

```json
{
  "pack_id": "cue.magic-select",
  "requested_version": "1.0.0",
  "activation_token": "opaque-token-from-backend"
}
```

Suggested install response:

```json
{
  "ok": true,
  "pack_id": "cue.magic-select",
  "pack_version": "1.0.0",
  "installed_manifest_path": "/Users/alice/.cue/models/packs/cue.magic-select/1.0.0/manifest.json",
  "installed_model_ids": [
    "mobile_sam_vit_t"
  ],
  "warnings": []
}
```

### Failure Handling

Install must fail safely when:

- entitlement signature is invalid
- manifest signature is invalid
- archive checksum is wrong
- unpacked file hashes do not match
- disk space is insufficient
- the app version is below `minimum_app_version`

On failure:

- keep prior installed version untouched
- keep partial temp files outside the active install path
- surface a short user-facing error plus a detailed log entry

## Runtime Resolution Plan

Magic Select should stop depending on raw env vars for the normal path.

New resolution order:

1. installed pack manifest under `~/.cue/models/packs/`
2. `~/.cue/.env` overrides for development or manual repair
3. explicit `CUE_MAGIC_SELECT_*` env vars
4. legacy compatibility fallbacks

For Magic Select:

- `pack_id`: `cue.magic-select`
- `model_id`: `mobile_sam_vit_t`
- helper remains the repo-bundled helper unless the pack later requires a bundled runtime helper

This lets the current runtime in [main.rs](/Users/mainframe/Desktop/projects/Juggernaut/desktop/src-tauri/src/main.rs) evolve without changing the tool-facing contract.

## Receipt Format

Run receipts must capture enough provenance to reproduce what ran without exposing billing details.

### Required Additions

For any action using an installed local pack, add these fields inside the existing `reproducibility` block:

- `model_pack_id`
- `model_pack_version`
- `model_asset_sha256`
- `model_install_source`
- `entitlement_mode`

Example:

```json
{
  "reproducibility": {
    "runtime": "local_magic_select_worker",
    "runtime_id": "local_magic_select_mobile_sam_v1",
    "model_id": "mobile_sam_vit_t",
    "model_revision": "sha256:6dbb90523a35",
    "model_pack_id": "cue.magic-select",
    "model_pack_version": "1.0.0",
    "model_asset_sha256": "6dbb90523a35...",
    "model_install_source": "cue_pack_manager",
    "entitlement_mode": "paid_local_pack"
  }
}
```

### Fields That Must Not Enter Receipts

- account id
- activation token
- payment status payload
- signed entitlement blob
- download URL

### Why This Is Enough

This preserves:

- which model ran
- which exact bytes backed that run
- which pack version supplied it
- whether the action used the installed pack path versus a developer override

That is enough for reproducibility and support triage without leaking billing state into run artifacts.

## Service-Side Requirements

The backend only needs a narrow surface:

- create checkout session
- confirm purchase
- issue signed entitlement
- return signed manifest for an entitled pack
- issue short-lived download URL
- revoke or deactivate an activation

Recommended storage model:

- `accounts`
- `purchases`
- `entitlements`
- `activations`
- `pack_versions`

Recommended signing split:

- one signing key family for entitlements
- one signing key family for manifests

## Security And Abuse Model

Defend against:

- casual unauthorized downloads
- tampered archives
- tampered manifests
- stale or forged local entitlement files

Do not pretend to defend against:

- determined local extraction after install
- binary patching by an advanced attacker
- copying an already-installed raw weight file to another machine

Practical mitigation options:

- machine activation limits
- signed manifests
- short-lived download URLs
- telemetry on install and update events, if enabled
- support policy rather than heavy local DRM

## Rollout Plan

### Phase 1

Build the substrate for one pack only:

- pack manager in Tauri
- install index under `~/.cue`
- pack manifest verification
- Settings UI for one locked and one installed state

### Phase 2

Move Magic Select onto installed packs:

- resolve weights from pack manager
- keep current env vars as fallback overrides
- add receipt provenance fields

### Phase 3

Add commerce plumbing:

- checkout
- entitlement issuance
- install flow
- activation restore on second machine

### Phase 4

Generalize for future packs:

- shared pack registry UI
- update handling
- remove/reinstall flows

## Recommended File Ownership

Likely implementation seams:

- `desktop/src/`
  - Settings UI
  - unlock/install sheet
  - tool-state affordances
- `desktop/src-tauri/src/main.rs`
  - initial pack manager commands
  - runtime resolution changes
- `docs/runbooks/LOCAL_MAGIC_SELECT_RUNTIME.md`
  - migrate from env-first to pack-first setup docs
- `docs/desktop.md`
  - document Local Models settings surface and offline-after-install behavior

If the pack manager grows, split it out of `main.rs` into a dedicated Tauri module rather than leaving the install logic embedded in the command root.

## Open Questions

- Whether one-time purchases are per developer, per machine, or per studio seat
- Whether pack updates are free forever or only within a major version line
- Whether certain future models should be included in a bundle rather than sold separately
- Whether the backend should support air-gapped manual license import for enterprise users
- Whether pack removal should also prune cached artifacts and inactive versions

## Recommendation

Start with `Cue Magic Select Pack` only.

That is the smallest credible wedge because:

- the runtime already exists
- the model artifact is already known
- the value is visible to users
- the receipt surface already has a place for reproducibility metadata

Once that works, reuse the same infrastructure for every future local premium weight instead of shipping tool-specific install logic.
