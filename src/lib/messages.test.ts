import assert from "node:assert/strict";
import { test } from "node:test";
import { isExtractMessage, isSessionUpdated } from "./messages.js";

test("isExtractMessage accepts only EXTRACT with numeric minWords", () => {
  assert.equal(isExtractMessage({ type: "EXTRACT", minWords: 40 }), true);
  assert.equal(isExtractMessage({ type: "PAGE_CHANGED", fingerprint: "x" }), false);
  assert.equal(isExtractMessage({ type: "EXTRACT", minWords: "40" }), false);
  assert.equal(isExtractMessage(null), false);
});

test("isSessionUpdated accepts SESSION_UPDATED with or without a window", () => {
  assert.equal(isSessionUpdated({ type: "SESSION_UPDATED", windowId: 3 }), true);
  assert.equal(isSessionUpdated({ type: "SESSION_UPDATED" }), true);
  assert.equal(isSessionUpdated({ type: "GET_SESSION", windowId: 3 }), false);
  assert.equal(isSessionUpdated(null), false);
});
