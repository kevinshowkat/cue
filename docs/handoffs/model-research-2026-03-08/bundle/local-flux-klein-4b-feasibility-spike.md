# FLUX.2 klein 4B Feasibility Spike

Date: 2026-03-08
Branch: `feature/local-flux-benchmark`
Scope: first local image model phase only

## Verdict

Go/no-go: `no-go` as the first local image model target for Juggernaut's offline single-image phase on the current machine.

Reason:

- The official open model is real and supported in Diffusers.
- The local Apple-native stack is viable at the package level on this Mac.
- The checkpoint footprint is too close to the machine's full unified-memory budget to be a safe first offline target.
- The exposed edit interface is prompt-plus-image, not mask-native, which makes it a weak first fit for precise offline edit jobs like `targeted_remove` and `subject_isolation`.

## Machine Facts

Collected locally on this worktree host:

- MacBook Pro `Mac16,8`
- Apple `M4 Pro`
- 12 CPU cores
- 16 GPU cores
- `24 GB` unified memory
- PyTorch MPS available: `True`
- `torch.mps.recommended_max_memory()`: `17179885568` bytes (`16.00 GiB`)

Commands used:

- `system_profiler SPHardwareDataType`
- `system_profiler SPDisplaysDataType`
- `sysctl hw.memsize`
- `source .venv-flux-spike/bin/activate && python -c 'import torch; ...'`

## Upstream Evidence

Primary sources:

- Hugging Face model card: <https://huggingface.co/black-forest-labs/FLUX.2-klein-4B>
- Hugging Face model API metadata: <https://huggingface.co/api/models/black-forest-labs/FLUX.2-klein-4B>
- Black Forest Labs reference repo: <https://github.com/black-forest-labs/flux2>
- BFL blog post: <https://bfl.ai/blog/flux2-klein-towards-interactive-visual-intelligence>
- Diffusers FLUX.2 docs: <https://huggingface.co/docs/diffusers/main/api/pipelines/flux2>

What those sources establish:

- `FLUX.2 klein 4B` is an official open-weight model with `image-to-image` / editing support.
- The model card describes it as a unified generation-and-editing model with single and multi-reference image editing support.
- The Diffusers integration uses `Flux2KleinPipeline`.
- The BFL reference repo's local installation path was tested on `CUDA 12.9` with `Python 3.12`.
- The reference repo ships an interactive CLI, not an embedded SDK or local HTTP server.

## Local Smoke Evidence

What was verified locally:

- A repo-local Python 3.11 virtualenv was created successfully: `.venv-flux-spike`
- Installed: `torch 2.10.0`, `diffusers 0.37.0`, `transformers 5.3.0`, `accelerate`, `safetensors`, `huggingface_hub`
- Imported `Flux2KleinPipeline` successfully on Apple Silicon
- Verified `torch.backends.mps.is_available() == True`
- Verified basic tensor execution on MPS
- Downloaded only model config/tokenizer assets successfully without downloading full weights

What was not verified:

- Full model weight download
- Full pipeline load on this machine
- Any real image generation or edit latency on this machine
- Quality/faithfulness of local edits on Juggernaut-relevant tasks

## Why This Is A No-Go On This Mac

The strongest local blocker is memory headroom.

- Hugging Face model API reports `usedStorage = 23735489815` bytes for the model repository (`22.11 GiB`).
- This machine has `24.00 GiB` total unified memory.
- PyTorch reports `recommended_max_memory = 16.00 GiB` for MPS on this machine.

That does not prove the model can never run here, because offload and streaming strategies exist. It does show the first-phase target would start from a bad place:

- cold-start risk is high
- warm interactive latency is unverified and likely poor without aggressive offload/quantization
- headroom for Juggernaut, the OS, and image buffers is thin
- packaging the full Python/PyTorch/runtime stack would be heavy for a first offline slice

## Integration Boundary Recommendation

Recommended boundary: `local subprocess/CLI`

Why this is the cleanest fit:

- The existing desktop stack already launches a separate local engine process.
- The BFL reference implementation is CLI-oriented.
- A subprocess boundary keeps Python, PyTorch, model weights, and failure isolation out of the Tauri shell.
- It matches Juggernaut's reproducibility model better than an embedded runtime.
- It avoids the packaging and lifecycle complexity of a separate local HTTP daemon for the first phase.

Practical recommendation:

- Use a long-lived supervised worker process, but keep the contract CLI-like and file/JSON based.
- Inputs: model id, revision, seed, prompt, capability, input image paths, optional mask path, dimensions, steps, guidance, output dir.
- Outputs: artifact paths, timings, stderr/stdout logs, exact resolved config, failure code, receipt payload.

## Capability Readout For Offline-First Phase

Evidence-backed realism ranking:

1. `identity_preserving_variation`
   - Most realistic first target.
   - Best aligned with the official prompt-plus-image editing surface.

2. `background_replace`
   - Plausible only if paired with an external foreground/subject mask or pre-cut asset.
   - Weak as a pure FLUX-only first capability because the exposed interface is not mask-native.

3. `crop_or_outpaint`
   - `crop` should stay deterministic and local.
   - `outpaint` is not proven in this spike; possible in principle, but not a first-confidence local capability here.

4. `targeted_remove`
   - Not a strong first fit.
   - Precise removal typically needs an explicit mask/inpaint boundary that was not present in the verified pipeline surface.

## Subject Isolation

Conclusion: `subject_isolation` / `Cut Out` should use a separate local segmentation model.

Why:

- The official `Flux2KleinPipeline.__call__` surface verified locally accepts `image` and `prompt`, but no explicit `mask`.
- The BFL CLI also centers on prompt plus `input_images`, not segmentation outputs.
- `Cut Out` needs stable alpha-mask behavior, not approximate generative reinterpretation.

## Operational Constraints

- Install/download burden:
  - Python env plus libraries: manageable
  - model weights: heavy (`22.11 GiB` repository storage)
- Cold start risk:
  - high
- Warm run latency:
  - not verified
  - likely not safe to assume interactive performance on this Mac without quantization/offload work
- Memory / VRAM / Apple Silicon risk:
  - high
  - official reference path is CUDA-tested, not Apple-tested
  - package-level MPS support exists through Diffusers/PyTorch, but full-model fit is the blocker
- Packaging complexity:
  - medium-high for a first local slice
  - Python + torch + model asset management + safety/provenance extras
- Reproducibility:
  - workable only if every run records model revision, local package versions, seed, scheduler, steps, guidance, exact inputs, output hashes, and failure logs

## Recommendation

For Juggernaut's first local offline image phase on this exact machine/workflow:

- Do not choose `FLUX.2 klein 4B` as the first local model target.
- Keep it as a later candidate behind either:
  - quantized Apple-friendly runtime validation, or
  - a higher-memory machine class
- For first offline capability, prioritize:
  - deterministic local crop/reframe
  - separate local segmentation for `Cut Out`
  - a smaller local image-edit path only if it demonstrates real masked-edit behavior within this memory budget

## Repro Steps

Commands used during this spike:

```bash
system_profiler SPHardwareDataType
system_profiler SPDisplaysDataType
sysctl hw.memsize hw.optional.arm64
uv venv .venv-flux-spike --python 3.11
source .venv-flux-spike/bin/activate
uv pip install torch diffusers transformers accelerate sentencepiece safetensors huggingface_hub pillow
python - <<'PY'
import torch
from diffusers import Flux2KleinPipeline
print(torch.__version__)
print(torch.backends.mps.is_available())
print(torch.mps.recommended_max_memory())
print(Flux2KleinPipeline.__name__)
PY
python - <<'PY'
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id='black-forest-labs/FLUX.2-klein-4B',
    allow_patterns=[
        'README.md',
        'model_index.json',
        'scheduler/*',
        'tokenizer/*',
        'text_encoder/config.json',
        'transformer/config.json',
        'vae/config.json',
    ],
    local_dir='.cache/flux2-klein-config',
)
PY
```
