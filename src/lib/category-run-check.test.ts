import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { JevAnswer, JevGateway, JevReply } from "./checkkit.js";
import { buildCategoryDefinition, checksForCategory, triggerChecksForCategory } from "./category-definition.js";
import { parseDefinition } from "./checkkit.js";
import { bodyWindowCharBudget } from "./jev-budget.js";
import { checkSnapshot } from "./run-check.js";
import type { PageSnapshot } from "./page-state.js";

const raw = JSON.parse(readFileSync(new URL("../../fixtures/page-credibility.checker.json", import.meta.url), "utf8"));
const definition = buildCategoryDefinition(parseDefinition(raw));

function answerFor(id: string, choice: string): JevAnswer {
  return { type: "choice", choice, confidence: 0.9, probabilities: id.startsWith("content_") ? { [choice]: 0.9 } : { [choice]: 0.9, other: 0.1 } };
}

function gatewayFor(): JevGateway {
  const classifier: Record<string, JevAnswer> = {
    content_primary: answerFor("content_primary", "reporting"),
    content_secondary: answerFor("content_secondary", "none"),
    content_evidence: answerFor("content_evidence", "title"),
  };
  const siteTypeAnswers: Record<string, JevAnswer> = {
    site_type: { type: "choice", choice: "news_wire", confidence: 0.88, probabilities: { news_wire: 0.88, official_primary: 0.12 } },
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
  return {
    async ask(request) {
      const ids = Object.keys(request.questions);
      const answers = ids.includes("site_type")
        ? siteTypeAnswers
        : ids.includes("content_primary")
          ? classifier
          : ids.some((id) => id.endsWith("_trigger"))
            ? triggers
            : ids.some((id) => id.startsWith("reporting_"))
              ? body
              : siteAnswers;
      return { answers, usage: { input_tokens: 1, output_tokens: 1 } };
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
  const report = await checkSnapshot(snapshot(), definition, gatewayFor());
  assert.equal(report.definition.version, 10);
  assert.equal(report.classification?.primary, "reporting");
  assert.equal(report.classification?.status, "classified");
  assert.equal(report.siteType?.status, "classified");
  assert.equal(report.siteType?.id, "news_wire");
  assert.ok(report.inspection?.bodyQuestionIds.every((id) => id.startsWith("reporting_")));
  assert.deepEqual(report.inspection?.bodyQuestionGroups?.map((group) => group.categoryId), ["reporting"]);
  assert.equal(report.items.some((item) => item.id.startsWith("opinion_")), false);
  assert.equal(report.items.find((item) => item.id === "identifiable_publisher")?.cite, "A. Writer");
  assert.equal(report.items.find((item) => item.id === "site_purpose")?.cite, "Bridge inspection report");
});

test("classification request failure keeps the site lane in the report", async () => {
  const report = await checkSnapshot(snapshot(), definition, {
    async ask(request): Promise<JevReply> {
      if ("content_primary" in request.questions) throw new Error("classification unavailable");
      if ("site_type" in request.questions) {
        return {
          answers: {
            site_type: { type: "choice", choice: "official_primary", confidence: 0.8, probabilities: { official_primary: 0.8 } },
          },
          usage: { input_tokens: 1, output_tokens: 1 },
        };
      }
      return { answers: {}, usage: { input_tokens: 1, output_tokens: 1 } };
    },
  });
  assert.equal(report.classification?.status, "review");
  assert.equal(report.classification?.reasonCode, "classification_error");
  assert.equal(report.siteType?.id, "official_primary");
  assert.ok(report.items.some((item) => item.id === "identifiable_publisher"));
});

test("conditional probe failure holds its category checks for review", async () => {
  const base = gatewayFor();
  const report = await checkSnapshot(snapshot(), definition, {
    async ask(request) {
      if (Object.keys(request.questions).some((id) => id.endsWith("_trigger"))) throw new Error("trigger unavailable");
      return base.ask(request);
    },
  });
  assert.equal(report.classification?.status, "classified");
  assert.ok(report.items.some((item) => item.id === "identifiable_publisher"));
  assert.equal(report.items.find((item) => item.id === "reporting_high_stakes")?.verdict, "review");
  assert.equal(report.siteType?.id, "news_wire");
});

test("a listing gets a site type and does not run body category questions", async () => {
  const page: PageSnapshot = { ...snapshot(), hasArticle: false, pageKind: "portal" };
  const report = await checkSnapshot(page, definition, {
    async ask(request): Promise<JevReply> {
      if ("site_type" in request.questions) {
        const state = request.state;
        assert.equal(state !== null && typeof state === "object" && !Array.isArray(state) && !Object.hasOwn(state, "url"), true);
        assert.equal(state !== null && typeof state === "object" && !Array.isArray(state) && !Object.hasOwn(state, "hostname"), true);
        return {
          answers: {
            site_type: { type: "choice", choice: "tools_saas_docs", confidence: 0.77, probabilities: { tools_saas_docs: 0.77 } },
          },
          usage: { input_tokens: 2, output_tokens: 1 },
        };
      }
      const answers: Record<string, JevAnswer> = {};
      for (const question of definition.questions.filter((entry) => entry.applyWhen === undefined)) {
        if (question.type === "noul") answers[question.id] = { type: "noul", noul: 0.95 };
        else if (question.type === "choice") answers[question.id] = answerFor(question.id, Object.keys(question.criteria)[0]!);
      }
      return { answers, usage: { input_tokens: 1, output_tokens: 1 } };
    },
  });
  assert.equal(report.classification?.status, "not_applicable");
  assert.equal(report.classification?.primary, undefined);
  assert.equal(report.siteType?.id, "tools_saas_docs");
  assert.equal(report.contentClass?.status, "draft");
  assert.deepEqual(report.inspection?.bodyQuestionIds, []);
  assert.equal(report.usage.input_tokens, 5);
  assert.equal(report.usage.output_tokens, 4);
});

test("site type reads a later-window reprint while body category and site questions stay on the first window", async () => {
  const disclosure = "Reprinted from the city gazette with the original publisher credit.";
  const page = snapshot();
  page.text = `${"a".repeat(bodyWindowCharBudget())} ${disclosure}`;
  let siteTypeText = "";
  let siteQuestionText = "";
  const base = gatewayFor();
  const report = await checkSnapshot(page, definition, {
    async ask(request) {
      const state = request.state;
      const text = state !== null && typeof state === "object" && "text" in state && typeof state.text === "string" ? state.text : "";
      if ("site_type" in request.questions) siteTypeText = text;
      if ("identifiable_publisher" in request.questions) siteQuestionText = text;
      return base.ask(request);
    },
  });
  assert.equal(report.definition.version, 10);
  assert.equal(report.classification?.primary, "reporting");
  assert.equal(report.siteType?.id, "news_wire");
  assert.equal(siteTypeText.includes(disclosure), true);
  assert.equal(siteQuestionText.includes(disclosure), false);
  assert.equal(siteTypeText.startsWith("a"), true);
});

test("a failed site type request keeps the body category", async () => {
  const base = gatewayFor();
  const report = await checkSnapshot(snapshot(), definition, {
    async ask(request) {
      if ("site_type" in request.questions) throw new Error("site type unavailable");
      return base.ask(request);
    },
  });
  assert.equal(report.classification?.primary, "reporting");
  assert.equal(report.siteType?.status, "review");
  assert.equal(report.siteType?.reasonCode, "site_type_error");
  assert.ok(report.items.some((item) => item.id.startsWith("reporting_")));
});
