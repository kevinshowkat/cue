## Layout Handoff

Updated on 2026-03-08 for the `feature/design-shell-layout` worktree.

### What moved
- `#custom-tool-dock` now lives in `.juggernaut-shell-chrome` so custom tools read as part of the visible left rail instead of the hidden legacy bottom dock.
- `#top-metrics` now lives in `.juggernaut-shell-head` beside the PSD export action, which keeps the stage header as the main workspace chrome surface.
- The stage context pill now reads `Canvas` instead of repeating the `Juggernaut` app wordmark.

### Runtime Notes
- All existing IDs were preserved. Runtime lookups for `#top-metrics`, `#custom-tool-dock`, `#action-grid`, `#juggernaut-selection-status`, and `#juggernaut-export-psd` should continue to work without code changes.
- Legacy structures such as `#control-strip`, `#file-browser-dock`, `#hud`, `#agents-dock`, `#mother-overlay`, and `#filmstrip` are still present for compatibility, but they remain visually suppressed by the current shell CSS.

### Visual Notes
- The visible shell now has three intended surfaces: app-level brand/menu strip, stage-level header, and the left tool/custom-tool rail.
- If the metrics ribbon is re-enabled visually, it should be treated as a subtle stage utility row inside `.juggernaut-shell-head`, not as a separate app-wide chrome band.
- The custom tool dock can now be styled as the lower segment of the left rail without additional DOM changes.
