import assert from "node:assert/strict";
import { test } from "node:test";
import { reportDocument, reportFilename } from "./report-file.js";
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
