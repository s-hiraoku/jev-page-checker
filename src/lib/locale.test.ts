import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveLocale } from "./locale.js";

test("resolveLocale follows an explicit preference", () => {
  assert.equal(resolveLocale("ja", "en-US"), "ja");
  assert.equal(resolveLocale("en", "ja-JP"), "en");
});

test("resolveLocale follows the browser language", () => {
  assert.equal(resolveLocale("system", "ja"), "ja");
  assert.equal(resolveLocale("system", "ja-JP"), "ja");
  assert.equal(resolveLocale("system", "en-US"), "en");
  assert.equal(resolveLocale("system", "fr-FR"), "en");
});
