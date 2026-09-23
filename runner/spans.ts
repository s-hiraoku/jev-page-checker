export interface PageSpan {
  id: string;
  text: string;
  source: PageSpanSource;
}

export type PageSpanSource = "title" | "siteName" | "author" | "metaDescription" | "body";

const MAX_SPANS = 8;
const MAX_SITE_SPANS = 12;
const MIN_CHARS = 24;

function scoreSentence(sentence: string): number {
  let score = 0;
  if (/\d/.test(sentence)) score += 2;
  if (/[「」""''“”]/.test(sentence)) score += 2;
  return score;
}

/**
 * Two numbered claims joined by "and" are two spans.
 * One sentence would make the evidence question and the specifics question share a quote.
 * The rule is the same for every URL.
 */
function quantifiedClauses(sentence: string): string[] {
  const parts = sentence
    .split(/\s+and\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length < 2) return [sentence];
  const separate = parts.every((part) => [...part].length >= MIN_CHARS && /\d/.test(part));
  return separate ? parts : [sentence];
}

function rankSpans(sentences: readonly string[], limit: number): PageSpan[] {
  const ranked = sentences
    .map((sentence, index) => ({ sentence, index, score: scoreSentence(sentence) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .sort((left, right) => left.index - right.index);
  return ranked.map((span, index) => ({ id: `s${index + 1}`, text: span.sentence, source: "body" }));
}

/**
 * Sentences cut from the page text. The rule is the same for every URL.
 * English stops need a following space. Fullwidth stops end a sentence without one.
 * Fragments under 24 characters are dropped. Ordinary short sentences stay,
 * so a later question is not forced onto a longer neighbor.
 */
export function extractSpans(text: string): PageSpan[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|(?<=[。！？．])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => [...sentence].length >= MIN_CHARS)
    .flatMap(quantifiedClauses);
  return rankSpans(sentences, MAX_SPANS);
}

export interface SiteSpanFields {
  title?: string;
  siteName?: string;
  author?: string;
  metaDescription?: string;
  text?: string;
}

/**
 * Site quotes use the same body cut, plus the title, site name, author, and description
 * as the page showed them. A short chrome field is kept: it is the whole label, not a fragment.
 */
export function extractSiteSpans(fields: SiteSpanFields): PageSpan[] {
  const chrome = (["title", "siteName", "author", "metaDescription"] as const)
    .map((source) => ({ text: fields[source]?.trim() ?? "", source }))
    .filter((span) => span.text.length > 0);
  const body = extractSpans(fields.text ?? "");
  const spans: Omit<PageSpan, "id">[] = [];
  const seen = new Set<string>();
  for (const span of [...chrome, ...body]) {
    if (seen.has(span.text)) continue;
    seen.add(span.text);
    spans.push(span);
  }
  return spans.slice(0, MAX_SITE_SPANS).map((span, index) => ({ ...span, id: `s${index + 1}` }));
}
