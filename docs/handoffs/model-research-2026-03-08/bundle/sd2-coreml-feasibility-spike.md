# SD2 Core ML Feasibility Spike

Date: 2026-03-08
Branch: `feature/local-flux-benchmark`
Scope: `stabilityai/stable-diffusion-2-inpainting` feasibility on this Mac via Apple `ml-stable-diffusion` / Core ML only

## Verdict

Go/no-go: `no-go` for `stabilityai/stable-diffusion-2-inpainting` as the first local masked-edit model target on this machine through Apple's current `ml-stable-diffusion` runtime.

Why:

- Apple's official runtime is currently an `image-to-image` surface, not a true `inpainting` surface.
- The shipped Swift helper exposes `--image` and `--strength`, but no `--mask`.
- The official Swift source defines `textToImage` and `imageToImage`, while `inPainting` is commented out.
- Official diffusers inpainting requires both `image` and `mask_image`.
- The SD2 inpainting checkpoint uses a `9`-channel UNet, while Apple's runtime builds plain latent inputs rather than the masked latent concatenation that inpainting requires.

## Local Machine Facts

Collected on this host:

- MacBook Pro `Mac16,8`
- Apple `M4 Pro`
- 12 CPU cores
- 16 GPU cores
- `24 GB` unified memory
- Xcode `26.2`
- Swift `6.2.3`
- `git-lfs` available
- Free disk during spike: `~86 GiB`

Commands used:

- `system_profiler SPHardwareDataType`
- `system_profiler SPDisplaysDataType`
- `xcodebuild -version`
- `swift --version`
- `git lfs version`
- `df -h`

## Official Apple Evidence

Primary source:

- Apple official repo: <https://github.com/apple/ml-stable-diffusion>

What the official Apple source establishes:

- Apple supports Core ML Stable Diffusion text-to-image and image-to-image workflows.
- The README states that `VAEEncoder.mlmodelc` is optional "for image2image, in-painting, or similar".
- The shipped Swift CLI exposes `--image` and `--strength`.
- The shipped Swift pipeline config defines:
  - `textToImage`
  - `imageToImage`
  - `// case inPainting`
- The Swift pipeline code comments say the encoder is used for `image2image, and soon, in-painting`.
- The Python Core ML CLI is text-to-image oriented and also exposes no mask argument.

Local verification against the official Apple helper:

- Built the official Swift CLI locally with:
  - `swift run --package-path /tmp/ml-stable-diffusion-official StableDiffusionSample --help`
- Build completed successfully on this Mac.
- The built helper shows:
  - `--image`
  - `--strength`
  - no `--mask`
- Negative-path runtime check:
  - `/tmp/ml-stable-diffusion-official/.build/arm64-apple-macosx/debug/StableDiffusionSample "test prompt" --mask /tmp/fake-mask.png`
  - Result: `Unknown option '--mask'. Did you mean '--image'?`

## Official SD2 Inpainting Evidence

Primary sources:

- Official Stability AI model page: <https://huggingface.co/stabilityai/stable-diffusion-2-inpainting>
- Official UNet config view: <https://huggingface.co/stabilityai/stable-diffusion-2-inpainting/blob/main/unet/config.json>
- Official diffusers inpainting docs: <https://huggingface.co/docs/diffusers/api/pipelines/stable_diffusion/inpaint>

What those sources establish:

- `stabilityai/stable-diffusion-2-inpainting` is an inpainting checkpoint, not a plain image-to-image checkpoint.
- Official diffusers inpainting requires `image` plus `mask_image`.
- The SD2 inpainting UNet config shows `in_channels: 9`.
- By contrast, the standard SD2 base UNet shows `in_channels: 4`.

## Why The Official Apple Runtime Is A Mismatch

The mismatch is structural, not just a missing CLI flag.

- Apple's Swift pipeline generates latent inputs using the UNet latent sample shape and optional starting image encoding.
- It does not construct the masked concatenation expected by Stable Diffusion inpainting pipelines.
- The official Swift configuration has no mask field.
- The official Swift CLI has no mask option.
- The official Python Core ML CLI has no image or mask argument either.

This means the current Apple runtime path is suitable for:

- text-to-image
- image-to-image

It is not a proven path for:

- true masked inpainting
- object removal with preserved outside pixels
- reliable background replacement scoped by a user mask

## Runtime Boundary Recommendation

Recommended boundary: `tauri-side helper`

Meaning:

- a bundled macOS-only Swift helper executable
- built from Apple's Swift package
- invoked by the app with a file/JSON contract

Why this is the cleanest fit:

- Apple ships the runtime in Swift, not Rust.
- It avoids embedding Swift/Core ML logic directly into the Tauri or Rust production runtime.
- It avoids a long-lived local HTTP daemon for a single-machine offline feature.
- It can ship prebuilt, which avoids the ugly `swift run` cold-build path during app use.
- It still gives deterministic inputs/outputs for receipts.

If a simpler label is required, this is still subprocess-like in execution, but `tauri-side helper` is the more accurate production boundary for this stack.

## Capability Readout

### Most realistic first

- `identity_preserving_variation`
  - Most realistic first capability from the official Apple runtime.
  - Fits the existing `--image` + `--strength` surface.

### Conditional / partial

- `background_replace`
  - Only realistic if Juggernaut already has a separate subject mask / cutout / selection path.
  - Core ML SD2 image-to-image can help restyle or regenerate a prepared background, but not provide precise mask-native background replacement by itself.

- `crop_or_outpaint`
  - `crop`: yes, but should stay deterministic/local and not use SD2/Core ML.
  - `outpaint`: unproven and not recommended as the first Core ML capability through this Apple path.

### Not realistic first

- `targeted_remove`
  - Not realistic as a first capability through the official Apple runtime because true masked inpainting is not exposed.

## Background Replace

Conclusion: `background_replace` requires an existing mask/selection path if quality and edit locality matter.

Without a mask/selection path, this runtime behaves more like global image-to-image transformation than scoped replacement.

## Subject Isolation

Conclusion: `subject_isolation` still clearly needs a separate segmentation model.

Reasons:

- Neither the official Apple helper nor the official Apple pipeline exposes a segmentation path.
- The current Apple Core ML Stable Diffusion runtime does not replace a dedicated cutout/alpha-mask model.
- `Cut Out` is not a generative diffusion problem if Juggernaut needs stable, reusable alpha edges.

## Operational Constraints

- Install footprint:
  - Official Apple compiled SD2 base Core ML package: `8,704,955,406` bytes (`~8.11 GiB`)
  - Official Apple compiled SD2.1 base Core ML package: `8,704,960,705` bytes (`~8.11 GiB`)
  - No official Apple SD2 inpainting compiled package was identified in this spike.

- Cold start:
  - `swift run` helper build is a poor production cold path.
  - Local build on this machine completed successfully in `6.61s` after cached dependencies.
  - Apple's own test note says first-time Swift CLI execution can take around `~5 minutes` due to building.
  - Shipping a prebuilt helper is mandatory if this stack is used.

- Warm latency:
  - true masked inpainting was not verified because the official runtime does not expose it
  - image-to-image generation latency with full model resources was not measured in this spike

- Packaging risk:
  - medium
  - the helper is shippable on macOS, but it is Apple-platform-specific and large
  - conversion should not happen during normal app use

- Reproducibility risk:
  - manageable if the helper records:
    - model id
    - model revision
    - compiled model hash
    - compute units
    - scheduler
    - seed
    - step count
    - guidance scale
    - starting image hash
    - mask hash when applicable
  - current blocker is not receipts, it is missing mask-native execution support

## Community Artifact Check

I looked for obvious Hugging Face Core ML inpainting artifacts as a speed-up path.

Result:

- no clear maintained Core ML artifact for `stable-diffusion-2-inpainting` surfaced in the direct Hugging Face searches used during this spike
- because the official Apple runtime itself lacks a true inpainting surface, a community Core ML artifact would not fix the main integration issue unless it came with a different runtime path

## Recommendation

For Juggernaut's first local offline image phase on this Mac:

- Do not choose `stabilityai/stable-diffusion-2-inpainting` through Apple's current `ml-stable-diffusion` runtime as the first local masked edit target.
- If using Apple's Core ML stack at all, use it first for:
  - `identity_preserving_variation`
  - optional image-to-image assist after an existing deterministic selection/cutout pipeline
- Keep `targeted_remove` behind a runtime that truly supports masked inpainting.
- Keep `subject_isolation` on a separate segmentation model.

## Repro Steps

Commands used in this spike:

```bash
git clone --depth 1 https://github.com/apple/ml-stable-diffusion /tmp/ml-stable-diffusion-official
swift run --package-path /tmp/ml-stable-diffusion-official StableDiffusionSample --help
/tmp/ml-stable-diffusion-official/.build/arm64-apple-macosx/debug/StableDiffusionSample "test prompt" --mask /tmp/fake-mask.png
```
