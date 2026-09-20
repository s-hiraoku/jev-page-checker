import assert from "node:assert/strict";
import { test } from "node:test";
import { actionIconModel, paintStamp } from "./action-icon.js";
import type { SessionView, StoredRecord } from "./session.js";

const ready = (site: "pass" | "fail" | "review", page: "pass" | "fail" | "review"): Extract<SessionView, { status: "ready" }> => ({
  status: "ready",
  record: {
    id: "r",
    tabId: 1,
    createdAt: "2026-09-20T00:00:00.000Z",
    snapshot: { url: "https://example.com", hostname: "example.com" } as StoredRecord["snapshot"],
    report: {
      definition: { id: "page-credibility" as StoredRecord["report"]["definition"]["id"], version: 2 },
      usage: { input_tokens: 0, output_tokens: 0 },
      timing: { wallMs: 1, jevMs: 1 },
      items: [
        { id: "identifiable_publisher" as StoredRecord["report"]["items"][number]["id"], verdict: site, reason: "" },
        { id: "evidence_for_claims" as StoredRecord["report"]["items"][number]["id"], verdict: page, reason: "" },
      ],
    },
  },
});

test("a ready report puts site on the title first and page second", () => {
  const model = actionIconModel(ready("review", "fail"));
  assert.equal(model.site, "review");
  assert.equal(model.page, "fail");
  assert.equal(model.title, "サイト: 要確認 / 本文: 要警戒");
  assert.equal(model.badge, "!");
});

test("a review-only result paints a visible question badge on the resident icon", () => {
  const model = actionIconModel(ready("pass", "review"));
  assert.equal(model.site, "pass");
  assert.equal(model.page, "review");
  assert.equal(model.badge, "?");
  assert.equal(model.badgeColor, "#d68410");
});

test("setup and checking keep both lanes on the same tone", () => {
  const setup = actionIconModel({ status: "needs-setup", reason: "approval", definitionVersion: 1 });
  assert.equal(setup.site, "setup");
  assert.equal(setup.page, "setup");
  const checking = actionIconModel({ status: "checking", snapshot: ready("pass", "pass").record.snapshot });
  assert.equal(checking.site, "checking");
  assert.equal(checking.badge, "…");
});

test("paintStamp colors the top half as site and the bottom half as page", () => {
  const pixels = paintStamp(16, "pass", "fail");
  const top = (4 * 16 + 8) * 4;
  const bottom = (12 * 16 + 8) * 4;
  assert.deepEqual([pixels[top], pixels[top + 1], pixels[top + 2]], [36, 148, 92]);
  assert.deepEqual([pixels[bottom], pixels[bottom + 1], pixels[bottom + 2]], [196, 48, 44]);
});
