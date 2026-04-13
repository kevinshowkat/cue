# Cue Rewrite Parity Matrix

Status: Live kickoff tracker v0.1  
Last updated: 2026-04-01  
Owner: coordinator  
Active worktree: `/Users/mainframe/Desktop/projects/cue-rewrite-coordinator`  
Active branch: `codex/rewrite-coordinator`

## Purpose

This is the live signoff artifact for the rewrite wave inside the active `cue` rebuild worktree.

The read-only source material remains in the audit workspace, but this file is the editable tracker the coordinator should maintain during implementation.

## Primary Source Docs

- [desktop.md](desktop.md)
- [PRD.md](../PRD.md)
- [agent-runtime.md](agent-runtime.md)
- [agent-workflow-prd.md](agent-workflow-prd.md)
- [features/visual-timeline/README.md](features/visual-timeline/README.md)
- [features/shell-canvas-integration.md](features/shell-canvas-integration.md)
- [local-magic-select-runtime.md](local-magic-select-runtime.md)
- [legacy-internals.md](legacy-internals.md)
- [/Users/mainframe/Desktop/projects/juggernaut-rewrite-audit/docs/rewrite-from-scratch-audit.md](/Users/mainframe/Desktop/projects/juggernaut-rewrite-audit/docs/rewrite-from-scratch-audit.md)
- [/Users/mainframe/Desktop/projects/juggernaut-rewrite-audit/docs/decisions/0002-rust-first-rewrite.md](/Users/mainframe/Desktop/projects/juggernaut-rewrite-audit/docs/decisions/0002-rust-first-rewrite.md)

## Decision Rules

- `Baseline`: must exist in the rebuilt app for the initial rewrite baseline to count as done.
- `Release`: not required for the first rebuild baseline, but still part of the longer-term product or release bar.
- `Drop`: intentionally not carried into the rewrite baseline.
- `Re-approve`: not baseline by default; only include if product explicitly says yes.

If a behavior is visible in the current main Cue frontend and documented in the current product docs, default it to `Baseline`.

If a behavior is only present in old implementation carryover and not part of the documented visible Cue shell, default it to `Drop` or `Re-approve`.

## Live Tracking Rules

- `Owner` is the single accountable rewrite tab for landing the row.
- `Status` uses one of: `Planned`, `Decision needed`, `Deferred`, `Dropped`, `Done`.
- `Branch` is the implementation branch expected to land the row.
- `Proof artifact` should be a repo-relative test path, benchmark path, or acceptance note.
- `Blocker` stays blank unless the row cannot start cleanly yet.

## Active Wave Inventory

As of `2026-04-07`, the historical April 1 rewrite wave remains useful as
published handoff context, but the old snapshot at the top of this file was no
longer accurate.

- `codex/canvas-app-rewrite` in
  `/Users/mainframe/Desktop/projects/cue-canvas-app-rewrite` is now the active
  integration branch for the modular canvas runtime extraction.
- The newest integrated extraction commit is `2f0d4f7`
  (`Extract canvas app composition root into app modules`), and it is pushed to
  `origin/codex/canvas-app-rewrite`.
- The coordinator worktree is no longer the only dirty worktree.
  `cue-canvas-app-rewrite` and the `cue-canvas-rewrite-*` slice worktrees also
  carry local rewrite WIP.
- Treat the `Published Handoffs` section below as archive context for the first
  rewrite wave, not as a statement that current local worktrees are clean or
  that the merge queue is empty.

| Surface | Worktree | Branch | Current state | Current gate | Notes |
| --- | --- | --- | --- | --- | --- |
| Coordinator docs | `/Users/mainframe/Desktop/projects/cue-rewrite-coordinator` | `codex/rewrite-coordinator` | Dirty doc-only | Correct stale tracker and runbook state | Coordinator remains docs-only and should not absorb product-code integration work |
| Canvas app integration | `/Users/mainframe/Desktop/projects/cue-canvas-app-rewrite` | `codex/canvas-app-rewrite` | Active and pushed | Extraction branch is ready for PR review | Source of truth for the current modular extraction pass |
| Canvas slice worktrees | `/Users/mainframe/Desktop/projects/cue-canvas-rewrite-*` | `codex/canvas-rewrite-*` | Dirty local WIP | Reconcile or drop overlapping local edits | These worktrees overlap on `desktop/src/canvas_app.js` and should not be treated as merged state |
| Historical wave branches | `/Users/mainframe/Desktop/projects/cue-rewrite-*` | `codex/rewrite-*` | Historical published handoffs | Keep as archive context | Earlier contract and handoff work remains useful, but the top-of-file status claims are superseded by this correction |
| Main branch | `/Users/mainframe/Desktop/projects/cue` | `main` | Local branch ahead of `origin/main` | Unrelated local cleanup still exists | Do not use local `main` as proof that the modular extraction has merged |

## Published Handoffs

| Tab | Slice | Published handoff | Verification | Downstream effect |
| --- | --- | --- | --- | --- |
| 3 | Domain | Canonical run layout in `rust_engine/crates/brood-contracts/src/runs/paths.rs`, session contract in `rust_engine/crates/brood-contracts/src/runs/session.rs`, timeline contract in `rust_engine/crates/brood-contracts/src/runs/timeline.rs`, receipt lineage in `rust_engine/crates/brood-contracts/src/runs/receipts.rs`, legacy reopen adapter in `rust_engine/crates/brood-contracts/src/runs/legacy.rs`, typed bridge-facing events in `rust_engine/crates/brood-contracts/src/events.rs`, and contract summary in `docs/features/visual-timeline/README.md` | `cargo test -p brood-contracts` passed with `38` tests | Clears the old `Domain` contract publication blocker and becomes the contract source of truth for downstream slices |
| 4 | Bridge | Typed command schema id `cue.desktop.session.command.v1`, typed update schema id `cue.desktop.session.update.v1`, host bridge in `desktop/src-tauri/src/main.rs`, frontend protocol helpers in `desktop/src/canvas_protocol.js`, runtime seam changes in `desktop/src/canvas_app.js`, and bridge parsing in `desktop/src/jsonl_io.js` | Focused tests passed in the bridge worktree | Unblocks `Shell`, `Inference`, and `Canvas` to consume the typed app-core boundary |
| 2 | Shell | `desktop/src/tabbed_sessions.js`, `desktop/src/system_menu_state.js`, `desktop/src/index.html`, `desktop/src/styles.css`, and `desktop/src/canvas_app.js` now emit `session-tab-v1` summaries with `title`, `isActive`, `isBusy`, `isDirty`, and `schemaVersion` while preserving old aliases, mirror `Cue` menu entries for new or open or save or close or import or export or settings, and remove visible non-baseline `GUIDE`, `DEBUG`, and `AUTO` menu chrome | Focused `node --test` shell suite passed and `node --check` passed. `npm run build` did not complete because `vite` is missing in the environment | Confirms the shell is consuming the published contracts, but leaves one host-menu baseline mismatch upstream in `Bridge` |
| 5 | Inference | `desktop/src/magic_select_runtime.js`, `desktop/src/single_image_capability_routing.js`, `desktop/src/tool_runtime.js`, `docs/local-magic-select-runtime.md`, and `scripts/benchmark_magic_select_runtime.py` now accept bridge-style `session.runDir`, preserve local-first routing metadata in invocation envelopes, document pack resolution order as installed pack manifest, `~/.cue/.env`, `CUE_MAGIC_SELECT_*`, then legacy `JUGGERNAUT_*`, and publish the prepared `Magic Select` consumer contract reference shape that Canvas reports it now matches | Focused inference tests passed | Closes the contract-definition gap for `B1` and leaves only the host-side pack installation seam upstream-owned |
| 6 | Canvas | `desktop/src/canvas_protocol.js`, `desktop/src/canvas_app.js`, `desktop/src/canvas_handlers/install_canvas_input_handlers.js`, `desktop/src/juggernaut_shell/rail.js`, `desktop/src/effect_interactions.js`, `desktop/src/session_snapshot.js`, and `desktop/src/session_timeline.js` now speak the Bridge command envelope with legacy fallback, land the first input-binding extraction, preserve the rail baseline, write `cue.session.v1` to `session.json` while still reading `juggernaut-session.json`, write `cue.timeline.v1` while still reading the legacy timeline shape, always emit `nodes[*].snapshot_ref`, purge snapshot-less legacy nodes before canonical write, resolve `head_node_id` plus `latest_node_id` against the written node set, and align the consumer or routing behavior to the published prepared `Magic Select` reference shape | Focused canvas or session or review or rail tests passed, including `node --test test/session_timeline.test.js`. `npm run build` did not complete because `vite` is missing in the environment | Gives `Review`, `Tools`, and `Export` enough published canvas state to launch, closes the Canvas-side `B9` blocker pass with final `Domain` confirmation now received, closes the contract-definition gap for `B1`, and leaves only final bridge-update adoption open |
| 7 | Review | `desktop/src/design_review_contract.js`, `desktop/src/design_review_backend.js`, `desktop/src/design_review_provider_router.js`, `desktop/src/design_review_bootstrap.js`, `docs/agent-affordances.json`, and the focused review tests now normalize review-side schemas to Cue-prefixed ids, centralize the shared provider command, write planner-trace artifacts through shared contract constants, and advertise Cue review schemas plus the planner-trace artifact schema in the affordance manifest | `node --test` passed for `test/design_review_contract.test.js`, `test/design_review_pipeline.test.js`, `test/design_review_provider_router.test.js`, `test/design_review_bootstrap_runtime_state.test.js`, `test/design_review_memory.test.js`, `test/design_review_upload_analysis.test.js`, `test/canvas_app_review_apply_bridge.test.js`, and `test/action_provenance.test.js` | Publishes the review contract surface for downstream proof and merge-prep without opening any new coordinator blockers |
| 8 | Tools | `desktop/src/tool_runtime.js`, `desktop/src/local_tool_edits.js`, `desktop/src/tool_apply_runtime.js`, `desktop/src/agent_runner_runtime.js`, and `docs/agent-runtime.md` now preserve `routingStrategy` and `localRuntime` through direct-affordance invocations, custom manifests, deterministic replay plans, receipt steps, saved artifacts, and richer `Agent Run` session-tool summaries with `directAffordanceStates` | `node --check` passed for the touched runtime files and `node --test` passed for `desktop/test/tool_runtime_contract.test.js`, `desktop/test/local_tool_edits.test.js`, `desktop/test/tool_apply_bridge.test.js`, `desktop/test/agent_runner_runtime.test.js`, and `desktop/test/observable_agent_replay_flows.test.js`. Local `npm install --no-save --package-lock=false @tauri-apps/api@^1.5.0` was used for `Agent Run` tests with no tracked file changes | Publishes the tools runtime handoff and sets up the remaining merge-prep work around shared replay or apply contracts plus the `tool_runtime.js` overlap |
| 9 | Export | `desktop/src/juggernaut_export/contract.js`, `docs/psd-export-slice.md`, `desktop/test/export_psd_contract.test.js`, `desktop/test/menu.test.js`, `desktop/src/canvas_app.js`, and `desktop/src-tauri/src/main.rs` now use Cue export contracts and canonical run packaging, define baseline PSD plus PNG plus canonical `artifacts/` and `receipts/` helpers, add reserved hidden `.ai` or `.fig` hooks, retarget export requests in `canvas_app.js` to the canonical artifact layout, and make `main.rs` write canonical artifact or receipt payloads aligned to the Domain contract while reading legacy receipt locations too | `node --test` passed for `test/export_psd_contract.test.js`, `test/menu.test.js`, and `test/juggernaut_launch_slice_flow.test.js`. `cargo test export_` passed. Empty `desktop/dist/` was created locally so the Tauri context macro could build the test target | Publishes the export handoff, but keeps raster proof and the `canvas_app.js` or `main.rs` overlap surfaces under active coordinator management |
| 10 | Verify | Verification queue in `scripts/rewrite_verification_queue.mjs`, queue test in `desktop/test/rewrite_verification_queue.test.js`, release-check integration in `scripts/release_check.sh`, macOS smoke notes in `scripts/macos_clean_machine_smoke.sh`, published proof paths `proof.shell.tabbed_sessions_v1` -> `/Users/mainframe/Desktop/projects/cue-rewrite-shell/desktop/test/tabbed_sessions_v1_contract.test.js`, `proof.shell.native_system_menu_contract` -> `/Users/mainframe/Desktop/projects/cue-rewrite-shell/desktop/test/native_system_menu_contract.test.js`, `proof.export.export_raster_contract` -> `/Users/mainframe/Desktop/projects/cue-rewrite-export/desktop/test/export_raster_contract.test.js`, and `proof.domain.session_timeline_contract` -> `/Users/mainframe/Desktop/projects/cue-rewrite-canvas/desktop/test/session_timeline.test.js`, plus concrete integrated artifact output locations `benchmark.magic_select_runtime` -> `/Users/mainframe/Desktop/projects/cue-rewrite-verify/outputs/verification/benchmark.magic_select_runtime/benchmark.json` and `smoke.macos_clean_machine` -> `/Users/mainframe/Desktop/projects/cue-rewrite-verify/outputs/verification/smoke.macos_clean_machine/smoke.log` | Published in the verify worktree. `scripts/rewrite_verification_queue.mjs`, `docs/benchmark-playbook.md`, `RELEASING.md`, and `scripts/macos_clean_machine_smoke.sh` were updated for these mappings | Gives the wave a maintained proof queue for the fully merged rewrite. The coordinator remains the source of truth, and `B6` is the only open blocker left |

## Enforced Merge Order

Coordinator docs can merge whenever needed. Implementation branches merge in this order unless the coordinator records an explicit override in this file and in the runbook.

| Step | Slice | Branch | Merge gate |
| --- | --- | --- | --- |
| 1 | Domain | `codex/rewrite-domain` | Publish the first session, timeline, receipt, run-directory, and artifact schemas. No downstream branch should merge a competing version of those contracts first. |
| 2 | Bridge | `codex/rewrite-bridge` | Consume the `Domain` contract pass and land the typed app-core boundary that replaces PTY plus event-log polling on the shipping path. |
| 3 | Shell | `codex/rewrite-shell` | Bind tabs, menus, and titlebar actions to landed `Domain` and `Bridge` contracts instead of creating parallel state or transport seams. |
| 4 | Canvas | `codex/rewrite-canvas` | Bind the shared canvas and overlays to the landed `Shell` integration points and the typed `Bridge` boundary. |
| 5 | Inference | `codex/rewrite-inference` | Plug local runtime, capability routing, and pack resolution into the landed `Bridge` seam and the already-stable canvas consumer contract. |
| 6 | Review | `codex/rewrite-review` | Consume landed canvas state, provider-routing hooks, and artifact schemas before fixing the proposal or apply path. |
| 7 | Tools | `codex/rewrite-tools` | Build `Save Shortcut`, replay, and `Agent Run` on the now-stable apply, replay, and persistence contracts. |
| 8 | Export | `codex/rewrite-export` | Land packaging and format outputs after session, artifact, and apply shapes stop moving. |
| 9 | Verify | `codex/rewrite-verify` | Run parity, benchmark, and smoke validation against the integrated rewrite slices rather than mid-wave churn. |

## Dependency Inventory

| Downstream slice | Upstream slice | Required contract or artifact | Why it matters |
| --- | --- | --- | --- |
| Bridge | Domain | Session, timeline, receipt, and artifact schemas | The typed app-core boundary should carry durable runtime shapes instead of inventing a second schema family. |
| Shell | Domain | Session-tab, busy-state, and persistence lifecycle contracts | Titlebar and menu behavior depend on durable run and tab semantics. |
| Shell | Bridge | Typed commands and updates | The shell should bind to a typed boundary rather than a temporary PTY or polling seam. |
| Canvas | Shell | Stable tab lifecycle and titlebar integration points | Shared-canvas swapping and import flows should not back-drive shell state. |
| Canvas | Bridge | Typed command and update boundary | Overlay, import, and rail interactions should consume the new transport seam rather than the old one. |
| Canvas | Inference | Dynamic rail ranking output and prepared `Magic Select` runtime semantics | The canvas slice owns the visible affordances, but not the ranking or runtime policy. |
| Review | Domain | Receipt, planner-trace, and run-artifact schemas | Proposal and apply flows must write artifacts into the same durable lineage model. |
| Review | Canvas | Active image, mark, stamp, and region-candidate state contract | Review should consume shared interaction state rather than duplicate UI state tracking. |
| Tools | Domain | Deterministic replay and tool-manifest persistence shape | `Save Shortcut` and `Agent Run` need stable action lineage. |
| Tools | Review | Apply contract and accepted-proposal artifact shape | Tool capture should attach to the same accepted-edit contract that review uses. |
| Export | Domain | Artifact layout, run-directory, and receipt contract | Export packaging must write into the canonical run structure. |
| Export | Review | Accepted-edit outputs and provenance | Receipt-backed export depends on the applied edit lineage being stable. |
| Verify | Domain, Bridge, Shell, Canvas, Inference, Review, Tools, Export | Integrated proofs, benchmark artifacts, and smoke scripts | Verification only makes sense once the integrated path exists and the artifact locations are known. |

## Current Blockers And Contract Gaps

| ID | Owner | Gap | Affects | Severity | Coordinator action |
| --- | --- | --- | --- | --- | --- |
| B6 | Product | Windows-after-macOS milestone order remains an explicit but non-blocking product question. | Verify, Inference | Non-blocking release question | Track it, but do not let it delay the macOS-only screenshot-first baseline |

## Recently Closed Blockers And Proof Paths

| ID | Closed via | Proof id | Proof path |
| --- | --- | --- | --- |
| B1 | Cross-confirmed Canvas or Inference alignment on the published prepared `Magic Select` consumer contract and routing metadata shape | `proof.inference.magic_select_runtime_contract_alignment` | `/Users/mainframe/Desktop/projects/cue-rewrite-inference/desktop/src/magic_select_runtime.js` |
| B2 | Inference-side confirmation that the typed pack-install status or update gap is fully closed, with no new file changes or tests required in the confirmation pass | `proof.inference.pack_install_status_confirmation` | `/Users/mainframe/Desktop/projects/cue-rewrite-inference` |
| B3 | Verify proof-path publication for shell reopen coverage | `proof.shell.tabbed_sessions_v1` | `/Users/mainframe/Desktop/projects/cue-rewrite-shell/desktop/test/tabbed_sessions_v1_contract.test.js` |
| B4 | Verify proof-path publication for raster export coverage | `proof.export.export_raster_contract` | `/Users/mainframe/Desktop/projects/cue-rewrite-export/desktop/test/export_raster_contract.test.js` |
| B5 | Verify publication of concrete integrated artifact output locations | `proof.verify.integrated_artifact_locations` | `/Users/mainframe/Desktop/projects/cue-rewrite-verify/outputs/verification/benchmark.magic_select_runtime/benchmark.json` and `/Users/mainframe/Desktop/projects/cue-rewrite-verify/outputs/verification/smoke.macos_clean_machine/smoke.log` |
| B7 | Verify proof-path publication for native system menu coverage | `proof.shell.native_system_menu_contract` | `/Users/mainframe/Desktop/projects/cue-rewrite-shell/desktop/test/native_system_menu_contract.test.js` |
| B8 | Canvas-side closure after merging `Bridge` successfully from pre-merge commit `96ac196` into merge commit `1096072`, with `desktop_session_start`, `desktop_session_status`, `desktop_session_stop`, and direct `cue-desktop-session-update` consumption converged to the shipping path | `proof.canvas.bridge_shipping_path_merge` | `/Users/mainframe/Desktop/projects/cue-rewrite-canvas` |
| B9 | Domain full closure after the Canvas timeline patch with Verify queue mapping published | `proof.domain.session_timeline_contract` | `/Users/mainframe/Desktop/projects/cue-rewrite-canvas/desktop/test/session_timeline.test.js` |

## Next Merge-Prep Checkpoints

| Tab | Slice | Next expected merge-prep checkpoint |
| --- | --- | --- |
| 1 | Coordinator | Rewrite wave is fully merged to `main` at `c7766474e5d22b96bbe8e647454bb04c8dccd648`. Keep `B6` tracked, keep blocker truth in coordinator docs only, and run post-merge worktree cleanup in merge order. |
| 2 | Shell | Merged to `main` at `b98319d`. No further merge-prep action remains here. |
| 3 | Domain | Merged to `main` at `759424cf027519d7b209542b5d19f2c55ddf9bb6`. No further merge-prep action remains here. |
| 4 | Bridge | Merged to `main` at `8b647d165e00e36987a0bc1c1572865b87e656f4`. No further merge-prep action remains here. |
| 5 | Inference | Merged to `main` at `11ca6e3ded2452b01226bda377805fd8bde56fe0`. No further merge-prep action remains here. |
| 6 | Canvas | Merged to `main` at `26ccf6a478573a08ea80b4778b4e6b7c1acec07a`. No further merge-prep action remains here. |
| 7 | Review | Merged to `main` at `822120c`. No further merge-prep action remains here. |
| 8 | Tools | Merged to `main` at `e8def49e5d35f46ecf176c892b350d635f2c628e`. No further merge-prep action remains here. |
| 9 | Export | Merged to `main` at `78c45c7e64ed802a3f769af867f07088c89d62e4`. No further merge-prep action remains here. |
| 10 | Verify | Merged to `main` at `c7766474e5d22b96bbe8e647454bb04c8dccd648`. No further merge-prep action remains here. |

## Overlap Prevention And Integration Notes

- The coordinator branch is doc-only for this wave. It should not start product implementation.
- `Domain` owns session, timeline, receipt, run-directory, and artifact schemas.
- `Bridge` owns the typed app-core boundary, command or update schema, and PTY removal path.
- `Shell` owns tabs, titlebar, menus, and chrome, but not provider routing, review execution, or export packaging.
- `Canvas` owns visible gesture and overlay behavior, but not transport, review pipeline internals, or export writers.
- `Inference` owns provider routing, pack resolution, and `Magic Select` runtime policy, but it should consume the `Bridge` boundary rather than inventing a parallel host seam.
- `desktop/src/canvas_app.js` is an active overlap hotspot across `Shell`, `Bridge`, `Canvas`, and `Export`.
- `desktop/src-tauri/src/main.rs` is an active overlap hotspot across `Bridge` and `Export`.
- `desktop/src/canvas_protocol.js` is an active overlap hotspot across `Bridge` and `Canvas`.
- `desktop/src/tool_runtime.js` is an active overlap hotspot across `Inference` and `Tools`.
- `desktop/src/session_snapshot.js` and `desktop/src/session_timeline.js` are aligned to the published canonical shapes, but they remain a shared area to watch during merge-prep.
- Missing `vite` in some worktrees is an environment note only, not a scope blocker.
- `Review`, `Tools`, `Export`, and `Verify` must include handoff notes with changed files, tests run, unresolved blockers, and the next dependency needed.
- User-facing naming stays `Cue`.
- The active baseline is the macOS-only screenshot-polish slice. Windows and Linux remain honest roadmap or release work, not current coordinator scope.
- Native `.ai` and `.fig` work stays at architecture-hook level until the screenshot-first baseline is stable.

## Matrix

| Area | Feature | Visible in current main frontend | Current doc source | Rewrite target | Owner | Status | Branch | Proof expected | Proof artifact | Blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Shell | Single desktop window with one shared canvas and in-app session tabs | Yes | `desktop.md`, `PRD.md` | Baseline | Shell | Planned | `codex/rewrite-shell` | Desktop shell parity test | `desktop/test/tabbed_sessions_v1_contract.test.js` |  |
| Shell | Titlebar actions for `New session`, `Fork tab`, `Agent Run`, `Design Review`, `Export` | Yes | `desktop.md` | Baseline | Shell | Planned | `codex/rewrite-shell` | Desktop shell interaction test | `desktop/test/tab_strip_ui_contract.test.js` |  |
| Shell | Native `File` menu parity for new/open/save/close/import/export/settings | Yes | `desktop.md`, `features/shell-canvas-integration.md` | Baseline | Shell | Planned | `codex/rewrite-shell` | Menu integration test | `desktop/test/native_system_menu_contract.test.js` |  |
| Sessions | `New Run` or `New session` opens a new tab without wiping the current tab | Yes | `desktop.md`, `PRD.md` | Baseline | Shell | Planned | `codex/rewrite-shell` | Session-tab behavior test | `desktop/test/tabbed_sessions_v1_contract.test.js` |  |
| Sessions | `Open Run` opens an existing run in a new tab | Yes | `desktop.md`, `PRD.md` | Baseline | Shell | Planned | `codex/rewrite-shell` | Session reopen behavior test | `desktop/test/tabbed_sessions_v1_contract.test.js` |  |
| Sessions | `Save Session` persists the tab-local session snapshot | Yes | `desktop.md`, `features/visual-timeline/README.md` | Baseline | Domain | Planned | `codex/rewrite-domain` | Persistence contract test | `desktop/test/session_snapshot.test.js` | Canvas now writes `cue.session.v1` to `session.json`; `Domain` review still needs to confirm canonical write-path alignment |
| Sessions | `Fork tab` preserves the current state as a sibling variant | Yes | `desktop.md`, `features/visual-timeline/README.md` | Baseline | Shell | Planned | `codex/rewrite-shell` | Tab-fork workflow test | `desktop/test/tabbed_sessions_v1_contract.test.js` |  |
| Sessions | Busy tabs block unsafe switching, closing, or forking | Yes | `desktop.md`, `PRD.md` | Baseline | Shell | Planned | `codex/rewrite-shell` | Busy-state behavior test | `desktop/test/tabbed_sessions_v1_contract.test.js` |  |
| Canvas | Screenshot or image import into the active session | Yes | `desktop.md`, `PRD.md` | Baseline | Canvas | Planned | `codex/rewrite-canvas` | Import workflow test | `desktop/test/design_review_boot_import.test.js` |  |
| Canvas | Drag-drop import | Yes | `desktop.md`, `PRD.md` | Baseline | Canvas | Planned | `codex/rewrite-canvas` | Drag-drop import test | `desktop/test/freeform_import_placement_regression.test.js` |  |
| Canvas | Shared-canvas swap when changing active tabs | Yes | `desktop.md`, `PRD.md` | Baseline | Canvas | Planned | `codex/rewrite-canvas` | Session swap behavior test | `desktop/test/tab_switch_hydration_contract.test.js` |  |
| Left rail | Stable visible anchors: `Move`, `Upload`, `Select` | Yes | `desktop.md`, `PRD.md` | Baseline | Canvas | Planned | `codex/rewrite-canvas` | Rail contract test | `desktop/test/single_image_rail_contract.test.js` |  |
| Left rail | Three dynamic suggested job slots | Yes | `desktop.md`, `PRD.md`, `agent-runtime.md` | Baseline | Canvas | Planned | `codex/rewrite-canvas` | Suggested-actions integration test | `desktop/test/single_image_rail_contract.test.js` | Align final ranking contract with Inference before merge |
| Left rail | `Remove People` direct affordance outside the dynamic slots | Yes | `desktop.md`, `agent-runtime.md` | Baseline | Canvas | Planned | `codex/rewrite-canvas` | Action-library parity test | `desktop/test/action_grid_logic.test.js` |  |
| Left rail | Hidden `New Background` seeded job library entry | No | `agent-runtime.md` | Re-approve | Coordinator | Dropped | `codex/rewrite-coordinator` | Product decision note | `docs/runbooks/CODEX_REWRITE_WAVE.md` | Out of scope for the screenshot-first baseline unless product re-opens it later |
| Communication rail | `Marker` | Yes | `desktop.md`, `PRD.md`, `agent-runtime.md` | Baseline | Canvas | Planned | `codex/rewrite-canvas` | Overlay interaction test | `desktop/test/communication_marker_regression.test.js` |  |
| Communication rail | `Highlight` | Yes | `desktop.md`, `PRD.md`, `agent-runtime.md` | Baseline | Canvas | Planned | `codex/rewrite-canvas` | Overlay interaction test | `desktop/test/communication_rail_contract.test.js` |  |
| Communication rail | `Magic Select` | Yes | `desktop.md`, `PRD.md`, `local-magic-select-runtime.md` | Baseline | Inference | Planned | `codex/rewrite-inference` | Runtime contract test plus benchmark | `desktop/test/magic_select_runtime.test.js` | Bridge-style `session.runDir` is supported and routing metadata survives; host-side pack installation still remains upstream-owned |
| Communication rail | `Stamp` with starter intents and short custom text | Yes | `desktop.md`, `PRD.md`, `agent-runtime.md` | Baseline | Canvas | Planned | `codex/rewrite-canvas` | Overlay interaction test | `desktop/test/communication_rail_contract.test.js` |  |
| Communication rail | `Eraser` for marks, stamps, and region proposals | Yes | `desktop.md`, `PRD.md`, `agent-runtime.md` | Baseline | Canvas | Planned | `codex/rewrite-canvas` | Overlay clear-state test | `desktop/test/communication_rail_contract.test.js` |  |
| Communication rail | `Make Space` as a visible tool | No | `agent-runtime.md`, `PRD.md` | Re-approve | Coordinator | Dropped | `codex/rewrite-coordinator` | Product decision note | `docs/runbooks/CODEX_REWRITE_WAVE.md` | Out of scope for the screenshot-first baseline unless product re-opens it later. Bridge host placeholder native `Tools` labels still need cleanup to match this decision |
| Review/apply | Explicit `Design Review` trigger | Yes | `desktop.md`, `PRD.md`, `agent-runtime.md` | Baseline | Review | Planned | `codex/rewrite-review` | Review request test | `desktop/test/design_review_contract.test.js` |  |
| Review/apply | Proposal tray or proposal cards | Yes | `desktop.md`, `PRD.md`, `features/design-review-proposal-preview-images/README.md` | Baseline | Review | Planned | `codex/rewrite-review` | Review UI interaction test | `desktop/test/canvas_app_review_apply_bridge.test.js` |  |
| Review/apply | Proposal preview thumbnails in proposal cards | Yes | `features/design-review-proposal-preview-images/README.md` | Release | Review | Deferred | `codex/rewrite-review` | Preview-card image test later | `TBD desktop/test/design_review_preview_cards_release.test.js` | Screenshot-first baseline may ship with text-only cards |
| Review/apply | Accept one proposal into a traced in-place apply | Yes | `desktop.md`, `PRD.md`, `features/design-review-proposal-preview-images/README.md` | Baseline | Review | Planned | `codex/rewrite-review` | Review/apply contract test | `desktop/test/canvas_app_review_apply_bridge.test.js` |  |
| Review/apply | Planner traces persisted into the run directory | Yes | `agent-runtime.md`, `features/visual-timeline/README.md` | Baseline | Review | Planned | `codex/rewrite-review` | Artifact contract test | `desktop/test/action_provenance.test.js` | Needs Domain receipt and timeline schema before final merge |
| Agent workflow | `Agent Run` panel for stepping or auto-running actions against the current tab | Yes | `agent-runtime.md`, `agent-workflow-prd.md` | Baseline | Tools | Planned | `codex/rewrite-tools` | Focused runtime test | `desktop/test/agent_runner_runtime.test.js` | Baseline may ship as a thinner step-by-step surface so long as it preserves one bounded next action against the current tab |
| History/compare | Visual history shelf under the titlebar | Yes | `desktop.md`, `features/visual-timeline/README.md` | Baseline | Domain | Planned | `codex/rewrite-domain` | History UI parity test | `desktop/test/timeline_carousel.test.js` |  |
| History/compare | Restore prior timeline states without re-running model work | Yes | `desktop.md`, `PRD.md`, `features/visual-timeline/README.md` | Baseline | Domain | Planned | `codex/rewrite-domain` | Timeline restore contract test | `desktop/test/session_timeline.test.js` | Canvas now writes `cue.timeline.v1` while still reading the legacy shape; `Domain` review still needs to confirm canonical write-path alignment |
| History/compare | Manual compare through tab forks and history | Yes | `desktop.md`, `features/visual-timeline/README.md` | Baseline | Domain | Planned | `codex/rewrite-domain` | Variant compare workflow test | `desktop/test/tab_fork_design_review_state_regression.test.js` |  |
| History/compare | Dedicated side-by-side compare viewer or approval gallery | No | `desktop.md`, `PRD.md` | Release | Shell | Deferred | `codex/rewrite-shell` | Release compare suite later | `TBD desktop/test/compare_gallery_release.test.js` |  |
| Tooling | Secondary `Save Shortcut` or `Create Tool` flow after a useful edit | Yes | `desktop.md`, `PRD.md`, `agent-runtime.md` | Baseline | Tools | Planned | `codex/rewrite-tools` | Tool manifest workflow test | `desktop/test/tool_runtime_contract.test.js` | Baseline only needs deterministic replay and in-session reuse; richer parameterized generation can wait |
| Tooling | Reuse a saved tool in-session | Yes | `desktop.md`, `PRD.md`, `agent-runtime.md` | Baseline | Tools | Planned | `codex/rewrite-tools` | Tool replay contract test | `desktop/test/local_tool_edits.test.js` |  |
| Export | Titlebar export menu for PSD, PNG, JPG, WEBP, TIFF | Yes | `desktop.md`, `features/shell-canvas-integration.md` | Baseline | Export | Planned | `codex/rewrite-export` | Export menu and output test | `desktop/test/menu.test.js` |  |
| Export | Receipt-backed export for the current visible tab state | Yes | `desktop.md`, `PRD.md`, `psd-export-slice.md` | Baseline | Export | Planned | `codex/rewrite-export` | Receipt contract test | `desktop/test/export_psd_contract.test.js` |  |
| Export | Flattened PSD export | Yes | `desktop.md`, `psd-export-slice.md` | Baseline | Export | Planned | `codex/rewrite-export` | PSD export contract test | `desktop/test/export_psd_contract.test.js` |  |
| Export | Flattened PNG, JPG, WEBP, TIFF export | Yes | `desktop.md`, `PRD.md`, `features/shell-canvas-integration.md` | Baseline | Export | Planned | `codex/rewrite-export` | Raster export contract test | `TBD desktop/test/export_raster_contract.test.js` | Add dedicated raster proof before export slice is considered complete |
| Export | Editable layered PSD export | No | `desktop.md`, `PRD.md` | Release | Export | Deferred | `codex/rewrite-export` | Later fidelity suite | `TBD desktop/test/export_layered_psd_release.test.js` |  |
| Persistence | Reopen saved runs from `session-timeline.json` and `juggernaut-session.json` lineage | Yes | `desktop.md`, `features/visual-timeline/README.md` | Baseline | Domain | Planned | `codex/rewrite-domain` | Reopen-session contract test | `desktop/test/tabbed_sessions_v1_contract.test.js` | Legacy adapter is published in `rust_engine/crates/brood-contracts/src/runs/legacy.rs`; still needs end-to-end reopen proof in the shell parity suite |
| Persistence | New runs write under `~/cue_runs/`; legacy `~/brood_runs/` is read-only import compatibility | Partially | `desktop.md` | Baseline | Domain | Planned | `codex/rewrite-domain` | Run-directory contract test | `TBD desktop/test/run_dir_compat_contract.test.js` | Keep legacy storage out of the steady-state write path |
| Persistence | Receipts and artifacts stored alongside run outputs | Yes | `desktop.md`, `PRD.md`, `psd-export-slice.md` | Baseline | Domain | Planned | `codex/rewrite-domain` | Artifact layout contract test | `desktop/test/action_provenance.test.js` |  |
| Platform | macOS launchable parity for the screenshot-polish slice | Yes | `desktop.md`, `PRD.md` | Baseline | Verify | Planned | `codex/rewrite-verify` | macOS smoke test | `scripts/macos_clean_machine_smoke.sh` | Verification queue and smoke-note entrypoints are published; integrated smoke proof still waits on merged slices |
| Platform | Windows support for the same core feature set | No | `PRD.md` | Release | Verify | Deferred | `codex/rewrite-verify` | Windows smoke suite | `TBD scripts/windows_smoke.ps1` | Not part of the first launchable macOS-only screenshot-first milestone |
| Platform | Linux support for the same core feature set | No | `PRD.md` | Release | Verify | Deferred | `codex/rewrite-verify` | Linux smoke suite | `TBD scripts/linux_smoke.sh` |  |
| File formats | Native `.ai` export with high-fidelity Cue re-import | No | `PRD.md` | Release | Export | Deferred | `codex/rewrite-export` | Round-trip format suite | `TBD desktop/test/export_ai_roundtrip.test.js` | Architecture hooks only until the screenshot-first baseline is stable |
| File formats | Native `.fig` export with high-fidelity Cue re-import | No | `PRD.md` | Release | Export | Deferred | `codex/rewrite-export` | Round-trip format suite | `TBD desktop/test/export_fig_roundtrip.test.js` | Architecture hooks only until the screenshot-first baseline is stable |
| Runtime direction | Provider-agnostic capability layer with local-first image execution path | Partially | `PRD.md`, `agent-runtime.md`, `/Users/mainframe/Desktop/projects/juggernaut-rewrite-audit/docs/decisions/0002-rust-first-rewrite.md` | Baseline architecture | Bridge | Planned | `codex/rewrite-bridge` | Runtime contract test | `desktop/test/single_image_capability_routing.test.js` | Typed bridge schemas are published; provider-routing parity still needs integration proof |
| Runtime direction | Local model pack substrate for Magic Select and future local image operations | Partially | `local-magic-select-runtime.md`, `/Users/mainframe/Desktop/projects/juggernaut-rewrite-audit/docs/rewrite-from-scratch-audit.md` | Baseline architecture | Inference | Planned | `codex/rewrite-inference` | Pack-resolution contract test | `desktop/test/magic_select_runtime.test.js` | Pack-resolution order is documented. Host-side pack installation still remains upstream-owned before merge |
| Legacy carryover | `Mother` overlay, mood, prompt or generation flow, and branded controls | No | `legacy-internals.md` | Drop | Coordinator | Dropped | `codex/rewrite-coordinator` | Scope signoff note | `docs/runbooks/CODEX_REWRITE_WAVE.md` |  |
| Legacy carryover | Brood-era `DNA`, `Soul Leech`, `Bridge`, `Triforce`, and similar token flows | No | `legacy-internals.md` | Drop | Coordinator | Dropped | `codex/rewrite-coordinator` | Scope signoff note | `docs/runbooks/CODEX_REWRITE_WAVE.md` |  |
| Legacy carryover | PTY command transport plus event-log polling on the shipping path | Hidden | `/Users/mainframe/Desktop/projects/juggernaut-rewrite-audit/docs/decisions/0002-rust-first-rewrite.md` | Drop | Bridge | Planned | `codex/rewrite-bridge` | Shipping architecture review | `docs/runbooks/CODEX_REWRITE_WAVE.md` | Typed bridge boundary is published; final integrated shipping-path proof is still required before baseline signoff |
| Auxiliary surfaces | File-browser dock | Not part of documented slice | `legacy-internals.md` | Re-approve | Coordinator | Dropped | `codex/rewrite-coordinator` | Product decision note | `docs/runbooks/CODEX_REWRITE_WAVE.md` | Out of scope for the screenshot-first baseline |
| Auxiliary surfaces | Portrait or agents dock | Not part of documented slice | `legacy-internals.md` | Re-approve | Coordinator | Dropped | `codex/rewrite-coordinator` | Product decision note | `docs/runbooks/CODEX_REWRITE_WAVE.md` | Out of scope for the screenshot-first baseline |
| Auxiliary surfaces | Spawnbar or larva or spawn affordances | Not part of documented slice | `legacy-internals.md` | Re-approve | Coordinator | Dropped | `codex/rewrite-coordinator` | Product decision note | `docs/runbooks/CODEX_REWRITE_WAVE.md` | Out of scope for the screenshot-first baseline |
| Auxiliary surfaces | Prompt-generate panel | Not part of documented slice | `legacy-internals.md` | Re-approve | Coordinator | Dropped | `codex/rewrite-coordinator` | Product decision note | `docs/runbooks/CODEX_REWRITE_WAVE.md` | Out of scope for the screenshot-first baseline |
| Auxiliary surfaces | Filmstrip and other undocumented side surfaces | Not part of documented slice | `legacy-internals.md` | Re-approve | Coordinator | Dropped | `codex/rewrite-coordinator` | Product decision note | `docs/runbooks/CODEX_REWRITE_WAVE.md` | Out of scope for the screenshot-first baseline |

## Kickoff Notes

- This tracker intentionally lives inside the active `cue` coordinator worktree rather than the read-only audit workspace.
- `Decision needed` rows are the scope edges that should be resolved before implementation starts or before the owning branch merges.
- `Deferred` rows are real release work, but they should not block the first rewrite baseline.
