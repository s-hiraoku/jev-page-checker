import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Question } from "@typesafe-ai/sdk";
import { parseDefinition, type JevAnswer, type JevGateway } from "./checkkit.js";
import { buildCategoryDefinition } from "./category-definition.js";
import { CONTENT_CATEGORY_IDS } from "./category-rubrics.js";
import {
  CONTENT_CLASS_BATTERIES,
  CONTENT_CLASS_CRITERIA,
  CONTENT_CLASS_IDS,
  CONTENT_CLASS_QUESTION_ID,
  askContentClassBattery,
  batteryQuestions,
  contentClassQuestions,
  contentClassState,
  draftTrustScore,
} from "./content-class-battery.js";
import type { PageSnapshot } from "./page-state.js";
import { checkSnapshot } from "./run-check.js";
import { siteQuestionIds } from "./groups.js";

const raw = JSON.parse(readFileSync(new URL("../../fixtures/page-credibility.checker.json", import.meta.url), "utf8"));
const categoryDefinition = buildCategoryDefinition(parseDefinition(raw));

function scoreAnswer(score: number): JevAnswer {
  return { type: "score", score, confidence: 0.91, legend: {}, probabilities: { [String(score)]: 0.91 } };
}

function choiceAnswer(choice: string): JevAnswer {
  return { type: "choice", choice, confidence: 0.91, probabilities: { [choice]: 0.91 } };
}

test("draft trust uses only directed answers and stays unapplied", () => {
  const balanced = draftTrustScore(CONTENT_CLASS_BATTERIES.news_wire, {
    sourcing_strength: scoreAnswer(3),
    headline_sensationalism: scoreAnswer(3),
    correction_or_update_mark: { type: "noul", noul: 0 },
  });
  assert.equal(balanced.value, 0.5);
  assert.equal(balanced.applied, false);
  assert.equal(balanced.threshold, "欠測");
  assert.equal(balanced.weights, "draft-equal");
  assert.equal(balanced.status, "draft");

  const missing = draftTrustScore(CONTENT_CLASS_BATTERIES.news_wire, {
    headline_sensationalism: scoreAnswer(0),
  });
  assert.equal(missing.value, undefined);

  const ugc = draftTrustScore(CONTENT_CLASS_BATTERIES.ugc_sns, {
    corroboration_offered: scoreAnswer(3),
    ragebait_or_hostility: scoreAnswer(0),
    asks_to_trust_unverified: { type: "noul", noul: 1 },
  });
  assert.equal(ugc.value, 2 / 3);
});

test("a class outside the ten ids falls back to the unknown battery", async () => {
  const seen: string[][] = [];
  const gateway: JevGateway = {
    async ask(request) {
      seen.push(Object.keys(request.questions));
      const answers: Record<string, JevAnswer> = {};
      if (Object.hasOwn(request.questions, CONTENT_CLASS_QUESTION_ID)) {
        answers[CONTENT_CLASS_QUESTION_ID] = choiceAnswer("not_a_class");
      }
      if (Object.hasOwn(request.questions, "evidence_presence")) {
        answers.evidence_presence = scoreAnswer(3);
        answers.identity_obfuscation = scoreAnswer(0);
      }
      return { answers, usage: { input_tokens: 2, output_tokens: 1 } };
    },
  };
  const run = await askContentClassBattery(contentClassState({
    title: "Untitled", siteName: "", author: "", description: "", publishedAt: "", language: "en", text: "A page.",
  }), gateway);
  assert.deepEqual(seen[0], [CONTENT_CLASS_QUESTION_ID]);
  assert.equal(seen[1]?.includes("publisher_identifiable"), true);
  assert.equal(seen[1]?.includes("outlet_identified"), false);
  assert.equal(run.summary.classId, "unknown_other");
  assert.equal(run.summary.classSource, "fallback_unknown_other");
  assert.equal(run.summary.fallbackReason, "content_class choice is outside the ten ids");
  assert.equal(run.summary.trust.value, 1);
  assert.equal(run.summary.jevLiveVerification, "欠測");
  assert.equal(run.usage.input_tokens, 4);
});

test("a supplied class skips the classifier question", async () => {
  const seen: string[][] = [];
  const gateway: JevGateway = {
    async ask(request) {
      seen.push(Object.keys(request.questions));
      return {
        answers: {
          claim_specificity: scoreAnswer(0),
          promotional_vs_informational: scoreAnswer(0),
        },
        usage: { input_tokens: 1, output_tokens: 1 },
      };
    },
  };
  const run = await askContentClassBattery(contentClassState({
    title: "Notice", siteName: "Bureau", author: "", description: "", publishedAt: "2026-09-01", language: "en", text: "The bureau posted a notice.",
  }), gateway, "official_primary");
  assert.equal(seen.length, 1);
  assert.equal(seen[0]?.includes(CONTENT_CLASS_QUESTION_ID), false);
  assert.equal(seen[0]?.includes("official_publisher_named"), true);
  assert.equal(run.summary.classSource, "supplied");
  assert.equal(run.summary.classId, "official_primary");
  assert.equal(run.summary.trust.value, 0.5);
});

test("content class state keeps the host out", () => {
  const state = contentClassState({
    title: "Bridge", siteName: "Journal", author: "A. Writer", description: "A report", publishedAt: "2026-09-23", language: "en", text: "The bureau reported a bridge inspection.",
  });
  assert.equal("url" in state, false);
  assert.equal("hostname" in state, false);
  assert.equal(state.title, "Bridge");
  assert.equal(state.text, "The bureau reported a bridge inspection.");
});

test("the ten batteries stay off the approved site and body checklist", () => {
  assert.equal(CONTENT_CATEGORY_IDS.length, 11);
  assert.deepEqual(Object.keys(CONTENT_CLASS_CRITERIA), [...CONTENT_CLASS_IDS]);
  const question = contentClassQuestions()[CONTENT_CLASS_QUESTION_ID] as Question;
  assert.equal(question.type, "choice");
  if (question.type !== "choice") return;
  assert.deepEqual(Object.keys(question.criteria), [...CONTENT_CLASS_IDS]);

  const batteryIds = CONTENT_CLASS_IDS.flatMap((id) => CONTENT_CLASS_BATTERIES[id].map((question) => question.id));
  assert.equal(new Set(batteryIds).size, batteryIds.length);
  assert.equal(batteryIds.includes(CONTENT_CLASS_QUESTION_ID), false);
  const checklist = categoryDefinition.questions.map((question) => String(question.id));
  assert.equal(checklist.includes(CONTENT_CLASS_QUESTION_ID), false);
  for (const id of batteryIds) assert.equal(checklist.includes(id), false);
  assert.deepEqual(siteQuestionIds(categoryDefinition.questions), [
    "identifiable_publisher",
    "honest_identity",
    "site_purpose",
    "disclosed_incentives",
  ]);
  assert.equal(checklist.includes("reporting_event_time"), true);
  assert.equal(checklist.includes("evidence_for_claims"), false);
  assert.equal(categoryDefinition.version, 10);
  for (const id of CONTENT_CLASS_IDS) {
    const questions = batteryQuestions(id);
    assert.deepEqual(Object.keys(questions), CONTENT_CLASS_BATTERIES[id].map((question) => question.id));
  }
});

function snapshot(): PageSnapshot {
  return {
    url: "https://example.test/report",
    hostname: "example.test",
    protocol: "https:",
    title: "Bridge inspection report",
    metaDescription: "A dated report from the transport bureau.",
    author: "A. Writer",
    publishedAt: "2026-09-23",
    siteName: "Example Journal",
    language: "en",
    isHttps: true,
    hasAuthor: true,
    hasPublishedAt: true,
    hasBody: true,
    hasArticle: true,
    pageKind: "article",
    linkCount: 2,
    wordCount: 80,
    citationCount: 1,
    outboundHosts: [],
    text: "The bureau reported a bridge inspection on 23 September and linked the inspection record for readers.",
    textTruncated: false,
    extractedAt: "2026-09-23T00:00:00.000Z",
  };
}

function answeringGateway(): JevGateway & { states: Record<string, unknown>[] } {
  const gateway: JevGateway & { states: Record<string, unknown>[] } = {
    states: [],
    async ask(request) {
      gateway.states.push(request.state as Record<string, unknown>);
      const answers: Record<string, JevAnswer> = {};
      for (const [id, question] of Object.entries(request.questions)) {
        if (question.type === "noul") {
          answers[id] = { type: "noul", noul: 0.95 };
          continue;
        }
        if (question.type === "score") {
          const value = id === "sourcing_strength" ? 3 : id === "headline_sensationalism" ? 0 : 0;
          answers[id] = scoreAnswer(value);
          continue;
        }
        const labels = Object.keys(question.criteria);
        const choice = id === "content_class"
          ? "news_wire"
          : id === "content_primary"
            ? "reporting"
            : id === "content_secondary"
              ? "none"
              : id === "content_evidence"
                ? "title"
                : labels.includes("no")
                  ? "no"
                  : labels.includes("none")
                    ? "none"
                    : labels.includes("pass")
                      ? "pass"
                      : labels.includes("clear")
                        ? "clear"
                        : labels[0] ?? "none";
        answers[id] = choiceAnswer(choice);
      }
      return { answers, usage: { input_tokens: 1, output_tokens: 1 } };
    },
  };
  return gateway;
}

test("a category check keeps the site four and body questions and attaches the draft battery", async () => {
  const gateway = answeringGateway();
  const report = await checkSnapshot(snapshot(), categoryDefinition, gateway);
  assert.equal(report.contentClass?.classId, "news_wire");
  assert.equal(report.contentClass?.classSource, "content_class");
  assert.equal(report.contentClass?.trust.value, 1);
  assert.equal(report.contentClass?.trust.applied, false);
  assert.equal(report.contentClass?.jevLiveVerification, "欠測");
  assert.deepEqual(report.contentClass?.questionIds, CONTENT_CLASS_BATTERIES.news_wire.map((question) => question.id));
  assert.equal(report.items.some((item) => item.id === "content_class"), false);
  assert.equal(report.items.find((item) => item.id === "identifiable_publisher")?.verdict, "pass");
  assert.equal(report.items.find((item) => item.id === "honest_identity")?.verdict, "pass");
  assert.equal(report.items.find((item) => item.id === "site_purpose")?.verdict, "pass");
  assert.equal(report.items.find((item) => item.id === "disclosed_incentives")?.verdict, "pass");
  assert.equal(report.items.some((item) => item.id === "reporting_event_time"), true);
  assert.equal(report.items.some((item) => item.id.startsWith("opinion_")), false);
  assert.deepEqual(report.inspection?.siteQuestionIds, [
    "identifiable_publisher",
    "honest_identity",
    "site_purpose",
    "disclosed_incentives",
  ]);
  const batteryState = gateway.states.find((state) => state.publishedAt === "2026-09-23" && !("url" in state));
  assert.equal(batteryState?.title, "Bridge inspection report");
  assert.equal("hostname" in (batteryState ?? {}), false);
});

test("a non-category checker does not ask the battery", async () => {
  let calls = 0;
  const report = await checkSnapshot({ ...snapshot(), hasArticle: false, pageKind: "portal" }, raw, {
    async ask() {
      calls += 1;
      return { answers: {}, usage: { input_tokens: 1, output_tokens: 1 } };
    },
  });
  assert.equal(report.definition.version, 10);
  assert.equal(report.contentClass, undefined);
  assert.equal(calls, 1);
});
