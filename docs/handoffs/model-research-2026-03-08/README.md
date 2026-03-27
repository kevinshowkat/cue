# Model Research Handoff

Original handoff date: 2026-03-08
Bundle refreshed: 2026-03-26

This bundle is for an external advanced LLM or researcher to evaluate local image models for Cue. It pairs the original March 8 feasibility notes with the current repo-level product constraints and single-image runtime files.

## Goal

Find a local image model, or smallest viable local model stack, that fits Cue's actual offline use case on the current Mac:

- MacBook Pro `Mac16,8`
- Apple `M4 Pro`
- `24 GB` unified memory
- single-image-first workflow
- main loop must stay provider/model agnostic
- reproducibility is mandatory

## What The Researcher Should Optimize For

The target is not generic image generation. It is the narrow offline single-image wedge:

- `targeted_remove`
- `background_replace`
- `identity_preserving_variation`
- `crop_or_outpaint`

`subject_isolation` / `Cut Out` may stay disabled unless a separate local segmentation path is recommended.

## Why This Bundle Exists

Two plausible paths already failed on this exact machine:

- `FLUX.2 klein 4B`
- `stabilityai/stable-diffusion-2-inpainting` through Apple's current `ml-stable-diffusion` / Core ML path

The attached notes explain why, so the next pass can avoid repeating the same dead ends.

## Files

`PROMPT.md` lives in this directory. The portable handoff source lives under `bundle/`, and `juggernaut-model-research-handoff-2026-03-08.tar.gz` extracts into a top-level `juggernaut-model-research-handoff-2026-03-08/` folder with the same contents:

- `AGENTS.md`
  Current repo-level product and implementation constraints.
- `PRD.md`
  Current source-of-truth product definition from the repo.
- `PRD-local-model-pivot.md`
  Historical planning doc from the original March 8 local-model scope branch. Use it as background context, not as the current product brief.
- `action_provenance.js`
  Current provenance contract for distinguishing local-only, local-first, and model-backed actions.
- `single_image_capability_routing.js`
  Current single-image capability and direct-affordance routing contract.
- `tool_runtime.js`
  Current provider-agnostic tool/runtime entry points, including create-tool and direct-affordance invocation helpers.
- `tool_apply_runtime.js`
  Current capability execution bridge for model-capability and deterministic local-edit routes.
- `local_tool_edits.js`
  Current deterministic local edit helpers imported by `tool_apply_runtime.js`.
- `local-flux-klein-4b-feasibility-spike.md`
  Historical evidence-backed no-go note for FLUX.2 klein 4B on this machine.
- `sd2-coreml-feasibility-spike.md`
  Historical evidence-backed no-go note for SD2 inpainting through Apple's current Core ML path on this machine.

## Expected Research Output

The best answer should either:

1. recommend one local model that can credibly cover most of the offline-critical jobs on this Mac, or
2. state clearly that no single model fits, then recommend the smallest practical local stack and runtime boundary.

The output should be specific about:

- exact model ids
- licenses
- Apple Silicon viability
- memory footprint
- runtime boundary
- which jobs each model can and cannot cover
- why the recommendation is better than the two rejected paths
