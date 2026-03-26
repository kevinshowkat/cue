# Warp Agent Workflow Wave Runbook (Cue)

Use this when launching the agent-workflow implementation wave for observable agent mode, new focus/review tools, and new direct affordances.

## 1. Base Branch
- Start from [`main`](/Users/mainframe/Desktop/projects/Juggernaut).
- This wave is scoped to:
  - observable agent mode
  - replayable visible tool driving
  - `Protect`
  - `Make Space`
  - `Remove People`
  - `Polish`
  - `Relight`
  - workflow-prior retrieval later in the wave

## 2. Goal
- Let agents use the real visible canvas tools for research and automated manual testing.
- Add the first new communication/review tools:
  - `Protect`
  - `Make Space`
- Add the first new direct affordances:
  - `Remove People`
  - `Polish`
  - `Relight`
- Keep the same core product direction:
  - text-free-first visible loop
  - provider-agnostic capability layer
  - reproducible receipts
  - active-tab safety

## 3. Warp Tabs
Open 6 Warp tabs total:
- 1 human control/setup tab in the main repo
- 5 Codex worker tabs in dedicated worktrees

## 4. Create And Warm Worktrees
Run once from the main Cue repo:

```bash
git fetch origin
git worktree add ../juggernaut-agent-observable-core -b feature/agent-observable-core origin/main
git worktree add ../juggernaut-agent-focus-review -b feature/agent-focus-review origin/main
git worktree add ../juggernaut-agent-direct-tools -b feature/agent-direct-tools origin/main
git worktree add ../juggernaut-agent-shell-integration -b feature/agent-shell-integration origin/main
git worktree add ../juggernaut-agent-verify -b feature/agent-verify origin/main
```

Install deps where needed:

```bash
cd /Users/mainframe/Desktop/projects/juggernaut-agent-observable-core/desktop && npm install
cd /Users/mainframe/Desktop/projects/juggernaut-agent-focus-review/desktop && npm install
cd /Users/mainframe/Desktop/projects/juggernaut-agent-direct-tools/desktop && npm install
cd /Users/mainframe/Desktop/projects/juggernaut-agent-shell-integration/desktop && npm install
cd /Users/mainframe/Desktop/projects/juggernaut-agent-verify/desktop && npm install
```

## 5. New Tab Paths
Human control tab:

```bash
cd /Users/mainframe/Desktop/projects/Juggernaut
```

Worker tabs:

```bash
cd /Users/mainframe/Desktop/projects/juggernaut-agent-observable-core && codex
cd /Users/mainframe/Desktop/projects/juggernaut-agent-focus-review && codex
cd /Users/mainframe/Desktop/projects/juggernaut-agent-direct-tools && codex
cd /Users/mainframe/Desktop/projects/juggernaut-agent-shell-integration && codex
cd /Users/mainframe/Desktop/projects/juggernaut-agent-verify && codex
```

## 6. Prompt Assignment
- human control tab: use this runbook
- observable-core tab: `Observable Core` from [`TODAY_AGENT_WORKFLOW_TASKS.md`](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_AGENT_WORKFLOW_TASKS.md)
- focus-review tab: `Focus / Review`
- direct-tools tab: `Direct Tools`
- shell-integration tab: `Shell Integration`
- verify tab: `Verify`

## 7. Ownership Split
- `feature/agent-observable-core`
  - owns `desktop/src/canvas_app.js`
  - owns new observable tool-driver and trace modules
  - owns replay traces and visible-tool driving only
  - does not own review contracts or rail exposure
- `feature/agent-focus-review`
  - owns `desktop/src/design_review_contract.js`
  - owns `desktop/src/design_review_bootstrap.js`
  - owns `desktop/src/design_review_pipeline.js`
  - owns `Protect` and `Make Space` semantics only
  - does not own `canvas_app.js`
- `feature/agent-direct-tools`
  - owns `desktop/src/single_image_capability_routing.js`
  - owns `desktop/src/tool_runtime.js`
  - owns `desktop/src/local_tool_edits.js`
  - owns `Remove People`, `Polish`, and `Relight` execution behavior
  - does not own rail UI
- `feature/agent-shell-integration`
  - owns `desktop/src/juggernaut_shell/rail.js`
  - owns `desktop/src/index.html`
  - owns icon assets and shell exposure
  - does not invent runtime semantics
- `feature/agent-verify`
  - owns tests and replay fixtures only
  - does not start independent feature work

## 8. Start Order
1. Start `observable-core`, `focus-review`, and `direct-tools` immediately.
2. Start `shell-integration` after tool ids and core contracts are stable.
3. Start `verify` after replay traces exist and at least one end-to-end flow is runnable.

## 9. First Flows To Ship
- `Marker -> Design Review -> Accept Proposal -> Export -> PSD`
- `Protect -> Remove People -> Export -> PSD`
- `Make Space -> Relight -> Export -> PSD`
- `Remove People -> Polish -> Export -> PSD`

## 10. Success Criteria
- Agents can drive visible `Marker`, `Magic Select`, and `Eraser` actions through stable tool-driver APIs.
- Observable sessions emit replayable traces suitable for automated manual testing.
- `Protect` and `Make Space` become real review/focus semantics.
- `Remove People`, `Polish`, and `Relight` are available as direct affordances.
- The shell exposes the new tools cleanly with correct enabled/disabled states.
- Verification covers the target flows and receipt generation.

## 11. Emergency Stop
Paste this if workers begin overlapping or mutating the wrong surface:

```text
Pause immediately. Do not commit new changes.
Post handoff with: worktree, branch, files changed, tests run, blockers, and any contract changes.
Wait for reassignment.
```
