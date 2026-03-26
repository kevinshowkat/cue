# PSD Export Slice

This document defines the current PSD export contract for Juggernaut's desktop shell.

## Contract

- UI entrypoints:
  - titlebar `Export > PSD`
  - native `File > Export Session...`
  - Agent Run `export_psd`
- Export entrypoint: Tauri command `export_run`
- Format: `.psd`
- Destination: user-chosen save path from the native save dialog
- Source artifact: flattened PNG render of the current visible canvas composition
- Receipt output: JSON receipt from the native exporter, including timeline/export metadata

## What Ships Now

- The export menu now writes a valid PSD file for the current canvas result.
- The PSD preserves transparency from the flattened canvas render.
- The titlebar export menu also offers flattened PNG, but this document covers the PSD path specifically.
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
- Add native `.ai` / `.fig` export and round-trip once the core slice is stable.
