#!/usr/bin/env python3
from pathlib import Path
import struct
import zlib

PAPER = (231, 237, 242)
CARD = (247, 250, 252)
INK = (23, 32, 51)
RULE = (52, 85, 120)
PASS = (44, 106, 85)
REVIEW = (181, 106, 18)
FAIL = (142, 47, 44)
MUTED = (90, 106, 120)


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def png(width: int, height: int, pixels: list[tuple[int, int, int]]) -> bytes:
    raw = b""
    for y in range(height):
        raw += b"\x00"
        row = pixels[y * width : (y + 1) * width]
        raw += b"".join(bytes(pixel) for pixel in row)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def fill(pixels: list[tuple[int, int, int]], width: int, x0: int, y0: int, x1: int, y1: int, color: tuple[int, int, int]) -> None:
    for y in range(max(0, y0), y1):
        for x in range(max(0, x0), x1):
            pixels[y * width + x] = color


def circle(pixels: list[tuple[int, int, int]], width: int, cx: float, cy: float, inner: float, outer: float, color: tuple[int, int, int]) -> None:
    height = len(pixels) // width
    for y in range(height):
        for x in range(width):
            r = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if inner < r <= outer:
                pixels[y * width + x] = color


def mark(size: int) -> list[tuple[int, int, int]]:
    pixels = [PAPER] * (size * size)
    cx = cy = (size - 1) / 2
    circle(pixels, size, cx, cy, size * 0.28, size * 0.42, RULE)
    fill(pixels, size, int(size * 0.46), int(size * 0.34), int(size * 0.54), int(size * 0.7), INK)
    return pixels


def promo(width: int, height: int) -> list[tuple[int, int, int]]:
    pixels = [PAPER] * (width * height)
    fill(pixels, width, 0, 0, width, 12, RULE)
    fill(pixels, width, 24, 36, width // 2 - 12, height - 28, CARD)
    fill(pixels, width, width // 2 + 12, 36, width - 24, height - 28, CARD)
    fill(pixels, width, 40, 56, width // 2 - 28, 72, PASS)
    fill(pixels, width, width // 2 + 28, 56, width - 40, 72, REVIEW)
    cx = width * 0.18
    cy = height * 0.62
    circle(pixels, width, cx, cy, height * 0.08, height * 0.14, RULE)
    return pixels


def main() -> None:
    dest = Path(__file__).resolve().parents[1] / "store" / "images"
    dest.mkdir(parents=True, exist_ok=True)
    (dest / "icon-128.png").write_bytes(png(128, 128, mark(128)))
    (dest / "small-promo-440x280.png").write_bytes(png(440, 280, promo(440, 280)))
    (dest / "marquee-1400x560.png").write_bytes(png(1400, 560, promo(1400, 560)))


if __name__ == "__main__":
    main()
