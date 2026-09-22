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
      publishedAt: "2026-09-18",
      pageKind: "article",
      outboundHosts: ["doi.example.org"],
      wordCount: 10,
      text: "hello",
    },
    report: { items: [] },
  } as unknown as StoredRecord;
  assert.equal(reportFilename(record), "jev-audit-news.example.org-2026-09-20.txt");
  const text = reportDocument(record, "ja");
  assert.match(text, /公開日: 2026-09-18/);
  assert.match(text, /ページの形: 記事/);
  assert.match(text, /doi\.example\.org/);
  assert.match(reportDocument(record, "en"), /Published: 2026-09-18/);
  assert.match(reportDocument(record, "en"), /Page kind: Article/);
});

test("a saved report lists the verdict, the matched criterion, and the sentence", () => {
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
      publishedAt: "",
      pageKind: "article",
      outboundHosts: [],
      wordCount: 10,
      text: "order now",
    },
    report: { items: [item] },
  } as unknown as StoredRecord;
  const text = reportDocument(record, "ja");
  assert.match(text, /発行元が特定できる/);
  assert.match(text, /判定: Alert/);
  assert.match(text, /基準: 責任者がいない/);
  assert.match(text, /文: No study, author, or manufacturer is named\./);
  assert.equal(text.includes("責任者として分かる"), false);
});
