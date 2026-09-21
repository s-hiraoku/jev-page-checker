import assert from "node:assert/strict";
import { test } from "node:test";
import { activeTabQuery, isWindowActiveTab, sessionUpdateApplies, TabDebouncer } from "./window-session.js";

test("activeTabQuery scopes to a window when one is given", () => {
  assert.deepEqual(activeTabQuery(7), { active: true, windowId: 7 });
  assert.deepEqual(activeTabQuery(), { active: true, lastFocusedWindow: true });
});

test("sessionUpdateApplies keeps a side panel on its own window", () => {
  assert.equal(sessionUpdateApplies(2, 2, true), true);
  assert.equal(sessionUpdateApplies(1, 2, true), false);
  assert.equal(sessionUpdateApplies(undefined, 2, true), true);
  assert.equal(sessionUpdateApplies(1, 2, false), true);
  assert.equal(sessionUpdateApplies(1, undefined, true), false);
});

test("isWindowActiveTab keeps Inspector on the window's front tab", () => {
  assert.equal(isWindowActiveTab(4, 4), true);
  assert.equal(isWindowActiveTab(4, 9), false);
  assert.equal(isWindowActiveTab(4, undefined), false);
});

test("TabDebouncer does not let one tab cancel another", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const ran: number[] = [];
  const debounce = new TabDebouncer();
  debounce.schedule(1, 1000, (tabId) => ran.push(tabId));
  debounce.schedule(2, 1000, (tabId) => ran.push(tabId));
  debounce.schedule(1, 1000, (tabId) => ran.push(tabId));
  t.mock.timers.tick(1000);
  assert.deepEqual(ran.sort((left, right) => left - right), [1, 2]);
});

test("TabDebouncer cancel drops only that tab", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const ran: number[] = [];
  const debounce = new TabDebouncer();
  debounce.schedule(1, 500, (tabId) => ran.push(tabId));
  debounce.schedule(2, 500, (tabId) => ran.push(tabId));
  debounce.cancel(1);
  t.mock.timers.tick(500);
  assert.deepEqual(ran, [2]);
});
