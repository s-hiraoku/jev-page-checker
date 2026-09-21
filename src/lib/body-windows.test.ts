import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bodyCollectLimit,
  chunkOverlap,
  packSynthesisText,
  splitOverlappingChunks,
} from "./body-windows.js";
import { bodyTokenBudget, bodyWindowCharBudget, estimateTokens, fitsJevBodyBudget } from "./jev-budget.js";

test("splitOverlappingChunks keeps a short text as one window", () => {
  const { windows, covered } = splitOverlappingChunks("abcdefghij");
  assert.equal(windows.length, 1);
  assert.equal(windows[0]?.text, "abcdefghij");
  assert.equal(covered, true);
});

test("a body that fits the Jev token budget is one window", () => {
  const text = "The inspection memo is posted beside the pier photograph. ".repeat(200);
  assert.equal(fitsJevBodyBudget(text), true);
  const { windows, covered } = splitOverlappingChunks(text);
  assert.equal(windows.length, 1);
  assert.equal(covered, true);
});

test("splitOverlappingChunks covers the whole string with overlapping windows", () => {
  const text = "abcdefghijklmnopqrstuvwxyz0123456789";
  const { windows, covered } = splitOverlappingChunks(text, 3);
  assert.ok(windows.length >= 2);
  assert.equal(covered, true);
  for (let index = 0; index < windows.length - 1; index += 1) {
    const left = windows[index];
    const right = windows[index + 1];
    assert.ok(left && right && left.end > right.start);
    assert.ok(estimateTokens(left.text) <= 3);
  }
  assert.equal(windows[windows.length - 1]?.end, text.length);
});

test("bodyCollectLimit is the length overlapping English-density windows can cover", () => {
  const maxTokens = 1_000;
  const size = bodyWindowCharBudget(maxTokens);
  const overlap = chunkOverlap(size);
  const { windows, covered } = splitOverlappingChunks("x".repeat(bodyCollectLimit(maxTokens)), maxTokens);
  assert.equal(covered, true);
  assert.equal(windows.length, 8);
  assert.equal(overlap, Math.max(1, Math.min(Math.floor(size * 0.15), size - 1)));
});

test("Japanese over the body token budget splits into more than one window", () => {
  const { windows, covered } = splitOverlappingChunks("あ".repeat(bodyTokenBudget() + 64));
  assert.ok(windows.length >= 2);
  assert.equal(covered, true);
  assert.ok(estimateTokens(windows[0]?.text ?? "") <= bodyTokenBudget());
});

test("Japanese over a small token budget leaves remainder after eight windows", () => {
  const maxTokens = 100;
  const { windows, covered } = splitOverlappingChunks("あ".repeat(bodyCollectLimit(maxTokens) + 50), maxTokens);
  assert.equal(windows.length, 8);
  assert.equal(covered, false);
  assert.ok(estimateTokens(windows[0]?.text ?? "") <= maxTokens);
});

test("packSynthesisText stays within the token budget and keeps overlap before remainder", () => {
  const text = "alpha bravo charlie delta echo foxtrot";
  const { windows } = splitOverlappingChunks(text, 4);
  const packed = packSynthesisText(text, windows, ["Window 1: self_consistent=pass"], 80);
  assert.ok(estimateTokens(packed) <= 80);
  assert.match(packed, /overlapping windows/);
});
