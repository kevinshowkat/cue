# Warp Review Apply Wave Runbook (Juggernaut)

Use this when repointing Codex tabs to land the review-accept apply path.

## 1. Base Branch
- Start from [`main`](/Users/mainframe/Desktop/projects/Juggernaut).
- This wave is scoped to review proposal acceptance, Gemini final apply, and active-tab image replacement.

## 2. Goal
- Let the user accept a design-review proposal from the communication tray.
- Route the accepted proposal through a real Gemini final-apply call using Nano Banana 2.
- Send Gemini one editable target image plus any additional reference images needed by the accepted proposal.
- Replace the target uploaded image in place inside the active tab.
- Keep the planner and preview split intact:
  - planner = `gpt-5.4`
  - preview = `gemini-3.1-flash-image-preview`
  - final apply = Gemini Nano Banana 2

## 3. Create And Warm Worktrees
Run once from the main Juggernaut repo:

```bash
git worktree add ../juggernaut-review-apply-coordinator -b feature/review-apply-coordination main
git worktree add ../juggernaut-review-apply-runtime -b feature/review-apply-runtime main
git worktree add ../juggernaut-review-apply-provider -b feature/review-apply-provider main
git worktree add ../juggernaut-review-apply-canvas -b feature/review-apply-canvas main
git worktree add ../juggernaut-review-apply-verify -b feature/review-apply-verify main
```

Install deps where needed:

```bash
cd /Users/mainframe/Desktop/projects/juggernaut-review-apply-runtime/desktop && npm install
cd /Users/mainframe/Desktop/projects/juggernaut-review-apply-provider/desktop && npm install
cd /Users/mainframe/Desktop/projects/juggernaut-review-apply-canvas/desktop && npm install
cd /Users/mainframe/Desktop/projects/juggernaut-review-apply-verify/desktop && npm install
```

## 4. New Tab Paths
```bash
cd /Users/mainframe/Desktop/projects/juggernaut-review-apply-coordinator && codex
cd /Users/mainframe/Desktop/projects/juggernaut-review-apply-runtime && codex
cd /Users/mainframe/Desktop/projects/juggernaut-review-apply-provider && codex
cd /Users/mainframe/Desktop/projects/juggernaut-review-apply-canvas && codex
cd /Users/mainframe/Desktop/projects/juggernaut-review-apply-verify && codex
```

## 5. Prompt Assignment
- coordinator tab: `Coordinator` from [`TODAY_REVIEW_APPLY_TASKS.md`](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_REVIEW_APPLY_TASKS.md)
- runtime tab: `Runtime`
- provider tab: `Provider / Backend`
- canvas tab: `Canvas / Tabs`
- verify tab: `Verify`

## 6. Ownership Split
- `feature/review-apply-runtime`
  - owns `desktop/src/design_review_pipeline.js`
  - owns `desktop/src/design_review_bootstrap.js`
  - may add one new review-apply runtime module if needed
  - does not own Rust or `canvas_app.js`
- `feature/review-apply-provider`
  - owns `desktop/src/design_review_contract.js`
  - owns `desktop/src/design_review_provider_router.js`
  - owns `desktop/src/design_review_backend.js`
  - owns `desktop/src-tauri/src/main.rs`
  - does not own tray state or canvas replacement
- `feature/review-apply-canvas`
  - owns `desktop/src/canvas_app.js`
  - owns `desktop/src/tabbed_sessions.js` only if busy-state hooks are required
  - owns replacement, receipt, timeline, and active-tab mutation wiring
  - does not own provider request payloads
- `feature/review-apply-verify`
  - owns cherry-pick verification only
  - may land test-only expectation updates if they are clearly stale and unrelated to behavior changes

## 7. Merge Order
1. `feature/review-apply-provider`
2. `feature/review-apply-runtime`
3. `feature/review-apply-canvas`
4. `feature/review-apply-verify` cherry-picks only if it contains test-only fixes

## 8. Success Criteria
- Accepting a ready proposal triggers a real final apply request.
- The final apply request uses Gemini Nano Banana 2, not the preview renderer.
- Cross-image proposals send all relevant reference images, but only one target image is edited and replaced.
- The resulting image replaces the target uploaded image in place.
- Replacement stays inside the active tab only.
- Tab switching is blocked or explicitly deferred while the apply is in flight.
- A receipt and timeline node are written for the replacement.
- Apply failures stay visible in the tray and expose debug payload data.

## 9. Emergency Stop
Paste this if workers begin overlapping or start mutating the wrong tab/runtime surface:

```text
Pause immediately. Do not commit new changes.
Post handoff with: worktree, branch, files changed, tests run, blockers, and any contract changes.
Wait for reassignment.
```
