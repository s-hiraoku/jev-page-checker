import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { extractSiteSpans, extractSpans } from "./checkkit.js";

test("extractSpans keeps numbered sentences and drops short fragments", () => {
  const text = "Too short. The bureau posted the inspection memo dated 12 September and a photograph of the south pier. A name alone is not enough here.";
  const spans = extractSpans(text);
  assert.deepEqual(
    spans.map((span) => span.id),
    ["s1", "s2"],
  );
  assert.match(spans[0]?.text ?? "", /12 September/);
  assert.match(spans[1]?.text ?? "", /A name alone/);
  assert.ok(spans.every((span) => span.source === "body"));
});

test("extractSiteSpans retains the source field when text overlaps page metadata", () => {
  const repeated = "Bridge inspection update";
  const spans = extractSiteSpans({
    title: repeated,
    text: `${repeated} was posted by the bureau with a report about the bridge inspection.`,
  });
  assert.deepEqual(spans[0], { id: "s1", text: repeated, source: "title" });
  assert.equal(spans.find((span) => span.text.includes("posted by the bureau"))?.source, "body");
});

test("extractSpans keeps an ordinary short sentence and splits two numbered clauses", () => {
  const hedged = "Sato said no opening date has been set.";
  const paired = "A clinic claimed a change in 11 days and cut the bill by 94 percent.";
  const spans = extractSpans(`${hedged} ${paired}`);
  assert.match(spans[0]?.text ?? "", /opening date/);
  assert.match(spans.map((span) => span.text).join("\n"), /11 days/);
  assert.match(spans.map((span) => span.text).join("\n"), /94 percent/);
  assert.equal(spans.filter((span) => /\d/.test(span.text)).length, 2);
});

test("extractSpans splits a fullwidth stop that has no following space", () => {
  const evidence = "検査メモは九月十二日に南橋脚のひび割れを記録したと局長が記者団にその場で述べた。";
  const conflict = "同じ局長は後で、開通日は三月だと記者団に述べたあと、開通日は決まっていないと述べた。";
  const spans = extractSpans(`${evidence}${conflict}`);
  assert.deepEqual(
    spans.map((span) => span.text),
    [evidence, conflict],
  );
});

test("extractSpans uses the same cut on the replay articles", () => {
  const pass = JSON.parse(readFileSync("fixtures/replay/page-credibility-pass.json", "utf8")) as { state: { text: string } };
  const fail = JSON.parse(readFileSync("fixtures/replay/page-credibility-fail.json", "utf8")) as { state: { text: string } };
  const passSpans = extractSpans(pass.state.text);
  const failSpans = extractSpans(fail.state.text);
  assert.match(passSpans.find((span) => span.id === "s2")?.text ?? "", /12 September/);
  assert.match(passSpans.find((span) => span.id === "s4")?.text ?? "", /opening date/);
  assert.match(failSpans.find((span) => span.id === "s1")?.text ?? "", /11 days/);
  assert.match(failSpans.find((span) => span.id === "s2")?.text ?? "", /94 percent/);
  assert.equal(failSpans[0]?.text.includes("94 percent"), false);
});
