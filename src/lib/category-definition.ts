import type { ChoiceCheck, MappedVerdict, QuestionId } from "../../runner/types.js";
import type { ApprovedDefinition, Check } from "../../runner/types.js";
import {
  CATEGORY_RUBRICS,
  CONTENT_CATEGORY_IDS,
  type CategoryRubricItem,
  type ConditionalProbe,
  type ContentCategoryId,
} from "./category-rubrics.js";

export type CategoryQuestionKind = "verdict" | "cite";

/** Additional catalog provenance retained beside runner-compatible checks. */
export interface CategoryQuestionMetadata {
  categoryId: ContentCategoryId;
  rubricItemId: string;
  questionKind: CategoryQuestionKind;
  /** Preserved for the integrator: required criteria must not silently become N/A. */
  required: boolean;
}

export type CategoryVerdictCheck = ChoiceCheck & CategoryQuestionMetadata & { questionKind: "verdict" };
export type CategoryCiteCheck = ChoiceCheck & CategoryQuestionMetadata & { questionKind: "cite" };
export type CategoryCheck = CategoryVerdictCheck | CategoryCiteCheck;

export type CategoryTriggerAnswer = "yes" | "no" | "unclear";

/** A routing question, deliberately separate from the verdict lane. */
export interface CategoryTriggerCheck {
  id: QuestionId;
  type: "choice";
  categoryId: ContentCategoryId;
  rubricItemId: string;
  question: string;
  instructions: string;
  choices: Readonly<Record<CategoryTriggerAnswer, string>>;
  confidenceFloor: 0.6;
  required: boolean;
}

const APPLY_TO_ARTICLE = { path: "hasArticle", op: "equals", value: true } as const;
const CHOICE_VERDICTS: Readonly<Record<string, MappedVerdict>> = {
  pass: "pass",
  review: "review",
  alert: "fail",
};

function verdictCheck(categoryId: ContentCategoryId, entry: CategoryRubricItem): CategoryVerdictCheck {
  const id = entry.id as QuestionId;
  const options: Record<string, MappedVerdict> = {
    ...CHOICE_VERDICTS,
    not_applicable: entry.required ? "review" : "not_applicable",
  };
  return {
    id,
    type: "choice",
    instructions: `${entry.label.en}. ${entry.instruction}`,
    criteria: {
      pass: entry.criteria.pass,
      review: entry.criteria.review,
      alert: entry.criteria.alert,
      not_applicable: entry.criteria.not_applicable,
    },
    options,
    confidenceFloor: 0.6,
    applyWhen: APPLY_TO_ARTICLE,
    categoryId,
    rubricItemId: entry.id,
    questionKind: "verdict",
    required: entry.required,
  };
}

function citeCheck(categoryId: ContentCategoryId, entry: CategoryRubricItem): CategoryCiteCheck {
  return {
    id: `${entry.id}_cite` as QuestionId,
    type: "choice",
    citeFor: entry.id as QuestionId,
    instructions: `Choose the one exact sentence cut from the main body that best supports or causes the answer to “${entry.label.en}.” Choose none only when no sentence bears on this criterion. Do not write or paraphrase a sentence.`,
    criteria: { none: "No single sentence bears on this criterion." },
    options: { none: "pass" },
    applyWhen: APPLY_TO_ARTICLE,
    categoryId,
    rubricItemId: entry.id,
    questionKind: "cite",
    required: entry.required,
  };
}

function allItems(categoryId: ContentCategoryId): readonly CategoryRubricItem[] {
  const rubric = CATEGORY_RUBRICS[categoryId];
  return [...rubric.items, ...rubric.conditionalProbes];
}

function checksForItem(categoryId: ContentCategoryId, entry: CategoryRubricItem): CategoryCheck[] {
  return [verdictCheck(categoryId, entry), citeCheck(categoryId, entry)];
}

function triggerAsCheck(trigger: CategoryTriggerCheck): ChoiceCheck {
  return {
    id: trigger.id,
    type: "choice",
    instructions: trigger.instructions,
    criteria: trigger.choices,
    options: { yes: "pass", no: "pass", unclear: "review" },
    confidenceFloor: trigger.confidenceFloor,
    applyWhen: APPLY_TO_ARTICLE,
  };
}

/** Verdict and exact body-citation questions for every item in one category. */
export function checksForCategory(id: ContentCategoryId): readonly CategoryCheck[] {
  return allItems(id).flatMap((entry) => checksForItem(id, entry));
}

/** Verdict and exact body-citation questions for all basic and conditional items. */
export function allCategoryChecks(): readonly CategoryCheck[] {
  return CONTENT_CATEGORY_IDS.flatMap((id) => checksForCategory(id));
}

/** Build the approved v9 definition while retaining the common site checks. */
export function buildCategoryDefinition(base: ApprovedDefinition): ApprovedDefinition {
  const siteChecks = base.questions.filter((check) => check.applyWhen === undefined && (check.type !== "choice" || check.citeFor === undefined));
  const categoryChecks = allCategoryChecks().map(({ categoryId: _categoryId, rubricItemId: _rubricItemId, questionKind: _questionKind, required: _required, ...check }) => check as Check);
  const triggerChecks = CONTENT_CATEGORY_IDS.flatMap((id) => triggerChecksForCategory(id).map(triggerAsCheck));
  return {
    ...base,
    version: base.version + 1,
    subject: `${base.subject} Body checks are selected from the page's content category and activated content probes.`,
    questions: [...siteChecks, ...categoryChecks, ...triggerChecks],
  };
}

/** Content-only trigger questions; these answers route conditional probes and do not cast a verdict. */
export function triggerChecksForCategory(id: ContentCategoryId): readonly CategoryTriggerCheck[] {
  return CATEGORY_RUBRICS[id].conditionalProbes.map((entry: ConditionalProbe) => ({
    id: `${entry.id}_trigger` as QuestionId,
    type: "choice",
    categoryId: id,
    rubricItemId: entry.id,
    question: entry.trigger.question,
    instructions: entry.trigger.instruction,
    choices: {
      yes: "The stated content feature is present in the main body.",
      no: "The stated content feature is not present in the main body.",
      unclear: "The available body text does not establish whether the feature is present.",
    },
    confidenceFloor: 0.6,
    required: entry.required,
  }));
}
