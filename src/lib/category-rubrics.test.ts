import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORY_RUBRICS, CONTENT_CATEGORY_IDS, categoryAxisLabels } from "./category-rubrics.js";

const counts: Record<string, number> = {
  reporting: 5, announcement: 5, explanation: 5, opinion: 5,
  investigation: 7, guide: 6, experience_review: 5, sales: 5,
  reference: 5, discussion: 5, creative: 4,
};

test("catalog contains exactly the approved eleven categories and item counts", () => {
  assert.equal(CONTENT_CATEGORY_IDS.length, 11);
  assert.deepEqual(Object.keys(CATEGORY_RUBRICS).sort(), [...CONTENT_CATEGORY_IDS].sort());
  for (const id of CONTENT_CATEGORY_IDS) assert.equal(CATEGORY_RUBRICS[id].items.length, counts[id], id);
});

test("every basic and conditional question is atomic, bilingual, and fully mapped", () => {
  const verdicts = ["pass", "review", "alert", "not_applicable"];
  for (const id of CONTENT_CATEGORY_IDS) {
    const rubric = CATEGORY_RUBRICS[id];
    assert.ok(rubric.label.ja && rubric.label.en);
    const all = [...rubric.items, ...rubric.conditionalProbes];
    const ids = all.map(({ id: itemId }) => itemId);
    assert.equal(new Set(ids).size, ids.length, `${id} duplicate IDs`);
    for (const entry of all) {
      assert.ok(entry.id.startsWith(`${id}_`), entry.id);
      assert.ok(entry.label.ja && entry.label.en, entry.id);
      assert.ok(entry.axisKey);
      assert.ok(entry.axisLabel.ja && entry.axisLabel.en, entry.id);
      assert.ok(entry.instruction.length > 10, entry.id);
      assert.equal(typeof entry.required, "boolean", entry.id);
      assert.deepEqual(Object.keys(entry.criteria).sort(), [...verdicts].sort(), entry.id);
      assert.ok(entry.criteria.pass.includes(entry.instruction), `${entry.id} pass criterion is not specific`);
      assert.ok(entry.criteria.review.includes(entry.instruction), `${entry.id} review criterion is not specific`);
      assert.ok(entry.criteria.alert.includes(entry.instruction), `${entry.id} alert criterion is not specific`);
      assert.ok(entry.criteria.not_applicable.includes(entry.instruction), `${entry.id} N/A criterion is not specific`);
      assert.match(entry.criteria.review, /Review/);
      assert.match(entry.criteria.alert, /Alert/);
      if (entry.required) {
        assert.match(entry.criteria.not_applicable, /required for the selected category/);
        assert.match(entry.criteria.not_applicable, /never N\/A/);
      } else {
        assert.match(entry.criteria.not_applicable, /N\/A only when the specific feature/);
      }
    }
    const allCriterionTexts = all.flatMap((entry) => Object.values(entry.criteria));
    assert.equal(new Set(allCriterionTexts).size, allCriterionTexts.length, `${id} has generic repeated criteria`);
    for (const conditional of rubric.conditionalProbes) {
      assert.ok(conditional.trigger.question.endsWith("?"), conditional.id);
      assert.ok(conditional.trigger.instruction.includes("body"), conditional.id);
      assert.doesNotMatch(conditional.trigger.question, /,/, `${conditional.id} trigger must test one content feature`);
      assert.doesNotMatch(conditional.trigger.question, /https?:|\.com|\.org|host|domain/i, conditional.id);
    }
    assert.ok(categoryAxisLabels(id).length >= 4 && categoryAxisLabels(id).length <= 6, `${id} axis count`);
  }
});

test("conditional probes are separate from basic item sets", () => {
  for (const id of CONTENT_CATEGORY_IDS) {
    const rubric = CATEGORY_RUBRICS[id];
    assert.ok(rubric.conditionalProbes.length > 0, id);
    assert.ok(rubric.conditionalProbes.every((entry) => "trigger" in entry), id);
    assert.ok(rubric.items.every((entry) => !("trigger" in entry)), id);
  }
});

test("documented content-trigger classes have distinct atomic probes on bounded existing axes", () => {
  const requiredProbeIds = [
    "reporting_serious_allegation", "reporting_numeric_conclusion",
    "announcement_provider_comparison", "announcement_external_endorsement",
    "explanation_forecast", "explanation_group_comparison", "explanation_period_comparison", "opinion_policy_causality",
    "investigation_causal_effect", "investigation_restricted_data", "investigation_special_exclusions",
    "guide_data_deletion", "guide_payment", "guide_permission_change",
    "experience_review_free_product", "experience_review_compensation", "experience_review_referral_fee", "experience_review_performance_difference",
    "sales_health_finance_claim", "sales_scarcity_claim", "sales_endorsement",
    "reference_deprecation_notice", "reference_unit_variants", "reference_region_variants",
    "discussion_accepted_answer_old", "discussion_version_dependent",
    "creative_real_event", "creative_purchase_call", "creative_voting_call", "creative_efficacy_claim",
  ];
  const probes = CONTENT_CATEGORY_IDS.flatMap((category) => CATEGORY_RUBRICS[category].conditionalProbes);
  const byId = new Map(probes.map((entry) => [entry.id, entry]));
  for (const id of requiredProbeIds) assert.ok(byId.has(id), `missing conditional probe ${id}`);
  for (const entry of probes) {
    assert.doesNotMatch(entry.trigger.question, /,/, `${entry.id} must trigger on one feature`);
    assert.ok(entry.axisKey.length > 0, `${entry.id} must map to an axis`);
  }
});

test("known optional evidence is N/A only when its feature is absent", () => {
  const optional = ["reference_examples", "discussion_sources", "sales_claims"];
  for (const id of optional) {
    const entry = CONTENT_CATEGORY_IDS.flatMap((category) => CATEGORY_RUBRICS[category].items).find((item) => item.id === id);
    assert.ok(entry, `missing ${id}`);
    assert.equal(entry.required, false, id);
    assert.match(entry.criteria.not_applicable, /N\/A only when the specific feature/);
  }
});
