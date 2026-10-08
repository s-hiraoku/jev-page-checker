import assert from "node:assert/strict";
import { test } from "node:test";
import { applyAutoOff, countCheck, dailyLimitReached, extendAutoOff, localDay, parseUsage, settingsAfterSave } from "./check-guard.js";
import { DEFAULT_SETTINGS, parseSettings } from "./settings.js";

const MINUTE = 60_000;
const now = new Date(2026, 9, 8, 10, 0).getTime();

test("checks that are on get a deadline, and turn off once it passes", () => {
  const on = applyAutoOff({ ...DEFAULT_SETTINGS, autoOffMinutes: 30 }, now);
  assert.equal(on.checksEnabled, true);
  assert.equal(on.checksOffAt, now + 30 * MINUTE);
  assert.equal(applyAutoOff(on, now + 29 * MINUTE), on);
  const off = applyAutoOff(on, now + 30 * MINUTE);
  assert.equal(off.checksEnabled, false);
  assert.equal(off.checksOffAt, null);
});

test("autoOffMinutes 0 keeps checks on and clears any deadline", () => {
  const kept = applyAutoOff({ ...DEFAULT_SETTINGS, autoOffMinutes: 0, checksOffAt: now - MINUTE }, now);
  assert.equal(kept.checksEnabled, true);
  assert.equal(kept.checksOffAt, null);
});

test("turning checks on or changing the time restarts the deadline; other saves keep it", () => {
  const running = { ...DEFAULT_SETTINGS, autoOffMinutes: 60, checksOffAt: now + 10 * MINUTE };
  const kept = settingsAfterSave(running, { ...running, minWords: 80, checksOffAt: 0 }, now);
  assert.equal(kept.checksOffAt, now + 10 * MINUTE);
  const changed = settingsAfterSave(running, { ...running, autoOffMinutes: 15 }, now);
  assert.equal(changed.checksOffAt, now + 15 * MINUTE);
  const off = { ...running, checksEnabled: false, checksOffAt: null };
  assert.equal(settingsAfterSave(off, { ...off, checksEnabled: true }, now).checksOffAt, now + 60 * MINUTE);
  assert.equal(settingsAfterSave(running, { ...running, checksEnabled: false }, now).checksOffAt, null);
});

test("a manual check restarts the count only while checks are on", () => {
  const running = { ...DEFAULT_SETTINGS, autoOffMinutes: 60, checksOffAt: now + MINUTE };
  assert.equal(extendAutoOff(running, now).checksOffAt, now + 60 * MINUTE);
  const off = { ...running, checksEnabled: false, checksOffAt: null };
  assert.equal(extendAutoOff(off, now), off);
});

test("the daily count resets on a new local day and stops automatic checks at the limit", () => {
  const settings = { ...DEFAULT_SETTINGS, dailyCheckLimit: 2 };
  let usage = parseUsage(undefined, now);
  assert.deepEqual(usage, { day: localDay(now), checks: 0 });
  usage = countCheck(countCheck(usage, now), now);
  assert.equal(dailyLimitReached(settings, usage, now), true);
  assert.equal(dailyLimitReached({ ...settings, dailyCheckLimit: 0 }, usage, now), false);
  const tomorrow = now + 24 * 60 * MINUTE;
  assert.equal(dailyLimitReached(settings, usage, tomorrow), false);
  assert.deepEqual(countCheck(usage, tomorrow), { day: localDay(tomorrow), checks: 1 });
});

test("parseSettings defaults to a 60 minute auto-off and a 50 check daily limit", () => {
  const parsed = parseSettings({});
  assert.equal(parsed.autoOffMinutes, 60);
  assert.equal(parsed.dailyCheckLimit, 50);
  assert.equal(parsed.checksOffAt, null);
  assert.equal(parseSettings({ autoOffMinutes: -5, dailyCheckLimit: 1e9 }).autoOffMinutes, 0);
  assert.equal(parseSettings({ dailyCheckLimit: 1e9 }).dailyCheckLimit, 10000);
});
