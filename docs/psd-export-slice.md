# PSD Export Slice

This document defines the current PSD export contract for Cue's desktop shell and notes the adjacent low-effort raster formats that now share the same native export pipeline.

## Contract

- UI entrypoints:
  - titlebar `Export > PSD`
  - titlebar `Export > PNG | JPG | WEBP | TIFF`
  - native `File > Export Session...` (still defaults to PSD)
  - Agent Run `export_psd`
- Export entrypoint: Tauri command `export_run`
- Formats supported by the native exporter: `.psd`, `.png`, `.jpg`, `.webp`, `.tiff`
- This document focuses on the PSD contract specifically.
- Destination: user-chosen save path from the native save dialog
- Source artifact: flattened PNG render of the current visible canvas composition
- Receipt output: JSON receipt from the native exporter, including timeline/export metadata

## What Ships Now

- The export menu now writes a valid PSD file for the current canvas result.
- The PSD preserves transparency from the flattened canvas render.
- The titlebar export menu also offers flattened PNG, JPG, WEBP, and TIFF through the same receipt-bearing native exporter.
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
- Export dimensions follow Cue canvas world geometry in CSS pixels, not source DPI metadata.
- JPG export flattens transparency onto white because the target format does not preserve alpha.

## Follow-Up

- Promote source images into editable PSD layers when the edit graph supports it cleanly.
- Carry richer mask and effect semantics into export metadata and layer structures.
- Add native `.ai` / `.fig` export and round-trip once the core slice is stable.
