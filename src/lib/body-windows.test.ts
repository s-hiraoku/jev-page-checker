import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bodyCollectLimit,
  chunkOverlap,
  packSynthesisText,
  splitOverlappingChunks,
} from "./body-windows.js";

test("splitOverlappingChunks keeps a short text as one window", () => {
  const { windows, covered } = splitOverlappingChunks("abcdefghij", 20);
  assert.equal(windows.length, 1);
  assert.equal(windows[0]?.text, "abcdefghij");
  assert.equal(covered, true);
});

test("splitOverlappingChunks covers the whole string with overlapping windows", () => {
  const text = "abcdefghijklmnopqrstuvwxyz0123456789";
  const { windows, covered } = splitOverlappingChunks(text, 10);
  assert.ok(windows.length >= 2);
  assert.equal(covered, true);
  assert.equal(windows[0]?.text.length, 10);
  for (let index = 0; index < windows.length - 1; index += 1) {
    const left = windows[index];
    const right = windows[index + 1];
    assert.ok(left && right && left.end > right.start);
  }
  assert.equal(windows[windows.length - 1]?.end, text.length);
});

test("bodyCollectLimit is the length overlapping windows can cover", () => {
  const maxChars = 1000;
  const overlap = chunkOverlap(maxChars);
  const { windows, covered } = splitOverlappingChunks("x".repeat(bodyCollectLimit(maxChars)), maxChars);
  assert.equal(covered, true);
  assert.equal(windows.length, 8);
  assert.equal(overlap, 150);
});

test("packSynthesisText stays within the window and keeps overlap before remainder", () => {
  const text = "alpha bravo charlie delta echo foxtrot";
  const { windows } = splitOverlappingChunks(text, 12);
  const packed = packSynthesisText(text, windows, ["Window 1: self_consistent=pass"], 400);
  assert.ok(packed.length <= 400);
  assert.match(packed, /overlapping windows/);
});
