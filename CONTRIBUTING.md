# Contributing To Cue

## Before You Start

- Read [AGENTS.md](AGENTS.md) for repo workflow rules.
- Read [PRD.md](PRD.md) for current product constraints.
- Keep changes scoped and shippable.

## Worktree Workflow

Implementation work happens in a dedicated git worktree.

Create a new worktree:

```bash
git fetch origin
git worktree add ../cue-<feature> -b feature/<feature> origin/main
```

If the branch already exists:

```bash
git fetch origin
git worktree add ../cue-<feature> feature/<feature>
```

Do all edits, tests, and commits from that worktree only.

## Validation

Run the checks that match your change. Common commands:

```bash
cd desktop && npm test
cd desktop && npm run build
cd desktop/src-tauri && cargo check
./scripts/release_check.sh
```

## Docs Expectations

- Update product-facing docs when behavior changes.
- Update maintainer docs when release or packaging behavior changes.
- Capture public-facing configuration changes in [`.env.example`](.env.example).
- Keep archived historical material under [docs/archive/](docs/archive/README.md), not in the active public surface.

## Pull Requests

- Keep PRs narrowly scoped.
- Include verification notes.
- Call out follow-up work explicitly when you leave legacy internals in place.
