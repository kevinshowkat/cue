# Screenshot Polish MVP

## What This Phase Means

In Cue, `screenshot polish` means taking one rough still image and turning it into a presentable approved still without requiring design vocabulary. For a reader who is new to game development, treat `screenshot` broadly here: it can be a gameplay capture, a UI mockup, a product still, or any other single image that needs cleanup before sharing.

## Full MVP Target

The full screenshot-polish MVP is the narrow product loop below:

1. Import one still image into a session.
2. Point at what should change with marks or region picks instead of prompt writing.
3. Run `Design Review` and get a small set of actionable proposals.
4. Accept one proposal into a traced in-place apply.
5. Preserve the original and approved variants so the user can compare outcomes before exporting.
6. Capture lightweight publishing metadata for the approved still.
7. Export a receipt-backed asset for downstream tools or sharing.

## What Is Landed Now

The current repo does ship a usable screenshot-polish increment, but it is narrower than the full MVP target:

- One Mac desktop window with session tabs over a shared canvas.
- One active still can be edited through direct single-image actions plus `Design Review`.
- The visible communication rail exposes `Marker`, `Highlight`, `Magic Select`, and `Eraser`.
- Accepted review proposals replace the target image in place, write a review-apply receipt, and record a timeline node.
- `Fork tab` plus the visual history shelf are the current manual compare surfaces.
- Saved runs reopen from `session-timeline.json` first and `juggernaut-session.json` second.
- Export uses the current approved tab state and writes receipt-bearing PSD, PNG, JPG, WEBP, or TIFF output.

## Phase Workstreams Reflected Here

The screenshot-polish phase was split into smaller workstreams. In the repo state documented here:

- Review contract work is landed.
  - Planner traces, review/apply requests, and review/apply receipts carry target, reference, proposal, provider, and cost/latency lineage.
- Proposal UI work is landed.
  - The communication tray is tab-local, reflects runtime review/apply state, and stays isolated when tabs are forked or reopened.
- Approved compare/export work is partially landed.
  - Users can preserve alternatives through tab forks and timeline restore, and exports carry the current timeline head plus source lineage.
  - There is not yet a dedicated side-by-side compare viewer or approval gallery.
- Metadata entry work is not yet landed in the current increment.
  - There is no user-facing screenshot metadata entry flow for title, caption, destination, or release notes yet.

## Canonical Runtime Naming

When screenshot-polish tests or implementation docs need field names, use:

- `proposalId`
- `selectedProposalId`
- `previewImagePath`
- `changedRegionBounds`
- `preserveRegionIds`
- `rationaleCodes`

Use the split below precisely:

- Proposal records keep `proposalId`.
- Runtime and apply state keep `selectedProposalId`.
- Receipt-facing `screenshotPolish` metadata may include `approvedProposalId`, but only as an alias derived from `selectedProposalId`.

## What Compare Means Today

`Compare` is currently manual and session-based:

- Fork the active tab before a risky edit if you want to preserve the baseline.
- Use the history shelf to rewind or inspect committed states inside one tab.
- Reopen a saved run to recover the same tab-local timeline head later.

Cue does not yet ship a purpose-built before/after slider, side-by-side variant grid, or approved-shot browser.

## Follow-On Gaps

- Dedicated screenshot metadata entry.
- Dedicated compare and approval UX.
- Editable layered PSD export.
- Native `.ai` / `.fig` export and round-trip.
- Release-level Windows and Linux parity for the same screenshot-polish slice.

## Regression Coverage

Focused regression coverage for this slice now lives in:

- `desktop/test/session_snapshot.test.js`
- `desktop/test/session_timeline.test.js`
- `desktop/test/tab_fork_design_review_state_regression.test.js`
- `desktop/test/canvas_app_review_apply_bridge.test.js`
- `desktop/test/design_review_bootstrap_runtime_state.test.js`
- `desktop/test/export_psd_contract.test.js`
