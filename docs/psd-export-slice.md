# Export Slice

Cue can currently export PSD, PNG, JPG, WEBP, and TIFF from the desktop app.

## What Ships Now

- export starts from the desktop titlebar or native export command
- the native exporter writes the file and a receipt
- PSD export preserves the visible flattened canvas result, including transparency when available

## Current Limit

The exported PSD is a flattened bitmap, not a fully editable layered design file.

## Receipt Data

The receipt records the run directory, source images, transforms, output hashes, and timeline metadata used for the export.
