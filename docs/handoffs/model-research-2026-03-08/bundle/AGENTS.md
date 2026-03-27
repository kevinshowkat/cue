# Repository Guidelines

Canonical agent instructions live in this file.

## Project Intent
- Build `Cue`, a text-free-first, image-first desktop design workstation.
- The source-of-truth product definition is [`PRD.md`](./PRD.md).
- Current operating objective: harden and document the launchable single-image-first desktop slice already landed in the repo while preserving the release bar in [`PRD.md`](./PRD.md).

## Non-Negotiable Rules
- Every implementation agent must use a separate git worktree.
- Exception: when `/review` is initiated in Codex for an in-flight task, the review and any follow-up fixes must happen in the original task worktree and on the original task branch. Do not create a second review-only worktree.
- Never run two independent implementation agents in the same worktree or on the same local branch checkout.
- Preserve a clean separation between deterministic local transforms and model-backed actions.
- Primary workflow must remain text-free in the visible editing loop.
- Tool creation is a core feature, not an extension point to postpone.
- Reproducibility is mandatory for every model-backed operation.

## Product Directives
- Release goal is parity across macOS, Windows, and Linux for the same core feature set.
- Current slice goal is narrower: a launchable app on the current Mac with session tabs, upload, canvas, custom tools, design review/apply, and reproducible PSD export.
- 3D scope for v1 is printable relief or mesh export only.
- VGen or artist-marketplace discovery is phase 2.
- Connected mode defaults to telemetry enabled with opt-out.
- Local-only mode defaults to no upload, with explicit opt-in for anonymized sharing.
- Native `.ai` and `.fig` are release targets and must re-import into Cue with high fidelity.

## Upstream Reference
- Reuse as much of `../brood` as practical before introducing new frameworks or runtime layers.
- Treat `../brood` as reference implementation material for:
  - desktop shell patterns
  - canvas interaction model
  - provider orchestration
  - receipts and run artifacts
- Treat `../oscillo/scripts/generate_bookend_overlays.py` as the starting reference for generated custom iconography.
- Do not copy code blindly. If upstream assumptions conflict with [`PRD.md`](./PRD.md), the PRD wins.

## Default Technical Direction
- Desktop shell: Tauri by default.
- Rendering: GPU-accelerated canvas stack suited for rapid transforms and gesture-heavy interaction.
- Runtime: native action engine with deterministic receipts and async provider routing.
- Avoid Electron by default.
- Avoid chat-centric UX patterns by default.

## Required Workflow
1. Start from the main repo clone.
2. Create a dedicated branch and worktree for your task.
3. Do all edits, tests, commits, and pushes from that worktree only.
4. If you initiate `/review` in Codex on that task, keep the review pass in that same worktree and apply fixes there instead of creating a new worktree.
5. Open a PR from your branch.
6. After merge, remove your worktree.

## Worktree Commands
Create new feature worktree:
```bash
git fetch origin
git worktree add ../juggernaut-<feature> -b feature/<feature> origin/main
```

If branch already exists:
```bash
git fetch origin
git worktree add ../juggernaut-<feature> feature/<feature>
```

List active worktrees:
```bash
git worktree list
```

Remove worktree after merge:
```bash
git worktree remove ../juggernaut-<feature>
```

## Safety Rules
- Do not edit or commit from another agent's worktree.
- Do not run destructive git commands on shared branches.
- Keep commits scoped to one task.
- Rebase or merge only within your own branch and worktree.
- Do not spin up a second review-only worktree for Codex `/review`; review the existing task branch in place and fix findings there.
- If blocked by another branch, coordinate through PR comments or coordinator notes instead of editing in their worktree.

## Documentation Rules
- If scope, milestones, acceptance criteria, or constraints change, update [`PRD.md`](./PRD.md) in the same task.
- Repo-only agent prompts and runbooks are intentionally omitted from this handoff bundle because they are not needed for the external research pass.
- If a material technical decision is made, add a short decision record under `docs/decisions/` once that folder exists.
- When ambiguity remains, capture it in the PRD instead of burying it in chat.

## Suggested Future Structure
- `desktop/` for the app shell and UI.
- `engine/` or `rust_engine/` for runtime, receipts, queues, and provider adapters.
- `docs/` for decisions, architecture, and launch notes.
- `scripts/` for packaging, export helpers, icon generation, and developer automation.
- `tests/` for runtime and UI verification.

## Working Conventions
- Favor small, scoped changes tied to one sprint or milestone.
- Every new tool should define:
  - input contract
  - output contract
  - execution path
  - receipt payload
  - failure behavior
- Any export feature must define expected fidelity and known limitations up front.
- Native design export work must define its round-trip re-import contract up front.
- Hidden accessibility labels are allowed even when visible labels are absent.

## Multi-Agent Runbooks
- Repo-internal runbooks are intentionally omitted from this handoff bundle because they are not needed for the external model research pass.

## Build And Test Status
- `Cue` is now bootstrapped from `../brood` on branch `feature/juggernaut-bootstrap`.
- Verified commands on this branch:
  - `cd desktop && npm install`
  - `cd desktop && npm test`
  - `cd desktop && npm run build`
  - `cd desktop/src-tauri && cargo check`
  - `cd desktop && npm run tauri build`
- Latest verified macOS bundle output:
  - `desktop/src-tauri/target/release/bundle/dmg/Cue_0.2.4_aarch64.dmg`

## Delivery Standard
- Favor concrete, shippable scope over expansive aspiration.
- Tighten contradictions early, especially around:
  - text-free UX vs accessibility
  - same-day vertical slice vs full release bar
  - cross-platform parity vs time-to-first-launch
  - native `.ai` and `.fig` fidelity vs real implementation feasibility
