# PSD Export Slice

This document defines the current PSD export contract for Cue's desktop shell and notes the adjacent low-effort raster formats that now share the same native export pipeline.

For the screenshot-polish slice, export is the final handoff step for the currently approved tab state. It exports the current visible composition and current timeline head, not an approval gallery or side-by-side compare bundle.

## Contract

- UI entrypoints:
  - titlebar `Export > PSD`
  - titlebar `Export > PNG | JPG | WEBP | TIFF`
  - native `File > Export Session...` (still defaults to PSD)
  - Agent Run `export` with `format: "psd" | "png" | "jpg" | "webp" | "tiff"`
- Export entrypoint: Tauri command `export_run`
- Formats supported by the native exporter: `.psd`, `.png`, `.jpg`, `.webp`, `.tiff`
- This document focuses on the PSD contract specifically.
- Destination: user-chosen save path from the native save dialog
- Source artifact: flattened PNG render of the current visible canvas composition
- Receipt output: JSON receipt from the native exporter, including timeline/export metadata
- Receipt contract ids:
  - PSD: `juggernaut.psd_export.v1`
  - raster: `juggernaut.raster_export.v1`

## What Ships Now

- The export menu now writes a valid PSD file for the current canvas result.
- The PSD preserves transparency from the flattened canvas render.
- The titlebar export menu also offers flattened PNG, JPG, WEBP, and TIFF through the same receipt-bearing native exporter.
- The export receipt captures:
  - run directory
  - active image id
  - canvas mode
  - source image paths
  - source receipt references and source receipt summaries when present
  - per-image rects and transforms
  - z-order
  - timeline nodes
  - current timeline head id
  - action sequence
  - output and source hashes

## Traceability

- Export requests carry the current timeline schema version, head node id, action sequence, export bounds, and flattened output size.
- Each source image entry can include the image's prior receipt path plus any receipt metadata already attached to that image in the session.
- When the source image came from screenshot polish, receipt-facing `screenshotPolish` metadata may include `approvedProposalId` only as an alias derived from the runtime `selectedProposalId`.
- Native export receipts add sha256 hashes for the flattened source image, final output, source assets, and any attached source receipts.
- Native export receipts also summarize source image count, timeline node count, fidelity, and the exporter contract id that wrote the file.
- PNG, JPG, WEBP, and TIFF now reuse the same receipt-bearing exporter, so screenshot-polish traceability is consistent across all currently shipped raster outputs.

## Known Limitations

- PSD output is flattened into a single bitmap composite rather than editable per-image PSD layers.
- Effect-token state, mask semantics, and tool semantics are not reified as editable PSD structures in this slice.
- Export dimensions follow Cue canvas world geometry in CSS pixels, not source DPI metadata.
- JPG export flattens transparency onto white because the target format does not preserve alpha.
- Export does not currently package a dedicated compare artifact, approval manifest, or metadata-entry payload alongside the image.

## Follow-Up

- Promote source images into editable PSD layers when the edit graph supports it cleanly.
- Carry richer mask and effect semantics into export metadata and layer structures.
- Add native `.ai` / `.fig` export and round-trip once the core slice is stable.
