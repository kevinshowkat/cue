#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import statistics
import subprocess
import sys
import tempfile
import time
from pathlib import Path


BENCHMARK_CONTRACT = "juggernaut.magic_select.benchmark.v1"
DEFAULT_WARM_CLICK_TARGET_MS = 500.0
DEFAULT_WARM_OFFSETS = (
    (0.0, 0.0),
    (8.0, -6.0),
    (-10.0, 4.0),
    (6.0, 9.0),
    (-7.0, -8.0),
    (12.0, 3.0),
)


def now_ns() -> int:
    return time.perf_counter_ns()


def ns_to_ms(value: int | float) -> float:
    return round(float(value) / 1_000_000.0, 3)


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return round(values[0], 3)
    ordered = sorted(values)
    position = max(0.0, min(1.0, pct)) * (len(ordered) - 1)
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    weight = position - lower
    return round((ordered[lower] * (1.0 - weight)) + (ordered[upper] * weight), 3)


def parse_anchor(value: str) -> tuple[float, float]:
    parts = [part.strip() for part in str(value or "").split(",")]
    if len(parts) != 2:
        raise argparse.ArgumentTypeError("anchor must be formatted as x,y")
    try:
        return (float(parts[0]), float(parts[1]))
    except ValueError as exc:  # pragma: no cover - argparse path
        raise argparse.ArgumentTypeError(f"invalid anchor {value!r}: {exc}") from exc


def require_file(path_text: str, label: str) -> Path:
    path = Path(path_text).expanduser()
    if not path.is_file():
        raise SystemExit(f"{label} not found at {path}")
    return path


def resolve_default_helper() -> Path:
    return Path(__file__).resolve().parent / "magic_select_mobile_sam.py"


def build_prepare_request(
    image_path: Path,
    model_path: Path,
    *,
    image_id: str,
    prepared_image_id: str,
    image_cache_key: str,
    model_id: str,
    model_revision: str,
) -> dict:
    return {
        "contract": "juggernaut.magic_select.local.prepared.v1",
        "action": "magic_select_prepare",
        "imageId": image_id,
        "preparedImageId": prepared_image_id,
        "imageCacheKey": image_cache_key,
        "imagePath": str(image_path),
        "model": {
            "id": model_id,
            "revision": model_revision,
            "path": str(model_path),
        },
        "settings": {
            "maskThreshold": 127,
            "maxContourPoints": 256,
        },
    }


def build_warm_click_request(
    click_anchor: tuple[float, float],
    output_mask_path: Path,
    *,
    image_id: str,
    prepared_image_id: str,
) -> dict:
    x, y = click_anchor
    return {
        "contract": "juggernaut.magic_select.local.prepared.v1",
        "action": "magic_select_warm_click",
        "imageId": image_id,
        "preparedImageId": prepared_image_id,
        "clickAnchor": {"x": x, "y": y},
        "outputMaskPath": str(output_mask_path),
    }


def run_cold_helper_once(
    *,
    helper_path: Path,
    image_path: Path,
    model_path: Path,
    click_anchor: tuple[float, float],
    python_bin: str,
    model_id: str,
    model_revision: str,
    threads: int,
) -> tuple[dict, float]:
    with tempfile.TemporaryDirectory(prefix="juggernaut_magic_select_cold_") as tmpdir:
        image_id = f"benchmark:{image_path.stem}"
        prepared_image_id = f"{image_id}:prepared"
        image_cache_key = f"{image_path.resolve()}::{model_id}:{model_revision}"
        prepare_request = build_prepare_request(
            image_path,
            model_path,
            model_id=model_id,
            model_revision=model_revision,
            image_id=image_id,
            prepared_image_id=prepared_image_id,
            image_cache_key=image_cache_key,
        )
        warm_click_request = build_warm_click_request(
            click_anchor,
            Path(tmpdir) / "cold-mask.png",
            image_id=image_id,
            prepared_image_id=prepared_image_id,
        )
        env = os.environ.copy()
        env.setdefault("CUDA_VISIBLE_DEVICES", "")
        env["JUGGERNAUT_MAGIC_SELECT_THREADS"] = str(threads)
        input_payload = "\n".join(
            (
                json.dumps(prepare_request),
                json.dumps(warm_click_request),
            )
        )
        started = now_ns()
        completed = subprocess.run(
            [python_bin, str(helper_path), "--worker"],
            input=f"{input_payload}\n",
            text=True,
            capture_output=True,
            check=False,
            env=env,
        )
        duration_ms = ns_to_ms(now_ns() - started)
        stdout = completed.stdout.strip()
        stderr = completed.stderr.strip()
        if completed.returncode != 0:
            detail = stderr or stdout or f"helper exited {completed.returncode}"
            raise SystemExit(f"cold helper invocation failed: {detail}")
        output_lines = [line for line in stdout.splitlines() if line.strip()]
        if len(output_lines) < 2:
            raise SystemExit(f"cold helper returned too few worker responses: {stdout}")
        try:
            prepare_payload = json.loads(output_lines[0])
            warm_click_payload = json.loads(output_lines[1])
        except json.JSONDecodeError as exc:
            raise SystemExit(f"cold helper returned invalid worker JSON: {exc}: {stdout}") from exc
        if not prepare_payload.get("ok"):
            raise SystemExit(f"cold helper prepare failed: {json.dumps(prepare_payload)}")
        if not warm_click_payload.get("ok"):
            raise SystemExit(f"cold helper warm click failed: {json.dumps(warm_click_payload)}")
        return {
            "prepare": prepare_payload,
            "warmClick": warm_click_payload,
        }, duration_ms


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Benchmark cold helper, prepare, and warm-click timings for local Magic Select."
    )
    parser.add_argument(
        "--image-path",
        required=True,
        help="Path to the local source image used for the benchmark.",
    )
    parser.add_argument(
        "--model-path",
        default=os.environ.get("JUGGERNAUT_MAGIC_SELECT_MODEL_PATH", ""),
        help="Path to the local MobileSAM weights. Defaults to JUGGERNAUT_MAGIC_SELECT_MODEL_PATH.",
    )
    parser.add_argument(
        "--helper-path",
        default=str(resolve_default_helper()),
        help="Path to the helper script used for cold helper timing.",
    )
    parser.add_argument(
        "--anchor",
        type=parse_anchor,
        default=parse_anchor("651,327"),
        help="Click anchor formatted as x,y. Default: 651,327.",
    )
    parser.add_argument(
        "--warm-clicks",
        type=int,
        default=6,
        help="How many warm clicks to benchmark after prepare reuse. Default: 6.",
    )
    parser.add_argument(
        "--threads",
        type=int,
        default=max(1, int(os.environ.get("JUGGERNAUT_MAGIC_SELECT_THREADS", "1"))),
        help="CPU thread count passed to torch. Default: JUGGERNAUT_MAGIC_SELECT_THREADS or 1.",
    )
    parser.add_argument(
        "--target-warm-ms",
        type=float,
        default=DEFAULT_WARM_CLICK_TARGET_MS,
        help="Warm-click target budget in milliseconds. Default: 500.",
    )
    parser.add_argument(
        "--output-json",
        default="",
        help="Optional path to also write the benchmark JSON payload.",
    )
    args = parser.parse_args()

    image_path = require_file(args.image_path, "benchmark image")
    model_path = require_file(args.model_path, "MobileSAM weights")
    helper_path = require_file(args.helper_path, "Magic Select helper")
    python_bin = sys.executable
    model_id = str(os.environ.get("JUGGERNAUT_MAGIC_SELECT_MODEL_ID", "mobile_sam_vit_t")).strip() or "mobile_sam_vit_t"
    model_revision = (
        str(os.environ.get("JUGGERNAUT_MAGIC_SELECT_MODEL_REVISION", "unknown")).strip() or "unknown"
    )

    os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")
    os.environ["JUGGERNAUT_MAGIC_SELECT_THREADS"] = str(max(1, int(args.threads)))

    import_started = now_ns()
    try:
        import numpy as np
        from PIL import Image
        import torch
        from mobile_sam import SamPredictor, sam_model_registry
    except Exception as exc:  # pragma: no cover - local env dependent
        raise SystemExit(f"benchmark dependencies unavailable: {exc}") from exc
    imports_ms = ns_to_ms(now_ns() - import_started)

    torch.set_num_threads(max(1, int(args.threads)))
    try:
        torch.use_deterministic_algorithms(True)
    except Exception:
        pass

    cold_helper_payload, cold_helper_invoke_ms = run_cold_helper_once(
        helper_path=helper_path,
        image_path=image_path,
        model_path=model_path,
        click_anchor=args.anchor,
        python_bin=python_bin,
        model_id=model_id,
        model_revision=model_revision,
        threads=max(1, int(args.threads)),
    )

    model_load_started = now_ns()
    sam = sam_model_registry["vit_t"](checkpoint=str(model_path))
    sam.to(device="cpu")
    sam.eval()
    predictor = SamPredictor(sam)
    model_load_ms = ns_to_ms(now_ns() - model_load_started)

    prepare_started = now_ns()
    image_rgb = Image.open(image_path).convert("RGB")
    image_np = np.asarray(image_rgb)
    predictor.set_image(image_np)
    prepare_ms = ns_to_ms(now_ns() - prepare_started)
    width, height = image_rgb.size

    def clamp_anchor(point: tuple[float, float]) -> tuple[float, float]:
        x, y = point
        return (
            min(max(0.0, x), max(0.0, float(width - 1))),
            min(max(0.0, y), max(0.0, float(height - 1))),
        )

    warm_points: list[tuple[float, float]] = []
    anchor_x, anchor_y = args.anchor
    for index in range(max(1, int(args.warm_clicks))):
        dx, dy = DEFAULT_WARM_OFFSETS[index % len(DEFAULT_WARM_OFFSETS)]
        warm_points.append(clamp_anchor((anchor_x + dx, anchor_y + dy)))

    def predict_and_write_mask(point: tuple[float, float], output_mask_path: Path) -> tuple[float, bool]:
        point_x, point_y = point
        point_coords = np.array([[point_x, point_y]], dtype=np.float32)
        point_labels = np.array([1], dtype=np.int32)
        started = now_ns()
        masks, scores, _ = predictor.predict(
            point_coords=point_coords,
            point_labels=point_labels,
            multimask_output=False,
        )
        mask = (masks[0].astype("uint8")) * 255
        Image.fromarray(mask, mode="L").save(output_mask_path)
        duration_ms = ns_to_ms(now_ns() - started)
        return duration_ms, bool(scores is not None and len(scores))

    with tempfile.TemporaryDirectory(prefix="juggernaut_magic_select_warm_") as tmpdir:
        warm_dir = Path(tmpdir)
        first_click_ms, first_click_has_score = predict_and_write_mask(
            clamp_anchor(args.anchor),
            warm_dir / "first-click-mask.png",
        )
        warm_click_samples: list[dict] = []
        warm_click_durations_ms: list[float] = []
        for index, point in enumerate(warm_points, start=1):
            duration_ms, has_score = predict_and_write_mask(point, warm_dir / f"warm-click-{index}.png")
            warm_click_samples.append(
                {
                    "index": index,
                    "anchor": {
                        "x": round(point[0], 3),
                        "y": round(point[1], 3),
                    },
                    "durationMs": duration_ms,
                    "scored": has_score,
                }
            )
            warm_click_durations_ms.append(duration_ms)

    warm_click_median_ms = round(statistics.median(warm_click_durations_ms), 3) if warm_click_durations_ms else 0.0
    payload = {
        "contract": BENCHMARK_CONTRACT,
        "recordedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "pythonBin": python_bin,
        "helperPath": str(helper_path),
        "imagePath": str(image_path),
        "imageSize": {"width": width, "height": height},
        "modelPath": str(model_path),
        "modelId": model_id,
        "modelRevision": model_revision,
        "threads": max(1, int(args.threads)),
        "targetWarmClickMs": round(float(args.target_warm_ms), 3),
        "phases": {
            "importsMs": imports_ms,
            "coldLoadMs": round(imports_ms + model_load_ms, 3),
            "modelLoadMs": model_load_ms,
            "prepareMs": prepare_ms,
            "firstClickMs": first_click_ms,
            "coldHelperInvokeMs": cold_helper_invoke_ms,
        },
        "warmPath": {
            "prepareReuse": True,
            "preparedAnchor": {
                "x": round(clamp_anchor(args.anchor)[0], 3),
                "y": round(clamp_anchor(args.anchor)[1], 3),
            },
            "warmClickCount": len(warm_click_samples),
            "samples": warm_click_samples,
            "medianMs": warm_click_median_ms,
            "p95Ms": percentile(warm_click_durations_ms, 0.95),
            "minMs": round(min(warm_click_durations_ms), 3) if warm_click_durations_ms else 0.0,
            "maxMs": round(max(warm_click_durations_ms), 3) if warm_click_durations_ms else 0.0,
            "meetsTarget": warm_click_median_ms <= float(args.target_warm_ms),
        },
        "notes": [
            "coldHelperInvokeMs measures the current helper subprocess path in a fresh Python process and includes model load plus mask write.",
            "prepareMs measures predictor.set_image on the reused in-process predictor session.",
            "warm samples reuse the prepared predictor and image embedding and include predict plus mask write.",
            "Rust-side mask hashing and contour extraction are not included in the warmPath timings from this harness.",
        ],
        "coldHelperPayload": cold_helper_payload,
        "firstClickScored": first_click_has_score,
    }

    encoded = json.dumps(payload, indent=2)
    sys.stdout.write(encoded)
    sys.stdout.write("\n")
    if args.output_json:
        output_path = Path(args.output_json).expanduser()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(encoded + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
