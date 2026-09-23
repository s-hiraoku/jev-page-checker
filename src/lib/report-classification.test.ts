import assert from "node:assert/strict";
import { test } from "node:test";
import type { StoredRecord } from "./session.js";
import { reportDocument } from "./report-file.js";

function record(classification?: StoredRecord["report"]["classification"]): StoredRecord {
  return {
    id: "classification-report",
    tabId: 1,
    createdAt: "2026-09-23T00:00:00.000Z",
    snapshot: {
      url: "https://example.test/story",
      hostname: "example.test",
      protocol: "https:",
      title: "Bridge inspection",
      metaDescription: "A report about an inspection.",
      author: "A. Writer",
      publishedAt: "2026-09-22",
      siteName: "Example",
      language: "en",
      isHttps: true,
      hasAuthor: true,
      hasPublishedAt: true,
      hasBody: true,
      hasArticle: true,
      pageKind: "article",
      linkCount: 1,
      wordCount: 100,
      citationCount: 1,
      outboundHosts: [],
      text: "The inspection finished on Tuesday.",
      textTruncated: false,
      extractedAt: "2026-09-23T00:00:00.000Z",
    },
    report: {
      definition: { id: "test" as StoredRecord["report"]["definition"]["id"], version: 1 },
      items: [],
      usage: { input_tokens: 0, output_tokens: 0 },
      timing: { wallMs: 0, jevMs: 0 },
      ...(classification === undefined ? {} : { classification }),
    },
  };
}

test("saved reports include localized categories, exact evidence, and evidence source", () => {
  const result = record({
    status: "classified",
    primary: "reporting",
    secondary: "explanation",
    confidence: 0.9,
    secondaryConfidence: 0.8,
    evidence: { text: "The inspection finished on Tuesday.", source: "body", start: 0, end: 35 },
  });
  const japanese = reportDocument(result, "ja");
  assert.match(japanese, /本文の種類/);
  assert.match(japanese, /主分類: 報道・事実報告/);
  assert.match(japanese, /副分類: 解説・分析/);
  assert.match(japanese, /分類の根拠 \(記事本文\): The inspection finished on Tuesday\./);
  assert.match(japanese, /確信度は選択肢の分布を表し、分類が正しい確率ではありません/);
  const english = reportDocument(result, "en");
  assert.match(english, /Content type/);
  assert.match(english, /Primary category: Reporting/);
  assert.match(english, /Secondary category: Explanation and analysis/);
  assert.match(english, /Classification evidence \(Article body\): The inspection finished on Tuesday\./);
  assert.match(english, /Confidence describes the choice distribution, not the chance that the classification is correct\./);
});

test("saved reports include classification review and not-applicable reasons", () => {
  const review = reportDocument(record({ status: "review", reasonCode: "primary_disagreement", reason: "The windows disagree." }), "en");
  assert.match(review, /Classification needs review/);
  assert.match(review, /Reason: The windows disagree about the primary category\./);
  assert.equal(review.includes("The windows disagree."), false);
  const na = reportDocument(record({ status: "not_applicable", reasonCode: "no_single_body", reason: "No single body." }), "ja");
  assert.match(na, /分類対象外/);
  assert.match(na, /理由: 分類する一本の本文がありません。/);
});

test("older classification records without a reason code keep their diagnostic reason", () => {
  const text = reportDocument(record({ status: "review", reason: "Legacy reason text." }), "ja");
  assert.match(text, /理由: Legacy reason text\./);
});

test("older reports without classification say they were not classified", () => {
  assert.match(reportDocument(record(), "ja"), /以前の記録には分類情報がありません/);
  assert.match(reportDocument(record(), "en"), /This earlier report was not classified\./);
});
