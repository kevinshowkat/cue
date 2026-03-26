# Warp Multi-Agent Launch Runbook (Juggernaut)

Use this when running Codex implementation agents in Warp with multiple tabs and separate git worktrees.

## 1. Read First
- [`AGENTS.md`](/Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md)
- [`PRD.md`](/Users/mainframe/Desktop/projects/Juggernaut/PRD.md)
- [`AGENT_PROMPTS.md`](/Users/mainframe/Desktop/projects/Juggernaut/AGENT_PROMPTS.md)

Rule: one implementation agent per worktree.

Exception: if you initiate Codex `/review` for an in-flight task, keep the review and any follow-up fixes in that task's existing worktree and branch. Do not create a second review-only worktree.

## 2. Create Worktrees
Run once from the main Juggernaut repo:

```bash
./scripts/create_juggernaut_worktrees.sh
./scripts/prep_juggernaut_worktrees.sh
```

## 3. Recommended First Wave
- Use 5 tabs first:
  - coordinator
  - shell
  - tools
  - edit
  - export
- Only add the iconography tab if the shell branch is already stable and you still have a clearly scoped polish task.

## 4. Warp Tab Assignment
- Tab 1: Coordinator `../juggernaut-coordinator`
- Tab 2: Shell and Canvas `../juggernaut-shell`
- Tab 3: Tool Runtime `../juggernaut-tools`
- Tab 4: Photo Edit Flow `../juggernaut-edit`
- Tab 5: PSD Export `../juggernaut-export`
- Tab 6: Iconography `../juggernaut-icons`

## 5. Start Codex In Each Tab
```bash
cd ../juggernaut-coordinator && codex
cd ../juggernaut-shell && codex
cd ../juggernaut-tools && codex
cd ../juggernaut-edit && codex
cd ../juggernaut-export && codex
cd ../juggernaut-icons && codex
```

## 6. Boot Prompt For Every Tab
Paste this first in every Codex tab:

```text
Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/AGENT_PROMPTS.md

Confirm:
- your current worktree path
- your branch
- your ownership area
- that you will not touch other domains
Then wait for your task prompt.
```

## 7. Prompt Assignment
- Coordinator tab: use the `Coordinator` block from [`AGENT_PROMPTS.md`](/Users/mainframe/Desktop/projects/Juggernaut/AGENT_PROMPTS.md)
- Shell tab: use `Agent 1: Shell And Canvas`
- Tools tab: use `Agent 2: Tool Runtime`
- Edit tab: use `Agent 3: Photo Edit Flow`
- Export tab: use `Agent 4: PSD Export`
- Icons tab: use `Agent 5: Iconography`
- [`TODAY_LAUNCH_TASKS.md`](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_LAUNCH_TASKS.md) is the historical March 8 launch-slice prompt pack. Use it only when recreating that wave.

## 8. Coordinator Cadence
Every 20-30 minutes, coordinator posts:
- merged
- in review
- blocked
- next 3 actions

## 9. Immediate Merge Order
1. Shell and Canvas
2. Tool Runtime
3. Photo Edit Flow
4. PSD Export
5. Iconography

The iconography branch can proceed in parallel, but final UI integration should land after shell basics are stable.

## 10. Emergency Stop Message
Paste to all tabs if needed:

```text
Pause immediately. Do not commit new changes.
Post handoff with: worktree, branch, files changed, tests run, blockers.
Wait for re-assignment.
```
