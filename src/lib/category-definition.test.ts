import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseDefinition } from "../../runner/definition.js";
import {
  CATEGORY_DEFINITION_VERSION,
  allCategoryChecks,
  buildCategoryDefinition,
  checksForCategory,
  triggerChecksForCategory,
  type CategoryTriggerAnswer,
} from "./category-definition.js";
import { CATEGORY_RUBRICS, CONTENT_CATEGORY_IDS } from "./category-rubrics.js";
import { DEFAULT_SETTINGS, setupGap } from "./settings.js";

const articleGuard = { path: "hasArticle", op: "equals", value: true };

test("category checks compile all catalog items to verdict and exact-citation choices", () => {
  const checks = allCategoryChecks();
  const ids = checks.map((check) => check.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const categoryId of CONTENT_CATEGORY_IDS) {
    const entries = [...CATEGORY_RUBRICS[categoryId].items, ...CATEGORY_RUBRICS[categoryId].conditionalProbes];
    const categoryChecks = checksForCategory(categoryId);
    assert.equal(categoryChecks.length, entries.length * 2, categoryId);
    for (const entry of entries) {
      const verdict = categoryChecks.find((check) => check.id === entry.id);
      const cite = categoryChecks.find((check) => check.id === `${entry.id}_cite`);
      assert.ok(verdict, entry.id);
      assert.ok(cite, entry.id);
      assert.deepEqual(verdict.applyWhen, articleGuard);
      assert.deepEqual(cite.applyWhen, articleGuard);
      assert.equal(verdict.type, "choice");
      assert.equal(verdict.confidenceFloor, 0.6);
      assert.deepEqual(Object.keys(verdict.criteria).sort(), ["alert", "not_applicable", "pass", "review"]);
      assert.deepEqual(verdict.options, {
        pass: "pass",
        review: "review",
        alert: "fail",
        not_applicable: entry.required ? "review" : "not_applicable",
      });
      assert.equal(verdict.required, entry.required);
      assert.equal(cite.citeFor, entry.id);
      assert.deepEqual(cite.criteria, { none: "No single sentence bears on this criterion." });
      assert.equal(typeof cite.instructions, "string");
      assert.match(cite.instructions as string, /exact sentence cut from the main body/);
      assert.equal(cite.required, entry.required);
    }
  }
});

test("compiled category verdict and citation questions satisfy the runner definition contract", () => {
  const parsed = parseDefinition({
    id: "category-rubrics",
    version: 1,
    subject: "Body checks selected by content category.",
    approval: { status: "approved", at: "2026-09-23T00:00:00Z", by: "test" },
    questions: allCategoryChecks().map(({ categoryId: _categoryId, rubricItemId: _rubricItemId, questionKind: _questionKind, required: _required, ...check }) => check),
  });
  assert.equal(parsed.questions.length, allCategoryChecks().length);
  assert.ok(parsed.questions.every((check) => check.applyWhen?.path === "hasArticle"));
});

test("a category wording change bumps the definition and asks for the whole list again", () => {
  const base = parseDefinition(JSON.parse(readFileSync(new URL("../../fixtures/page-credibility.checker.json", import.meta.url), "utf8")));
  const definition = buildCategoryDefinition(base);
  assert.equal(CATEGORY_DEFINITION_VERSION, 10);
  assert.equal(definition.version, 10);
  assert.equal(setupGap({ ...DEFAULT_SETTINGS, ackedVersion: 9, apiKey: "sk" }, definition.version), "approval");
  assert.equal(setupGap({ ...DEFAULT_SETTINGS, ackedVersion: definition.version, apiKey: "sk" }, definition.version), null);
  assert.equal(setupGap({ ...DEFAULT_SETTINGS, ackedVersion: null, apiKey: "sk" }, definition.version), "approval");
});

test("conditional trigger questions return yes, no, or unclear outside the verdict checks", () => {
  const answers: readonly CategoryTriggerAnswer[] = ["yes", "no", "unclear"];
  for (const id of CONTENT_CATEGORY_IDS) {
    const triggers = triggerChecksForCategory(id);
    assert.equal(triggers.length, CATEGORY_RUBRICS[id].conditionalProbes.length, id);
    for (const trigger of triggers) {
      assert.equal(trigger.type, "choice");
      assert.equal(trigger.categoryId, id);
      assert.ok(trigger.rubricItemId.startsWith(`${id}_`));
      assert.ok(trigger.question.endsWith("?"));
      assert.match(trigger.instructions, /body/i);
      assert.deepEqual(Object.keys(trigger.choices).sort(), [...answers].sort());
      assert.equal(trigger.confidenceFloor, 0.6);
      assert.equal("options" in trigger, false, "routing answers must not cast a verdict");
    }
    const verdictIds = new Set(checksForCategory(id).map((check) => check.id));
    assert.equal(triggers.some((trigger) => verdictIds.has(trigger.id)), false);
  }
});
