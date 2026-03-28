# Repository Guidelines

Canonical agent instructions live in this file.

## Project Intent

- Build `Cue`, a text-free-first, image-first desktop design workstation.
- Treat [PRD.md](PRD.md) as the source-of-truth product definition.
- Current objective: harden and document the launchable single-image-first desktop slice already in the repo.

## Non-Negotiable Rules

- Every implementation agent must use a separate git worktree.
- If `/review` is initiated for an in-flight task, keep review and follow-up fixes in that same task worktree.
- Preserve a clean separation between deterministic local transforms and model-backed actions.
- Primary workflow must remain text-free in the visible editing loop.
- Tool creation is a core feature.
- Reproducibility is mandatory for model-backed operations.

## Product Directives

- Release goal remains parity across macOS, Windows, and Linux for the same core feature set.
- Public launch is narrower: a launchable macOS app with session tabs, upload, canvas, custom tools, design review/apply, and reproducible export.
- Native `.ai` and `.fig` round-trip remain release targets but are not verified in the first public launch.

## Upstream Reference

- Reuse `../brood` where it still shortens delivery time.
- Do not copy code blindly. When upstream assumptions conflict with [PRD.md](PRD.md), the PRD wins.

## Required Workflow

1. Start from the main repo clone.
2. Create a dedicated branch and worktree.
3. Do all edits, tests, commits, and pushes from that worktree.
4. Open a PR from that branch.
5. Remove the worktree after merge.

## Worktree Commands

Create a new feature worktree:

```bash
git fetch origin
git worktree add ../cue-<feature> -b feature/<feature> origin/main
```

If the branch already exists:

```bash
git fetch origin
git worktree add ../cue-<feature> feature/<feature>
```

List worktrees:

```bash
git worktree list
```

Remove a merged worktree:

```bash
git worktree remove ../cue-<feature>
```

## Documentation Rules

- Update [PRD.md](PRD.md) when scope, milestones, or constraints change.
- Update active public docs in [docs/README.md](docs/README.md) when behavior changes.
- Move historical process material into [docs/archive/](docs/archive/README.md) with a clear archived banner instead of leaving it in the active surface.
- Record remaining legacy implementation names in [docs/legacy-internals.md](docs/legacy-internals.md).

## Build And Test Status

- Verified commands on the current macOS launch slice:
  - `cd desktop && npm install`
  - `cd desktop && npm test`
  - `cd desktop && npm run build`
  - `cd desktop/src-tauri && cargo check`
  - `cd desktop && npm run tauri build`
- Latest verified DMG artifact pattern:
  - `desktop/src-tauri/target/release/bundle/dmg/Cue_<version>_aarch64.dmg`

## Historical Runbooks

The old multi-agent launch and polish runbooks are not part of the active public workflow. Keep only sanitized reference notes under [docs/archive/](docs/archive/README.md).
