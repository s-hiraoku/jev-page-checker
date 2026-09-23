import type { EntryType, Usage } from "@typesafe-ai/sdk";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { packSynthesisText, splitOverlappingChunks } from "./body-windows.js";
import { bodyTokenBudget } from "./jev-budget.js";
import {
  evaluate,
  liveGateway,
  parseDefinition,
  type ApprovedDefinition,
  type CheckReport,
  type ItemResult,
  type JevAnswer,
  type JevGateway,
} from "./checkkit.js";
import {
  bodyQuestionIds,
  citeQuestionIds,
  mergeConservativeItem,
  siteQuestionIds,
  softenSynthesisErrors,
  withholdBodyPassOnTruncation,
} from "./groups.js";
import { snapshotToState, type PageSnapshot } from "./page-state.js";

export function createLiveJev(apiKey: string): JevGateway {
  return liveGateway(
    () =>
      new TypeSafeClient({
        apiKey,
        logLevel: "off",
        dangerouslyAllowBrowser: true,
        timeout: 30_000,
      }),
  );
}

function addUsage(left: Usage, right: Usage): Usage {
  return { input_tokens: left.input_tokens + right.input_tokens, output_tokens: left.output_tokens + right.output_tokens };
}

function withQuestions(definition: ApprovedDefinition, ids: readonly string[]): ApprovedDefinition {
  return { ...definition, questions: definition.questions.filter((question) => ids.includes(question.id)) };
}

function findingLine(windowIndex: number, items: readonly ItemResult[], bodyIds: ReadonlySet<string>): string {
  const body = items
    .filter((item) => bodyIds.has(item.id))
    .map((item) => `${item.id}=${item.verdict}${answerNote(item.answer)}`)
    .join("; ");
  return `Window ${windowIndex + 1}: ${body}`;
}

function answerNote(answer: JevAnswer | undefined): string {
  if (answer === undefined) return "";
  if (answer.type === "noul") return ` noul ${answer.noul}`;
  if (answer.type === "choice") return ` choice ${answer.choice}`;
  return ` score ${answer.score}`;
}

function mergeReports(definition: ApprovedDefinition, rounds: readonly CheckReport[]): CheckReport {
  const items = definition.questions
    .filter((question) => question.type !== "choice" || question.citeFor === undefined)
    .map((question) => {
      const versions = rounds.flatMap((round) => round.items.filter((item) => item.id === question.id));
      return mergeConservativeItem(versions);
    });
  return {
    definition: { id: definition.id, version: definition.version },
    items,
    usage: rounds.reduce((sum, round) => addUsage(sum, round.usage), { input_tokens: 0, output_tokens: 0 }),
    timing: {
      wallMs: rounds.reduce((sum, round) => sum + round.timing.wallMs, 0),
      jevMs: rounds.reduce((sum, round) => sum + round.timing.jevMs, 0),
    },
  };
}

function stateForWindow(snapshot: PageSnapshot, text: string): EntryType {
  return snapshotToState({ ...snapshot, text });
}

function stateForSynthesis(snapshot: PageSnapshot, packed: string, findings: readonly string[]): EntryType {
  return {
    ...snapshotToState({ ...snapshot, text: packed }),
    inspection: "whole-article synthesis from overlapping windows",
    chunkFindings: [...findings],
  };
}

export async function checkSnapshot(snapshot: PageSnapshot, definitionRaw: unknown, jev: JevGateway): Promise<CheckReport> {
  const definition = parseDefinition(definitionRaw);
  const siteIds = siteQuestionIds(definition.questions);
  const bodyIds = bodyQuestionIds(definition.questions);
  const bodyIdSet = new Set(bodyIds);
  const citeIds = citeQuestionIds(definition.questions);
  const split = snapshot.hasArticle
    ? splitOverlappingChunks(snapshot.text)
    : { windows: [{ text: snapshot.text, start: 0, end: snapshot.text.length }], covered: true };
  const first = await evaluate(definition, stateForWindow(snapshot, split.windows[0]?.text ?? ""), jev);
  const extraWindows = snapshot.hasArticle ? split.windows.slice(1) : [];
  const bodyDefinition = withQuestions(definition, [...bodyIds, ...citeIds]);
  const extras =
    extraWindows.length === 0
      ? []
      : await Promise.all(extraWindows.map((window) => evaluate(bodyDefinition, stateForWindow(snapshot, window.text), jev)));
  const windowReports = [first, ...extras];
  let rounds = windowReports;
  if (snapshot.hasArticle && split.windows.length > 1) {
    const findings = windowReports.map((report, index) => findingLine(index, report.items, bodyIdSet));
    const packed = packSynthesisText(snapshot.text, split.windows, findings, bodyTokenBudget());
    const synthesis = await evaluate(bodyDefinition, stateForSynthesis(snapshot, packed, findings), jev);
    rounds = [...windowReports, { ...synthesis, items: softenSynthesisErrors(synthesis.items, bodyIds) }];
  }
  const merged = mergeReports(definition, rounds);
  const unread = snapshot.textTruncated === true || (snapshot.hasArticle && !split.covered);
  return {
    ...merged,
    items: withholdBodyPassOnTruncation(merged.items, unread, bodyIds),
    inspection: {
      windowCount: split.windows.length,
      windows: split.windows.map(({ start, end }) => ({ start, end })),
      covered: split.covered,
      unreadRemainder: unread,
      siteQuestionIds: siteIds,
      bodyQuestionIds: bodyIds,
    },
  };
}
