import type { ChoiceCriteria, EntryType, JsonValue } from "@typesafe-ai/sdk";
import { jsonEqual } from "./equal.js";
import { buildRequest, type JevGateway, type JevReply } from "./jev.js";
import { startTimer } from "./report.js";
import { extractSpans, type PageSpan } from "./spans.js";
import type { ApprovedDefinition, Check, CheckReport, ChoiceCheck, ItemResult, JevAnswer } from "./types.js";

const NOUL_DEFAULTS = { passAt: 0.8, failAt: 0.2 };

type Judgement = Pick<ItemResult, "verdict" | "reason">;

function lookup(state: EntryType, path: string): JsonValue | undefined {
  let current: JsonValue | undefined = state;
  for (const key of path.split(".")) {
    if (current === null || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = current[key];
  }
  return current;
}

export function skipReason(check: Check, state: EntryType): string | undefined {
  const when = check.applyWhen;
  if (when === undefined) return undefined;
  const actual = lookup(state, when.path);
  if (actual === undefined) return `applyWhen: ${when.path} is absent from state`;
  switch (when.op) {
    case "exists":
      return undefined;
    case "equals":
      return jsonEqual(actual, when.value)
        ? undefined
        : `applyWhen: ${when.path} is ${JSON.stringify(actual)}, not ${JSON.stringify(when.value)}`;
  }
}

function band(label: string, value: number, passAt: number, failAt: number): Judgement {
  if (value >= passAt) return { verdict: "pass", reason: `${label} ${value} is at or above passAt ${passAt}` };
  if (value <= failAt) return { verdict: "fail", reason: `${label} ${value} is at or below failAt ${failAt}` };
  return { verdict: "review", reason: `${label} ${value} is between failAt ${failAt} and passAt ${passAt}` };
}

function lowConfidence(confidence: number, floor: number | undefined): Judgement | undefined {
  if (floor === undefined || confidence >= floor) return undefined;
  return { verdict: "review", reason: `confidence ${confidence} is below confidenceFloor ${floor}` };
}

function mismatch(check: Check, answer: JevAnswer): Judgement {
  return { verdict: "error", reason: `answer type "${answer.type}" does not match question type "${check.type}"` };
}

function unreachable(value: never): never {
  throw new Error(`unreachable: ${JSON.stringify(value)}`);
}

function entryText(value: EntryType | undefined | null): string {
  return typeof value === "string" && value.length > 0 ? value : "";
}

function answerBasis(check: Check, answer: JevAnswer): string {
  switch (check.type) {
    case "noul": {
      if (answer.type !== "noul") return "";
      const side = answer.noul >= 0.5 ? "true" : "false";
      return entryText(check.criteria?.[side]);
    }
    case "choice": {
      if (answer.type !== "choice") return "";
      return entryText(check.criteria[answer.choice]);
    }
    case "score": {
      if (answer.type !== "score") return "";
      const fromRubric = check.criteria[Math.round(answer.score)];
      return entryText(fromRubric);
    }
    default:
      return unreachable(check);
  }
}

function judge(check: Check, answer: JevAnswer): Judgement {
  switch (check.type) {
    case "noul":
      if (answer.type !== "noul") return mismatch(check, answer);
      return band("noul", answer.noul, check.passAt ?? NOUL_DEFAULTS.passAt, check.failAt ?? NOUL_DEFAULTS.failAt);
    case "choice": {
      if (answer.type !== "choice") return mismatch(check, answer);
      const mapped = check.options[answer.choice];
      return (
        lowConfidence(answer.confidence, check.confidenceFloor) ??
        (mapped === undefined
          ? { verdict: "review", reason: `choice "${answer.choice}" has no entry in options` }
          : { verdict: mapped, reason: `choice "${answer.choice}" maps to ${mapped}` })
      );
    }
    case "score":
      if (answer.type !== "score") return mismatch(check, answer);
      return lowConfidence(answer.confidence, check.confidenceFloor) ?? band("score", answer.score, check.passAt, check.failAt);
    default:
      return unreachable(check);
  }
}

const SYNTHESIS_MARK = "whole-article synthesis from overlapping windows";

function isCite(check: Check): check is ChoiceCheck {
  return check.type === "choice" && check.citeFor !== undefined;
}

function isSynthesis(state: EntryType): boolean {
  return typeof state === "object" && state !== null && !Array.isArray(state) && state.inspection === SYNTHESIS_MARK;
}

function stateText(state: EntryType): string {
  if (typeof state === "object" && state !== null && !Array.isArray(state) && typeof state.text === "string") return state.text;
  return "";
}

function expandCite(check: ChoiceCheck, spans: readonly PageSpan[]): ChoiceCheck {
  const criteria: ChoiceCriteria = { ...check.criteria };
  const options = { ...check.options };
  for (const span of spans) {
    criteria[span.id] = span.text;
    options[span.id] = "pass";
  }
  return { ...check, criteria, options };
}

function selectedCite(
  check: ChoiceCheck,
  answer: JevAnswer | undefined,
  spans: readonly PageSpan[],
): string | undefined {
  if (answer === undefined || answer.type !== "choice" || answer.choice === "none") return undefined;
  const floor = check.confidenceFloor ?? 0.6;
  if (answer.confidence < floor) return undefined;
  return spans.find((span) => span.id === answer.choice)?.text;
}

export async function evaluate(definition: ApprovedDefinition, state: EntryType, jev: JevGateway): Promise<CheckReport> {
  const wall = startTimer();
  const verdictQuestions = definition.questions.filter((check) => !isCite(check));
  const citeQuestions = definition.questions.filter(isCite);
  const spans = isSynthesis(state) ? [] : extractSpans(stateText(state));
  const citeAsked = spans.length === 0 ? [] : citeQuestions.filter((check) => skipReason(check, state) === undefined).map((check) => expandCite(check, spans));
  const asked = [...verdictQuestions.filter((check) => skipReason(check, state) === undefined), ...citeAsked];
  let reply: JevReply = { answers: {}, usage: { input_tokens: 0, output_tokens: 0 } };
  let jevMs = 0;
  if (asked.length > 0) {
    const jevTimer = startTimer();
    reply = await jev.ask(buildRequest(state, asked));
    jevMs = jevTimer();
  }
  const cites = new Map<string, string>();
  for (const check of citeQuestions) {
    const parent = check.citeFor;
    const text = parent === undefined ? undefined : selectedCite(check, reply.answers[check.id], spans);
    if (parent !== undefined && text !== undefined) cites.set(parent, text);
  }
  const items = verdictQuestions.map((check): ItemResult => {
    const skip = skipReason(check, state);
    if (skip !== undefined) return { id: check.id, verdict: "not_applicable", reason: skip };
    const answer = reply.answers[check.id];
    if (answer === undefined) return { id: check.id, verdict: "error", reason: `no answer for "${check.id}"` };
    const cite = cites.get(check.id);
    return {
      id: check.id,
      ...judge(check, answer),
      answer,
      basis: answerBasis(check, answer) || undefined,
      ...(cite === undefined ? {} : { cite }),
    };
  });
  return {
    definition: { id: definition.id, version: definition.version },
    items,
    usage: reply.usage,
    timing: { wallMs: wall(), jevMs },
  };
}
