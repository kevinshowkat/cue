#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path

MAGIC_SELECT_CONTRACT = "juggernaut.magic_select.local.prepared.v1"
MAGIC_SELECT_PREPARE_ACTION = "magic_select_prepare"
MAGIC_SELECT_WARM_CLICK_ACTION = "magic_select_warm_click"
MAGIC_SELECT_RELEASE_ACTION = "magic_select_release"
MAGIC_SELECT_DEFAULT_MODEL_ID = "mobile_sam_vit_t"
MAGIC_SELECT_WORKER_RUNTIME = "mobile_sam_python_worker_cpu"


class LocalMagicSelectError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        action: str,
        image_id: str | None = None,
        prepared_image_id: str | None = None,
        warnings: list[str] | None = None,
        details: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.action = action
        self.image_id = image_id
        self.prepared_image_id = prepared_image_id
        self.warnings = warnings or []
        self.details = details or {"message": message}


@dataclass
class CachedImageEntry:
    predictor: object
    prepared_ids: set[str] = field(default_factory=set)


def emit(payload: dict, exit_code: int = 0) -> None:
    sys.stdout.write(json.dumps(payload))
    sys.stdout.write("\n")
    sys.stdout.flush()
    raise SystemExit(exit_code)


def emit_line(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload))
    sys.stdout.write("\n")
    sys.stdout.flush()


def load_request(input_json: str) -> dict:
    if input_json == "-":
        return json.load(sys.stdin)
    path = Path(input_json)
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def read_required_text(
    request: dict,
    key: str,
    *,
    action: str,
    code: str,
    image_id: str | None = None,
    prepared_image_id: str | None = None,
) -> str:
    value = str(request.get(key) or "").strip()
    if value:
        return value
    raise LocalMagicSelectError(
        code,
        f"{key} is required",
        action=action,
        image_id=image_id,
        prepared_image_id=prepared_image_id,
    )


def error_payload(error: LocalMagicSelectError) -> dict:
    payload = {
        "ok": False,
        "code": error.code,
        "nonDestructive": True,
        "contract": MAGIC_SELECT_CONTRACT,
        "action": error.action,
        "imageId": error.image_id,
        "preparedImageId": error.prepared_image_id,
    }
    if error.warnings:
        payload["warnings"] = error.warnings
    if error.details:
        payload["details"] = error.details
    return payload


def build_runtime() -> "MobileSamRuntime":
    try:
        import numpy as np
        from PIL import Image
    except Exception as exc:  # pragma: no cover - import failure depends on local env
        raise LocalMagicSelectError(
            "magic_select_python_import_failed",
            f"Local Magic Select requires numpy and Pillow before the MobileSAM helper can run: {exc}",
            action=MAGIC_SELECT_PREPARE_ACTION,
        ) from exc

    try:
        import torch
        from mobile_sam import SamPredictor, sam_model_registry
    except Exception as exc:  # pragma: no cover - import failure depends on local env
        raise LocalMagicSelectError(
            "magic_select_python_import_failed",
            f"Local Magic Select requires torch and mobile_sam installed locally: {exc}",
            action=MAGIC_SELECT_PREPARE_ACTION,
        ) from exc

    os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")
    threads = max(1, int(os.environ.get("JUGGERNAUT_MAGIC_SELECT_THREADS", "1")))
    torch.set_num_threads(threads)
    try:
        torch.use_deterministic_algorithms(True)
    except Exception:
        pass

    return MobileSamRuntime(np, Image, torch, SamPredictor, sam_model_registry)


class MobileSamRuntime:
    def __init__(self, np_module, image_module, torch_module, predictor_cls, model_registry):
        self.np = np_module
        self.image_module = image_module
        self.torch = torch_module
        self.predictor_cls = predictor_cls
        self.model_registry = model_registry
        self.cache_limit = max(
            1, int(os.environ.get("JUGGERNAUT_MAGIC_SELECT_IMAGE_CACHE_SIZE", "4"))
        )
        self.sam = None
        self.model_signature: tuple[str, str, str] | None = None
        self.current_model_id = MAGIC_SELECT_DEFAULT_MODEL_ID
        self.current_model_revision = "unknown"
        self.image_cache: OrderedDict[str, CachedImageEntry] = OrderedDict()
        self.prepared_aliases: dict[str, str] = {}

    def resolve_model(self, request: dict, *, action: str) -> tuple[Path, str, str]:
        model = request.get("model") if isinstance(request.get("model"), dict) else {}
        model_path = Path(str(model.get("path") or "")).expanduser()
        if not model_path.is_file():
            raise LocalMagicSelectError(
                "magic_select_model_missing",
                f"MobileSAM weights not found: {model_path}",
                action=action,
                image_id=str(request.get("imageId") or "").strip() or None,
                prepared_image_id=str(request.get("preparedImageId") or "").strip() or None,
            )
        model_id = str(model.get("id") or MAGIC_SELECT_DEFAULT_MODEL_ID)
        model_revision = str(model.get("revision") or "unknown")
        return model_path, model_id, model_revision

    def ensure_model(self, request: dict, *, action: str) -> tuple[str, str]:
        model_path, model_id, model_revision = self.resolve_model(request, action=action)
        signature = (str(model_path.resolve()), model_id, model_revision)
        if self.sam is not None and self.model_signature == signature:
            return model_id, model_revision
        try:
            sam = self.model_registry["vit_t"](checkpoint=str(model_path))
            sam.to(device="cpu")
            sam.eval()
        except Exception as exc:  # pragma: no cover - depends on local runtime/model
            raise LocalMagicSelectError(
                "magic_select_model_load_failed",
                f"MobileSAM inference failed: {exc}",
                action=action,
                image_id=str(request.get("imageId") or "").strip() or None,
                prepared_image_id=str(request.get("preparedImageId") or "").strip() or None,
            ) from exc
        self.sam = sam
        self.model_signature = signature
        self.current_model_id = model_id
        self.current_model_revision = model_revision
        self.image_cache.clear()
        self.prepared_aliases.clear()
        return model_id, model_revision

    def resolve_image_path(self, request: dict, *, action: str) -> Path:
        image_path = Path(str(request.get("imagePath") or "")).expanduser()
        if not image_path.is_file():
            raise LocalMagicSelectError(
                "magic_select_source_image_missing",
                f"Source image not found: {image_path}",
                action=action,
                image_id=str(request.get("imageId") or "").strip() or None,
                prepared_image_id=str(request.get("preparedImageId") or "").strip() or None,
            )
        return image_path

    def touch_cache_entry(self, image_cache_key: str) -> CachedImageEntry:
        entry = self.image_cache.pop(image_cache_key)
        self.image_cache[image_cache_key] = entry
        return entry

    def detach_prepared_id(self, prepared_image_id: str) -> None:
        image_cache_key = self.prepared_aliases.pop(prepared_image_id, None)
        if not image_cache_key:
            return
        entry = self.image_cache.get(image_cache_key)
        if entry is not None:
            entry.prepared_ids.discard(prepared_image_id)

    def evict_if_needed(self) -> None:
        while len(self.image_cache) > self.cache_limit:
            image_cache_key, entry = self.image_cache.popitem(last=False)
            for prepared_image_id in list(entry.prepared_ids):
                self.prepared_aliases.pop(prepared_image_id, None)

    def prepare_image(self, request: dict) -> dict:
        action = MAGIC_SELECT_PREPARE_ACTION
        image_id = read_required_text(
            request,
            "imageId",
            action=action,
            code="magic_select_prepare_requires_image_id",
        )
        prepared_image_id = read_required_text(
            request,
            "preparedImageId",
            action=action,
            code="magic_select_prepare_requires_prepared_image_id",
            image_id=image_id,
        )
        image_cache_key = read_required_text(
            request,
            "imageCacheKey",
            action=action,
            code="magic_select_prepare_requires_image_cache_key",
            image_id=image_id,
            prepared_image_id=prepared_image_id,
        )
        image_path = self.resolve_image_path(request, action=action)
        model_id, model_revision = self.ensure_model(request, action=action)

        old_image_cache_key = self.prepared_aliases.get(prepared_image_id)
        if old_image_cache_key and old_image_cache_key != image_cache_key:
            self.detach_prepared_id(prepared_image_id)

        cache_hit = False
        if prepared_image_id in self.prepared_aliases:
            resolved_key = self.prepared_aliases.get(prepared_image_id)
            if resolved_key and resolved_key in self.image_cache:
                self.touch_cache_entry(resolved_key)
                cache_hit = True
        elif image_cache_key in self.image_cache:
            entry = self.touch_cache_entry(image_cache_key)
            entry.prepared_ids.add(prepared_image_id)
            self.prepared_aliases[prepared_image_id] = image_cache_key
            cache_hit = True
        else:
            try:
                with self.image_module.open(image_path) as image:
                    image_rgb = image.convert("RGB")
                    image_np = self.np.asarray(image_rgb)
                predictor = self.predictor_cls(self.sam)
                predictor.set_image(image_np)
            except Exception as exc:  # pragma: no cover - depends on local runtime/model
                raise LocalMagicSelectError(
                    "magic_select_prepare_failed",
                    f"MobileSAM inference failed: {exc}",
                    action=action,
                    image_id=image_id,
                    prepared_image_id=prepared_image_id,
                ) from exc
            self.image_cache[image_cache_key] = CachedImageEntry(
                predictor=predictor,
                prepared_ids={prepared_image_id},
            )
            self.prepared_aliases[prepared_image_id] = image_cache_key
            self.evict_if_needed()

        return {
            "ok": True,
            "contract": MAGIC_SELECT_CONTRACT,
            "action": action,
            "imageId": image_id,
            "preparedImageId": prepared_image_id,
            "imageCacheKey": image_cache_key,
            "cacheHit": cache_hit,
            "modelId": model_id,
            "modelRevision": model_revision,
            "runtime": MAGIC_SELECT_WORKER_RUNTIME,
            "warnings": [],
        }

    def warm_click(self, request: dict) -> dict:
        action = MAGIC_SELECT_WARM_CLICK_ACTION
        image_id = read_required_text(
            request,
            "imageId",
            action=action,
            code="magic_select_warm_click_requires_image_id",
        )
        prepared_image_id = read_required_text(
            request,
            "preparedImageId",
            action=action,
            code="magic_select_warm_click_requires_prepared_image_id",
            image_id=image_id,
        )
        image_cache_key = self.prepared_aliases.get(prepared_image_id)
        if not image_cache_key or image_cache_key not in self.image_cache:
            self.prepared_aliases.pop(prepared_image_id, None)
            raise LocalMagicSelectError(
                "prepared_image_not_found",
                "Prepared Magic Select image was not found in the local worker cache.",
                action=action,
                image_id=image_id,
                prepared_image_id=prepared_image_id,
            )

        output_mask_raw = read_required_text(
            request,
            "outputMaskPath",
            action=action,
            code="magic_select_warm_click_requires_output_mask_path",
            image_id=image_id,
            prepared_image_id=prepared_image_id,
        )
        output_mask_path = Path(output_mask_raw).expanduser()
        output_mask_path.parent.mkdir(parents=True, exist_ok=True)

        click_anchor = request.get("clickAnchor") if isinstance(request.get("clickAnchor"), dict) else {}
        try:
            click_x = float(click_anchor.get("x"))
            click_y = float(click_anchor.get("y"))
        except Exception as exc:
            raise LocalMagicSelectError(
                "magic_select_warm_click_requires_click_anchor",
                "clickAnchor.x and clickAnchor.y are required",
                action=action,
                image_id=image_id,
                prepared_image_id=prepared_image_id,
            ) from exc

        predictor = self.touch_cache_entry(image_cache_key).predictor
        try:
            point_coords = self.np.array([[click_x, click_y]], dtype=self.np.float32)
            point_labels = self.np.array([1], dtype=self.np.int32)
            masks, scores, _ = predictor.predict(
                point_coords=point_coords,
                point_labels=point_labels,
                multimask_output=False,
            )
        except Exception as exc:  # pragma: no cover - depends on local runtime/model
            raise LocalMagicSelectError(
                "magic_select_warm_click_failed",
                f"MobileSAM inference failed: {exc}",
                action=action,
                image_id=image_id,
                prepared_image_id=prepared_image_id,
            ) from exc

        if masks is None or len(masks) == 0:
            raise LocalMagicSelectError(
                "magic_select_warm_click_empty_mask",
                "MobileSAM returned no mask.",
                action=action,
                image_id=image_id,
                prepared_image_id=prepared_image_id,
            )

        mask = (masks[0].astype("uint8")) * 255
        self.image_module.fromarray(mask, mode="L").save(output_mask_path)
        confidence = float(scores[0]) if scores is not None and len(scores) else 1.0
        return {
            "ok": True,
            "contract": MAGIC_SELECT_CONTRACT,
            "action": action,
            "imageId": image_id,
            "preparedImageId": prepared_image_id,
            "maskPath": str(output_mask_path),
            "confidence": confidence,
            "modelId": self.current_model_id,
            "modelRevision": self.current_model_revision,
            "runtime": MAGIC_SELECT_WORKER_RUNTIME,
            "warnings": [],
        }

    def release_image(self, request: dict) -> dict:
        action = MAGIC_SELECT_RELEASE_ACTION
        image_id = read_required_text(
            request,
            "imageId",
            action=action,
            code="magic_select_release_requires_image_id",
        )
        prepared_image_id = read_required_text(
            request,
            "preparedImageId",
            action=action,
            code="magic_select_release_requires_prepared_image_id",
            image_id=image_id,
        )
        read_required_text(
            request,
            "reason",
            action=action,
            code="magic_select_release_requires_reason",
            image_id=image_id,
            prepared_image_id=prepared_image_id,
        )
        self.detach_prepared_id(prepared_image_id)
        return {
            "ok": True,
            "contract": MAGIC_SELECT_CONTRACT,
            "action": action,
            "imageId": image_id,
            "preparedImageId": prepared_image_id,
            "warnings": [],
        }

    def handle_request(self, request: dict) -> dict:
        action = str(request.get("action") or "").strip()
        if action == MAGIC_SELECT_PREPARE_ACTION:
            return self.prepare_image(request)
        if action == MAGIC_SELECT_WARM_CLICK_ACTION:
            return self.warm_click(request)
        if action == MAGIC_SELECT_RELEASE_ACTION:
            return self.release_image(request)
        raise LocalMagicSelectError(
            "magic_select_unsupported_action",
            f"Unsupported Magic Select action: {action or '<empty>'}",
            action=action or "unknown",
            image_id=str(request.get("imageId") or "").strip() or None,
            prepared_image_id=str(request.get("preparedImageId") or "").strip() or None,
        )


def run_once(runtime: MobileSamRuntime, input_json: str) -> None:
    request = load_request(input_json)
    try:
        emit(runtime.handle_request(request))
    except LocalMagicSelectError as exc:
        emit(error_payload(exc), exit_code=1)


def run_worker(runtime: MobileSamRuntime | None, runtime_error: LocalMagicSelectError | None) -> None:
    for raw in sys.stdin:
        payload = raw.strip()
        if not payload:
            continue
        try:
            request = json.loads(payload)
        except Exception as exc:
            emit_line(
                error_payload(
                    LocalMagicSelectError(
                        "magic_select_worker_invalid_json",
                        f"Invalid worker request JSON: {exc}",
                        action="unknown",
                    )
                )
            )
            continue
        if runtime_error is not None:
            emit_line(error_payload(runtime_error))
            continue
        try:
            emit_line(runtime.handle_request(request))
        except LocalMagicSelectError as exc:
            emit_line(error_payload(exc))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run local MobileSAM click segmentation for Cue Magic Select."
    )
    parser.add_argument(
        "--input-json",
        default="-",
        help="Path to JSON request, or '-' to read from stdin.",
    )
    parser.add_argument(
        "--worker",
        action="store_true",
        help="Keep a persistent local worker alive and accept newline-delimited JSON requests on stdin.",
    )
    args = parser.parse_args()

    runtime = None
    runtime_error = None
    try:
        runtime = build_runtime()
    except LocalMagicSelectError as exc:
        runtime_error = exc

    if args.worker:
        run_worker(runtime, runtime_error)
        return

    if runtime_error is not None or runtime is None:
        emit(error_payload(runtime_error), exit_code=1)
    run_once(runtime, args.input_json)


if __name__ == "__main__":
    main()
