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
import { classifyContent } from "./content-classifier.js";
import { CONTENT_CATEGORY_IDS, CATEGORY_RUBRICS, type ContentCategoryId } from "./category-rubrics.js";
import { triggerChecksForCategory } from "./category-definition.js";
import { buildRequest } from "../../runner/jev.js";
import type { ChoiceCriteria } from "@typesafe-ai/sdk";

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

function isCategoryDefinition(definition: ApprovedDefinition): boolean {
  return definition.version >= 9 && definition.questions.some((question) => CONTENT_CATEGORY_IDS.some((id) => question.id.startsWith(`${id}_`)));
}

function categoryDescriptions(): Record<string, string> {
  return Object.fromEntries(CONTENT_CATEGORY_IDS.map((id) => {
    const rubric = CATEGORY_RUBRICS[id];
    const cues = rubric.items.slice(0, 3).map((item) => `${item.label.en}: ${item.instruction}`).join(" ");
    return [id, `${rubric.label.en}. ${cues}`];
  }));
}

function categoryQuestionIds(definition: ApprovedDefinition, category: ContentCategoryId, conditional: ReadonlySet<string>): string[] {
  const prefix = `${category}_`;
  return definition.questions
    .filter((question) => question.id.startsWith(prefix))
    .filter((question) => !question.id.endsWith("_trigger"))
    .filter((question) => {
      const rubricId = question.id.endsWith("_cite") ? question.id.slice(0, -5) : question.id;
      const isConditional = CATEGORY_RUBRICS[category].conditionalProbes.some((probe) => probe.id === rubricId);
      return !isConditional || conditional.has(rubricId);
    })
    .map((question) => question.id);
}

function siteCheckIds(definition: ApprovedDefinition, siteIds: readonly string[]): string[] {
  const site = new Set(siteIds);
  return definition.questions
    .filter((question) => site.has(question.id) || (question.type === "choice" && question.citeFor !== undefined && site.has(question.citeFor)))
    .map((question) => question.id);
}

async function activeConditionalProbes(
  snapshot: PageSnapshot,
  windows: readonly { text: string; start: number; end: number }[],
  category: ContentCategoryId,
  jev: JevGateway,
): Promise<{ active: Set<string>; uncertain: Set<string>; usage: Usage; jevMs: number }> {
  const triggers = triggerChecksForCategory(category);
  const active = new Set<string>();
  const uncertain = new Set<string>();
  let usage: Usage = { input_tokens: 0, output_tokens: 0 };
  let jevMs = 0;
  for (const window of windows) {
    if (triggers.length === 0) break;
    const checks = triggers.map((trigger) => ({
      id: trigger.id,
      type: "choice" as const,
      instructions: trigger.instructions,
      criteria: trigger.choices as ChoiceCriteria,
      options: { yes: "pass", no: "pass", unclear: "review" } as const,
      confidenceFloor: trigger.confidenceFloor,
      applyWhen: { path: "hasArticle", op: "equals", value: true } as const,
    }));
    const started = performance.now();
    let reply;
    try {
      reply = await jev.ask(buildRequest(stateForWindow(snapshot, window.text), checks));
    } catch {
      for (const trigger of triggers) uncertain.add(trigger.rubricItemId);
      continue;
    }
    jevMs += Math.round(performance.now() - started);
    usage = addUsage(usage, reply.usage);
    for (const trigger of triggers) {
      const answer = reply.answers[trigger.id];
      if (answer?.type !== "choice" || answer.confidence < trigger.confidenceFloor || answer.choice === "unclear") {
        uncertain.add(trigger.rubricItemId);
      } else if (answer.choice === "yes") {
        active.add(trigger.rubricItemId);
      }
    }
  }
  return { active, uncertain, usage, jevMs };
}

async function checkCategorizedSnapshot(snapshot: PageSnapshot, definition: ApprovedDefinition, jev: JevGateway, split: ReturnType<typeof splitOverlappingChunks>): Promise<CheckReport> {
  let classification;
  try {
    classification = await classifyContent(snapshot, split.windows, jev, categoryDescriptions());
  } catch {
    classification = {
      status: "review" as const,
      reasonCode: "classification_error" as const,
      reason: "The body classification request failed.",
      windows: [],
      usage: { input_tokens: 0, output_tokens: 0 },
      timing: { wallMs: 0, jevMs: 0 },
    };
  }
  const siteIds = siteQuestionIds(definition.questions);
  const siteDefinition = withQuestions(definition, siteCheckIds(definition, siteIds));
  const site = await evaluate(siteDefinition, stateForWindow(snapshot, split.windows[0]?.text ?? ""), jev);
  const emptyBody = (): CheckReport => ({
    ...site,
    items: [...site.items, ...(snapshot.hasArticle ? [{ id: "content_classification" as any, verdict: "review" as const, reason: classification.reason ?? "Content category needs review." }] : [])],
    classification,
    inspection: { windowCount: split.windows.length, windows: split.windows.map(({ start, end }) => ({ start, end })), covered: split.covered, unreadRemainder: snapshot.textTruncated === true || !split.covered, siteQuestionIds: siteIds, bodyQuestionIds: snapshot.hasArticle ? ["content_classification"] : [] },
  });
  if (!snapshot.hasArticle || classification.status !== "classified" || !classification.primary) return emptyBody();
  const selected = [classification.primary, classification.secondary].filter((id): id is ContentCategoryId => CONTENT_CATEGORY_IDS.includes(id as ContentCategoryId));
  const active = new Set<string>();
  const uncertain = new Set<string>();
  let usage = addUsage(site.usage, classification.usage);
  let jevMs = site.timing.jevMs + classification.timing.jevMs;
  for (const category of selected) {
    const probes = await activeConditionalProbes(snapshot, split.windows, category, jev);
    usage = addUsage(usage, probes.usage);
    jevMs += probes.jevMs;
    for (const id of probes.active) active.add(id);
    for (const id of probes.uncertain) uncertain.add(id);
  }
  const routed = new Set([...active, ...uncertain]);
  const bodyGroups = selected.map((category) => ({ categoryId: category, questionIds: categoryQuestionIds(definition, category, routed) }));
  const bodyIds = bodyGroups.flatMap((group) => group.questionIds);
  const bodyDefinition = withQuestions(definition, bodyIds);
  const windowReports = await Promise.all(split.windows.map((window) => evaluate(bodyDefinition, stateForWindow(snapshot, window.text), jev)));
  let rounds = windowReports;
  if (split.windows.length > 1) {
    const bodyIdSet = new Set(bodyIds);
    const findings = windowReports.map((report, index) => findingLine(index, report.items, bodyIdSet));
    const packed = packSynthesisText(snapshot.text, split.windows, findings, bodyTokenBudget());
    const synthesis = await evaluate(bodyDefinition, stateForSynthesis(snapshot, packed, findings), jev);
    rounds = [...windowReports, { ...synthesis, items: softenSynthesisErrors(synthesis.items, bodyIds) }];
  }
  const merged = mergeReports(bodyDefinition, rounds);
  const withheld = withholdBodyPassOnTruncation(merged.items, snapshot.textTruncated === true || !split.covered, bodyIds);
  const onlyUncertain = new Set([...uncertain].filter((id) => !active.has(id)));
  const bodyItems = onlyUncertain.size > 0
    ? withheld.map((item): ItemResult => onlyUncertain.has(item.id) ? { ...item, verdict: item.verdict === "fail" ? "fail" : "review", reason: `conditional probe was uncertain; ${item.reason}` } : item)
    : withheld;
  return {
    ...merged,
    items: [...site.items, ...bodyItems],
    usage: addUsage(usage, merged.usage),
    timing: { wallMs: site.timing.wallMs + classification.timing.wallMs + merged.timing.wallMs, jevMs: jevMs + merged.timing.jevMs },
    classification,
    inspection: { windowCount: split.windows.length, windows: split.windows.map(({ start, end }) => ({ start, end })), covered: split.covered, unreadRemainder: snapshot.textTruncated === true || !split.covered, siteQuestionIds: siteIds, bodyQuestionIds: bodyIds, bodyQuestionGroups: bodyGroups },
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
  if (isCategoryDefinition(definition)) return checkCategorizedSnapshot(snapshot, definition, jev, split);
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
