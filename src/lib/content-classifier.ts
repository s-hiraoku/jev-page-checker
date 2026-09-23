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
  | "unexplained_secondary";

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

const CONFIDENCE_FLOOR = 0.6;
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
    confidenceFloor: CONFIDENCE_FLOOR,
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
      choiceCheck(primaryId, "Classify the primary purpose of this page body using the supplied category descriptions. Select unclear when no single category fits. Do not infer from the URL, hostname, or publisher reputation.", primaryCriteria),
      choiceCheck(secondaryId, "Choose a materially important secondary category only when it has a substantial purpose of its own. A link, quotation, example, or brief aside is not a secondary category. Otherwise choose none.", secondaryCriteria),
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
    const evidence = findEvidence(spans, evidenceAnswer.choice);
    resultWindows.push({
      start: window.start,
      end: window.end,
      ...(primary === undefined ? {} : { primary: primary.choice, confidence: primary.confidence }),
      ...(secondary === undefined || secondary.choice === NONE ? { secondaryConfidence: secondary?.confidence } : { secondary: secondary.choice, secondaryConfidence: secondary.confidence }),
      ...(evidence === undefined ? {} : { evidence, evidenceConfidence: evidenceAnswer?.confidence }),
    });
  }

  for (const [index, result] of resultWindows.entries()) {
    if (result.primary === undefined || result.confidence === undefined) {
      return review("missing_primary", "Jev did not return a primary category for every window.", resultWindows, usage, started, jevMs);
    }
    if (!Object.hasOwn(categoryDescriptions, result.primary) && result.primary !== UNCLEAR) {
      return review("unknown_primary", "Jev returned a primary category outside the supplied options.", resultWindows, usage, started, jevMs);
    }
    if (result.secondary !== undefined && !Object.hasOwn(categoryDescriptions, result.secondary)) {
      return review("unknown_secondary", "Jev returned a secondary category outside the supplied options.", resultWindows, usage, started, jevMs);
    }
    if (result.confidence < CONFIDENCE_FLOOR || (result.secondaryConfidence ?? 0) < CONFIDENCE_FLOOR) {
      return review("low_confidence", "At least one category choice is below the 0.6 confidence floor.", resultWindows, usage, started, jevMs);
    }
    if (result.primary === UNCLEAR) return review("unclear_category", "At least one window has an unclear primary category.", resultWindows, usage, started, jevMs);
    if (result.primary === result.secondary) return review("duplicate_categories", "A window selected the same primary and secondary category.", resultWindows, usage, started, jevMs);
    if (result.evidence === undefined || result.evidenceConfidence === undefined || result.evidenceConfidence < CONFIDENCE_FLOOR) {
      return review("low_confidence", "A window has no supported page-span evidence at or above the 0.6 confidence floor.", resultWindows, usage, started, jevMs);
    }
  }

  const primaryCounts = new Map<string, number>();
  const categories = new Set<string>();
  for (const item of resultWindows) {
    if (item.primary !== undefined) {
      categories.add(item.primary);
      primaryCounts.set(item.primary, (primaryCounts.get(item.primary) ?? 0) + 1);
    }
    if (item.secondary !== undefined) categories.add(item.secondary);
  }
  if (categories.size > 2) return review("too_many_categories", "The windows contain more than two material categories.", resultWindows, usage, started, jevMs);
  const ranked = [...primaryCounts.entries()].sort((left, right) => right[1] - left[1]);
  const primary = ranked[0]?.[0];
  const secondPlace = ranked[1];
  if (primary === undefined || (secondPlace !== undefined && ranked[0]?.[1] === secondPlace[1])) {
    return review("primary_disagreement", "The windows disagree about the primary category without a clear majority.", resultWindows, usage, started, jevMs);
  }
  const secondary = [...categories].find((category) => category !== primary);
  if (secondary !== undefined && !resultWindows.some((item) => item.secondary === secondary)) {
    return review("unexplained_secondary", "Window differences are not explained by an explicit material secondary category.", resultWindows, usage, started, jevMs);
  }
  const evidence = resultWindows.find((item) => item.primary === primary)?.evidence ?? resultWindows[0]?.evidence;
  return {
    status: "classified",
    primary,
    ...(secondary === undefined ? {} : { secondary }),
    confidence: Math.min(...resultWindows.filter((item) => item.primary === primary).map((item) => item.confidence ?? 0)),
    ...(secondary === undefined ? {} : {
      secondaryConfidence: Math.min(...resultWindows.filter((item) => item.secondary === secondary || item.primary === secondary).map((item) => item.secondary === secondary ? item.secondaryConfidence ?? 0 : item.confidence ?? 0)),
    }),
    ...(evidence === undefined ? {} : { evidence }),
    windows: resultWindows,
    usage,
    timing: { wallMs: Math.round(performance.now() - started), jevMs },
  };
}
