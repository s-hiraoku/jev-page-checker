import type { Usage } from "@typesafe-ai/sdk";
import { buildRequest, type JevGateway } from "../../runner/jev.js";
import type { ChoiceCheck, QuestionId, SiteTypeSummary } from "../../runner/types.js";
import { bodyTokenBudget, estimateTokens, trimToTokenBudget } from "./jev-budget.js";
import type { PageSnapshot } from "./page-state.js";
import type { ResolvedLocale } from "./locale.js";

export const SITE_TYPE_IDS = [
  "official_primary",
  "news_wire",
  "encyclopedia_reference",
  "expert_blog",
  "ugc_sns",
  "ecommerce_reviews",
  "tools_saas_docs",
  "marketing_leadgen",
  "secondary_aggregator",
  "unknown_other",
] as const;

export type SiteTypeId = (typeof SITE_TYPE_IDS)[number];

export type SiteTypeReasonCode = "empty_page" | "missing_site_type" | "unknown_site_type" | "site_type_error";

interface SiteTypeClass {
  label: { ja: string; en: string };
  criterion: string;
}

const SITE_TYPE_CATALOG = {
  official_primary: {
    label: { ja: "公式一次", en: "Official primary source" },
    criterion: "Self-published by a government, company, or school as the named organization",
  },
  news_wire: {
    label: { ja: "ニュース", en: "News" },
    criterion: "News reporting or wire-service journalism",
  },
  encyclopedia_reference: {
    label: { ja: "百科・辞書", en: "Encyclopedia and dictionary" },
    criterion: "Encyclopedia, handbook, or reference-style factual entry",
  },
  expert_blog: {
    label: { ja: "専門家ブログ", en: "Expert blog" },
    criterion: "Expert or practitioner blog/explainer by a named person or practice",
  },
  ugc_sns: {
    label: { ja: "UGC・SNS", en: "UGC and social" },
    criterion: "User-generated content: forum, comments, or social post",
  },
  ecommerce_reviews: {
    label: { ja: "EC・レビュー", en: "Shopping and reviews" },
    criterion: "Product listing, customer reviews, or shopping comparison",
  },
  tools_saas_docs: {
    label: { ja: "SaaS・docs", en: "SaaS and docs" },
    criterion: "Product docs, API/reference, changelog, or tool help",
  },
  marketing_leadgen: {
    label: { ja: "マーケ・リード", en: "Marketing and leads" },
    criterion: "Marketing, ads, or lead-generation landing content",
  },
  secondary_aggregator: {
    label: { ja: "アグリゲータ・要約", en: "Aggregator and summary" },
    criterion: "Secondary summary, aggregator, mirror, or translated reprint of other sources",
  },
  unknown_other: {
    label: { ja: "その他", en: "Other" },
    criterion: "Does not clearly fit the other classes, or class is unclear",
  },
} as const satisfies Record<SiteTypeId, SiteTypeClass>;

const SITE_TYPE_QUESTION_ID = "site_type";
const ZERO_USAGE: Usage = { input_tokens: 0, output_tokens: 0 };

export function isSiteTypeId(value: string): value is SiteTypeId {
  return (SITE_TYPE_IDS as readonly string[]).includes(value);
}

export function siteTypeLabel(id: SiteTypeId, locale: ResolvedLocale): string {
  return SITE_TYPE_CATALOG[id].label[locale];
}

export function siteTypeChoiceCriteria(): Record<SiteTypeId, string> {
  return Object.fromEntries(SITE_TYPE_IDS.map((id) => [id, SITE_TYPE_CATALOG[id].criterion])) as Record<SiteTypeId, string>;
}

export interface SiteTypeClassification extends SiteTypeSummary {
  reasonCode?: SiteTypeReasonCode;
  id?: SiteTypeId;
  usage: Usage;
  timing: { wallMs: number; jevMs: number };
}

export function siteTypeSummary(result: SiteTypeClassification): SiteTypeSummary {
  return {
    status: result.status,
    ...(result.reasonCode === undefined ? {} : { reasonCode: result.reasonCode }),
    ...(result.reason === undefined ? {} : { reason: result.reason }),
    ...(result.id === undefined ? {} : { id: result.id }),
    ...(result.confidence === undefined ? {} : { confidence: result.confidence }),
  };
}

function choiceCheck(): ChoiceCheck {
  return {
    id: SITE_TYPE_QUESTION_ID as QuestionId,
    type: "choice",
    instructions: "Choose the one site type that best fits this page. This axis names how the page is published. It is not the body content category and it is not a trust score. Judge from the title, site name, author, description, and visible text. Do not use the URL, the hostname, or the publisher's fame. Choose unknown_other when no other class clearly fits.",
    criteria: siteTypeChoiceCriteria(),
    options: Object.fromEntries(SITE_TYPE_IDS.map((id) => [id, "pass"])),
  };
}

function pageState(snapshot: PageSnapshot, text: string) {
  return {
    title: snapshot.title,
    siteName: snapshot.siteName,
    author: snapshot.author,
    description: snapshot.metaDescription,
    language: snapshot.language,
    text,
  };
}

function blank(value: string): boolean {
  return value.trim().length === 0;
}

function trimTailToTokenBudget(text: string, maxTokens: number): string {
  const budget = Math.max(1, Math.floor(maxTokens));
  if (estimateTokens(text) <= budget) return text;
  let low = 1;
  let high = text.length;
  let best = 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (estimateTokens(text.slice(text.length - mid)) <= budget) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return text.slice(text.length - best);
}

export function siteTypeExcerpt(
  text: string,
  windows: readonly { start: number; end: number }[],
  maxTokens = bodyTokenBudget(),
): string {
  const budget = Math.max(1, Math.floor(maxTokens));
  const first = windows[0];
  const last = windows[windows.length - 1];
  const start = first === undefined ? 0 : Math.max(0, Math.min(first.start, text.length));
  const end = last === undefined ? start : Math.max(start, Math.min(last.end, text.length));
  const span = text.slice(start, end);
  if (estimateTokens(span) <= budget) return span;
  const tailBudget = Math.floor(budget / 2);
  if (tailBudget < 1) return trimToTokenBudget(span, budget);
  const tail = trimTailToTokenBudget(span, tailBudget);
  const headSource = span.slice(0, span.length - tail.length);
  const separator = "\n";
  const headBudget = budget - estimateTokens(tail) - estimateTokens(separator);
  if (headBudget < 1 || headSource.length === 0) return tail;
  return `${trimToTokenBudget(headSource, headBudget)}${separator}${tail}`;
}

function review(
  reasonCode: SiteTypeReasonCode,
  reason: string,
  started: number,
  usage: Usage = ZERO_USAGE,
  jevMs = 0,
): SiteTypeClassification {
  return {
    status: "review",
    reasonCode,
    reason,
    usage,
    timing: { wallMs: Math.round(performance.now() - started), jevMs },
  };
}

function rankedSiteType(answer: { choice: string; confidence: number; probabilities: Readonly<Record<string, number>> }): { id: SiteTypeId; score: number } | "unknown" {
  if (!isSiteTypeId(answer.choice)) return "unknown";
  const scores = new Map<SiteTypeId, number>();
  for (const [label, value] of Object.entries(answer.probabilities)) {
    if (!isSiteTypeId(label) || !Number.isFinite(value) || value < 0 || value > 1) return "unknown";
    scores.set(label, value);
  }
  if (!scores.has(answer.choice)) {
    if (!Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1) return "unknown";
    scores.set(answer.choice, answer.confidence);
  }
  if (scores.size === 0) return "unknown";
  let best = Number.NEGATIVE_INFINITY;
  for (const value of scores.values()) if (value > best) best = value;
  const leaders = [...scores.keys()].filter((label) => scores.get(label) === best);
  const chosen = leaders.includes(answer.choice)
    ? answer.choice
    : leaders.sort((left, right) => SITE_TYPE_IDS.indexOf(left) - SITE_TYPE_IDS.indexOf(right))[0];
  return chosen === undefined ? "unknown" : { id: chosen, score: best };
}

export async function classifySiteType(snapshot: PageSnapshot, text: string, jev: JevGateway): Promise<SiteTypeClassification> {
  const started = performance.now();
  if (blank(snapshot.title) && blank(snapshot.siteName) && blank(snapshot.author) && blank(snapshot.metaDescription) && blank(text)) {
    return review("empty_page", "The page has no title, site name, author, description, or text to classify.", started);
  }
  const requestStarted = performance.now();
  const reply = await jev.ask(buildRequest(pageState(snapshot, text), [choiceCheck()]));
  const jevMs = Math.round(performance.now() - requestStarted);
  const usage = reply.usage;
  const answer = reply.answers[SITE_TYPE_QUESTION_ID];
  if (answer?.type !== "choice") {
    return review("missing_site_type", "Jev did not return a site type choice.", started, usage, jevMs);
  }
  const ranked = rankedSiteType(answer);
  if (ranked === "unknown") {
    return review("unknown_site_type", "Jev returned a site type outside the supplied classes.", started, usage, jevMs);
  }
  return {
    status: "classified",
    id: ranked.id,
    confidence: ranked.score,
    usage,
    timing: { wallMs: Math.round(performance.now() - started), jevMs },
  };
}
