# Action Grid Hover Stability

This change keeps the Action Grid hover state visually steady on macOS.

## Summary

- the old hover treatment caused a small shimmer when the pointer entered or left a button
- the current version keeps the lift-and-glow feeling without that jitter

## Main File

- `desktop/src/styles.css`
