import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bodyTokenBudget,
  bodyWindowCharBudget,
  estimateTokens,
  fitsJevBodyBudget,
  JEV_ENGLISH_CHARS_PER_TOKEN,
  JEV_PROMPT_OVERHEAD_RESERVE_TOKENS,
  JEV_QUESTION_AND_STATE_RESERVE_TOKENS,
  JEV_REQUEST_TOKEN_LIMIT,
  JEV_STATE_PLUS_LONGEST_QUESTION_TOKEN_LIMIT,
  trimToTokenBudget,
} from "./jev-budget.js";

test("official Jev limits are 32k for state plus longest question and 64k per request", () => {
  assert.equal(JEV_STATE_PLUS_LONGEST_QUESTION_TOKEN_LIMIT, 32_000);
  assert.equal(JEV_REQUEST_TOKEN_LIMIT, 64_000);
  assert.equal(JEV_ENGLISH_CHARS_PER_TOKEN, 150_000 / 32_000);
});

test("150,000 English characters estimate to 32,000 tokens using TypeSafe's published ratio", () => {
  assert.equal(estimateTokens("a".repeat(150_000)), 32_000);
});

test("CJK characters estimate one token each so Japanese stays under the 32k cap", () => {
  assert.equal(estimateTokens("あ".repeat(1_000)), 1_000);
  assert.equal(estimateTokens("発行"), 2);
});

test("the body budget leaves prompt and question overhead inside the 32k cap", () => {
  const budget = bodyTokenBudget();
  assert.equal(
    budget,
    JEV_STATE_PLUS_LONGEST_QUESTION_TOKEN_LIMIT - JEV_PROMPT_OVERHEAD_RESERVE_TOKENS - JEV_QUESTION_AND_STATE_RESERVE_TOKENS,
  );
  assert.ok(budget < JEV_STATE_PLUS_LONGEST_QUESTION_TOKEN_LIMIT);
  assert.ok(budget + JEV_PROMPT_OVERHEAD_RESERVE_TOKENS + JEV_QUESTION_AND_STATE_RESERVE_TOKENS <= JEV_STATE_PLUS_LONGEST_QUESTION_TOKEN_LIMIT);
  assert.ok(budget + JEV_PROMPT_OVERHEAD_RESERVE_TOKENS + JEV_QUESTION_AND_STATE_RESERVE_TOKENS < JEV_REQUEST_TOKEN_LIMIT);
});

test("an English page under the official ratio fits one call; the same length in Japanese does not", () => {
  const english = "x".repeat(bodyWindowCharBudget());
  const japanese = "あ".repeat(bodyWindowCharBudget());
  assert.equal(fitsJevBodyBudget(english), true);
  assert.equal(fitsJevBodyBudget(japanese), false);
});

test("trimToTokenBudget keeps CJK under the requested token count", () => {
  const trimmed = trimToTokenBudget("あ".repeat(100), 40);
  assert.equal(estimateTokens(trimmed), 40);
  assert.equal(trimmed.length, 40);
});
