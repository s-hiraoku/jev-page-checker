import assert from "node:assert/strict";
import { test } from "node:test";
import { reportDocument, reportFilename } from "./report-file.js";
import type { ItemResult } from "./checkkit.js";
import { withoutRecord, type StoredRecord } from "./session.js";

test("withoutRecord drops only the named id", () => {
  const records = [{ id: "a" }, { id: "b" }] as StoredRecord[];
  assert.deepEqual(
    withoutRecord(records, "a").map((item) => item.id),
    ["b"],
  );
  assert.deepEqual(
    withoutRecord(records, "missing").map((item) => item.id),
    ["a", "b"],
  );
});

test("a saved report file names the host and includes extracted facts", () => {
  const record = {
    id: "1",
    createdAt: "2026-09-20T08:00:00.000Z",
    snapshot: {
      title: "Bridge",
      url: "https://news.example.org/a",
      hostname: "news.example.org",
      siteName: "Example News",
      author: "Mina Ito",
      metaDescription: "A bridge report.",
      publishedAt: "2026-09-18",
      pageKind: "article",
      isHttps: true,
      language: "en",
      linkCount: 3,
      outboundHosts: ["doi.example.org"],
      wordCount: 10,
      text: "hello",
    },
    report: { items: [] },
  } as unknown as StoredRecord;
  assert.equal(reportFilename(record), "jev-audit-news.example.org-2026-09-20.txt");
  const text = reportDocument(record, "ja");
  assert.match(text, /公開日: 2026-09-18/);
  assert.match(text, /ページの種類: 記事/);
  assert.match(text, /doi\.example\.org/);
  assert.match(reportDocument(record, "en"), /Published: 2026-09-18/);
  assert.match(reportDocument(record, "en"), /Page type: Article/);
});

test("a saved report lists the verdict, the remark, and the page sentence", () => {
  const item: ItemResult = {
    id: "identifiable_publisher" as ItemResult["id"],
    verdict: "fail",
    reason: "noul 0.08 is at or below failAt 0.2",
    answer: { type: "noul", noul: 0.08 },
    cite: "No study, author, or manufacturer is named.",
  };
  const record = {
    id: "1",
    createdAt: "2026-09-20T08:00:00.000Z",
    snapshot: {
      title: "Deal",
      url: "http://deal-today.example/miracle-cure",
      hostname: "deal-today.example",
      siteName: "",
      author: "",
      metaDescription: "",
      publishedAt: "",
      pageKind: "article",
      isHttps: false,
      language: "en",
      linkCount: 0,
      outboundHosts: [],
      wordCount: 10,
      text: "order now",
    },
    report: { items: [item] },
  } as unknown as StoredRecord;
  const text = reportDocument(record, "ja");
  assert.match(text, /ページの責任者が分かるか/);
  assert.match(text, /判定: 警告/);
  assert.match(text, /寸評: ページの責任者を特定できない。/);
  assert.match(text, /引用箇所 \(ページ上の記載\): No study, author, or manufacturer is named\./);
  assert.equal(text.includes("責任者として分かる"), false);
  assert.equal(text.includes("基準:"), false);
  const english = reportDocument(record, "en");
  assert.match(english, /Verdict: Alert/);
  assert.match(english, /Remark: This page does not identify who is responsible\./);
  assert.match(english, /Citation \(Page text\): No study, author, or manufacturer is named\./);
});

test("a saved report includes typed Jev answers, source labels, and recorded window text", () => {
  const snapshot = {
    title: "Bridge update",
    url: "https://news.example.org/bridge",
    hostname: "news.example.org",
    siteName: "Example News",
    author: "Mina Ito",
    metaDescription: "A report on the bridge opening.",
    publishedAt: "2026-09-18",
    pageKind: "article",
    outboundHosts: [],
    wordCount: 10,
    isHttps: true,
    language: "en",
    linkCount: 2,
    text: "The inspection report was published on 18 September. The bridge opens in November.",
  } as unknown as StoredRecord["snapshot"];
  const record = {
    id: "2",
    createdAt: "2026-09-20T08:00:00.000Z",
    snapshot,
    report: {
      items: [
        {
          id: "site_purpose" as ItemResult["id"],
          verdict: "pass",
          reason: "choice maps to pass",
          answer: { type: "choice" as const, choice: "clear", confidence: 0.91, probabilities: { clear: 0.91, mixed: 0.09 } },
          cite: "Example News",
          citeSource: "jev" as const,
        },
      ],
      inspection: {
        windowCount: 2,
        windows: [{ start: 0, end: 40 }, { start: 34, end: snapshot.text.length }],
      },
    },
  } as unknown as StoredRecord;
  const japanese = reportDocument(record, "ja");
  assert.match(japanese, /選ばれた回答: 目的が明確/);
  assert.match(japanese, /回答分布の確信度: 91%/);
  assert.match(japanese, /選択肢ごとの確率:/);
  assert.match(japanese, /引用箇所 \(サイト名; Jev が選択\)/);
  assert.match(japanese, /範囲 1 · 文字 1–40/);
  assert.match(japanese, /The inspection report was published/);
  const english = reportDocument(record, "en");
  assert.match(english, /Selected answer: Clear purpose/);
  assert.match(english, /Response confidence: 91%/);
  assert.match(english, /Site name; Selected by Jev/);
  assert.match(english, /Window 1 · characters 1–40/);
});
