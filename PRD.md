# Juggernaut

Status: Draft v0.2  
Last updated: 2026-03-25  
Document owner: Product / founding team

## Purpose
Define a buildable product for a desktop design tool where images, gestures, live model calls, and generated tools replace most prompt writing and most traditional design vocabulary.

## Product Statement
Juggernaut is a text-free-first, image-first desktop design workstation for non-designers, developers, and 3D printing hobbyists. Users import images, the system infers intent, proposes edits in real time, lets users generate one-click custom tools, and exports editable 2D assets and printable 3D outputs with reproducible receipts.

## Decisions Incorporated On 2026-03-08
- Product name: `Juggernaut`.
- Main editing workflow: text-free to start.
- V1 primary wedge: single-image-first. The primary loop is one image in, usable asset out.
- V1 primary rail shape: stable `Upload` and `Select` anchors plus 3 dynamic suggested job slots.
- Product split:
  - left rail = deterministic precomputed action library
  - bottom rail = communication layer for complex or non-prebaked changes
- V1 bottom communication rail tools: `Marker`, `Protect`, `Magic Select`, `Make Space`, `Eraser`.
- V1 shell model: single-window, Warp-style session tabs over one shared canvas surface.
- `Create Tool` remains core product value, but for the single-image-first wedge it moves to a secondary follow-on surface such as `Save Shortcut`.
- Icon system: custom iconography generated from the same pipeline family used for Oscillo bookend icon generation, with the starting reference at `../oscillo/scripts/generate_bookend_overlays.py`.
- Export requirement: native `.psd`, native `.ai`, and native `.fig` are release requirements.
- Native `.ai` and `.fig` exports must re-import into Juggernaut with high fidelity.
- Release requirement: macOS, Windows, and Linux parity at first release.
- Release parity means the same core feature set across macOS, Windows, and Linux, not identical performance or platform polish.
- 3D scope for v1: printable relief or mesh export only.
- Marketplace discovery such as VGen is phase 2, not MVP.
- Hidden accessibility labels and screen-reader metadata are allowed even when the visible main workflow remains text-free.
- Actionable controls must surface external model cost with a text-free sapphire-blue dot in the top-right corner of any action that may invoke an external model, while hidden labels and tooltips may explain exact execution provenance in words.
- Telemetry policy:
  - connected or non-local mode defaults to collection enabled with user opt-out
  - local-only mode defaults to no upload, with explicit user opt-in if they want to send anonymized data

## Key Clarification
"No words" and "Create Tool from words" conflict unless scoped carefully. Juggernaut resolves that by making the primary editing workflow text-free, while still allowing text in the following secondary surfaces:

- `Save Shortcut` / `Create Tool`
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
- Turn a source image into a polished 2D asset without learning Photoshop, Illustrator, or Figma.
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
- lets the user upload one image to the canvas
- lets the user complete a useful single-image edit
- lets the user reach a follow-on `Save Shortcut` / `Create Tool` surface after a useful edit
- exports to PSD

This is a same-day launch slice, not the full release bar. Cross-platform parity and native `.ai`/`.fig` remain release requirements unless scope is later renegotiated.

## V1 Outcome
Users can open the app, keep multiple isolated runs in one window through session tabs, swap the active run into a shared canvas surface, drop in one image, use the left rail for deterministic precomputed actions and the bottom rail for complex communication-driven edits, see intent-aware suggested rail jobs, apply seeded single-image edits, request action-first design review proposals against the visible canvas plus any marks, accept a proposal to run a real single-image edit that replaces the target image in place, optionally save a reusable shortcut after a successful edit, and export a usable 2D asset with a reproducibility receipt. Multi-image flows are deferred from the primary v1 loop until the single-image wedge is stable.

## V1 Primary Wedge
- One image in.
- One usable asset out.
- One shared window and one shared canvas surface.
- One active run/session tab attached at a time.
- No multi-image flows in the primary loop.
- Left rail shape: stable `Upload` and `Select` anchors plus 3 dynamic suggested job slots from the deterministic precomputed action library.
- Bottom rail shape: communication-only rail for complex or non-prebaked changes.
- Bottom communication rail v1 tools: `Marker`, `Protect`, `Magic Select`, `Make Space`, `Eraser`.
- `Create Tool` remains in the product, but enters as a secondary follow-on capability through `Save Shortcut` or a secondary dialog after useful edits.

## V1 Non-Goals
- Replacing Photoshop or Figma feature-for-feature.
- Full parametric CAD.
- Full editable 3D scene authoring.
- Marketplace transactions or artist hiring workflows inside the editor.
- Day-one iPad release.

## Core User Experience
1. The user launches the app from the dock and lands on a single-window shell with a shared canvas surface and an in-app session tab strip.
2. `New Run` creates a new run in a new tab instead of wiping the current one, and `Open Run` opens an existing run in a new tab.
3. The user switches tabs to swap the selected run/session into the shared canvas surface.
4. The native system menu mirrors the session shell: `File` exposes new/open/save/close/export session actions, `Tools` mirrors the bottom communication tools plus visible custom tools, and `Shortcuts` mirrors the left rail actions.
5. The user drags one image onto the active session canvas.
6. After first-use cloud-analysis consent, the system may opportunistically analyze the uploaded image through the design-review upload-analysis path, cache that analysis by image hash, and use it to improve future suggestions without blocking editing or design review.
7. The left rail keeps two stable icon-only anchors: `Upload` and `Select`.
8. The left rail fills 3 dynamic suggested job slots from the seeded single-image job set and functions as the deterministic precomputed action library, while any action that may incur model cost shows a top-right sapphire-blue dot.
9. The bottom rail exposes `Marker`, `Protect`, `Magic Select`, `Make Space`, and `Eraser` as the communication layer for complex or non-prebaked changes.
10. `Marker` lets the user place transient Photoshop-style freehand highlighter marks that are raw and pointer-faithful, without arrowheads, without prior image selection, and without requiring an image under the pointer.
11. `Protect` uses the same visible freehand marking behavior as `Marker`, but its semantics are "do not change this area" when review or apply consumes the focus contract.
12. `Magic Select` lets the user click an image and cycle through 2-3 proposed candidate regions for communication and review.
13. `Make Space` uses region-candidate selection semantics to say "preserve or create room here" for review and later execution.
14. `Eraser` clears communication marks and region proposals only; it does not delete image pixels or committed edits.
15. The user triggers `Design review` explicitly with the existing `Design review` button.
16. Review analyzes the whole visible canvas plus the marked region or active region candidate, can infer the relevant image or region from mark overlap and intersection at review time, and immediately opens a floating proposal tray near that area with 2-3 proposal skeleton slots.
17. The planner/reviewer uses `GPT-5.4 vision`, and accepting a proposal routes through the normal execution layer to produce a real single-image replacement edit in the active tab.
18. If the active tab is busy, tab switching is blocked or deferred until the session reaches a safe boundary.
19. After a useful edit, the user can open a secondary `Save Shortcut` / `Create Tool` surface to save or generalize that action.
20. At export time, the app produces the asset plus a structured receipt showing how to reproduce the result.

## V1 Feature Scope
### 1. Single-Image Canvas And Editing
- Infinite or effectively unbounded canvas.
- Single-image import via drag-drop and file picker.
- One active source image per primary editing session.
- Multi-image composition and cross-image operations are out of the primary v1 loop.
- Fast transforms: move, scale, rotate, skew, crop, mask, select region.
- Layer and region selection based on direct manipulation.
- Real-time preview pipeline for deterministic local transforms.
- Communication marks and region proposals are canvas-overlay annotations on top of image content, not committed image edits.

### 1A. Tabbed Session Model
- V1 uses a single app window with one shared canvas surface and one in-app tab strip.
- Each tab represents one isolated run/session and maps to one run directory.
- Switching tabs swaps the selected run/session into the shared canvas surface rather than mounting multiple live canvases at once.
- Settings remain global across all tabs in the window.
- Run-local state is tab-local, including the source image, selection state, transform state, undo/redo history, pending edits, receipts in progress, thumbnail, and dirty state.
- `New Run` creates a fresh run/session in a new tab and leaves the current tab intact.
- `Open Run` opens the chosen existing run in a new tab and leaves the current tab intact.
- `Save Session` writes the tab-local canvas/session snapshot into the run directory so reopening that run restores the saved shell state instead of only raw artifacts.
- Closing a tab closes only the shell session for that tab; it does not delete the underlying run directory.
- Inactive tabs do not keep a live engine attachment, live event stream, or background live generation loop in v1.
- Only the active tab is attached to engine/events in v1.
- If the active tab is busy, tab switching must be blocked or explicitly deferred until the session reaches a safe boundary.
- The native system menu mirrors session and shell actions: `File` owns tab/session lifecycle commands, `Tools` mirrors the bottom communication tools plus visible custom tools, and `Shortcuts` mirrors the left rail actions.
- V1 excludes drag-reorder, native macOS window tab bar integration, and background live generation on inactive tabs.

Tab contract:

```text
{
  schemaVersion: "session-tab-v1",
  tabId: "tab_123",
  title: "Run 3",
  runDir: "/absolute/path/to/run_003",
  thumbnailPath: "/absolute/path/to/thumbnail.png" | null,
  isActive: true,
  isBusy: false,
  isDirty: true,
  canClose: true
}
```

Contract rules:
- `tabId` is the shell-stable identifier for one tab/session pair and is not reused within the same window lifetime.
- `title` is the user-facing tab label derived from run metadata or a fallback generated title.
- `runDir` is the absolute path to the persisted run backing that tab.
- `thumbnailPath` is an optional preview image path for the run and may be `null`.
- `isActive` is `true` for exactly one tab in the window.
- `isBusy` is `true` when the tab cannot safely swap away because an engine task, receipt-critical mutation, or event-bound operation is still in progress.
- `isDirty` is `true` when the run has tab-local edits or session state changes not yet reflected in its latest persisted checkpoint.
- `canClose` is `false` when the shell must prevent close for the current tab state; closing never implies deletion of `runDir`.

UI ids:
- `session-tab-strip`
- `session-tab-list`
- `session-tab-new`
- `session-tab-open`

### 2. Intent Recognition And Guidance
- Continuously infer likely single-image job intent from canvas state and image content.
- Rank the seeded single-image job set and supply 3 dynamic suggested rail slots.
- Update suggestions after every material committed edit.
- Preserve user agency: suggestions are optional and reversible.
- Ranking must remain provider-agnostic and capability-first.
- Intent ranking outputs ordered candidates using the contract defined below.
- Account-wide memory may bias suggestion and proposal ranking by accepted action types, style preferences, and repeated use-case patterns, but must not silently apply edits.

### 3. Primary Rail Shape
- Stable anchors: `Upload`, `Select`.
- Dynamic suggested job slots: 3.
- Anchors do not rerank or disappear.
- Dynamic slots draw only from the seeded single-image job set in the primary loop.
- `Create Tool` and multi-image actions do not appear as primary rail actions in the v1 wedge.
- The left rail is the deterministic precomputed action library and does not host freeform communication tools.

### 4. Seeded Single-Image Job Set
V1 seeds 5 single-image jobs and lets intent ranking choose which 3 to show at a time:

- `Cut Out` -> `subject_isolation`
- `Remove` -> `targeted_remove`
- `New Background` -> `background_replace`
- `Reframe` -> `crop_or_outpaint`
- `Variants` -> `identity_preserving_variation`

Notes:
- The seeded set is finite for the v1 wedge. Intent ranking may reorder and enable or disable it, but does not invent new primary rail jobs.
- `Select` is the deterministic local entry into region-aware variants of jobs that need explicit user scope.

### 5. Bottom Communication Rail
- The bottom rail is the communication layer for complex or non-prebaked changes that do not map cleanly to a single left-rail action.
- Bottom communication rail v1 contains exactly 5 tools:
  - `Marker`
  - `Protect`
  - `Magic Select`
  - `Make Space`
  - `Eraser`
- `Marker` creates transient Photoshop-style freehand highlighter annotations that mean "look here" or "change this".
- `Protect` creates protected-region focus input using the same visible freehand marking surface as `Marker`, but with "do not edit here" semantics.
- `Magic Select` proposes 2-3 candidate regions for a clicked image location and lets the user cycle through them before review.
- `Make Space` creates reserved-space focus input using region candidates to signal "preserve or create room here".
- `Eraser` removes communication marks and region proposals only.
- Communication marks are canvas-overlay annotations first. They may overlap an image or blank canvas, and they do not become image-local geometry until a later action explicitly needs that mapping.
- Marks alone are sufficient input for `Design review`; explicit image selection is not required.
- Blank-canvas marks are valid input for `Design review`.
- Communication overlays are session-local, reversible, and excluded from exported image pixels unless intentionally committed through a later action.

### 6. Design Review Flow
- `Design review` is an explicit user trigger through the existing `Design review` button.
- Review analyzes the whole visible canvas plus the marked region or current region candidate.
- Review-time targeting may infer the relevant image, images, or region from mark overlap and intersection instead of requiring marker-time attachment.
- Review output is action-first: proposals describe likely edits to perform, not conversational critique.
- The proposal tray floats near the marked region or active region candidate rather than opening as chat.
- The tray reserves 2-3 proposal slots immediately as skeletons while planning completes.
- `GPT-5.4 vision` is the planner/reviewer for design-review reasoning.
- Final apply of any accepted proposal remains routed through the normal execution layer and receipt system, replacing the target image in place for the active tab when a valid target image is present.
- When an accepted proposal depends on multiple images, final apply sends one editable target image plus any additional reference images needed for guidance, and replaces only the target image.
- Upload-time analysis must never block `Design review`; review can run with cached context, fresh context, or no prior upload analysis.

### 7. Upload-Time Analysis And Memory
- Upload-time analysis runs only after first-use consent for cloud analysis.
- Once consent exists, upload-time analysis is opportunistic, cached by image hash, and belongs to the design-review upload-analysis path rather than the passive primary editing loop.
- Cached analysis may seed left-rail ranking, `Magic Select` region proposals, and `Design review` proposal ranking.
- Upload-time analysis is advisory and must never block import, canvas interaction, or `Design review`.
- Account-wide memory may bias proposal ranking by previously accepted action types, style tendencies, and repeated use-case patterns across the account.
- Account-wide memory affects ranking only; it does not auto-apply proposals or override explicit marks.

### 8. Secondary Shortcut Creation And Tool Authoring
- `Create Tool` remains a core product capability, but it moves out of the primary rail for the single-image-first wedge.
- After a successful edit or repeated action, the app may offer `Save Shortcut` as a follow-on surface that captures the job, capability, and reusable parameters.
- Full plain-language `Create Tool` can live in a secondary dialog, details sheet, or post-edit flow.
- Saved shortcuts and generated tools still resolve through the shared tool schema and execution router.
- Tool creation must include guardrails, previewability, and rollback if generation fails.

### 9. Model-Orchestrated Runtime
- Vision LLM calls are first-class runtime events, not a bolted-on assistant feature.
- The app can sustain multiple concurrent model tasks during one session:
  - intent inference
  - region understanding
  - proposal generation
  - tool synthesis
  - export analysis
- In v1, engine attachment and live event streaming are scoped to the active tab/session only.
- The legacy engine-backed image-describe or vision-describe path is not a primary-loop dependency for upload, tab switch, or image switch.
- Passive image describe must not auto-start the engine when an image is uploaded, focused, or switched.
- Engine spawn remains reserved for explicit engine-backed actions, explicit review work, or other user-invoked execution paths.
- The UI must stay interactive while model calls are in flight.
- Remote and local model providers use the same internal action contract.
- V1 single-image runtime exposes these provider-agnostic capability names:
  - `subject_isolation`
  - `targeted_remove`
  - `background_replace`
  - `crop_or_outpaint`
  - `identity_preserving_variation`
- The runtime, not the rail, resolves a capability to a deterministic local transform, a model-backed action, or a hybrid pipeline.
- The UI must render model-cost-bearing routing back to the user through a persistent top-right sapphire-blue dot on buttons, direct affordances, and proposal/apply actions.
- Provider and model names must stay out of the main editing loop.

### 10. Suggested Rail Job Contract
Intent ranking must output an ordered candidate list for the seeded single-image job set. The rail consumes that ranking, applies sticky rules, and renders 3 dynamic slots.

```text
{
  schemaVersion: "single-image-rail-v1",
  imageId: "asset_123",
  selectionState: "none" | "subject" | "region",
  rankedJobs: [
    {
      jobId: "cut_out",
      label: "Cut Out",
      capability: "subject_isolation",
      requiresSelection: false,
      enabled: true,
      disabledReason: null,
      confidence: 0.94,
      reasonCodes: ["single_subject_detected", "background_separable"],
      stickyKey: "asset_123:none:subject_isolation"
    }
  ]
}
```

Contract rules:
- `rankedJobs` is ordered highest-to-lowest confidence and contains at most one entry for each seeded job.
- `jobId` is stable across sessions for the seeded set: `cut_out`, `remove`, `new_background`, `reframe`, `variants`.
- `capability` must use only provider-agnostic runtime names.
- `requiresSelection` tells the rail whether `Select` must scope the action first.
- `enabled` is the main-loop readiness bit the rail and runtime both consume.
- `disabledReason` is a user-safe enum: `selection_required`, `busy`, `unsupported_image`, `unavailable_in_current_mode`, or `capability_unavailable`.
- `confidence` is normalized to `0.0`-`1.0`.
- `reasonCodes` explain ranking without naming providers or models.
- `stickyKey` must remain stable for the same image, selection scope, and capability so the rail can preserve slot identity across reranks.

Rerank policy:
- The rail is allowed to rerank after image import or replacement, after selection commit or clear, after a committed crop or transform, after job completion or failure, after undo or redo, and after a capability-availability change.
- The rail is not allowed to rerank during pointer-down interactions, live selection drags, active transform scrubs, or while a suggested job is in flight.
- When a rerank is allowed, the rail should keep any currently visible job whose `stickyKey` still exists in the new ranked list and whose `enabled` state has not worsened, then fill remaining slots by rank order.

Unavailable capability policy:
- If a capability cannot run, the rail still represents that job with its normal label and icon but sets `enabled: false`.
- The main loop shows only the generic `disabledReason`; it must not expose provider or model names.
- Provider resolution details belong in settings, receipts, diagnostics, or deeper follow-on surfaces, not the primary rail.

### 11. Communication And Review Contracts
The bottom communication rail and `Design review` flow share the following contracts.

`communicationMark`:

```text
{
  schemaVersion: "communication-mark-v1",
  markId: "mark_123",
  sessionId: "session_123",
  imageId: "asset_123" | null,
  kind: "freehand_marker",
  points: [{ x: 120.5, y: 88.0 }],
  bounds: { x: 100.0, y: 70.0, width: 90.0, height: 42.0 },
  coordinateSpace: "canvas_overlay",
  colorToken: "signal-red",
  createdAt: "2026-03-09T18:30:00Z",
  createdByTool: "marker",
  transient: true
}
```

Rules:
- `imageId` is optional at creation time; blank-canvas marks use `null` until review or a later action infers a relevant image intersection.
- A mark may exist without any explicit selection state or image attachment.
- `kind` is limited to raw freehand communication highlighting and does not represent destructive paint.
- `points` are stored in canvas-overlay coordinates and remain pointer-faithful rather than being remapped through image transforms.
- `coordinateSpace` is `canvas_overlay` in v1 for marker-authored marks.
- `transient: true` means the mark is communication-only until converted into a later action.

`regionCandidate`:

```text
{
  schemaVersion: "region-candidate-v1",
  candidateId: "region_123",
  sessionId: "session_123",
  imageId: "asset_123",
  source: "magic_select",
  clickPoint: { x: 220.0, y: 144.0 },
  maskRef: "masks/region_123.png",
  bounds: { x: 180.0, y: 96.0, width: 120.0, height: 110.0 },
  confidence: 0.82,
  rank: 1,
  cycleGroupId: "cycle_456",
  isActive: true
}
```

Rules:
- `Magic Select` returns 2-3 candidates with a shared `cycleGroupId`.
- Cycling changes `isActive` within the group but does not rerun `Design review` until explicitly triggered.
- `source` is `magic_select` in v1.
- Candidates are communication-scoped region proposals, not committed selections.

`designReviewRequest`:

```text
{
  schemaVersion: "design-review-request-v1",
  requestId: "review_123",
  sessionId: "session_123",
  visibleCanvasRef: "renders/canvas_visible.png",
  imageIdsInView: ["asset_123"],
  primaryImageId: "asset_123",
  markIds: ["mark_123"],
  activeRegionCandidateId: "region_123" | null,
  selectionState: "none" | "subject" | "region",
  trigger: "design_review_button",
  uploadAnalysisRef: "analysis/hash_abc.json" | null,
  accountMemoryRef: "memory/account_bias_v1.json" | null
}
```

Rules:
- `trigger` is always `design_review_button` in v1.
- The request must include the whole visible canvas context, not just the cropped marked area.
- At least one of `markIds` or `activeRegionCandidateId` must be present.
- `markIds` may be sufficient input even when `selectionState` is `none`.
- Review-time targeting may infer the relevant image or region from mark overlap and intersection, including when a mark began on blank canvas.
- `uploadAnalysisRef` is optional and must not gate request execution.

`proposal`:

```text
{
  schemaVersion: "design-review-proposal-v1",
  proposalId: "proposal_123",
  requestId: "review_123",
  imageId: "asset_123",
  title: "Separate subject from background",
  capability: "subject_isolation",
  actionIntent: "cut_out_subject",
  rationaleCodes: ["mark_on_subject_edge", "background_separable"],
  targetRef: {
    markIds: ["mark_123"],
    regionCandidateId: "region_123" | null
  },
  rank: 1,
  status: "ready"
}
```

Rules:
- Proposals are action-first and must resolve to an executable action intent or capability, not freeform critique alone.
- `rationaleCodes` may explain ranking internally without exposing provider details in the main workflow.
- `status` is `ready` once planning returns a valid proposal and advances independently of final apply.

### 12. 2D And 3D Outputs
- 2D outputs: layered raster export plus native design-tool outputs.
- 3D outputs: relief or mesh export for supported toolchains and printable targets.
- Unsupported cases must fail clearly and preserve intermediate artifacts rather than silently flattening everything.

### 13. Export And Receipts
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

### 14. Local-Only Mode
- The app supports a local-only mode with no required internet access.
- In local-only mode, cloud-only tools are visibly disabled or swapped for local equivalents.
- In local-only mode, the sapphire-blue model-cost dot remains visible on blocked actions so users can distinguish external-model paths from available local actions.
- Local-only mode still supports a meaningful subset of the core workflow:
  - import
  - canvas transforms
  - at least 3 seeded single-image jobs
  - receipt generation
  - local export

### 15. Platformization
- The editing and tool runtime is not app-only.
- The same tool graph and receipt system must be callable through a local or remote API for future services and agents.
- Headless execution is a first-class design concern even if the first release is GUI-first.

### 16. Improvement Data Pipeline
- Connected or non-local mode defaults to improvement data enabled with opt-out controls.
- Local-only mode defaults to no upload, with explicit opt-in if the user wants to send anonymized bundles later.
- Upload packaging must be explicit, reviewable, and consent-aware.
- The anonymized bundle must exclude source images by default unless the user explicitly opts in.

## UX Requirements
- Primary workspace is visually driven and text-free in normal operation.
- Left rail is vertical, icon-only, and always visible.
- Left rail represents precomputed actions; bottom rail represents communication input for complex or non-prebaked changes.
- Custom iconography should be generated or derived from the Oscillo bookend icon pipeline rather than assembled from stock icon packs.
- The app uses a glassy layered material system on macOS, with platform-appropriate equivalents on Windows and Linux.
- Suggested edits appear as previews or icon cards, not chat bubbles.
- The editing surface must feel closer to Photoshop or Figma than to a chatbot.
- `Design review` proposals appear in a floating tray near the marked region, with 2-3 proposal skeletons visible immediately.

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
- Design-review planning and preview rendering must not block the main transform loop or canvas interaction.

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
- V1 design-review defaults:
  - planner/reviewer: `GPT-5.4 vision`
  - final apply generation: `Nano Banana 2` (`gemini-3.1-flash-image-preview`)

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
- The main workspace includes a bottom communication rail.
- The main workspace includes an in-app session tab strip using a single shared canvas surface.
- The left rail keeps stable `Upload` and `Select` anchors plus 3 dynamic suggested job slots from the deterministic precomputed action library.
- The bottom communication rail contains `Marker`, `Protect`, `Magic Select`, `Make Space`, and `Eraser` in v1.
- The main editing workflow requires no text labels to operate.
- The primary wedge is one image in and one usable asset out.
- No multi-image action is required in the primary loop.
- The UI uses a glass-material visual system on macOS and equivalent platform-native material styling elsewhere.
- The default workflow is image-led, not chat-led.
- The primary rail suggestions come only from the seeded 5-job single-image set.
- Communication marks alone are sufficient input for `Design review`; explicit image selection is not required.
- Communication marks are canvas-overlay annotations first and may begin on blank canvas.

### Suggested Rail Jobs
- Intent ranking emits ordered seeded-job candidates using the `single-image-rail-v1` contract.
- The rail reranks only at settled boundaries and remains sticky during active edits.
- Unavailable capabilities remain visible as disabled jobs with generic disabled reasons.

### Communication Rail And Review
- `Marker` is a transient Photoshop-style freehand highlighter mark in canvas-overlay space, with raw pointer-faithful paths and no arrowheads.
- `Protect` is a transient protected-region mark in canvas-overlay space and must preserve "do not edit here" semantics through review and apply.
- `Magic Select` proposes 2-3 candidate regions per click and lets the user cycle among them.
- `Make Space` produces reserved-space region candidates that tell review and downstream execution to preserve or create room there.
- `Eraser` clears communication marks and region proposals only.
- `Design review` is triggered explicitly from the existing button rather than automatically on mark creation.
- Blank-canvas marks are valid review input.
- Review analyzes the visible canvas plus the marked region or active region candidate.
- Review may infer the relevant image or region from overlap and intersection with the mark instead of relying on marker-time image attachment.
- The proposal tray floats near the marked region and shows 2-3 proposal slots immediately as skeletons.
- Accepted proposals still execute through the normal execution layer and replace the target image in place when the review request resolves to an existing target image.
- If the accepted proposal needs cross-image context, the apply request includes the target image plus additional reference images, but only the target image is mutated and replaced.

### Create Tool
- The primary left rail does not include `Create Tool`.
- After a successful edit, the app can surface `Save Shortcut` or `Create Tool` in a secondary follow-on surface.
- The user can save the current action as a reusable shortcut and, when supported, generalize it into a tool in the shared tool schema.
- The saved shortcut or generated tool can be previewed, saved, and reused within the session.

### Tabbed Sessions
- `New Run` creates a new tab/session instead of wiping the current session.
- `Open Run` opens an existing run in a new tab.
- Closing a tab closes only the shell session and does not delete the backing run directory.
- Only the active tab is attached to engine/events in v1.
- Inactive tabs do not keep a live engine/event stream or background live generation in v1.
- Tab switching is blocked or deferred while the active tab is busy.
- V1 does not include drag-reorder or native macOS window tab bar integration.

### Model And Mode Support
- The app supports remote and local model routing through one unified contract.
- The app includes a local-only mode that works without internet access.
- The runtime can maintain multiple simultaneous model tasks without freezing the UI.
- Upload-time cloud analysis requires first-use consent, is opportunistic, and is cached by image hash.
- Upload-time analysis never blocks `Design review`.
- Upload-time semantic warmup belongs to the design-review upload-analysis path, not passive engine-backed describe in the primary editing loop.
- Account-wide memory may bias proposal ranking by accepted action types, style patterns, and use-case history.

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
- Achieve launchable single-image upload-to-canvas loop.
- Land the primary rail contract with stable anchors and 3 dynamic job slots.
- Land the bottom communication rail contract for `Marker`, `Protect`, `Magic Select`, `Make Space`, `Eraser`, and explicit `Design review`.
- Wire at least one working single-image edit path.
- Expose a follow-on `Save Shortcut` / `Create Tool` surface after a useful edit.
- Export to PSD.

### Milestone 1: Interactive Cross-Platform Core
- Stabilize shell and canvas on macOS, Windows, and Linux.
- Preserve reproducible run artifacts from the start.
- Lock shared action schema and receipt format.

### Milestone 2: Guided Intent Loop
- Add live single-image intent inference, visual suggestions, and non-blocking proposal pipeline.
- Add communication-driven design review with floating proposal trays and planner-driven proposal cards.
- Stabilize concurrent provider calls and queue behavior.

### Milestone 3: Tool Runtime
- Ship the seeded single-image rail jobs plus secondary `Save Shortcut` / `Create Tool`.
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
- The primary v1 loop is single-image-first; multi-image flows return only after the single-image wedge is stable.
- Passive engine-backed image describe is not required to upload, focus, or switch images in the primary editing loop.
