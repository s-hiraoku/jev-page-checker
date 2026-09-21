/**
 * Jev 1.13 input limits from TypeSafe's Models page:
 * https://docs.typesafe.ai/models.md
 * "Context length | 64k tokens per request; 32k tokens for state plus the longest question"
 *
 * English character conversion from TypeSafe's primitives page:
 * https://docs.typesafe.ai/primitives.md
 * "The budget is around 32,000 tokens, roughly 150,000 characters of English text."
 *
 * The JavaScript SDK publishes no numeric cap. TypeSafe does not publish a tokenizer
 * or a CJK ratio; CJK is counted one character per token so Japanese pages stay under 32k.
 */

/** 64k covers state plus every question in one request. */
export const JEV_REQUEST_TOKEN_LIMIT = 64_000;

/** Binding cap: state plus the single longest question. */
export const JEV_STATE_PLUS_LONGEST_QUESTION_TOKEN_LIMIT = 32_000;

/** 150,000 English characters / 32,000 tokens, from the primitives page. */
export const JEV_ENGLISH_CHARS_PER_TOKEN = 150_000 / 32_000;

/**
 * 10% of the 32k budget. Covers tokenizer variance and any request wrapping
 * that is not in our JSON (system/prompt overhead).
 */
export const JEV_PROMPT_OVERHEAD_RESERVE_TOKENS = 3_200;

/**
 * Pad for the longest question plus non-text state fields.
 * Measured on page-credibility.checker.json: longest question ~198 tokens,
 * snapshot metadata ~158 tokens. Padded so a definition tweak does not overflow.
 */
export const JEV_QUESTION_AND_STATE_RESERVE_TOKENS = 1_024;

const DENSE_CODE_POINT = (code: number): boolean =>
  (code >= 0x3000 && code <= 0x30ff) ||
  (code >= 0x3400 && code <= 0x9fff) ||
  (code >= 0xf900 && code <= 0xfaff) ||
  (code >= 0xac00 && code <= 0xd7af);

/** Tokens remaining for main-body text after prompt/system overhead. */
export function bodyTokenBudget(): number {
  return Math.max(
    1,
    JEV_STATE_PLUS_LONGEST_QUESTION_TOKEN_LIMIT - JEV_PROMPT_OVERHEAD_RESERVE_TOKENS - JEV_QUESTION_AND_STATE_RESERVE_TOKENS,
  );
}

/**
 * Conservative token estimate. Latin uses TypeSafe's 150k/32k English ratio.
 * CJK and Hangul count as one token per character. No tokenizer is published.
 */
export function estimateTokens(text: string): number {
  let dense = 0;
  let other = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code !== undefined && DENSE_CODE_POINT(code)) dense += 1;
    else other += 1;
  }
  if (other === 0) return dense;
  return dense + Math.ceil(other / JEV_ENGLISH_CHARS_PER_TOKEN);
}

export function fitsJevBodyBudget(text: string, maxTokens = bodyTokenBudget()): boolean {
  return estimateTokens(text) <= Math.max(1, Math.floor(maxTokens));
}

/** Upper-bound characters of one English window. Used only to cap extraction. */
export function bodyWindowCharBudget(maxTokens = bodyTokenBudget()): number {
  return Math.max(1, Math.floor(Math.max(1, Math.floor(maxTokens)) * JEV_ENGLISH_CHARS_PER_TOKEN));
}

export function trimToTokenBudget(text: string, maxTokens: number): string {
  const budget = Math.max(1, Math.floor(maxTokens));
  if (estimateTokens(text) <= budget) return text;
  let low = 1;
  let high = text.length;
  let best = 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (estimateTokens(text.slice(0, mid)) <= budget) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return text.slice(0, best);
}

export function endIndexForTokenBudget(text: string, start: number, maxTokens: number): number {
  if (start >= text.length) return start;
  const budget = Math.max(1, Math.floor(maxTokens));
  if (estimateTokens(text.slice(start)) <= budget) return text.length;
  let low = start + 1;
  let high = text.length;
  let best = start + 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (estimateTokens(text.slice(start, mid)) <= budget) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}
