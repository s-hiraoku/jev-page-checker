import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { replayGateway } from "./checkkit.js";
import { PAGE_QUESTION_IDS, SITE_QUESTION_IDS, worstVerdict } from "./groups.js";
import type { PageSnapshot } from "./page-state.js";
import { checkSnapshot } from "./run-check.js";

const definition = JSON.parse(readFileSync(new URL("../../fixtures/page-credibility.checker.json", import.meta.url), "utf8"));

function loadReplay(name: string) {
  return JSON.parse(readFileSync(new URL(`../../fixtures/replay/${name}`, import.meta.url), "utf8")) as {
    state: Omit<PageSnapshot, "extractedAt">;
    answers: Parameters<typeof replayGateway>[0];
    usage: Parameters<typeof replayGateway>[1];
  };
}

async function reportOf(name: string, patch: Partial<PageSnapshot> = {}) {
  const replay = loadReplay(name);
  const snapshot: PageSnapshot = {
    ...replay.state,
    ...patch,
    extractedAt: "2026-09-20T00:00:00.000Z",
    textTruncated: patch.textTruncated ?? replay.state.textTruncated ?? false,
  };
  return checkSnapshot(snapshot, definition, replayGateway(replay.answers, replay.usage));
}

test("a sourced news article passes site safety and body scrutiny", async () => {
  const report = await reportOf("page-credibility-pass.json");
  assert.equal(report.definition.version, 3);
  assert.equal(report.items.every((item) => item.verdict === "pass"), true);
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "pass");
});

test("a miracle-cure sales page fails site safety and body scrutiny", async () => {
  const report = await reportOf("page-credibility-fail.json");
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "fail");
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "fail");
  assert.equal(report.items.find((item) => item.id === "identifiable_publisher")?.verdict, "fail");
  assert.equal(report.items.find((item) => item.id === "unsourced_specifics")?.verdict, "fail");
});

test("a listing skips body questions because there is no single text to scrutinize", async () => {
  const report = await reportOf("page-credibility-portal.json");
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "not_applicable");
  for (const id of PAGE_QUESTION_IDS) {
    assert.equal(report.items.find((item) => item.id === id)?.verdict, "not_applicable");
  }
});

test("an essay purpose is not a site-safety failure", async () => {
  const report = await reportOf("page-credibility-essay.json");
  assert.equal(report.items.find((item) => item.id === "site_purpose")?.verdict, "pass");
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "pass");
});

test("a truncated extract cannot pass body scrutiny even when Jev would pass the prefix", async () => {
  const report = await reportOf("page-credibility-pass.json", { textTruncated: true });
  assert.equal(worstVerdict(report.items, SITE_QUESTION_IDS), "pass");
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "review");
  for (const id of PAGE_QUESTION_IDS) {
    assert.equal(report.items.find((item) => item.id === id)?.verdict, "review");
  }
});

test("a truncated extract still reports a body fail found in the prefix", async () => {
  const report = await reportOf("page-credibility-fail.json", { textTruncated: true });
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "fail");
  assert.equal(report.items.find((item) => item.id === "unsourced_specifics")?.verdict, "fail");
});

test("a truncated listing still skips body questions", async () => {
  const report = await reportOf("page-credibility-portal.json", { textTruncated: true });
  assert.equal(worstVerdict(report.items, PAGE_QUESTION_IDS), "not_applicable");
});
