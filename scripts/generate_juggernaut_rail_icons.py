#!/usr/bin/env python3
"""Generate provider-backed Juggernaut rail icon packs via Oscillo Gemini."""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OSCILLO_ROOT = ROOT.parent / "oscillo"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if value[:1] == value[-1:] and value[:1] in {"'", '"'}:
            value = value[1:-1]
        os.environ.setdefault(key, value)

    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    google_key = os.environ.get("GOOGLE_API_KEY", "").strip()
    if gemini_key and not google_key:
        os.environ["GOOGLE_API_KEY"] = gemini_key
    if google_key and not gemini_key:
        os.environ["GEMINI_API_KEY"] = google_key


def bbox_touches_edge(bbox: tuple[int, int, int, int], size: tuple[int, int], inset: int = 1) -> bool:
    x0, y0, x1, y1 = bbox
    width, height = size
    return x0 <= inset or y0 <= inset or x1 >= width - inset or y1 >= height - inset


def mask_from_checkerboard(rgb: np.ndarray) -> Optional[Image.Image]:
    if rgb.ndim != 3 or rgb.shape[2] != 3:
        return None
    height, width, _ = rgb.shape
    if height < 8 or width < 8:
        return None

    quant = (rgb // 8) * 8
    flat = quant.reshape(-1, 3)
    colors, counts = np.unique(flat, axis=0, return_counts=True)
    if len(colors) < 2:
        return None

    top_idx = counts.argsort()[::-1][:2]
    c1, c2 = colors[top_idx[0]], colors[top_idx[1]]
    coverage = (counts[top_idx[0]] + counts[top_idx[1]]) / float(height * width)
    lum1 = 0.299 * c1[0] + 0.587 * c1[1] + 0.114 * c1[2]
    lum2 = 0.299 * c2[0] + 0.587 * c2[1] + 0.114 * c2[2]
    lum_diff = abs(lum1 - lum2)

    if coverage < 0.6 or lum_diff < 5 or lum_diff > 90:
        return None

    grid_y, grid_x = np.indices((height, width))
    parity = (grid_x + grid_y) & 1
    matches1 = np.all(quant == c1, axis=2)
    matches2 = np.all(quant == c2, axis=2)

    even_total = np.count_nonzero(parity == 0)
    odd_total = height * width - even_total
    even_c1 = np.count_nonzero(matches1 & (parity == 0))
    even_c2 = np.count_nonzero(matches2 & (parity == 0))
    odd_c1 = np.count_nonzero(matches1 & (parity == 1))
    odd_c2 = np.count_nonzero(matches2 & (parity == 1))

    if even_total == 0 or odd_total == 0:
        return None

    even_ratio = max(even_c1, even_c2) / float(even_total)
    odd_ratio = max(odd_c1, odd_c2) / float(odd_total)
    even_color = 0 if even_c1 >= even_c2 else 1
    odd_color = 0 if odd_c1 >= odd_c2 else 1

    if even_ratio < 0.55 or odd_ratio < 0.55 or even_color == odd_color:
        return None

    rgb_int = rgb.astype(np.int16)
    c1_int = c1.astype(np.int16)
    c2_int = c2.astype(np.int16)
    dist1 = np.linalg.norm(rgb_int - c1_int, axis=2)
    dist2 = np.linalg.norm(rgb_int - c2_int, axis=2)
    bg_dist = np.minimum(dist1, dist2)
    mask_np = (bg_dist >= 18.0).astype(np.uint8) * 255
    return Image.fromarray(mask_np, mode="L")


def mask_from_luminance(rgb: np.ndarray) -> Image.Image:
    luminance = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]).astype(np.float32)
    inverted = 255.0 - luminance
    threshold = float(max(20.0, np.percentile(inverted, 75)))
    scaled = np.clip((inverted - threshold) * 255.0 / max(1.0, 255.0 - threshold), 0, 255).astype(np.uint8)
    mask = Image.fromarray(scaled, mode="L")
    return mask.filter(ImageFilter.MedianFilter(3))


def select_binary_mask(mask: Image.Image, *, size: tuple[int, int], strategy: str) -> Optional[dict[str, Any]]:
    mask_array = np.array(mask, dtype=np.uint8)
    thresholds = (64, 96, 128, 160, 192)
    for threshold in thresholds:
        binary = (mask_array >= threshold).astype(np.uint8) * 255
        candidate = Image.fromarray(binary, mode="L").filter(ImageFilter.MedianFilter(3))
        bbox = candidate.getbbox()
        if not bbox:
            continue
        coverage = float(np.count_nonzero(binary)) / float(binary.size)
        record = {
            "mask": candidate,
            "strategy": strategy,
            "threshold": threshold,
            "coverage": coverage,
            "bbox": [int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])],
        }
        if 0.005 <= coverage <= 0.65 and not bbox_touches_edge(bbox, size):
            return record
    return None


def mask_from_border_palette(rgb: np.ndarray) -> Optional[dict[str, Any]]:
    height, width, _ = rgb.shape
    border_width = max(6, min(height, width) // 128)
    border = np.concatenate(
        [
            rgb[:border_width, :, :].reshape(-1, 3),
            rgb[-border_width:, :, :].reshape(-1, 3),
            rgb[:, :border_width, :].reshape(-1, 3),
            rgb[:, -border_width:, :].reshape(-1, 3),
        ],
        axis=0,
    )

    quant = (border // 8) * 8
    border_counts = Counter(map(tuple, quant.tolist()))
    if not border_counts:
        return None

    top_colors = [np.array(color, dtype=np.int16) for color, _ in border_counts.most_common(4)]
    rgb_int = rgb.astype(np.int16)
    dist = np.minimum.reduce([np.linalg.norm(rgb_int - color, axis=2) for color in top_colors])
    p75 = float(np.percentile(dist, 75))
    p90 = float(np.percentile(dist, 90))

    thresholds = sorted(
        {
            40,
            60,
            80,
            100,
            120,
            int(round(max(28.0, min(160.0, p75 + ((p90 - p75) * 0.25))))),
        }
    )
    for threshold in thresholds:
        binary = (dist >= float(threshold)).astype(np.uint8) * 255
        candidate = Image.fromarray(binary, mode="L").filter(ImageFilter.MedianFilter(3))
        bbox = candidate.getbbox()
        if not bbox:
            continue
        coverage = float(np.count_nonzero(binary)) / float(binary.size)
        record = {
            "mask": candidate,
            "strategy": "border_palette",
            "threshold": threshold,
            "coverage": coverage,
            "bbox": [int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])],
            "border_colors": [list(map(int, color)) for color in top_colors],
            "p75": p75,
            "p90": p90,
        }
        if 0.005 <= coverage <= 0.65 and not bbox_touches_edge(bbox, (width, height)):
            return record
    return None


def choose_mask(source: Image.Image) -> dict[str, Any]:
    rgba = source.convert("RGBA")
    alpha = rgba.getchannel("A")
    alpha_min, alpha_max = alpha.getextrema()
    if alpha_min < alpha_max:
        bbox = alpha.getbbox()
        if bbox:
            alpha_array = np.array(alpha, dtype=np.uint8)
            coverage = float(np.count_nonzero(alpha_array)) / float(alpha_array.size)
            if 0.005 <= coverage <= 0.65 and not bbox_touches_edge(bbox, rgba.size):
                return {
                    "mask": alpha,
                    "strategy": "embedded_alpha",
                    "threshold": None,
                    "coverage": coverage,
                    "bbox": [int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])],
                }

    rgb = np.array(rgba.convert("RGB"), dtype=np.uint8)
    checker_mask = mask_from_checkerboard(rgb)
    if checker_mask is not None:
        checker_choice = select_binary_mask(checker_mask, size=rgba.size, strategy="checkerboard")
        if checker_choice is not None:
            return checker_choice

    border_choice = mask_from_border_palette(rgb)
    if border_choice is not None:
        return border_choice

    luminance_choice = select_binary_mask(mask_from_luminance(rgb), size=rgba.size, strategy="luminance")
    if luminance_choice is not None:
        return luminance_choice

    raise RuntimeError("Unable to extract a clean icon mask from provider output")


def write_mask_icon(mask: Image.Image, output_path: Path) -> dict[str, Any]:
    bbox = mask.getbbox()
    if not bbox:
        raise RuntimeError("Empty icon mask")

    cropped = mask.crop(bbox)
    if cropped.width < 8 or cropped.height < 8:
        raise RuntimeError("Icon mask too small after cropping")

    canvas_size = 256
    padding = 34
    available = canvas_size - (padding * 2)
    scale = min(available / float(cropped.width), available / float(cropped.height))
    target_size = (
        max(1, int(round(cropped.width * scale))),
        max(1, int(round(cropped.height * scale))),
    )
    resized = cropped.resize(target_size, Image.LANCZOS)

    icon = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    glyph = Image.new("RGBA", target_size, (255, 255, 255, 0))
    glyph.putalpha(resized)
    offset = ((canvas_size - target_size[0]) // 2, (canvas_size - target_size[1]) // 2)
    icon.alpha_composite(glyph, dest=offset)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    icon.save(output_path, format="PNG")

    final_alpha = icon.getchannel("A")
    final_bbox = final_alpha.getbbox()
    final_coverage = float(np.count_nonzero(np.array(final_alpha, dtype=np.uint8))) / float(canvas_size * canvas_size)
    return {
        "asset": output_path.name,
        "canvas_size": canvas_size,
        "padding": padding,
        "final_bbox": list(map(int, final_bbox)) if final_bbox else None,
        "final_coverage": final_coverage,
    }


def build_effective_prompt(base_prompt: str, *, pack_label: str, index: int) -> str:
    if index == 0:
        return base_prompt
    continuity = (
        f"Match the same {pack_label} icon pack style, rendering language, line quality, and simplification level as the previous icons in this session. "
        "Keep the icon large, isolated, black-on-white, and free of decorative background."
    )
    return f"{continuity} {base_prompt}".strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Juggernaut rail icon packs with Oscillo Gemini.")
    parser.add_argument("--plan", required=True, help="Path to the generation plan JSON.")
    parser.add_argument("--report", required=True, help="Path to write the generation report JSON.")
    parser.add_argument("--asset-dir", required=True, help="Directory to write final PNG assets into.")
    parser.add_argument("--oscillo-root", default=str(DEFAULT_OSCILLO_ROOT), help="Path to the Oscillo repository root.")
    parser.add_argument("--temp-dir", default=str(ROOT / ".tmp" / "juggernaut-rail-icons"), help="Temp directory for raw provider outputs.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    plan_path = Path(args.plan).resolve()
    report_path = Path(args.report).resolve()
    asset_dir = Path(args.asset_dir).resolve()
    oscillo_root = Path(args.oscillo_root).resolve()
    temp_dir = Path(args.temp_dir).resolve()

    load_env_file(oscillo_root / ".env")
    if str(oscillo_root) not in sys.path:
        sys.path.insert(0, str(oscillo_root))

    from emotional_telemetry.services.imagegen import generate_with_provider

    if not (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")):
        raise SystemExit(f"Missing GEMINI_API_KEY/GOOGLE_API_KEY after loading {oscillo_root / '.env'}")

    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    model_name = str(
        plan.get("provider", {}).get("model")
        or os.environ.get("GEMINI_IMAGE_MODEL")
        or os.environ.get("OSCILLO_GOOGLE_IMAGE_MODEL")
        or "gemini-3-pro-image-preview"
    ).strip()

    temp_dir.mkdir(parents=True, exist_ok=True)
    asset_dir.mkdir(parents=True, exist_ok=True)

    report: Dict[str, Any] = {
        "schema": "juggernaut.rail_icon_generation_report.v1",
        "generator": "scripts/generate_juggernaut_rail_icons.py",
        "provider": {
            "name": "gemini",
            "model": model_name,
            "output_format_requested": "image/png",
            "image_size": "2K",
        },
        "packs": [],
    }

    for pack in plan.get("packs", []):
        pack_id = str(pack.get("id") or "").strip()
        if not pack_id:
            continue
        pack_label = str(pack.get("label") or pack_id).strip() or pack_id
        pack_temp_dir = temp_dir / pack_id
        pack_temp_dir.mkdir(parents=True, exist_ok=True)
        pack_asset_dir = asset_dir / pack_id
        pack_asset_dir.mkdir(parents=True, exist_ok=True)
        session_ref: dict[str, Any] = {"state": None}
        pack_report = {
            "id": pack_id,
            "label": pack_label,
            "icons": [],
        }

        for index, icon in enumerate(pack.get("icons", [])):
            tool_id = str(icon.get("tool_id") or "").strip()
            if not tool_id:
                continue
            base_prompt = str(icon.get("gemini_prompt") or "").strip()
            if not base_prompt:
                raise RuntimeError(f"Missing gemini prompt for {pack_id}:{tool_id}")
            effective_prompt = build_effective_prompt(base_prompt, pack_label=pack_label, index=index)

            provider_options: Dict[str, Any] = {
                "model": model_name,
                "output_format": "image/png",
                "image_size": "2K",
                "session_callback": lambda state, holder=session_ref: holder.__setitem__("state", state),
            }
            if session_ref["state"] is not None:
                provider_options["session_state"] = session_ref["state"]

            results = list(
                generate_with_provider(
                    effective_prompt,
                    count=1,
                    size="1536x1536",
                    output_dir=pack_temp_dir,
                    provider="gemini",
                    provider_options=provider_options,
                )
            )
            if not results:
                raise RuntimeError(f"Gemini returned no result for {pack_id}:{tool_id}")

            raw_path = Path(str(results[0].image_path)).resolve()
            source_image = Image.open(raw_path)
            try:
                mask_choice = choose_mask(source_image)
            except Exception as exc:
                raise RuntimeError(f"Unable to extract icon mask for {pack_id}:{tool_id} from {raw_path}") from exc
            output_path = pack_asset_dir / f"{tool_id}.png"
            final_metadata = write_mask_icon(mask_choice["mask"], output_path)

            pack_report["icons"].append(
                {
                    "tool_id": tool_id,
                    "asset": f"./{pack_id}/{tool_id}.png",
                    "prompt": base_prompt,
                    "effective_prompt": effective_prompt,
                    "raw_result_path": str(raw_path),
                    "raw_result_format": raw_path.suffix.lower().lstrip("."),
                    "mask_strategy": mask_choice["strategy"],
                    "mask_threshold": mask_choice.get("threshold"),
                    "mask_coverage": mask_choice["coverage"],
                    "mask_bbox": mask_choice["bbox"],
                    "final_asset_path": str(output_path),
                    "final_asset": final_metadata,
                    "session_index": index,
                }
            )

        report["packs"].append(pack_report)

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(f"{json.dumps(report, indent=2)}\n", encoding="utf-8")


if __name__ == "__main__":
    main()
