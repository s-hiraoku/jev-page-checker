import assert from "node:assert/strict";
import { test } from "node:test";
import { isExtractMessage } from "./messages.js";

test("isExtractMessage accepts only EXTRACT with numeric limits", () => {
  assert.equal(isExtractMessage({ type: "EXTRACT", maxChars: 10000, minWords: 40 }), true);
  assert.equal(isExtractMessage({ type: "PAGE_CHANGED", fingerprint: "x" }), false);
  assert.equal(isExtractMessage({ type: "EXTRACT", maxChars: "10000", minWords: 40 }), false);
  assert.equal(isExtractMessage(null), false);
});
