import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SETTINGS, parseSettings, setupGap } from "./settings.js";

test("parseSettings fills defaults and clamps ranges", () => {
  const parsed = parseSettings({ debounceMs: 10, maxChars: 999999, followTab: false, approver: "ada" });
  assert.equal(parsed.debounceMs, 250);
  assert.equal(parsed.followTab, false);
  assert.equal(parsed.recheckOnChange, true);
  assert.equal(parsed.apiKey, "");
  assert.equal(parsed.theme, "system");
  assert.equal(parsed.locale, "system");
  assert.equal("maxChars" in parsed, false);
  assert.equal("approver" in parsed, false);
});

test("parseSettings keeps an explicit theme and locale and rejects unknown values", () => {
  assert.equal(parseSettings({ theme: "light" }).theme, "light");
  assert.equal(parseSettings({ theme: "dark" }).theme, "dark");
  assert.equal(parseSettings({ theme: "system" }).theme, "system");
  assert.equal(parseSettings({ theme: "sepia" }).theme, "system");
  assert.equal(parseSettings({ locale: "en" }).locale, "en");
  assert.equal(parseSettings({ locale: "ja" }).locale, "ja");
  assert.equal(parseSettings({ locale: "fr" }).locale, "system");
});

test("setupGap asks for the whole-list checkbox before it asks for a key", () => {
  assert.equal(setupGap(DEFAULT_SETTINGS, 1), "approval");
  assert.equal(setupGap({ ...DEFAULT_SETTINGS, ackedVersion: 1 }, 1), "api-key");
  assert.equal(setupGap({ ...DEFAULT_SETTINGS, ackedVersion: 0, apiKey: "sk" }, 1), "approval");
  assert.equal(setupGap({ ...DEFAULT_SETTINGS, ackedVersion: 1, apiKey: "sk" }, 1), null);
});
