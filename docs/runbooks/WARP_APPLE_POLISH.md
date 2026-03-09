# Warp Apple Polish Runbook (Juggernaut)

Use this after `feature/design-wave-integration` when the UI still feels too sci-fi, HUD-heavy, or game-like.

## 1. Base Branch
- Start from [`feature/design-wave-integration`](/Users/mainframe/Desktop/projects/Juggernaut).
- Do not reuse earlier launch or design branches for this wave.

## 2. Create And Warm Worktrees
Run once from the main Juggernaut repo:

```bash
./scripts/create_juggernaut_apple_worktrees.sh
./scripts/prep_juggernaut_apple_worktrees.sh
```

## 3. Reuse Existing Tabs
Reuse the tabs you already have.

Recommended remap:
- coordinator -> apple coordinator
- layout -> apple chrome
- visual -> apple surface
- runtime -> apple runtime
- icons -> apple rail
- native -> apple native window polish

In each tab:
1. end the current Codex session with `exit`
2. `cd` into the new apple-polish worktree
3. start a fresh session with `codex`
4. paste the matching prompt from [`TODAY_APPLE_POLISH_TASKS.md`](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_APPLE_POLISH_TASKS.md)

## 4. New Tab Paths
```bash
cd /Users/mainframe/Desktop/projects/juggernaut-apple-coordinator && codex
cd /Users/mainframe/Desktop/projects/juggernaut-apple-chrome && codex
cd /Users/mainframe/Desktop/projects/juggernaut-apple-surface && codex
cd /Users/mainframe/Desktop/projects/juggernaut-apple-runtime && codex
cd /Users/mainframe/Desktop/projects/juggernaut-apple-rail && codex
cd /Users/mainframe/Desktop/projects/juggernaut-apple-native && codex
```

## 5. Merge Order
1. `feature/apple-chrome-structure`
2. `feature/apple-runtime-minimalism`
3. `feature/apple-surface-reset`
4. `feature/apple-rail-controls`
5. `feature/apple-native-window-polish`

## 6. Emergency Stop
If the wave starts drifting back into HUD aesthetics:

```text
Pause immediately. Do not commit new changes.
Post handoff with: worktree, branch, files changed, tests run, blockers.
Wait for re-assignment.
```
