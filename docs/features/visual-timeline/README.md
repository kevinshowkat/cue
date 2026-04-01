# Visual Timeline

The visual timeline is the saved history for one session tab.

For the rewrite baseline, Bridge should bind to the Rust domain contracts in
`rust_engine/crates/brood-contracts/src/runs`, not to the legacy JS snapshot
serializer in `desktop/src/session_snapshot.js`.

## What It Does

- records committed visible changes
- lets the user jump backward or forward in that history
- survives save and reopen without rerunning earlier work

## Stored Data

- canonical session state is written to `session.json`
- canonical timeline state is written to `session-timeline.json`
- each timeline node stores a typed restore snapshot reference, receipt lineage,
  and preview references
- export uses the currently selected timeline head
- legacy `juggernaut-session.json` plus legacy `session-timeline.json` remain
  read-only adapter inputs for reopen compatibility

## Canonical Contracts

- `cue.session.v1`
  Stores the saved tab label, run id, image records, active and selected image
  ids, canvas mode and view state, restore-safe overlay state, and timeline
  pointers.
- `cue.timeline.v1`
  Stores the ordered restore points for a run: node id, sequence number,
  created-at timestamp, action metadata, parentage, preview references, receipt
  references, and an inline canonical session snapshot.
- `receipt`
  Receipts stay compatible with the existing provider payloads, but the typed
  contract now exposes `receipt_kind`, a canonical `artifact` record, optional
  timeline lineage, and source artifact references for Bridge-facing lineage.
- run layout
  New steady-state writes live under `~/cue_runs/<run_id>/` with explicit
  `session.json`, `session-timeline.json`, `events.jsonl`, `inputs/`,
  `artifacts/`, and `receipts/` paths.

## Locked Filenames

- `session.json`
  The only steady-state canonical session document filename.
- `session-timeline.json`
  The only steady-state canonical timeline document filename.
- `juggernaut-session.json`
  Legacy read-only reopen input. Do not write this filename on the steady-state
  path.
- `events.jsonl`
  Canonical event stream filename for a run.

## Locked Minimum Fields

- `cue.session.v1`
  Minimum locked top-level fields: `schema`, `version`, `run_id`, `saved_at`,
  `state`, `timeline`, `save_state`.
- `cue.session.v1.state`
  Minimum locked fields: `active_image_id`, `selected_image_ids`, `images`,
  `canvas`, `overlays`.
- `cue.session.v1.state.images[*]`
  Minimum locked fields: `image_id`, `path`; supported canonical lineage fields:
  `artifact_id`, `kind`, `label`, `width`, `height`, `timeline_node_id`,
  `source_receipt_path`.
- `cue.session.v1.timeline`
  Minimum locked fields: `head_node_id`, `latest_node_id`, `next_seq`.
- `cue.session.v1.save_state`
  Minimum locked field: `dirty`.
- `cue.timeline.v1`
  Minimum locked top-level fields: `schema`, `version`, `run_id`,
  `head_node_id`, `latest_node_id`, `next_seq`, `updated_at`, `nodes`.
- `cue.timeline.v1.nodes[*]`
  Minimum locked fields: `node_id`, `seq`, `created_at`, `kind`, `action`,
  `label`, `detail`, `parents`, `image_ids`, `preview_image_id`, `preview_path`,
  `receipt_paths`, `snapshot_ref`.
- `cue.timeline.v1.nodes[*].snapshot_ref`
  Minimum locked fields: `kind`, `snapshot`.

Only these fields should be treated as the canonical cross-tab contract. Extra
UI-local fields are not locked unless Domain publishes them here first.

## Canvas Alignment Status

- filenames
  Signed off. Canvas should write `session.json` and `session-timeline.json`.
- `cue.session.v1`
  Not signed off yet for steady-state writes. Canvas currently duplicates
  timeline nodes inside `session.json` under `timeline.nodes`. Canonical
  `cue.session.v1` only permits timeline pointers in that object. Required
  change: keep reading embedded `timeline.nodes` for compatibility, but stop
  writing them on the canonical path.
- `cue.timeline.v1`
  Not signed off yet for steady-state writes. Canvas currently writes
  `visual_mode` into timeline nodes even though `visual_mode` is not part of the
  published canonical Domain contract. Required change: either stop writing
  `visual_mode` in canonical timeline output, or land a Domain contract update
  that explicitly publishes it before downstream tabs rely on it.

## Reopen Acceptance Proof

- authoring path
  `desktop/test/tabbed_sessions_v1_contract.test.js`
- verify queue entry
  `proof.shell.tabbed_sessions_v1` in
  `scripts/rewrite_verification_queue.mjs`
- minimum acceptance cases
  `Open Run` must probe canonical `session.json` and `session-timeline.json`
  first.
- minimum acceptance cases
  If canonical files are absent, reopen must fall back to
  `juggernaut-session.json` plus legacy `session-timeline.json` through the
  adapter path.
- minimum acceptance cases
  Reopen must preserve the current tab, create a new tab, restore the selected
  run, and show the saved-timeline or saved-session reopen path explicitly.

## Adapter Boundary

- legacy session reopen reads `juggernaut-session.json`
- legacy timeline reopen reads `session-timeline.json`
- the adapter normalizes legacy serialized `Map` and `Set` wrappers into plain
  JSON before mapping them into the canonical session and timeline documents
- the adapter never writes legacy shapes back out

## Main Files

- `desktop/src/session_timeline.js`
- `desktop/src/session_snapshot.js`
- `desktop/src/canvas_app.js`
- `desktop/src/index.html`
- `desktop/src/styles.css`
- `rust_engine/crates/brood-contracts/src/runs/session.rs`
- `rust_engine/crates/brood-contracts/src/runs/timeline.rs`
- `rust_engine/crates/brood-contracts/src/runs/legacy.rs`
- `rust_engine/crates/brood-contracts/src/runs/receipts.rs`
