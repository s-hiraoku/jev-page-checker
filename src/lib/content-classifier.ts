import type { ChoiceCriteria, EntryType, Usage } from "@typesafe-ai/sdk";
import { buildRequest, type JevGateway } from "../../runner/jev.js";
import { extractSpans, type PageSpan, type PageSpanSource } from "../../runner/spans.js";
import type { ChoiceCheck, QuestionId } from "../../runner/types.js";
import type { BodyWindow } from "./body-windows.js";
import type { PageSnapshot } from "./page-state.js";

export type ContentClassificationStatus = "classified" | "review" | "not_applicable";
export type ContentClassificationReasonCode =
  | "no_single_body"
  | "invalid_category_options"
  | "reserved_category_option"
  | "incomplete_body"
  | "no_evidence_candidates"
  | "missing_window_answers"
  | "missing_primary"
  | "unknown_primary"
  | "unknown_secondary"
  | "low_confidence"
  | "unclear_category"
  | "duplicate_categories"
  | "too_many_categories"
  | "primary_disagreement"
  | "unexplained_secondary"
  | "classification_error";

export interface ContentEvidence {
  text: string;
  source: PageSpanSource;
  start?: number;
  end?: number;
}

interface EvidenceCandidate extends PageSpan {
  start?: number;
  end?: number;
}

export interface WindowClassification {
  start: number;
  end: number;
  primary?: string;
  secondary?: string;
  confidence?: number;
  secondaryConfidence?: number;
  evidence?: ContentEvidence;
  evidenceConfidence?: number;
}

export interface ContentClassification {
  status: ContentClassificationStatus;
  reasonCode?: ContentClassificationReasonCode;
  reason?: string;
  primary?: string;
  secondary?: string;
  confidence?: number;
  secondaryConfidence?: number;
  evidence?: ContentEvidence;
  windows: readonly WindowClassification[];
  usage: Usage;
  timing: { wallMs: number; jevMs: number };
}

const ZERO_USAGE: Usage = { input_tokens: 0, output_tokens: 0 };
const NONE = "none";
const UNCLEAR = "unclear";

function choiceCheck(id: string, instructions: string, criteria: ChoiceCriteria): ChoiceCheck {
  return {
    id: id as QuestionId,
    type: "choice",
    instructions,
    criteria,
    options: Object.fromEntries(Object.keys(criteria).map((label) => [label, "pass"])),
  };
}

function pageState(snapshot: PageSnapshot, window: BodyWindow): EntryType {
  // URL and hostname are deliberately excluded: classification is about the page text.
  return {
    title: snapshot.title,
    description: snapshot.metaDescription,
    language: snapshot.language,
    text: window.text,
    window: { start: window.start, end: window.end },
  };
}

function spansForWindow(snapshot: PageSnapshot, window: BodyWindow): EvidenceCandidate[] {
  const chrome: EvidenceCandidate[] = [
    ...(snapshot.title.trim().length === 0 ? [] : [{ id: "title", text: snapshot.title, source: "title" as const }]),
    ...(snapshot.metaDescription.trim().length === 0 ? [] : [{ id: "metaDescription", text: snapshot.metaDescription, source: "metaDescription" as const }]),
  ];
  const body = extractSpans(window.text).map((span) => {
    const relativeStart = window.text.indexOf(span.text);
    const start = relativeStart < 0 ? undefined : window.start + relativeStart;
    return { ...span, ...(start === undefined ? {} : { start, end: start + span.text.length }) };
  });
  return [...chrome, ...body];
}

function findEvidence(spans: readonly EvidenceCandidate[], choice: string | undefined): ContentEvidence | undefined {
  if (choice === undefined || choice === NONE) return undefined;
  const span = spans.find((candidate) => candidate.id === choice);
  if (span === undefined) return undefined;
  return {
    text: span.text,
    source: span.source,
    ...(span.start === undefined ? {} : { start: span.start, end: span.end }),
  };
}

function completeCoverage(snapshot: PageSnapshot, windows: readonly BodyWindow[]): boolean {
  if (snapshot.textTruncated || windows.length === 0) return false;
  const ordered = [...windows].sort((left, right) => left.start - right.start || left.end - right.end);
  let coveredUntil = 0;
  for (const window of ordered) {
    if (!Number.isInteger(window.start) || !Number.isInteger(window.end)) return false;
    if (window.start < 0 || window.end < window.start || window.end > snapshot.text.length) return false;
    if (snapshot.text.slice(window.start, window.end) !== window.text || window.start > coveredUntil) return false;
    coveredUntil = Math.max(coveredUntil, window.end);
  }
  return coveredUntil === snapshot.text.length;
}

function choiceAnswer(reply: Awaited<ReturnType<JevGateway["ask"]>>, id: string) {
  const answer = reply.answers[id];
  return answer?.type === "choice" ? answer : undefined;
}

function orderIndex(id: string, order: readonly string[]): number {
  if (id === UNCLEAR) return order.length + 1;
  const index = order.indexOf(id);
  return index < 0 ? order.length : index;
}

type RankedLabel = { id: string; score: number };

function rankedLabel(
  answer: { choice: string; confidence: number; probabilities: Readonly<Record<string, number>> },
  allowed: ReadonlySet<string>,
  order: readonly string[],
): RankedLabel | "unknown" {
  const scores = new Map<string, number>();
  for (const [label, value] of Object.entries(answer.probabilities)) {
    if (Number.isFinite(value) && (allowed.has(label) || label === UNCLEAR)) scores.set(label, value);
  }
  if ((allowed.has(answer.choice) || answer.choice === UNCLEAR) && !scores.has(answer.choice)) {
    scores.set(answer.choice, answer.confidence);
  }
  if (scores.size === 0) return "unknown";
  let best = Number.NEGATIVE_INFINITY;
  for (const value of scores.values()) if (value > best) best = value;
  const leaders = [...scores.keys()].filter((label) => scores.get(label) === best);
  const categories = leaders.filter((label) => label !== UNCLEAR);
  if (categories.length === 0) return { id: UNCLEAR, score: best };
  if (answer.choice !== UNCLEAR && categories.includes(answer.choice)) return { id: answer.choice, score: best };
  const id = [...categories].sort((left, right) => orderIndex(left, order) - orderIndex(right, order))[0];
  return id === undefined ? "unknown" : { id, score: best };
}

function rankedSecondary(
  answer: { choice: string; confidence: number; probabilities: Readonly<Record<string, number>> },
  allowed: ReadonlySet<string>,
  order: readonly string[],
  primary: RankedLabel,
): RankedLabel | "unknown" | undefined {
  if (answer.choice === NONE || primary.id === UNCLEAR) return undefined;
  const ranked = rankedLabel(answer, allowed, order);
  if (ranked === "unknown") return "unknown";
  if (ranked.id === UNCLEAR || ranked.id === primary.id || ranked.score >= primary.score) return undefined;
  return ranked;
}

function rankTally(tally: ReadonlyMap<string, { count: number; score: number }>, order: readonly string[]): string | undefined {
  const ranked = [...tally.entries()].sort((left, right) => {
    if (right[1].count !== left[1].count) return right[1].count - left[1].count;
    if (right[1].score !== left[1].score) return right[1].score - left[1].score;
    return orderIndex(left[0], order) - orderIndex(right[0], order);
  });
  return ranked[0]?.[0];
}

function review(
  reasonCode: ContentClassificationReasonCode,
  reason: string,
  windows: readonly WindowClassification[],
  usage: Usage,
  started: number,
  jevMs: number,
): ContentClassification {
  return {
    status: "review",
    reasonCode,
    reason,
    windows,
    usage,
    timing: { wallMs: Math.round(performance.now() - started), jevMs },
  };
}

/** Classify one page body across its supplied overlapping windows. */
export async function classifyContent(
  snapshot: PageSnapshot,
  windows: readonly BodyWindow[],
  jev: JevGateway,
  categoryDescriptions: Readonly<Record<string, string>>,
): Promise<ContentClassification> {
  const started = performance.now();
  if (!snapshot.hasArticle || !snapshot.hasBody || snapshot.text.length === 0) {
    return {
      status: "not_applicable",
      reasonCode: "no_single_body",
      reason: "This page has no single body to classify.",
      windows: [],
      usage: ZERO_USAGE,
      timing: { wallMs: Math.round(performance.now() - started), jevMs: 0 },
    };
  }
  if (Object.keys(categoryDescriptions).length === 0 || Object.values(categoryDescriptions).some((text) => !text.trim())) {
    return review("invalid_category_options", "Category descriptions are missing or empty.", [], ZERO_USAGE, started, 0);
  }
  if (Object.hasOwn(categoryDescriptions, UNCLEAR) || Object.hasOwn(categoryDescriptions, NONE)) {
    return review("reserved_category_option", 'Category descriptions must not define reserved labels "unclear" or "none".', [], ZERO_USAGE, started, 0);
  }
  if (!completeCoverage(snapshot, windows)) {
    return review("incomplete_body", "The supplied windows do not cover the complete, untruncated page body.", [], ZERO_USAGE, started, 0);
  }

  const order = Object.keys(categoryDescriptions);
  const allowed = new Set(order);
  const primaryCriteria: ChoiceCriteria = { ...categoryDescriptions, [UNCLEAR]: "The page's primary content category cannot be determined." };
  const secondaryCriteria: ChoiceCriteria = { ...categoryDescriptions, [NONE]: "There is no materially important secondary category." };
  const resultWindows: WindowClassification[] = [];
  const primaryId = "content_primary";
  const secondaryId = "content_secondary";
  const evidenceId = "content_evidence";
  let usage: Usage = ZERO_USAGE;
  let jevMs = 0;

  for (const window of windows) {
    const spans = spansForWindow(snapshot, window);
    if (spans.length === 0) {
      return review("no_evidence_candidates", "A content window has no selectable page sentence for evidence.", resultWindows, usage, started, jevMs);
    }
    const evidenceCriteria: ChoiceCriteria = Object.fromEntries([
      ...spans.map((span) => [span.id, span.text]),
      [NONE, "No selectable page sentence supports this classification."],
    ]);
    const checks = [
      choiceCheck(primaryId, "Choose the one category that best fits the primary purpose of this page body. Use the supplied category descriptions and select the best match even when other categories are plausible. Choose unclear only when the body has no primary purpose. Do not infer from the URL, hostname, or publisher reputation.", primaryCriteria),
      choiceCheck(secondaryId, "Choose a second category only when it has a substantial purpose of its own and is a worse fit than the primary category. A link, quotation, example, or brief aside is not a secondary category. Otherwise choose none.", secondaryCriteria),
      choiceCheck(evidenceId, "Choose one exact sentence from the offered page spans that supports the classification. Do not write or paraphrase a sentence; choose none if none supports it.", evidenceCriteria),
    ];
    const requestStarted = performance.now();
    const reply = await jev.ask(buildRequest(pageState(snapshot, window), checks));
    jevMs += Math.round(performance.now() - requestStarted);
    usage = {
      input_tokens: usage.input_tokens + reply.usage.input_tokens,
      output_tokens: usage.output_tokens + reply.usage.output_tokens,
    };
    const primary = choiceAnswer(reply, primaryId);
    const secondary = choiceAnswer(reply, secondaryId);
    const evidenceAnswer = choiceAnswer(reply, evidenceId);
    if (primary === undefined || secondary === undefined || evidenceAnswer === undefined) {
      return review("missing_window_answers", "Jev did not return all three classification choices for a window.", resultWindows, usage, started, jevMs);
    }
    const primaryRank = rankedLabel(primary, allowed, order);
    if (primaryRank === "unknown") {
      return review("unknown_primary", "Jev returned a primary category outside the supplied options.", resultWindows, usage, started, jevMs);
    }
    const secondaryRank = rankedSecondary(secondary, allowed, order, primaryRank);
    if (secondaryRank === "unknown") {
      return review("unknown_secondary", "Jev returned a secondary category outside the supplied options.", resultWindows, usage, started, jevMs);
    }
    const evidence = findEvidence(spans, evidenceAnswer.choice);
    resultWindows.push({
      start: window.start,
      end: window.end,
      primary: primaryRank.id,
      confidence: primaryRank.score,
      ...(secondaryRank === undefined ? {} : { secondary: secondaryRank.id, secondaryConfidence: secondaryRank.score }),
      ...(evidence === undefined ? {} : { evidence, evidenceConfidence: evidenceAnswer.confidence }),
    });
  }

  const tally = new Map<string, { count: number; score: number }>();
  for (const result of resultWindows) {
    if (result.primary === undefined || result.primary === UNCLEAR) continue;
    const current = tally.get(result.primary) ?? { count: 0, score: 0 };
    current.count += 1;
    current.score += result.confidence ?? 0;
    tally.set(result.primary, current);
  }
  const primary = rankTally(tally, order);
  if (primary === undefined) {
    return review("unclear_category", "The leading category is unclear.", resultWindows, usage, started, jevMs);
  }
  const winnerWindows = resultWindows.filter((item) => item.primary === primary);
  const primaryScore = Math.min(...winnerWindows.map((item) => item.confidence ?? 0));
  const secondaryTally = new Map<string, { count: number; score: number }>();
  for (const result of resultWindows) {
    if (result.secondary === undefined || result.secondary === primary) continue;
    if ((result.secondaryConfidence ?? 0) >= primaryScore) continue;
    const current = secondaryTally.get(result.secondary) ?? { count: 0, score: 0 };
    current.count += 1;
    current.score += result.secondaryConfidence ?? 0;
    secondaryTally.set(result.secondary, current);
  }
  const secondary = rankTally(secondaryTally, order);
  const evidence = winnerWindows.find((item) => item.evidence !== undefined)?.evidence;
  return {
    status: "classified",
    primary,
    ...(secondary === undefined ? {} : { secondary }),
    confidence: primaryScore,
    ...(secondary === undefined ? {} : {
      secondaryConfidence: Math.min(...resultWindows.filter((item) => item.secondary === secondary).map((item) => item.secondaryConfidence ?? 0)),
    }),
    ...(evidence === undefined ? {} : { evidence }),
    windows: resultWindows,
    usage,
    timing: { wallMs: Math.round(performance.now() - started), jevMs },
  };
}
