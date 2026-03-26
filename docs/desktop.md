# Desktop App (Tauri)

Cue is a Tauri desktop app with its strongest verification on macOS today. The release bar still targets the same core feature set across macOS, Windows, and Linux, but the currently shipped and tested slice is the Mac desktop shell.

There is no web app.

The current productized story is a screenshot-polish slice: bring one still image into a session tab, guide a review with marks or region picks, accept one approved edit, preserve lineage through tabs/history/receipts, and export a presentable flattened asset.

## Current Shell

- One window with a brand strip, in-app session tabs, and one shared canvas surface.
- Titlebar actions for `New session`, `Fork tab`, `Agent Run`, `Design Review`, and `Export`.
- A persistent history shelf sits directly under the brand strip; collapse keeps a visible stub instead of hiding timeline access completely.
- Native `File` menu items for new/open/save/close/import/export/settings.
- The empty-canvas hint is visual only; uploads come from the left-rail `Upload` action, `File > Import Photos...`, or drag-drop.

## Core Concepts

- **Run**: a folder under `~/cue_runs/` that stores imported files, artifacts, receipts, `events.jsonl`, `juggernaut-session.json`, and `session-timeline.json`.
- **Session tab**: an isolated shell state bound to one run directory. Tabs can be created fresh, opened from disk, saved, closed, or forked from the current tab.
- **Shared canvas**: only the active tab is attached to runtime/events at a time; switching tabs swaps session state into the shared surface.
- **Visual timeline**: tab-local history shown in a dedicated shelf under the titlebar. It can collapse to a visible stub and restore prior committed states without re-running model work.
- **Communication overlay**: the `Marker`, `Highlight`, `Magic Select`, `Stamp`, and `Eraser` tools used to scope `Design Review`; `Make Space` remains a dormant runtime affordance.
- **Communication overlay**: the visible tools are `Marker`, `Highlight`, `Magic Select`, `Stamp`, and `Eraser`; `Make Space` remains a dormant runtime affordance that is still part of the underlying contract but not surfaced as a current shell control.
- **Agent Run**: a compact goal-driven panel that can step or auto-run review, tool-preview/create, and export actions against the current tab.

## Current Primary Workflow

1. Create a new session or open an existing run directory.
2. Import one or more images.
3. Use the left rail for direct single-image actions and the right-side communication tools for spatial guidance; `Stamp` now opens a compact starter-intent menu at the clicked canvas point so the user can choose `Fix`, `Move`, `Remove`, `Replace`, or `Custom` in place. `Custom` opens a short text field before placement.
4. Trigger `Design Review` when the edit is ambiguous, aesthetic, or multi-step.
5. Accept a proposal to run a real in-place single-image apply.
6. Optionally preview or create a reusable tool from the current edit pattern.
7. Use `Fork tab` or `History` to preserve and compare variants before export.
8. Export PSD, PNG, JPG, WEBP, or TIFF with a receipt.

The primary Cue wedge is still single-image-first even though older Brood-derived multi-image actions remain available in the runtime.

## Compare Today

- Compare is currently manual and tab-based.
- `Fork tab` preserves the current state as a sibling variant before another edit lands.
- `History` rewinds or restores committed states inside one tab.
- Reopening a saved run restores the saved timeline/session state rather than rebuilding from raw artifacts alone.
- There is no dedicated side-by-side before/after viewer or approval gallery yet.

## Left Rail And Review

- Stable visible anchors: `Move`, `Upload`, `Select`.
- Three dynamic suggested slots are filled from the seeded single-image job library.
- `Remove People` is currently exposed as an extra direct single-image affordance outside the three dynamic slots.
- `New Background` remains part of the seeded job library, but it is hidden in the current visible rail.
- `Design Review` consumes the visible canvas plus marks or region candidates and returns proposal cards in the communication tray.
- Accepting a proposal routes through the normal execution layer, tracks the chosen card as `selectedProposalId`, replaces the target image in place, and writes a review-apply receipt plus a timeline entry.
- Busy tabs block switching, closing, or forking until they reach a safe boundary.

## Persistence And Files

- Imported files land in `run_dir/inputs/`.
- Session saves write `run_dir/juggernaut-session.json`.
- Timeline persistence writes `run_dir/session-timeline.json`.
- Saved session/timeline state preserves tab lineage plus the review/apply trace state needed to reopen or manually compare variants later.
- Design-review planner traces are persisted into the run directory as `design-review-planner-*.json`.
- Receipts continue to live alongside run artifacts as `receipt-*.json` or export-specific receipt payloads.
- Legacy `brood` on-disk paths, local-storage keys, and runtime env names are still read during the transition, but Cue now writes canonical `cue` names.

## Export

- The titlebar export menu offers PSD, PNG, JPG, WEBP, and TIFF.
- `File > Export Session...` currently routes to PSD export.
- Both export routes open a save dialog and remember the last export directory.
- Export always reflects the current visible tab state and current timeline head.
- Export receipts include the current timeline head, timeline schema version, action sequence, source image lineage, and content hashes.
- Screenshot-polish receipts keep `selectedProposalId` in runtime/apply state and may expose `approvedProposalId` only inside receipt-facing `screenshotPolish` metadata as an alias of that same chosen proposal.
- PSD is currently a flattened bitmap composition with alpha rather than fully editable per-image layers.
- PNG, WEBP, and TIFF are also flattened and do not preserve editable tool semantics.
- JPG is flattened and composites transparency onto white because the format does not preserve alpha.

## Legacy Runtime Note

Older Brood-era capabilities such as multi-image blends, DNA/Soul token flows, and some multi-image generation helpers are still present in the runtime. They are useful implementation carryover, but they are not the main Cue launch loop.

## See Also

- [docs/features/screenshot-polish-mvp/README.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/features/screenshot-polish-mvp/README.md)
- [docs/features/visual-timeline/README.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/features/visual-timeline/README.md)
- [docs/features/shell-canvas-integration.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/features/shell-canvas-integration.md)
- [docs/psd-export-slice.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/psd-export-slice.md)
- [docs/runbooks/AGENT_RUNNER_ARAGORN.md](/Users/mainframe/Desktop/projects/Juggernaut/docs/runbooks/AGENT_RUNNER_ARAGORN.md)
