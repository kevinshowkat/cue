# Design Review Proposal Preview Images

## Purpose
Reintroduce image-backed design-review proposal cards without recreating the latency regression that previously made proposal review feel blocked and sluggish.

The feature adds two distinct image-generation lanes:

- a fast async thumbnail lane that renders proposal-card preview images with Nano Banana 2
- a higher-fidelity selected-proposal lane that rerenders only the currently selected proposal with Nano Banana Pro

The planner remains the first gate. Proposal cards must become selectable as soon as planning completes, even if no preview image has rendered yet.

## Problem
Cue currently returns planner-driven proposal cards with text only. That keeps the tray responsive, but it weakens the review surface in exactly the moment where users need confidence about what a proposal will do to the full frame.

The previous proposal-preview implementation was removed because preview generation sat too close to the critical path and materially slowed proposal availability.

We need proposal-card imagery back, but only under a contract that preserves fast planner-first review.

## Goals
- Show proposal-card thumbnails that represent the proposed edit on the actual frame, not a disconnected crop.
- Keep proposal readiness planner-first and non-blocking.
- Use Nano Banana 2 for throughput-oriented background thumbnail generation.
- Use Nano Banana Pro only for the selected proposal compare surface.
- Preserve the existing action-first review/apply flow and reproducible artifact model.
- Keep thumbnail failures non-fatal to review.

## Non-Goals
- Do not make thumbnail rendering a prerequisite for proposal selection.
- Do not force Google Search or Image Search grounding into normal proposal rendering.
- Do not add chat-style interaction to design review.
- Do not expand the visible primary workflow beyond the current single-image-first review/apply wedge.

## User Experience
1. The user triggers `Design review`.
2. Cue opens the proposal tray immediately with 2-3 skeleton slots.
3. The planner returns text proposals and the cards become selectable as soon as planning finishes.
4. Cue starts background thumbnail generation for each ready proposal with Nano Banana 2.
5. As each thumbnail finishes, the matching proposal card upgrades from text-only to image-backed without disturbing tray layout or card ordering.
6. When the user selects one proposal, Cue starts a higher-fidelity compare rerender for that proposal only using Nano Banana Pro.
7. The compare surface updates when the selected rerender completes; the user can still switch proposals or accept the current proposal while rerendering is in flight.
8. Accepting a proposal continues to route through the normal execution/apply layer unless a later implementation explicitly promotes the selected compare artifact under a receipt-safe contract.

## Product Rules
- Proposal cards must be selectable before any preview image succeeds.
- Thumbnail generation must be best-effort and per-proposal; one failure must not poison the tray.
- Thumbnail rendering and selected rerendering must remain tab-local and request-local.
- If the review request changes, any stale thumbnail or selected-rerender result must be discarded.
- Thumbnail rendering must use the visible frame context so the result reflects the actual scene composition.
- The compare surface should prefer the selected Pro rerender when available and otherwise fall back to the fast thumbnail or original frame.

## Model Routing Policy
### Planner
- Model: `GPT-5.4 vision`
- Role: proposal planning only

### Proposal Card Thumbnails
- Model: `Nano Banana 2` (`gemini-3.1-flash-image-preview`)
- Provider preference: Google direct first; preserve existing provider-routing abstractions
- Priority: speed and throughput
- Defaults:
  - async/background execution
  - nearest supported source aspect ratio
  - `0.5K` output when supported for the target route
  - no Google Search grounding by default
  - no Image Search grounding by default
  - lowest-latency reasoning/thinking configuration supported by the chosen route

### Selected Proposal Compare Rerender
- Model: `Nano Banana Pro` (`gemini-3-pro-image-preview`)
- Trigger: selection of one ready proposal
- Priority: higher visual confidence for the selected card/surface, not bulk throughput
- Defaults:
  - one in-flight rerender per active review request
  - nearest supported source aspect ratio
  - interactive resolution target, defaulting to `1K`
  - no grounding by default unless a future proposal type explicitly requires it

### Final Apply
- Keep the existing final-apply route unchanged for the first pass.
- Current default remains `Nano Banana 2` unless a follow-up task explicitly defines safe promotion of the selected compare artifact into the apply contract.

## Technical Direction
- Keep the planner, thumbnail renderer, selected compare renderer, and final apply as separate phases with independent state transitions.
- The Google direct image path should use Gemini image `generateContent` with different model ids for Nano Banana 2 and Nano Banana Pro.
- OpenRouter parity may require a different request envelope from the direct Google path; this is a routing concern, not a product-level behavior change.
- Preview artifacts should be written as explicit run-local files so the tray, compare surface, and receipts can reference stable paths.

## State Contract
Each proposal may carry the following optional media state:

```text
{
  proposalId: "proposal_123",
  previewStatus: "queued" | "running" | "succeeded" | "failed" | null,
  previewImagePath: "/absolute/path/to/proposal-preview.png" | null,
  selectedPreviewStatus: "idle" | "running" | "succeeded" | "failed" | null,
  selectedPreviewImagePath: "/absolute/path/to/proposal-selected-preview.png" | null
}
```

Rules:
- `previewStatus` is independent from proposal readiness.
- `selectedPreviewStatus` belongs only to the currently selected proposal for the current request.
- Clearing or replacing the review request clears both preview paths unless they still match the active request hash.

## Latency And Performance Requirements
- Proposal-card readiness must be measured from planner completion, not preview completion.
- Thumbnail generation must not block planner completion, tray interaction, canvas input, or apply dispatch.
- Thumbnail rendering should run with bounded concurrency so one request does not saturate the queue.
- The system should prefer dropping stale preview work over letting old work compete with the active review request.
- Thumbnail generation should target the smallest useful image size for card readability.

## Failure Behavior
- If thumbnail generation fails, keep the proposal card visible and selectable with text-only copy.
- If selected Pro rerender fails, keep the proposal selected and fall back to the existing compare state.
- Planner failures still fail the request normally.
- Apply failures remain isolated to apply and must not erase successful preview media already attached to the tray.

## Acceptance Criteria
- Triggering `Design review` still shows proposal skeletons immediately.
- Ready proposals appear before any thumbnail finishes.
- Thumbnail generation starts automatically after planner success.
- Thumbnail generation uses Nano Banana 2 and remains non-blocking.
- Selecting a proposal starts a Nano Banana Pro rerender for that proposal only.
- Stale preview results are ignored after request changes, tab changes, or proposal replacement.
- A failed thumbnail or selected rerender does not remove the card or block accept.
- The product definition and routing defaults are documented in `PRD.md`.

## Open Questions
- Whether a completed selected Pro rerender can later be promoted directly into the final apply artifact.
- Whether OpenRouter preview parity is needed in the first shipping pass or can remain Google-direct first.
- Whether some proposal types should request `1K` thumbnails instead of `0.5K` when card readability depends on small text or intricate composition changes.
