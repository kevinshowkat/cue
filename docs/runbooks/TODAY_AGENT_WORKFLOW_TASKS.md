# Today Agent Workflow Tasks (Cue)

Historical prompt pack for the first observable-agent workflow build wave.

Update the branch names, worktree paths, and mission text before reusing these prompts.

## Shared Contract
- Observable agent mode must use visible canvas tools for focus/communication.
- Stable tool-driver APIs are allowed; brittle raw OS pointer automation is not required.
- Provider and model names stay out of the main editing loop.
- Receipts remain the source of truth for realized execution.
- The shell must not invent runtime semantics that differ from the worker-owned contracts.

## Observable Core
```text
You are the observable-core agent for Cue's agent workflow wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/docs/agent-workflow-prd.md
4) /Users/mainframe/Desktop/projects/Juggernaut/docs/agent-runtime.md
5) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_AGENT_WORKFLOW_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-agent-observable-core
- Branch: feature/agent-observable-core
- Own only:
  - desktop/src/canvas_app.js
  - new desktop/src/agent_observable_driver.js
  - new desktop/src/agent_trace_log.js
- You may add focused tests if needed
- Do not own review contracts or shell rail exposure

Build:
- Add stable observable tool-driver calls for:
  - marker stroke
  - magic-select click
  - eraser stroke
- These actions must render real visible state on canvas
- Emit replayable traces suitable for automated manual testing and debugging
- Keep observable mode on the same runtime path a human-visible session would use

Deliver:
- stable tool-driver surface
- replay trace shape
- focused tests
```

## Focus / Review
```text
You are the focus-review agent for Cue's agent workflow wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/docs/agent-workflow-prd.md
4) /Users/mainframe/Desktop/projects/Juggernaut/docs/agent-runtime.md
5) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_AGENT_WORKFLOW_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-agent-focus-review
- Branch: feature/agent-focus-review
- Own only:
  - desktop/src/design_review_contract.js
  - desktop/src/design_review_bootstrap.js
  - desktop/src/design_review_pipeline.js
- Do not own canvas_app.js
- Do not own shell rail exposure

Build:
- Add `Highlight` semantics for "focus design review here"
- Add `Make Space` semantics for "reserve or create room here"
- Preserve the existing review proposal/apply split
- Keep the output action-first

Deliver:
- review/focus contract updates
- proposal/runtime support
- focused tests
```

## Direct Tools
```text
You are the direct-tools agent for Cue's agent workflow wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/docs/agent-workflow-prd.md
4) /Users/mainframe/Desktop/projects/Juggernaut/docs/agent-runtime.md
5) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_AGENT_WORKFLOW_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-agent-direct-tools
- Branch: feature/agent-direct-tools
- Own only:
  - desktop/src/single_image_capability_routing.js
  - desktop/src/tool_runtime.js
  - desktop/src/local_tool_edits.js
- Do not own shell rail exposure

Build:
- Add `Remove People`
- Add `Polish`
- Add `Relight`
- Make `Polish` and `Relight` local-first where feasible and model-backed when needed
- Keep clean receipt behavior

Deliver:
- execution/capability updates
- local edit extensions where sensible
- focused tests
```

## Shell Integration
```text
You are the shell-integration agent for Cue's agent workflow wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/docs/agent-workflow-prd.md
4) /Users/mainframe/Desktop/projects/Juggernaut/docs/agent-runtime.md
5) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_AGENT_WORKFLOW_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-agent-shell-integration
- Branch: feature/agent-shell-integration
- Own only:
  - desktop/src/juggernaut_shell/rail.js
  - desktop/src/index.html
  - desktop/src/assets/juggernaut-rail-icons/*
- Wait for stable tool ids and contract names before starting

Build:
- Expose:
  - Highlight
  - Remove People
  - Polish
  - Make Space
  - Relight
- Keep shell behavior aligned with worker-owned runtime semantics

Deliver:
- rail exposure
- icons/labels
- enabled/disabled wiring
```

## Verify
```text
You are the verify agent for Cue's agent workflow wave.

Read and follow:
1) /Users/mainframe/Desktop/projects/Juggernaut/AGENTS.md
2) /Users/mainframe/Desktop/projects/Juggernaut/PRD.md
3) /Users/mainframe/Desktop/projects/Juggernaut/docs/agent-workflow-prd.md
4) /Users/mainframe/Desktop/projects/Juggernaut/docs/agent-runtime.md
5) /Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/TODAY_AGENT_WORKFLOW_TASKS.md

Hard constraints:
- Work only in /Users/mainframe/Desktop/projects/juggernaut-agent-verify
- Branch: feature/agent-verify
- Own tests only
- Do not start independent feature work

Mission:
- Verify these flows:
  1. Marker -> Design Review -> Accept Proposal -> Export -> PSD
  2. Highlight -> Remove People -> Export -> PSD
  3. Make Space -> Relight -> Export -> PSD
  4. Remove People -> Polish -> Export -> PSD
- Use replay traces where available
- Validate receipts and exported artifacts

Deliver:
- focused automated verification
- replay fixtures if needed
- report on exact tests run and remaining risks
```
