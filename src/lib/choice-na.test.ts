import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { evaluate, parseDefinition, replayGateway } from "./checkkit.js";

const definition = (options: Record<string, string>) => ({
  id: "choice-na",
  version: 1,
  subject: "test",
  approval: { status: "approved", at: "2026-09-23", by: "test" },
  questions: [{
    id: "purpose",
    type: "choice",
    instructions: "Choose the best label.",
    criteria: { ordinary: "An ordinary choice.", irrelevant: "Not relevant." },
    options,
    confidenceFloor: 0.6,
  }],
});

const answer = (confidence: number) => ({
  purpose: { type: "choice" as const, choice: "irrelevant", confidence, probabilities: { irrelevant: confidence } },
});

test("choice options can explicitly map to not_applicable", async () => {
  const parsed = parseDefinition(definition({ ordinary: "pass", irrelevant: "not_applicable" }));
  const report = await evaluate(parsed, {}, replayGateway(answer(0.9)));
  assert.equal(report.items[0]?.verdict, "not_applicable");
});

test("choice confidence floor still takes precedence over not_applicable mapping", async () => {
  const parsed = parseDefinition(definition({ ordinary: "pass", irrelevant: "not_applicable" }));
  const report = await evaluate(parsed, {}, replayGateway(answer(0.59)));
  assert.equal(report.items[0]?.verdict, "review");
  assert.match(report.items[0]?.reason ?? "", /below confidenceFloor 0.6/);
});

test("choice option mappings must exactly cover criteria labels", () => {
  assert.throws(() => parseDefinition(definition({ ordinary: "pass" })), /exact mapping/);
  assert.throws(() => parseDefinition(definition({ ordinary: "pass", irrelevant: "review", extra: "fail" })), /exact mapping/);
});

test("existing checker fixture remains valid", () => {
  const fixture = JSON.parse(readFileSync(new URL("../../fixtures/page-credibility.checker.json", import.meta.url), "utf8"));
  assert.doesNotThrow(() => parseDefinition(fixture));
});
