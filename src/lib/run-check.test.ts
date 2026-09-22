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
  assert.equal(report.definition.version, 8);
  assert.equal(report.items.every((item) => item.verdict === "pass"), true);
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "pass");
  assert.match(report.items.find((item) => item.id === "identifiable_publisher")?.basis ?? "", /identifiable as responsible/);
  assert.match(report.items.find((item) => item.id === "evidence_for_claims")?.basis ?? "", /presented as established/);
  assert.match(report.items.find((item) => item.id === "evidence_for_claims")?.cite ?? "", /12 September/);
  assert.match(report.items.find((item) => item.id === "separates_fact_and_opinion")?.cite ?? "", /does not add costs/);
  assert.match(report.items.find((item) => item.id === "unsourced_specifics")?.cite ?? "", /photograph of the south pier/);
  assert.match(report.items.find((item) => item.id === "self_consistent")?.cite ?? "", /hairline cracks/);
  assert.match(report.items.find((item) => item.id === "certainty_matches_evidence")?.cite ?? "", /opening date/);
  assert.notEqual(
    report.items.find((item) => item.id === "separates_fact_and_opinion")?.cite,
    report.items.find((item) => item.id === "certainty_matches_evidence")?.cite,
  );
  assert.match(report.items.find((item) => item.id === "identifiable_publisher")?.cite ?? "", /Mina Ito/);
  assert.match(report.items.find((item) => item.id === "honest_identity")?.cite ?? "", /Example News/);
  assert.match(report.items.find((item) => item.id === "site_purpose")?.cite ?? "", /City delays river bridge/);
  assert.match(report.items.find((item) => item.id === "disclosed_incentives")?.cite ?? "", /postponed the opening/);
  for (const id of SITE_QUESTION_IDS) {
    assert.ok((report.items.find((item) => item.id === id)?.cite ?? "").length > 0, id);
  }
  assert.equal(report.items.some((item) => item.id.endsWith("_cite")), false);
});

test("a low-confidence cite still shows that span and the parent chip stays", async () => {
  const replay = loadReplay("page-credibility-pass.json");
  const snapshot = snapshotOf("page-credibility-pass.json");
  const low = {
    ...replay.answers,
    evidence_for_claims_cite: {
      type: "choice" as const,
      choice: "s2",
      confidence: 0.2,
      probabilities: { s2: 0.2, none: 0.8 },
    },
  };
  const lowReport = await checkSnapshot(snapshot, definition, replayGateway(low, replay.usage));
  const lowEvidence = lowReport.items.find((item) => item.id === "evidence_for_claims");
  assert.equal(lowEvidence?.verdict, "pass");
  assert.match(lowEvidence?.cite ?? "", /12 September/);
});

test("Review and Alert rows show the causing sentence, not the Pass sentence", async () => {
  const replay = loadReplay("page-credibility-pass.json");
  const snapshot = snapshotOf("page-credibility-pass.json");
  const collapsed = {
    ...replay.answers,
    unsourced_specifics: {
      type: "choice" as const,
      choice: "many",
      confidence: 0.92,
      probabilities: { none: 0.02, some: 0.06, many: 0.92 },
    },
    unsourced_specifics_cite: {
      type: "choice" as const,
      choice: "none",
      confidence: 0.2,
      probabilities: { none: 0.8, s2: 0.2 },
    },
    self_consistent: { type: "noul" as const, noul: 0.4 },
    self_consistent_cite: {
      type: "choice" as const,
      choice: "s2",
      confidence: 0.3,
      probabilities: { s2: 0.3, none: 0.7 },
    },
  };
  const gateway = replayGateway(collapsed, replay.usage);
  const report = await checkSnapshot(snapshot, definition, gateway);
  const evidence = report.items.find((item) => item.id === "evidence_for_claims");
  const specifics = report.items.find((item) => item.id === "unsourced_specifics");
  const consistent = report.items.find((item) => item.id === "self_consistent");
  assert.equal(evidence?.verdict, "pass");
  assert.equal(specifics?.verdict, "fail");
  assert.equal(consistent?.verdict, "review");
  assert.match(evidence?.cite ?? "", /12 September/);
  assert.ok((specifics?.cite ?? "").length > 0);
  assert.ok((consistent?.cite ?? "").length > 0);
  assert.notEqual(specifics?.cite, evidence?.cite);
  assert.notEqual(consistent?.cite, evidence?.cite);
  assert.notEqual(specifics?.cite, consistent?.cite);
  assert.equal(report.items.some((item) => item.id.endsWith("_cite")), false);
  assert.equal(gateway.calls, 2);
});

test("each cite question asks for the sentence that bears on that question", () => {
  const cites = parsed.questions.filter((question) => question.type === "choice" && question.citeFor !== undefined);
  const texts = cites.map((question) => (typeof question.instructions === "string" ? question.instructions : ""));
  assert.equal(new Set(texts).size, 9);
  for (const text of texts) {
    assert.match(text, /causes the failure/);
    assert.equal(text.includes("most carries"), false);
  }
  for (const id of [...SITE_QUESTION_IDS, ...PAGE_QUESTION_IDS]) {
    const question = parsed.questions.find((item) => item.id === id);
    const text = typeof question?.instructions === "string" ? question.instructions : "";
    assert.equal(text.includes("Do not write a new sentence"), false);
  }
});

test("a miracle-cure sales page fails site safety and body scrutiny", async () => {
  const report = await reportOf("page-credibility-fail.json");
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "fail");
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "fail");
  assert.equal(report.items.find((item) => item.id === "identifiable_publisher")?.verdict, "fail");
  assert.equal(report.items.find((item) => item.id === "unsourced_specifics")?.verdict, "fail");
  assert.match(report.items.find((item) => item.id === "identifiable_publisher")?.basis ?? "", /missing, anonymous/);
  assert.match(report.items.find((item) => item.id === "evidence_for_claims")?.basis ?? "", /little or no supporting evidence/);
  assert.match(report.items.find((item) => item.id === "evidence_for_claims")?.cite ?? "", /11 days/);
  assert.match(report.items.find((item) => item.id === "separates_fact_and_opinion")?.cite ?? "", /hiding it/);
  assert.match(report.items.find((item) => item.id === "unsourced_specifics")?.cite ?? "", /94 percent/);
  assert.notEqual(
    report.items.find((item) => item.id === "evidence_for_claims")?.cite,
    report.items.find((item) => item.id === "unsourced_specifics")?.cite,
  );
  assert.match(report.items.find((item) => item.id === "self_consistent")?.cite ?? "", /three days/);
  assert.match(report.items.find((item) => item.id === "certainty_matches_evidence")?.cite ?? "", /six-month supply/);
  assert.match(report.items.find((item) => item.id === "identifiable_publisher")?.cite ?? "", /manufacturer is named/);
  assert.equal(report.items.find((item) => item.id === "site_purpose")?.verdict, "review");
  assert.match(report.items.find((item) => item.id === "site_purpose")?.cite ?? "", /six-month supply/);
  assert.equal(report.items.find((item) => item.id === "disclosed_incentives")?.verdict, "fail");
  assert.match(report.items.find((item) => item.id === "disclosed_incentives")?.cite ?? "", /Order now/);
  for (const id of [...SITE_QUESTION_IDS, ...PAGE_QUESTION_IDS]) {
    assert.ok((report.items.find((item) => item.id === id)?.cite ?? "").length > 0, id);
  }
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
