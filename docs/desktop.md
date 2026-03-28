# Desktop App

Cue is a Tauri desktop app. The current public launch slice is verified on macOS and is honest about Windows and Linux still needing public-release verification.

## Current Workflow

1. Create or open a session tab.
2. Import one or more images.
3. Use the left rail for direct actions and the right-side communication tools for spatial guidance.
4. Run `Design Review` when the edit is ambiguous or multi-step.
5. Accept a proposal to apply the edit in place.
6. Optionally create a reusable tool from the current pattern.
7. Export PSD, PNG, JPG, WEBP, or TIFF with a receipt.

## Core Concepts

- Run directory: a folder under `~/cue_runs/` by default, with legacy fallback to `~/brood_runs/`
- Session tab: one isolated shell state bound to one run directory
- Shared canvas: only the active tab is attached to runtime and events
- Visual timeline: tab-local history with restore points
- Communication overlay: `Marker`, `Highlight`, `Magic Select`, `Stamp`, and `Eraser`
- Agent Run: an in-app goal-driven surface for observing and exercising workflows

## Persistence

- Imported files land in `run_dir/inputs/`
- Session saves write `run_dir/juggernaut-session.json`
- Timeline persistence writes `run_dir/session-timeline.json`
- Receipts are written alongside run artifacts as `receipt-*.json`

## Export

- PSD, PNG, JPG, WEBP, and TIFF are available from the current desktop shell.
- The current slice exports flattened bitmap output, not fully editable layered PSD data.
- Export receipts include timeline metadata for reproducibility.

## Legacy Runtime Note

The app still carries older internal runtime names from pre-open-source iterations. Those are implementation carryover, not the public product identity. See [legacy-internals.md](legacy-internals.md).

## See Also

- [features/visual-timeline/README.md](features/visual-timeline/README.md)
- [features/shell-canvas-integration.md](features/shell-canvas-integration.md)
- [psd-export-slice.md](psd-export-slice.md)
