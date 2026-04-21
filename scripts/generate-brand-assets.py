"""Regenerate all brand assets (PWA icons, favicon, logo, Android mipmaps)
from two source images in apps/storefront/public/brand/:
  - source-icon.png      — S mark on black background
  - source-logo-full.png — full wordmark on white background
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
STOREFRONT = ROOT / "apps" / "storefront"
PUBLIC = STOREFRONT / "public"
ANDROID_RES = STOREFRONT / "android" / "app" / "src" / "main" / "res"
ANDROID_ASSETS_PUBLIC = STOREFRONT / "android" / "app" / "src" / "main" / "assets" / "public"

SRC_ICON = PUBLIC / "brand" / "source-icon.png"
SRC_LOGO = PUBLIC / "brand" / "source-logo-full.png"

BLACK = (0, 0, 0, 255)


def trim_to_mark(img: Image.Image, bg_threshold: int = 25) -> Image.Image:
    """Crop to the bounding box of the non-background pixels."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    min_x, min_y, max_x, max_y = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 10 and max(r, g, b) > bg_threshold:
                if x < min_x:
                    min_x = x
                if y < min_y:
                    min_y = y
                if x > max_x:
                    max_x = x
                if y > max_y:
                    max_y = y
    return img.crop((min_x, min_y, max_x + 1, max_y + 1))


def _place_mark(mark: Image.Image, canvas: Image.Image, mark_ratio: float) -> Image.Image:
    target = int(min(canvas.size) * mark_ratio)
    mw, mh = mark.size
    scale = target / max(mw, mh)
    new_size = (max(1, int(mw * scale)), max(1, int(mh * scale)))
    resized = mark.resize(new_size, Image.LANCZOS)
    x = (canvas.size[0] - new_size[0]) // 2
    y = (canvas.size[1] - new_size[1]) // 2
    canvas.alpha_composite(resized, (x, y))
    return canvas


def square_on_black(mark: Image.Image, canvas_size: int, mark_ratio: float = 0.72) -> Image.Image:
    """Mark centered on an opaque black square canvas."""
    return _place_mark(mark, Image.new("RGBA", (canvas_size, canvas_size), BLACK), mark_ratio)


def square_transparent(mark: Image.Image, canvas_size: int, mark_ratio: float) -> Image.Image:
    """Mark centered on a transparent square canvas (for adaptive-icon foreground)."""
    return _place_mark(mark, Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0)), mark_ratio)


def circle_on_black(mark: Image.Image, canvas_size: int, mark_ratio: float) -> Image.Image:
    """Mark centered on a black circle (for legacy ic_launcher_round.png)."""
    from PIL import ImageDraw

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    mask = Image.new("L", (canvas_size, canvas_size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, canvas_size - 1, canvas_size - 1), fill=255)
    disc = Image.new("RGBA", (canvas_size, canvas_size), BLACK)
    canvas.paste(disc, (0, 0), mask)
    return _place_mark(mark, canvas, mark_ratio)


def trim_transparent(img: Image.Image, padding: int = 0, alpha_threshold: int = 4) -> Image.Image:
    """Crop to the bounding box of pixels whose alpha > alpha_threshold, with optional padding."""
    import numpy as np

    alpha = np.array(img.convert("RGBA"))[..., 3]
    mask = alpha > alpha_threshold
    if not mask.any():
        return img
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    top, bottom = rows[0], rows[-1] + 1
    left, right = cols[0], cols[-1] + 1
    w, h = img.size
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(w, right + padding)
    bottom = min(h, bottom + padding)
    return img.crop((left, top, right, bottom))


def drop_white_background(img: Image.Image, hard: int = 252, soft: int = 230) -> Image.Image:
    """Turn white pixels transparent with a soft fade.

    Pixels whose min-channel (whiteness floor) is >= `hard` become fully transparent;
    pixels below `soft` keep their alpha; in between, alpha fades linearly.
    """
    import numpy as np

    rgba = np.array(img.convert("RGBA"), dtype=np.float32)
    r, g, b, a = rgba[..., 0], rgba[..., 1], rgba[..., 2], rgba[..., 3]
    whiteness = np.minimum(np.minimum(r, g), b)
    span = max(hard - soft, 1)
    faded = np.clip((hard - whiteness) * (255.0 / span), 0, 255)
    rgba[..., 3] = np.minimum(a, faded)
    return Image.fromarray(rgba.astype(np.uint8), "RGBA")


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print(f"  wrote {path.relative_to(ROOT)} ({img.size[0]}x{img.size[1]})")


def save_ico(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
    img.save(path, format="ICO", sizes=sizes)
    print(f"  wrote {path.relative_to(ROOT)} (multi-size)")


def save_jpg(img: Image.Image, path: Path, quality: int = 92) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rgb = Image.new("RGB", img.size, (255, 255, 255))
    rgb.paste(img.convert("RGBA"), mask=img.convert("RGBA").split()[3])
    rgb.save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    print(f"  wrote {path.relative_to(ROOT)} ({img.size[0]}x{img.size[1]})")


def main() -> None:
    assert SRC_ICON.exists(), f"missing {SRC_ICON}"
    assert SRC_LOGO.exists(), f"missing {SRC_LOGO}"

    print("Loading sources...")
    raw_icon = Image.open(SRC_ICON).convert("RGBA")
    raw_logo = Image.open(SRC_LOGO).convert("RGBA")
    print(f"  source-icon: {raw_icon.size}")
    print(f"  source-logo: {raw_logo.size}")

    print("\nTrimming S mark...")
    mark = trim_to_mark(raw_icon)
    print(f"  trimmed mark: {mark.size}")

    print("\nGenerating PWA icons...")
    for size, name, ratio in [
        (192, "icon-192x192.png", 0.78),
        (512, "icon-512x512.png", 0.78),
        (180, "apple-touch-icon-180x180.png", 0.82),
        (512, "maskable-icon-512x512.png", 0.62),
    ]:
        img = square_on_black(mark, size, ratio)
        save_png(img, PUBLIC / "icons" / name)

    print("\nGenerating favicons (transparent bg)...")
    fav_src = square_transparent(mark, 256, 0.96)
    save_ico(fav_src, PUBLIC / "favicon.ico")
    save_ico(fav_src, PUBLIC / "images" / "favicon.ico")
    save_png(fav_src, PUBLIC / "icons" / "favicon-mark.png")

    print("\nGenerating full logo (JPEG on white + transparent PNG)...")
    transparent = drop_white_background(raw_logo)
    trimmed = trim_transparent(transparent, padding=16)
    print(f"  trimmed transparent logo: {trimmed.size}")
    save_png(trimmed, PUBLIC / "images" / "suprameds-logo-full.png")

    jpg_canvas = Image.new("RGBA", trimmed.size, (255, 255, 255, 255))
    jpg_canvas.alpha_composite(trimmed)
    save_jpg(jpg_canvas, PUBLIC / "images" / "suprameds-logo.jpg", quality=92)

    print("\nGenerating Android mipmaps...")
    dpi_sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    fg_dpi_sizes = {k: int(v * 108 / 48) for k, v in dpi_sizes.items()}

    for folder, size in dpi_sizes.items():
        save_png(square_on_black(mark, size, 0.78), ANDROID_RES / folder / "ic_launcher.png")
        save_png(circle_on_black(mark, size, 0.78), ANDROID_RES / folder / "ic_launcher_round.png")

    for folder, size in fg_dpi_sizes.items():
        fg = square_transparent(mark, size, 0.44)
        save_png(fg, ANDROID_RES / folder / "ic_launcher_foreground.png")

    print("\nSyncing Android assets/public mirror (Capacitor webDir)...")
    mirror = ANDROID_ASSETS_PUBLIC
    if mirror.exists():
        for rel in [
            "icons/icon-192x192.png",
            "icons/icon-512x512.png",
            "icons/apple-touch-icon-180x180.png",
            "icons/maskable-icon-512x512.png",
            "favicon.ico",
            "images/favicon.ico",
            "images/suprameds-logo.jpg",
            "images/suprameds-logo-full.png",
        ]:
            src = PUBLIC / rel
            dst = mirror / rel
            if src.exists():
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.write_bytes(src.read_bytes())
                print(f"  mirrored {rel}")

    print("\nDone.")


if __name__ == "__main__":
    main()
