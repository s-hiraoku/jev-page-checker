import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ItemResult } from "./checkkit.js";
import { laneRemarkLines } from "./groups.js";
import { verdictRemark } from "./labels.js";
import type { PageSnapshot } from "./page-state.js";
import type { StoredRecord } from "./session.js";
import { ItemList } from "../ui/ItemList.js";
import { ReportView } from "../ui/ReportView.js";
import { LocaleProvider } from "../ui/useLocale.js";

const snapshot = {
  url: "https://example.test/report",
  hostname: "example.test",
  protocol: "https:",
  title: "Bridge inspection report",
  metaDescription: "",
  author: "",
  publishedAt: "",
  siteName: "Example Journal",
  language: "ja",
  isHttps: true,
  hasAuthor: false,
  hasPublishedAt: false,
  hasBody: true,
  hasArticle: true,
  pageKind: "article",
  linkCount: 0,
  wordCount: 40,
  citationCount: 0,
  outboundHosts: [],
  text: "The bureau reported a bridge inspection on 23 September.",
  textTruncated: false,
  extractedAt: "2026-09-23T00:00:00.000Z",
} satisfies PageSnapshot;

function htmlFor(item: ItemResult): string {
  return renderToStaticMarkup(
    createElement(LocaleProvider, {
      locale: "ja",
      children: createElement(ItemList, {
        items: [item],
        siteIds: [],
        bodyIds: [item.id],
        snapshot,
        definitionVersion: 9,
      }),
    }),
  );
}

test("a category item card renders verdict, criteria, remark, and an empty evidence state", () => {
  const html = htmlFor({
    id: "reporting_event_time" as ItemResult["id"],
    verdict: "review",
    reason: "choice review maps to review",
    answer: { type: "choice", choice: "review", confidence: 0.91, probabilities: { review: 0.91, pass: 0.09 } },
  });
  const verdict = html.indexOf("result-verdict");
  const criteria = html.indexOf("result-criteria");
  const remark = html.indexOf("result-remark-block");
  const evidence = html.indexOf("result-evidence");
  assert.ok(verdict >= 0 && criteria > verdict && remark > criteria && evidence > remark);
  assert.match(html, /要確認/);
  assert.match(html, /中心事実と時点/);
  assert.match(html, /中心事実と時点は、要確認である。/);
  assert.match(html, /ページの記述だけでは判断できない/);
  assert.match(html, /当たった段: 要確認/);
  assert.match(html, /この項目の根拠になる記載はない。/);
  assert.match(html, /<summary>詳細<\/summary>/);
  assert.match(html, /reporting_event_time/);
  assert.equal(html.includes("回答分布の確信度"), true);
  const details = html.indexOf("result-details");
  const confidence = html.indexOf("回答分布の確信度");
  assert.ok(details >= 0 && confidence > details);
});

test("a lane summary keeps the worst category remarks and the bar names the category", () => {
  const ids = ["reporting_event_time", "reporting_attribution", "reporting_verification"];
  const items = [
    { id: "reporting_event_time", verdict: "pass" as const },
    { id: "reporting_attribution", verdict: "fail" as const },
    { id: "reporting_verification", verdict: "review" as const },
  ];
  assert.deepEqual(
    laneRemarkLines(items, ids, (id, verdict) => verdictRemark(id, verdict, "ja")),
    ["情報源の帰属は、警告に当たる。", "主張の検証手掛かりは、要確認である。", "中心事実と時点は、基準を満たしている。"],
  );

  const previousWindow = globalThis.window;
  Object.assign(globalThis, { window: { matchMedia: () => ({ matches: true }) } });
  try {
    const record = {
      id: "category-report",
      tabId: 1,
      createdAt: "2026-09-23T00:00:00.000Z",
      snapshot,
      report: {
        definition: { id: "page-credibility", version: 9 },
        items: [
          { id: "honest_identity", verdict: "fail", reason: "noul" },
          { id: "reporting_verification", verdict: "review", reason: "choice" },
          { id: "reporting_event_time", verdict: "pass", reason: "choice" },
        ],
        usage: { input_tokens: 1, output_tokens: 1 },
        timing: { wallMs: 1, jevMs: 1 },
        inspection: {
          windowCount: 1,
          covered: true,
          unreadRemainder: false,
          siteQuestionIds: ["honest_identity"],
          bodyQuestionIds: ["reporting_verification", "reporting_event_time"],
        },
        classification: { status: "classified", primary: "reporting", confidence: 0.34 },
      },
    } as unknown as StoredRecord;
    const html = renderToStaticMarkup(
      createElement(LocaleProvider, {
        locale: "ja",
        children: createElement(ReportView, { record, compact: true }),
      }),
    );
    const summary = html.slice(html.indexOf("report-summary"), html.indexOf("lane-stack"));
    assert.match(summary, /サイト 警告/);
    assert.match(summary, /本文 要確認/);
    assert.match(summary, /報道・事実報告/);
    assert.equal(summary.includes("サイト種別"), false);
    assert.equal(/\d/.test(summary), false);
    assert.match(html, /主張の検証手掛かりは、要確認である。/);
    assert.match(html, /表示名とホスト名が一致するか/);
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else globalThis.window = previousWindow;
  }
});

test("the site lane shows the site type while the summary keeps the body category", () => {
  const previousWindow = globalThis.window;
  Object.assign(globalThis, { window: { matchMedia: () => ({ matches: true }) } });
  try {
    const record = {
      id: "site-type-report",
      tabId: 1,
      createdAt: "2026-09-23T00:00:00.000Z",
      snapshot,
      report: {
        definition: { id: "page-credibility", version: 10 },
        items: [
          { id: "honest_identity", verdict: "pass", reason: "noul" },
          { id: "reporting_event_time", verdict: "pass", reason: "choice" },
        ],
        usage: { input_tokens: 1, output_tokens: 1 },
        timing: { wallMs: 1, jevMs: 1 },
        inspection: {
          windowCount: 1,
          covered: true,
          unreadRemainder: false,
          siteQuestionIds: ["honest_identity"],
          bodyQuestionIds: ["reporting_event_time"],
        },
        classification: { status: "classified", primary: "reporting", confidence: 0.34 },
        siteType: { status: "classified", id: "news_wire", confidence: 0.88 },
      },
    } as unknown as StoredRecord;
    const html = renderToStaticMarkup(
      createElement(LocaleProvider, {
        locale: "ja",
        children: createElement(ReportView, { record, compact: true }),
      }),
    );
    const summary = html.slice(html.indexOf("report-summary"), html.indexOf("lane-stack"));
    assert.match(summary, /報道・事実報告/);
    assert.equal(summary.includes("サイト種別"), false);
    const siteLane = html.slice(html.indexOf("lane-stack"), html.indexOf("lane-stack", html.indexOf("lane-stack") + 1));
    assert.match(siteLane, /サイト種別 ニュース/);
    assert.equal(siteLane.includes("報道・事実報告"), false);
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else globalThis.window = previousWindow;
  }
});

test("evidence quotes stay in the evidence block when a span is present", () => {
  const html = htmlFor({
    id: "reporting_attribution" as ItemResult["id"],
    verdict: "fail",
    reason: "choice alert maps to fail",
    answer: { type: "choice", choice: "alert", confidence: 0.88, probabilities: { alert: 0.88 } },
    cite: "The bureau reported a bridge inspection on 23 September.",
    citeSource: "jev",
    citeLocation: "body",
  });
  assert.match(html, /情報源の帰属は、警告に当たる。/);
  assert.match(html, /The bureau reported a bridge inspection on 23 September\./);
  assert.match(html, /Jev が選択/);
  assert.equal(html.includes("この項目の根拠になる記載はない。"), false);
});
