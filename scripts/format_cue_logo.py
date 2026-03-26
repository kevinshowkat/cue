#!/usr/bin/env python3
"""Format the supplied Cue glove artwork into app-icon and UI-brand assets."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


APP_ICON_SIZE = 1024
APP_ICON_PADDING = 108
APP_ICON_RADIUS = 236
APP_ICON_FILL = (247, 239, 224, 255)
APP_ICON_OUTLINE = (49, 41, 35, 32)
APP_ICON_SHADOW = (24, 20, 16, 58)

BRAND_TILE_SIZE = 512


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Format Cue logo assets from a source image.")
    parser.add_argument("--source", required=True, help="Path to the source artwork.")
    parser.add_argument("--icon-output", required=True, help="Output path for the 1024px app icon PNG.")
    parser.add_argument("--brand-output", required=True, help="Output path for the transparent brand mark PNG.")
    return parser.parse_args()


def sample_background(rgb: np.ndarray, border: int = 32) -> np.ndarray:
    top = rgb[:border, :, :]
    bottom = rgb[-border:, :, :]
    left = rgb[:, :border, :]
    right = rgb[:, -border:, :]
    border_pixels = np.concatenate(
        [
            top.reshape(-1, 3),
            bottom.reshape(-1, 3),
            left.reshape(-1, 3),
            right.reshape(-1, 3),
        ],
        axis=0,
    )
    return np.median(border_pixels, axis=0)


def build_alpha_mask(rgb: np.ndarray, bg_color: np.ndarray) -> Image.Image:
    diff = np.linalg.norm(rgb.astype(np.float32) - bg_color.astype(np.float32), axis=2)
    hard = (diff >= 46.0).astype(np.uint8) * 255
    hard_mask = (
        Image.fromarray(hard, mode="L")
        .filter(ImageFilter.MedianFilter(7))
        .filter(ImageFilter.MaxFilter(5))
        .filter(ImageFilter.GaussianBlur(0.8))
    )
    hard_array = np.array(hard_mask, dtype=np.uint8)
    alpha = np.clip((diff - 20.0) * (255.0 / 38.0), 0, 255).astype(np.uint8)
    alpha = np.where(hard_array >= 8, alpha, 0).astype(np.uint8)
    mask = Image.fromarray(alpha, mode="L").filter(ImageFilter.GaussianBlur(0.8))
    return mask


def crop_foreground(source: Image.Image, mask: Image.Image, bg_color: np.ndarray) -> Image.Image:
    bbox = mask.getbbox()
    if not bbox:
        raise RuntimeError("Unable to isolate logo foreground from the supplied image.")
    pad = 20
    x0 = max(0, bbox[0] - pad)
    y0 = max(0, bbox[1] - pad)
    x1 = min(source.width, bbox[2] + pad)
    y1 = min(source.height, bbox[3] + pad)
    rgb = np.array(source.convert("RGB"), dtype=np.float32)
    alpha = np.array(mask, dtype=np.float32) / 255.0
    safe_alpha = np.maximum(alpha, 1e-6)[..., None]
    bg = bg_color.astype(np.float32)[None, None, :]
    decontaminated = np.clip((rgb - (bg * (1.0 - alpha[..., None]))) / safe_alpha, 0, 255)
    rgba_array = np.dstack([decontaminated.astype(np.uint8), (alpha * 255.0).astype(np.uint8)])
    rgba = Image.fromarray(rgba_array, mode="RGBA")
    return rgba.crop((x0, y0, x1, y1))


def fit_into_canvas(image: Image.Image, size: int, padding: int) -> Image.Image:
    available = size - (padding * 2)
    scale = min(available / image.width, available / image.height)
    target = (
        max(1, int(round(image.width * scale))),
        max(1, int(round(image.height * scale))),
    )
    fitted = image.resize(target, Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = ((size - target[0]) // 2, (size - target[1]) // 2)
    canvas.alpha_composite(fitted, dest=offset)
    return canvas


def render_app_icon(foreground: Image.Image) -> Image.Image:
    icon = Image.new("RGBA", (APP_ICON_SIZE, APP_ICON_SIZE), (0, 0, 0, 0))

    shadow = Image.new("RGBA", icon.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (80, 102, APP_ICON_SIZE - 80, APP_ICON_SIZE - 58),
        radius=APP_ICON_RADIUS,
        fill=APP_ICON_SHADOW,
    )
    icon.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(34)))

    plate = Image.new("RGBA", icon.size, (0, 0, 0, 0))
    plate_draw = ImageDraw.Draw(plate)
    plate_draw.rounded_rectangle(
        (80, 80, APP_ICON_SIZE - 80, APP_ICON_SIZE - 80),
        radius=APP_ICON_RADIUS,
        fill=APP_ICON_FILL,
        outline=APP_ICON_OUTLINE,
        width=3,
    )

    sheen = Image.new("RGBA", icon.size, (0, 0, 0, 0))
    sheen_draw = ImageDraw.Draw(sheen)
    sheen_draw.ellipse(
        (150, 118, APP_ICON_SIZE - 150, APP_ICON_SIZE - 420),
        fill=(255, 255, 255, 44),
    )
    plate.alpha_composite(sheen.filter(ImageFilter.GaussianBlur(42)))
    icon.alpha_composite(plate)

    fitted = fit_into_canvas(foreground, APP_ICON_SIZE, APP_ICON_PADDING)
    icon.alpha_composite(fitted)
    return icon


def render_brand_tile(app_icon: Image.Image) -> Image.Image:
    return app_icon.resize((BRAND_TILE_SIZE, BRAND_TILE_SIZE), Image.LANCZOS)


def main() -> None:
    args = parse_args()
    source_path = Path(args.source).resolve()
    icon_output = Path(args.icon_output).resolve()
    brand_output = Path(args.brand_output).resolve()

    with Image.open(source_path) as source:
        rgb = np.array(source.convert("RGB"), dtype=np.uint8)
        bg_color = sample_background(rgb)
        mask = build_alpha_mask(rgb, bg_color)
        foreground = crop_foreground(source, mask, bg_color)
        app_icon = render_app_icon(foreground)
        brand_mark = render_brand_tile(app_icon)

    icon_output.parent.mkdir(parents=True, exist_ok=True)
    brand_output.parent.mkdir(parents=True, exist_ok=True)
    app_icon.save(icon_output, format="PNG")
    brand_mark.save(brand_output, format="PNG")


if __name__ == "__main__":
    main()
