# Warp Design Wave Runbook (Cue)

Historical note: this runbook preserves the original design-wave branch names, including `debrood` labels. Treat those as wave-history artifacts rather than current naming guidance.

Use this when repointing the existing Warp/Codex tabs from the launch slice to the design wave.

## 1. Base Branch
- Start from [`feature/launch-slice-integration`](/Users/mainframe/Desktop/projects/Juggernaut).
- Design work should branch from the integrated slice, not from the older first-wave feature branches.

## 2. Create And Warm Worktrees
Run once from the main Cue repo:

```bash
./scripts/create_juggernaut_design_worktrees.sh
./scripts/prep_juggernaut_design_worktrees.sh
```

## 3. Reuse Existing Tabs
Reuse the tabs you already have. Do not keep coding on the first-wave branches.

Recommended remap:
- old coordinator tab -> design coordinator
- old shell tab -> design layout
- old tools tab -> design visual system
- old edit tab -> design runtime declutter
- old export tab -> design iconography
- old icons tab -> optional native glass spike

In each tab:
1. end the current Codex session with `exit`
2. `cd` into the new design worktree
3. start a fresh session with `codex`
4. paste the new design-wave prompt

## 4. New Tab Paths
```bash
cd /Users/mainframe/Desktop/projects/juggernaut-design-coordinator && codex
cd /Users/mainframe/Desktop/projects/juggernaut-design-layout && codex
cd /Users/mainframe/Desktop/projects/juggernaut-design-visual && codex
cd /Users/mainframe/Desktop/projects/juggernaut-design-runtime && codex
cd /Users/mainframe/Desktop/projects/juggernaut-design-icons && codex
cd /Users/mainframe/Desktop/projects/juggernaut-design-native && codex
```

## 5. Prompt Assignment
- coordinator tab: `Coordinator` from [`TODAY_DESIGN_WAVE_TASKS.md`](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_DESIGN_WAVE_TASKS.md)
- layout tab: `Layout`
- visual tab: `Visual System`
- runtime tab: `Runtime`
- icons tab: `Iconography`
- native tab: `Optional Native Glass Spike`

## 6. Merge Order
1. `feature/design-shell-layout`
2. `feature/design-runtime-debrood`
3. `feature/design-visual-system`
4. `feature/design-iconography`
5. `feature/design-native-glass-spike` if the spike is cheap and clearly improves macOS

## 7. Emergency Stop
Paste this if the agents begin overlapping or design changes start breaking the launch slice:

```text
Pause immediately. Do not commit new changes.
Post handoff with: worktree, branch, files changed, tests run, blockers.
Wait for re-assignment.
```
