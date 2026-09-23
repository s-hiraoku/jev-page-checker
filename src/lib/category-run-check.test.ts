import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { JevAnswer, JevGateway } from "./checkkit.js";
import { buildCategoryDefinition, checksForCategory, triggerChecksForCategory } from "./category-definition.js";
import { parseDefinition } from "./checkkit.js";
import { checkSnapshot } from "./run-check.js";
import type { PageSnapshot } from "./page-state.js";

const raw = JSON.parse(readFileSync(new URL("../../fixtures/page-credibility.checker.json", import.meta.url), "utf8"));
const definition = buildCategoryDefinition(parseDefinition(raw));

function answerFor(id: string, choice: string): JevAnswer {
  return { type: "choice", choice, confidence: 0.9, probabilities: { [choice]: 0.9, other: 0.1 } };
}

function gatewayFor(snapshot: PageSnapshot): JevGateway {
  const classifier: Record<string, JevAnswer> = {
    content_primary: answerFor("content_primary", "reporting"),
    content_secondary: answerFor("content_secondary", "none"),
    content_evidence: answerFor("content_evidence", "title"),
  };
  const site = definition.questions.filter((question) => question.applyWhen === undefined);
  const siteAnswers: Record<string, JevAnswer> = {};
  for (const question of site) {
    if (question.type === "noul") siteAnswers[question.id] = { type: "noul", noul: 0.95 };
    else if (question.type === "choice") {
      const citeChoices: Record<string, string> = {
        identifiable_publisher_cite: "s3",
        honest_identity_cite: "s2",
        site_purpose_cite: "s1",
        disclosed_incentives_cite: "s4",
      };
      siteAnswers[question.id] = answerFor(question.id, citeChoices[question.id] ?? Object.keys(question.criteria)[0]!);
    }
  }
  const triggers: Record<string, JevAnswer> = {};
  for (const trigger of triggerChecksForCategory("reporting")) triggers[trigger.id] = answerFor(trigger.id, "no");
  const body: Record<string, JevAnswer> = {};
  for (const check of checksForCategory("reporting").filter((entry) => !entry.id.includes("_high_stakes") && !entry.id.includes("_cite") || entry.id.endsWith("_cite"))) {
    if (check.id.endsWith("_cite")) body[check.id] = answerFor(check.id, "none");
    else body[check.id] = answerFor(check.id, "pass");
  }
  const replies = [classifier, siteAnswers, triggers, body];
  let index = 0;
  return {
    async ask() {
      return { answers: replies[Math.min(index++, replies.length - 1)]!, usage: { input_tokens: 1, output_tokens: 1 } };
    },
  };
}

function snapshot(): PageSnapshot {
  return {
    url: "https://example.test/report", hostname: "example.test", protocol: "https:", title: "Bridge inspection report",
    metaDescription: "A dated report from the transport bureau.", author: "A. Writer", publishedAt: "2026-09-23", siteName: "Example Journal", language: "en",
    isHttps: true, hasAuthor: true, hasPublishedAt: true, hasBody: true, hasArticle: true, pageKind: "article", linkCount: 2, wordCount: 80,
    citationCount: 1, outboundHosts: [], text: "The bureau reported a bridge inspection on 23 September and linked the inspection record for readers.", textTruncated: false,
    extractedAt: "2026-09-23T00:00:00.000Z",
  };
}

test("v9 selects only the classified category's body questions", async () => {
  const report = await checkSnapshot(snapshot(), definition, gatewayFor(snapshot()));
  assert.equal(report.classification?.primary, "reporting");
  assert.equal(report.classification?.status, "classified");
  assert.ok(report.inspection?.bodyQuestionIds.every((id) => id.startsWith("reporting_")));
  assert.deepEqual(report.inspection?.bodyQuestionGroups?.map((group) => group.categoryId), ["reporting"]);
  assert.equal(report.items.some((item) => item.id.startsWith("opinion_")), false);
  assert.equal(report.items.find((item) => item.id === "identifiable_publisher")?.cite, "A. Writer");
  assert.equal(report.items.find((item) => item.id === "site_purpose")?.cite, "Bridge inspection report");
});

test("classification request failure keeps the site lane in the report", async () => {
  let calls = 0;
  const report = await checkSnapshot(snapshot(), definition, {
    async ask() {
      calls += 1;
      if (calls === 1) throw new Error("classification unavailable");
      return { answers: {}, usage: { input_tokens: 1, output_tokens: 1 } };
    },
  });
  assert.equal(report.classification?.status, "review");
  assert.equal(report.classification?.reasonCode, "classification_error");
  assert.ok(report.items.some((item) => item.id === "identifiable_publisher"));
});

test("conditional probe failure holds its category checks for review", async () => {
  const base = gatewayFor(snapshot());
  let calls = 0;
  const report = await checkSnapshot(snapshot(), definition, {
    async ask(request) {
      calls += 1;
      if (calls === 3) throw new Error("trigger unavailable");
      return base.ask(request);
    },
  });
  assert.equal(report.classification?.status, "classified");
  assert.ok(report.items.some((item) => item.id === "identifiable_publisher"));
  assert.equal(report.items.find((item) => item.id === "reporting_high_stakes")?.verdict, "review");
});
