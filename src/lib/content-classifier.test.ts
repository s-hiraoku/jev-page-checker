import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { JevAnswer, JevGateway, JevReply } from "../../runner/index.js";
import type { BodyWindow } from "./body-windows.js";
import { categoryChoiceDescriptions } from "./category-rubrics.js";
import { classifyContent } from "./content-classifier.js";
import type { PageSnapshot } from "./page-state.js";

const body = "The city published its inspection report after engineers tested the bridge. The guide explains how residents can report new damage.";
const categories = { reporting: "Reports external events or facts.", guide: "Explains steps readers can take." };

function snapshot(patch: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    url: "https://example.test/path",
    hostname: "example.test",
    protocol: "https:",
    title: "Bridge inspection update",
    metaDescription: "The city published an inspection report.",
    author: "",
    publishedAt: "",
    siteName: "",
    language: "en",
    isHttps: true,
    hasAuthor: false,
    hasPublishedAt: false,
    hasBody: true,
    hasArticle: true,
    pageKind: "article",
    linkCount: 0,
    wordCount: 20,
    citationCount: 0,
    outboundHosts: [],
    text: body,
    textTruncated: false,
    extractedAt: "2026-09-23T00:00:00.000Z",
    ...patch,
  };
}

function windowFor(text: string, start = 0): BodyWindow {
  return { text, start, end: start + text.length };
}

function scriptedGateway(
  answersForCall: (call: number, questionIds: string[]) => Record<string, JevAnswer>,
): JevGateway & { calls: number; states: unknown[] } {
  const gateway = {
    calls: 0,
    states: [] as unknown[],
    async ask(request: Parameters<JevGateway["ask"]>[0]): Promise<JevReply> {
      gateway.calls += 1;
      gateway.states.push(request.state);
      return {
        answers: answersForCall(gateway.calls, Object.keys(request.questions)),
        usage: { input_tokens: 10, output_tokens: 4 },
      };
    },
  };
  return gateway;
}

function choices(
  primary: string,
  secondary = "none",
  evidence = "s1",
  confidence = 0.9,
  secondaryConfidence = confidence,
): Record<string, JevAnswer> {
  return {
    content_primary: { type: "choice", choice: primary, confidence, probabilities: { [primary]: confidence } },
    content_secondary: { type: "choice", choice: secondary, confidence: secondaryConfidence, probabilities: { [secondary]: secondaryConfidence } },
    content_evidence: { type: "choice", choice: evidence, confidence, probabilities: { [evidence]: confidence } },
  };
}

function distributed(
  primary: Record<string, number>,
  choice: string,
  secondary = "none",
  secondaryScore = 0.2,
): Record<string, JevAnswer> {
  const confidence = primary[choice] ?? 0;
  return {
    content_primary: { type: "choice", choice, confidence, probabilities: primary },
    content_secondary: { type: "choice", choice: secondary, confidence: secondaryScore, probabilities: { [secondary]: secondaryScore } },
    content_evidence: { type: "choice", choice: "title", confidence: 0.8, probabilities: { title: 0.8 } },
  };
}

test("classifies from page content, keeps exact body evidence, and excludes URL fields from Jev state", async () => {
  const gateway = scriptedGateway(() => choices("reporting"));
  const result = await classifyContent(snapshot(), [windowFor(body)], gateway, categories);
  assert.equal(result.status, "classified");
  assert.equal(result.primary, "reporting");
  assert.equal(result.evidence?.text, "The city published its inspection report after engineers tested the bridge.");
  assert.equal(result.evidence?.source, "body");
  assert.equal(body.slice(result.evidence?.start, result.evidence?.end), result.evidence?.text);
  assert.equal("url" in (gateway.states[0] as object), false);
  assert.equal("hostname" in (gateway.states[0] as object), false);
  assert.deepEqual(result.usage, { input_tokens: 10, output_tokens: 4 });
});

test("accepts a short article with exact title evidence and no fabricated body offset", async () => {
  const shortBody = "A short update.";
  const page = snapshot({ text: shortBody, title: "Bridge inspection update" });
  const result = await classifyContent(page, [windowFor(shortBody)], scriptedGateway(() => choices("reporting", "none", "title")), categories);
  assert.equal(result.status, "classified");
  assert.deepEqual(result.evidence, { text: page.title, source: "title" });
});

test("keeps a secondary category only when it ranks strictly below the primary", async () => {
  const kept = await classifyContent(snapshot(), [windowFor(body)], scriptedGateway(() => choices("reporting", "guide", "s1", 0.9, 0.7)), categories);
  assert.equal(kept.status, "classified");
  assert.equal(kept.primary, "reporting");
  assert.equal(kept.secondary, "guide");
  assert.equal(kept.secondaryConfidence, 0.7);
  const tied = await classifyContent(snapshot(), [windowFor(body)], scriptedGateway(() => choices("reporting", "guide")), categories);
  assert.equal(tied.status, "classified");
  assert.equal(tied.primary, "reporting");
  assert.equal(tied.secondary, undefined);
});

test("classifies the leading category below the verdict confidence floor and holds a strict unclear lead", async () => {
  const low = await classifyContent(snapshot(), [windowFor(body)], scriptedGateway(() => choices("reporting", "none", "s1", 0.34)), categories);
  assert.equal(low.status, "classified");
  assert.equal(low.primary, "reporting");
  assert.equal(low.confidence, 0.34);
  const weakSecondary = await classifyContent(snapshot(), [windowFor(body)], scriptedGateway(() => choices("reporting", "none", "s1", 0.9, 0.4)), categories);
  assert.equal(weakSecondary.status, "classified");
  assert.equal(weakSecondary.primary, "reporting");
  assert.equal(weakSecondary.secondary, undefined);
  const unclear = await classifyContent(snapshot(), [windowFor(body)], scriptedGateway(() => choices("unclear")), categories);
  assert.equal(unclear.status, "review");
  assert.equal(unclear.reasonCode, "unclear_category");
});

test("a tied lead becomes one category and does not stay mixed", async () => {
  const distribution = { reporting: 0.3, guide: 0.3, unclear: 0.3 };
  const result = await classifyContent(
    snapshot(),
    [windowFor(body)],
    scriptedGateway(() => distributed(distribution, "unclear")),
    categories,
  );
  assert.equal(result.status, "classified");
  assert.equal(result.primary, "reporting");
  assert.equal(result.secondary, undefined);
});

test("holds Jev labels that are outside the supplied category options", async () => {
  const result = await classifyContent(snapshot(), [windowFor(body)], scriptedGateway(() => choices("invented_category")), categories);
  assert.equal(result.status, "review");
  assert.equal(result.reasonCode, "unknown_primary");
  assert.match(result.reason ?? "", /outside the supplied options/);
});

test("breaks a tie across windows into one primary category", async () => {
  const windows = [windowFor(body), windowFor(body)];
  const gateway = scriptedGateway((call) => choices(call === 1 ? "reporting" : "guide"));
  const result = await classifyContent(snapshot(), windows, gateway, categories);
  assert.equal(result.status, "classified");
  assert.equal(result.primary, "reporting");
  assert.equal(result.secondary, undefined);
  assert.equal(result.windows.length, 2);
  assert.equal(gateway.calls, 2);
});

test("keeps a lower secondary category when another window names the same primary", async () => {
  const gateway = scriptedGateway((call) => call === 1 ? choices("reporting", "guide", "s1", 0.9, 0.7) : choices("reporting"));
  const result = await classifyContent(snapshot(), [windowFor(body), windowFor(body)], gateway, categories);
  assert.equal(result.status, "classified");
  assert.equal(result.primary, "reporting");
  assert.equal(result.secondary, "guide");
});

test("article, sales, and essay fixtures follow the leading category; a listing has no body category", async () => {
  const descriptions = categoryChoiceDescriptions();
  const cases = [
    ["page-credibility-pass.json", { reporting: 0.34, explanation: 0.22, announcement: 0.18, unclear: 0.26 }, "reporting"],
    ["page-credibility-fail.json", { sales: 0.37, announcement: 0.24, reporting: 0.21, unclear: 0.18 }, "sales"],
    ["page-credibility-essay.json", { opinion: 0.36, explanation: 0.28, reporting: 0.2, unclear: 0.16 }, "opinion"],
  ] as const;
  for (const [file, distribution, expected] of cases) {
    const replay = JSON.parse(readFileSync(new URL(`../../fixtures/replay/${file}`, import.meta.url), "utf8")) as { state: Omit<PageSnapshot, "extractedAt"> };
    const page = snapshot({ ...replay.state, textTruncated: false });
    const result = await classifyContent(page, [windowFor(page.text)], scriptedGateway(() => distributed({ ...distribution }, "unclear")), descriptions);
    assert.equal(result.status, "classified", file);
    assert.equal(result.primary, expected, file);
    assert.equal(result.secondary, undefined, file);
    assert.ok((result.confidence ?? 1) < 0.6, file);
  }
  const portalReplay = JSON.parse(readFileSync(new URL("../../fixtures/replay/page-credibility-portal.json", import.meta.url), "utf8")) as { state: Omit<PageSnapshot, "extractedAt"> };
  const portal = snapshot({ ...portalReplay.state, textTruncated: false });
  const listing = await classifyContent(portal, [windowFor(portal.text)], scriptedGateway(() => choices("reporting")), descriptions);
  assert.equal(listing.status, "not_applicable");
  assert.equal(listing.reasonCode, "no_single_body");
});

test("holds unread remainder and reports pages without one body as not applicable", async () => {
  const partial = await classifyContent(snapshot({ textTruncated: true }), [windowFor(body)], scriptedGateway(() => choices("reporting")), categories);
  assert.equal(partial.status, "review");
  const missingWindows = await classifyContent(snapshot(), [], scriptedGateway(() => choices("reporting")), categories);
  assert.equal(missingWindows.status, "review");
  const noArticle = await classifyContent(snapshot({ hasArticle: false }), [windowFor(body)], scriptedGateway(() => choices("reporting")), categories);
  assert.equal(noArticle.status, "not_applicable");
  assert.equal(noArticle.reasonCode, "no_single_body");
});
