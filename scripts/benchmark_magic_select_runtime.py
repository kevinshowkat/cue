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
DEFAULT_PACK_ID = "cue.magic-select"
DEFAULT_MODEL_ID = "mobile_sam_vit_t"
DEFAULT_CUE_HOME = Path.home() / ".cue"
DEFAULT_RUNTIME_RESOLUTION_ORDER = (
    "installed_pack_manifest",
    "cue_home_env",
    "cue_env",
    "legacy_env",
)
DEFAULT_WARM_CLICK_TARGET_MS = 500.0
DEFAULT_WARM_OFFSETS = (
    (0.0, 0.0),
    (8.0, -6.0),
    (-10.0, 4.0),
    (6.0, 9.0),
    (-7.0, -8.0),
    (12.0, 3.0),
)


def preferred_env(*keys: str, default: str = "") -> str:
    for key in keys:
        value = str(os.environ.get(key, "")).strip()
        if value:
            return value
    return default


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


def normalize_text(value: object) -> str:
    return str(value or "").strip()


def parse_dotenv(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, raw_value = line.split("=", 1)
        key = key.strip()
        value = raw_value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        if key:
            values[key] = value
    return values


def try_read_json(path: Path) -> dict | list | None:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"invalid JSON at {path}: {exc}") from exc


def choose_first(*entries: tuple[object, str]) -> tuple[str, str | None]:
    for value, source in entries:
        text = normalize_text(value)
        if text:
            return text, source
    return "", None


def resolve_cue_home() -> Path:
    return Path(normalize_text(os.environ.get("CUE_HOME")) or DEFAULT_CUE_HOME).expanduser()


def resolve_installed_pack_manifest(cue_home: Path, pack_id: str) -> Path | None:
    install_index_path = cue_home / "state" / "model-pack-installs.json"
    install_index = try_read_json(install_index_path)
    if isinstance(install_index, dict):
        entry = ((install_index.get("packs") or {}) if isinstance(install_index.get("packs"), dict) else {}).get(pack_id)
        if isinstance(entry, dict):
            manifest_path = normalize_text(entry.get("manifest_path") or entry.get("manifestPath"))
            if manifest_path:
                return Path(manifest_path).expanduser()
            active_version = normalize_text(entry.get("active_version") or entry.get("activeVersion"))
            if active_version:
                candidate = cue_home / "models" / "packs" / pack_id / active_version / "manifest.json"
                if candidate.is_file():
                    return candidate
    pack_root = cue_home / "models" / "packs" / pack_id
    if not pack_root.is_dir():
        return None
    manifests = sorted(pack_root.glob("*/manifest.json"))
    return manifests[-1] if manifests else None


def load_pack_manifest(path: Path) -> dict:
    payload = try_read_json(path)
    if not isinstance(payload, dict):
        raise SystemExit(f"pack manifest at {path} must be a JSON object")
    return payload


def resolve_manifest_model_entry(manifest: dict, requested_model_id: str) -> dict | None:
    models = manifest.get("models")
    if not isinstance(models, list):
        return None
    requested = normalize_text(requested_model_id)
    if requested:
        for entry in models:
            if isinstance(entry, dict) and normalize_text(entry.get("model_id") or entry.get("modelId")) == requested:
                return entry
    for entry in models:
        if isinstance(entry, dict):
            return entry
    return None


def resolve_helper_from_manifest(manifest_path: Path, manifest: dict) -> Path | None:
    helper = manifest.get("helper")
    if not isinstance(helper, dict):
        return None
    relative_path = normalize_text(helper.get("relative_path") or helper.get("relativePath"))
    if not relative_path:
        return None
    candidate = manifest_path.parent / relative_path
    return candidate


def resolve_runtime_inputs(args: argparse.Namespace) -> dict:
    cue_home = resolve_cue_home()
    cue_home_env = parse_dotenv(cue_home / ".env")
    pack_id = normalize_text(getattr(args, "pack_id", "")) or DEFAULT_PACK_ID

    model_id, model_id_source = choose_first(
        (getattr(args, "model_id", ""), "benchmark_arg"),
        (cue_home_env.get("CUE_MAGIC_SELECT_MODEL_ID"), "cue_home_env"),
        (os.environ.get("CUE_MAGIC_SELECT_MODEL_ID"), "cue_env"),
        (os.environ.get("JUGGERNAUT_MAGIC_SELECT_MODEL_ID"), "legacy_env"),
        (DEFAULT_MODEL_ID, "default"),
    )

    explicit_manifest, explicit_manifest_source = choose_first(
        (getattr(args, "pack_manifest", ""), "benchmark_arg"),
        (cue_home_env.get("CUE_MAGIC_SELECT_PACK_MANIFEST"), "cue_home_env"),
        (os.environ.get("CUE_MAGIC_SELECT_PACK_MANIFEST"), "cue_env"),
        (os.environ.get("JUGGERNAUT_MAGIC_SELECT_PACK_MANIFEST"), "legacy_env"),
    )
    installed_manifest_path = resolve_installed_pack_manifest(cue_home, pack_id)

    manifest_path = None
    resolution_source = None
    if explicit_manifest:
        manifest_path = require_file(explicit_manifest, "pack manifest")
        resolution_source = explicit_manifest_source
    elif installed_manifest_path and installed_manifest_path.is_file():
        manifest_path = installed_manifest_path
        resolution_source = "installed_pack_manifest"

    manifest = load_pack_manifest(manifest_path) if manifest_path else None
    model_entry = resolve_manifest_model_entry(manifest, model_id) if manifest else None

    model_id = normalize_text(
        getattr(args, "model_id", "")
        or cue_home_env.get("CUE_MAGIC_SELECT_MODEL_ID")
        or os.environ.get("CUE_MAGIC_SELECT_MODEL_ID")
        or os.environ.get("JUGGERNAUT_MAGIC_SELECT_MODEL_ID")
        or (model_entry or {}).get("model_id")
        or (model_entry or {}).get("modelId")
        or DEFAULT_MODEL_ID
    )

    model_path_text, model_path_source = choose_first(
        (getattr(args, "model_path", ""), "benchmark_arg"),
        (cue_home_env.get("CUE_MAGIC_SELECT_MODEL_PATH"), "cue_home_env"),
        (os.environ.get("CUE_MAGIC_SELECT_MODEL_PATH"), "cue_env"),
        (os.environ.get("JUGGERNAUT_MAGIC_SELECT_MODEL_PATH"), "legacy_env"),
        (
            str((manifest_path.parent / normalize_text((model_entry or {}).get("entry_path") or (model_entry or {}).get("entryPath"))))
            if manifest_path and model_entry
            else "",
            resolution_source or "installed_pack_manifest",
        ),
    )
    if not model_path_text:
        raise SystemExit(
            "Magic Select model weights could not be resolved. Pass --model-path, install the Cue Magic Select pack, or set CUE_MAGIC_SELECT_MODEL_PATH."
        )
    model_path = require_file(model_path_text, "MobileSAM weights")

    helper_from_manifest = resolve_helper_from_manifest(manifest_path, manifest) if manifest_path and manifest else None
    helper_path_text, helper_path_source = choose_first(
        (getattr(args, "helper_path", ""), "benchmark_arg"),
        (cue_home_env.get("CUE_MAGIC_SELECT_HELPER"), "cue_home_env"),
        (os.environ.get("CUE_MAGIC_SELECT_HELPER"), "cue_env"),
        (os.environ.get("JUGGERNAUT_MAGIC_SELECT_HELPER"), "legacy_env"),
        (str(helper_from_manifest) if helper_from_manifest else "", resolution_source or "installed_pack_manifest"),
        (str(resolve_default_helper()), "repo_default"),
    )
    helper_path = require_file(helper_path_text, "Magic Select helper")

    model_revision, _model_revision_source = choose_first(
        (getattr(args, "model_revision", ""), "benchmark_arg"),
        (cue_home_env.get("CUE_MAGIC_SELECT_MODEL_REVISION"), "cue_home_env"),
        (os.environ.get("CUE_MAGIC_SELECT_MODEL_REVISION"), "cue_env"),
        (os.environ.get("JUGGERNAUT_MAGIC_SELECT_MODEL_REVISION"), "legacy_env"),
        ((model_entry or {}).get("model_revision"), resolution_source or "installed_pack_manifest"),
        ((model_entry or {}).get("modelRevision"), resolution_source or "installed_pack_manifest"),
        ((model_entry or {}).get("sha256"), resolution_source or "installed_pack_manifest"),
    )
    if not model_revision:
        model_revision = magic_select_default_model_revision(model_path)

    pack_id = normalize_text((manifest or {}).get("pack_id") or (manifest or {}).get("packId") or pack_id)
    pack_version = normalize_text((manifest or {}).get("pack_version") or (manifest or {}).get("packVersion"))
    model_asset_sha256 = normalize_text((model_entry or {}).get("sha256"))
    supported_platforms = [
        normalize_text(value)
        for value in ((manifest or {}).get("supported_platforms") if isinstance((manifest or {}).get("supported_platforms"), list) else [])
        if normalize_text(value)
    ]

    model_install_source = "cue_pack_manager" if resolution_source == "installed_pack_manifest" else "developer_override"
    entitlement_mode = "paid_local_pack" if resolution_source == "installed_pack_manifest" else "developer_override"

    return {
        "cueHome": str(cue_home),
        "packId": pack_id or DEFAULT_PACK_ID,
        "packVersion": pack_version or None,
        "manifestPath": str(manifest_path) if manifest_path else None,
        "modelId": model_id,
        "modelRevision": model_revision,
        "modelPath": str(model_path),
        "helperPath": str(helper_path),
        "modelAssetSha256": model_asset_sha256 or None,
        "modelInstallSource": model_install_source,
        "entitlementMode": entitlement_mode,
        "resolutionSource": resolution_source or model_path_source or helper_path_source or model_id_source or "benchmark_arg",
        "resolutionOrder": list(DEFAULT_RUNTIME_RESOLUTION_ORDER),
        "supportedPlatforms": supported_platforms,
    }


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
        env["CUE_MAGIC_SELECT_THREADS"] = str(threads)
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
        default="",
        help="Optional explicit path to the local MobileSAM weights. Overrides pack and env resolution.",
    )
    parser.add_argument(
        "--pack-manifest",
        default="",
        help="Optional explicit local pack manifest path. Overrides installed-pack discovery.",
    )
    parser.add_argument(
        "--pack-id",
        default=DEFAULT_PACK_ID,
        help=f"Local pack id to resolve before env fallbacks. Default: {DEFAULT_PACK_ID}.",
    )
    parser.add_argument(
        "--model-id",
        default="",
        help=f"Optional model id override. Defaults to envs or {DEFAULT_MODEL_ID}.",
    )
    parser.add_argument(
        "--model-revision",
        default="",
        help="Optional model revision override. Defaults to manifest metadata, envs, or the model file hash.",
    )
    parser.add_argument(
        "--helper-path",
        default="",
        help="Optional explicit helper script path. Overrides pack and env resolution.",
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
        default=max(
            1,
            int(
                preferred_env(
                    "CUE_MAGIC_SELECT_THREADS",
                    "JUGGERNAUT_MAGIC_SELECT_THREADS",
                    default="1",
                )
            ),
        ),
        help="CPU thread count passed to torch. Default: CUE_MAGIC_SELECT_THREADS, then JUGGERNAUT_MAGIC_SELECT_THREADS, then 1.",
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
    runtime_inputs = resolve_runtime_inputs(args)
    model_path = require_file(runtime_inputs["modelPath"], "MobileSAM weights")
    helper_path = require_file(runtime_inputs["helperPath"], "Magic Select helper")
    python_bin = sys.executable
    model_id = runtime_inputs["modelId"]
    model_revision = runtime_inputs["modelRevision"]

    os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")
    os.environ["CUE_MAGIC_SELECT_THREADS"] = str(max(1, int(args.threads)))
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
        "runtimeResolution": {
            "packId": runtime_inputs["packId"],
            "packVersion": runtime_inputs["packVersion"],
            "manifestPath": runtime_inputs["manifestPath"],
            "modelAssetSha256": runtime_inputs["modelAssetSha256"],
            "modelInstallSource": runtime_inputs["modelInstallSource"],
            "entitlementMode": runtime_inputs["entitlementMode"],
            "resolutionSource": runtime_inputs["resolutionSource"],
            "resolutionOrder": runtime_inputs["resolutionOrder"],
            "supportedPlatforms": runtime_inputs["supportedPlatforms"],
            "cueHome": runtime_inputs["cueHome"],
        },
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
            "runtimeResolution mirrors the planned local pack lookup order: installed pack manifest, ~/.cue/.env, CUE_MAGIC_SELECT_*, then legacy JUGGERNAUT_* fallbacks.",
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
