import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildCategoryDefinition } from "./category-definition.js";
import { replayGateway, parseDefinition, type CheckReport, type JevAnswer, type JevGateway } from "./checkkit.js";
import { siteQuestionIds, worstVerdict } from "./groups.js";
import { bodyTokenBudget, JEV_ENGLISH_CHARS_PER_TOKEN } from "./jev-budget.js";
import type { PageSnapshot } from "./page-state.js";
import { checkSnapshot } from "./run-check.js";

const raw = JSON.parse(readFileSync(new URL("../../fixtures/page-credibility.checker.json", import.meta.url), "utf8"));
const definition = buildCategoryDefinition(parseDefinition(raw));
const SITE_QUESTION_IDS = siteQuestionIds(definition.questions);

function bodyLaneIds(report: CheckReport): string[] {
  return (report.inspection?.bodyQuestionIds ?? []).filter((id) => !id.endsWith("_cite") && !id.endsWith("_trigger"));
}

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

test("a sourced news article passes site safety and the reporting body checks", async () => {
  const report = await reportOf("page-credibility-pass.json");
  const bodyIds = bodyLaneIds(report);
  assert.equal(report.definition.version, 10);
  assert.equal(report.classification?.status, "classified");
  assert.equal(report.classification?.primary, "reporting");
  assert.equal(report.items.every((item) => item.verdict === "pass"), true);
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(worstVerdict(report.items, bodyIds), "pass");
  assert.deepEqual(bodyIds, [
    "reporting_event_time",
    "reporting_attribution",
    "reporting_verification",
    "reporting_context",
    "reporting_uncertainty",
  ]);
  assert.match(report.items.find((item) => item.id === "identifiable_publisher")?.basis ?? "", /identifiable as responsible/);
  assert.match(report.items.find((item) => item.id === "reporting_verification")?.basis ?? "", /checkable cue/);
  assert.match(report.items.find((item) => item.id === "reporting_verification")?.cite ?? "", /12 September/);
  assert.equal(report.items.find((item) => item.id === "reporting_verification")?.citeLocation, "body");
  assert.match(report.items.find((item) => item.id === "reporting_attribution")?.cite ?? "", /does not add costs/);
  assert.match(report.items.find((item) => item.id === "reporting_context")?.cite ?? "", /photograph of the south pier/);
  assert.match(report.items.find((item) => item.id === "reporting_event_time")?.cite ?? "", /hairline cracks/);
  assert.match(report.items.find((item) => item.id === "reporting_uncertainty")?.cite ?? "", /opening date/);
  assert.notEqual(
    report.items.find((item) => item.id === "reporting_attribution")?.cite,
    report.items.find((item) => item.id === "reporting_uncertainty")?.cite,
  );
  assert.match(report.items.find((item) => item.id === "identifiable_publisher")?.cite ?? "", /Mina Ito/);
  assert.equal(report.items.find((item) => item.id === "identifiable_publisher")?.citeLocation, "author");
  assert.match(report.items.find((item) => item.id === "honest_identity")?.cite ?? "", /Example News/);
  assert.match(report.items.find((item) => item.id === "site_purpose")?.cite ?? "", /City delays river bridge/);
  assert.match(report.items.find((item) => item.id === "disclosed_incentives")?.cite ?? "", /postponed the opening/);
  for (const id of [...SITE_QUESTION_IDS, ...bodyIds]) {
    assert.ok((report.items.find((item) => item.id === id)?.cite ?? "").length > 0, id);
  }
  assert.equal(report.items.some((item) => item.id.endsWith("_cite")), false);
  assert.equal(report.items.some((item) => item.id === "evidence_for_claims"), false);
});

test("Japanese pass replay keeps body and publisher citations in the right source", async () => {
  const evidenceSentence = "佐藤局長は、ひび割れが9月12日付の点検記録に記載されたと記者団に説明した。";
  const replay = loadReplay("page-credibility-pass.json");
  const snapshot = snapshotOf("page-credibility-pass.json", {
    language: "ja",
    title: "点検後、川の橋の開通を延期　交通局が発表",
    metaDescription: "市の交通局が橋の開通延期を発表し、点検記録を公開しました。",
    author: "佐藤花子",
    siteName: "川まち新聞",
    text: [
      "市の交通局は、川に架かる橋の開通を延期すると発表した。",
      evidenceSentence,
      "交通局はその記録と南側橋脚の写真をウェブサイトで公開した。",
      "佐藤局長は、橋の開通日がまだ決まっていないと述べた。",
      "この記事は公開資料を引用し、交通局が発表していない費用や原因を追加していない。",
    ].join(""),
  });
  const report = await checkSnapshot(snapshot, definition, replayGateway(replay.answers, replay.usage));
  const evidence = report.items.find((item) => item.id === "reporting_verification");
  const publisher = report.items.find((item) => item.id === "identifiable_publisher");
  assert.equal(evidence?.verdict, "pass");
  assert.equal(evidence?.cite, evidenceSentence);
  assert.equal(evidence?.citeLocation, "body");
  assert.equal(publisher?.cite, "佐藤花子");
  assert.equal(publisher?.citeLocation, "author");
});

test("Japanese alert replay keeps the unsupported passage visible", async () => {
  const unsupportedSentence = "無名の診療所は、印のないカプセルで11日以内に若返り、医療費を94％減らせると証明されたと主張した。";
  const replay = loadReplay("page-credibility-fail.json");
  const snapshot = snapshotOf("page-credibility-fail.json", {
    language: "ja",
    title: "一粒で若返る新薬、11日で効果　医師も認める",
    metaDescription: "規制当局が禁止する前に、今すぐ半年分をご注文ください。",
    siteName: "健康特報",
    text: [
      unsupportedSentence,
      "同じ診療所は後になって、効果は3日で現れると説明した。",
      "規制当局が禁止する前に、半年分を今すぐ注文するよう読者に促している。",
      "研究、著者、製造元はいずれも記載されていない。",
      "ページは、すべての医師が知っているのにこの情報を隠していると述べている。",
    ].join(""),
  });
  const answers = {
    ...replay.answers,
    sales_offer_cost_cite: {
      type: "choice" as const,
      choice: "s1",
      confidence: 0.88,
      probabilities: { s1: 0.88, none: 0.12 },
    },
    sales_claims_cite: {
      type: "choice" as const,
      choice: "s1",
      confidence: 0.9,
      probabilities: { s1: 0.9, none: 0.1 },
    },
  };
  const report = await checkSnapshot(snapshot, definition, replayGateway(answers, replay.usage));
  const offer = report.items.find((item) => item.id === "sales_offer_cost");
  const claims = report.items.find((item) => item.id === "sales_claims");
  assert.equal(offer?.verdict, "fail");
  assert.equal(claims?.verdict, "fail");
  assert.equal(offer?.cite, unsupportedSentence);
  assert.equal(claims?.cite, unsupportedSentence);
  assert.equal(offer?.citeLocation, "body");
});

test("a low-confidence cite still shows that span and the parent chip stays", async () => {
  const replay = loadReplay("page-credibility-pass.json");
  const snapshot = snapshotOf("page-credibility-pass.json");
  const low = {
    ...replay.answers,
    reporting_verification_cite: {
      type: "choice" as const,
      choice: "s2",
      confidence: 0.2,
      probabilities: { s2: 0.2, none: 0.8 },
    },
  };
  const lowReport = await checkSnapshot(snapshot, definition, replayGateway(low, replay.usage));
  const lowEvidence = lowReport.items.find((item) => item.id === "reporting_verification");
  assert.equal(lowEvidence?.verdict, "pass");
  assert.match(lowEvidence?.cite ?? "", /12 September/);
  assert.equal(lowEvidence?.citeSource, "jev");
});

test("Review and Alert rows show the causing sentence, not the Pass sentence", async () => {
  const replay = loadReplay("page-credibility-pass.json");
  const snapshot = snapshotOf("page-credibility-pass.json");
  const collapsed = {
    ...replay.answers,
    reporting_attribution: {
      type: "choice" as const,
      choice: "alert",
      confidence: 0.92,
      probabilities: { alert: 0.92, pass: 0.08 },
    },
    reporting_attribution_cite: {
      type: "choice" as const,
      choice: "none",
      confidence: 0.2,
      probabilities: { none: 0.8, s1: 0.2 },
    },
    reporting_context: {
      type: "choice" as const,
      choice: "review",
      confidence: 0.9,
      probabilities: { review: 0.9, pass: 0.1 },
    },
    reporting_context_cite: {
      type: "choice" as const,
      choice: "none",
      confidence: 0.3,
      probabilities: { none: 0.7, s3: 0.3 },
    },
  };
  const gateway = replayGateway(collapsed, replay.usage);
  const report = await checkSnapshot(snapshot, definition, gateway);
  const evidence = report.items.find((item) => item.id === "reporting_verification");
  const attribution = report.items.find((item) => item.id === "reporting_attribution");
  const context = report.items.find((item) => item.id === "reporting_context");
  assert.equal(evidence?.verdict, "pass");
  assert.equal(attribution?.verdict, "fail");
  assert.equal(context?.verdict, "review");
  assert.match(evidence?.cite ?? "", /12 September/);
  assert.ok((attribution?.cite ?? "").length > 0);
  assert.ok((context?.cite ?? "").length > 0);
  assert.notEqual(attribution?.cite, evidence?.cite);
  assert.notEqual(context?.cite, evidence?.cite);
  assert.notEqual(attribution?.cite, context?.cite);
  assert.equal(evidence?.citeSource, "jev");
  assert.equal(attribution?.citeSource, "related");
  assert.equal(context?.citeSource, "related");
  assert.equal(report.items.some((item) => item.id.endsWith("_cite")), false);
});

test("site cites keep the failure sentence and category cites keep the body-11 sentence", () => {
  const cites = definition.questions.flatMap((question) =>
    question.type === "choice" && question.citeFor !== undefined ? [question] : [],
  );
  const siteCites = cites.filter((question) => SITE_QUESTION_IDS.includes(question.citeFor ?? ""));
  const bodyCites = cites.filter((question) => !SITE_QUESTION_IDS.includes(question.citeFor ?? ""));
  assert.equal(siteCites.length, 4);
  assert.ok(bodyCites.length > siteCites.length);
  for (const question of siteCites) {
    const text = typeof question.instructions === "string" ? question.instructions : "";
    assert.match(text, /causes the failure/);
    assert.equal(text.includes("most carries"), false);
  }
  for (const question of bodyCites) {
    const text = typeof question.instructions === "string" ? question.instructions : "";
    assert.match(text, /exact sentence cut from the main body/);
    assert.equal(text.includes("causes the failure"), false);
  }
  for (const id of SITE_QUESTION_IDS) {
    const question = definition.questions.find((item) => item.id === id);
    const text = typeof question?.instructions === "string" ? question.instructions : "";
    assert.equal(text.includes("Do not write a new sentence"), false);
  }
});

test("a miracle-cure sales page fails safety and body scrutiny without penalizing clear purpose", async () => {
  const report = await reportOf("page-credibility-fail.json");
  const bodyIds = bodyLaneIds(report);
  assert.equal(report.classification?.primary, "sales");
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "fail");
  assert.equal(worstVerdict(report.items, bodyIds), "fail");
  assert.equal(report.items.find((item) => item.id === "identifiable_publisher")?.verdict, "fail");
  assert.equal(report.items.find((item) => item.id === "sales_claims")?.verdict, "fail");
  assert.match(report.items.find((item) => item.id === "identifiable_publisher")?.basis ?? "", /missing, anonymous/);
  assert.match(report.items.find((item) => item.id === "sales_offer_cost")?.basis ?? "", /Offer and cost/);
  assert.match(report.items.find((item) => item.id === "sales_offer_cost")?.cite ?? "", /11 days/);
  assert.match(report.items.find((item) => item.id === "sales_risks")?.cite ?? "", /hiding it/);
  assert.match(report.items.find((item) => item.id === "sales_claims")?.cite ?? "", /94 percent/);
  assert.notEqual(
    report.items.find((item) => item.id === "sales_offer_cost")?.cite,
    report.items.find((item) => item.id === "sales_claims")?.cite,
  );
  assert.match(report.items.find((item) => item.id === "sales_terms")?.cite ?? "", /three days/);
  assert.match(report.items.find((item) => item.id === "sales_testimonials")?.cite ?? "", /manufacturer is named/);
  assert.match(report.items.find((item) => item.id === "identifiable_publisher")?.cite ?? "", /manufacturer is named/);
  assert.equal(report.items.find((item) => item.id === "site_purpose")?.verdict, "pass");
  assert.match(report.items.find((item) => item.id === "site_purpose")?.cite ?? "", /six-month supply/);
  assert.equal(report.items.find((item) => item.id === "disclosed_incentives")?.verdict, "fail");
  assert.match(report.items.find((item) => item.id === "disclosed_incentives")?.cite ?? "", /Order now/);
  for (const id of [...SITE_QUESTION_IDS, ...bodyIds]) {
    assert.ok((report.items.find((item) => item.id === id)?.cite ?? "").length > 0, id);
  }
});

test("a listing skips body questions because there is no single text to scrutinize", async () => {
  const report = await reportOf("page-credibility-portal.json");
  assert.equal(report.classification?.status, "not_applicable");
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.deepEqual(report.inspection?.bodyQuestionIds, []);
  assert.equal(report.items.some((item) => item.id.startsWith("reporting_")), false);
});

test("an essay purpose is not a site-safety failure", async () => {
  const report = await reportOf("page-credibility-essay.json");
  assert.equal(report.classification?.primary, "opinion");
  assert.equal(report.items.find((item) => item.id === "site_purpose")?.verdict, "pass");
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(worstVerdict(report.items, bodyLaneIds(report)), "pass");
  assert.ok(bodyLaneIds(report).every((id) => id.startsWith("opinion_")));
});

test("a truncated extract cannot pass body scrutiny even when Jev would pass the prefix", async () => {
  const report = await reportOf("page-credibility-pass.json", { textTruncated: true });
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(report.classification?.status, "review");
  assert.equal(report.classification?.reasonCode, "incomplete_body");
  assert.deepEqual(report.inspection?.bodyQuestionIds, ["content_classification"]);
  assert.equal(report.items.find((item) => item.id === "content_classification")?.verdict, "review");
  assert.equal(report.items.some((item) => item.id.startsWith("reporting_")), false);
});

test("a truncated extract does not grade the category battery from the prefix", async () => {
  const report = await reportOf("page-credibility-fail.json", { textTruncated: true });
  assert.equal(report.classification?.reasonCode, "incomplete_body");
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "fail");
  assert.deepEqual(report.inspection?.bodyQuestionIds, ["content_classification"]);
  assert.equal(report.items.find((item) => item.id === "content_classification")?.verdict, "review");
  assert.equal(report.items.some((item) => item.id.startsWith("sales_")), false);
});

test("a truncated listing still skips body questions", async () => {
  const report = await reportOf("page-credibility-portal.json", { textTruncated: true });
  assert.deepEqual(report.inspection?.bodyQuestionIds, []);
});

test("an article that fits one window asks classification, site, triggers, and body", async () => {
  const pass = loadReplay("page-credibility-pass.json");
  const snapshot = snapshotOf("page-credibility-pass.json", { text: `${pass.state.text} ${"x".repeat(12_000)}` });
  const gateway = replayGateway(pass.answers, pass.usage);
  const report = await checkSnapshot(snapshot, definition, gateway);
  assert.equal(gateway.calls, 4);
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(worstVerdict(report.items, bodyLaneIds(report)), "pass");
});

test("a long article asks overlapping body windows and a synthesis, then can pass", async () => {
  const pass = loadReplay("page-credibility-pass.json");
  const snapshot = snapshotOf("page-credibility-pass.json", { text: twoWindowText(pass.state.text) });
  const gateway = replayGateway(pass.answers, pass.usage);
  const report = await checkSnapshot(snapshot, definition, gateway);
  assert.equal(gateway.calls, 8);
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(worstVerdict(report.items, bodyLaneIds(report)), "pass");
});

function bodyRoundGateway(passAnswers: Record<string, JevAnswer>, failOnBodyCall: number): JevGateway & { calls: number } {
  let bodyCalls = 0;
  const gateway: JevGateway & { calls: number } = {
    calls: 0,
    async ask(request) {
      gateway.calls += 1;
      const ids = Object.keys(request.questions);
      const isBody = ids.some((id) => id.startsWith("reporting_") && !id.endsWith("_trigger"));
      let answers = passAnswers;
      if (isBody) {
        bodyCalls += 1;
        if (bodyCalls === failOnBodyCall) {
          answers = {
            ...passAnswers,
            reporting_event_time: {
              type: "choice",
              choice: "alert",
              confidence: 0.9,
              probabilities: { alert: 0.9, pass: 0.1 },
            },
          };
        }
      }
      return { answers, usage: { input_tokens: 1, output_tokens: 1 } };
    },
  };
  return gateway;
}

test("a later window fail is not overwritten by other window passes", async () => {
  const pass = loadReplay("page-credibility-pass.json");
  const snapshot = snapshotOf("page-credibility-pass.json", { text: twoWindowText(pass.state.text) });
  const gateway = bodyRoundGateway(pass.answers, 2);
  const report = await checkSnapshot(snapshot, definition, gateway);
  assert.equal(report.items.find((item) => item.id === "reporting_event_time")?.verdict, "fail");
  assert.equal(worstVerdict(report.items, bodyLaneIds(report)), "fail");
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
});

test("synthesis fail catches a contradiction that no single window failed", async () => {
  const pass = loadReplay("page-credibility-pass.json");
  const snapshot = snapshotOf("page-credibility-pass.json", { text: twoWindowText(pass.state.text) });
  const gateway = bodyRoundGateway(pass.answers, 3);
  const report = await checkSnapshot(snapshot, definition, gateway);
  assert.equal(report.items.find((item) => item.id === "reporting_event_time")?.verdict, "fail");
  assert.equal(worstVerdict(report.items, bodyLaneIds(report)), "fail");
});

test("a long listing still makes one call and skips body questions", async () => {
  const portal = loadReplay("page-credibility-portal.json");
  const snapshot = snapshotOf("page-credibility-portal.json", { text: `${portal.state.text} ${"word ".repeat(4000)}` });
  const gateway = replayGateway(portal.answers, portal.usage);
  const report = await checkSnapshot(snapshot, definition, gateway);
  assert.equal(gateway.calls, 1);
  assert.deepEqual(report.inspection?.bodyQuestionIds, []);
});

test("checkSnapshot records window coverage and lane ids from the definition", async () => {
  const short = await reportOf("page-credibility-pass.json");
  assert.deepEqual(short.inspection?.siteQuestionIds, SITE_QUESTION_IDS);
  assert.deepEqual(bodyLaneIds(short), [
    "reporting_event_time",
    "reporting_attribution",
    "reporting_verification",
    "reporting_context",
    "reporting_uncertainty",
  ]);
  assert.equal(short.inspection?.windowCount, 1);
  assert.deepEqual(short.inspection?.windows, [{ start: 0, end: snapshotOf("page-credibility-pass.json").text.length }]);
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
  assert.equal(long.inspection?.windows?.length, long.inspection?.windowCount);
  assert.deepEqual(long.inspection?.windows?.[0], { start: 0, end: long.inspection?.windows?.[0]?.end });
  assert.equal(long.inspection?.windows?.at(-1)?.end, snapshotOf("page-credibility-pass.json", { text: twoWindowText(pass.state.text) }).text.length);
  assert.equal(long.inspection?.unreadRemainder, false);
  assert.equal(long.inspection?.covered, true);
});
