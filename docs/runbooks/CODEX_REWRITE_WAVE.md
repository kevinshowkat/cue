# Codex Rewrite Wave Runbook

Use this runbook from the active coordinator worktree when launching the April 1, 2026 rewrite wave.

Active coordinator worktree: `/Users/mainframe/Desktop/projects/cue-rewrite-coordinator`  
Active coordinator branch: `codex/rewrite-coordinator`  
Coordinator ownership slice: live tracker, merge order, dependency inventory, scope blockers, and integration notes only

## Current Wave Snapshot

Verified on `2026-04-07` from `git worktree list`, per-worktree
`git status --short --branch`, and branch push state.

- All rewrite worktrees still exist on the expected branches.
- `codex/canvas-app-rewrite` is now the active integration branch for the
  modular extraction and currently points at `2f0d4f7`, pushed to
  `origin/codex/canvas-app-rewrite`.
- `codex/rewrite-coordinator` is no longer the only dirty worktree.
  `cue-canvas-app-rewrite` and the `cue-canvas-rewrite-*` slice worktrees also
  carry current local rewrite WIP.
- The historical `codex/rewrite-*` handoffs below remain useful as archive
  context, but they do not describe the current local integration state.
- Until the slice worktrees are reconciled, treat `codex/canvas-app-rewrite`
  as the source of truth for the extraction PR.
- The live active-tab inventory, blocker register, and contract-gap notes live
  in `docs/rewrite-parity-matrix.md`.

## Exact 10-Tab Ownership Split

| Tab | Worktree | Branch | Ownership slice | Expected first touch | Explicit no-touch edge |
| --- | --- | --- | --- | --- | --- |
| 1 | `/Users/mainframe/Desktop/projects/cue-rewrite-coordinator` | `codex/rewrite-coordinator` | Coordinator, live parity tracker, merge order, blocker register, integration notes | `docs/rewrite-parity-matrix.md`, `docs/runbooks/CODEX_REWRITE_WAVE.md`, `docs/README.md` | No product-code edits in `desktop/src`, `desktop/src-tauri/src`, or `rust_engine` unless a later coordinator-only doc task explicitly requires it |
| 2 | `/Users/mainframe/Desktop/projects/cue-rewrite-shell` | `codex/rewrite-shell` | Shell, tabs, titlebar, menus, app chrome, launch scaffold | `desktop/src/index.html`, `desktop/src/styles.css`, `desktop/src/system_menu_state.js`, `desktop/src/tabbed_sessions.js` | Do not own review runtime, export internals, Magic Select runtime, or Rust contracts |
| 3 | `/Users/mainframe/Desktop/projects/cue-rewrite-domain` | `codex/rewrite-domain` | Rust session model, timeline, receipts, artifact schema, run persistence contracts | `rust_engine/crates/brood-contracts/src/runs/*`, `rust_engine/crates/brood-contracts/src/events.rs`, `docs/features/visual-timeline/README.md` | Do not own shell chrome, Tauri menu wiring, design review UI, or tool manifests |
| 4 | `/Users/mainframe/Desktop/projects/cue-rewrite-bridge` | `codex/rewrite-bridge` | Typed host bridge, command or update schema, app-core boundary, PTY removal path | `desktop/src-tauri/src/main.rs`, `desktop/src/canvas_protocol.js`, `desktop/src/jsonl_io.js` | Do not own canvas presentation, rail layout, review proposal logic, or export payload policy |
| 5 | `/Users/mainframe/Desktop/projects/cue-rewrite-inference` | `codex/rewrite-inference` | Local inference, provider routing, pack resolution, Magic Select runtime, Windows runtime constraints | `desktop/src/magic_select_runtime.js`, `desktop/src/single_image_capability_routing.js`, `docs/local-magic-select-runtime.md`, `scripts/benchmark_magic_select_runtime.py` | Do not own session tabs, export menu UX, or tool manifest UX |
| 6 | `/Users/mainframe/Desktop/projects/cue-rewrite-canvas` | `codex/rewrite-canvas` | Shared canvas interaction, overlay presentation, rail presentation, import and visible gesture shell | `desktop/src/canvas_app.js`, `desktop/src/canvas_handlers/*`, `desktop/src/juggernaut_shell/rail.js`, `desktop/src/effect_interactions.js` | Do not own Tauri contracts, review pipeline internals, or export writers |
| 7 | `/Users/mainframe/Desktop/projects/cue-rewrite-review` | `codex/rewrite-review` | Design Review request flow, proposal state, apply orchestration, review artifacts | `desktop/src/design_review_*.js`, `desktop/test/design_review_*.test.js`, `desktop/test/canvas_app_review_apply_bridge.test.js` | Do not own tab lifecycle, tool manifests, or export packaging |
| 8 | `/Users/mainframe/Desktop/projects/cue-rewrite-tools` | `codex/rewrite-tools` | `Save Shortcut`, custom tool manifests, in-session tool reuse, deterministic replay, Agent Run surface | `desktop/src/tool_runtime.js`, `desktop/src/tool_apply_runtime.js`, `desktop/src/local_tool_edits.js`, `docs/agent-runtime.md` | Do not own review planning, export format writers, or shell titlebar chrome |
| 9 | `/Users/mainframe/Desktop/projects/cue-rewrite-export` | `codex/rewrite-export` | Export packaging, receipt-backed handoff outputs, artifact layout, format surface | `desktop/src/juggernaut_export/contract.js`, `docs/psd-export-slice.md`, `desktop/test/export_psd_contract.test.js` | Do not own design review runtime, Magic Select runtime, or tab lifecycle |
| 10 | `/Users/mainframe/Desktop/projects/cue-rewrite-verify` | `codex/rewrite-verify` | Benchmarks, parity proof, smoke scripts, regression verification, release-check notes | `desktop/test/*.test.js`, `scripts/macos_clean_machine_smoke.sh`, `scripts/release_check.sh`, `docs/benchmark-playbook.md` | Do not change product behavior except for minimal test seams agreed with the owning tab |

## Exact Merge Order

Coordinator docs can merge whenever needed. Implementation branches should merge in this order unless the coordinator posts a different decision:

1. `Domain` on `codex/rewrite-domain`
Reason: session, timeline, receipt, and persistence contracts are the base dependency for every other slice.
2. `Bridge` on `codex/rewrite-bridge`
Reason: typed app-core boundaries should land before anyone depends on a new runtime seam.
3. `Shell` on `codex/rewrite-shell`
Reason: the window, tabs, menus, and visible shell integration points can stabilize once the underlying contracts exist.
4. `Canvas` on `codex/rewrite-canvas`
Reason: canvas and overlay work should bind to the already-landed shell and bridge rather than inventing parallel seams.
5. `Inference` on `codex/rewrite-inference`
Reason: local runtime and pack resolution should plug into the typed boundary, not back-drive it.
6. `Review` on `codex/rewrite-review`
Reason: proposal and apply flows depend on canvas state plus routing and artifact contracts.
7. `Tools` on `codex/rewrite-tools`
Reason: save-shortcut, replay, and Agent Run should sit on top of the now-stable action and apply contracts.
8. `Export` on `codex/rewrite-export`
Reason: export packaging is safest once session, artifact, and apply shapes have stopped moving.
9. `Verify` on `codex/rewrite-verify`
Reason: final parity, benchmark, and smoke updates should validate the integrated slices rather than chase churn mid-wave.

## Merge Order Enforcement Rules

- No implementation branch merges out of order unless the coordinator records the override in `docs/rewrite-parity-matrix.md` and this runbook.
- `Domain` owns new session, timeline, receipt, run, and artifact contracts for the wave.
- `Bridge` owns the typed app-core boundary and the PTY-removal path for the shipping rewrite.
- `Shell` and `Canvas` may scaffold in parallel, but they must not publish competing contracts ahead of merge steps 1 and 2.
- `Inference` must not freeze capability-routing or pack-resolution public seams before `Bridge` review.
- `Review`, `Tools`, and `Export` should treat missing upstream contracts as blockers to record, not as permission to patch foreign slices.
- `Verify` lands last except for isolated proof-harness work explicitly agreed with the owning slice.
- The coordinator branch stays doc-only unless the ownership model is explicitly changed.

## Overlap Prevention Rules

- The expected first-touch files in the ownership table are ownership defaults, not suggestions.
- Do not edit another slice's product files to unblock yourself. Record the dependency in `docs/rewrite-parity-matrix.md` and escalate.
- Shared docs may be updated outside the owning slice only when the coordinator is acting in its own ownership area or the owning slice explicitly asks for it.
- If a branch needs a contract that does not exist yet, the correct next move is a blocker note and owner handoff, not a second contract.

## Blocker Escalation

1. Add the blocker or contract gap to `docs/rewrite-parity-matrix.md` with owner, affected slices, severity, and coordinator action.
2. Name the earliest merge step that the blocker can stop.
3. Freeze downstream contract changes in foreign slices until the owner responds or the coordinator records a merge-order override.
4. Include the blocker in the next branch handoff with changed files, tests run, unresolved blockers, and the next dependency needed.

## Resolved Kickoff Product Decisions

These defaults are approved for the rewrite wave and should be treated as plan inputs, not as open debate during kickoff:

1. First milestone
The first rewrite milestone is a launchable macOS-only screenshot-polish baseline.

2. Defining end-to-end workflow
The baseline success path is: import one screenshot, place marks, run `Design Review`, accept one proposal, optionally `Save Shortcut`, then export receipt-backed `PSD` plus `PNG`.

3. `Remove People`
Keep `Remove People` as a named direct affordance outside the three dynamic rail slots for the baseline.

4. `Agent Run`
Baseline may ship with a thinner step-by-step surface so long as it still plans one bounded next action against the current tab.

5. `Save Shortcut` or `Create Tool`
Baseline only needs deterministic replay of a useful edit plus in-session reuse. Richer parameterized tool generation can wait.

6. Session lineage compatibility
Read legacy `juggernaut-session.json` and `session-timeline.json` through a compatibility adapter. A cleaner canonical runtime shape is allowed behind that adapter.

7. Run storage
New runs write under `~/cue_runs/`. Legacy `~/brood_runs/` is read-only import compatibility, not the steady-state write path.

8. Non-baseline surfaces
Do not include `New Background`, visible `Make Space`, file-browser dock, portrait or agents dock, spawnbar, prompt-generate, or filmstrip in the screenshot-first baseline.

9. Review proposal cards
Text-only proposal cards are acceptable for the baseline. Preview thumbnails can come later.

10. `.ai` and `.fig`
Do not start implementation work on native `.ai` or `.fig` export until the screenshot-first baseline is stable. Only architecture hooks are in scope before that point.

11. Naming cleanup
User-facing naming becomes `Cue` immediately. Internal legacy names should only be cleaned up where new modules, crates, or contracts are being created.

12. Rewrite quality bar
The non-negotiable quality bar besides parity is faster, clearer deterministic local workflows for screenshot-first game or UI polish, not broader feature count.

## Remaining Product Question

One remaining non-blocking product call is still worth making explicit when convenient:

- Whether Windows support is the first public milestone after the macOS-only baseline, or a later release gate. This does not block kickoff.

## First-Day Execution Checklist For April 1, 2026

1. Confirm all ten worktrees exist, point at the intended branches, and are clean enough to start scoped work.
2. Open all ten Codex tabs and paste the shared boot block before any implementation prompt is issued.
3. Require every tab to post: worktree path, branch, ownership slice, expected first-touch files, and explicit no-touch files.
4. Merge the coordinator docs that define the live tracker and runbook before any implementation branch starts real product edits.
5. Use the approved kickoff product defaults in this runbook and the live tracker. Escalate only net-new scope conflicts.
6. Post the first coordinator inventory: tab, branch, owner, current scope, and blocked edges.
7. Capture current baseline proofs and artifact paths for:
   - `desktop/test/tabbed_sessions_v1_contract.test.js`
   - `desktop/test/design_review_contract.test.js`
   - `desktop/test/magic_select_runtime.test.js`
   - `desktop/test/export_psd_contract.test.js`
   - `scripts/benchmark_magic_select_runtime.py`
   - `scripts/macos_clean_machine_smoke.sh`
8. Record benchmark inputs and artifact locations using the format in `docs/benchmark-playbook.md`.
9. Let `Domain` and `Bridge` start first. `Shell` and `Canvas` may scaffold in parallel, but they should not force new contracts ahead of merge steps 1 and 2.
10. Require every branch handoff to include changed files, tests run, unresolved blockers, and the next dependency it needs.
11. Do not start broad product implementation from the coordinator branch. The coordinator branch stays for tracker, scope, and integration notes unless explicitly reassigned.
