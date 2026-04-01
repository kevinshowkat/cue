# Contributing To Cue

## Before You Start

- read the [product overview](PRD.md)
- read the [repository workflow](AGENTS.md)
- keep changes small enough to review and verify

## Use A Worktree

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

Do your edits, tests, and commits from that worktree only.

## Run The Matching Checks

```bash
cd desktop && npm test
cd desktop && npm run build
cd desktop/src-tauri && cargo check
./scripts/release_check.sh
```

## Keep Docs Current

- update user-facing docs when behavior changes
- update release docs when packaging or publishing changes
- document public configuration in [`.env.example`](.env.example)
- move historical notes to [docs/archive/](docs/archive/README.md) instead of leaving them in the main docs

## Pull Requests

- keep the scope focused
- include what you tested
- call out any remaining legacy internal names or follow-up work
