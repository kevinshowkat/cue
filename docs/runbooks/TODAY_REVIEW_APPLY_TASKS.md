# Today Review Apply Tasks (Juggernaut)

Use these prompts for the March 9, 2026 review-apply wave. The goal is to let users accept a design-review proposal and run a real Gemini final edit that replaces the target image in the active tab.

## Review Apply Contract
- Communication tray remains the only review surface.
- Planner stays `gpt-5.4`.
- Planner reasoning remains `medium`.
- Preview stays `gemini-3.1-flash-image-preview`.
- Final apply uses Gemini Nano Banana 2.
- If the provider-facing model id differs from the nickname, pin that mapping once in shared constants and preserve the requested vs normalized model in debug info.
- Accept uses `proposal.imageId` as the first target choice, then falls back to `request.primaryImageId`.
- Final apply uses `proposal.applyBrief` as the core instruction, not `previewBrief`.
- Final apply sends exactly one editable `targetImage` plus any additional `referenceImages[]` needed for the proposal.
- Gemini must be instructed to edit only `targetImage` and use `referenceImages[]` as guidance only.
- The rendered output replaces the target uploaded image in place.
- Replacing in place means the same `imageId`, transform state, selection state, z-order, and active-tab context are preserved.
- Use the existing receipt and timeline path rather than inventing a review-only artifact system.
- All review/apply state is tab-local.
- Accepting a proposal in one tab must never mutate another tab.
- While apply is running, tab switching must be blocked or explicitly deferred using the existing busy-tab contract.
- Failures must remain visible in the tray and expose debug payload details for the apply request.

## Coordinator
```text
You are the coordinator for Juggernaut's March 9 review-apply wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/AGENT_PROMPTS.md
4) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_REVIEW_APPLY_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-review-apply-coordinator
- Branch: feature/review-apply-coordination
- Own coordination only
- Do not rewrite product behavior except PRD or runbook notes required for the wave

Mission:
- Keep ownership clean across runtime, provider, canvas, and verify workers
- Enforce the review-apply contract exactly
- Make sure the final behavior is:
  1. user accepts proposal
  2. Gemini final apply runs
  3. target image is replaced in place in the active tab
- Prevent overlap on:
  - desktop/src/design_review_contract.js
  - desktop/src/design_review_bootstrap.js
  - desktop/src/design_review_pipeline.js
  - desktop/src/design_review_provider_router.js
  - desktop/src-tauri/src/main.rs
  - desktop/src/canvas_app.js
- Keep merge order clean:
  1. review-apply-provider
  2. review-apply-runtime
  3. review-apply-canvas
  4. verify cherry-picks only if needed
- Ask every worker for:
  - files changed
  - tests run
  - blockers
  - contract changes
- Post concise status every 20 minutes
```

## Runtime
```text
You are the runtime agent for Juggernaut's March 9 review-apply wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/AGENT_PROMPTS.md
4) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_REVIEW_APPLY_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-review-apply-runtime
- Branch: feature/review-apply-runtime
- Own review runtime state and tray wiring only
- Primary files:
  - desktop/src/design_review_pipeline.js
  - desktop/src/design_review_bootstrap.js
- You may add one new review-apply runtime helper module if that keeps file ownership cleaner
- Do not own Rust provider code
- Do not own canvas replacement internals in canvas_app.js

Build:
- Extend review runtime state so a proposal can move from preview-ready to apply-running to apply-succeeded or apply-failed
- Keep accept memory recording behavior, but make accept also start a real final apply through an injected/app-owned apply path
- Preserve the communication tray as the only review surface
- Disable duplicate accepts while one proposal is applying for the same review request
- Dispatch structured apply events that include enough detail for the canvas runtime to replace the image:
  - requestId
  - sessionKey
  - proposal
  - request snapshot
  - target image id
  - reference image ids
  - output path on success
  - debug info on failure
- Keep all runtime state tab-local
- Keep failure slots visible in the tray and expose debug payload for apply failures, not only planner/preview failures

Deliver:
- review runtime state machine for final apply
- tray accept/applying/failed wiring
- tab-local apply events ready for canvas consumption
- focused JS tests

Suggested tests:
- desktop/test/design_review_pipeline.test.js
- desktop/test/design_review_bootstrap_contract.test.js
- desktop/test/design_review_bootstrap_runtime_state.test.js

Do not:
- add a second review surface
- mutate image data directly from the tray runtime
```

## Provider / Backend
```text
You are the provider/backend agent for Juggernaut's March 9 review-apply wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/AGENT_PROMPTS.md
4) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_REVIEW_APPLY_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-review-apply-provider
- Branch: feature/review-apply-provider
- Own provider request shape, prompt contract, and Rust backend only
- Primary files:
  - desktop/src/design_review_contract.js
  - desktop/src/design_review_provider_router.js
  - desktop/src/design_review_backend.js
  - desktop/src-tauri/src/main.rs
- Do not own tray UI state
- Do not own canvas replacement

Build:
- Add a final-apply model constant for Gemini Nano Banana 2
- Keep the exact provider model id in one place; if normalization is required, preserve both requested and normalized values in debug info
- Add a dedicated review apply prompt builder using:
  - request snapshot
  - proposal label
  - proposal actionType
  - proposal applyBrief
  - proposal targetRegion
  - negativeConstraints
- Add an apply request contract that distinguishes:
  - `targetImage`
  - `referenceImages[]`
- Final apply must send all relevant proposal images to Gemini when the proposal depends on cross-image context.
- Final apply prompt must explicitly say:
  - edit only `targetImage`
  - use `referenceImages[]` as guidance only
  - return one final rendered image for `targetImage`
- Add providerRouter.runApply(...)
- Extend the Tauri design-review provider command with kind="apply"
- Implement the Google Gemini final apply path first
- Final apply must consume the target image path, include any additional reference image paths, and write a high-quality output image to a requested output path
- Keep preview path unchanged
- Return shaped errors and debug payloads with:
  - provider
  - requested model
  - normalized model
  - transport
  - prompt
  - target image path
  - reference image paths
  - output path
- Prefer Gemini-only behavior for final apply; do not silently route final apply to OpenAI

Deliver:
- apply request contract
- Gemini final-apply backend path
- debug payload support for apply failures
- focused JS and Rust tests

Suggested tests:
- desktop/test/design_review_contract.test.js
- desktop/test/design_review_provider_router.test.js
- desktop/test/design_review_runtime_contract.test.js
- cargo test --manifest-path desktop/src-tauri/Cargo.toml planner_

Do not:
- change planner or preview behavior unless required by the apply path
- scatter raw apply-model strings across JS and Rust
```

## Canvas / Tabs
```text
You are the canvas/tabs agent for Juggernaut's March 9 review-apply wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/AGENT_PROMPTS.md
4) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_REVIEW_APPLY_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-review-apply-canvas
- Branch: feature/review-apply-canvas
- Own canvas mutation, receipt, and tab-busy integration only
- Primary files:
  - desktop/src/canvas_app.js
  - desktop/src/tabbed_sessions.js only if busy/deferred tab state needs a small hook
- Do not own provider payloads
- Do not own tray UI copy/state except event-consumption wiring

Build:
- Consume the review apply success/failure events from the runtime layer
- Resolve the target image from the event payload and replace that image in place
- Reuse the existing replacement path centered on replaceImageInPlace(...)
- Preserve:
  - image id
  - rect/transform
  - selection
  - z-order
  - active tab
- Write a receipt for the accepted review apply and record a timeline node for the replacement
- Do not add a sibling artifact when a valid target image exists
- Mark the active tab busy while review apply is in flight
- Prevent another tab from being mutated by a stale apply completion event
- Clear busy state on both success and failure

Deliver:
- review apply event consumer in canvas runtime
- in-place replacement path for accepted review proposals
- receipt/timeline integration
- focused tests for active-tab safety and replacement semantics

Suggested tests:
- desktop/test/tabbed_sessions_v1_contract.test.js
- desktop/test/canvas_app_review_cleanup_regression.test.js
- desktop/test/tool_apply_bridge.test.js if bridge behavior is reused

Do not:
- add a second image for the final accepted edit when a target image is present
- break existing effect-token or Mother replacement paths
```

## Verify
```text
You are the verify agent for Juggernaut's March 9 review-apply wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/AGENT_PROMPTS.md
4) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_REVIEW_APPLY_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-review-apply-verify
- Branch: feature/review-apply-verify
- Own verification only
- Do not start independent feature work
- If you patch tests, keep them clearly test-only and call them out explicitly

Mission:
- Cherry-pick provider, runtime, and canvas commits in merge order
- Run focused verification first, then wider checks if the branch is stable
- Confirm the final behavior:
  1. accept proposal in tab A
  2. Gemini final apply runs
  3. target image in tab A is replaced in place
  4. tab B remains unchanged
  5. switching during apply is blocked or deferred
  6. failures expose debug payload

Suggested verification:
- cd desktop && node --test test/design_review_contract.test.js
- cd desktop && node --test test/design_review_pipeline.test.js
- cd desktop && node --test test/design_review_provider_router.test.js
- cd desktop && node --test test/design_review_bootstrap_contract.test.js
- cd desktop && node --test test/design_review_bootstrap_runtime_state.test.js
- cd desktop && node --test test/design_review_runtime_contract.test.js
- cd desktop && node --test test/tabbed_sessions_v1_contract.test.js
- cd desktop && npm run build
- cargo test --manifest-path desktop/src-tauri/Cargo.toml planner_

Manual smoke:
- Launch from /Users/mainframe/Desktop/projects/Juggernaut/desktop
- Create two tabs
- Upload two images in tab 1 when testing a cross-image proposal
- Run Design review
- Accept one ready proposal
- Confirm tray shows apply-in-flight state
- Confirm Gemini receives one editable target plus the needed reference image inputs
- Confirm the final Gemini render replaces only the target image in tab 1
- Confirm tab 2 does not change
- Confirm debug payload appears if the apply fails

Report:
- exact commits verified
- exact tests run
- manual behavior observed
- remaining risks
```
