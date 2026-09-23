import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ItemResult } from "./checkkit.js";
import type { PageSnapshot } from "./page-state.js";
import { ItemList } from "../ui/ItemList.js";
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
    createElement(
      LocaleProvider,
      { locale: "ja" },
      createElement(ItemList, {
        items: [item],
        siteIds: [],
        bodyIds: [item.id],
        snapshot,
        definitionVersion: 9,
      }),
    ),
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
