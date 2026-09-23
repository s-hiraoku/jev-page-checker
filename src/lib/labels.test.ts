import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseDefinition, type JevAnswer, type Verdict } from "./checkkit.js";
import { REMARK_IDS, basisEntries, basisKey, basisLabel, evidenceReadout, instructionLabel, verdictRemark } from "./labels.js";

function choiceAnswer(choice: string, confidence = 1): JevAnswer {
  return { type: "choice", choice, confidence, probabilities: { [choice]: confidence } };
}

function scoreAnswer(score: number, confidence = 1): JevAnswer {
  return { type: "score", score, confidence, legend: {}, probabilities: {} };
}

test("basisKey follows the same noul, choice, and score branches as answerBasis", () => {
  assert.equal(basisKey({ type: "noul", noul: 0.91 }), "true");
  assert.equal(basisKey({ type: "noul", noul: 0.4 }), "false");
  assert.equal(basisKey(choiceAnswer("opinion_analysis")), "opinion_analysis");
  assert.equal(basisKey(scoreAnswer(0.92, 0.83)), "1");
  assert.equal(basisKey(undefined), undefined);
});

test("basisLabel follows the settings locale and keeps English as the Jev rubric", () => {
  const pass = { type: "noul" as const, noul: 0.91 };
  assert.match(basisLabel("identifiable_publisher", pass, "en"), /identifiable as responsible/);
  assert.match(basisLabel("identifiable_publisher", pass, "ja"), /責任者として分かる/);
  assert.equal(
    basisLabel("identifiable_publisher", pass, "en"),
    "A specific organization, publication, platform-plus-author, or named person is identifiable as responsible.",
  );
});

test("English basis labels stay the checker criteria, not a rewritten rubric", () => {
  const definition = parseDefinition(JSON.parse(readFileSync("fixtures/page-credibility.checker.json", "utf8")));
  for (const check of definition.questions) {
    if (check.type === "noul") {
      assert.equal(basisLabel(check.id, { type: "noul", noul: 0.9 }, "en"), check.criteria?.true);
      assert.equal(basisLabel(check.id, { type: "noul", noul: 0.1 }, "en"), check.criteria?.false);
    }
    if (check.type === "choice") {
      for (const key of Object.keys(check.criteria)) {
        assert.equal(basisLabel(check.id, choiceAnswer(key), "en"), check.criteria[key]);
      }
    }
    if (check.type === "score") {
      check.criteria.forEach((text, index) => {
        assert.equal(basisLabel(check.id, scoreAnswer(index), "en"), text);
      });
    }
  }
});

test("evidenceReadout states a short remark for that question and that verdict", () => {
  const readout = evidenceReadout(
    "identifiable_publisher",
    "fail",
    "ja",
    "No study, author, or manufacturer is named.",
  );
  assert.equal(readout.verdict, "警告");
  assert.equal(readout.remark, "ページの責任者を特定できない。");
  assert.equal(readout.remark.includes("責任者として分かる"), false);
  assert.equal(readout.remark.includes("匿名"), false);
  assert.match(readout.sentence, /manufacturer is named/);

  const verdicts: Verdict[] = ["pass", "review", "fail", "error", "not_applicable"];
  for (const id of REMARK_IDS) {
    const paragraphs = [...basisEntries(id, "ja"), ...basisEntries(id, "en")].map((entry) => entry.text);
    for (const verdict of verdicts) {
      for (const locale of ["ja", "en"] as const) {
        const remark = verdictRemark(id, verdict, locale);
        assert.ok(remark.length > 0, `${id} ${verdict} ${locale}`);
        assert.equal(paragraphs.includes(remark), false, `${id} ${verdict} ${locale}`);
      }
    }
  }
});

test("basisLabel falls back to the stored English basis when the answer is missing", () => {
  assert.equal(basisLabel("identifiable_publisher", undefined, "ja", "stored"), "stored");
});

test("checklist instructions follow the locale and English stays the definition text", () => {
  const definition = parseDefinition(JSON.parse(readFileSync("fixtures/page-credibility.checker.json", "utf8")));
  for (const check of definition.questions) {
    const source = typeof check.instructions === "string" ? check.instructions : "";
    assert.equal(instructionLabel(check.id, "en", source), source);
    const japanese = instructionLabel(check.id, "ja", source);
    assert.notEqual(japanese, source);
    assert.match(japanese, /\p{Script=Han}/u);
    assert.ok(basisEntries(check.id, "ja").length > 0);
    assert.ok(basisEntries(check.id, "en").length > 0);
  }
});
