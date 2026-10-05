import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { buildCategoryDefinition } from "./category-definition.js";
import { parseDefinition, replayGateway, type CheckReport } from "./checkkit.js";
import { caseFromRecord, gradeCase, meanInterval, parseEvalCase, snapshotForCase, splitFor, type EvalCase } from "./eval-case.js";
import type { ReplayFixture } from "./replay.js";
import { checkSnapshot } from "./run-check.js";

const definition = buildCategoryDefinition(parseDefinition(JSON.parse(readFileSync(new URL("../../fixtures/page-credibility.checker.json", import.meta.url), "utf8"))));
const casesDir = new URL("../../eval/cases/", import.meta.url);
const cases = readdirSync(casesDir).filter((name) => name.endsWith(".json")).map((name) => parseEvalCase(JSON.parse(readFileSync(new URL(name, casesDir), "utf8")), name));

function report(items: Record<string, CheckReport["items"][number]["verdict"]>, primary?: string): CheckReport {
  return {
    definition: { id: "x" as any, version: 10 },
    items: Object.entries(items).map(([id, verdict]) => ({ id: id as any, verdict, reason: "" })),
    usage: { input_tokens: 0, output_tokens: 0 },
    timing: { wallMs: 0, jevMs: 0 },
    ...(primary ? { classification: { status: "classified" as const, primary } } : {}),
  };
}

const sample: EvalCase = parseEvalCase({
  id: "sample",
  tags: [],
  source: "test",
  labeledBy: "human",
  snapshot: { url: "https://a.example/", text: "" },
  expected: { items: { named: "pass", hidden: ["review", "fail"], sale: "fail" }, category: "sales" },
});

test("every case in eval/cases parses and has a stable split", () => {
  assert.ok(cases.length > 0);
  for (const evalCase of cases) assert.equal(splitFor(evalCase.id), splitFor(evalCase.id));
  assert.deepEqual(new Set(cases.map((evalCase) => evalCase.id)).size, cases.length);
});

test("parseEvalCase rejects an unknown verdict", () => {
  assert.throws(() => parseEvalCase({ ...sample, expected: { items: { named: "green" } } }));
});

test("an oracle report scores 1 and a report of errors scores 0", () => {
  const oracle = gradeCase(sample, report({ named: "pass", hidden: "review", sale: "fail" }, "sales"));
  assert.deepEqual(oracle.grade, { verdict_acc: 1, all_correct: 1, false_pass: 0, false_alert: 0, error_items: 0, category_ok: 1 });
  const broken = gradeCase(sample, report({ named: "error", hidden: "error", sale: "error" }));
  assert.equal(broken.grade.verdict_acc, 0);
  assert.equal(broken.grade.error_items, 3);
  assert.equal(broken.grade.category_ok, 0);
});

test("passing a risky item counts as a false pass, alerting a safe one as a false alert", () => {
  const { grade, mismatches } = gradeCase(sample, report({ named: "fail", hidden: "pass", sale: "pass" }, "sales"));
  assert.equal(grade.false_pass, 2);
  assert.equal(grade.false_alert, 1);
  assert.equal(grade.all_correct, 0);
  assert.equal(mismatches.length, 3);
});

test("the replay fixtures meet the seed labels through the real check", async () => {
  for (const evalCase of cases.filter((item) => item.source === "fixture")) {
    const name = evalCase.id.replace(/^fixture-/, "");
    const replay = JSON.parse(readFileSync(new URL(`../../fixtures/replay/page-credibility-${name}.json`, import.meta.url), "utf8")) as ReplayFixture;
    const result = await checkSnapshot(snapshotForCase(evalCase), definition, replayGateway(replay.answers, replay.usage));
    const { grade, mismatches } = gradeCase(evalCase, result);
    assert.equal(grade.verdict_acc, 1, `${evalCase.id}: ${mismatches.join("; ")}`);
  }
});

test("a gateway that answers nothing scores 0 on every seed case", async () => {
  for (const evalCase of cases.filter((item) => Object.keys(item.expected.items).length > 0)) {
    const result = await checkSnapshot(snapshotForCase(evalCase), definition, replayGateway({}));
    assert.equal(gradeCase(evalCase, result).grade.false_pass, 0);
    assert.ok(gradeCase(evalCase, result).grade.verdict_acc < 1, evalCase.id);
  }
});

test("meanInterval brackets the mean and an exported case carries no labels", () => {
  const interval = meanInterval([1, 0, 1, 1]);
  assert.equal(interval.mean, 0.75);
  assert.ok(interval.lo < 0.75 && interval.hi > 0.75);
  const exported = caseFromRecord({ id: "abc", tabId: 1, createdAt: "2026-10-05T00:00:00Z", snapshot: { ...snapshotForCase(sample), language: "ja", extractedAt: "x" } as any, report: report({ named: "pass" }) }, "a-example");
  assert.deepEqual(exported.expected, { items: {} });
  assert.equal(exported.labeledBy, "draft");
  assert.equal("extractedAt" in exported.snapshot, false);
});
