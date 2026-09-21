import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveTheme } from "./theme.js";

test("resolveTheme follows an explicit preference", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("resolveTheme follows the system preference", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});
