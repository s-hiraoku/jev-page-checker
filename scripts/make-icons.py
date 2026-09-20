#!/usr/bin/env python3
from pathlib import Path
import struct
import zlib


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def png(size: int, pixels: list[tuple[int, int, int]]) -> bytes:
    raw = b""
    for y in range(size):
        raw += b"\x00"
        for x in range(size):
            raw += bytes(pixels[y * size + x])
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def icon(size: int) -> bytes:
    paper = (231, 237, 242)
    site = (52, 85, 120)
    page = (90, 106, 120)
    inset = max(1, round(size * 0.12))
    gap = max(1, round(size * 0.08))
    mid = size // 2
    pixels: list[tuple[int, int, int]] = []
    for y in range(size):
        for x in range(size):
            if x < inset or x >= size - inset or y < inset or y >= size - inset:
                pixels.append(paper)
            elif mid - gap // 2 <= y < mid + (gap + 1) // 2:
                pixels.append(paper)
            elif y < mid:
                pixels.append(site)
            else:
                pixels.append(page)
    return png(size, pixels)


def main() -> None:
    dest = Path(__file__).resolve().parents[1] / "public"
    dest.mkdir(exist_ok=True)
    for size in (16, 32, 48, 128):
        (dest / f"icon-{size}.png").write_bytes(icon(size))


if __name__ == "__main__":
    main()
