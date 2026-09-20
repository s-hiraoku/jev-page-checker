import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_SETTINGS } from "./settings.js";
import { buildSessionPayload, sessionView, type StoredRecord } from "./session.js";

const ready = {
  status: "ready" as const,
  fingerprint: "fp",
  record: { id: "r1" } as StoredRecord,
};

test("sessionView asks for the whole-list approval before it shows a tab", () => {
  assert.deepEqual(sessionView(DEFAULT_SETTINGS, 3, ready), {
    status: "needs-setup",
    reason: "approval",
    definitionVersion: 3,
  });
});

test("sessionView asks for a key after the list is approved", () => {
  const settings = { ...DEFAULT_SETTINGS, approver: "ada", ackedVersion: 3 };
  assert.deepEqual(sessionView(settings, 3, ready), {
    status: "needs-setup",
    reason: "api-key",
    definitionVersion: 3,
  });
});

test("sessionView keeps idle, unsupported, checking, ready, and error distinct", () => {
  const settings = { ...DEFAULT_SETTINGS, approver: "ada", ackedVersion: 3, apiKey: "sk", followTab: false };
  assert.deepEqual(sessionView(settings, 3, undefined), { status: "idle", followTab: false });
  assert.deepEqual(sessionView(settings, 3, { status: "unsupported", url: "chrome://extensions" }), {
    status: "unsupported",
    url: "chrome://extensions",
  });
  assert.equal(sessionView(settings, 3, ready).status, "ready");
  assert.deepEqual(sessionView(settings, 3, { status: "error", message: "no" }), {
    status: "error",
    message: "no",
    snapshot: undefined,
  });
});

test("buildSessionPayload copies questions and does not hide settings", () => {
  const settings = { ...DEFAULT_SETTINGS, approver: "ada", ackedVersion: 1, apiKey: "sk" };
  const questions = [{ id: "identifiable_publisher" }] as unknown as Parameters<typeof buildSessionPayload>[0]["questions"];
  const payload = buildSessionPayload({ version: 1, questions }, settings, [ready.record], ready);
  assert.equal(payload.definitionVersion, 1);
  assert.equal(payload.questions.length, 1);
  assert.equal(payload.settings.apiKey, "sk");
  assert.equal(payload.view.status, "ready");
});
