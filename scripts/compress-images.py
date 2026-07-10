#!/usr/bin/env python3
"""压缩 miniprogram 品类图标，备份原图到包外，删除未引用图片。"""

from __future__ import annotations

import os
import shutil
from io import BytesIO

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MINIPROGRAM = os.path.join(ROOT, "miniprogram")
IMAGES = os.path.join(MINIPROGRAM, "images")
CATEGORIES = os.path.join(IMAGES, "categories")
ORIGINALS = os.path.join(ROOT, "assets-originals", "images")

KEEP_CATEGORY_FILES = {
    "egg_chicken.png",
    "egg_duck.png",
    "egg_goose.png",
    "fruit.png",
    "honey.png",
    "veg.png",
}

MAX_SIDE = 200
MIN_KB = 20
MAX_KB = 80


def kb(size_bytes: int) -> float:
    return size_bytes / 1024


def save_png_target(img: Image.Image, path: str) -> int:
    """保存 PNG，尽量落在 20–80KB。"""
    best_data = None
    best_size = 10**9

    work = img.convert("RGBA")
    for colors in (None, 256, 128, 64):
        candidate = work
        if colors is not None:
            candidate = work.convert("P", palette=Image.ADAPTIVE, colors=colors)
            candidate = candidate.convert("RGBA")

        for compress_level in (9, 6, 3):
            buf = BytesIO()
            candidate.save(buf, format="PNG", optimize=True, compress_level=compress_level)
            data = buf.getvalue()
            size = len(data)
            if MIN_KB * 1024 <= size <= MAX_KB * 1024:
                with open(path, "wb") as f:
                    f.write(data)
                return size
            if size < best_size:
                best_data, best_size = data, size

    if best_data:
        with open(path, "wb") as f:
            f.write(best_data)
        return best_size
    return 0


def resize_to_fit(img: Image.Image, max_side: int) -> Image.Image:
    w, h = img.size
    if w <= max_side and h <= max_side:
        return img
    ratio = min(max_side / w, max_side / h)
    nw, nh = max(1, int(w * ratio)), max(1, int(h * ratio))
    return img.resize((nw, nh), Image.Resampling.LANCZOS)


def backup_file(src: str, rel: str) -> None:
    dst = os.path.join(ORIGINALS, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.exists(dst):
        shutil.copy2(src, dst)


def compress_category(filename: str) -> tuple[str, float, float]:
    src = os.path.join(CATEGORIES, filename)
    if not os.path.exists(src):
        raise FileNotFoundError(src)

    before = os.path.getsize(src)
    backup_file(src, os.path.join("categories", filename))

    with Image.open(src) as im:
        im = resize_to_fit(im, MAX_SIDE)
        after_bytes = save_png_target(im, src)

    return filename, kb(before), kb(after_bytes)


def delete_unreferenced_images() -> list[str]:
    removed = []
    for dp, _, fns in os.walk(IMAGES):
        for fn in fns:
            full = os.path.join(dp, fn)
            rel = os.path.relpath(full, IMAGES)
            if rel.startswith("categories" + os.sep) and fn in KEEP_CATEGORY_FILES:
                continue
            if fn == ".gitkeep":
                continue
            backup_file(full, rel)
            os.remove(full)
            removed.append(rel.replace("\\", "/"))
    return removed


def folder_size(path: str) -> int:
    total = 0
    for dp, _, fns in os.walk(path):
        for fn in fns:
            total += os.path.getsize(os.path.join(dp, fn))
    return total


def main() -> None:
    os.makedirs(ORIGINALS, exist_ok=True)
    os.makedirs(CATEGORIES, exist_ok=True)

    print("=== 压缩品类图标 (200x200, 目标 20-80KB) ===")
    for name in sorted(KEEP_CATEGORY_FILES):
        fn, before, after = compress_category(name)
        print(f"  {fn}: {before:.1f} KB -> {after:.1f} KB")

    print("\n=== 删除 miniprogram 内未引用图片 ===")
    removed = delete_unreferenced_images()
    for r in sorted(removed):
        print(f"  删除: images/{r}")
    print(f"  共删除 {len(removed)} 个文件")

    img_size = folder_size(IMAGES)
    mp_size = folder_size(MINIPROGRAM)
    print("\n=== 压缩后体积 ===")
    print(f"  miniprogram/images: {img_size / 1024:.1f} KB")
    print(f"  miniprogram 总计:   {mp_size / 1024 / 1024:.2f} MB")
    print(f"  原图备份目录:       {ORIGINALS}")


if __name__ == "__main__":
    main()
