# Juggernaut

Status: Draft v0.2  
Last updated: 2026-03-08  
Document owner: Product / founding team

## Purpose
Define a buildable product for a desktop design tool where images, gestures, live model calls, and generated tools replace most prompt writing and most traditional design vocabulary.

## Product Statement
Juggernaut is a text-free-first, image-first desktop design workstation for non-designers, developers, and 3D printing hobbyists. Users import images, the system infers intent, proposes edits in real time, lets users generate one-click custom tools, and exports editable 2D assets and printable 3D outputs with reproducible receipts.

## Decisions Incorporated On 2026-03-08
- Product name: `Juggernaut`.
- Main editing workflow: text-free to start.
- Icon system: custom iconography generated from the same pipeline family used for Oscillo bookend icon generation, with the starting reference at `../oscillo/scripts/generate_bookend_overlays.py`.
- Export requirement: native `.psd`, native `.ai`, and native `.fig` are release requirements.
- Native `.ai` and `.fig` exports must re-import into Juggernaut with high fidelity.
- Release requirement: macOS, Windows, and Linux parity at first release.
- Release parity means the same core feature set across macOS, Windows, and Linux, not identical performance or platform polish.
- 3D scope for v1: printable relief or mesh export only.
- Marketplace discovery such as VGen is phase 2, not MVP.
- Hidden accessibility labels and screen-reader metadata are allowed even when the visible main workflow remains text-free.
- Telemetry policy:
  - connected or non-local mode defaults to collection enabled with user opt-out
  - local-only mode defaults to no upload, with explicit user opt-in if they want to send anonymized data

## Key Clarification
"No words" and "Create Tool from words" conflict unless scoped carefully. Juggernaut resolves that by making the primary editing workflow text-free, while still allowing text in the following secondary surfaces:

- `Create Tool`
- settings
- receipts
- export dialogs
- accessibility and recovery flows

## Problem
Current creative tools fail this audience in three ways:

- They assume design vocabulary and prior training.
- They treat images as end results instead of first-class inputs for editing, reasoning, and tool creation.
- They offer AI generation, but not a guided, reproducible, fast workflow that remains useful after the first output.

## Thesis
There is "vibe coding" because code can be shaped through examples, suggestions, and generated tools. Design needs the same shift: users should work primarily through images, selection, arrangement, gesture, and one-click tools, while the system interprets intent and routes the right local operator, model call, or multi-step workflow behind the scenes.

## Target Users
### Primary
- Non-designers who need polished assets without learning pro design software.
- Developers who need fast visual iteration and custom design automation.
- 3D printing hobbyists who want to move from image or concept to printable output.

### Secondary
- Creative technologists who want an editable, model-aware canvas instead of one-shot generation.
- Small teams that need reproducible visual workflows and shareable receipts.

## Jobs To Be Done
- Turn one or more source images into a polished 2D asset without learning Photoshop, Illustrator, or Figma.
- Turn a concept image into a printable 3D-ready relief or mesh.
- Build reusable custom tools from plain-language instructions instead of coding them manually.
- Iterate quickly with AI assistance while preserving reproducibility and edit history.

## Product Principles
- Image-first: images, regions, layers, masks, and geometry are first-class inputs.
- Text-free-first: the main workflow should be operable without reading labels.
- Guided, not passive: the system proposes, previews, and routes; the user stays in control.
- Reproducible by default: every non-trivial operation writes a receipt.
- Local-first: cloud models are powerful, but local mode must stay credible and useful.
- Extensible: user-authored tools are core product value, not a plugin afterthought.
- Platformized: the action runtime must outlive the desktop shell.

## Release Goal
At release, Juggernaut is a cross-platform desktop app for macOS, Windows, and Linux that supports image upload, guided editing, generated custom tools, reproducible receipts, native `.psd`/`.ai`/`.fig` export, high-fidelity re-import of `.ai` and `.fig` assets produced by Juggernaut, and basic printable 3D output.

## Today Sprint Goal
By **5:30 PM America/Los_Angeles on Sunday, March 8, 2026**, produce a launchable vertical slice on the current Mac that:

- launches as a desktop app
- lets the user upload an image to the canvas
- lets the user add custom tools
- lets the user edit photos with those tools
- exports to PSD

This is a same-day launch slice, not the full release bar. Cross-platform parity and native `.ai`/`.fig` remain release requirements unless scope is later renegotiated.

## V1 Outcome
Users can open the app, drop in one or more images, see intent-aware edit suggestions, apply preset tools, create at least one custom tool from a short description, and export a result into native 2D design formats and basic printable 3D formats with reproducible receipts.

## V1 Non-Goals
- Replacing Photoshop or Figma feature-for-feature.
- Full parametric CAD.
- Full editable 3D scene authoring.
- Marketplace transactions or artist hiring workflows inside the editor.
- Day-one iPad release.

## Core User Experience
1. The user launches the app from the dock and lands on an immediately interactive canvas shell.
2. The user drags one or more images onto the canvas.
3. The system infers intent from image content, selection, layout, and recent actions.
4. The left rail shows 5-7 icon-only tools with no required text labels in the main editing loop.
5. The system proposes next edits in real time as the user moves, resizes, masks, or selects parts of the image.
6. The user opens `Create Tool`, describes a desired action in plain language, and receives a new one-click tool that plugs into the same tool system.
7. At export time, the app produces the asset plus a structured receipt showing how to reproduce the result.

## V1 Feature Scope
### 1. Canvas And Editing
- Infinite or effectively unbounded canvas.
- Multi-image import via drag-drop and file picker.
- Fast transforms: move, scale, rotate, skew, crop, mask, select region.
- Layer and region selection based on direct manipulation.
- Real-time preview pipeline for local transforms.

### 2. Intent Recognition And Guidance
- Continuously infer likely user intent from canvas state and image content.
- Display 1-3 proposed next actions as visual suggestions.
- Update suggestions after every material edit.
- Preserve user agency: suggestions are optional and reversible.

### 3. Preset Tools
V1 ships with 7 tools:

- `Select Subject`
- `Background Swap`
- `Cleanup`
- `Style Bridge`
- `Variations`
- `Make Printable`
- `Create Tool`

Notes:
- `Make Printable` converts supported inputs into depth-aware relief or watertight mesh output when possible.
- `Create Tool` is the flagship differentiator and must generate a reusable tool manifest plus runtime wiring.

### 4. Custom Tool Creation
- User opens a centered dialog and describes the desired tool in plain language.
- A coding-capable model generates a tool definition in a standard schema.
- The system chooses the right execution path: local transform, image-edit model call, multi-step workflow, or 3D conversion pipeline.
- Newly created tools appear in the same tool rail and update the user's evolving intent profile.
- Tool creation must include guardrails, previewability, and rollback if generation fails.

### 5. Model-Orchestrated Runtime
- Vision LLM calls are first-class runtime events, not a bolted-on assistant feature.
- The app can sustain multiple concurrent model tasks during one session:
  - intent inference
  - region understanding
  - proposal generation
  - tool synthesis
  - export analysis
- The UI must stay interactive while model calls are in flight.
- Remote and local model providers use the same internal action contract.

### 6. 2D And 3D Outputs
- 2D outputs: layered raster export plus native design-tool outputs.
- 3D outputs: relief or mesh export for supported toolchains and printable targets.
- Unsupported cases must fail clearly and preserve intermediate artifacts rather than silently flattening everything.

### 7. Export And Receipts
- Every export includes a reproducibility receipt.
- Receipts must contain:
  - source asset references
  - tool sequence
  - model/provider choices
  - parameter values
  - generated code or tool manifest references when relevant
  - manual user steps that cannot yet be automated
- Receipts are readable by both humans and machines.
- The app can analyze prior receipts and suggest cheaper or faster routes for similar workflows.

### 8. Local-Only Mode
- The app supports a local-only mode with no required internet access.
- In local-only mode, cloud-only tools are visibly disabled or swapped for local equivalents.
- Local-only mode still supports a meaningful subset of the core workflow:
  - import
  - canvas transforms
  - at least 3 preset tools
  - receipt generation
  - local export

### 9. Platformization
- The editing and tool runtime is not app-only.
- The same tool graph and receipt system must be callable through a local or remote API for future services and agents.
- Headless execution is a first-class design concern even if the first release is GUI-first.

### 10. Improvement Data Pipeline
- Connected or non-local mode defaults to improvement data enabled with opt-out controls.
- Local-only mode defaults to no upload, with explicit opt-in if the user wants to send anonymized bundles later.
- Upload packaging must be explicit, reviewable, and consent-aware.
- The anonymized bundle must exclude source images by default unless the user explicitly opts in.

## UX Requirements
- Primary workspace is visually driven and text-free in normal operation.
- Left rail is vertical, icon-only, and always visible.
- Custom iconography should be generated or derived from the Oscillo bookend icon pipeline rather than assembled from stock icon packs.
- The app uses a glassy layered material system on macOS, with platform-appropriate equivalents on Windows and Linux.
- Suggested edits appear as previews or icon cards, not chat bubbles.
- The editing surface must feel closer to Photoshop or Figma than to a chatbot.

## Technical Direction
### Baseline Architecture
- Reuse as much of `../brood` as practical, especially:
  - desktop shell patterns
  - canvas interaction model
  - provider orchestration concepts
  - run artifacts and receipts
- Reuse or adapt the icon-generation approach from `../oscillo/scripts/generate_bookend_overlays.py` for tool glyph creation.
- Default implementation direction:
  - Tauri desktop shell
  - GPU-accelerated 2D canvas layer
  - Rust-native action runtime and queue
  - provider adapter layer for remote and local models

### Runtime Requirements
- Sub-second perceived launch by loading the shell before heavier model initialization.
- Very low-latency transform loop for move, scale, color, and skew operations.
- Non-blocking concurrency for multiple in-flight LLM or image-model operations.
- Unified action schema for deterministic local edits and model-backed edits.

### Platform Requirements
- Release bar is parity across macOS, Windows, and Linux for core workflow support.
- The same action graph, tool schema, and receipt system must function across all three desktop targets.
- The same core feature set is required across all three desktop targets.
- Platform-specific performance and polish can vary slightly, but core capability gaps are not allowed at release.

### Provider Strategy
- Must support proprietary and local models behind one routing layer.
- First-party provider targets:
  - OpenAI
  - Google
  - Flux
- Fast-follow provider targets:
  - Qwen
  - Seedream
  - other high-signal Chinese model families
- Local routing must remain compatible with no-network mode.

## Export Targets
### Required Release Targets
- Native `.psd` with layered raster output where the edit graph supports layering.
- Native `.ai` with high-fidelity Juggernaut re-import.
- Native `.fig` with high-fidelity Juggernaut re-import.
- `stl` or `3mf` for supported printable outputs.

### V1 Practical Constraint
- The same-day March 8, 2026 sprint only requires a working PSD export path.
- Native `.ai` and `.fig` are still required before release.

## Acceptance Criteria
### Launch And Responsiveness
- On a November 2024 MacBook Pro M4 with 24 GB memory, the app shows an interactive shell in under 1 second from dock launch.
- Heavy subsystems may continue initializing after the shell appears, but the canvas must be usable immediately.
- Standard transforms on medium-resolution images must feel real time with no visible UI hitching.

### Core UX
- The main workspace includes a left vertical icon-only rail.
- The main editing workflow requires no text labels to operate.
- The UI uses a glass-material visual system on macOS and equivalent platform-native material styling elsewhere.
- The default workflow is image-led, not chat-led.
- The app offers 5-7 preset tools; V1 defines 7.

### Create Tool
- `Create Tool` opens a centered dialog.
- The user can type a short description of the desired tool.
- The system generates a new tool in the shared tool schema and selects an execution strategy automatically.
- The new tool can be previewed, saved, and reused within the session.

### Model And Mode Support
- The app supports remote and local model routing through one unified contract.
- The app includes a local-only mode that works without internet access.
- The runtime can maintain multiple simultaneous model tasks without freezing the UI.

### Reproducibility
- Export generates a receipt with enough information to reproduce the result.
- The system can inspect past receipts and recommend cheaper or faster workflow variants.

### Platformization And Data
- The core runtime is callable outside the app through an API surface.
- Users can create an anonymized improvement bundle for upload according to the telemetry policy above.

### Native Design Format Fidelity
- Juggernaut can export native `.ai` and `.fig` assets and later re-import those same assets with high fidelity.
- Round-trip support is part of the release bar, not a future enhancement.

## Delivery Plan
### Sprint 0: Today By 5:30 PM
- Fork or adapt `../brood` into a Juggernaut desktop shell.
- Achieve launchable image-upload-to-canvas loop.
- Add custom tool creation path.
- Wire at least one working photo-edit tool path.
- Export to PSD.

### Milestone 1: Interactive Cross-Platform Core
- Stabilize shell and canvas on macOS, Windows, and Linux.
- Preserve reproducible run artifacts from the start.
- Lock shared action schema and receipt format.

### Milestone 2: Guided Intent Loop
- Add live intent inference, visual suggestions, and non-blocking proposal pipeline.
- Stabilize concurrent provider calls and queue behavior.

### Milestone 3: Tool Runtime
- Ship preset tools plus `Create Tool`.
- Harden tool schema, execution sandbox, and rollback behavior.

### Milestone 4: Native Design Exports
- Add native `.ai` and native `.fig`.
- Harden PSD layering fidelity.
- Expose headless execution for services and agents.

### Milestone 5: Local-Only And Optimization
- Harden local mode.
- Add receipt analysis and workflow cost/performance recommendations.
- Add printable 3D export quality improvements.

## Risks
- Text-free UI and accessibility are naturally in tension unless secondary labels, narration, and screen-reader affordances are designed deliberately.
- Cross-platform first-release parity plus local-only mode plus native `.ai` and `.fig` is a wide release bar.
- Native `.fig` generation and high-fidelity re-import are especially high risk unless a supported file-writing pathway is validated early.
- Sub-second launch and heavy concurrent model orchestration are in tension unless initialization is aggressively staged.
- Reusing `../brood` accelerates delivery, but current upstream is macOS-first and 2D-image-first.

## Resolved Clarifications
- Native `.ai` and `.fig` must round-trip back into Juggernaut with high fidelity.
- Release parity across macOS, Windows, and Linux means the same core features.
- Hidden accessibility labels and screen-reader metadata are allowed even when visible labels are absent.
