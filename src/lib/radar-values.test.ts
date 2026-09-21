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

test("axisValue uses the same 0–1 scale as the old meters", () => {
  assert.equal(axisValue({ verdict: "pass", answer: { type: "noul", noul: 0.94 } }), 0.94);
  assert.equal(axisValue({ verdict: "fail", answer: { type: "score", score: 0.12 } }), 0.06);
  assert.equal(axisValue({ verdict: "pass", answer: { type: "choice" } }), 1);
  assert.equal(axisValue({ verdict: "review", answer: { type: "choice" } }), 0.5);
  assert.equal(axisValue({ verdict: "fail", answer: { type: "choice" } }), 0);
  assert.equal(axisValue({ verdict: "not_applicable" }), null);
  assert.equal(axisValue({ verdict: "error" }), null);
  assert.equal(axisValue(undefined), null);
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
      { id: "honest_identity", value: 0.9, label: "short:honest_identity" },
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
