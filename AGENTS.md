# Repository Workflow

This file keeps the repo-level contribution rules in one place.

## Working Rules

- use a dedicated git worktree for each feature or fix
- keep user-facing naming on Cue
- update docs when app behavior, release steps, or public configuration change
- keep public platform support statements honest: macOS is verified first, Windows and Linux are still roadmap work

## Typical Flow

1. Start from the main repo clone.
2. Create a dedicated branch and worktree.
3. Make changes, run the matching checks, and commit from that worktree only.
4. Open a pull request.
5. Remove the worktree after merge.

## Worktree Commands

Create a new worktree:

```bash
git fetch origin
git worktree add ../cue-<feature> -b feature/<feature> origin/main
```

Use an existing branch:

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

## Common Checks

```bash
cd desktop && npm test
cd desktop && npm run build
cd desktop/src-tauri && cargo check
./scripts/release_check.sh
```

## Keep These Docs In Sync

- [PRD.md](PRD.md)
- [README.md](README.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [RELEASING.md](RELEASING.md)
- [docs/README.md](docs/README.md)
- [docs/legacy-internals.md](docs/legacy-internals.md)
