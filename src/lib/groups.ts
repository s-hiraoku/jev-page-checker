import type { ApplyWhen, ItemResult, ReportInspection, Verdict } from "./checkkit.js";

const RANK: Record<Verdict, number> = {
  fail: 4,
  error: 3,
  review: 2,
  pass: 1,
  not_applicable: 0,
};

/** Body questions are those the definition gates on a single piece of writing. */
export function isBodyQuestion(applyWhen: ApplyWhen | undefined): boolean {
  return applyWhen !== undefined && applyWhen.op === "equals" && applyWhen.path === "hasArticle" && applyWhen.value === true;
}

export function bodyQuestionIds(questions: readonly { id: string; applyWhen?: ApplyWhen }[]): string[] {
  return questions.filter((question) => isBodyQuestion(question.applyWhen)).map((question) => question.id);
}

export function siteQuestionIds(questions: readonly { id: string; applyWhen?: ApplyWhen }[]): string[] {
  return questions.filter((question) => !isBodyQuestion(question.applyWhen)).map((question) => question.id);
}

export function worseVerdict(left: Verdict, right: Verdict): Verdict {
  return RANK[left] >= RANK[right] ? left : right;
}

export function worstVerdict(items: readonly { id: string; verdict: Verdict }[], ids: readonly string[]): Verdict {
  let worst: Verdict = "not_applicable";
  for (const item of items) {
    if (!ids.includes(item.id)) continue;
    worst = worseVerdict(worst, item.verdict);
  }
  return worst;
}

export function bodySendKind(inspection: ReportInspection | undefined): "unread" | "chunked" | "whole" {
  if (inspection === undefined) return "whole";
  if (inspection.unreadRemainder) return "unread";
  if (inspection.windowCount > 1) return "chunked";
  return "whole";
}

/** Prefix truncation is unread remainder. Body pass is not a completed inspection. */
export function withholdBodyPassOnTruncation(
  items: readonly ItemResult[],
  truncated: boolean,
  bodyIds: readonly string[],
): ItemResult[] {
  if (!truncated) return [...items];
  const body = new Set(bodyIds);
  return items.map((item) => {
    if (item.verdict !== "pass" || !body.has(item.id)) return item;
    return {
      ...item,
      verdict: "review",
      reason: `extracted text was cut at the character limit; unread remainder cannot support pass (${item.reason})`,
    };
  });
}

/** A synthesis round that errors has not read the cross-window remainder. */
export function softenSynthesisErrors(items: readonly ItemResult[], bodyIds: readonly string[]): ItemResult[] {
  const body = new Set(bodyIds);
  return items.map((item) =>
    item.verdict === "error" && body.has(item.id)
      ? { ...item, verdict: "review", reason: `synthesis error; unread cross-window remainder cannot support pass (${item.reason})` }
      : item,
  );
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
