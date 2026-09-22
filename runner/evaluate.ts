import type { ChoiceCriteria, EntryType, JsonValue } from "@typesafe-ai/sdk";
import { jsonEqual } from "./equal.js";
import { buildRequest, type JevGateway, type JevReply } from "./jev.js";
import { startTimer } from "./report.js";
import { extractSpans, type PageSpan } from "./spans.js";
import type { ApprovedDefinition, Check, CheckReport, ChoiceCheck, ItemResult, JevAnswer, Verdict } from "./types.js";

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

function explicitSpan(answer: JevAnswer | undefined, spans: readonly PageSpan[]): PageSpan | undefined {
  if (answer === undefined || answer.type !== "choice" || answer.choice === "none") return undefined;
  return spans.find((span) => span.id === answer.choice);
}

function isAlertVerdict(verdict: Verdict | undefined): boolean {
  return verdict === "review" || verdict === "fail";
}

const CAUSE_ASK =
  " The verdict on this question is Review or Alert. Choose the labeled sentence that caused that verdict. Do not choose a sentence that only supports a passing part of the page. Choose one labeled sentence. Do not write a new sentence.";

/** A second ask, still display-only, for an alert row whose sentence is missing or shared with Pass. */
function followUpCite(check: ChoiceCheck, spans: readonly PageSpan[]): ChoiceCheck {
  const criteria: ChoiceCriteria = {};
  const options: ChoiceCheck["options"] = {};
  for (const span of spans) {
    criteria[span.id] = span.text;
    options[span.id] = "pass";
  }
  const instructions = typeof check.instructions === "string" ? `${check.instructions}${CAUSE_ASK}` : check.instructions;
  return { ...check, instructions, criteria, options };
}

/**
 * Display-only. A chosen span is kept below 0.6.
 * Review and Alert keep a sentence that is not the Pass rows' sentence when the page has another.
 * Pass may keep or receive a sentence after those rows are filled.
 */
function assignCites(
  checks: readonly ChoiceCheck[],
  answers: Readonly<Record<string, JevAnswer | undefined>>,
  spans: readonly PageSpan[],
  verdicts: ReadonlyMap<string, Verdict>,
): Map<string, string> {
  const cites = new Map<string, string>();
  if (spans.length === 0) return cites;
  const chosen = new Map<string, PageSpan>();
  for (const check of checks) {
    const parent = check.citeFor;
    if (parent === undefined) continue;
    const span = explicitSpan(answers[check.id], spans);
    if (span !== undefined) chosen.set(parent, span);
  }
  const passTexts = new Set<string>();
  for (const check of checks) {
    const parent = check.citeFor;
    if (parent === undefined || verdicts.get(parent) !== "pass") continue;
    const span = chosen.get(parent);
    if (span !== undefined) {
      passTexts.add(span.text);
      cites.set(parent, span.text);
    }
  }
  for (const check of checks) {
    const parent = check.citeFor;
    if (parent === undefined || !isAlertVerdict(verdicts.get(parent))) continue;
    const span = chosen.get(parent);
    if (span === undefined || passTexts.has(span.text)) continue;
    cites.set(parent, span.text);
  }
  for (const check of checks) {
    const parent = check.citeFor;
    if (parent === undefined || cites.has(parent) || !isAlertVerdict(verdicts.get(parent))) continue;
    const used = new Set(cites.values());
    const span =
      spans.find((item) => !passTexts.has(item.text) && !used.has(item.text)) ??
      spans.find((item) => !passTexts.has(item.text)) ??
      spans.find((item) => !used.has(item.text)) ??
      spans[0];
    if (span !== undefined) cites.set(parent, span.text);
  }
  for (const check of checks) {
    const parent = check.citeFor;
    if (parent === undefined || cites.has(parent) || verdicts.get(parent) !== "pass") continue;
    const used = new Set(cites.values());
    const span = spans.find((item) => !used.has(item.text));
    if (span !== undefined) cites.set(parent, span.text);
  }
  return cites;
}

function parentVerdicts(
  questions: readonly Check[],
  state: EntryType,
  answers: Readonly<Record<string, JevAnswer | undefined>>,
): Map<string, Verdict> {
  const verdicts = new Map<string, Verdict>();
  for (const check of questions) {
    if (isCite(check)) continue;
    const skip = skipReason(check, state);
    if (skip !== undefined) {
      verdicts.set(check.id, "not_applicable");
      continue;
    }
    const answer = answers[check.id];
    verdicts.set(check.id, answer === undefined ? "error" : judge(check, answer).verdict);
  }
  return verdicts;
}

function citesNeedingCause(
  checks: readonly ChoiceCheck[],
  answers: Readonly<Record<string, JevAnswer | undefined>>,
  spans: readonly PageSpan[],
  verdicts: ReadonlyMap<string, Verdict>,
): ChoiceCheck[] {
  if (spans.length === 0) return [];
  const passTexts = new Set<string>();
  for (const check of checks) {
    const parent = check.citeFor;
    if (parent === undefined || verdicts.get(parent) !== "pass") continue;
    const span = explicitSpan(answers[check.id], spans);
    if (span !== undefined) passTexts.add(span.text);
  }
  const nonPass = spans.some((span) => !passTexts.has(span.text));
  return checks.filter((check) => {
    const parent = check.citeFor;
    if (parent === undefined || !isAlertVerdict(verdicts.get(parent))) return false;
    const span = explicitSpan(answers[check.id], spans);
    if (span === undefined) return true;
    return passTexts.has(span.text) && nonPass;
  });
}

export async function evaluate(definition: ApprovedDefinition, state: EntryType, jev: JevGateway): Promise<CheckReport> {
  const wall = startTimer();
  const verdictQuestions = definition.questions.filter((check) => !isCite(check));
  const citeQuestions = definition.questions.filter(isCite);
  const synthesis = isSynthesis(state);
  const spans = synthesis ? [] : extractSpans(stateText(state));
  const applicableCites = synthesis ? [] : citeQuestions.filter((check) => skipReason(check, state) === undefined);
  const citeAsked = spans.length === 0 ? [] : applicableCites.map((check) => expandCite(check, spans));
  const asked = [...verdictQuestions.filter((check) => skipReason(check, state) === undefined), ...citeAsked];
  let reply: JevReply = { answers: {}, usage: { input_tokens: 0, output_tokens: 0 } };
  let jevMs = 0;
  if (asked.length > 0) {
    const jevTimer = startTimer();
    reply = await jev.ask(buildRequest(state, asked));
    jevMs = jevTimer();
  }
  const answers: Record<string, JevAnswer | undefined> = { ...reply.answers };
  const verdicts = parentVerdicts(verdictQuestions, state, answers);
  const retry = citesNeedingCause(applicableCites, answers, spans, verdicts);
  if (retry.length > 0) {
    const passTexts = new Set<string>();
    for (const check of applicableCites) {
      const parent = check.citeFor;
      if (parent === undefined || verdicts.get(parent) !== "pass") continue;
      const span = explicitSpan(answers[check.id], spans);
      if (span !== undefined) passTexts.add(span.text);
    }
    const offer = spans.filter((span) => !passTexts.has(span.text));
    const askSpans = offer.length > 0 ? offer : spans;
    const jevTimer = startTimer();
    const second = await jev.ask(buildRequest(state, retry.map((check) => followUpCite(check, askSpans))));
    jevMs += jevTimer();
    reply = {
      ...reply,
      usage: {
        input_tokens: reply.usage.input_tokens + second.usage.input_tokens,
        output_tokens: reply.usage.output_tokens + second.usage.output_tokens,
      },
    };
    for (const check of retry) {
      const answer = second.answers[check.id];
      if (answer !== undefined) answers[check.id] = answer;
    }
  }
  const cites = assignCites(applicableCites, answers, spans, verdicts);
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
