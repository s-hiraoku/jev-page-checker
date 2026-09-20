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

async function reportOf(name: string) {
  const replay = loadReplay(name);
  const snapshot: PageSnapshot = { ...replay.state, extractedAt: "2026-09-20T00:00:00.000Z" };
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
