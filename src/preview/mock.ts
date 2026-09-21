import { parseDefinition } from "../lib/checkkit.js";
import type { Bridge } from "../lib/bridge.js";
import { JEV_ENGLISH_CHARS_PER_TOKEN, bodyTokenBudget } from "../lib/jev-budget.js";
import { checkReplay, REPLAY_CLOCK, type ReplayFixture } from "../lib/replay.js";
import { DEFAULT_SETTINGS, parseSettings, type ExtensionSettings } from "../lib/settings.js";
import { buildSessionPayload, type SessionPayload, type StoredRecord } from "../lib/session.js";
import definitionRaw from "../../fixtures/page-credibility.checker.json";
import failReplay from "../../fixtures/replay/page-credibility-fail.json";
import passReplay from "../../fixtures/replay/page-credibility-pass.json";

const definition = parseDefinition(definitionRaw);

async function recordFrom(replay: ReplayFixture, id: string): Promise<StoredRecord> {
  return {
    id,
    tabId: 1,
    snapshot: {
      ...replay.state,
      extractedAt: REPLAY_CLOCK,
      textTruncated: replay.state.textTruncated ?? false,
    },
    report: await checkReplay(definition, replay),
    createdAt: REPLAY_CLOCK,
  };
}

export async function createPreviewBridge(scene: string): Promise<Bridge> {
  const passFile = passReplay as ReplayFixture;
  const pass = await recordFrom(passFile, "preview-pass");
  const fail = await recordFrom(failReplay as ReplayFixture, "preview-fail");
  const truncated = await recordFrom({ ...passFile, state: { ...passFile.state, textTruncated: true } }, "preview-truncated");
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
  const history = [pass, fail, truncated, chunked];

  const payload = (): SessionPayload => {
    const parsed = parseSettings(settings);
    if (scene === "setup") {
      return buildSessionPayload(definition, parsed, history, undefined);
    }
    const record = scene === "fail" ? fail : scene === "truncated" ? truncated : scene === "chunked" ? chunked : pass;
    return buildSessionPayload(definition, parsed, history, {
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
    openOptions: async () => {
      window.location.hash = "#options";
    },
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}
