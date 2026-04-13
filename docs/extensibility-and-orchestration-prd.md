# Cue Extensibility And Orchestration PRD

Status: draft
Last updated: 2026-04-01
Document owner: product / desktop runtime / agent runtime

## Purpose

This document defines the next architectural layer for Cue after the current
public desktop, agent, and tool slices.

Cue already has a strong constrained visual runtime: an image-first desktop
workspace with session tabs, direct canvas editing, Design Review, reusable
tools, timeline restore points, and receipt-backed export. The next problem is
not that Cue needs a broader generic agent. The next problem is that Cue needs
clear extension, orchestration, and background-execution architecture so the
current product can grow without turning into a larger monolith.

This PRD defines that architecture.

## Summary

Cue should add a new platform layer with five parts:

- registry-driven runtime modules
- installable Cue Packs
- a first-class job runtime
- a separate batch and orchestrator mode
- startup and operability improvements

This work should make Cue easier to extend and safer to operate while keeping
the visible product centered on images, direct manipulation, reproducible
receipts, and honest macOS-first public support.

Cue should not copy the surface area of a general coding agent. It should copy
the structural lessons:

- explicit registries instead of ad hoc branching
- explicit modes instead of one overloaded planner
- explicit jobs instead of hidden long-running work
- explicit extension boundaries instead of hardcoded capability growth
- explicit startup and diagnostics paths instead of a single opaque boot path

## Why This Work Exists

Cue already has several strong primitives:

- a constrained Agent Run loop
- an observable visible-canvas driver
- deterministic local tool manifests
- timeline snapshots and receipt lineage
- run directories with stable artifact storage

Those are valuable. They also create the next set of constraints.

Today the codebase still has several architectural bottlenecks:

- too much orchestration is concentrated in `desktop/src/canvas_app.js`
- `Create Tool` is useful, but it is still effectively session-local and backed
  by a hardcoded built-in library
- there is no first-class job runtime for long-running review, variants,
  exports, warmup, or batch work
- the current planner is intentionally scoped to one bounded active-tab action,
  which is correct for editing but weak for orchestration
- startup cost and failure handling will become more brittle as more providers,
  models, packs, and runtime options are added
- Cue does not yet have a clean trust boundary for extension beyond internal
  runtime code

Without an explicit platform layer, each new capability will tend to increase
one of the following:

- `canvas_app.js` size
- branching and flag complexity
- boot cost
- hidden runtime coupling
- difficulty of verifying regressions

## Product Statement

Cue remains an image-first desktop app for editing, reviewing, and exporting
graphics. The visible editing loop stays centered on:

- images on a canvas
- direct user manipulation
- model-assisted review and transforms
- reusable tools
- reproducible receipts and artifacts

This PRD improves the architecture under that loop. It does not redefine Cue
as a generic shell, filesystem, or web agent.

## Product Constraints

The following product rules remain locked:

- keep user-facing naming on Cue
- keep the visible editing loop image-first and direct-manipulation-first
- keep model-backed work reproducible through receipts
- keep public platform support statements honest
- keep macOS as the verified public desktop platform
- keep Windows and Linux described as roadmap work until they are verified
- keep the current public agent surface stable unless a new versioned contract
  explicitly expands it

## Goals

- make capability growth registry-driven rather than monolith-driven
- turn `Create Tool` into the seed of a real Cue-native extension model
- add a first-class job runtime for background and durable work
- add a separate orchestration surface for batch and cross-tab workflows
- improve startup performance, lazy loading, and diagnostics
- preserve current session, timeline, artifact, and receipt compatibility
- reduce the amount of product logic concentrated in `canvas_app.js`
- make new capabilities easier to test in isolation

## Non-Goals

- no generic Bash, web, or broad filesystem authority for Cue agents
- no attempt to turn Cue into a coding shell or terminal-first assistant
- no arbitrary code execution inside Cue Packs in v1
- no generic MCP marketplace in this phase
- no multi-agent swarm product goal in this phase
- no contract-breaking rewrite of current run directories, timeline data, or
  receipts in this phase
- no change to public platform support claims
- no user-facing redesign of the existing image editing loop
- no forced migration to a new frontend framework in order to ship this work

## Users And Stakeholders

- end users editing images in Cue today
- power users who want reusable edit patterns, batch flows, and better control
  over repeated work
- maintainers changing runtime behavior, provider wiring, export behavior, and
  tab state
- release owners who need a stable, diagnosable macOS desktop product
- future contributors building new tools, review recipes, exports, and local
  runtimes inside Cue

## Design Principles

### Keep Editing And Orchestration Separate

Cue should keep the current bounded edit loop for live canvas work. Batch and
cross-tab orchestration should be a separate mode with its own scope, review,
and failure semantics.

### Prefer Registries Over Conditionals

New capabilities should be added through explicit registries with typed entries
instead of one-off conditionals spread across boot code, UI code, and runtime
handlers.

### Prefer Declarative Extension Before Executable Extension

Cue Packs in v1 should contribute structured manifests, presets, recipes, and
assets. They should not execute arbitrary code.

### All Long-Running Work Must Be Observable

If work can run for seconds or minutes, it should be a job with visible state,
progress, failure, retry, and cancel behavior.

### Preserve Reproducibility

Any capability that mutates pixels or produces artifacts must keep receipts,
lineage, and timeline integration compatible with Cue's current reproducibility
model.

### Load Only What The User Needs Now

Optional capability surfaces should be lazy-loaded. Cue should not pay full
startup cost for features that are not needed to open the first canvas session.

### Extend Cue's Domain, Not Someone Else's

Cue should extend image editing, review, export, and reproducible visual
workflows. It should not inherit broad unrelated product surfaces just because
another agent product supports them.

## Current State To Preserve

The following current public slices remain the source of truth for this phase:

- Agent Run and its current bounded next-action contract
- observable visible-canvas driver actions
- Design Review request and accepted-proposal apply
- in-session custom tool preview and registration
- current export formats and current flattened export behavior
- current session save, reopen, timeline restore, and receipt lineage behavior
- current run-directory model and artifact placement

This PRD is additive. It introduces new architecture and new optional surfaces.
It does not invalidate the existing public slice.

## Proposed Architecture

### 1. Runtime Kernel And Registries

Cue should replace ad hoc runtime growth with a small number of explicit
registry families.

#### Registry Families

- action registry
  Owns planner-visible actions and their contracts.
- observable action registry
  Owns lower-level replay and visible-canvas driver actions.
- review provider registry
  Owns review planners, preview providers, apply providers, and routing policy.
- tool generator registry
  Owns deterministic tool manifest generation strategies and built-in templates.
- export provider registry
  Owns export handlers, format support, limitations, and receipt policy.
- job handler registry
  Owns background job types and their execution state machines.
- pack registry
  Owns installed Cue Pack manifests and the capabilities they contribute.

#### Required Outcome

`desktop/src/canvas_app.js` should become a thin composition root that:

- boots the shell
- loads settings
- constructs registries
- wires stores and controllers
- installs bridges
- starts the first session

It should not remain the long-term location for most provider logic, registry
definitions, or background orchestration behavior.

#### Required Behavior

- each registry entry has a stable id and version
- each registry entry declares source and provenance
- each registry entry declares required surfaces and dependencies
- registry resolution is deterministic
- the app can explain which registry entry handled a request
- missing or incompatible entries fail explicitly instead of silently falling
  back through unrelated code

### 2. Cue Packs

A Cue Pack is a versioned installable bundle that extends Cue inside a narrow,
image-first domain.

Cue Packs are the main answer to "how should Cue become more extensible
without becoming a generic plugin host?"

#### Cue Pack Capabilities

In v1, a pack may contribute:

- tool templates and manifest presets
- review recipes
- export recipes
- provider presets and routing hints
- local-runtime descriptors
- capability metadata and assets used by Cue UI
- onboarding and help text for pack-owned capabilities

In v1, a pack may not contribute:

- arbitrary executable code
- shell commands
- unrestricted network behavior
- broad filesystem mutation logic

#### Pack Types

- bundled packs
  Ship with Cue and can be enabled or disabled.
- local packs
  Installed from a user-selected local file or folder.
- team packs
  Out of scope for v1, but the schemas should not prevent them later.

#### Relationship To Create Tool

`Create Tool` stays useful for fast in-session work. The new architecture adds
one step above that:

- session-local tool draft
- optional promotion into a reusable pack artifact

This lets Cue preserve fast local tool creation while also creating a real
platform boundary for reuse and installability.

#### Trust Model

Cue Pack installation must be explicit and inspectable.

Each pack must declare:

- pack id
- version
- author and source metadata
- declared capabilities
- required providers or local runtimes
- supported platform statements
- whether the pack is bundled or installed

Cue should surface pack provenance in the UI and in receipts whenever a pack
contributed directly to a user-visible result.

#### Storage Direction

Implementation should use a platform-appropriate app-support location for pack
storage and keep macOS as the verified path first. The path and migration
details can be finalized later, but the storage model should support:

- installed pack manifests
- pack assets
- enabled and disabled state
- cacheable derived indexes

### 3. Job Runtime

Cue needs a first-class job runtime for any work that can outlive a single
click path or planner round.

#### Why It Exists

The current product already has work types that naturally become jobs:

- Design Review preview generation
- review apply execution
- variants generation
- exports
- local runtime warmup
- pack install and validation
- batch orchestration work

Treating these as ad hoc promises inside UI code makes progress, retry,
cancellation, and restart behavior harder than necessary.

#### Job Model

Cue should add a versioned job contract, with at least:

- job id
- job type
- source surface
- scope
- requested inputs
- execution status
- progress summary
- created-at and updated-at timestamps
- output artifact references
- receipt references when applicable
- retry and cancel eligibility

#### Job States

Minimum required states:

- queued
- running
- blocked
- succeeded
- failed
- canceled

#### Job Guarantees

- every job is visible in the UI
- every job can report progress or explicitly report that progress is unknown
- every failed job has a stable error summary
- eligible jobs can be retried
- eligible jobs can be canceled
- restart-safe jobs survive app relaunch
- job outputs can be traced back to source tab, source run, source pack, and
  source provider metadata when those exist

#### Scope Model

Jobs may be:

- app-scoped
- tab-scoped
- run-scoped
- selection-scoped
- batch-plan-scoped

This lets Cue support both local UI tasks and durable run artifacts without
forcing every job into one storage location.

#### Persistence Direction

The architecture should support:

- app-global queue and metadata storage in app support
- run-local artifacts and receipts in the existing run directory
- event and receipt linkage back to the active run when a job materially
  changes that run

#### Mutation Rule

Batch or background mutation must not feel like silent hidden editing.

In v1:

- jobs that mutate pixels must be explicitly launched by the user or by a
  clearly scoped orchestrator plan
- job outputs must attach to the correct tab or run with visible attribution
- multi-target mutation should prefer staged, forked, or clearly labeled
  outputs over silent live mutation across many active canvases

### 4. Batch And Orchestrator Mode

Cue should add a separate orchestration mode for structured multi-step work.

The current Agent Run loop is good for bounded active-tab editing. It should
remain that way.

The new orchestrator mode should exist for work such as:

- review many selected images
- generate variant sets across a scoped selection
- export many tabs or images
- apply one approved reusable tool across a scoped selection
- compare two tabs or two result branches
- queue alternate outputs onto forked tabs

#### Core Rule

The orchestrator is not an unrestricted chat surface.

It should:

- work from explicit scope
- emit a typed plan or a typed job set
- use only registered capability types
- hand long-running work to the job runtime
- keep review and approval boundaries visible

It should not:

- gain generic broad filesystem or shell authority
- replace the live bounded editing planner
- silently invent new capability types outside the registry system

#### Orchestrator Inputs

Minimum required inputs:

- selected scope
- requested outcome
- allowed operation classes
- output target policy
- approval policy

#### Orchestrator Outputs

Minimum required outputs:

- a typed batch plan
- one or more jobs derived from that plan
- a user-visible explanation of what will happen
- a stable link from jobs back to the plan that created them

#### First-Wave Orchestrator Scenarios

The first shipped scenarios should be narrow and concrete:

- run Design Review across selected images
- export selected tabs to one or more formats
- apply a selected reusable tool across a scoped image set
- generate variants for a selected image set into forked outputs
- compare two tabs and summarize result differences

### 5. Startup And Operability

Cue should adopt stronger startup and diagnostics discipline before the product
surface grows further.

#### Required Startup Work

- add a startup profiler with clear boot checkpoints
- load required settings and run context early
- lazy-load optional heavy surfaces
- make pack indexing asynchronous and cacheable
- make provider adapters and diagnostics surfaces load on demand when possible
- keep the first session boot path as small as possible

#### Required Diagnostics

- startup timing summary
- pack load failures
- registry resolution failures
- provider routing failures
- job execution failures
- queue health summary

#### Required Failure Behavior

- optional pack or provider failure must not block the entire app boot path
- incompatible pack contributions must fail closed
- missing optional runtime dependencies must surface as scoped capability
  unavailability rather than generic app failure

## Functional Requirements

### Boot And Composition

The new architecture must:

- keep boot order explicit
- install required bridges before dependent UI surfaces need them
- separate bootstrap from long-lived runtime services
- make it possible to boot Cue with only bundled baseline capabilities loaded
- keep the first tab usable even if optional packs or optional providers are
  unavailable

### Settings And Feature Gates

The new architecture must:

- keep persisted settings isolated from session state and job state
- allow registries and packs to be gated cleanly
- avoid spreading feature gating through unrelated product logic
- keep macOS-first support statements attached to capability metadata when
  needed

### Capability Registration

The new architecture must:

- let bundled and installed capabilities register through one shared model
- validate every registration payload
- prevent id collisions without explicit version or replacement rules
- keep the UI able to explain where a visible capability came from

### Pack Installation And Management

The pack system must:

- validate pack manifests before enablement
- allow enable, disable, install, remove, and inspect flows
- surface incompatibility and missing dependency states
- preserve user trust with explicit provenance
- avoid executing arbitrary pack code in v1

### Job Execution

The job system must:

- support queueing and execution of typed jobs
- support status polling and event-driven UI updates
- attach receipts and artifacts where appropriate
- survive app relaunch for eligible job types
- support cancel and retry where meaningful
- expose progress without requiring the user to keep one tab open

### Orchestrator Mode

The orchestrator mode must:

- exist as a separate product surface from the current live edit planner
- be scoped to explicit selections, tabs, runs, or artifacts
- produce typed plans and jobs, not unrestricted hidden execution
- make approval and result placement visible
- preserve the existing bounded Agent Run slice

### Timeline And Receipt Integration

The new architecture must:

- preserve current timeline restore and receipt lineage semantics
- attach job-produced artifacts to the correct run lineage
- keep pack provenance and provider provenance available to receipts when
  directly relevant
- avoid creating orphaned outputs that cannot be traced back to user-visible
  actions

## New Contracts

This work should add versioned contracts instead of extending hidden internal
objects without documentation.

### Proposed New Schemas

- `cue.pack.v1`
  Declares a Cue Pack and its contributions.
- `cue.job.v1`
  Declares a durable job record.
- `cue.job_event.v1`
  Declares append-only job execution events.
- `cue.batch_plan.v1`
  Declares a typed orchestrator plan and its derived jobs.

### Existing Locked Contracts

The following remain locked for this phase:

- current Agent Run contract
- current observable driver contract
- current `cue.session.v1` compatibility requirements
- current `cue.timeline.v1` compatibility requirements
- current receipt-lineage expectations
- current export contract behavior unless explicitly versioned

## Proposed File And Module Direction

The exact file tree can change, but the architecture should move toward a shape
like this:

- `desktop/src/app/`
  Bootstrap, app wiring, high-level composition.
- `desktop/src/runtime/registries/`
  Registry types, loaders, validators, and resolvers.
- `desktop/src/packs/`
  Pack schemas, storage, install flows, and pack-derived registration.
- `desktop/src/jobs/`
  Job contracts, queueing, execution, persistence, and events.
- `desktop/src/orchestrator/`
  Batch-plan contracts, orchestration UI, and job-set generation.
- `desktop/src/startup/`
  Profiling, lazy-loading, boot guards, and diagnostics.

This should reduce the amount of runtime behavior owned directly by
`canvas_app.js` while keeping that file as the primary composition root for the
desktop app.

## UX Surface Direction

### Pack Library

Cue should add a Pack Library surface where users can:

- inspect installed packs
- inspect bundled packs
- enable or disable packs
- inspect pack provenance
- inspect missing dependencies or unsupported-platform states

### Job Queue

Cue should add a Job Queue surface where users can:

- see queued and running work
- inspect recent successes and failures
- cancel jobs
- retry eligible jobs
- open the output tab, artifact, or receipt for a completed job

### Batch Launcher

Cue should add a Batch surface where users can:

- define scope
- choose one supported orchestrator scenario
- preview the resulting plan
- approve launch into jobs
- monitor completion

### Tab And Timeline Affordances

Cue should add:

- tab-level indicators for running or failed jobs tied to that tab
- timeline markers or metadata for completed background mutations
- receipt links from job results back into the existing run directory model

## Delivery Plan

### Phase 0: Foundations

- add startup profiler
- define registry interfaces
- extract initial registries from monolithic runtime wiring
- define pack, job, and batch-plan schemas
- keep all new surfaces behind internal flags

Exit criteria:

- startup checkpoints are visible in diagnostics
- at least one existing capability type resolves through a registry
- new schemas exist in draft form

### Phase 1: Registry And Pack Baseline

- move built-in tool generator logic behind a tool generator registry
- add bundled pack support
- add local pack install and validation flow
- keep packs declarative only

Exit criteria:

- at least one bundled capability ships through the pack path
- pack enable and disable state works without app restart if feasible
- pack provenance is visible in UI metadata

### Phase 2: Job Runtime

- add queue, persistence, execution state machine, and UI surface
- migrate one or more long-running flows to jobs
- add cancel and retry for eligible job types

Exit criteria:

- at least export and one model-backed flow run through the job runtime
- jobs survive restart where the handler supports resume
- outputs and receipts remain traceable

### Phase 3: Orchestrator Mode

- add separate batch launcher
- add first-wave orchestrator scenarios
- connect orchestrator outputs to the job runtime

Exit criteria:

- users can launch and monitor at least three scoped batch scenarios
- the current bounded Agent Run planner remains unchanged for live edit work

### Phase 4: Hardening And Public Documentation

- write user-facing docs
- document new contracts
- tune startup and lazy-loading budgets
- tighten regression coverage around packs, jobs, and orchestration

Exit criteria:

- docs are updated
- diagnostics are sufficient for release triage
- regressions in the current public slice are covered by explicit tests

## Acceptance Criteria

This initiative is successful when all of the following are true:

- Cue can add a new supported tool, review recipe, or export recipe through a
  registry and or pack path without adding another ad hoc branch in the main
  composition root
- users can install or enable a Cue Pack and see its provenance
- users can run long-lived work through a visible queue with progress, retry,
  cancel, and traceable outputs
- users can launch scoped multi-image or multi-tab workflows through a separate
  orchestrator surface without broadening the current bounded edit planner
- startup remains diagnosable and optional capability failures do not block the
  baseline desktop app
- current save, reopen, timeline, and receipt flows remain compatible

## Risks

### Over-Platforming Too Early

Risk:
The architecture could become more abstract than the current product needs.

Mitigation:
Tie each registry, pack surface, and job type to one concrete shipped use case
before expanding it.

### Pack Trust Confusion

Risk:
Users may not understand what installing a pack allows.

Mitigation:
Keep v1 declarative only, surface provenance clearly, and avoid arbitrary code
execution.

### Background Mutation Confusion

Risk:
Users may lose confidence if background work changes visible canvases in ways
that feel hidden.

Mitigation:
Prefer staged or clearly attributed outputs for multi-target mutations and
surface every job visibly.

### Contract Sprawl

Risk:
New schemas could become another undocumented internal layer.

Mitigation:
Document each new schema explicitly and version it from the start.

### Startup Regressions

Risk:
Registry loading, pack indexing, and job persistence could slow first launch.

Mitigation:
Add startup profiling early and require lazy loading for optional surfaces.

## Open Questions

- should promoted `Create Tool` drafts become standalone pack artifacts or pack
  fragments merged into a user tools pack
- should pack installation require app restart in v1 or should hot enablement
  be supported from the start
- which job types should be restart-safe in the first release
- should batch mutation default to forked tabs, staged artifacts, or direct
  scoped mutation for each scenario type
- how much job history should live in app support versus run-local storage
- when should Cue support team-shared packs, if at all
- should a future pack system allow sandboxed executable logic such as WASM, or
  should Cue stay declarative long-term

## Related Docs

- `docs/desktop.md`
- `docs/agent-runtime.md`
- `docs/agent-workflow-prd.md`
- `docs/canvas-app-rewrite-prd.md`
- `docs/features/visual-timeline/README.md`
