import assert from "node:assert/strict";
import { test } from "node:test";
import type { JevAnswer, JevGateway, JevReply } from "../../runner/index.js";
import type { BodyWindow } from "./body-windows.js";
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

function choices(primary: string, secondary = "none", evidence = "s1", confidence = 0.9): Record<string, JevAnswer> {
  return {
    content_primary: { type: "choice", choice: primary, confidence, probabilities: { [primary]: confidence } },
    content_secondary: { type: "choice", choice: secondary, confidence, probabilities: { [secondary]: confidence } },
    content_evidence: { type: "choice", choice: evidence, confidence, probabilities: { [evidence]: confidence } },
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

test("keeps an explicitly material secondary category", async () => {
  const gateway = scriptedGateway(() => choices("reporting", "guide"));
  const result = await classifyContent(snapshot(), [windowFor(body)], gateway, categories);
  assert.equal(result.status, "classified");
  assert.equal(result.primary, "reporting");
  assert.equal(result.secondary, "guide");
  assert.equal(result.secondaryConfidence, 0.9);
});

test("holds low confidence and unclear results for review", async () => {
  const low = await classifyContent(snapshot(), [windowFor(body)], scriptedGateway(() => choices("reporting", "none", "s1", 0.59)), categories);
  assert.equal(low.status, "review");
  const unclear = await classifyContent(snapshot(), [windowFor(body)], scriptedGateway(() => choices("unclear")), categories);
  assert.equal(unclear.status, "review");
});

test("holds Jev labels that are outside the supplied category options", async () => {
  const result = await classifyContent(snapshot(), [windowFor(body)], scriptedGateway(() => choices("invented_category")), categories);
  assert.equal(result.status, "review");
  assert.match(result.reason ?? "", /outside the supplied options/);
});

test("holds unresolved disagreements across overlapping windows", async () => {
  const windows = [windowFor(body), windowFor(body)];
  const gateway = scriptedGateway((call) => choices(call === 1 ? "reporting" : "guide"));
  const result = await classifyContent(snapshot(), windows, gateway, categories);
  assert.equal(result.status, "review");
  assert.equal(result.windows.length, 2);
  assert.equal(gateway.calls, 2);
});

test("accepts window differences explained by a consistently declared secondary category", async () => {
  const gateway = scriptedGateway((call) => call === 1 ? choices("reporting", "guide") : choices("reporting"));
  const result = await classifyContent(snapshot(), [windowFor(body), windowFor(body)], gateway, categories);
  assert.equal(result.status, "classified");
  assert.equal(result.primary, "reporting");
  assert.equal(result.secondary, "guide");
});

test("holds unread remainder and reports pages without one body as not applicable", async () => {
  const partial = await classifyContent(snapshot({ textTruncated: true }), [windowFor(body)], scriptedGateway(() => choices("reporting")), categories);
  assert.equal(partial.status, "review");
  const missingWindows = await classifyContent(snapshot(), [], scriptedGateway(() => choices("reporting")), categories);
  assert.equal(missingWindows.status, "review");
  const noArticle = await classifyContent(snapshot({ hasArticle: false }), [windowFor(body)], scriptedGateway(() => choices("reporting")), categories);
  assert.equal(noArticle.status, "not_applicable");
});
