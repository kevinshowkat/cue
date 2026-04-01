# Desktop App

Cue is a Tauri desktop app. The public release is verified most deeply on macOS.

## Current Flow

1. Open or create a session tab.
2. Import one or more images.
3. Edit on the canvas with direct actions and communication tools.
4. Run `Design Review` when you want suggestions for a change.
5. Apply a proposal in place.
6. Optionally save a reusable tool.
7. Export with a receipt.

## Main Terms

- run directory: a folder under `~/cue_runs/` by default, with legacy fallback to `~/brood_runs/`
- session tab: one saved workspace inside the app window
- shared canvas: the main editing surface used by the active tab
- visual timeline: tab-local history with restore points
- communication tools: `Marker`, `Highlight`, `Magic Select`, `Stamp`, and `Eraser`

## Files Written By The App

- imported files: `run_dir/inputs/`
- session save: `run_dir/session.json`
- legacy reopen fallback: `run_dir/juggernaut-session.json`
- timeline state: `run_dir/session-timeline.json`
- export artifacts: `run_dir/artifacts/`
- receipts: `run_dir/receipts/receipt-*.json`

## Export

- available now: PSD, PNG, JPG, WEBP, TIFF
- current behavior: flattened output rather than fully editable layered export
- receipts record export details for reproducibility

## Related Docs

- [features/visual-timeline/README.md](features/visual-timeline/README.md)
- [features/shell-canvas-integration.md](features/shell-canvas-integration.md)
- [psd-export-slice.md](psd-export-slice.md)
