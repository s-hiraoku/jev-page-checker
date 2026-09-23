import assert from "node:assert/strict";
import { test } from "node:test";
import { citeSource, displayCharacterRange } from "./report-evidence.js";
import type { PageSnapshot } from "./page-state.js";

const snapshot = {
  title: "Bridge inspection update",
  siteName: "Example News",
  author: "Mina Ito",
  metaDescription: "A report on the bridge inspection.",
  text: "The inspection report was published on 18 September.",
} as PageSnapshot;

test("citeSource distinguishes metadata from body passages", () => {
  assert.deepEqual(citeSource(snapshot, "Bridge inspection update"), {
    label: "sourceTitle",
    target: "page-metadata-title",
  });
  assert.deepEqual(citeSource(snapshot, "inspection update"), {
    label: "sourceTitle",
    target: "page-metadata-title",
  });
  assert.deepEqual(citeSource(snapshot, "Mina Ito"), {
    label: "sourceAuthor",
    target: "page-metadata-author",
  });
  assert.deepEqual(citeSource(snapshot, "The inspection report was published"), {
    label: "sourceBody",
    target: "body-evidence",
  });
});

test("citeSource uses the recorded origin when body text repeats metadata", () => {
  assert.deepEqual(citeSource(snapshot, "Bridge inspection update", "body"), {
    label: "sourceBody",
    target: "body-evidence",
  });
  assert.deepEqual(citeSource(snapshot, "Bridge inspection update", "title"), {
    label: "sourceTitle",
    target: "page-metadata-title",
  });
});

test("citeSource identifies a page span that is not available in the saved snapshot", () => {
  assert.deepEqual(citeSource(snapshot, "A span from an older report"), {
    label: "sourcePage",
    target: null,
  });
});

test("displayCharacterRange uses visible Unicode character positions", () => {
  assert.deepEqual(displayCharacterRange("a😀bc", 3, 5), { start: 2, end: 4 });
});
