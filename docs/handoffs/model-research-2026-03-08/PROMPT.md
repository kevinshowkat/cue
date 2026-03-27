You are doing a research and technical recommendation pass for an early desktop product called Cue.

You have been given a small code-and-doc bundle. Use the synced runtime files and `AGENTS.md` in the bundle as primary context. Treat `PRD-local-model-pivot.md` and the two feasibility notes as historical March 8 evidence that still matters, not as the current product brief. You must also browse current official sources on the public internet because model availability, licensing, Apple Silicon support, and runtime support can change.

Your job is to determine which local image model, or smallest viable local model stack, Cue should use next for offline single-image editing on the current Mac hardware.

Do not optimize for hype, benchmark marketing, or generic text-to-image quality. Optimize for the real product jobs and the real machine envelope.

## Product Context

Cue is a text-free-first, image-first desktop design workstation for non-designers, developers, and 3D printing hobbyists.

The current product wedge is:

- one image in
- one usable asset out
- no multi-image flows in the primary loop

The current shell keeps the primary dynamic rail provider-agnostic. The relevant live model-backed single-image jobs and direct affordances are:

- `Cut Out` -> `subject_isolation`
- `Remove` -> `targeted_remove`
- `New Background` -> `background_replace`
- `Reframe` -> `crop_or_outpaint`
- `Variants` -> `identity_preserving_variation`
- `Remove People` -> `people_removal`

Current local-first single-image helpers that should remain separate from the model-backed gap analysis unless you find a strong reason otherwise:

- `Polish` -> `image_polish`
- `Relight` -> `image_relight`

Important product rules:

- the main editing loop must remain provider- and model-agnostic
- reproducibility is mandatory for every model-backed operation
- deterministic local transforms must stay separate from model-backed actions
- local-only mode is a real product requirement, not a demo feature

## Hardware Envelope

Target machine for this decision:

- MacBook Pro `Mac16,8`
- Apple `M4 Pro`
- `24 GB` unified memory
- Apple Silicon / macOS target first for this phase

## What We Need Offline

Offline-critical functionality for the next phase:

- `targeted_remove`
- `background_replace`
- `identity_preserving_variation`
- `crop_or_outpaint`

Important nuance:

- `crop` can stay deterministic/local and does not need a model
- `Cut Out` / `subject_isolation` may remain disabled unless a separate local segmentation path is the best answer

## What Has Already Failed

The bundle includes two feasibility notes. Read them before recommending anything.

1. `FLUX.2 klein 4B`
   Result: no-go on this machine as the first local model target.
   Main issues:
   - too close to memory envelope
   - Apple Silicon path unproven
   - poor first fit for precise masked edits

2. `stabilityai/stable-diffusion-2-inpainting` through Apple's current `ml-stable-diffusion` / Core ML path
   Result: no-go as the first local masked-edit target through that runtime.
   Main issues:
   - Apple's official runtime exposes image-to-image, not true mask-native inpainting
   - no real `--mask` path in the shipped helper
   - therefore weak fit for `targeted_remove` and precise `background_replace`

Do not recommend either rejected path again unless you find new official evidence that materially changes the conclusion. If you do, cite that evidence explicitly and explain why it overturns the attached notes.

## What You Need To Figure Out

Research current candidates and recommend the best next step.

You are allowed to recommend:

- one single model
- a small two-model local stack
- a model plus a separate segmentation model
- or "no suitable local model exists for the full job set on this hardware"

You are not allowed to hand-wave around runtime or platform support.

## Evaluation Criteria

Score candidates against:

1. Fit for Cue's actual jobs
   - `targeted_remove`
   - `background_replace`
   - `identity_preserving_variation`
   - `crop_or_outpaint`

2. Apple Silicon viability
   - official Apple/Core ML path, or
   - credible local Python / Diffusers / MLX / ONNX / other path

3. Machine fit
   - realistic on an M4 Pro with `24 GB` unified memory
   - not just "might run with extreme tuning"

4. Runtime shape
   - subprocess/CLI
   - helper executable
   - embedded runtime
   - local server

5. Packaging burden
   - install size
   - dependency complexity
   - conversion burden
   - first-run pain

6. Reproducibility
   - can runs be recorded with stable parameters, model ids, revisions, hashes, seeds, and artifacts

7. Licensing
   - commercial viability matters

## Candidate Space To Investigate

Be broad. Do not restrict yourself to Flux.

Investigate current options across:

- Apple/Core ML-compatible Stable Diffusion variants
- inpainting-specific local models
- variation/image-to-image specialists
- Apple-friendly diffusion or non-diffusion local image-edit models
- MLX or other Apple-native model ecosystems if relevant
- a split stack such as:
  - segmentation model for `Cut Out`
  - masked inpaint/edit model for `Remove` and `New Background`
  - separate variation model if needed

If the best answer is a hybrid stack, say so directly.

## Required Output

Give a hard recommendation, not just a survey.

Use this exact structure:

### 1. Executive Recommendation
- name the best next path
- say whether it is:
  - single model
  - two-model stack
  - or no-go for full offline scope

### 2. Why This Beats The Rejected Paths
- compare directly to:
  - `FLUX.2 klein 4B`
  - `stabilityai/stable-diffusion-2-inpainting` via Apple's current Core ML path

### 3. Candidate Shortlist
For the top 3-5 candidates, provide:
- exact model id
- source / maintainer
- license
- approximate size
- Apple Silicon/runtime path
- which Cue jobs it can cover
- which jobs it cannot cover
- major risks

### 4. Recommended Runtime Boundary
- helper executable vs subprocess vs embedded vs local server
- why

### 5. Coverage Matrix
For your recommended path, explicitly mark:
- `subject_isolation`
- `targeted_remove`
- `background_replace`
- `identity_preserving_variation`
- `crop`
- `outpaint`

Use one of:
- strong fit
- partial fit
- weak fit
- not covered

### 6. Packaging And Ops
- expected install size
- dependency stack
- first-run behavior
- reproducibility requirements
- receipts metadata that should be captured

### 7. Decision
Choose exactly one:
- proceed with model X
- proceed with model stack X + Y
- narrow offline scope to specific jobs first
- stop and rethink the offline wedge

### 8. Sources
- link all primary sources used
- prefer official model cards, official docs, official repos, and platform docs

## Quality Bar

Be specific and critical.

A good answer should help us decide whether to:

- implement a real local model now
- cut scope to `Variants` only
- adopt a hybrid stack
- or stop chasing a local model for the broader edit wedge on this Mac

Do not give generic startup advice.
Do not just say "it depends."
Make the tradeoffs explicit and defend the recommendation.
