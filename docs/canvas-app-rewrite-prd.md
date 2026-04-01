# Cue Canvas App Rewrite PRD

Status: draft
Last updated: 2026-04-01
Document owner: product / desktop runtime

## Purpose

This document defines a from-scratch rewrite of `desktop/src/canvas_app.js`.

The rewrite is not a product reset for Cue. It is an implementation reset for
the desktop canvas runtime. Cue should keep the same visible product statement:
an image-first desktop workspace with session tabs, direct canvas editing,
Design Review, reusable tools, and reproducible export receipts.

The goal is to replace the current single-file runtime with a modular runtime
that is easier to reason about, easier to test, and safer to change without
breaking shipped behavior.

## Rewrite Statement

Cue will rebuild the desktop canvas app from a blank implementation boundary.
The rewrite should not be a line-by-line port into another giant file. It
should start from locked product and runtime contracts, then rebuild the app as
a thin bootstrap plus explicit modules.

This rewrite is "from scratch" in implementation structure, not in product
behavior. Existing shipped capabilities and locked contracts remain the source
of truth unless this document explicitly says otherwise.

## Current Problem

Today `desktop/src/canvas_app.js` acts as all of the following at once:

- DOM registry
- settings store
- app state container
- session and tab runtime
- Tauri invoke wrapper
- PTY and run lifecycle manager
- engine event router
- canvas renderer
- shell chrome renderer
- input controller
- Agent Run bridge
- Design Review bridge
- export bridge

This creates several problems:

- one file owns too many responsibilities
- state mutation is difficult to trace
- DOM, rendering, runtime, and product logic are tightly coupled
- regressions are expensive because behavior is spread across a single mutable
  surface
- extraction work has started, but the composition root is still too large to
  treat as stable architecture

## Product Constraints

The rewrite must preserve the following product rules:

- keep user-facing naming on Cue
- keep the app image-first and direct-manipulation-first
- keep model-backed work reproducible through receipts
- keep public platform support statements honest
- keep macOS as the verified public desktop platform
- keep Windows and Linux described as roadmap work until they are verified

## Users And Stakeholders

- end users editing images on the Cue desktop canvas
- maintainers changing canvas behavior, session behavior, and runtime wiring
- agent and automation features that depend on the current runtime contracts
- shell integrations that use the global bridge surfaces
- release owners who need a stable macOS desktop runtime

## Product Statement

Cue desktop should remain one shared desktop window with multiple session tabs,
canvas-first image editing, model-assisted workflows, reusable tools, and
receipt-backed exports.

The rewrite should make that product easier to ship and safer to extend, while
keeping the current public slice recognizable to users and to existing tests.

## Goals

- replace the current monolithic app file with a thin composition root
- preserve current user-visible behavior across the main desktop flows
- preserve current runtime bridges, event contracts, and saved-session
  contracts unless explicitly versioned
- make tab state, canvas state, runtime state, and UI state explicit modules
- make desktop event handling route through isolated handlers instead of one
  large fallback function
- make rendering deterministic and centralized around a small number of
  renderer entrypoints
- keep current test coverage meaningful and make future tests more targeted
- reduce the cost of changing tabs, rendering, input, Agent Run, Design Review,
  and export flows independently

## Non-Goals

- no product redesign for Cue's visible desktop experience
- no required migration to React, TypeScript, or another frontend framework
- no expansion of the public agent surface beyond what is already shipped
- no change to public platform support claims
- no switch away from Tauri or the native desktop runtime
- no contract-breaking rewrite of saved session, timeline, receipt, or bridge
  formats in this phase
- no opportunistic rename of legacy internal `brood` or `juggernaut` strings
  beyond the existing documented allowlist

## What Must Still Ship

The rewrite must preserve the current public desktop slice:

- one desktop window with multiple session tabs
- create, open, rename, fork, activate, save, and close session tabs
- image import into the canvas
- multi-image canvas layout and single-image focus mode
- direct canvas tools and visible prep flows
- design review request and accepted-proposal apply
- Agent Run planning and execution against the active tab and active run
- reusable custom tool preview and registration
- export in `psd`, `png`, `jpg`, `webp`, and `tiff`
- receipt-backed artifact lineage beside the active run
- saved session reopen and saved timeline reopen
- runtime diagnostics, settings, and status affordances that exist today

## Locked Contracts

The rewrite may reorganize implementation freely behind adapters, but the
following contracts are locked for this phase.

### Product And Runtime Contracts

- Agent Run action contract documented in `docs/agent-runtime.md`
- observable driver surface documented in `docs/agent-runtime.md`
- current Design Review request/apply behavior against the visible canvas
- current export behavior and receipt expectations
- current active-tab scoping for Agent Run, runtime events, and artifacts

### Bridge Contracts

- `window.__JUGGERNAUT_SHELL__`
- `window[TABBED_SESSIONS_BRIDGE_KEY]`
- `window.__JUGGERNAUT_RUNTIME_FLAGS__`
- tool-apply bridge events:
  - `juggernaut:apply-tool`
  - `juggernaut:tool-applied`
  - `juggernaut:tool-apply-failed`

### Session And Artifact Contracts

- current run layout and `events.jsonl`
- current `cue.session.v1` compatibility requirements
- current `cue.timeline.v1` compatibility requirements
- current receipt-lineage expectations used by export, reopen, and apply flows
- current legacy reopen adapter behavior documented in feature notes

### Naming Constraints

- Cue remains the user-facing name
- documented legacy internal names stay behind the current allowlist until a
  separate migration document replaces them

## Rewrite Principles

- start from contracts and acceptance criteria, not from existing function
  boundaries
- keep `canvas_app.js` as a bootstrap and composition root only
- do not create a second monolith under a new filename
- make state ownership explicit
- make side effects explicit
- make bridge exposure explicit
- prefer small modules with one responsibility and a narrow dependency surface
- preserve deterministic save, reopen, and receipt behavior
- keep boot and render paths easy to profile

## Functional Requirements

### Boot

The rewritten app must:

- validate that required canvas and shell DOM nodes exist
- boot the desktop shell without leaving the app in a partial state
- install runtime bridges before external integrations depend on them
- initialize settings, diagnostics, and iconography before the main canvas loop
- create or bind the initial session tab and run correctly
- expose a clear boot-failure path when required primitives are missing

### Settings

The rewritten app must:

- load persisted desktop settings from local storage through one settings module
- preserve current stored keys and migrations unless a versioned replacement is
  introduced
- keep rail iconography, model choices, prompt strategy settings, and
  diagnostics preferences working
- separate settings persistence from runtime state mutation

### Session Tabs

The rewritten app must:

- keep per-tab session state isolated from app-global state
- support create, open, fork, rename, activate, and close flows
- keep active-tab hydration and preview behavior working
- keep the tab bridge contract stable for UI consumers
- keep each tab bound to its own run metadata and saved session state

### Canvas Runtime

The rewritten app must:

- preserve multi-image canvas mode and single-image mode
- preserve import, selection, multi-select, transform, and viewport behavior
- preserve active image, selected images, and visible-canvas semantics used by
  Agent Run and Design Review
- preserve placeholder and loading affordances for canvas images
- preserve effect-token and overlay drawing behavior that is part of the
  current product slice

### Input

The rewritten app must:

- keep pointer, keyboard, wheel, and gesture input as separate installable
  modules
- keep hit-testing and interaction state predictable
- ensure pointer capture and drag lifecycles are owned by explicit controllers
- avoid mixing input event registration with unrelated business logic

### Rendering

The rewritten app must:

- keep one explicit render scheduler
- keep canvas rendering isolated from DOM chrome rendering
- keep tab-strip, quick-action, shell chrome, timeline, and HUD rendering in
  focused modules
- support current tab-switch preview behavior and deferred hydration behavior
- keep render invalidation narrow enough that unrelated UI changes do not
  require full runtime recomputation

### Runtime And Engine Integration

The rewritten app must:

- keep Tauri invoke and desktop session lifecycle behind a dedicated runtime
  adapter
- preserve run creation, run open, PTY status, engine spawn, and session update
  behavior
- keep engine event intake routed through explicit event handlers
- keep artifact ingestion, status updates, and queue processing working against
  the active tab
- preserve current error handling and stale-event guards

### Agent Run, Design Review, And Create Tool

The rewritten app must:

- preserve current Agent Run contract and active-tab scoping
- preserve current visible prep behavior and review payload shaping
- preserve current Design Review request and apply flows
- preserve current custom tool preview and registration behavior
- preserve current tool-apply bridge behavior and response shaping

### Export

The rewritten app must:

- preserve the current export menu and format support
- preserve PSD export hooks and general export request behavior
- keep receipts and exported artifacts aligned with the active tab and active
  run
- keep existing export-related bridge and menu affordances working

### Diagnostics And Telemetry

The rewritten app must:

- preserve current runtime status surfaces
- preserve diagnostics visibility toggles and the current "minimalism" rules
- preserve current install telemetry behavior unless a separate telemetry PRD
  changes it
- keep status rendering and diagnostics rendering separate from core canvas
  rendering

## Architecture Requirements

The rewrite target is a modular runtime with a small composition root.

### Required Shape

`desktop/src/canvas_app.js` should become a thin bootstrap that:

- queries DOM once
- creates settings, store, runtime, renderers, controllers, and bridges
- wires subscriptions
- calls boot
- reports fatal boot failures

The app should move toward a structure like this:

```text
desktop/src/canvas_app.js
desktop/src/app/create_canvas_app.js
desktop/src/app/dom.js
desktop/src/app/settings_store.js
desktop/src/app/store.js
desktop/src/app/selectors.js
desktop/src/app/session_runtime.js
desktop/src/app/event_router.js
desktop/src/app/bridges/juggernaut_shell_bridge.js
desktop/src/app/bridges/tabbed_sessions_bridge.js
desktop/src/app/bridges/tool_apply_bridge.js
desktop/src/app/controllers/ui_controller.js
desktop/src/app/controllers/canvas_controller.js
desktop/src/app/controllers/session_controller.js
desktop/src/app/controllers/mother_controller.js
desktop/src/app/controllers/design_review_controller.js
desktop/src/app/render/canvas_renderer.js
desktop/src/app/render/chrome_renderer.js
desktop/src/app/render/timeline_renderer.js
desktop/src/app/render/tab_strip_renderer.js
```

Exact filenames may vary, but the boundaries may not collapse back into one
giant file.

### State Model

The new runtime must separate:

- app-global state
- per-tab session state
- persisted settings
- derived selectors
- transient input state
- runtime side-effect state

The store may remain plain JavaScript. A framework-level state library is not
required. What matters is explicit ownership and predictable update flow.

### Side-Effect Boundaries

The new runtime must keep these side effects behind explicit modules:

- local storage reads and writes
- Tauri invoke calls
- file system reads and writes
- engine session start, stop, and dispatch
- window bridge installation
- DOM event listener installation
- timers, animation frames, and observers

### Event Routing

The new runtime must route engine and desktop events through a handler map with
separate handler modules by event domain. The direction already started in
`desktop/src/event_handlers/` should become the default architecture, not a
thin wrapper around one large legacy fallback.

### Rendering Boundaries

The new runtime must separate:

- canvas drawing
- shell chrome rendering
- tab-strip rendering
- timeline rendering
- diagnostics rendering

Renderers may share selectors and utility math, but they should not directly
own runtime orchestration.

## Implementation Approach

This rewrite should be done as a greenfield runtime inside the current repo,
then switched into place once parity is proven.

### Required Delivery Model

- build the new runtime in parallel modules under a new app folder
- keep the current `desktop/src/canvas_app.js` monolith as the active shipped
  runtime until the rewrite proves parity
- keep the current entry file only as the final bootstrap target
- do not attempt a single massive in-place edit of the existing monolith
- use existing tests to lock behavior before removing old logic
- preserve bridge names and saved-data contracts during the transition

### Rollout Gate

The current monolithic `desktop/src/canvas_app.js` should remain in place until
the newly written runtime is proven safe to replace it.

The rewrite is not ready to become the default runtime until all of the
following are true:

- it preserves current product behavior and locked contracts
- it performs at parity with the current runtime or better on the main desktop
  flows
- it reduces total implementation size dramatically enough to count as a real
  simplification, not just a file split

Lower LOC is an explicit target for this rewrite. The goal is not merely to
move the current monolith into multiple files with the same overall size and
complexity. The replacement runtime should be materially smaller and easier to
reason about than the current implementation.

### Migration Strategy

1. Lock contracts with focused tests.
2. Create the new bootstrap, settings, store, and runtime adapters.
3. Move tab/session lifecycle into the new runtime.
4. Move render scheduling and canvas rendering into dedicated renderer modules.
5. Move input controllers into dedicated controller modules.
6. Move shell bridges, Agent Run hooks, Design Review hooks, and tool-apply
   hooks behind dedicated bridge/controller boundaries.
7. Switch `canvas_app.js` to the new composition root.
8. Delete unused legacy code only after parity checks pass.

## Acceptance Criteria

The rewrite is complete only when all of the following are true.

### Contract Acceptance

- current bridge contracts still work without requiring downstream callers to
  change
- current Agent Run and observable-driver contracts still work
- current save, reopen, export, and receipt flows still work
- current tab session bridge behavior still works

### Product Acceptance

- create, open, rename, fork, activate, save, and close tab flows work
- import, selection, transform, and viewport behavior work in the main canvas
  flows
- Design Review and Agent Run work against the active tab and active run
- custom tool preview and registration still work
- export still produces the supported formats with receipts

### Structural Acceptance

- `desktop/src/canvas_app.js` is reduced to a small bootstrap/composition root
- state, runtime, input, rendering, and bridges are in separate modules
- no replacement monolith appears under a new filename
- runtime side effects are isolated behind explicit adapters
- the replacement runtime is materially lower LOC than the current monolith,
  not just redistributed across more files

### Verification Acceptance

The rewrite must pass the normal desktop checks:

- `cd desktop && npm test`
- `cd desktop && npm run build`
- `cd desktop/src-tauri && cargo check`

## Success Metrics

The rewrite will be considered successful if it achieves all of the following:

- feature parity on the current public desktop slice
- performance parity or better on the main desktop flows
- stable bridge and saved-data compatibility
- materially smaller composition root
- dramatically lower total LOC than the current monolithic implementation
- lower change risk for tabs, rendering, runtime, and review features
- faster root-cause analysis for regressions because ownership is explicit
- no regression in the verified macOS release path

## Risks

- a "from scratch" effort may accidentally break hidden contracts that the
  current app file preserves implicitly
- moving too quickly may break active-tab scoping for Agent Run and runtime
  events
- render/input separation can introduce subtle hit-testing regressions
- saved session and timeline compatibility can be broken if the adapter boundary
  is not treated as locked
- bridge consumers may depend on undocumented behavior that still needs to be
  preserved for this phase

## Mitigations

- lock the known bridge and contract surfaces with tests before deleting legacy
  code
- keep parity checks for tab state, Agent Run, Design Review, export, and save
  / reopen flows
- preserve adapter layers where legacy naming or payload shape still matters
- move one domain at a time behind explicit modules instead of attempting one
  giant behavioral rewrite

## Open Questions

- should the new store remain plain objects plus actions, or does the team want
  a stricter reducer pattern
- should any currently implicit bridge behavior be documented as officially
  locked before the rewrite lands
- should renderers remain Canvas 2D only in this phase, or should any effect
  layers move behind a stronger scene abstraction
- which parity cases are still under-tested today and need dedicated coverage
  before deletion work starts

## Source Of Truth For This Rewrite

- `desktop/src/canvas_app.js`
- `desktop/src/tabbed_sessions.js`
- `desktop/src/tool_apply_runtime.js`
- `desktop/src/event_handlers/`
- `desktop/src/canvas_handlers/`
- `docs/agent-runtime.md`
- `docs/features/shell-canvas-integration.md`
- `docs/features/visual-timeline/README.md`
- `docs/legacy-internals.md`

## Direction

Cue should treat this rewrite as a product-stability project, not as a styling
exercise or framework migration. The finished result should keep the current
desktop product intact while replacing the current monolithic runtime with a
modular system that can support the next phase of desktop work without making
every change a whole-app risk.
