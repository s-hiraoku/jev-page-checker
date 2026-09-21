import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { replayGateway, parseDefinition, type JevAnswer, type JevGateway } from "./checkkit.js";
import { bodyQuestionIds, siteQuestionIds, worstVerdict } from "./groups.js";
import { bodyTokenBudget, JEV_ENGLISH_CHARS_PER_TOKEN } from "./jev-budget.js";
import type { PageSnapshot } from "./page-state.js";
import { checkSnapshot } from "./run-check.js";

const definition = JSON.parse(readFileSync(new URL("../../fixtures/page-credibility.checker.json", import.meta.url), "utf8"));
const parsed = parseDefinition(definition);
const SITE_QUESTION_IDS = siteQuestionIds(parsed.questions);
const PAGE_QUESTION_IDS = bodyQuestionIds(parsed.questions);

function loadReplay(name: string) {
  return JSON.parse(readFileSync(new URL(`../../fixtures/replay/${name}`, import.meta.url), "utf8")) as {
    state: Omit<PageSnapshot, "extractedAt">;
    answers: Parameters<typeof replayGateway>[0];
    usage: Parameters<typeof replayGateway>[1];
  };
}

async function reportOf(name: string, patch: Partial<PageSnapshot> = {}) {
  const replay = loadReplay(name);
  const snapshot: PageSnapshot = {
    ...replay.state,
    ...patch,
    extractedAt: "2026-09-20T00:00:00.000Z",
    textTruncated: patch.textTruncated ?? replay.state.textTruncated ?? false,
  };
  return checkSnapshot(snapshot, definition, replayGateway(replay.answers, replay.usage));
}

function snapshotOf(name: string, patch: Partial<PageSnapshot> = {}): PageSnapshot {
  const replay = loadReplay(name);
  return {
    ...replay.state,
    ...patch,
    extractedAt: "2026-09-20T00:00:00.000Z",
    textTruncated: patch.textTruncated ?? replay.state.textTruncated ?? false,
  };
}

function twoWindowText(base: string): string {
  const extra = Math.ceil((bodyTokenBudget() + 32) * JEV_ENGLISH_CHARS_PER_TOKEN);
  return `${base} ${"x".repeat(extra)}`;
}

function scriptedGateway(answersList: Record<string, JevAnswer>[]): JevGateway & { calls: number } {
  const gateway: JevGateway & { calls: number } = {
    calls: 0,
    async ask() {
      const answers = answersList[Math.min(gateway.calls, answersList.length - 1)] ?? {};
      gateway.calls += 1;
      return { answers, usage: { input_tokens: 1, output_tokens: 1 } };
    },
  };
  return gateway;
}

test("a sourced news article passes site safety and body scrutiny", async () => {
  const report = await reportOf("page-credibility-pass.json");
  assert.equal(report.definition.version, 5);
  assert.equal(report.items.every((item) => item.verdict === "pass"), true);
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "pass");
  assert.match(report.items.find((item) => item.id === "identifiable_publisher")?.basis ?? "", /identifiable as responsible/);
  assert.match(report.items.find((item) => item.id === "evidence_for_claims")?.basis ?? "", /presented as established/);
});

test("a miracle-cure sales page fails site safety and body scrutiny", async () => {
  const report = await reportOf("page-credibility-fail.json");
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "fail");
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "fail");
  assert.equal(report.items.find((item) => item.id === "identifiable_publisher")?.verdict, "fail");
  assert.equal(report.items.find((item) => item.id === "unsourced_specifics")?.verdict, "fail");
  assert.match(report.items.find((item) => item.id === "identifiable_publisher")?.basis ?? "", /missing, anonymous/);
  assert.match(report.items.find((item) => item.id === "evidence_for_claims")?.basis ?? "", /little or no supporting evidence/);
});

test("a listing skips body questions because there is no single text to scrutinize", async () => {
  const report = await reportOf("page-credibility-portal.json");
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "not_applicable");
  for (const id of PAGE_QUESTION_IDS) {
    assert.equal(report.items.find((item) => item.id === id)?.verdict, "not_applicable");
  }
});

test("an essay purpose is not a site-safety failure", async () => {
  const report = await reportOf("page-credibility-essay.json");
  assert.equal(report.items.find((item) => item.id === "site_purpose")?.verdict, "pass");
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "pass");
});

test("a truncated extract cannot pass body scrutiny even when Jev would pass the prefix", async () => {
  const report = await reportOf("page-credibility-pass.json", { textTruncated: true });
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "review");
  for (const id of PAGE_QUESTION_IDS) {
    assert.equal(report.items.find((item) => item.id === id)?.verdict, "review");
  }
});

test("a truncated extract still reports a body fail found in the prefix", async () => {
  const report = await reportOf("page-credibility-fail.json", { textTruncated: true });
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "fail");
  assert.equal(report.items.find((item) => item.id === "unsourced_specifics")?.verdict, "fail");
});

test("a truncated listing still skips body questions", async () => {
  const report = await reportOf("page-credibility-portal.json", { textTruncated: true });
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "not_applicable");
});

test("an article that fits the Jev token budget is one call", async () => {
  const pass = loadReplay("page-credibility-pass.json");
  const snapshot = snapshotOf("page-credibility-pass.json", { text: `${pass.state.text} ${"x".repeat(12_000)}` });
  const gateway = replayGateway(pass.answers, pass.usage);
  const report = await checkSnapshot(snapshot, definition, gateway);
  assert.equal(gateway.calls, 1);
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "pass");
});

test("a long article asks overlapping body windows and a synthesis, then can pass", async () => {
  const pass = loadReplay("page-credibility-pass.json");
  const snapshot = snapshotOf("page-credibility-pass.json", { text: twoWindowText(pass.state.text) });
  const gateway = replayGateway(pass.answers, pass.usage);
  const report = await checkSnapshot(snapshot, definition, gateway);
  assert.ok(gateway.calls >= 3);
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "pass");
});

test("a later window fail is not overwritten by other window passes", async () => {
  const pass = loadReplay("page-credibility-pass.json");
  const fail = loadReplay("page-credibility-fail.json");
  const snapshot = snapshotOf("page-credibility-pass.json", { text: twoWindowText(pass.state.text) });
  const gateway = scriptedGateway([pass.answers, fail.answers, pass.answers]);
  const report = await checkSnapshot(snapshot, definition, gateway);
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "fail");
  assert.equal(report.items.find((item) => item.id === "unsourced_specifics")?.verdict, "fail");
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
});

test("synthesis fail catches a contradiction that no single window failed", async () => {
  const pass = loadReplay("page-credibility-pass.json");
  const synthesisFail = {
    ...pass.answers,
    self_consistent: { type: "noul" as const, noul: 0.05 },
  };
  const snapshot = snapshotOf("page-credibility-pass.json", { text: twoWindowText(pass.state.text) });
  const gateway = scriptedGateway([pass.answers, pass.answers, synthesisFail]);
  const report = await checkSnapshot(snapshot, definition, gateway);
  assert.equal(report.items.find((item) => item.id === "self_consistent")?.verdict, "fail");
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "fail");
});

test("a long listing still makes one call and skips body questions", async () => {
  const portal = loadReplay("page-credibility-portal.json");
  const snapshot = snapshotOf("page-credibility-portal.json", { text: `${portal.state.text} ${"word ".repeat(4000)}` });
  const gateway = replayGateway(portal.answers, portal.usage);
  const report = await checkSnapshot(snapshot, definition, gateway);
  assert.equal(gateway.calls, 1);
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "not_applicable");
});

test("checkSnapshot records window coverage and lane ids from the definition", async () => {
  const short = await reportOf("page-credibility-pass.json");
  assert.deepEqual(short.inspection?.siteQuestionIds, SITE_QUESTION_IDS);
  assert.deepEqual(short.inspection?.bodyQuestionIds, PAGE_QUESTION_IDS);
  assert.equal(short.inspection?.windowCount, 1);
  assert.equal(short.inspection?.covered, true);
  assert.equal(short.inspection?.unreadRemainder, false);

  const truncated = await reportOf("page-credibility-pass.json", { textTruncated: true });
  assert.equal(truncated.inspection?.unreadRemainder, true);

  const pass = loadReplay("page-credibility-pass.json");
  const long = await checkSnapshot(
    snapshotOf("page-credibility-pass.json", { text: twoWindowText(pass.state.text) }),
    definition,
    replayGateway(pass.answers, pass.usage),
  );
  assert.ok((long.inspection?.windowCount ?? 0) > 1);
  assert.equal(long.inspection?.unreadRemainder, false);
  assert.equal(long.inspection?.covered, true);
});
