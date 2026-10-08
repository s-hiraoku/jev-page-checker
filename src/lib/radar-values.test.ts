import assert from "node:assert/strict";
import { test } from "node:test";
import type { ItemResult } from "./checkkit.js";
import { axisValue, clamp01, polarPoint, radarAxes } from "./radar-values.js";

test("clamp01 bounds and NaN", () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(1.4), 1);
  assert.equal(clamp01(0.42), 0.42);
  assert.equal(clamp01(Number.NaN), 0);
});

test("axisValue puts every verdict in its own band", () => {
  const close = (actual: number | null, expected: number) => assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
  close(axisValue({ verdict: "pass", answer: { type: "noul", noul: 1 } }), 1);
  close(axisValue({ verdict: "pass", answer: { type: "noul", noul: 0.8 } }), 2 / 3);
  // A Review just under the pass line stays under the Pass ring.
  close(axisValue({ verdict: "review", answer: { type: "noul", noul: 0.78 } }), 1 / 3 + (0.58 / 0.6) / 3);
  close(axisValue({ verdict: "review", answer: { type: "noul", noul: 0.35 } }), 1 / 3 + (0.15 / 0.6) / 3);
  close(axisValue({ verdict: "fail", answer: { type: "noul", noul: 0.1 } }), 1 / 6);
  close(axisValue({ verdict: "pass", answer: { type: "choice", confidence: 0.9 } }), 2 / 3 + 0.75 / 3);
  close(axisValue({ verdict: "pass", answer: { type: "choice" } }), 5 / 6);
  close(axisValue({ verdict: "review", answer: { type: "choice", confidence: 0.9 } }), 0.5);
  close(axisValue({ verdict: "fail", answer: { type: "choice", confidence: 1 } }), 0);
  close(axisValue({ verdict: "fail", answer: { type: "score", score: 0.12 } }), 0.02);
  assert.equal(axisValue({ verdict: "not_applicable" }), null);
  assert.equal(axisValue({ verdict: "error" }), null);
  assert.equal(axisValue(undefined), null);
});

test("a Review never reaches the Pass ring and an Alert never reaches the Review ring", () => {
  for (const noul of [0.21, 0.5, 0.79]) assert.ok(axisValue({ verdict: "review", answer: { type: "noul", noul } })! <= 2 / 3);
  for (const noul of [0, 0.2]) assert.ok(axisValue({ verdict: "fail", answer: { type: "noul", noul } })! <= 1 / 3);
  for (const confidence of [0.6, 0.95]) assert.ok(axisValue({ verdict: "fail", answer: { type: "choice", confidence } })! <= 1 / 3);
});

test("radarAxes keeps question order and drops missing items as empty axes", () => {
  const items = [
    { id: "honest_identity", verdict: "pass", reason: "", answer: { type: "noul" as const, noul: 0.9 } },
  ] as ItemResult[];
  const axes = radarAxes(items, ["identifiable_publisher", "honest_identity"], (id) => `full:${id}`, (id) => `short:${id}`);
  assert.deepEqual(
    axes.map((axis) => ({ id: axis.id, value: axis.value, label: axis.label })),
    [
      { id: "identifiable_publisher", value: null, label: "short:identifiable_publisher" },
      { id: "honest_identity", value: 2 / 3 + 0.5 / 3, label: "short:honest_identity" },
    ],
  );
});

test("polarPoint starts at the top and moves clockwise", () => {
  const top = polarPoint(0, 4, 1, 10);
  assert.ok(Math.abs(top.x) < 1e-10);
  assert.ok(Math.abs(top.y + 10) < 1e-10);
  const right = polarPoint(1, 4, 1, 10);
  assert.ok(Math.abs(right.x - 10) < 1e-10);
  assert.ok(Math.abs(right.y) < 1e-10);
});
