import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseDefinition, type ItemResult, type Verdict } from "./checkkit.js";
import {
  bodyQuestionIds,
  bodySendKind,
  citeQuestionIds,
  isBodyQuestion,
  isCiteQuestion,
  mergeConservativeItem,
  siteQuestionIds,
  softenSynthesisErrors,
  withholdBodyPassOnTruncation,
  worseVerdict,
  worstVerdict,
} from "./groups.js";

const definition = parseDefinition(
  JSON.parse(readFileSync(new URL("../../fixtures/page-credibility.checker.json", import.meta.url), "utf8")),
);
const siteIds = siteQuestionIds(definition.questions);
const bodyIds = bodyQuestionIds(definition.questions);
const item = (id: string, verdict: Verdict) => ({ id, verdict });

test("site and body lanes come from hasArticle applyWhen, not restated ids", () => {
  assert.deepEqual(siteIds, ["identifiable_publisher", "honest_identity", "site_purpose", "disclosed_incentives"]);
  assert.deepEqual(bodyIds, [
    "evidence_for_claims",
    "separates_fact_and_opinion",
    "unsourced_specifics",
    "self_consistent",
    "certainty_matches_evidence",
  ]);
  assert.equal(siteIds.length + bodyIds.length, 9);
  assert.equal(citeQuestionIds(definition.questions).length, 9);
  for (const question of definition.questions) {
    const inBodyLane = isBodyQuestion(question.applyWhen) && !isCiteQuestion(question);
    assert.equal(inBodyLane, bodyIds.includes(question.id));
  }
});

test("worstVerdict prefers fail over review over pass and ignores the other lane", () => {
  const items = [
    item("identifiable_publisher", "pass"),
    item("honest_identity", "pass"),
    item("site_purpose", "review"),
    item("disclosed_incentives", "pass"),
    item("evidence_for_claims", "fail"),
    item("self_consistent", "pass"),
  ];
  assert.equal(worstVerdict(items, siteIds), "review");
  assert.equal(worstVerdict(items, bodyIds), "fail");
  assert.equal(worstVerdict([item("self_consistent", "not_applicable")], bodyIds), "not_applicable");
});

test("worseVerdict compares two verdicts without inventing question ids", () => {
  assert.equal(worseVerdict("pass", "fail"), "fail");
  assert.equal(worseVerdict("review", "error"), "error");
  assert.equal(worseVerdict("fail", "error"), "fail");
});

test("withholdBodyPassOnTruncation turns body pass into review and leaves fail and site pass", () => {
  const items: ItemResult[] = [
    { id: "identifiable_publisher" as ItemResult["id"], verdict: "pass", reason: "noul 0.9 is at or above passAt 0.8" },
    { id: "evidence_for_claims" as ItemResult["id"], verdict: "pass", reason: "score 1.8 is at or above passAt 1.5" },
    { id: "self_consistent" as ItemResult["id"], verdict: "fail", reason: "noul 0.1 is at or below failAt 0.2" },
    { id: "unsourced_specifics" as ItemResult["id"], verdict: "review", reason: "choice some maps to review" },
  ];
  const withheld = withholdBodyPassOnTruncation(items, true, bodyIds);
  assert.equal(withheld.find((entry) => entry.id === "identifiable_publisher")?.verdict, "pass");
  assert.equal(withheld.find((entry) => entry.id === "evidence_for_claims")?.verdict, "review");
  assert.match(withheld.find((entry) => entry.id === "evidence_for_claims")?.reason ?? "", /character limit/);
  assert.equal(withheld.find((entry) => entry.id === "self_consistent")?.verdict, "fail");
  assert.equal(withheld.find((entry) => entry.id === "unsourced_specifics")?.verdict, "review");
  assert.deepEqual(withholdBodyPassOnTruncation(items, false, bodyIds), items);
});

test("softenSynthesisErrors turns body errors into review", () => {
  const items: ItemResult[] = [
    { id: "identifiable_publisher" as ItemResult["id"], verdict: "error", reason: "timeout" },
    { id: "self_consistent" as ItemResult["id"], verdict: "error", reason: "timeout" },
  ];
  const softened = softenSynthesisErrors(items, bodyIds);
  assert.equal(softened[0]?.verdict, "error");
  assert.equal(softened[1]?.verdict, "review");
});

test("bodySendKind reads recorded inspection instead of re-splitting text", () => {
  assert.equal(bodySendKind(undefined), "whole");
  assert.equal(
    bodySendKind({ windowCount: 3, covered: true, unreadRemainder: false, siteQuestionIds: siteIds, bodyQuestionIds: bodyIds }),
    "chunked",
  );
  assert.equal(
    bodySendKind({ windowCount: 8, covered: false, unreadRemainder: true, siteQuestionIds: siteIds, bodyQuestionIds: bodyIds }),
    "unread",
  );
});

test("mergeConservativeItem keeps fail over a later pass", () => {
  const fail: ItemResult = {
    id: "self_consistent" as ItemResult["id"],
    verdict: "fail",
    reason: "noul 0.1 is at or below failAt 0.2",
  };
  const pass: ItemResult = {
    id: "self_consistent" as ItemResult["id"],
    verdict: "pass",
    reason: "noul 0.9 is at or above passAt 0.8",
  };
  assert.equal(mergeConservativeItem([pass, fail]).verdict, "fail");
  assert.equal(mergeConservativeItem([fail, pass]).verdict, "fail");
  assert.equal(mergeConservativeItem([pass, { ...pass, verdict: "review", reason: "between" }]).verdict, "review");
});

test("mergeConservativeItem keeps a page sentence when the stricter window has none", () => {
  const cited: ItemResult = {
    id: "evidence_for_claims" as ItemResult["id"],
    verdict: "pass",
    reason: "score 1.8 is at or above passAt 1.5",
    cite: "The bureau posted the memo.",
  };
  const bare: ItemResult = {
    id: "evidence_for_claims" as ItemResult["id"],
    verdict: "fail",
    reason: "score 0.2 is at or below failAt 0.5",
  };
  assert.equal(mergeConservativeItem([cited, bare]).verdict, "fail");
  assert.equal(mergeConservativeItem([cited, bare]).cite, "The bureau posted the memo.");
  const caused: ItemResult = { ...bare, cite: "A conflicting date." };
  assert.equal(mergeConservativeItem([caused, cited]).verdict, "fail");
  assert.equal(mergeConservativeItem([caused, cited]).cite, "A conflicting date.");
});
