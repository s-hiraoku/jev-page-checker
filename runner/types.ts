import type {
  ChoiceCriteria,
  ChoiceResponse,
  EntryType,
  JsonValue,
  NoulQuestion,
  NoulResponse,
  ScoreCriteria,
  ScoreResponse,
  Usage,
} from "@typesafe-ai/sdk";
import type { PageSpanSource } from "./spans.js";

export type Verdict = "pass" | "fail" | "review" | "not_applicable" | "error";
export type MappedVerdict = Extract<Verdict, "pass" | "fail" | "review">;

export type CheckerId = string & { readonly __brand: "CheckerId" };
export type QuestionId = string & { readonly __brand: "QuestionId" };

export type Approval = { status: "draft" } | { status: "approved"; at: string; by: string };

export type ApplyWhen =
  | { path: string; op: "exists" }
  | { path: string; op: "equals"; value: JsonValue };

interface CheckBase {
  id: QuestionId;
  instructions: EntryType;
  applyWhen?: ApplyWhen;
}

export type NoulCheck = CheckBase & {
  type: "noul";
  criteria?: NoulQuestion["criteria"];
  passAt?: number;
  failAt?: number;
};

export type ChoiceCheck = CheckBase & {
  type: "choice";
  criteria: ChoiceCriteria;
  options: Record<string, MappedVerdict>;
  confidenceFloor?: number;
  /** When set, this choice selects a sentence for that question and does not vote in a lane. */
  citeFor?: QuestionId;
};

export type ScoreCheck = CheckBase & {
  type: "score";
  criteria: ScoreCriteria;
  passAt: number;
  failAt: number;
  confidenceFloor?: number;
};

export type Check = NoulCheck | ChoiceCheck | ScoreCheck;

export interface CheckerDefinition {
  id: CheckerId;
  version: number;
  subject: string;
  approval: Approval;
  questions: readonly Check[];
}

export type ApprovedDefinition = CheckerDefinition & {
  approval: Extract<Approval, { status: "approved" }>;
};

export type JevAnswer = NoulResponse | ChoiceResponse | ScoreResponse;

export interface ItemResult {
  id: QuestionId;
  verdict: Verdict;
  reason: string;
  basis?: string;
  answer?: JevAnswer;
  /** Page span for this question. It does not vote. Review and Alert keep a span when one was cut. */
  cite?: string;
  /** Whether Jev selected the span or the app attached it only to make the report easier to inspect. */
  citeSource?: "jev" | "related";
  /** Where the selected quote came from when it was captured. */
  citeLocation?: PageSpanSource;
}

export interface ReportWindow {
  start: number;
  end: number;
}

/** Recorded at check time so the UI does not re-run windowing or restated lane ids. */
export interface ReportInspection {
  windowCount: number;
  /** Character offsets recorded at check time so older reports keep their original review windows. */
  windows?: readonly ReportWindow[];
  covered: boolean;
  unreadRemainder: boolean;
  siteQuestionIds: readonly string[];
  bodyQuestionIds: readonly string[];
}

export interface CheckReport {
  definition: { id: CheckerId; version: number };
  items: ItemResult[];
  usage: Usage;
  timing: { wallMs: number; jevMs: number };
  inspection?: ReportInspection;
}
