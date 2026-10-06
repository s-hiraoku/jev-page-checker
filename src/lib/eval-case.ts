import type { CheckReport, Verdict } from "./checkkit.js";
import type { PageSnapshot } from "./page-state.js";
import type { StoredRecord } from "./session.js";

/**
 * One labeled page for the audit eval. The expected verdicts are a person's judgement of the page,
 * written without looking at an engine's answer. They are never copied into the product.
 */
export interface EvalCase {
  id: string;
  /** Ordered. tags[0] groups the report; the rest are chips such as source or language. */
  tags: string[];
  /** Where the page came from: "report-export", "capture", "fixture". */
  source: string;
  /** "human" counts in the score. "draft" is a proposal that still needs a person to confirm it. */
  labeledBy: "human" | "draft";
  notes?: string;
  snapshot: Omit<PageSnapshot, "extractedAt"> & { extractedAt?: string };
  expected: {
    /** Item id to the verdicts a careful reviewer would accept. Unlisted items are not graded. */
    items: Record<string, ExpectedVerdict | ExpectedVerdict[]>;
    /** Content category id, or null when the page is not one piece of writing. Absent means not graded. */
    category?: string | null;
  };
}

export type ExpectedVerdict = Exclude<Verdict, "error">;

const VERDICTS: readonly ExpectedVerdict[] = ["pass", "review", "fail", "not_applicable"];

export class EvalCaseError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function expectedList(value: unknown, field: string): ExpectedVerdict[] {
  const list = Array.isArray(value) ? value : [value];
  if (list.length === 0 || !list.every((item) => VERDICTS.includes(item as ExpectedVerdict))) {
    throw new EvalCaseError(`${field} must be one of ${VERDICTS.join(", ")} or a list of them`);
  }
  return list as ExpectedVerdict[];
}

export function parseEvalCase(raw: unknown, field = "case"): EvalCase {
  if (!isRecord(raw)) throw new EvalCaseError(`${field} must be an object`);
  if (typeof raw.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(raw.id)) throw new EvalCaseError(`${field}.id must be lowercase letters, digits, and hyphens`);
  if (!isRecord(raw.snapshot) || typeof raw.snapshot.text !== "string" || typeof raw.snapshot.url !== "string") {
    throw new EvalCaseError(`${field}.snapshot must be a page snapshot`);
  }
  if (raw.labeledBy !== "human" && raw.labeledBy !== "draft") throw new EvalCaseError(`${field}.labeledBy must be "human" or "draft"`);
  if (!isRecord(raw.expected) || !isRecord(raw.expected.items)) throw new EvalCaseError(`${field}.expected.items must be an object`);
  for (const [id, value] of Object.entries(raw.expected.items)) expectedList(value, `${field}.expected.items.${id}`);
  const category = raw.expected.category;
  if (category !== undefined && category !== null && typeof category !== "string") throw new EvalCaseError(`${field}.expected.category must be a string or null`);
  return raw as unknown as EvalCase;
}

/** FNV-1a over the id. The split depends on nothing but the id, so nobody picks which cases are held out. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (const char of text) {
    value ^= char.codePointAt(0) ?? 0;
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

export type Split = "train" | "test";

/** About 30% of cases are held out. The hill-climber reads train failures only. */
export function splitFor(id: string): Split {
  return hash(id) % 10 < 3 ? "test" : "train";
}

export function snapshotForCase(evalCase: EvalCase): PageSnapshot {
  return { ...evalCase.snapshot, extractedAt: evalCase.snapshot.extractedAt ?? "2026-01-01T00:00:00.000Z", textTruncated: evalCase.snapshot.textTruncated ?? false };
}

export interface CaseGrade {
  /** Share of labeled items whose verdict is an accepted one. */
  verdict_acc: number;
  /** 1 when every labeled item and the category match. */
  all_correct: number;
  /** Items a person marked Review or Alert that the engine passed. The costly mistake. */
  false_pass: number;
  /** Items a person marked Pass that the engine sent to Alert. */
  false_alert: number;
  /** Items the engine left as Error. Counted wrong in verdict_acc as well. */
  error_items: number;
  /** 1 or 0 when the category is labeled. */
  category_ok?: number;
}

export interface GradeCounts {
  labeled: number;
  correct: number;
  riskyLabeled: number;
  safeLabeled: number;
}

export function gradeCase(evalCase: EvalCase, report: CheckReport): { grade: CaseGrade; counts: GradeCounts; mismatches: string[] } {
  const verdicts = new Map(report.items.map((item) => [item.id as string, item.verdict] as const));
  const mismatches: string[] = [];
  let correct = 0;
  let falsePass = 0;
  let falseAlert = 0;
  let errors = 0;
  let risky = 0;
  let safe = 0;
  const labels = Object.entries(evalCase.expected.items);
  for (const [id, value] of labels) {
    const accepted = expectedList(value, id);
    const actual: Verdict | "missing" = verdicts.get(id) ?? "missing";
    const isRisky = !accepted.includes("pass") && !accepted.includes("not_applicable");
    const isSafe = accepted.length === 1 && accepted[0] === "pass";
    if (isRisky) risky += 1;
    if (isSafe) safe += 1;
    if (accepted.includes(actual as ExpectedVerdict)) {
      correct += 1;
      continue;
    }
    mismatches.push(`${id}: expected ${accepted.join("|")}, got ${actual}`);
    if (actual === "error" || actual === "missing") errors += 1;
    if (isRisky && actual === "pass") falsePass += 1;
    if (isSafe && actual === "fail") falseAlert += 1;
  }
  let categoryOk: number | undefined;
  if (evalCase.expected.category !== undefined) {
    const primary = report.classification?.status === "classified" ? report.classification.primary ?? null : null;
    categoryOk = primary === evalCase.expected.category ? 1 : 0;
    if (categoryOk === 0) mismatches.push(`category: expected ${evalCase.expected.category ?? "none"}, got ${primary ?? "none"}`);
  }
  const verdictAcc = labels.length === 0 ? 1 : correct / labels.length;
  return {
    grade: {
      verdict_acc: verdictAcc,
      all_correct: correct === labels.length && categoryOk !== 0 ? 1 : 0,
      false_pass: falsePass,
      false_alert: falseAlert,
      error_items: errors,
      ...(categoryOk === undefined ? {} : { category_ok: categoryOk }),
    },
    counts: { labeled: labels.length, correct, riskyLabeled: risky, safeLabeled: safe },
    mismatches,
  };
}

export interface MeanWithInterval {
  mean: number;
  lo: number;
  hi: number;
  n: number;
}

/** Mean with a normal-approximation 95% interval over per-case values. */
export function meanInterval(values: readonly number[]): MeanWithInterval {
  const n = values.length;
  if (n === 0) return { mean: Number.NaN, lo: Number.NaN, hi: Number.NaN, n };
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const variance = n > 1 ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1) : 0;
  const half = 1.96 * Math.sqrt(variance / n);
  return { mean, lo: Math.max(0, mean - half), hi: Math.min(1, mean + half), n };
}

/** A case built from a stored check, with labels left for a person to fill in. */
export function caseFromRecord(record: StoredRecord, slug: string): EvalCase {
  const { extractedAt: _extractedAt, ...snapshot } = record.snapshot;
  return {
    id: slug,
    tags: ["unlabeled", "source:report-export", ...(snapshot.language ? [`lang:${snapshot.language}`] : [])],
    source: "report-export",
    labeledBy: "draft",
    notes: "",
    snapshot,
    // Left empty on purpose: labels come from a person reading the page, not from the engine's answer.
    expected: { items: {} },
  };
}

export function caseSlug(record: StoredRecord): string {
  const base = `${record.snapshot.hostname}-${record.createdAt.slice(0, 10)}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${base || "page"}-${record.id.slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}
