# Export Slice

Cue's screenshot-polish baseline treats export as a receipt-backed handoff step.

## Baseline Proof Target

- baseline proof is `PSD` plus `PNG`
- `JPG`, `WEBP`, and `TIFF` ride the same flattened raster path, but they are not the first proof target
- `.ai` and `.fig` stay architecture hooks only; they are intentionally not visible or implemented in this slice

## Canonical Run Layout

- flattened export input is written under `<runDir>/artifacts/`
- the canonical exported artifact is written under `<runDir>/artifacts/`
- the canonical export receipt is written under `<runDir>/receipts/`
- the user-selected handoff path receives a copy of the canonical artifact when it differs from the run artifact path

## What Ships Now

- export starts from the titlebar export menu or the native export command
- the native exporter packages the visible tab state into a flattened bitmap composition
- PSD preserves transparency when available
- PNG preserves transparency when available
- all export receipts include source-image lineage, timeline pointers, hashes, and the canonical artifact path

## Current Limits

- PSD export is flattened, not a fully editable layered design file
- raster exports are flattened single-bitmap outputs
- `.ai` and `.fig` only have reserved contract hooks in this slice

## Receipt Shape

The export receipt follows the published Domain receipt and artifact contracts:

- `artifact` points at the canonical run artifact, not the flattened source input
- `timeline` points back to the current head node when one exists
- `source_artifacts` lists the visible source images and their receipt lineage
- legacy `artifacts.*` fields remain populated for compatibility, but the canonical record is the typed `artifact` entry
