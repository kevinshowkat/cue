# Repository Guidelines

Canonical agent instructions live in this file.

## Project Intent
- Build `Juggernaut`, a text-free-first, image-first desktop design workstation.
- The source-of-truth product definition is [`PRD.md`](/Users/mainframe/Desktop/projects/Juggernaut/PRD.md).
- Current operating objective: move toward a launchable vertical slice by **5:30 PM America/Los_Angeles on 2026-03-08**.

## Non-Negotiable Rules
- Every agent must use a separate git worktree.
- Never run two agents in the same worktree or on the same local branch checkout.
- Preserve a clean separation between deterministic local transforms and model-backed actions.
- Primary workflow must remain text-free in the visible editing loop.
- Tool creation is a core feature, not an extension point to postpone.
- Reproducibility is mandatory for every model-backed operation.

## Product Directives
- Release goal is parity across macOS, Windows, and Linux for the same core feature set.
- Today's sprint goal is narrower: launchable app on the current Mac with upload, canvas, custom tools, image edit path, and PSD export.
- 3D scope for v1 is printable relief or mesh export only.
- VGen or artist-marketplace discovery is phase 2.
- Connected mode defaults to telemetry enabled with opt-out.
- Local-only mode defaults to no upload, with explicit opt-in for anonymized sharing.
- Native `.ai` and `.fig` are release targets and must re-import into Juggernaut with high fidelity.

## Upstream Reference
- Reuse as much of `../brood` as practical before introducing new frameworks or runtime layers.
- Treat `../brood` as reference implementation material for:
  - desktop shell patterns
  - canvas interaction model
  - provider orchestration
  - receipts and run artifacts
- Treat `../oscillo/scripts/generate_bookend_overlays.py` as the starting reference for generated custom iconography.
- Do not copy code blindly. If upstream assumptions conflict with [`PRD.md`](/Users/mainframe/Desktop/projects/Juggernaut/PRD.md), the PRD wins.

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
4. Open a PR from your branch.
5. After merge, remove your worktree.

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
- If blocked by another branch, coordinate through PR comments or coordinator notes instead of editing in their worktree.

## Documentation Rules
- If scope, milestones, acceptance criteria, or constraints change, update [`PRD.md`](/Users/mainframe/Desktop/projects/Juggernaut/PRD.md) in the same task.
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
- Use [`WARP_AGENT_LAUNCH.md`](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/WARP_AGENT_LAUNCH.md) for the parallel Codex setup.
- Use [`AGENT_PROMPTS.md`](/Users/mainframe/Desktop/projects/Juggernaut/AGENT_PROMPTS.md) for task-specific boot prompts.
- Use [`TODAY_LAUNCH_TASKS.md`](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_LAUNCH_TASKS.md) for the launch-slice worker prompts.
- Use [`WARP_DESIGN_WAVE.md`](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/WARP_DESIGN_WAVE.md) for the second-wave design pass.
- Use [`TODAY_DESIGN_WAVE_TASKS.md`](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_DESIGN_WAVE_TASKS.md) for the design-wave worker prompts.
- Use [`WARP_APPLE_POLISH.md`](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/WARP_APPLE_POLISH.md) for the Apple-style shell reset.
- Use [`TODAY_APPLE_POLISH_TASKS.md`](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_APPLE_POLISH_TASKS.md) for the Apple-polish worker prompts.

## Build And Test Status
- `Juggernaut` is now bootstrapped from `../brood` on branch `feature/juggernaut-bootstrap`.
- Verified commands on this branch:
  - `cd desktop && npm install`
  - `cd desktop && npm test`
  - `cd desktop && npm run build`
  - `cd desktop/src-tauri && cargo check`
  - `cd desktop && npm run tauri build`
- Latest verified macOS bundle output:
  - `desktop/src-tauri/target/release/bundle/dmg/Juggernaut_0.2.4_aarch64.dmg`

## Delivery Standard
- Favor concrete, shippable scope over expansive aspiration.
- Tighten contradictions early, especially around:
  - text-free UX vs accessibility
  - same-day vertical slice vs full release bar
  - cross-platform parity vs time-to-first-launch
  - native `.ai` and `.fig` fidelity vs real implementation feasibility
