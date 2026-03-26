# Desktop App (Tauri)

Cue is a Tauri desktop app with its strongest verification on macOS today. The release bar still targets the same core feature set across macOS, Windows, and Linux, but the currently shipped and tested slice is the Mac desktop shell.

There is no web app.

## Current Shell

- One window with a brand strip, in-app session tabs, and one shared canvas surface.
- Titlebar actions for `New session`, `Fork tab`, `Agent Run`, `Design Review`, and `Export`.
- A persistent history shelf sits directly under the brand strip; collapse keeps a visible stub instead of hiding timeline access completely.
- Native `File` menu items for new/open/save/close/import/export/settings.
- The empty-canvas hint is visual only; uploads come from the left-rail `Upload` action, `File > Import Photos...`, or drag-drop.

## Core Concepts

- **Run**: a folder under `~/brood_runs/` that stores imported files, artifacts, receipts, `events.jsonl`, `juggernaut-session.json`, and `session-timeline.json`.
- **Session tab**: an isolated shell state bound to one run directory. Tabs can be created fresh, opened from disk, saved, closed, or forked from the current tab.
- **Shared canvas**: only the active tab is attached to runtime/events at a time; switching tabs swaps session state into the shared surface.
- **Visual timeline**: tab-local history shown in a dedicated shelf under the titlebar. It can collapse to a visible stub and restore prior committed states without re-running model work.
- **Communication overlay**: the `Marker`, `Highlight`, `Magic Select`, and `Eraser` tools used to scope `Design Review`; `Make Space` remains a dormant runtime affordance.
- **Agent Run**: a compact goal-driven panel that can step or auto-run review, tool-preview/create, and export actions against the current tab.

## Current Primary Workflow

1. Create a new session or open an existing run directory.
2. Import one or more images.
3. Use the left rail for direct single-image actions and the right-side communication tools for spatial guidance.
4. Trigger `Design Review` when the edit is ambiguous, aesthetic, or multi-step.
5. Accept a proposal to run a real in-place single-image apply.
6. Optionally preview or create a reusable tool from the current edit pattern.
7. Use `History` to inspect or restore earlier tab-local states.
8. Export PSD or flattened PNG with a receipt.

The primary Cue wedge is still single-image-first even though older Brood-derived multi-image actions remain available in the runtime.

## Left Rail And Review

- Stable visible anchors: `Move`, `Upload`, `Select`.
- Three dynamic suggested slots are filled from the seeded single-image job library.
- `Remove People` is currently exposed as an extra direct single-image affordance outside the three dynamic slots.
- `New Background` remains part of the seeded job library, but it is hidden in the current visible rail.
- `Design Review` consumes the visible canvas plus marks or region candidates and returns proposal cards in the communication tray.
- Accepting a proposal routes through the normal execution layer and replaces the target image in place.
- Busy tabs block switching, closing, or forking until they reach a safe boundary.

## Persistence And Files

- Imported files land in `run_dir/inputs/`.
- Session saves write `run_dir/juggernaut-session.json`.
- Timeline persistence writes `run_dir/session-timeline.json`.
- Receipts continue to live alongside run artifacts as `receipt-*.json` or export-specific receipt payloads.
- Some on-disk paths, local-storage keys, and runtime env names still use legacy `brood` naming during the transition.

## Export

- The titlebar export menu offers PSD and flattened PNG.
- `File > Export Session...` currently routes to PSD export.
- Both export routes open a save dialog and remember the last export directory.
- Export receipts include the current timeline head and timeline schema version.
- PSD is currently a flattened bitmap composition with alpha rather than fully editable per-image layers.
- PNG is also flattened and does not preserve editable tool semantics.

## Legacy Runtime Note

Older Brood-era capabilities such as multi-image blends, DNA/Soul token flows, and some multi-image generation helpers are still present in the runtime. They are useful implementation carryover, but they are not the main Cue launch loop.

## See Also

- [docs/features/visual-timeline/README.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/features/visual-timeline/README.md)
- [docs/features/shell-canvas-integration.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/features/shell-canvas-integration.md)
- [docs/psd-export-slice.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/psd-export-slice.md)
- [docs/runbooks/AGENT_RUNNER_ARAGORN.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/AGENT_RUNNER_ARAGORN.md)
