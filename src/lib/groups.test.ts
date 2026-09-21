import assert from "node:assert/strict";
import { test } from "node:test";
import type { ItemResult, Verdict } from "./checkkit.js";
import { mergeConservativeItem, PAGE_QUESTION_IDS, SITE_QUESTION_IDS, withholdBodyPassOnTruncation, worstVerdict } from "./groups.js";

const item = (id: string, verdict: Verdict) => ({ id, verdict });

test("worstVerdict prefers fail over review over pass and ignores the other lane", () => {
  const items = [
    item("identifiable_publisher", "pass"),
    item("honest_identity", "pass"),
    item("site_purpose", "review"),
    item("disclosed_incentives", "pass"),
    item("evidence_for_claims", "fail"),
    item("self_consistent", "pass"),
  ];
  assert.equal(worstVerdict(items, SITE_QUESTION_IDS), "review");
  assert.equal(worstVerdict(items, PAGE_QUESTION_IDS), "fail");
  assert.equal(worstVerdict([item("self_consistent", "not_applicable")], PAGE_QUESTION_IDS), "not_applicable");
});

test("withholdBodyPassOnTruncation turns body pass into review and leaves fail and site pass", () => {
  const items: ItemResult[] = [
    { id: "identifiable_publisher" as ItemResult["id"], verdict: "pass", reason: "noul 0.9 is at or above passAt 0.8" },
    { id: "evidence_for_claims" as ItemResult["id"], verdict: "pass", reason: "score 1.8 is at or above passAt 1.5" },
    { id: "self_consistent" as ItemResult["id"], verdict: "fail", reason: "noul 0.1 is at or below failAt 0.2" },
    { id: "unsourced_specifics" as ItemResult["id"], verdict: "review", reason: "choice some maps to review" },
  ];
  const withheld = withholdBodyPassOnTruncation(items, true);
  assert.equal(withheld.find((entry) => entry.id === "identifiable_publisher")?.verdict, "pass");
  assert.equal(withheld.find((entry) => entry.id === "evidence_for_claims")?.verdict, "review");
  assert.match(withheld.find((entry) => entry.id === "evidence_for_claims")?.reason ?? "", /character limit/);
  assert.equal(withheld.find((entry) => entry.id === "self_consistent")?.verdict, "fail");
  assert.equal(withheld.find((entry) => entry.id === "unsourced_specifics")?.verdict, "review");
  assert.deepEqual(withholdBodyPassOnTruncation(items, false), items);
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
