import type { JevGateway } from "../../runner/index.js";
import { parseDefinition } from "../lib/checkkit.js";
import { buildCategoryDefinition } from "../lib/category-definition.js";
import { categoryChoiceDescriptions } from "../lib/category-rubrics.js";
import { classifyContent } from "../lib/content-classifier.js";
import type { Bridge } from "../lib/bridge.js";
import { JEV_ENGLISH_CHARS_PER_TOKEN, bodyTokenBudget } from "../lib/jev-budget.js";
import { checkReplay, REPLAY_CLOCK, snapshotFromReplay, type ReplayFixture } from "../lib/replay.js";
import { DEFAULT_SETTINGS, parseSettings, type ExtensionSettings } from "../lib/settings.js";
import { buildSessionPayload, withoutRecord, type SessionPayload, type StoredRecord } from "../lib/session.js";
import definitionRaw from "../../fixtures/page-credibility.checker.json";
import essayReplay from "../../fixtures/replay/page-credibility-essay.json";
import failReplay from "../../fixtures/replay/page-credibility-fail.json";
import passReplay from "../../fixtures/replay/page-credibility-pass.json";
import portalReplay from "../../fixtures/replay/page-credibility-portal.json";

const legacyDefinition = parseDefinition(definitionRaw);
// Preview fixtures keep their v8 Jev answers; the shell and Settings page still
// expose the current category question list used by the extension runtime.
const definition = buildCategoryDefinition(legacyDefinition);

function classificationGateway(distribution: Readonly<Record<string, number>>): JevGateway {
  const ranked = Object.entries(distribution).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const [choice, confidence] = ranked[0] ?? ["unclear", 0];
  return {
    async ask() {
      return {
        answers: {
          content_primary: { type: "choice", choice: choice ?? "unclear", confidence: confidence ?? 0, probabilities: { ...distribution } },
          content_secondary: { type: "choice", choice: "none", confidence: 0.8, probabilities: { none: 0.8 } },
          content_evidence: { type: "choice", choice: "title", confidence: 0.8, probabilities: { title: 0.8 } },
        },
        usage: { input_tokens: 0, output_tokens: 0 },
      };
    },
  };
}

async function previewClassification(replay: ReplayFixture, distribution: Readonly<Record<string, number>>) {
  const snapshot = snapshotFromReplay(replay.state);
  return classifyContent(
    snapshot,
    [{ text: snapshot.text, start: 0, end: snapshot.text.length }],
    classificationGateway(distribution),
    categoryChoiceDescriptions(),
  );
}

async function recordFrom(
  replay: ReplayFixture,
  id: string,
  createdAt: string,
  distribution: Readonly<Record<string, number>>,
): Promise<StoredRecord> {
  const report = await checkReplay(legacyDefinition, replay);
  const classification = await previewClassification(replay, distribution);
  const bodyQuestionIds = report.inspection?.bodyQuestionIds ?? [];
  return {
    id,
    tabId: 1,
    snapshot: {
      ...replay.state,
      extractedAt: REPLAY_CLOCK,
      textTruncated: replay.state.textTruncated ?? false,
    },
    report: {
      ...report,
      classification,
      inspection: report.inspection === undefined || classification.primary === undefined || bodyQuestionIds.length === 0
        ? report.inspection
        : { ...report.inspection, bodyQuestionGroups: [{ categoryId: classification.primary, questionIds: bodyQuestionIds }] },
    },
    createdAt,
  };
}

const ARTICLE_DISTRIBUTION = { reporting: 0.34, explanation: 0.22, announcement: 0.18, unclear: 0.26 };
const SALES_DISTRIBUTION = { sales: 0.37, announcement: 0.24, reporting: 0.21, unclear: 0.18 };
const ESSAY_DISTRIBUTION = { opinion: 0.36, explanation: 0.28, reporting: 0.2, unclear: 0.16 };

export async function createPreviewBridge(scene: string): Promise<Bridge> {
  const passFile = passReplay as ReplayFixture;
  const pass = await recordFrom(passFile, "preview-pass", "2026-09-20T08:00:00.000Z", ARTICLE_DISTRIBUTION);
  const fail = await recordFrom(failReplay as ReplayFixture, "preview-fail", "2026-09-20T09:30:00.000Z", SALES_DISTRIBUTION);
  const essay = await recordFrom(essayReplay as ReplayFixture, "preview-essay", "2026-09-20T10:00:00.000Z", ESSAY_DISTRIBUTION);
  const portal = await recordFrom(portalReplay as ReplayFixture, "preview-portal", "2026-09-20T10:30:00.000Z", ARTICLE_DISTRIBUTION);
  const truncated = await recordFrom(
    { ...passFile, state: { ...passFile.state, textTruncated: true } },
    "preview-truncated",
    "2026-09-20T11:00:00.000Z",
    ARTICLE_DISTRIBUTION,
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
    ARTICLE_DISTRIBUTION,
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
  let history = [pass, fail, essay, portal, truncated, chunked];

  const payload = (): SessionPayload => {
    const parsed = parseSettings(settings);
    if (scene === "setup") {
      return buildSessionPayload(definition, parsed, history, undefined);
    }
    const record = scene === "fail" ? fail : scene === "essay" ? essay : scene === "portal" ? portal : scene === "truncated" ? truncated : scene === "chunked" ? chunked : pass;
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
