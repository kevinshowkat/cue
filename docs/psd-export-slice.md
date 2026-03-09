# PSD Export Slice

This document defines the March 8, 2026 PSD export contract for Juggernaut's same-day launch slice.

## Contract

- Export entrypoint: Tauri command `export_run`
- Format: `.psd`
- Source artifact: flattened PNG render of the visible canvas composition
- Receipt output: JSON receipt written into the active run directory

## What Ships Today

- The export menu now writes a valid PSD file for the current canvas result.
- The PSD preserves transparency from the flattened canvas render.
- The export receipt captures:
  - run directory
  - active image id
  - canvas mode
  - source image paths
  - source receipt references when present
  - per-image rects and transforms
  - z-order
  - timeline nodes
  - action sequence
  - output and source hashes

## Known Limitations

- PSD output is flattened into a single bitmap composite rather than editable per-image PSD layers.
- Effect-token state, mask semantics, and tool semantics are not reified as editable PSD structures in this slice.
- Export dimensions follow Juggernaut canvas world geometry in CSS pixels, not source DPI metadata.

## Follow-Up

- Promote source images into editable PSD layers when the edit graph supports it cleanly.
- Carry richer mask and effect semantics into export metadata and layer structures.
- Add save-path selection UI once shell ownership is ready for it.
