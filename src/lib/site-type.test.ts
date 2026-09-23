import assert from "node:assert/strict";
import { test } from "node:test";
import type { JevGateway } from "../../runner/jev.js";
import { CONTENT_CATEGORY_IDS } from "./category-rubrics.js";
import type { PageSnapshot } from "./page-state.js";
import { reportDocument } from "./report-file.js";
import type { StoredRecord } from "./session.js";
import {
  SITE_TYPE_IDS,
  classifySiteType,
  isSiteTypeId,
  siteTypeChoiceCriteria,
  siteTypeLabel,
  type SiteTypeId,
} from "./site-type.js";

const CRITERIA: Record<SiteTypeId, string> = {
  official_primary: "Self-published by a government, company, or school as the named organization",
  news_wire: "News reporting or wire-service journalism",
  encyclopedia_reference: "Encyclopedia, handbook, or reference-style factual entry",
  expert_blog: "Expert or practitioner blog/explainer by a named person or practice",
  ugc_sns: "User-generated content: forum, comments, or social post",
  ecommerce_reviews: "Product listing, customer reviews, or shopping comparison",
  tools_saas_docs: "Product docs, API/reference, changelog, or tool help",
  marketing_leadgen: "Marketing, ads, or lead-generation landing content",
  secondary_aggregator: "Secondary summary, aggregator, mirror, or translated reprint of other sources",
  unknown_other: "Does not clearly fit the other classes, or class is unclear",
};

function snapshot(patch: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    url: "https://news.example.test/bridge",
    hostname: "news.example.test",
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
    linkCount: 1,
    wordCount: 40,
    citationCount: 0,
    outboundHosts: ["bureau.example"],
    text: "The bureau reported a bridge inspection on 23 September.",
    textTruncated: false,
    extractedAt: "2026-09-23T00:00:00.000Z",
    ...patch,
  };
}

function gateway(answer: { choice: string; confidence: number; probabilities: Record<string, number> }, capture?: { state?: unknown; criteria?: unknown }): JevGateway {
  return {
    async ask(request) {
      if (capture) {
        capture.state = request.state;
        const question = request.questions.site_type;
        capture.criteria = question?.type === "choice" ? question.criteria : undefined;
      }
      return {
        answers: { site_type: { type: "choice", choice: answer.choice, confidence: answer.confidence, probabilities: answer.probabilities } },
        usage: { input_tokens: 4, output_tokens: 2 },
      };
    },
  };
}

test("site type ids stay disjoint from the 11 body categories", () => {
  assert.deepEqual(SITE_TYPE_IDS.length, 10);
  assert.equal(CONTENT_CATEGORY_IDS.length, 11);
  const body = new Set<string>(CONTENT_CATEGORY_IDS);
  for (const id of SITE_TYPE_IDS) {
    assert.equal(body.has(id), false, id);
    assert.equal(isSiteTypeId(id), true);
  }
  assert.equal(isSiteTypeId("reporting"), false);
});

test("the site type question sends the ten reference criteria and hides the host", async () => {
  const seen: { state?: unknown; criteria?: unknown } = {};
  const result = await classifySiteType(
    snapshot(),
    "The bureau reported a bridge inspection on 23 September.",
    gateway({ choice: "news_wire", confidence: 0.2, probabilities: { news_wire: 0.2, official_primary: 0.1 } }, seen),
  );
  assert.deepEqual(seen.criteria, CRITERIA);
  assert.deepEqual(siteTypeChoiceCriteria(), CRITERIA);
  const state = seen.state as Record<string, unknown>;
  assert.equal("url" in state, false);
  assert.equal("hostname" in state, false);
  assert.equal(state.siteName, "Example Journal");
  assert.equal(state.author, "A. Writer");
  assert.equal(result.status, "classified");
  assert.equal(result.id, "news_wire");
  assert.equal(result.confidence, 0.2);
  assert.equal(siteTypeLabel("news_wire", "ja"), "ニュース");
  assert.equal(siteTypeLabel("news_wire", "en"), "News");
});

test("a tie that excludes the declared choice uses site type catalog order", async () => {
  const result = await classifySiteType(
    snapshot(),
    snapshot().text,
    gateway({
      choice: "expert_blog",
      confidence: 0.1,
      probabilities: { news_wire: 0.4, official_primary: 0.4, expert_blog: 0.1 },
    }),
  );
  assert.equal(result.id, "official_primary");
});

test("a site type outside the ten classes is review", async () => {
  const result = await classifySiteType(
    snapshot(),
    snapshot().text,
    gateway({ choice: "reporting", confidence: 0.9, probabilities: { reporting: 0.9 } }),
  );
  assert.equal(result.status, "review");
  assert.equal(result.reasonCode, "unknown_site_type");
  assert.equal(result.id, undefined);
});

test("a page with no visible text does not ask Jev", async () => {
  let calls = 0;
  const result = await classifySiteType(
    snapshot({ title: " ", siteName: "", author: "", metaDescription: "", text: "" }),
    " ",
    { async ask() { calls += 1; throw new Error("should not ask"); } },
  );
  assert.equal(calls, 0);
  assert.equal(result.reasonCode, "empty_page");
  assert.equal(result.usage.input_tokens, 0);
});

test("a saved report names the site type apart from the body category", () => {
  const record = {
    id: "site-type",
    createdAt: "2026-09-23T00:00:00.000Z",
    snapshot: snapshot(),
    report: {
      definition: { id: "page-credibility", version: 10 },
      items: [],
      usage: { input_tokens: 1, output_tokens: 1 },
      timing: { wallMs: 1, jevMs: 1 },
      classification: { status: "classified", primary: "reporting" },
      siteType: { status: "classified", id: "news_wire", confidence: 0.88 },
    },
  } as unknown as StoredRecord;
  const japanese = reportDocument(record, "ja");
  assert.match(japanese, /サイト種別: ニュース/);
  assert.match(japanese, /本文の種類/);
  assert.match(japanese, /主分類: 報道・事実報告/);
  const english = reportDocument(record, "en");
  assert.match(english, /Site type: News/);
  assert.match(english, /Primary category: Reporting/);
});
