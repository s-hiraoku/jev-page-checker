import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { extractSpans } from "./checkkit.js";

test("extractSpans keeps numbered sentences and drops short fragments", () => {
  const text = "Too short. The bureau posted the inspection memo dated 12 September and a photograph of the south pier. A name alone is not enough here.";
  const spans = extractSpans(text);
  assert.deepEqual(
    spans.map((span) => span.id),
    ["s1"],
  );
  assert.match(spans[0]?.text ?? "", /12 September/);
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
  assert.match(failSpans.find((span) => span.id === "s1")?.text ?? "", /11 days/);
});
