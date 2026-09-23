import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildCategoryDefinition } from "./category-definition.js";
import { CONTENT_CATEGORY_IDS } from "./category-rubrics.js";
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
  laneRemarkLines,
  worstVerdict,
} from "./groups.js";

const base = parseDefinition(
  JSON.parse(readFileSync(new URL("../../fixtures/page-credibility.checker.json", import.meta.url), "utf8")),
);
const definition = buildCategoryDefinition(base);
const siteIds = siteQuestionIds(definition.questions);
const bodyIds = bodyQuestionIds(definition.questions);
const sampleBody = ["reporting_event_time", "reporting_attribution", "reporting_verification"];
const item = (id: string, verdict: Verdict) => ({ id, verdict });

test("the checker fixture is the site checklist and the body lane is the category catalog", () => {
  assert.equal(base.version, 10);
  assert.equal(definition.version, 10);
  assert.deepEqual(siteQuestionIds(base.questions), ["identifiable_publisher", "honest_identity", "site_purpose", "disclosed_incentives"]);
  assert.deepEqual(bodyQuestionIds(base.questions), []);
  assert.equal(base.questions.some((question) => question.id === "evidence_for_claims"), false);
  assert.deepEqual(siteIds, ["identifiable_publisher", "honest_identity", "site_purpose", "disclosed_incentives"]);
  assert.equal(bodyIds.includes("evidence_for_claims"), false);
  assert.equal(bodyIds.includes("reporting_event_time"), true);
  assert.equal(bodyIds.every((id) => CONTENT_CATEGORY_IDS.some((category) => id.startsWith(`${category}_`))), true);
  assert.equal(citeQuestionIds(base.questions).length, 4);
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
    item("reporting_event_time", "fail"),
    item("reporting_attribution", "pass"),
  ];
  assert.equal(worstVerdict(items, siteIds), "review");
  assert.equal(worstVerdict(items, sampleBody), "fail");
  assert.equal(worstVerdict([item("reporting_attribution", "not_applicable")], sampleBody), "not_applicable");
});

test("laneRemarkLines keeps the worst three remarks and skips not-applicable while another verdict exists", () => {
  const items = [
    item("identifiable_publisher", "pass"),
    item("honest_identity", "fail"),
    item("site_purpose", "review"),
    item("disclosed_incentives", "pass"),
    item("evidence_for_claims", "not_applicable"),
  ];
  assert.deepEqual(laneRemarkLines(items, [...siteIds, ...bodyIds], (id, verdict) => `${id}:${verdict}`), [
    "honest_identity:fail",
    "site_purpose:review",
    "disclosed_incentives:pass",
  ]);
  assert.deepEqual(laneRemarkLines(items, ["evidence_for_claims"], (id, verdict) => `${verdict}:${id}`), [
    "not_applicable:evidence_for_claims",
  ]);
  assert.deepEqual(laneRemarkLines(items, siteIds, () => "same"), ["same"]);
  assert.deepEqual(laneRemarkLines(items, siteIds, () => "  "), []);
});

test("worseVerdict compares two verdicts without inventing question ids", () => {
  assert.equal(worseVerdict("pass", "fail"), "fail");
  assert.equal(worseVerdict("review", "error"), "error");
  assert.equal(worseVerdict("fail", "error"), "fail");
});

test("withholdBodyPassOnTruncation turns body pass into review and leaves fail and site pass", () => {
  const items: ItemResult[] = [
    { id: "identifiable_publisher" as ItemResult["id"], verdict: "pass", reason: "noul 0.9 is at or above passAt 0.8" },
    { id: "reporting_event_time" as ItemResult["id"], verdict: "pass", reason: "choice pass maps to pass" },
    { id: "reporting_attribution" as ItemResult["id"], verdict: "fail", reason: "choice alert maps to fail" },
    { id: "reporting_verification" as ItemResult["id"], verdict: "review", reason: "choice review maps to review" },
  ];
  const withheld = withholdBodyPassOnTruncation(items, true, sampleBody);
  assert.equal(withheld.find((entry) => entry.id === "identifiable_publisher")?.verdict, "pass");
  assert.equal(withheld.find((entry) => entry.id === "reporting_event_time")?.verdict, "review");
  assert.match(withheld.find((entry) => entry.id === "reporting_event_time")?.reason ?? "", /character limit/);
  assert.equal(withheld.find((entry) => entry.id === "reporting_attribution")?.verdict, "fail");
  assert.equal(withheld.find((entry) => entry.id === "reporting_verification")?.verdict, "review");
  assert.deepEqual(withholdBodyPassOnTruncation(items, false, sampleBody), items);
});

test("softenSynthesisErrors turns body errors into review", () => {
  const items: ItemResult[] = [
    { id: "identifiable_publisher" as ItemResult["id"], verdict: "error", reason: "timeout" },
    { id: "reporting_event_time" as ItemResult["id"], verdict: "error", reason: "timeout" },
  ];
  const softened = softenSynthesisErrors(items, sampleBody);
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

test("mergeConservativeItem keeps the origin attached to the selected citation", () => {
  const first: ItemResult = {
    id: "self_consistent" as ItemResult["id"],
    verdict: "pass",
    reason: "pass",
    cite: "The first date.",
    citeSource: "jev",
    citeLocation: "body",
  };
  const stricter: ItemResult = {
    id: "self_consistent" as ItemResult["id"],
    verdict: "review",
    reason: "review",
    cite: "A related date.",
    citeSource: "related",
    citeLocation: "metaDescription",
  };
  assert.equal(mergeConservativeItem([first, stricter]).cite, "A related date.");
  assert.equal(mergeConservativeItem([first, stricter]).citeSource, "related");
  assert.equal(mergeConservativeItem([first, stricter]).citeLocation, "metaDescription");
  const noCite: ItemResult = {
    id: "self_consistent" as ItemResult["id"],
    verdict: "review",
    reason: "review without a citation",
  };
  assert.equal(mergeConservativeItem([noCite, first]).cite, "The first date.");
  assert.equal(mergeConservativeItem([noCite, first]).citeSource, "jev");
  assert.equal(mergeConservativeItem([noCite, first]).citeLocation, "body");
});
