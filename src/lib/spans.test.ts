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

test("extractSpans uses the same cut on the replay articles", () => {
  const pass = JSON.parse(readFileSync("fixtures/replay/page-credibility-pass.json", "utf8")) as { state: { text: string } };
  const fail = JSON.parse(readFileSync("fixtures/replay/page-credibility-fail.json", "utf8")) as { state: { text: string } };
  const passSpans = extractSpans(pass.state.text);
  const failSpans = extractSpans(fail.state.text);
  assert.match(passSpans.find((span) => span.id === "s2")?.text ?? "", /12 September/);
  assert.match(failSpans.find((span) => span.id === "s1")?.text ?? "", /11 days/);
});
