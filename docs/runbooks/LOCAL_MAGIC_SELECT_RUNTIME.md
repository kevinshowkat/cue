# Local Magic Select Runtime

Worker-runtime is now the source of truth for the prepared-session Magic Select seam. The desktop-facing contract is `juggernaut.magic_select.local.prepared.v1` with explicit prepare, warm-click, and release actions. The underlying helper still shells out to local MobileSAM, writes a mask artifact outside git, derives contour points from that mask, and records reproducibility metadata in a receipt.

## Latency Target

- Treat March 26, 2026 as the current benchmark date for this machine and branch.
- The sub-500ms push applies to prepared-session warm clicks, not to the first cold helper launch.
- Measure these phases separately:
  - `cold load`: Python imports plus MobileSAM model load, or the equivalent cold helper subprocess invocation
  - `prepare`: `magic_select_prepare`, which is dominated by `predictor.set_image(...)` on the active source image
  - `warm click`: `magic_select_warm_click`, which reuses the prepared predictor and image embedding
- Intended fast-path behavior:
  - the helper/model load is a cold-path cost
  - image prepare is paid once per active image and settings set
  - warm clicks reuse that prepared state until the source image or runtime settings change
- Current canvas regression contract:
  - a re-click near the same anchor cycles the existing runtime-backed candidates without invoking the local runtime again
  - downstream state must preserve `receipt`, `reproducibility`, `warnings`, `maskRef`, and contour-backed candidate geometry during those warm clicks

## Runtime Contract

- Contract: `juggernaut.magic_select.local.prepared.v1`
- JS exports:
  - `prepareLocalMagicSelectImage(...)`
  - `runWarmLocalMagicSelectClick(...)`
  - `releaseLocalMagicSelectImage(...)`
  - `evictLocalMagicSelectImage(...)`
- Tauri commands:
  - `prepare_local_magic_select_image`
  - `run_local_magic_select_warm_click`
  - `release_local_magic_select_image`
- Action names:
  - `magic_select_prepare`
  - `magic_select_warm_click`
  - `magic_select_release`
- Default model target: `MobileSAM` (`vit_t`) on local CPU
- Remote/provider calls: none

### Prepare Success Fields

- `ok`
- `contract`
- `action`
- `imageId`
- `preparedImageId`
- `preparedImage`
- `receipt`
- `warnings`

### Warm Click Success Fields

- `ok`
- `contract`
- `action`
- `imageId`
- `candidate`
- `group`
- `receipt`
- `warnings`
- `preparedImageId`
- `preparedImage`

Warm-click `candidate` and `group` must continue to preserve contour-backed selection data when present, including:

- `candidate.id`
- `candidate.bounds`
- `candidate.contourPoints`
- `candidate.maskRef`
- `candidate.confidence`
- `candidate.source`

### Release Result Fields

- `ok`
- `contract`
- `action`
- `imageId`
- `preparedImageId`
- `warnings`

The current JS bridge also surfaces:

- `released`
- `evicted`

`evictLocalMagicSelectImage(...)` is currently an alias of `releaseLocalMagicSelectImage(...)` in the JS bridge.

### Error Fields

Errors are explicit and non-destructive. When the runtime surfaces a structured error, preserve:

- `code`
- `nonDestructive`
- `contract`
- `action`
- `imageId`
- `preparedImageId`
- `warnings` when present
- `details` when present

Each receipt still records model id and revision, image hash and stable source reference, threshold/settings, and output mask lineage for the phase that produced it.

## Helper Setup

The Tauri seam expects these environment variables:

```bash
export JUGGERNAUT_MAGIC_SELECT_MODEL_PATH="/absolute/path/to/mobile_sam.pt"
export JUGGERNAUT_MAGIC_SELECT_MODEL_ID="mobile_sam_vit_t"
# Optional; if omitted the runtime records a short sha256-based revision from the weights file.
export JUGGERNAUT_MAGIC_SELECT_MODEL_REVISION="mobile_sam_official"
# Optional overrides:
export JUGGERNAUT_MAGIC_SELECT_PYTHON="python3"
export JUGGERNAUT_MAGIC_SELECT_HELPER="/absolute/path/to/scripts/magic_select_mobile_sam.py"
```

Verified local-only setup on this machine uses:

```bash
export JUGGERNAUT_MAGIC_SELECT_PYTHON="/Users/mainframe/.venvs/juggernaut-magic-select/bin/python"
export JUGGERNAUT_MAGIC_SELECT_HELPER="/Users/mainframe/Desktop/projects/juggernaut-ms-perf-bench-qa-docs/scripts/magic_select_mobile_sam.py"
export JUGGERNAUT_MAGIC_SELECT_MODEL_PATH="/Users/mainframe/Models/Juggernaut/mobile_sam.pt"
export JUGGERNAUT_MAGIC_SELECT_MODEL_ID="mobile_sam_vit_t"
export JUGGERNAUT_MAGIC_SELECT_MODEL_REVISION="sha256:6dbb90523a35"
export JUGGERNAUT_MAGIC_SELECT_THREADS="1"
```

If `JUGGERNAUT_MAGIC_SELECT_HELPER` is not set, the desktop app falls back to this repo copy:

```text
scripts/magic_select_mobile_sam.py
```

## Install MobileSAM

Primary source: the official MobileSAM repository documents `pip install git+https://github.com/ChaoningZhang/MobileSAM.git` and the `mobile_sam.pt` checkpoint path convention.

- Official repo: https://github.com/ChaoningZhang/MobileSAM
- Install PyTorch first using the official PyTorch instructions for your target CPU/GPU environment.
- Then install MobileSAM:

```bash
python3 -m pip install git+https://github.com/ChaoningZhang/MobileSAM.git
```

- Download `mobile_sam.pt` from the official MobileSAM checkpoint location and store it outside git.
- Point `JUGGERNAUT_MAGIC_SELECT_MODEL_PATH` at that local weights file.

### Verified macOS setup

The helper was verified locally on this Mac with a persistent Homebrew Python 3.11 venv because the default `python3` on the machine was `3.13.5`.

```bash
python3.11 -m venv /Users/mainframe/.venvs/juggernaut-magic-select
source /Users/mainframe/.venvs/juggernaut-magic-select/bin/activate
python -m pip install --upgrade pip
python -m pip install numpy pillow torch
python -m pip install git+https://github.com/ChaoningZhang/MobileSAM.git
python -m pip install timm torchvision
mkdir -p /Users/mainframe/Models/Juggernaut
curl -L https://raw.githubusercontent.com/ChaoningZhang/MobileSAM/master/weights/mobile_sam.pt \
  -o /Users/mainframe/Models/Juggernaut/mobile_sam.pt
shasum -a 256 /Users/mainframe/Models/Juggernaut/mobile_sam.pt
```

Current verified package versions in that venv:

- `numpy==2.4.3`
- `pillow==12.1.1`
- `torch==2.10.0`
- `torchvision==0.25.0`
- `timm==1.0.25`
- `mobile_sam==1.0`

The extra `timm` and `torchvision` installs are currently required in practice because the published `mobile_sam` package metadata does not declare them, but the helper import path uses both.

The official checkpoint download that worked on this machine was the weight file committed under the upstream repo path:

```text
https://raw.githubusercontent.com/ChaoningZhang/MobileSAM/master/weights/mobile_sam.pt
```

## Benchmark Harness

Use the local benchmark harness to separate the current cold subprocess path from the intended prepared-session warm path:

```bash
/Users/mainframe/.venvs/juggernaut-magic-select/bin/python \
  /Users/mainframe/Desktop/projects/juggernaut-ms-perf-bench-qa-docs/scripts/benchmark_magic_select_runtime.py \
  --image-path /Users/mainframe/Desktop/projects/Juggernaut/images/aragorn.jpg \
  --model-path /Users/mainframe/Models/Juggernaut/mobile_sam.pt \
  --output-json /tmp/juggernaut_magic_select_benchmark.json
```

The harness emits `juggernaut.magic_select.benchmark.v1` JSON with:

- `phases.importsMs`
- `phases.coldLoadMs`
- `phases.modelLoadMs`
- `phases.prepareMs`
- `phases.firstClickMs`
- `phases.coldHelperInvokeMs`
- `warmPath.samples[]`
- `warmPath.medianMs`
- `warmPath.p95Ms`
- `warmPath.meetsTarget`

Interpret the numbers this way:

- `coldHelperInvokeMs` approximates the current helper subprocess path in this repo before Rust-side mask hashing and contour extraction.
- `prepareMs` is the one-time image embedding cost for the `magic_select_prepare` fast path.
- `warmPath.*` measures repeated `magic_select_warm_click` inference plus mask writes on a reused predictor and reused image embedding.
- `warmPath.medianMs <= 500` is the pass/fail line for the current fast-path target on this Mac.

### Verified Benchmark Snapshot On This Mac

Verified from this branch on March 26, 2026 at 7:08 PM PDT (`2026-03-27T02:08:30Z`) with:

- helper: `/Users/mainframe/Desktop/projects/juggernaut-ms-perf-bench-qa-docs/scripts/magic_select_mobile_sam.py`
- python: `/Users/mainframe/.venvs/juggernaut-magic-select/bin/python`
- image: `/Users/mainframe/Desktop/projects/Juggernaut/images/aragorn.jpg`
- model: `/Users/mainframe/Models/Juggernaut/mobile_sam.pt`
- model revision: `sha256:6dbb90523a35`
- threads: `1`
- prepared anchor: `651,327`

Recorded timings:

- `phases.importsMs`: `1582.794`
- `phases.coldLoadMs`: `1796.160`
- `phases.modelLoadMs`: `213.366`
- `phases.prepareMs`: `691.798`
- `phases.firstClickMs`: `42.891`
- `phases.coldHelperInvokeMs`: `2423.258`
- `warmPath.medianMs`: `42.379`
- `warmPath.p95Ms`: `43.613`
- `warmPath.maxMs`: `43.841`
- `warmPath.meetsTarget`: `true`

Interpretation for this machine:

- the prepared-session warm path is comfortably below the `500ms` target
- the current helper subprocess path is still multi-second cold, so cold and warm numbers must stay split in review and regression work
- `prepareMs` is currently the dominant cost inside the reused in-process path, which is why prepare reuse matters more than shaving a few milliseconds off warm clicks

## Direct Helper Smoke

Write a request JSON that matches the prepared-runtime naming, even though the direct helper still only consumes the low-level image, click, and model fields:

```bash
cat > /tmp/juggernaut_magic_select_smoke_request.json <<'JSON'
{
  "contract": "juggernaut.magic_select.local.prepared.v1",
  "action": "magic_select_warm_click",
  "imagePath": "/Users/mainframe/Desktop/projects/Juggernaut/images/aragorn.jpg",
  "clickAnchor": { "x": 650, "y": 330 },
  "outputMaskPath": "/tmp/juggernaut_magic_select_smoke_mask.png",
  "model": {
    "id": "mobile_sam_vit_t",
    "revision": "sha256:6dbb90523a35",
    "path": "/Users/mainframe/Models/Juggernaut/mobile_sam.pt"
  },
  "settings": {
    "maskThreshold": 127,
    "maxContourPoints": 256
  }
}
JSON
```

Then run the helper through the venv:

```bash
source /Users/mainframe/.venvs/juggernaut-magic-select/bin/activate
export JUGGERNAUT_MAGIC_SELECT_THREADS=1
python /Users/mainframe/Desktop/projects/juggernaut-ms-perf-bench-qa-docs/scripts/magic_select_mobile_sam.py \
  --input-json /tmp/juggernaut_magic_select_smoke_request.json
```

Expected result shape:

```json
{"ok":true,"maskPath":"/tmp/juggernaut_magic_select_smoke_mask.png","confidence":0.7604506015777588,"modelId":"mobile_sam_vit_t","modelRevision":"sha256:6dbb90523a35","runtime":"mobile_sam_python_cpu","warnings":[]}
```

The verified smoke output on this machine wrote a non-empty `1280x720` mask with bbox `(425, 78) -> (1052, 713)`, which is subject-shaped and clearly not the fallback diamond path.

## App Verification

Launch the desktop app from a shell that exports the runtime contract:

```bash
export JUGGERNAUT_MAGIC_SELECT_PYTHON="/Users/mainframe/.venvs/juggernaut-magic-select/bin/python"
export JUGGERNAUT_MAGIC_SELECT_HELPER="/Users/mainframe/Desktop/projects/juggernaut-ms-perf-bench-qa-docs/scripts/magic_select_mobile_sam.py"
export JUGGERNAUT_MAGIC_SELECT_MODEL_PATH="/Users/mainframe/Models/Juggernaut/mobile_sam.pt"
export JUGGERNAUT_MAGIC_SELECT_MODEL_ID="mobile_sam_vit_t"
export JUGGERNAUT_MAGIC_SELECT_MODEL_REVISION="sha256:6dbb90523a35"
export JUGGERNAUT_MAGIC_SELECT_THREADS="1"
cd /Users/mainframe/Desktop/projects/juggernaut-ms-perf-bench-qa-docs/desktop
npm install
npm run tauri dev
```

Then verify the live path:

1. Import `/Users/mainframe/Desktop/projects/Juggernaut/images/aragorn.jpg`.
2. Arm the visible `Magic Select` tool in the communication rail.
3. Click Aragorn's face or torso.
4. Confirm the overlay is a real blue contour-backed subject mask, not the fallback diamond.
5. Repeat a click near the same anchor.
6. Confirm the overlay stays on the same single candidate instead of creating a visibly different alternate mask.

On this machine, the verified in-app Aragorn click recorded image anchor `x=651, y=327` and wrote:

```text
/Users/mainframe/brood_runs/run-20260313T140723/receipt-magic-select-20260313T141506715.json
/Users/mainframe/brood_runs/run-20260313T140723/artifact-20260313T141506715-magic-select-mask.png
```

That receipt shows the true local mask-backed path was used:

- `runtime: mobile_sam_python_cpu`
- `modelRevision: sha256:6dbb90523a35`
- `candidate_id: magic-select-d47bd2d4e00b`
- `mask_sha256: d47bd2d4e00b52e477c946e45d384705b3f44482a18223b2683c0a46ae50711f`

Repeating the click near the same anchor did not create a third receipt on this run, which matches the current single-candidate cycle behavior.

## Determinism Notes

- The helper forces CPU inference by clearing `CUDA_VISIBLE_DEVICES`.
- The native seam sets `PYTHONHASHSEED=0`, `OMP_NUM_THREADS=1`, and `MKL_NUM_THREADS=1`.
- The click anchor is quantized to integer image pixels before invocation.
- Contours are derived from the saved mask, not from helper-side polygons.

## Failure Behavior

Failure is explicit and non-destructive:

- if the helper script is missing, the command returns an error
- if the model weights are missing, the command returns an error
- if the helper returns an empty or unreadable mask, the command returns an error
- the canvas selection state is not mutated on failure
