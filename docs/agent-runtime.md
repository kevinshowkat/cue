# Cue Agent Runtime Guide

Status: Draft v0.1  
Last updated: 2026-03-13

## Purpose
This document explains how an LLM or agent should use Cue as a constrained visual runtime. It is a companion to [agent-workflow-prd.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/agent-workflow-prd.md) and [agent-affordances.json](/Users/mainframe/Desktop/projects/Juggernaut/docs/agent-affordances.json).

## Core Model
Cue should be treated as 3 cooperating surfaces:
- `observe`: inspect current state without changing it
- `mutate`: change a tab, image, overlay, or export state
- `review`: generate and apply structured edit proposals through design review

An agent should prefer the loop:
1. observe
2. choose focus
3. decide direct execution vs review
4. mutate
5. observe again
6. evaluate progress
7. branch, revert, or export

## Working Rules
- Prefer `observe` before every expensive or destructive mutation.
- Treat `Marker`, `Highlight`, `Magic Select`, and `Eraser` as the current visible focus-setting tools, not final edits.
- Keep dormant `make_space` semantics available at the runtime layer, but do not advertise them as a current visible rail control.
- Use direct affordances when the desired edit class is already obvious.
- Use `Design review` when the goal is ambiguous, aesthetic, or multi-step.
- Use isolated tabs for speculative work when comparing options matters.
- Preserve reversible boundaries before high-cost actions.
- Do not rely on raw provider or model names as the main abstraction.

## Current Surfaces

### 0. Agent Run
Cue now includes a first-class `Agent Run` shell surface for live experimentation.

Current built-in controls:
- enter a freeform goal
- choose planner routing preference
- set a max step count
- `Step`
- `Auto`
- `Stop`
- inspect a live activity log and last returned plan

Current built-in execution path:
- plans through the shared design-review planner router
- executes visible `Marker`, `Highlight`, `Magic Select`, and `Eraser` actions through the observable driver
- can request or accept `Design review`
- can invoke seeded single-image jobs, direct affordances, custom tools, `Create Tool`, and PSD export

This surface is intended for:
- observing agent behavior inside the real app
- automated manual testing
- fast workflow experiments without a separate external harness

### 1. Direct Execution
Current visible direct execution affordances correspond to the exposed left-rail actions:
- `Cut Out`
- `Remove`
- `Reframe`
- `Variants`
- `Remove People`

The runtime also keeps hidden direct-execution affordances available for compatibility and non-rail callers:
- `New Background`
- `Polish`
- `Relight`

These are agent-facing affordances. Internally they resolve to stable `executionType` values such as:
- `subject_isolation`
- `targeted_remove`
- `people_removal`
- `background_replace`
- `crop_or_outpaint`
- `identity_preserving_variation`
- `image_polish`
- `image_relight`

Agents should reason from what the affordance does, not from the internal type name.

### 2. Focus And Scoping
Current focus affordances correspond to the right-side communication rail:
- `Marker`
- `Highlight`
- `Magic Select`
- `Eraser`

These are non-destructive communication operations.

`Make Space` remains a dormant runtime affordance for compatibility, but it is not currently exposed in the visible communication rail.

`Highlight` is not a no-edit constraint. It is a stronger review-focus signal that tells `Design review` which region and which circled images to prioritize.

Use them when:
- the target area is unclear
- design review needs spatial guidance
- a direct affordance requires tighter scope

Do not treat them as committed image edits. They alter overlay state, not exported pixels.

### 3. Design Review
`Design review` is the agent’s planning surface.

It should be used when the agent needs:
- candidate next actions
- ranked alternatives
- preview-backed proposals
- a path from ambiguous user goal to executable edit

`Design review` is not chat. It consumes visible canvas state plus focus hints and returns structured proposals that can be accepted into the normal execution layer.

### 4. Create Tool
`Create Tool` is a first-class tool-creation surface.

It should be used when the agent has identified a reusable edit pattern that deserves a named tool instead of another one-off execution.

Current behavior:
- accepts an optional tool name plus a required short description
- generates a deterministic local-edit tool manifest for the current slice
- previews that manifest before registration
- registers the new tool into the current session tool dock

Agents should prefer `Create Tool` when:
- the same edit would likely be reused within the session
- a successful operation should become a named shortcut
- the desired behavior fits Cue's current local-edit tool schema

Agents should not prefer `Create Tool` when:
- an existing affordance already matches the job
- the task is still ambiguous enough to need `Design review`
- the desired behavior depends on provider-specific prompt hacking instead of a stable Cue tool contract

## Direct Execution Vs Review

### Prefer Direct Execution When
- the user’s goal cleanly matches a known affordance
- scope is already clear
- speed and cost matter more than exploration
- the agent wants a deterministic next step

Examples:
- remove a small object
- isolate a subject
- generate variants after a finished cutout

### Prefer Design Review When
- the user’s goal is aesthetic or underspecified
- multiple edits might plausibly help
- the target area needs interpretation
- the agent wants ranked options before committing

Examples:
- make this hero image feel premium
- improve the composition without changing the subject
- figure out the best cleanup strategy around this marked area

## Focus Guidance Today
Current review guidance is mostly spatial.

The strongest current guidance signals are:
- communication marks
- active region candidates from `Magic Select`
- active or selected image context
- visible canvas composition
- cached upload analysis and account memory bias

Current review guidance is weak on:
- semantic goal steering
- explicit constraints
- acceptance criteria
- budget-aware planning

Agent workflow should add those through goal packets and focus specs without replacing the existing spatial signals.

## Execution Types And Route Profiles
Use this split:

- `executionType`: stable semantic operation
- `routeProfile`: implementation policy
- `receipt`: exact realized execution

Example:
- affordance: `Remove`
- execution type: `targeted_remove`
- route profile: `targeted_remove_default_v1`
- receipt: provider, model, params, cost, latency, artifacts

Do not make model names the primary identity of an edit. Model choice can change without changing what the affordance is for.

## Route Profile Guidance
Route profiles may encode:
- speed vs quality preference
- local-only vs connected requirements
- expected latency and cost class
- fallback strategy
- prompt-builder family

Exact provider/model/params should be captured in receipts after execution.

## Workflow Priors
Agents should be able to ask for prior successful workflows, not just current tool descriptions.

This should work like receipt retrieval over historically successful paths:
- similar goals
- similar image or canvas conditions
- similar export target
- similar constraints and budget

The result should be advisory guidance such as:
- likely-good step sequences
- example receipt refs
- expected success rate
- expected cost and latency
- known caveats

Good examples:
- `Highlight -> Design Review -> Accept Proposal -> Export PSD`
- `Remove People -> Polish -> Export PSD`
- `make_space` (runtime-only, currently hidden) -> Relight -> Export PSD

These priors should help an agent choose a starting path faster, but they should not eliminate exploration when the current task differs materially from historical winners.

## Minimal Agent Strategy
For a new task:
1. inspect tab state and visible assets
2. read the goal packet
3. retrieve workflow priors for similar successful exports when available
4. decide whether focus hints are needed
5. if the edit class is obvious, use a direct affordance
6. if a repeated local pattern should become reusable, consider `Create Tool`
7. if the edit class is not obvious, request design review
8. after any edit, evaluate progress
9. if quality is uncertain, branch before trying another approach
10. export only from the winning tab

## Safe Defaults
- default to one tab unless comparing alternatives matters
- create a reversible boundary before any high-cost action
- prefer one edit at a time over long uncontrolled chains
- avoid using design review repeatedly without incorporating new focus or new evidence
- use workflow priors as guidance, not as a mandatory script
- stop and export when the goal is met rather than continuing to optimize blindly

## What Agents Should Learn
Agents should learn:
- which affordance changes pixels
- which affordance only communicates focus
- when review is better than direct execution
- when a reusable pattern should become a tool instead of another one-off edit
- how to compare branch results against a goal
- how cost, latency, and privacy mode affect route choice

Agents should not need to learn:
- hardcoded provider names to use the app correctly
- UI click paths as the primary control surface
- hidden planner reasoning
