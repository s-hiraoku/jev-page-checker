import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseDefinition } from "./checkkit.js";
import { basisKey, basisLabel } from "./labels.js";

test("basisKey follows the same noul, choice, and score branches as answerBasis", () => {
  assert.equal(basisKey({ type: "noul", noul: 0.91 }), "true");
  assert.equal(basisKey({ type: "noul", noul: 0.4 }), "false");
  assert.equal(basisKey({ type: "choice", choice: "opinion_analysis", confidence: 1 }), "opinion_analysis");
  assert.equal(basisKey({ type: "score", score: 0.92, confidence: 0.83 }), "1");
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
        assert.equal(basisLabel(check.id, { type: "choice", choice: key, confidence: 1 }, "en"), check.criteria[key]);
      }
    }
    if (check.type === "score") {
      check.criteria.forEach((text, index) => {
        assert.equal(basisLabel(check.id, { type: "score", score: index, confidence: 1 }, "en"), text);
      });
    }
  }
});

test("basisLabel falls back to the stored English basis when the answer is missing", () => {
  assert.equal(basisLabel("identifiable_publisher", undefined, "ja", "stored"), "stored");
});
