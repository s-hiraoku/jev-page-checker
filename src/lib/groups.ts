import type { ItemResult, Verdict } from "./checkkit.js";

export const SITE_QUESTION_IDS = [
  "identifiable_publisher",
  "honest_identity",
  "site_purpose",
  "disclosed_incentives",
] as const;
export const PAGE_QUESTION_IDS = [
  "evidence_for_claims",
  "separates_fact_and_opinion",
  "unsourced_specifics",
  "self_consistent",
  "certainty_matches_evidence",
] as const;

const RANK: Record<Verdict, number> = {
  fail: 4,
  error: 3,
  review: 2,
  pass: 1,
  not_applicable: 0,
};

export function worstVerdict(items: readonly { id: string; verdict: Verdict }[], ids: readonly string[]): Verdict {
  let worst: Verdict = "not_applicable";
  for (const item of items) {
    if (!ids.includes(item.id)) continue;
    if (RANK[item.verdict] > RANK[worst]) worst = item.verdict;
  }
  return worst;
}

const PAGE_QUESTION_ID_SET: ReadonlySet<string> = new Set(PAGE_QUESTION_IDS);

export function isPageQuestionId(id: string): boolean {
  return PAGE_QUESTION_ID_SET.has(id);
}

/** Prefix truncation is unread remainder. Body pass is not a completed inspection. */
export function withholdBodyPassOnTruncation(items: readonly ItemResult[], truncated: boolean): ItemResult[] {
  if (!truncated) return [...items];
  return items.map((item) => {
    if (item.verdict !== "pass" || !PAGE_QUESTION_ID_SET.has(item.id)) return item;
    return {
      ...item,
      verdict: "review",
      reason: `extracted text was cut at the character limit; unread remainder cannot support pass (${item.reason})`,
    };
  });
}

/** Later pass must not hide fail or review from another window. */
export function mergeConservativeItem(versions: readonly ItemResult[]): ItemResult {
  const first = versions[0];
  if (first === undefined) throw new Error("mergeConservativeItem needs at least one result");
  let picked = first;
  for (const item of versions.slice(1)) {
    if (RANK[item.verdict] > RANK[picked.verdict]) picked = item;
  }
  if (versions.length === 1) return picked;
  return {
    ...picked,
    reason: `${picked.reason} (conservative merge of ${versions.length} windows)`,
  };
}
