import { parseDefinition } from "../lib/checkkit.js";
import type { Bridge } from "../lib/bridge.js";
import { JEV_ENGLISH_CHARS_PER_TOKEN, bodyTokenBudget } from "../lib/jev-budget.js";
import { checkReplay, REPLAY_CLOCK, type ReplayFixture } from "../lib/replay.js";
import { DEFAULT_SETTINGS, parseSettings, type ExtensionSettings } from "../lib/settings.js";
import { buildSessionPayload, withoutRecord, type SessionPayload, type StoredRecord } from "../lib/session.js";
import type { ContentClassificationSummary } from "../../runner/types.js";
import definitionRaw from "../../fixtures/page-credibility.checker.json";
import failReplay from "../../fixtures/replay/page-credibility-fail.json";
import passReplay from "../../fixtures/replay/page-credibility-pass.json";

const definition = parseDefinition(definitionRaw);

function previewClassification(replay: ReplayFixture): ContentClassificationSummary {
  if (!replay.state.hasArticle || !replay.state.hasBody || replay.state.text.length === 0) {
    return {
      status: "not_applicable",
      reasonCode: "no_single_body",
      reason: "このページには分類できる本文がありません。",
    };
  }
  const sales = /order|pill|buy|購入|注文/i.test(`${replay.state.title} ${replay.state.metaDescription}`);
  return {
    status: "classified",
    primary: sales ? "sales" : "reporting",
    confidence: 0.9,
    evidence: { text: replay.state.title, source: "title" },
  };
}

async function recordFrom(replay: ReplayFixture, id: string, createdAt: string): Promise<StoredRecord> {
  const report = await checkReplay(definition, replay);
  return {
    id,
    tabId: 1,
    snapshot: {
      ...replay.state,
      extractedAt: REPLAY_CLOCK,
      textTruncated: replay.state.textTruncated ?? false,
    },
    report: { ...report, classification: previewClassification(replay) },
    createdAt,
  };
}

export async function createPreviewBridge(scene: string): Promise<Bridge> {
  const passFile = passReplay as ReplayFixture;
  const pass = await recordFrom(passFile, "preview-pass", "2026-09-20T08:00:00.000Z");
  const fail = await recordFrom(failReplay as ReplayFixture, "preview-fail", "2026-09-20T09:30:00.000Z");
  const truncated = await recordFrom(
    { ...passFile, state: { ...passFile.state, textTruncated: true } },
    "preview-truncated",
    "2026-09-20T11:00:00.000Z",
  );
  const chunked = await recordFrom(
    {
      ...passFile,
      state: {
        ...passFile.state,
        text: `${passFile.state.text} ${"x".repeat(Math.ceil((bodyTokenBudget() + 32) * JEV_ENGLISH_CHARS_PER_TOKEN))}`,
        textTruncated: false,
      },
    },
    "preview-chunked",
    "2026-09-20T12:15:00.000Z",
  );
  let settings: ExtensionSettings = {
    ...DEFAULT_SETTINGS,
    apiKey: scene === "setup" ? "" : "sk-preview",
    ackedVersion: scene === "setup" ? null : definition.version,
    followTab: true,
  };
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  let history = [pass, fail, truncated, chunked];

  const payload = (): SessionPayload => {
    const parsed = parseSettings(settings);
    if (scene === "setup") {
      return buildSessionPayload(definition, parsed, history, undefined);
    }
    const record = scene === "fail" ? fail : scene === "truncated" ? truncated : scene === "chunked" ? chunked : pass;
    const scenarioHistory = [record, ...history.filter((entry) => entry.id !== record.id)];
    return buildSessionPayload(definition, parsed, scenarioHistory, {
      status: "ready",
      record,
      fingerprint: "",
    });
  };

  return {
    getSession: async () => payload(),
    saveSettings: async (next) => {
      settings = parseSettings(next);
      notify();
      return payload();
    },
    checkNow: async () => payload(),
    openDetails: async (id) => {
      const current = payload();
      const resolved = id ?? (current.view.status === "ready" ? current.view.record.id : undefined);
      const next = new URL(window.location.href);
      if (resolved) next.searchParams.set("id", resolved);
      next.hash = "#details";
      window.location.assign(`${next.pathname}${next.search}${next.hash}`);
    },
    openHistory: async () => {
      window.location.hash = "#history";
    },
    openOptions: async () => {
      window.location.hash = "#options";
    },
    deleteHistory: async (id) => {
      history = withoutRecord(history, id);
      notify();
      return payload();
    },
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}
